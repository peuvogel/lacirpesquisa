"""Prova a medição de paridade site × TabNet (09-16).

Duas comparações, deliberadamente NÃO colapsadas numa só:

1. site × TabNet **bem-formado** (submetendo as competências necessárias para fechar o ano de
   internação) — tem que bater EXATO. É a prova de correção.
2. site × TabNet **ingênuo** (12 arquivos de um ano, o que o aluno faz por padrão) — o site fica
   MAIOR, por uma quantia que precisa ser medida e reportável, nunca hand-waved.

Nenhum teste desta suíte toca rede: `medir` recebe valores já raspados.
"""

from __future__ import annotations

import pytest

from sih_pipeline.paridade import (
    MedicaoParidade,
    distribuicao,
    medir,
    to_justificativa_json,
)


def _medicao(site: int, bem_formado: int, ingenuo: int, disease_id: str = "x") -> MedicaoParidade:
    return MedicaoParidade(
        disease_id=disease_id, uf="AC", ano=2019, site=site, bem_formado=bem_formado, ingenuo=ingenuo
    )


# ---------------------------------------------------------------------------
# Comparação 1 -- paridade bem-formada (a prova de correção)
# ---------------------------------------------------------------------------


def test_paridade_exata_quando_site_bate_com_o_bem_formado():
    m = _medicao(site=294, bem_formado=294, ingenuo=262)

    assert m.delta_bem_formado == 0
    assert m.paridade_exata is True


def test_paridade_falha_quando_site_diverge_do_bem_formado_nem_que_seja_por_um():
    m = _medicao(site=295, bem_formado=294, ingenuo=262)

    assert m.delta_bem_formado == 1
    assert m.paridade_exata is False


# ---------------------------------------------------------------------------
# Comparação 2 -- a lacuna da consulta ingênua (a justificativa)
# ---------------------------------------------------------------------------


def test_lacuna_ingenua_em_absoluto_e_percentual():
    m = _medicao(site=294, bem_formado=294, ingenuo=262)

    assert m.delta_ingenuo == 32
    assert m.pct_ingenuo == pytest.approx(32 / 262 * 100)


def test_lacuna_ingenua_com_denominador_zero_nao_divide_por_zero():
    """Agravo raro em UF pequena: o TabNet ingênuo pode devolver 0 e o site 2. Percentual não
    existe -- reportar `None` é honesto; reportar 0% ou +inf seria mentira nas duas direções."""
    m = _medicao(site=2, bem_formado=2, ingenuo=0)

    assert m.delta_ingenuo == 2
    assert m.pct_ingenuo is None


def test_distribuicao_reporta_quartis_e_nao_so_a_media():
    """O brief pede a DISTRIBUIÇÃO. Uma média sozinha esconde exatamente o que interessa: os
    agravos onde a diferença é grande."""
    medicoes = [
        _medicao(site=110, bem_formado=110, ingenuo=100, disease_id="a"),
        _medicao(site=120, bem_formado=120, ingenuo=100, disease_id="b"),
        _medicao(site=130, bem_formado=130, ingenuo=100, disease_id="c"),
        _medicao(site=200, bem_formado=200, ingenuo=100, disease_id="d"),
    ]

    d = distribuicao(medicoes)

    assert d["n"] == 4
    assert d["mediana_pct"] == pytest.approx(25.0)
    assert d["min_pct"] == pytest.approx(10.0)
    assert d["max_pct"] == pytest.approx(100.0)
    assert d["p25_pct"] == pytest.approx(17.5)
    assert d["p75_pct"] == pytest.approx(47.5)


def test_distribuicao_conta_paridade_exata_separado_da_lacuna():
    medicoes = [
        _medicao(site=110, bem_formado=110, ingenuo=100, disease_id="a"),
        _medicao(site=111, bem_formado=110, ingenuo=100, disease_id="b"),
    ]

    d = distribuicao(medicoes)

    assert d["paridade_exata"] == 1
    assert d["paridade_divergente"] == 1


# ---------------------------------------------------------------------------
# medir() -- casamento site × oráculos
# ---------------------------------------------------------------------------


