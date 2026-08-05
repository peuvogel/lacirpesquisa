"""Prova que reexecutar a coleta após uma interrupção não duplica linhas no ledger local, e que
o ledger nunca rebaixa um arquivo já baixado — PIPE-03/SC-3, PIPE-05, D-12.

Toda escrita usa `cache_dir` (fixture de `conftest.py`, aponta `SIH_PIPELINE_CACHE_DIR` para
`tmp_path`) — nenhum teste toca o cache real do operador.
"""

from __future__ import annotations

from sih_pipeline.ledger import (
    STATUS_BAIXADO,
    STATUS_FALHOU,
    STATUS_NUNCA_TENTADO,
    FileLedger,
)
from sih_pipeline.paths import ledger_path


def test_ledger_inexistente_devolve_vazio_e_status_nunca_tentado(cache_dir):
    ledger = FileLedger.load()

    assert ledger.status("RDAC1901") == STATUS_NUNCA_TENTADO


def test_mark_collected_persiste_apos_save_e_load(cache_dir):
    ledger = FileLedger.load()
    ledger.mark_collected(
        "RDAC1901", row_count=3284, sha256="a" * 64, parquet_dir="parquet/RDAC1901"
    )
    ledger.save()

    reloaded = FileLedger.load()
    assert reloaded.status("RDAC1901") == STATUS_BAIXADO
    entry = reloaded.entry("RDAC1901")
    assert entry["row_count"] == 3284
    assert entry["sha256"] == "a" * 64
    assert entry["parquet_dir"] == "parquet/RDAC1901"
    assert "updated_at" in entry


def test_mark_failed_grava_reason_e_status_falhou(cache_dir):
    ledger = FileLedger.load()
    ledger.mark_failed("RDAC1902", reason="timeout de conexão FTP")

    assert ledger.status("RDAC1902") == STATUS_FALHOU
    assert ledger.entry("RDAC1902")["reason"] == "timeout de conexão FTP"


def test_mark_collected_promove_falhou_para_baixado_e_remove_reason(cache_dir):
    ledger = FileLedger.load()
    ledger.mark_failed("RDAC1903", reason="erro transitório")
    ledger.mark_collected(
        "RDAC1903", row_count=100, sha256="b" * 64, parquet_dir="parquet/RDAC1903"
    )

    assert ledger.status("RDAC1903") == STATUS_BAIXADO
    assert "reason" not in ledger.entry("RDAC1903")


def test_mark_failed_nao_rebaixa_arquivo_ja_baixado(cache_dir):
    """PIPE-03: retomar não pode desfazer o que já está completo."""
    ledger = FileLedger.load()
    ledger.mark_collected(
        "RDAC1904", row_count=50, sha256="c" * 64, parquet_dir="parquet/RDAC1904"
    )
    ledger.mark_failed("RDAC1904", reason="erro transitório numa reexecução")

    assert ledger.status("RDAC1904") == STATUS_BAIXADO


def test_resume_no_duplicate(cache_dir):
    """Nome exigido pelo 09-VALIDATION.md §SC-3 — não renomear.

    Prova as duas metades: pending() sem duplicata (mesmo após dois mark_failed na mesma
    chave) e status baixado que não regride numa "retomada" simulada.
    """
    expected = frozenset({"RDAC1901", "RDAC1902", "RDAC1903"})

    ledger = FileLedger.load()
    ledger.mark_collected(
        "RDAC1901", row_count=10, sha256="d" * 64, parquet_dir="parquet/RDAC1901"
    )
    ledger.mark_failed("RDAC1902", reason="primeira tentativa")
    ledger.mark_failed("RDAC1902", reason="segunda tentativa (mesma chave)")

    pending = ledger.pending(expected)
    assert pending.count("RDAC1902") == 1
    assert sorted(pending) == pending  # ordem determinística
    assert "RDAC1901" not in pending
    assert "RDAC1903" in pending

    # "Retomada": mark_failed de novo sobre o que já está baixado não pode rebaixar.
    ledger.mark_failed("RDAC1901", reason="reexecução encontrou erro transitório")
    assert ledger.status("RDAC1901") == STATUS_BAIXADO
    assert "RDAC1901" not in ledger.pending(expected)


def test_summary_soma_row_count_so_dos_baixados(cache_dir):
    ledger = FileLedger.load()
    ledger.mark_collected(
        "RDAC1901", row_count=100, sha256="e" * 64, parquet_dir="parquet/RDAC1901"
    )
    ledger.mark_collected(
        "RDAC1902", row_count=200, sha256="f" * 64, parquet_dir="parquet/RDAC1902"
    )
    ledger.mark_failed("RDAC1903", reason="erro")

    summary = ledger.summary()
    assert summary["baixado"] == 2
    assert summary["falhou"] == 1
    assert summary["nunca_tentado"] == 0
    assert summary["total_registros"] == 300


def test_save_atomico_nao_deixa_tmp_sobrevivente(cache_dir):
    ledger = FileLedger.load()
    ledger.mark_collected(
        "RDAC1901", row_count=1, sha256="0" * 64, parquet_dir="parquet/RDAC1901"
    )
    ledger.save()

    tmp_path = ledger_path().with_suffix(".json.tmp")
    assert not tmp_path.exists()
    assert ledger_path().exists()
