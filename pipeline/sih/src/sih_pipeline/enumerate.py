"""Enumeração determinística dos arquivos SIH-RD esperados — ausência é falha ruidosa (SC-1/PIPE-01).

A lista dos 4.212 arquivos `RD{UF}{AA}{MM}` (27 UFs × 12 meses × 13 anos, janela D-11
2013-2025) é computada por regra determinística, sem tocar rede. Só `fetch_actual_file_names()`
toca o FTP real do DataSUS — e faz isso importando `pysus` dentro do próprio corpo da função,
nunca no topo do módulo, para que `import sih_pipeline.enumerate` continue livre de efeito
colateral de rede (09-RESEARCH.md §Anti-Patterns: os módulos de conveniência do `pysus`
disparam listagem FTP como efeito colateral do import).
"""

from __future__ import annotations

import sys

# 27 siglas, na ordem do 09-RESEARCH.md §"Architecture Patterns" Pattern 1.
UFS: tuple[str, ...] = (
    "RO", "AC", "AM", "RR", "PA", "AP", "TO", "MA", "PI", "CE", "RN", "PB", "PE", "AL",
    "SE", "BA", "MG", "ES", "RJ", "SP", "PR", "SC", "RS", "MS", "MT", "GO", "DF",
)

# Janela D-11 (2013-2025): 13 anos, filtro EXPLÍCITO do pipeline — nunca uma suposição sobre
# o que o FTP publica (o FTP já tinha arquivos de 2026 no momento do 09-RESEARCH.md, Pitfall 10).
YEARS = range(2013, 2026)

_FTP_SIH_DIR = "/dissemin/publicos/SIHSUS/200801_/Dados"


def expected_file_names() -> frozenset[str]:
    """Lista determinística dos 4.212 arquivos `RD{UF}{AA}{MM}` esperados (27 × 13 × 12, D-11)."""
    return frozenset(
        f"RD{uf}{year % 100:02d}{month:02d}"
        for uf in UFS
        for year in YEARS
        for month in range(1, 13)
    )


def diff_expected_actual(
    expected: frozenset[str], actual: frozenset[str]
) -> frozenset[str]:
    """Diferença de conjuntos `expected - actual` — ignora qualquer extra presente em `actual`."""
    return frozenset(expected) - frozenset(actual)


def assert_no_missing(expected: frozenset[str], actual: frozenset[str]) -> None:
    """Levanta `SystemExit` se algum nome de `expected` estiver ausente em `actual` (PIPE-01/SC-1).

    Nunca devolve um código de sucesso silencioso nem imprime "OK" quando não há ausência —
    a ausência de exceção já é o sinal, não uma mensagem.
    """
    missing = diff_expected_actual(expected, actual)
    if missing:
        amostra = sorted(missing)[:10]
        raise SystemExit(
            f"FALHA: {len(missing)} arquivo(s) SIH-RD ausentes no FTP: {amostra}"
        )


def fetch_actual_file_names() -> frozenset[str]:
    """Única função deste módulo que toca rede — lista o FTP real do DataSUS.

    Import de `pysus` feito dentro do corpo (nunca no topo do módulo) para que
    `import sih_pipeline.enumerate` continue livre de efeito colateral de rede.
    """
    from pysus.ftp import Directory
    from pysus.ftp.databases.sih import SIH

    s = SIH()
    s.load(directories=[Directory(_FTP_SIH_DIR)])
    files = s.get_files("RD", uf=list(UFS), year=list(YEARS))
    return frozenset(f.name for f in files)


def main(argv: list[str]) -> int:
    """Contrato do despachante `cli.py`: roda a listagem real e devolve o código de saída.

    Nunca devolve 0 se houver ausência — `assert_no_missing` é quem decide isso.
    """
    del argv  # subcomando `enumerate` não tem flags próprias

    expected = expected_file_names()
    actual = fetch_actual_file_names()
    missing = diff_expected_actual(expected, actual)

    print(f"esperados: {len(expected)}")
    print(f"encontrados: {len(actual)}")
    print(f"ausentes: {len(missing)}")

    try:
        assert_no_missing(expected, actual)
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
