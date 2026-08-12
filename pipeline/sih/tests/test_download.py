"""Prova a guarda de trava do download FTP (GUARDA-TRAVAMENTO, 2026-08-11, hardening de
PIPE-06) e a correção de download vazio (FIX-DOWNLOAD-VAZIO, 2026-08-12) -- e que o isolamento
por arquivo já existente (`download_all`) continua intacto.

Incidente real (guarda de trava): `RDPR1805.dbc` ficou 9h sem NENHUM byte novo, socket TCP ainda
`ESTABLISHED`, sem exceção, sem log. Regressão real (download vazio): a re-coleta seguinte
corrompeu 152 de 420 arquivos (.dbc de 0 bytes) SEM a guarda de trava disparar nenhuma vez --
ver `Prova 4` para a correção e `Prova 5` para o único teste desta suíte que toca rede de
verdade. As Provas 1-3 (herdadas de GUARDA-TRAVAMENTO) continuam offline -- a trava é simulada
injetando uma `tentativa`/`ftp_factory` falsa que levanta `TimeoutError` (o mesmo tipo que um
`socket.settimeout` real levantaria num `recv()` sem dado novo), nunca por dormir minutos.
"""

from __future__ import annotations

import os
import socket
import types

import pytest

from sih_pipeline import download
from sih_pipeline import enumerate as enumerate_mod
from sih_pipeline.download import (
    DownloadStalledError,
    DownloadVazioError,
    _com_guarda_de_trava,
    _uma_tentativa_de_download,
    download_all,
    download_one,
)
from sih_pipeline.ledger import STATUS_BAIXADO, STATUS_FALHOU, FileLedger

# ---------------------------------------------------------------------------
# Prova 1 -- `_com_guarda_de_trava` isolada (sem pysus, sem FTP, sem sleep real).
# ---------------------------------------------------------------------------


def test_guarda_detecta_trava_e_levanta_downloadstalledeerror_apos_esgotar_tentativas():
    """Uma `tentativa` que trava (TimeoutError) em TODAS as chamadas -- simula o incidente real
    (bytes param de chegar, socket seguiria ESTABLISHED) -- é retentada até o limite e então
    vira `DownloadStalledError`, nunca propaga o `TimeoutError` cru."""
    chamadas = 0

    def tentativa_sempre_trava() -> None:
        nonlocal chamadas
        chamadas += 1
        raise TimeoutError("simulated: recv() sem bytes novos")

    logs: list[str] = []

    with pytest.raises(DownloadStalledError) as exc_info:
        _com_guarda_de_trava(
            tentativa_sempre_trava,
            file_name="RDPR1805",
            max_retries=3,
            log=logs.append,
        )

    assert chamadas == 3  # nunca mais que o limite configurado
    assert isinstance(exc_info.value.__cause__, TimeoutError)  # causa original encadeada
    assert "RDPR1805" in str(exc_info.value)
    assert len(logs) == 3  # uma linha de log por tentativa -- os 9h silenciosos não se repetem
    assert all("RDPR1805" in linha and "travou" in linha for linha in logs)
    assert "desistindo" in logs[-1]  # a última tentativa loga que desistiu, não que vai retentar


def test_guarda_reseta_apos_trava_transitoria_seguida_de_sucesso():
    """Duas travas seguidas de sucesso -- a classe de falha é tratada como transitória
    (rede pública do DATASUS): a guarda tenta de novo e o arquivo termina bem, sem exceção."""
    chamadas = 0

    def tentativa_trava_duas_vezes() -> None:
        nonlocal chamadas
        chamadas += 1
        if chamadas <= 2:
            raise TimeoutError("simulated: recv() sem bytes novos")
        # 3a chamada: sucesso, sem levantar nada

    logs: list[str] = []
    _com_guarda_de_trava(
        tentativa_trava_duas_vezes,
        file_name="RDMA2110",
        max_retries=3,
        log=logs.append,
    )

    assert chamadas == 3
    assert len(logs) == 2  # só as duas tentativas que travaram geram log
    assert "tentando de novo" in logs[0]
    assert "tentando de novo" in logs[1]


