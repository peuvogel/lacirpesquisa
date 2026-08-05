"""Testes do guard de caminho ASVS V12 (paths.py) — os 9 comportamentos do 09-02-PLAN.md.

Equivalente Python de scripts/catalog/paths.mjs::corpusPath — nenhuma escrita do pipeline
pode resolver caminho fora do diretório de cache configurado (T-09-08).
"""

import pytest

from sih_pipeline.paths import cache_path, cache_root, ledger_path, reports_path


def test_cache_path_dentro_do_allowlist_cria_diretorio_pai(cache_dir):
    root = cache_root()
    resolved = cache_path("parquet/RDAC1901")

    assert root in resolved.resolve().parents
    assert resolved.parent.is_dir()


def test_cache_path_rejeita_absoluto(cache_dir):
    with pytest.raises(ValueError):
        cache_path("/etc/passwd")


def test_cache_path_rejeita_traversal_no_inicio(cache_dir):
    with pytest.raises(ValueError):
        cache_path("../../fora")


def test_cache_path_rejeita_string_vazia(cache_dir):
    with pytest.raises(ValueError):
        cache_path("")


def test_cache_path_rejeita_traversal_no_meio(cache_dir):
    with pytest.raises(ValueError):
        cache_path("parquet/../../fora")


def test_cache_path_rejeita_prefixo_fora_do_allowlist(cache_dir):
    with pytest.raises(ValueError):
        cache_path("bagunca/x")


def test_cache_root_respeita_env_var(tmp_path, monkeypatch):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))

    root = cache_root()

    assert root == tmp_path.resolve()


def test_ledger_path_dentro_de_cache_root(cache_dir):
    root = cache_root()
    path = ledger_path()

    assert path.parts[-2:] == ("ledger", "files.json")
    assert root in path.resolve().parents


def test_reports_path_fora_de_cache_root(cache_dir):
    root = cache_root()
    path = reports_path("x.json")

    assert path.name == "x.json"
    assert "reports" in path.parts
    assert root not in path.resolve().parents
