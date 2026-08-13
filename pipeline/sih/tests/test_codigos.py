"""Testa a canonizacao compartilhada de SEXO e codigo de municipio (codigos.py) --
RESEARCH Pitfall 7 (valores medidos ao vivo: SIH SEXO em {1,3}, POPSVS SEXO em {1,2}) e
Assumption A1 (a interpretacao 1=Masculino nao foi confirmada contra dicionario oficial --
precisa ficar declarada como suposicao no codigo, nao virar fato silencioso).
"""

from __future__ import annotations

import pytest

from sih_pipeline.codigos import (
    UF_POR_CODIGO,
    municipio6,
    municipio6_ou_none,
    sexo_popsvs,
    sexo_sih,
    uf_de_municipio,
)
from sih_pipeline.enumerate import UFS


def test_sexo_sih_masculino_aceita_int_e_str():
    assert sexo_sih(1) == "M"
    assert sexo_sih("1") == "M"


def test_sexo_sih_feminino_aceita_int_e_str():
    assert sexo_sih(3) == "F"
    assert sexo_sih("3") == "F"


def test_sexo_sih_valor_desconhecido_devolve_none():
    # SEXO=2 nao aparece no SIH (Pitfall 7: 1.222 registros SEXO=1, 2.062 SEXO=3, zero
    # SEXO=2, medido ao vivo) -- nao pode ser adivinhado como M ou F.
    assert sexo_sih(2) is None


def test_sexo_popsvs_masculino_e_feminino():
    assert sexo_popsvs(1) == "M"
    assert sexo_popsvs(2) == "F"


def test_sexo_popsvs_valor_desconhecido_devolve_none():
    assert sexo_popsvs(3) is None


def test_alinhamento_sih_popsvs_feminino():
    # Pitfall 7: SIH usa SEXO=3 para feminino, POPSVS usa SEXO=2 -- afirmado explicitamente
    # porque e o alinhamento que e facil de errar em silencio (join ingenuo por valor bruto).
    assert sexo_sih(3) == sexo_popsvs(2) == "F"


def test_municipio6_aceita_6_ou_7_digitos_e_da_o_mesmo_resultado():
    assert municipio6("3550308") == municipio6("355030") == "355030"


def test_municipio6_rejeita_comprimento_invalido():
    with pytest.raises(ValueError):
        municipio6("35503")


def test_municipio6_rejeita_string_vazia():
    with pytest.raises(ValueError):
        municipio6("")


def test_municipio6_rejeita_codigo_nao_numerico_do_mesmo_comprimento():
    # Classe distinta da string vazia: comprimento correto (6 ou 7), mas com caractere não
    # numérico -- medido ao vivo em MUNIC_MOV real de PR/2020 ('01510.', '     8', '51059.',
    # 09-04-FIX-MUNICIPIO-BRANCO). Antes desta correção, municipio6() só checava comprimento e
    # devolvia esse lixo sem levantar -- o mesmo bug que produziu o crash de município vazio,
    # só que silencioso em vez de barulhento.
    with pytest.raises(ValueError):
        municipio6("01510.")
    with pytest.raises(ValueError):
        municipio6("     8")


def test_municipio6_ou_none_devolve_none_para_branco_e_malformado_sem_levantar():
    # municipio6_ou_none() é o único ponto do pipeline que trata "não dá para localizar este
    # registro" como dado esperado (SIH real tem MUNIC_MOV/MUNIC_RES em branco/malformado em
    # ~1 a cada 10 milhões de registros que alcançam este ponto, medido nacionalmente) -- NUNCA
    # levanta, mas também NUNCA inventa um código; municipio6() continua levantando para todo o
    # resto do pipeline (population.py e qualquer consumidor futuro).
    assert municipio6_ou_none("") is None
    assert municipio6_ou_none("01510.") is None
    assert municipio6_ou_none("     8") is None
    assert municipio6_ou_none(None) is None
    assert municipio6_ou_none("35503") is None  # comprimento inválido também devolve None


def test_municipio6_ou_none_preserva_codigo_valido_de_6_ou_7_digitos():
    # Regressão: para entrada válida, municipio6_ou_none devolve exatamente o mesmo valor que
    # municipio6() -- nunca um comportamento diferente para o caminho feliz.
    assert municipio6_ou_none("3550308") == municipio6("3550308") == "355030"
    assert municipio6_ou_none("355030") == municipio6("355030") == "355030"
    assert municipio6_ou_none(120040) == municipio6(120040) == "120040"


def test_uf_de_municipio_e_uf_por_codigo():
    assert uf_de_municipio("3550308") == "35"
    assert UF_POR_CODIGO["35"] == "SP"


def test_uf_por_codigo_tem_27_entradas_alinhadas_com_enumerate_ufs():
    # Amarra UF_POR_CODIGO ao UFS de enumerate.py -- acrescentar uma UF num lugar e
    # esquecer no outro quebra esta suite.
    assert len(UF_POR_CODIGO) == 27
    assert set(UF_POR_CODIGO.values()) == set(UFS)