def test_guarda_nao_mata_transferencia_lenta_mas_saudavel():
    """REGRESSÃO -- uma transferência que nunca perde progresso (mesmo que demore, ex.: SP/MG
    inteiros) não pode ser tratada como trava. Aqui isso significa: a `tentativa` real (que por
    baixo é `ftp.retrbinary`, cujo socket só levanta `TimeoutError` se ficar sem dado novo por
    `STALL_TIMEOUT_SEC`) simplesmente retorna com sucesso -- a guarda não intervém, não retenta,
    não loga nada."""
    chamadas = 0

    def tentativa_grande_mas_saudavel() -> None:
        nonlocal chamadas
        chamadas += 1
        # nunca levanta -- equivalente a um retrbinary real que terminou entregando bytes até o
        # fim, por mais que tenha demorado horas no mundo real.

    logs: list[str] = []
    _com_guarda_de_trava(
        tentativa_grande_mas_saudavel,
        file_name="RDSP1901",
        max_retries=3,
        log=logs.append,
    )

    assert chamadas == 1  # uma chamada só -- nenhum retry desperdiçado numa transferência sã
    assert logs == []  # nenhum log de trava -- nada de anormal aconteceu


def test_guarda_respeita_o_limite_exato_de_tentativas():
    """Uma trava permanente com `max_retries=2` para no número exato configurado, nunca a mais
    (ex.: nunca cai de volta no `MAX_STALL_RETRIES` default do módulo) nem a menos."""
    chamadas = 0

    def tentativa_sempre_trava() -> None:
        nonlocal chamadas
        chamadas += 1
        raise TimeoutError("simulated")

    with pytest.raises(DownloadStalledError):
        _com_guarda_de_trava(
            tentativa_sempre_trava, file_name="RDBA1901", max_retries=2, log=lambda _msg: None
        )

    assert chamadas == 2


def test_guarda_nao_retenta_erro_que_nao_e_trava():
    """Um erro que NÃO é falta de progresso (ex.: permissão, arquivo sumiu da listagem) propaga
    na primeira ocorrência, sem consumir tentativa -- só `TimeoutError` é tratado como trava
    retentável; qualquer outra exceção precisa continuar caindo direto no PIPE-06 existente."""
    chamadas = 0

    def tentativa_erro_permanente() -> None:
        nonlocal chamadas
        chamadas += 1
        raise RuntimeError("arquivo RDXX9999 não encontrado na listagem atual do FTP")

    with pytest.raises(RuntimeError, match="não encontrado"):
        _com_guarda_de_trava(
            tentativa_erro_permanente, file_name="RDXX9999", max_retries=3, log=lambda _msg: None
        )

    assert chamadas == 1  # nenhum retry -- não é a classe de erro que a guarda trata


# ---------------------------------------------------------------------------
# Prova 2 -- `download_one` integrado com uma `ftp_factory` falsa (sem pysus real, sem rede).
# ---------------------------------------------------------------------------


class _FakeSocket:
    def __init__(self) -> None:
        self.timeouts_set: list[float] = []

    def settimeout(self, value: float) -> None:
        self.timeouts_set.append(value)


class _FakeFTP:
    """Substitui `ftplib.FTP` -- `retrbinary` escreve alguns bytes (prova que a guarda não
    depende de zero progresso, o incidente real também tinha bytes parciais em disco) e então
    decide travar ou terminar, conforme `comportamento`."""

    def __init__(self, comportamento) -> None:
        self.sock = _FakeSocket()
        self.timeout: float | None = None
        self._comportamento = comportamento

    def retrbinary(self, cmd: str, callback) -> None:
        callback(b"bytes-parciais-antes-da-trava")
        self._comportamento(callback)


class _FakeFTPSingleton:
    """Substitui `pysus.ftp.FTPSingleton` -- uma nova `_FakeFTP` por chamada de
    `get_instance()`, replicando a disciplina real de `_uma_tentativa_de_download`
    (reconecta do zero a cada tentativa)."""

    def __init__(self, comportamentos: list) -> None:
        self._comportamentos = iter(comportamentos)
        self.get_instance_calls = 0
        self.close_calls = 0
        self.instancias: list[_FakeFTP] = []

    def get_instance(self) -> _FakeFTP:
        self.get_instance_calls += 1
        instancia = _FakeFTP(next(self._comportamentos))
        self.instancias.append(instancia)
        return instancia

    def close(self) -> None:
        self.close_calls += 1


def _fake_file(name: str = "RDPR1805") -> types.SimpleNamespace:
    return types.SimpleNamespace(
        name=name,
        basename=f"{name}.dbc",
        path=f"/dissemin/publicos/SIHSUS/200801_/Dados/{name}.dbc",
    )


