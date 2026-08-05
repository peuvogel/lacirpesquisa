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
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import time
from pathlib import Path
from typing import Any

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


def download_one(file: Any, ledger: FileLedger) -> None:
    """Baixa um arquivo, converte via `pysus` e grava a prova (hash + contagem) no ledger.

    Nunca chamado em lote — cada chamada é isolada pelo `try/except` do laço em `download_all`
    (Pitfall 9: o método em lote do `pysus` não tem `try/except` por item).
    """
    from pysus.data import dbc_to_dbf, dbf_to_parquet
    from pysus.ftp import FTPSingleton

    dbc_path = cache_path(f"parquet/{file.basename}")

    ftp = FTPSingleton.get_instance()
    try:
        with open(dbc_path, "wb") as output:

            def callback(chunk: bytes) -> None:
                output.write(chunk)

            ftp.retrbinary(f"RETR {file.path}", callback)
    except Exception:
        if dbc_path.exists():
            dbc_path.unlink()
        raise
    finally:
        FTPSingleton.close()

    # sha256 sobre os bytes do .dbc, ANTES da conversão — defesa detectável contra
    # adulteração em trânsito no FTP sem TLS (T-09-01, residual aceito e documentado no README).
    sha256 = _sha256_of_file(dbc_path)

    # dbc_to_dbf() devolve um caminho .parquet (não .dbf) quando o parquet de uma tentativa
    # anterior já existe — mesmo guard de suffix que ParquetSet.__init__ faz internamente
    # (pysus/data/local.py), reproduzido aqui porque download_one não passa pelo ParquetSet.
    converted_path = Path(dbc_to_dbf(str(dbc_path)))
    if converted_path.suffix.lower() == ".dbf":
        parquet_dir = dbf_to_parquet(str(converted_path))
    else:
        parquet_dir = str(converted_path)

    row_count = _count_parquet_rows(parquet_dir)

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