def test_medir_casa_por_disease_id_e_preserva_uf_ano():
    site = {"infarto_cerebral": 294, "amebiase": 3}
    bem_formado = [
        {"diseaseId": "infarto_cerebral", "valorTabnet": 294},
        {"diseaseId": "amebiase", "valorTabnet": 3},
    ]
    ingenuo = [
        {"diseaseId": "infarto_cerebral", "valorTabnet": 262},
        {"diseaseId": "amebiase", "valorTabnet": 2},
    ]

    medicoes = medir(site, bem_formado, ingenuo, uf="AC", ano=2019)

    assert {m.disease_id for m in medicoes} == {"infarto_cerebral", "amebiase"}
    assert all(m.uf == "AC" and m.ano == 2019 for m in medicoes)


def test_medir_trata_agravo_ausente_do_agregado_como_zero_e_nao_o_silencia():
    """Ausência no agregado é 0 internações -- mas precisa aparecer na medição, porque um agravo
    que o TabNet tem e o site não é justamente o defeito que esta medição existe para pegar."""
    site: dict[str, int] = {}
    bem_formado = [{"diseaseId": "amebiase", "valorTabnet": 3}]
    ingenuo = [{"diseaseId": "amebiase", "valorTabnet": 2}]

    medicoes = medir(site, bem_formado, ingenuo, uf="AC", ano=2019)

    assert len(medicoes) == 1
    assert medicoes[0].site == 0
    assert medicoes[0].paridade_exata is False


def test_medir_recusa_oraculos_com_conjuntos_de_agravos_diferentes():
    """Comparar duas janelas sobre conjuntos diferentes de agravos é a MESMA classe de erro que
    gerou o resíduo fantasma do SC-7 -- duas pontas medindo populações diferentes."""
    bem_formado = [{"diseaseId": "amebiase", "valorTabnet": 3}]
    ingenuo = [{"diseaseId": "infarto_cerebral", "valorTabnet": 262}]

    with pytest.raises(ValueError, match="mesmo conjunto"):
        medir({}, bem_formado, ingenuo, uf="AC", ano=2019)


# ---------------------------------------------------------------------------
# Justificativa legível por máquina
# ---------------------------------------------------------------------------


def test_justificativa_json_tem_a_chave_de_sih_collection_status():
    """A justificativa precisa cair 1:1 em `sih_collection_status`, cuja PK é
    (disease_id, medida, grao, local, ano) -- é o grão em que o aluno faz a comparação."""
    medicoes = [_medicao(site=294, bem_formado=294, ingenuo=262, disease_id="infarto_cerebral")]

    doc = to_justificativa_json(medicoes, grao="uf", local="ocorrencia", medida="internacoes")

    entrada = doc["entradas"][0]
    for campo in ("disease_id", "medida", "grao", "local", "ano"):
        assert campo in entrada
    assert entrada["medida"] == "internacoes"
    assert entrada["grao"] == "uf"
    assert entrada["local"] == "ocorrencia"


def test_justificativa_json_carrega_divergencia_pct_e_razao_em_prosa():
    medicoes = [_medicao(site=294, bem_formado=294, ingenuo=262, disease_id="infarto_cerebral")]

    doc = to_justificativa_json(medicoes, grao="uf", local="ocorrencia", medida="internacoes")
    entrada = doc["entradas"][0]

    assert entrada["divergencia_pct"] == pytest.approx(32 / 262 * 100)
    # a razão é a frase que o app mostra ao aluno -- precisa dizer o mecanismo, não só que há um
    assert "data de internação" in entrada["divergencia_razao"]
    assert "competência" in entrada["divergencia_razao"]


def test_justificativa_json_declara_a_metodologia_das_duas_pontas():
    """Sem declarar quantos arquivos cada ponta submeteu, o número volta a ser um oráculo sem
    janela -- a origem exata do resíduo fantasma."""
    medicoes = [_medicao(site=294, bem_formado=294, ingenuo=262)]

    doc = to_justificativa_json(medicoes, grao="uf", local="ocorrencia", medida="internacoes")

    assert doc["metodologia"]["site"]["chave_de_ano"] == "DT_INTER"
    assert doc["metodologia"]["tabnet_bem_formado"]["janela_competencia"] == 1
    assert doc["metodologia"]["tabnet_ingenuo"]["janela_competencia"] == 0