def test_download_one_esgota_tentativas_reconecta_e_levanta_downloadstalledeerror(cache_dir):
    """A trava real (RDPR1805, 2026-08-11): toda tentativa trava -- `download_one` reconecta do
    zero em cada uma (nunca reaproveita uma conexão que acabou de travar), arma o timeout de
    socket nos dois níveis (`sock.settimeout` + `ftp.timeout`), esgota as tentativas, levanta
    `DownloadStalledError` e limpa o `.dbc` parcial -- nunca deixa lixo nem ledger sujo."""

    def sempre_trava(callback) -> None:
        raise TimeoutError("simulated: recv() sem bytes novos")

    fake_singleton = _FakeFTPSingleton([sempre_trava] * download.MAX_STALL_RETRIES)
    ledger = FileLedger()
    file = _fake_file()

    with pytest.raises(DownloadStalledError):
        download_one(file, ledger, ftp_factory=fake_singleton)

    assert fake_singleton.get_instance_calls == download.MAX_STALL_RETRIES
    # um close() por tentativa (reconectar do zero) + um close() final no `finally`.
    assert fake_singleton.close_calls == download.MAX_STALL_RETRIES + 1
    for instancia in fake_singleton.instancias:
        assert instancia.timeout == download.STALL_TIMEOUT_SEC
        assert instancia.sock.timeouts_set == [download.STALL_TIMEOUT_SEC]

    dbc_path = cache_dir / "parquet" / f"{file.basename}"
    assert not dbc_path.exists()  # PIPE-06: nunca deixa `.dbc` parcial travado no cache
    assert ledger.status(file.name) == "nunca_tentado"  # download_one não mexe no ledger direto


def test_download_one_recupera_de_trava_transitoria_e_completa(cache_dir, monkeypatch):
    """Uma trava na primeira tentativa, sucesso na segunda -- prova a composição completa:
    guarda + reconexão + conclusão real do download (hash/conversão/ledger), não só o caminho
    de falha."""
    tentativas: list[int] = []

    def trava_na_primeira(callback) -> None:
        tentativas.append(1)
        if len(tentativas) == 1:
            raise TimeoutError("simulated: recv() sem bytes novos")
        callback(b"conteudo-completo-do-arquivo")

    fake_singleton = _FakeFTPSingleton([trava_na_primeira, trava_na_primeira])

    monkeypatch.setattr(download, "_sha256_of_file", lambda path: "a" * 64)
    monkeypatch.setattr(download, "_count_parquet_rows", lambda parquet_dir: 0)
    # dbc_to_dbf/dbf_to_parquet são importados de dentro de download_one (pysus.data) -- faz o
    # dublê no módulo real, mesma técnica de import local usada pelo próprio código de produção.
    import pysus.data as pysus_data_mod

    monkeypatch.setattr(pysus_data_mod, "dbc_to_dbf", lambda path: path)
    monkeypatch.setattr(pysus_data_mod, "dbf_to_parquet", lambda path: path)

    ledger = FileLedger()
    file = _fake_file(name="RDMA2110")

    download_one(file, ledger, ftp_factory=fake_singleton)

    assert fake_singleton.get_instance_calls == 2  # travou 1x, reconectou, terminou na 2a
    assert ledger.status(file.name) == STATUS_BAIXADO
    dbc_path = cache_dir / "parquet" / f"{file.basename}"
    assert dbc_path.exists()  # download concluído -- arquivo fica no cache


# ---------------------------------------------------------------------------
# Prova 3 -- `download_all`: o isolamento por arquivo (PIPE-06) sobrevive ao arquivo travado.
# ---------------------------------------------------------------------------


