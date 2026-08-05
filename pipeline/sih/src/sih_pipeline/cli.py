"""Despachante declarativo preguiçoso dos nove subcomandos `pipeline:*` — dono único: 09-04.

Nenhum outro plano da fase edita este arquivo. Registrar um subcomando novo é acrescentar uma
linha a `SUBCOMANDOS`; acender um já registrado é entregar `main(argv: list[str]) -> int` no
módulo dono, sem tocar aqui. O `argparse` mora nos módulos donos, não neste despachante: `main`
só separa o primeiro argumento (nome do subcomando) e repassa o resto intacto.
"""

from __future__ import annotations

import importlib
import sys
from typing import Callable, Optional

# nome do subcomando -> (módulo, plano dono). Mesmo registro fixo declarado no 09-02
# (package.json) — nenhum subcomando é acrescentado ou removido fora deste dict.
SUBCOMANDOS: dict[str, tuple[str, str]] = {
    "enumerate": ("sih_pipeline.enumerate", "09-04"),
    "download": ("sih_pipeline.download", "09-04"),
    "oracle-scrape": ("sih_pipeline.oracle_scrape", "09-05"),
    "aggregate": ("sih_pipeline.aggregate", "09-07"),
    "population": ("sih_pipeline.population", "09-06"),
    "reconcile": ("sih_pipeline.reconcile", "09-08"),
    "partitions": ("sih_pipeline.partitions", "09-09"),
    "upload": ("sih_pipeline.upload", "09-10"),
    "audit": ("sih_pipeline.audit", "09-12"),
}


def resolver(nome: str) -> Optional[Callable[[list[str]], int]]:
    """Resolve o `main(argv) -> int` do módulo dono de `nome`.

    Devolve `None` se `nome` não estiver registrado, se o módulo dono ainda não existir, ou se
    existir mas ainda não expuser `main` — nunca levanta.
    """
    entry = SUBCOMANDOS.get(nome)
    if entry is None:
        return None

    module_name, _plano_dono = entry
    try:
        mod = importlib.import_module(module_name)
    except ModuleNotFoundError:
        return None

    return getattr(mod, "main", None)


def main(argv: list[str]) -> int:
    """Despacha `argv[0]` (nome do subcomando) para o módulo dono, repassando `argv[1:]` intacto.

    Um subcomando cujo `main` não resolve imprime em stderr `subcomando implementado no plano
    09-NN` e devolve 2 — nunca 0, para que nenhum script `pipeline:*` finja sucesso sem
    implementação real.
    """
    if not argv:
        print("uso: sih_pipeline.cli <subcomando> [args...]", file=sys.stderr)
        print(f"subcomandos: {', '.join(sorted(SUBCOMANDOS))}", file=sys.stderr)
        return 2

    nome, resto = argv[0], argv[1:]

    if nome not in SUBCOMANDOS:
        print(f"subcomando desconhecido: {nome!r}", file=sys.stderr)
        print(f"subcomandos: {', '.join(sorted(SUBCOMANDOS))}", file=sys.stderr)
        return 2

    _module_name, plano_dono = SUBCOMANDOS[nome]
    entrypoint = resolver(nome)
    if entrypoint is None:
        print(f"subcomando implementado no plano {plano_dono}", file=sys.stderr)
        return 2

    return entrypoint(resto)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
