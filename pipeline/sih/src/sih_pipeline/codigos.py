"""Canonização compartilhada de SEXO e código de município — o único lugar onde as
convenções do SIH e do IBGE/POPSVS se encontram (consumido também por `population.py`, 09-06).

RESEARCH Pitfall 7 (valores medidos ao vivo nesta pesquisa, `09-RESEARCH.md`): o SIH (AIH) usa
`SEXO ∈ {1, 3}` — 1.222 registros `SEXO=1`, 2.062 registros `SEXO=3`, ZERO registros `SEXO=2` na
amostra observada. O `POPSVS` usa `SEXO ∈ {1, 2}`. Um join ingênuo entre numerador (SIH) e
denominador (população) por valor bruto de `SEXO` alinharia errado o sexo feminino — por isso a
canonização para `"M"`/`"F"` mora aqui, num único lugar documentado, e nunca é refeita ad-hoc em
`aggregate.py`/`population.py`.

Assumption A1 (RESEARCH `## Assumptions Log`) — DECLARADA COMO SUPOSIÇÃO, NÃO COMO FATO: a
interpretação de que `SEXO=1` significa "Masculino" tanto no SIH quanto no `POPSVS`, e que
`SEXO=3` no SIH / `SEXO=2` no POPSVS significam "Feminino", segue a convenção DATASUS padrão mas
NÃO foi confirmada contra um dicionário de dados oficial nesta pesquisa. Se a convenção real for
diferente, o denominador de taxa por sexo fica trocado silenciosamente — ambos os valores são
códigos numéricos válidos em ambas as fontes. Um valor fora do conjunto medido (`sexo_sih(2)`,
`sexo_popsvs(3)`) devolve `None` e nunca cai em `"M"`/`"F"` por omissão.
"""

from __future__ import annotations

# 27 códigos IBGE de UF (2 dígitos) -> sigla. O conjunto de valores precisa ser exatamente
# o de `enumerate.UFS` (o teste amarra os dois) -- acrescentar uma UF num lugar e esquecer no
# outro quebra a suíte.
UF_POR_CODIGO: dict[str, str] = {
    "11": "RO",
    "12": "AC",
    "13": "AM",
    "14": "RR",
    "15": "PA",
    "16": "AP",
    "17": "TO",
    "21": "MA",
    "22": "PI",
    "23": "CE",
    "24": "RN",
    "25": "PB",
    "26": "PE",
    "27": "AL",
    "28": "SE",
    "29": "BA",
    "31": "MG",
    "32": "ES",
    "33": "RJ",
    "35": "SP",
    "41": "PR",
    "42": "SC",
    "43": "RS",
    "50": "MS",
    "51": "MT",
    "52": "GO",
    "53": "DF",
}


def sexo_sih(valor: str | int) -> str | None:
    """`SEXO` do SIH (`{1, 3}`, medido ao vivo — Pitfall 7) para `"M"`/`"F"`.

    Assumption A1: `1 -> "M"`, `3 -> "F"` é a convenção DATASUS padrão assumida, não confirmada
    contra dicionário oficial. Qualquer outro valor (inclusive `2`, que não aparece no SIH)
    devolve `None` — nunca `"M"` por omissão.
    """
    texto = str(valor)
    if texto == "1":
        return "M"
    if texto == "3":
        return "F"
    return None


def sexo_popsvs(valor: str | int) -> str | None:
    """`SEXO` do POPSVS (`{1, 2}`) para `"M"`/`"F"`.

    Assumption A1 (mesma suposição não confirmada de `sexo_sih`): `1 -> "M"`, `2 -> "F"`.
    """
    texto = str(valor)
    if texto == "1":
        return "M"
    if texto == "2":
        return "F"
    return None


def municipio6(codigo: str | int) -> str:
    """6 primeiros dígitos do código IBGE de município, aceitando entrada de 6 ou 7 dígitos.

    O SIH publica o código IBGE de 6 dígitos; `sih_metric_muni.municipio_codigo` é `char(6)`
    (TabNet); o POPSVS traz `COD_MUN` de 7 dígitos. Juntar numerador e denominador por chave de
    comprimento diferente devolve zero linha, ou junta errado se alguém truncar do lado errado —
    por isso este é o único ponto de truncamento do pipeline.

    `int` é normalizado com zero à esquerda antes da checagem de comprimento (um `int` nunca
    preserva zero à esquerda em Python — `str` é levada literalmente, sem preenchimento,
    porque já preserva o comprimento real do dado de origem). Comprimento fora de `{6, 7}`
    levanta `ValueError`.
    """
    if isinstance(codigo, int):
        texto = str(codigo).zfill(6)
    elif isinstance(codigo, str):
        texto = codigo
    else:
        raise ValueError(f"municipio6: tipo não suportado: {type(codigo)!r}")

    if len(texto) not in (6, 7):
        raise ValueError(
            f"municipio6: comprimento inválido (esperado 6 ou 7 dígitos): {codigo!r}"
        )

    return texto[:6]


def uf_de_municipio(codigo: str | int) -> str:
    """2 primeiros dígitos do código IBGE de município — o código de UF."""
    texto = str(codigo) if isinstance(codigo, int) else codigo
    return texto[:2]