def test_download_all_isola_arquivo_travado_sem_derrubar_a_corrida(cache_dir, monkeypatch):
    """Dois arquivos pendentes: um trava para sempre (esgota a guarda -> DownloadStalledError),
    o outro baixa normalmente. A corrida NUNCA pode morrer por causa do primeiro -- exatamente o
    contrato que PIPE-06/T-09-18 já garantiam antes desta guarda existir, e que continua valendo
    depois dela."""
    monkeypatch.setattr(
        enumerate_mod, "expected_file_names", lambda: frozenset({"RDPR1805", "RDMA2110"})
    )
    monkeypatch.setattr(enumerate_mod, "fetch_actual_file_names", lambda: frozenset({"RDPR1805", "RDMA2110"}))
    monkeypatch.setattr(enumerate_mod, "assert_no_missing", lambda expected, actual: None)
    monkeypatch.setattr(
        download,
        "_fetch_actual_files",
        lambda: {"RDPR1805": _fake_file("RDPR1805"), "RDMA2110": _fake_file("RDMA2110")},
    )
    monkeypatch.setattr(download, "REQUEST_DELAY_SEC", 0)

    def fake_download_one(file, ledger, *, ftp_factory=None):
        if file.name == "RDPR1805":
            raise DownloadStalledError(
                f"{file.name}: travou (sem progresso por {download.STALL_TIMEOUT_SEC:.0f}s) em "
                f"{download.MAX_STALL_RETRIES} tentativa(s) -- desistindo, isolado por arquivo (PIPE-06)"
            )
        ledger.mark_collected(file.name, row_count=100, sha256="b" * 64, parquet_dir="/x")

    monkeypatch.setattr(download, "download_one", fake_download_one)

    resultado = download_all()

    assert resultado.status("RDPR1805") == STATUS_FALHOU
    assert "travou" in resultado.entry("RDPR1805")["reason"]
    assert resultado.status("RDMA2110") == STATUS_BAIXADO  # o outro arquivo nunca foi afetado

    summary = resultado.summary()
    assert summary["falhou"] == 1
    assert summary["baixado"] == 1


# ---------------------------------------------------------------------------
# Prova 4 -- FIX-DOWNLOAD-VAZIO (2026-08-12): a corrupção medida em produção (152/420 arquivos,
# .dbc de 0 bytes, ZERO disparos da guarda de trava) e a correção -- validar tamanho/cabeçalho
# ANTES de marcar `baixado`, e limpar o `.dbc` em QUALQUER falha no caminho, não só na guarda.
# ---------------------------------------------------------------------------


class _FakeFTPBytesFixos:
    """Substitui `ftplib.FTP` com uma resposta determinística: `retrbinary` escreve exatamente
    `payload` (pode ser vazio) e retorna SEM exceção -- simula um FTP que responde "226
    Transfer complete" tenha ou não transferido dado de verdade (a corrupção real medida)."""

    def __init__(self, payload: bytes) -> None:
        self.sock = None
        self.timeout: float | None = None
        self._payload = payload

    def retrbinary(self, cmd: str, callback) -> None:
        if self._payload:
            callback(self._payload)


class _FakeFTPSingletonBytesFixos:
    """Substitui `FTPSingleton` -- sempre devolve uma `_FakeFTPBytesFixos` com o mesmo payload,
    em quantas chamadas de `get_instance()` forem feitas (a guarda pode reconectar várias vezes
    tentando o mesmo download vazio)."""

    def __init__(self, payload: bytes) -> None:
        self._payload = payload
        self.get_instance_calls = 0
        self.close_calls = 0

    def get_instance(self) -> _FakeFTPBytesFixos:
        self.get_instance_calls += 1
        return _FakeFTPBytesFixos(self._payload)

    def close(self) -> None:
        self.close_calls += 1


def test_uma_tentativa_de_download_levanta_downloadvazioerror_quando_ftp_reporta_sucesso_sem_bytes(
    cache_dir,
):
    """A corrupção medida em produção, isolada no menor escopo possível: `retrbinary` retorna
    SEM exceção (nenhum TimeoutError, a guarda de trava nunca dispara) mas não escreve nenhum
    byte -- tem que virar `DownloadVazioError` explícito, nunca um `.dbc` de 0 bytes aceito como
    download completo."""
    dbc_path = cache_dir / "parquet" / "RDAC1301.dbc"
    dbc_path.parent.mkdir(parents=True, exist_ok=True)
    file = _fake_file("RDAC1301")

    with pytest.raises(DownloadVazioError, match="RDAC1301"):
        _uma_tentativa_de_download(
            file, dbc_path, ftp_factory=_FakeFTPSingletonBytesFixos(b"")
        )

    assert dbc_path.exists()  # "wb" cria o arquivo mesmo sem escrever nada -- 0 bytes em disco
    assert dbc_path.stat().st_size == 0


