"""Guarda de caminho ASVS V12 do pipeline SIH — equivalente Python de scripts/catalog/paths.mjs::corpusPath.

Nenhuma escrita de arquivo do pipeline (cache de parquet, ledger local, temporários de
download) pode resolver caminho fora do diretório de cache configurado, mesmo quando o nome
do arquivo vem de uma listagem remota não confiável (FTP do DataSUS) — T-09-08.
"""

from __future__ import annotations

import os
from pathlib import Path

ALLOWED_PREFIXES = ("parquet", "dbc", "ledger", "agregados", "populacao", "particoes")


def cache_root() -> Path:
    """Raiz do cache local do pipeline.

    Lê `SIH_PIPELINE_CACHE_DIR`; default `~/.lacir/sih-cache` quando ausente. Cria o
    diretório se não existir e devolve o caminho resolvido.
    """
    raw = os.environ.get("SIH_PIPELINE_CACHE_DIR")
    root = Path(raw) if raw else Path.home() / ".lacir" / "sih-cache"
    root = root.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def cache_path(relative: str) -> Path:
    """Resolve `relative` dentro de `cache_root()`, rejeitando qualquer tentativa de escapar.

    Ordem de validação: tipo `str` não-vazio; não absoluto; sem `..` após `normpath` (inclusive
    no meio do caminho); primeiro segmento precisa estar em `ALLOWED_PREFIXES`; e por fim o
    `resolve()` do caminho montado precisa continuar dentro de `cache_root()` (defesa contra
    symlink). Toda rejeição levanta `ValueError` dizendo qual regra falhou e qual foi a entrada.
    """
    if not isinstance(relative, str) or relative == "":
        raise ValueError(f"cache_path: caminho vazio ou não-string rejeitado: {relative!r}")

    if os.path.isabs(relative):
        raise ValueError(f"cache_path: caminho absoluto rejeitado: {relative!r}")

    normalized = os.path.normpath(relative)
    if normalized.startswith("..") or normalized.startswith(os.sep):
        raise ValueError(f"cache_path: traversal (..) rejeitado: {relative!r}")

    first_segment = normalized.split(os.sep, 1)[0]
    if first_segment not in ALLOWED_PREFIXES:
        raise ValueError(
            "cache_path: prefixo fora do allowlist "
            f"({', '.join(ALLOWED_PREFIXES)}): {relative!r}"
        )

    root = cache_root()
    joined = root / normalized
    joined.parent.mkdir(parents=True, exist_ok=True)

    resolved = joined.resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError(f"cache_path: caminho resolvido fora de cache_root(): {relative!r}")

    return joined


def ledger_path() -> Path:
    """Caminho do ledger local de arquivos coletados — `cache_path("ledger/files.json")`."""
    return cache_path("ledger/files.json")


def _reports_root() -> Path:
    """Diretório de relatórios do pipeline (`pipeline/sih/reports/`).

    Versionado no git só para os `.md` que ele contém (ver `.gitignore` da raiz) — nunca dentro
    de `cache_root()`.
    """
    root = Path(__file__).resolve().parents[2] / "reports"
    root.mkdir(parents=True, exist_ok=True)
    return root


def reports_path(relative: str) -> Path:
    """Resolve `relative` dentro de `pipeline/sih/reports/`, nunca dentro de `cache_root()`."""
    if not isinstance(relative, str) or relative == "":
        raise ValueError(f"reports_path: caminho vazio ou não-string rejeitado: {relative!r}")

    if os.path.isabs(relative):
        raise ValueError(f"reports_path: caminho absoluto rejeitado: {relative!r}")

    normalized = os.path.normpath(relative)
    if normalized.startswith("..") or normalized.startswith(os.sep):
        raise ValueError(f"reports_path: traversal (..) rejeitado: {relative!r}")

    root = _reports_root()
    joined = root / normalized
    joined.parent.mkdir(parents=True, exist_ok=True)

    resolved = joined.resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError(f"reports_path: caminho resolvido fora de reports/: {relative!r}")

    return joined


def repo_root() -> Path:
    """Raiz do repositório (onde está `package.json`), para ler `scripts/catalog/*.json`."""
    current = Path(__file__).resolve()
    for candidate in current.parents:
        if (candidate / "package.json").is_file():
            return candidate
    raise RuntimeError("repo_root: package.json não encontrado subindo a partir de paths.py")
