"""Prova que a ausência de um arquivo esperado no FTP é falha ruidosa (saída não-zero),
nunca "OK · 0 linhas" — PIPE-01/SC-1.

Nenhum teste aqui toca rede: a chamada real ao FTP (`fetch_actual_file_names()`) não é testada
automaticamente (dependeria de rede) — só `expected_file_names()`, `diff_expected_actual()` e
`assert_no_missing()`, que são cálculo puro.
"""

from __future__ import annotations

import sih_pipeline.enumerate as enumerate_mod
from sih_pipeline.enumerate import (
    ULTIMO_MES_COMPETENCIA_CAUDA,
    assert_no_missing,
    cauda_file_names,
    diff_expected_actual,
    expected_file_names,
    expected_file_names_obrigatorios,
)


def test_expected_file_names_obrigatorios_tem_4212_nomes_no_formato_certo():
    # A garantia SC-1/PIPE-01 é sobre ESTE conjunto -- 27 UFs x 13 anos x 12 meses de
    # competência 2013-2025 -- e ela NÃO mudou com a passagem para DT_INTER (09-15-DT-INTER).
    obrigatorios = expected_file_names_obrigatorios()

    assert len(obrigatorios) == 4212
    assert all(__import__("re").fullmatch(r"RD[A-Z]{2}\d{4}", name) for name in obrigatorios)


def test_expected_file_names_obrigatorios_contem_bordas_da_competencia_2013_2025():
    obrigatorios = expected_file_names_obrigatorios()

    assert "RDAC1301" in obrigatorios
    assert "RDSP2512" in obrigatorios
    # Nenhum mês/ano fora da competência obrigatória 2013-2025 — nem 2012, nem 2026.
    assert not any(name[4:6] in ("12", "26") for name in obrigatorios)


def test_cauda_cobre_so_2026_ate_o_mes_medido_nas_27_ufs():
    # A cauda existe para FECHAR o ano de admissão 2025 por DT_INTER: uma internação de
    # dezembro/2025 pode ter a AIH faturada em janeiro/2026, e o arquivo de competência 2026-01 é
    # o único lugar onde esse registro existe. O último mês (05) é medido, não suposto -- ver
    # docstring de enumerate.py (decaimento em AC e SP + 2026-06 só existe para 25/27 UFs).
    cauda = cauda_file_names()

    assert len(cauda) == 27 * ULTIMO_MES_COMPETENCIA_CAUDA
    assert all(name[4:6] == "26" for name in cauda)
    assert {name[6:8] for name in cauda} == {"01", "02", "03", "04", "05"}
    assert "RDSP2601" in cauda
    # 2026-06 fica DE FORA de propósito: existe para 25 das 27 UFs (medido ao vivo 2026-08-17) e
    # contribui 0,007% do ano de admissão 2025 na maior UF do país (17 de 245.252 registros).
    assert "RDSP2606" not in cauda


def test_expected_file_names_e_a_uniao_obrigatorio_mais_cauda():
    # É este conjunto que download_all usa para decidir o pendente -- se a cauda não estivesse
    # aqui, os arquivos de 2026 nunca seriam baixados e o ano de admissão 2025 ficaria truncado
    # justamente no mês de maior massa (janeiro concentra 58,70% da defasagem medida em AC).
    expected = expected_file_names()

    assert expected == expected_file_names_obrigatorios() | cauda_file_names()
    assert len(expected) == 4212 + 135


def test_years_cobre_a_listagem_dos_dois_conjuntos():
    # download._fetch_actual_files pede a listagem do FTP com enumerate_mod.YEARS -- se 2026 não
    # estivesse aí, os arquivos de cauda simplesmente não apareceriam na listagem e virariam
    # "falhou" por arquivo inexistente. Listar um ano não é prometer que ele existe.
    assert 2013 in enumerate_mod.YEARS
    assert 2025 in enumerate_mod.YEARS
    assert 2026 in enumerate_mod.YEARS
    assert 2027 not in enumerate_mod.YEARS


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


def test_ausencia_na_cauda_avisa_ruidoso_mas_nao_derruba(capsys):
    # A competência 2026 é publicada mês a mês pelo DATASUS -- "ainda não existe" é o estado
    # normal desses arquivos, não um defeito da fonte. Mas a consequência é real (o ano de
    # admissão 2025 fecha com menos competência do que o desenho previa), então nunca é
    # silencioso: aviso ruidoso em stderr, sem SystemExit.
    cauda = sorted(cauda_file_names())
    expected = frozenset({"RDAC1301", *cauda[:3]})
    actual = frozenset({"RDAC1301"})

    resultado = assert_no_missing(expected, actual)

    saida = capsys.readouterr()
    assert resultado is None
    assert "AVISO" in saida.err
    assert cauda[0] in saida.err


def test_ausencia_obrigatoria_continua_derrubando_mesmo_junto_de_ausencia_de_cauda(capsys):
    # A tolerância é por NOME (o conjunto de cauda), jamais uma banda global -- um obrigatório
    # ausente continua sendo SystemExit mesmo quando há ausência de cauda na mesma corrida.
    cauda = sorted(cauda_file_names())
    expected = frozenset({"RDAC1301", "RDSP2512", *cauda[:2]})
    actual = frozenset({"RDAC1301"})

    try:
        assert_no_missing(expected, actual)
    except SystemExit as exc:
        mensagem = str(exc)
        assert "RDSP2512" in mensagem
        # a mensagem de falha nunca mistura a cauda na contagem de obrigatórios ausentes
        assert "1 arquivo(s)" in mensagem
        assert cauda[0] not in mensagem
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