def test_uma_tentativa_de_download_nao_levanta_quando_ha_pelo_menos_um_byte(cache_dir):
    """REGRESSÃO -- a checagem de download vazio é estritamente sobre 0 bytes, nunca sobre
    "poucos" bytes: um `.dbc` pequeno mas não-vazio passa por `_uma_tentativa_de_download` sem
    levantar (a validação de conteúdo/cabeçalho é responsabilidade de `dbc_to_dbf`, não daqui)."""
    dbc_path = cache_dir / "parquet" / "RDAC1301.dbc"
    dbc_path.parent.mkdir(parents=True, exist_ok=True)
    file = _fake_file("RDAC1301")

    _uma_tentativa_de_download(file, dbc_path, ftp_factory=_FakeFTPSingletonBytesFixos(b"\x00"))

    assert dbc_path.stat().st_size == 1


def test_guarda_retenta_download_vazio_como_falha_transitoria_e_recupera():
    """`DownloadVazioError` é tratada pela guarda exatamente como `TimeoutError`: falha
    transitória, retentável, sem propagar na primeira ocorrência -- uma trava de "vazio" seguida
    de sucesso não pode virar falha permanente do arquivo."""
    chamadas = 0

    def tentativa_vazia_duas_vezes() -> None:
        nonlocal chamadas
        chamadas += 1
        if chamadas <= 2:
            raise DownloadVazioError("simulated: FTP reportou sucesso sem transferir dado")
        # 3a chamada: sucesso, sem levantar nada

    logs: list[str] = []
    _com_guarda_de_trava(
        tentativa_vazia_duas_vezes,
        file_name="RDAC1301",
        max_retries=3,
        log=logs.append,
    )

    assert chamadas == 3
    assert len(logs) == 2
    assert all("RDAC1301" in linha and "vazio" in linha for linha in logs)
    assert "tentando de novo" in logs[0]


def test_guarda_esgota_tentativas_de_download_vazio_e_levanta_downloadstalledeerror():
    """Download vazio PERSISTENTE (nunca melhora) esgota as tentativas exatamente como um stall
    persistente -- vira `DownloadStalledError` encadeado a partir do `DownloadVazioError`
    original (nunca um `TimeoutError` cru, já que a guarda nunca disparou de verdade)."""
    chamadas = 0

    def tentativa_sempre_vazia() -> None:
        nonlocal chamadas
        chamadas += 1
        raise DownloadVazioError("simulated: sempre vazio")

    logs: list[str] = []
    with pytest.raises(DownloadStalledError) as exc_info:
        _com_guarda_de_trava(
            tentativa_sempre_vazia, file_name="RDAC1301", max_retries=3, log=logs.append
        )

    assert chamadas == 3
    assert isinstance(exc_info.value.__cause__, DownloadVazioError)
    assert "RDAC1301" in str(exc_info.value)
    assert "vazio" in str(exc_info.value)
    assert "travou" not in str(exc_info.value)  # nunca alegar "trava" quando a causa foi outra
    assert "desistindo" in logs[-1]


def test_download_one_apaga_dbc_e_nao_marca_baixado_quando_download_volta_vazio(cache_dir):
    """Integração completa (sem rede): a corrupção medida em produção reproduzida ponta a ponta
    -- `download_one` esgota a guarda contra um FTP fake que sempre "termina bem" com 0 bytes,
    apaga o `.dbc` de 0 bytes que ficaria para trás e NUNCA chama `ledger.mark_collected`
    (contrato do `FileLedger`: `baixado` continua significando baixado E hash-verificado)."""
    fake_singleton = _FakeFTPSingletonBytesFixos(b"")
    ledger = FileLedger()
    file = _fake_file("RDAC1301")

    with pytest.raises(DownloadStalledError, match="vazio"):
        download_one(file, ledger, ftp_factory=fake_singleton)

    assert fake_singleton.get_instance_calls == download.MAX_STALL_RETRIES
    dbc_path = cache_dir / "parquet" / f"{file.basename}"
    assert not dbc_path.exists()  # nunca deixa o .dbc vazio para trás no cache
    assert ledger.status(file.name) == "nunca_tentado"  # download_one não mexe no ledger direto


