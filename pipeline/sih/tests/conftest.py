"""Fixtures compartilhadas da suíte pytest do pipeline SIH.

Nenhuma fixture aqui toca rede — a suíte inteira roda offline dentro de `npm run gate`.
"""

import pytest


@pytest.fixture
def cache_dir(tmp_path, monkeypatch):
    """Aponta `SIH_PIPELINE_CACHE_DIR` para `tmp_path` e devolve o `Path`.

    É a fixture que todo teste do pipeline usa para nunca escrever no cache real do operador
    durante a suíte — cada teste recebe um diretório isolado e descartável.
    """
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    return tmp_path
