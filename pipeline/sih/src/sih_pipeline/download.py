"""Laço de download com isolamento de falha por arquivo (PIPE-06) e a corrida completa (D-01).

`download_all()` roda a enumeração (SC-1) ANTES do primeiro byte — é o caminho de produção do
SC-1, não só o teste (`enumerate.assert_no_missing`). Cada arquivo passa por `download_one`
dentro de um `try/except Exception` que grava `ledger.mark_failed(...)` e segue em frente: uma
exceção em UM arquivo nunca aborta o resto da corrida. O método de conveniência em lote da
classe `Database` (que recebe `files=[...]` e baixa tudo de uma chamada só) nunca é chamado —
RESEARCH Pitfall 9 mede que ele não isola falha por item.

Nota sobre `File.download()`: a API de alto nível do `pysus` converte DBC->DBF->parquet e
apaga o `.dbc` intermediário DENTRO da mesma chamada (lido do código-fonte instalado,
`pysus/data/__init__.py::dbc_to_dbf`/`dbf_to_parquet` — cada um faz `path.unlink()` ao final).
Isso não deixa janela para hashear os bytes brutos do `.dbc` ANTES da conversão, que é
exatamente o que T-09-01 exige. Por isso `download_one` replica a retirada FTP (mesmo
`FTPSingleton`/`ftp.retrbinary` que `File.download()` usa por baixo) só para abrir essa janela
de hash — a conversão em si continua inteiramente a cargo das funções do próprio `pysus`
(`dbc_to_dbf`/`dbf_to_parquet`), nunca reimplementada.

**Guarda de trava (2026-08-11, GUARDA-TRAVAMENTO, sem PLAN.md formal — hardening de PIPE-06).**
Incidente real medido em produção: `RDPR1805.dbc` ficou 9h sem NENHUM byte novo, com a conexão
de dados do FTP ainda `ESTABLISHED` — sem exceção, sem timeout, sem log, porque do ponto de
vista do código o download "ainda estava em andamento". `download_one` agora configura o
timeout de socket do `FTPSingleton` (`STALL_TIMEOUT_SEC`) antes de cada tentativa de
`ftp.retrbinary`: cada `recv()` individual da conexão de dados passa a ter um prazo — se nenhum
byte novo chegar dentro dele, `recv()` levanta `TimeoutError`, mesmo com o socket TCP
`ESTABLISHED`. Isso é detecção de FALTA DE PROGRESSO, não de tempo total: cada chunk que chega
reseta a janela, então um arquivo grande e saudável (SP, MG, ...) nunca esbarra nisso, só uma
transferência que realmente parou de entregar bytes. `_com_guarda_de_trava` retenta essa
condição especificamente (nunca outra exceção) até `MAX_STALL_RETRIES` vezes, logando cada
tentativa — os 9h silenciosos do incidente eram tanto o bug quanto a trava em si. Esgotadas as
tentativas, levanta `DownloadStalledError`, que `download_all` trata como qualquer outra exceção
de arquivo (PIPE-06 existente, `except Exception` -> `ledger.mark_failed` -> `continue`) — nenhum
caminho de erro novo é criado.

**Correção de download vazio (2026-08-12, FIX-DOWNLOAD-VAZIO -- regressão da guarda acima).**
Medição em produção: a guarda de trava NUNCA disparou (zero DownloadStalledError/TimeoutError
no log) e mesmo assim 152 de 420 arquivos da re-coleta vieram corrompidos -- .dbc de 0 bytes,
detectados só depois, dentro do parser C do pyreaddbc ("Invalid or corrupt DBC file ... has
implausible header size 0"). Isolado com download real e repetido contra o FTP público do
DataSUS (ver teste test_download_one_arquivo_real_pequeno_do_datasus..., marcado para pular
offline): o mecanismo de RETR com caminho absoluto (file.path, o mesmo que File.download() do
próprio pysus usa) e os dois timeouts de socket da guarda continuam funcionando -- não foi
possível reproduzir um retrbinary "bem-sucedido" (sem exceção) que devolvesse 0 bytes numa rede
saudável. O que a investigação confirmou, sim, é uma lacuna real: download_one nunca validava o
resultado do download (tamanho, cabeçalho) antes de hashear/converter, e o cleanup de .dbc só
cobria a exceção da própria guarda -- um .dbc vazio ou corrompido que só falhava depois, dentro
de dbc_to_dbf, ficava esquecido no cache (nunca apagado), e a causa raiz completa de por que o
FTP às vezes devolve sucesso sem dado nenhum continua sem prova definitiva (documentada como
residual, não como resolvida). A correção, proporcional ao que FOI medido e comprovado: (1)
_uma_tentativa_de_download agora confere o tamanho do .dbc logo após o retrbinary retornar sem
exceção -- 0 bytes vira DownloadVazioError, tratado por _com_guarda_de_trava como a MESMA classe
de falha transitória que um stall (mesmo retry limitado, mesma reconexão do zero -- a causa mais
provável continua sendo uma interferência de rede transitória, e negar retry a ela transformaria
toda flutuação numa falha permanente e desnecessária do arquivo); (2) download_one agora envolve
TODO o caminho até mark_collected (download + hash + conversão, não só a guarda) num único
cleanup -- qualquer exceção nessa faixa apaga o .dbc do cache antes de propagar, garantindo que
uma retomada sempre comece limpa; (3) o contrato do FileLedger não muda: mark_collected continua
sendo a ÚLTIMA linha de download_one, então nenhum caminho de erro (velho ou novo) passa por
ela -- um arquivo vazio ou corrompido nunca vira baixado.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import time
from pathlib import Path
from typing import Any, Callable

import pyarrow.dataset as ds

from sih_pipeline import enumerate as enumerate_mod
from sih_pipeline.ledger import FileLedger
from sih_pipeline.paths import cache_path

# Throttling gentil entre arquivos — no espírito do REQUEST_DELAY_SEC = 1.5 herdado do
# scraper aposentado (PIPE-06 é sobre respeitar a fonte remota tanto quanto sobreviver).
REQUEST_DELAY_SEC = 1.0

# Salva o ledger a cada N arquivos processados (sucesso ou falha) — um kill no meio perde no
# máximo N posições de progresso, nunca a corrida inteira.
_SAVE_EVERY = 10

# Quantos segundos SEM NENHUM byte novo (não o tempo total da transferência) `download_one`
# tolera antes de considerar a conexão travada — aplicado como timeout de socket em cada
# `recv()` da conexão de dados do FTP (ver docstring do módulo, "Guarda de trava").
STALL_TIMEOUT_SEC = 120.0

# Tentativas antes de desistir de um arquivo travado — só para a trava (`TimeoutError`), nunca
# para outro tipo de erro (permissão, arquivo ausente, etc.), que propaga na primeira ocorrência
# e vai direto para o PIPE-06 existente. Essa classe de falha costuma ser transitória (rede
# pública do DATASUS), então vale a pena tentar de novo antes de marcar o arquivo `falhou`.
MAX_STALL_RETRIES = 3


class DownloadStalledError(RuntimeError):
    """Levantado quando `download_one` esgota `MAX_STALL_RETRIES` tentativas sem progresso
    (ou sem conseguir um `.dbc` não-vazio -- ver `DownloadVazioError`).

    Nunca propaga além de `download_one` sem passar pelo `except Exception` já existente em
    `download_all` — é o mesmo caminho de isolamento por arquivo (PIPE-06) que qualquer outra
    falha de download já usa, só com um tipo de exceção que nomeia a causa real no `reason` do
    ledger em vez de um `TimeoutError`/`DownloadVazioError` genérico.
    """


class DownloadVazioError(RuntimeError):
    """Levantado por `_uma_tentativa_de_download` quando `ftp.retrbinary` retorna SEM exceção
    (o FTP respondeu "226 Transfer complete") mas o `.dbc` resultante tem 0 bytes -- a
    corrupção medida em produção (FIX-DOWNLOAD-VAZIO, 2026-08-12): 152 de 420 arquivos da
    re-coleta vieram vazios sem nenhum `TimeoutError`, sem nenhum log da guarda de trava (ela
    nunca disparou), porque o FTP não "travou" no sentido de faltar progresso -- ele só devolveu
    sucesso sem dado nenhum.

    `_com_guarda_de_trava` trata isso como a MESMA classe de falha transitória que um stall
    (mesmo retry limitado, mesma reconexão do zero): a causa mais provável continua sendo uma
    interferência transitória na conexão de dados (rede pública do DataSUS sem SLA), e negar
    retry a ela transformaria toda flutuação de rede numa falha permanente e desnecessária do
    arquivo.
    """


def _fetch_actual_files() -> dict[str, Any]:
    """Objetos `File` do FTP, indexados por nome — só quem baixa precisa do objeto (a checagem
    de ausência de `enumerate.py` trabalha só com nomes).

    Import de `pysus` dentro do corpo, nunca no topo do módulo (mesma disciplina de
    `enumerate.py` — `import sih_pipeline.download` continua livre de efeito colateral de rede).
    """
    from pysus.ftp import Directory
    from pysus.ftp.databases.sih import SIH

    s = SIH()
    s.load(directories=[Directory(enumerate_mod._FTP_SIH_DIR)])
    files = s.get_files("RD", uf=list(enumerate_mod.UFS), year=list(enumerate_mod.YEARS))
    return {f.name: f for f in files}


def _sha256_of_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _count_parquet_rows(parquet_dir: str) -> int:
    """Contagem de linhas via metadados do parquet — nunca carrega as 113 colunas em memória."""
    dataset = ds.dataset(str(parquet_dir), format="parquet")
    return dataset.count_rows()


def _com_guarda_de_trava(
    tentativa: Callable[[], None],
    *,
    file_name: str,
    max_retries: int = MAX_STALL_RETRIES,
    log: Callable[[str], None] = lambda msg: print(msg, file=sys.stderr),
) -> None:
    """Chama `tentativa()` até `max_retries` vezes, tratando duas classes de falha TRANSITÓRIA:
    `TimeoutError` — disparado pelo timeout de socket que `download_one` arma antes de cada
    `retrbinary` quando `recv()` não recebe NENHUM byte novo dentro de `STALL_TIMEOUT_SEC` — e
    `DownloadVazioError` — disparado quando o `retrbinary` retorna sem exceção mas o `.dbc`
    resultante tem 0 bytes (FIX-DOWNLOAD-VAZIO, ver docstring da classe). Ambas são tratadas como
    condição retentável, com a mesma reconexão do zero por tentativa.

    Qualquer OUTRA exceção (permissão, arquivo ausente na listagem, `.dbc` presente mas com
    cabeçalho corrompido/implausível, etc.) propaga na primeira ocorrência sem consumir tentativa
    nenhuma: só falta de progresso ou download vazio são retentados aqui, nunca outra classe de
    erro — retry cego em erro não-transitório só atrasaria o `mark_failed` que o PIPE-06 já faz
    corretamente.

    Loga cada tentativa (arquivo, o que aconteceu, o que fez) — os 9h silenciosos do incidente
    real que originou a guarda de trava eram tanto o bug quanto a trava em si, então esta função
    nunca falha em silêncio. Esgotadas as tentativas, levanta `DownloadStalledError` encadeada
    (`raise ... from`) para o `except Exception` já existente em `download_all` isolar por
    arquivo (PIPE-06) e seguir para o próximo, sem caminho de erro novo.
    """
    ultima_falha: TimeoutError | DownloadVazioError | None = None
    for numero in range(1, max_retries + 1):
        try:
            tentativa()
            return
        except (TimeoutError, DownloadVazioError) as exc:
            ultima_falha = exc
            acao = "tentando de novo" if numero < max_retries else "desistindo"
            if isinstance(exc, TimeoutError):
                # Texto idêntico ao da guarda de trava original -- GUARDA-TRAVAMENTO já cobre
                # este caso com teste próprio, não alterar a string sem atualizar esse teste.
                log(
                    f"download: {file_name} travou -- sem bytes novos por "
                    f"{STALL_TIMEOUT_SEC:.0f}s (tentativa {numero}/{max_retries}), {acao}"
                )
            else:
                log(
                    f"download: {file_name} voltou vazio -- 0 bytes apesar do FTP reportar "
                    f"sucesso (tentativa {numero}/{max_retries}), {acao}"
                )

    if isinstance(ultima_falha, TimeoutError):
        motivo_final = f"travou (sem progresso por {STALL_TIMEOUT_SEC:.0f}s)"
    else:
        motivo_final = "voltou vazio (0 bytes) repetidamente, apesar do FTP reportar sucesso"

    raise DownloadStalledError(
        f"{file_name}: {motivo_final} em {max_retries} tentativa(s) -- desistindo, isolado "
        "por arquivo (PIPE-06)"
    ) from ultima_falha


def _uma_tentativa_de_download(file: Any, dbc_path: Path, *, ftp_factory: Any) -> None:
    """Uma tentativa completa: reconecta do zero, arma o timeout de socket (guarda de trava),
    roda o `RETR` e confere que o resultado não veio vazio (FIX-DOWNLOAD-VAZIO).

    Reconectar a cada tentativa (em vez de reaproveitar a conexão que acabou de travar/expirar)
    evita arriscar um segundo travamento silencioso sobre um estado de controle intermediário —
    o `FTPSingleton` já existe justamente para dar `get_instance()`/`close()` baratos.
    """
    ftp_factory.close()
    ftp = ftp_factory.get_instance()
    # `sock.settimeout` cobre a conexão de CONTROLE já aberta por `get_instance()`; `ftp.timeout`
    # é o que o `ftplib` usa para abrir a conexão de DADOS dentro de `retrbinary` — as duas
    # precisam do mesmo valor, senão só metade do caminho FTP fica protegida.
    if ftp.sock is not None:
        ftp.sock.settimeout(STALL_TIMEOUT_SEC)
    ftp.timeout = STALL_TIMEOUT_SEC

    with open(dbc_path, "wb") as output:

        def callback(chunk: bytes) -> None:
            output.write(chunk)

        ftp.retrbinary(f"RETR {file.path}", callback)

    # FIX-DOWNLOAD-VAZIO: o `retrbinary` acima pode retornar SEM exceção (o FTP respondeu
    # "226 Transfer complete") e mesmo assim não ter escrito nenhum byte -- é exatamente a
    # corrupção medida em produção (152/420 arquivos, ver docstring do módulo). Conferir aqui,
    # ANTES de qualquer hash/conversão, torna essa falha visível e retentável em vez de virar um
    # `.dbc` de 0 bytes que só quebra páginas depois, dentro do parser C do `pyreaddbc`
    # ("implausible header size 0").
    if dbc_path.stat().st_size == 0:
        raise DownloadVazioError(
            f"{file.name}: download voltou vazio (0 bytes) -- FTP reportou sucesso sem "
            "transferir dado nenhum"
        )


def download_one(file: Any, ledger: FileLedger, *, ftp_factory: Any = None) -> None:
    """Baixa um arquivo, converte via `pysus` e grava a prova (hash + contagem) no ledger.

    Nunca chamado em lote — cada chamada é isolada pelo `try/except` do laço em `download_all`
    (Pitfall 9: o método em lote do `pysus` não tem `try/except` por item). A retirada FTP em si
    passa pela guarda de trava (`_com_guarda_de_trava` + `STALL_TIMEOUT_SEC`) antes de qualquer
    conversão — ver docstring do módulo, "Guarda de trava" e "Correção de download vazio".

    `ftp_factory` (default `None`) é o `FTPSingleton` real do `pysus`, importado dentro do corpo
    (nunca no topo do módulo — mesma disciplina livre-de-rede-no-import de `enumerate.py`); os
    testes injetam um fake para provar a guarda sem tocar FTP de verdade.

    FIX-DOWNLOAD-VAZIO: o cleanup do `.dbc` cobre TODO o caminho até `mark_collected` (download +
    hash + conversão), não só a guarda de trava — um `.dbc` vazio ou corrompido que só falha
    dentro de `dbc_to_dbf` (parser C do `pyreaddbc`) também precisa ser apagado, senão fica
    esquecido no cache indefinidamente. `mark_collected` continua sendo a ÚLTIMA linha desta
    função: nenhum caminho de erro (velho ou novo) passa por ela, então um arquivo vazio ou
    corrompido nunca vira `baixado` (contrato do `FileLedger` preservado).
    """
    from pysus.data import dbc_to_dbf, dbf_to_parquet

    if ftp_factory is None:
        from pysus.ftp import FTPSingleton

        ftp_factory = FTPSingleton

    dbc_path = cache_path(f"parquet/{file.basename}")

    try:
        try:
            _com_guarda_de_trava(
                lambda: _uma_tentativa_de_download(file, dbc_path, ftp_factory=ftp_factory),
                file_name=file.name,
            )
        finally:
            ftp_factory.close()

        # sha256 sobre os bytes do .dbc, ANTES da conversão — defesa detectável contra
        # adulteração em trânsito no FTP sem TLS (T-09-01, residual aceito e documentado no
        # README).
        sha256 = _sha256_of_file(dbc_path)

        # dbc_to_dbf() devolve um caminho .parquet (não .dbf) quando o parquet de uma tentativa
        # anterior já existe — mesmo guard de suffix que ParquetSet.__init__ faz internamente
        # (pysus/data/local.py), reproduzido aqui porque download_one não passa pelo ParquetSet.
        #
        # Nuance medida (lido do código-fonte instalado, pysus/data/__init__.py): para um .dbc
        # não-vazio mas com cabeçalho corrompido/truncado, dbc2dbf() (parser C do pyreaddbc) NÃO
        # levanta em Python -- ele imprime "Invalid or corrupt DBC file ... implausible header
        # size" em stderr e retorna um .dbf de 0 bytes, já tendo apagado o .dbc de origem sem
        # condição nenhuma. É só o passo SEGUINTE (dbf_to_parquet -> dbfread.DBF) que levanta de
        # verdade (struct.error) -- e essa função já se autolimpa nesse except específico
        # (apaga o .dbf, remove o diretório .parquet vazio que tinha acabado de criar). O
        # except abaixo é a rede de segurança para os casos que ELA não cobre (qualquer exceção
        # fora de struct.error aqui, ou uma falha em _count_parquet_rows sobre um parquet que
        # "terminou" mas ficou malformado) -- nunca assume que o .dbc ainda existe nesse ponto.
        converted_path = Path(dbc_to_dbf(str(dbc_path)))
        if converted_path.suffix.lower() == ".dbf":
            parquet_dir = dbf_to_parquet(str(converted_path))
        else:
            parquet_dir = str(converted_path)

        row_count = _count_parquet_rows(parquet_dir)
    except Exception:
        # FIX-DOWNLOAD-VAZIO: antes desta correção, só a exceção da guarda de trava limpava o
        # .dbc -- uma falha em sha256/dbc_to_dbf/dbf_to_parquet/_count_parquet_rows deixava
        # QUALQUER intermediário que ainda existisse (o próprio pysus já limpa alguns casos,
        # não todos -- ver comentário acima) para trás no cache, indefinidamente, mesmo já
        # marcado `falhou` no ledger. `dbc_path.exists()` cobre tanto "ainda não foi apagado"
        # quanto "já foi apagado por outra camada" sem levantar `FileNotFoundError` -- corrigido
        # cobrindo TODO o caminho até `mark_collected`, não só a guarda.
        if dbc_path.exists():
            dbc_path.unlink()
        raise

    ledger.mark_collected(
        file.name,
        row_count=row_count,
        sha256=sha256,
        parquet_dir=str(parquet_dir),
    )


def download_all(
    *, limit: int | None = None, only: list[str] | None = None
) -> FileLedger:
    """Percorre os arquivos pendentes do ledger, isolando falha por arquivo (PIPE-06).

    Roda `enumerate.fetch_actual_file_names()` + `enumerate.assert_no_missing(...)` antes do
    primeiro byte (SC-1 no caminho de produção, não só no teste).
    """
    expected = enumerate_mod.expected_file_names()
    actual_names = enumerate_mod.fetch_actual_file_names()
    enumerate_mod.assert_no_missing(expected, actual_names)

    ledger = FileLedger.load()
    pending = ledger.pending(expected)

    if only:
        only_set = set(only)
        pending = [name for name in pending if name in only_set]
    if limit is not None:
        # `limit` é um TETO sobre o total de `baixado` no ledger, não "baixe N a mais a cada
        # chamada" — senão reexecutar com o mesmo --limit sempre avançaria mais N arquivos,
        # quebrando a idempotência que o 09-VALIDATION.md exige (rodar --limit 2 duas vezes
        # tem que continuar com os MESMOS 2 baixado, nunca virar 4).
        ja_baixado = ledger.summary()["baixado"]
        faltam = max(0, limit - ja_baixado)
        pending = pending[:faltam]

    if not pending:
        return ledger

    actual_files = _fetch_actual_files()

    processed = 0
    for name in pending:
        try:
            file = actual_files.get(name)
            if file is None:
                raise RuntimeError(
                    f"arquivo {name} não encontrado na listagem atual do FTP"
                )
            download_one(file, ledger)
        except Exception as exc:  # PIPE-06: isola a falha, nunca deixa propagar
            ledger.mark_failed(name, reason=str(exc))

        processed += 1
        if processed % _SAVE_EVERY == 0:
            ledger.save()

        if REQUEST_DELAY_SEC > 0:
            time.sleep(REQUEST_DELAY_SEC)

    ledger.save()
    return ledger


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="sih_pipeline.download")
    parser.add_argument("--limit", type=int, default=None, help="baixa no máximo N arquivos")
    parser.add_argument(
        "--only", nargs="+", default=None, help="baixa só os nomes RD{UF}{AA}{MM} listados"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="retomar a corrida (comportamento padrão — a retomada é sempre por arquivo, D-12/Pitfall 8)",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="só imprime o summary() do ledger atual, sem baixar nada",
    )
    args = parser.parse_args(argv)

    if args.status:
        print(FileLedger.load().summary())
        return 0

    ledger = download_all(limit=args.limit, only=args.only)
    print(ledger.summary())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