def test_download_one_dbc_nao_vazio_mas_com_cabecalho_invalido_falha_sem_deixar_lixo(cache_dir):
    """A OUTRA metade da validação: o `.dbc` baixado tem bytes (>0, passa pela checagem de
    `DownloadVazioError`) mas o conteúdo não é um DBC válido -- usa o `pyreaddbc`/`pysus` de
    verdade (dependência real, sem mock nenhum) para reproduzir a corrupção medida em produção.

    Nuance medida (não assumida): `dbc_to_dbf()` NÃO levanta em Python para este caso -- imprime
    "Invalid or corrupt DBC file ... implausible header size" em stderr e devolve um `.dbf` de
    0 bytes, já tendo apagado o `.dbc` de origem sem condição nenhuma. É `dbf_to_parquet()` (o
    passo seguinte, lendo esse `.dbf` vazio) quem realmente levanta (`struct.error`) -- e essa
    função do PRÓPRIO pysus já se autolimpa nesse except (apaga `.dbf`, remove o diretório
    `.parquet` vazio). Resultado ponta a ponta continua sendo exatamente o exigido: nada fica
    para trás no cache e o arquivo NUNCA vira `baixado`."""
    fake_singleton = _FakeFTPSingletonBytesFixos(b"\x00" * 10)
    ledger = FileLedger()
    file = _fake_file("RDAC1301")

    with pytest.raises(Exception, match="unpack requires a buffer"):
        download_one(file, ledger, ftp_factory=fake_singleton)

    dbc_path = cache_dir / "parquet" / f"{file.basename}"
    assert not dbc_path.exists()
    assert not (cache_dir / "parquet" / "RDAC1301.dbf").exists()
    assert not (cache_dir / "parquet" / "RDAC1301.parquet").exists()
    assert ledger.status(file.name) == "nunca_tentado"  # nunca vira baixado com dado corrompido


def test_download_one_apaga_dbc_quando_falha_depois_da_conversao_ja_ter_terminado(
    cache_dir, monkeypatch
):
    """A rede de segurança que o `pysus` NÃO cobre: uma falha em `_count_parquet_rows` (não em
    `dbc_to_dbf`/`dbf_to_parquet`, que já se autolimpam para `struct.error`) acontece DEPOIS que
    a conversão "terminou" -- sem o cleanup ampliado desta correção, o `.dbc` (que `dbc_to_dbf`
    só apaga no seu PRÓPRIO caminho de sucesso) ficaria para trás; este teste prova que qualquer
    exceção nesta faixa, mesmo fora do `struct.error` que o pysus já trata sozinho, ainda é
    coberta pelo cleanup de `download_one`."""
    monkeypatch.setattr(
        download,
        "_count_parquet_rows",
        lambda parquet_dir: (_ for _ in ()).throw(
            RuntimeError("simulated: parquet malformado, count_rows falhou")
        ),
    )
    # dbc_to_dbf/dbf_to_parquet identidade -- o conteúdo do .dbc não precisa ser um DBC válido
    # aqui: este teste é sobre a faixa de cleanup depois da conversão "terminar", não sobre
    # parsing de DBC de verdade (isso já está coberto pelos testes de cabeçalho inválido acima).
    import pysus.data as pysus_data_mod

    monkeypatch.setattr(pysus_data_mod, "dbc_to_dbf", lambda path: path)
    monkeypatch.setattr(pysus_data_mod, "dbf_to_parquet", lambda path: path)

    fake_singleton = _FakeFTPSingletonBytesFixos(b"conteudo-suficiente-para-nao-ser-vazio")
    ledger = FileLedger()
    file = _fake_file("RDAC1301")

    with pytest.raises(RuntimeError, match="simulated"):
        download_one(file, ledger, ftp_factory=fake_singleton)

    dbc_path = cache_dir / "parquet" / f"{file.basename}"
    assert not dbc_path.exists()  # cleanup cobre além do que dbc_to_dbf/dbf_to_parquet tratam
    assert ledger.status(file.name) == "nunca_tentado"


