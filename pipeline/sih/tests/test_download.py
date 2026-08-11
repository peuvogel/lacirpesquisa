"""Prova a guarda de trava do download FTP (GUARDA-TRAVAMENTO, 2026-08-11, hardening de
PIPE-06) -- e que o isolamento por arquivo já existente (`download_all`) continua intacto.

Incidente real: `RDPR1805.dbc` ficou 9h sem NENHUM byte novo, socket TCP ainda `ESTABLISHED`,
sem exceção, sem log. Nenhum teste aqui toca rede nem `sleep` de verdade -- a trava é simulada
injetando uma `tentativa`/`ftp_factory` falsa que levanta `TimeoutError` (o mesmo tipo que um
`socket.settimeout` real levantaria num `recv()` sem dado novo), nunca por dormir minutos.
"""

from __future__ import annotations

import types

import pytest

from sih_pipeline import download
from sih_pipeline import enumerate as enumerate_mod
from sih_pipeline.download import (
    DownloadStalledError,
    _com_guarda_de_trava,
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
