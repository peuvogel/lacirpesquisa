"""Prova que a ausência de um arquivo esperado no FTP é falha ruidosa (saída não-zero),
nunca "OK · 0 linhas" — PIPE-01/SC-1.

Nenhum teste aqui toca rede: a chamada real ao FTP (`fetch_actual_file_names()`) não é testada
automaticamente (dependeria de rede) — só `expected_file_names()`, `diff_expected_actual()` e
`assert_no_missing()`, que são cálculo puro.
"""

from __future__ import annotations

import sih_pipeline.enumerate as enumerate_mod
from sih_pipeline.enumerate import (
    assert_no_missing,
    diff_expected_actual,
    expected_file_names,
)


def test_expected_file_names_tem_4212_nomes_no_formato_certo():
    expected = expected_file_names()

    assert len(expected) == 4212
    assert all(__import__("re").fullmatch(r"RD[A-Z]{2}\d{4}", name) for name in expected)


def test_expected_file_names_contem_bordas_da_janela_d11():
    expected = expected_file_names()

    assert "RDAC1301" in expected
    assert "RDSP2512" in expected
    # Nenhum mês/ano fora da janela 2013-2025 (D-11) — nem 2012, nem 2026.
    assert not any(name[4:6] in ("12", "26") for name in expected)


def test_diff_expected_actual_ignora_extras_em_actual():
    expected = frozenset({"RDAC1301", "RDAC1302"})
    actual = frozenset({"RDAC1301", "RDAC1302", "RDZZ9999"})

    assert diff_expected_actual(expected, actual) == frozenset()


def test_missing_file_raises():
    """Nome exigido pelo 09-VALIDATION.md §SC-1 — não renomear."""
    # Conjunto pequeno e artificial (3 UFs x 2 meses), como o 09-VALIDATION.md especifica.
    expected = frozenset(
        f"RD{uf}19{mes:02d}" for uf in ("AC", "SP", "MG") for mes in (1, 2)
    )
    actual = set(expected)
    removido = actual.pop()  # remove um item de propósito

    try:
        assert_no_missing(expected, frozenset(actual))
    except SystemExit as exc:
        mensagem = str(exc)
        assert "1" in mensagem
        assert removido in mensagem
    else:
        raise AssertionError("assert_no_missing deveria levantar SystemExit")


def test_assert_no_missing_sem_ausencia_nao_levanta_nem_imprime_ok(capsys):
    expected = frozenset({"RDAC1901", "RDAC1902"})

    resultado = assert_no_missing(expected, expected)

    saida = capsys.readouterr()
    assert resultado is None
    assert "OK" not in saida.out


def test_import_do_modulo_e_livre_de_rede():
    """Importar sih_pipeline.enumerate nunca abre conexão FTP — SIH/Directory não são atributos
    de módulo (só existem dentro do corpo de fetch_actual_file_names)."""
    assert not hasattr(enumerate_mod, "SIH")
    assert not hasattr(enumerate_mod, "Directory")