def test_download_all_isola_arquivo_vazio_sem_derrubar_a_corrida(cache_dir, monkeypatch):
    """PIPE-06 continua valendo para a NOVA classe de falha: um arquivo que volta vazio
    repetidamente não pode derrubar a corrida nem impedir que o outro arquivo pendente seja
    baixado -- mesma garantia que `test_download_all_isola_arquivo_travado_sem_derrubar_a_corrida`
    já provava para stall, agora para download vazio."""
    monkeypatch.setattr(
        enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1301", "RDMA2110"})
    )
    monkeypatch.setattr(
        enumerate_mod, "fetch_actual_file_names", lambda: frozenset({"RDAC1301", "RDMA2110"})
    )
    monkeypatch.setattr(enumerate_mod, "assert_no_missing", lambda expected, actual: None)
    monkeypatch.setattr(
        download,
        "_fetch_actual_files",
        lambda: {"RDAC1301": _fake_file("RDAC1301"), "RDMA2110": _fake_file("RDMA2110")},
    )
    monkeypatch.setattr(download, "REQUEST_DELAY_SEC", 0)

    def fake_download_one(file, ledger, *, ftp_factory=None):
        if file.name == "RDAC1301":
            raise DownloadStalledError(
                f"{file.name}: voltou vazio (0 bytes) repetidamente, apesar do FTP reportar "
                f"sucesso em {download.MAX_STALL_RETRIES} tentativa(s) -- desistindo, isolado "
                "por arquivo (PIPE-06)"
            )
        ledger.mark_collected(file.name, row_count=100, sha256="b" * 64, parquet_dir="/x")

    monkeypatch.setattr(download, "download_one", fake_download_one)

    resultado = download_all()

    assert resultado.status("RDAC1301") == STATUS_FALHOU
    assert "vazio" in resultado.entry("RDAC1301")["reason"]
    assert resultado.status("RDMA2110") == STATUS_BAIXADO

    summary = resultado.summary()
    assert summary["falhou"] == 1
    assert summary["baixado"] == 1


# ---------------------------------------------------------------------------
# Prova 5 -- download REAL contra o FTP público do DataSUS (2026-08-12, FIX-DOWNLOAD-VAZIO).
#
# ÚNICO teste desta suíte que toca rede de verdade. Existe porque a lacuna que deixou a
# corrupção de 1/3 dos downloads passar em GUARDA-TRAVAMENTO era exatamente esta: os 8 testes
# daquele commit provavam a bookkeeping do retry, mas nenhum provava que um download real ainda
# funcionava -- suíte 100% verde, produção quebrada. Pulado por padrão (não falhado) para
# `npm run gate` continuar 100% offline, como o resto desta suíte -- rodar manualmente:
#   SIH_PIPELINE_TEST_REDE_REAL=1 uv run pytest tests/test_download.py -k arquivo_real -v
# ---------------------------------------------------------------------------

_REDE_REAL_ENV = "SIH_PIPELINE_TEST_REDE_REAL"


def _rede_real_solicitada_e_disponivel() -> bool:
    """Só roda o teste de download real se o operador pedir explicitamente (evita rede em
    `npm run gate`/CI) E o FTP do DataSUS realmente responder na porta 21 dentro de um timeout
    curto (evita travar a suíte se a rede estiver fora)."""
    if os.environ.get(_REDE_REAL_ENV) != "1":
        return False
    try:
        with socket.create_connection(("ftp.datasus.gov.br", 21), timeout=5):
            return True
    except OSError:
        return False


requires_rede_real = pytest.mark.skipif(
    not _rede_real_solicitada_e_disponivel(),
    reason=f"Teste de download REAL pulado -- defina {_REDE_REAL_ENV}=1 para rodar contra "
    "ftp.datasus.gov.br de verdade (FIX-DOWNLOAD-VAZIO); sem isso, `npm run gate` continua "
    "100% offline.",
)


@requires_rede_real
def test_download_one_arquivo_real_pequeno_do_datasus_de_ponta_a_ponta(cache_dir):
    """Baixa UM arquivo pequeno e real (RDRR1301.dbc, Roraima -- o menor estado, ~150KB) do FTP
    público do DataSUS pelo caminho de produção COMPLETO (`download_one`, `ftp_factory=None` ->
    `FTPSingleton` real do `pysus`, sem fakes/mocks) e afirma tamanho plausível + cabeçalho DBC
    parseável -- não só "sem exceção". É exatamente a prova que faltava em GUARDA-TRAVAMENTO."""
    from datetime import datetime
    from pathlib import Path

    from pysus.ftp import File

    file = File(
        path=enumerate_mod._FTP_SIH_DIR,
        name="RDRR1301.dbc",
        info={"size": "0", "type": "file", "modify": datetime.now()},
    )
    ledger = FileLedger()

    download_one(file, ledger)

    assert ledger.status(file.name) == STATUS_BAIXADO
    entry = ledger.entry(file.name)
    assert entry["row_count"] > 0  # não só "baixou" -- o parquet convertido tem linhas de verdade
    assert len(entry["sha256"]) == 64  # sha256 hex válido sobre um .dbc não-vazio

    parquet_dir = Path(entry["parquet_dir"])
    assert parquet_dir.exists()
    assert any(parquet_dir.iterdir())  # dataset parquet não-vazio, não só o diretório criado
