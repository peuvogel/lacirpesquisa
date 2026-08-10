"""Matcher CID->categoria — porta do `cidmatch.py` do spike 2026-08-04, já validado (0,016% de
miss em 44.589 registros, todo CID caindo em exatamente uma categoria, `G450 -> 150`
confirmando o checkpoint clínico da 08-07).

`load_cid_map()` lê `scripts/catalog/lista-morb-cid.json` — a fonte oficial (D-05), NUNCA
editada por este módulo. As correções de faixa (segunda fonte, `corrections.py`) são aplicadas
pelo CHAMADOR sobre o mapa carregado, nunca fundidas aqui em forma de regra de precedência
hardcoded por código (a mesma classe de defeito que corrompeu 21 ids na Fase 8, documentada no
09-CONTEXT.md D-05) — este módulo não sabe nada sobre exceções por código, só sabe interpretar
as cinco formas de valor do mapa.

`build_index()` troca a varredura linear do spike (aceitável para 44 mil linhas, inviável para
dezenas de milhões da coleta completa) por um índice pré-compilado: os tokens de cada entrada
são parseados UMA VEZ (não a cada chamada de `match_category`) e agrupados por letra inicial do
CID — a maioria dos `DIAG_PRINC` só precisa ser comparada contra os tokens da sua própria letra,
não contra o mapa inteiro. A ordem relativa dos tokens dentro de cada letra é preservada
(mesma ordem de `cid_map.items()`), para que o resultado de "primeira correspondência" seja
idêntico ao da varredura ingênua — provado por teste (`test_indice_precompilado_identico_a_varredura_linear`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from sih_pipeline.paths import repo_root

LISTA_MORB_CID_PATH = repo_root() / "scripts" / "catalog" / "lista-morb-cid.json"


@dataclass(frozen=True)
class _Token:
    kind: str  # "3" (prefixo/faixa de 3 char) ou "4" (exato/faixa de 4 char, com ponto)
    start: str
    end: str
    code: str


@dataclass(frozen=True)
class CidIndex:
    """Índice pré-compilado — tokens agrupados por letra inicial do CID."""

    by_letter: dict[str, list[_Token]]


def load_cid_map() -> dict[str, str]:
    """Lê `scripts/catalog/lista-morb-cid.json`, chaveado por `tabnetCode` — sem transformação,
    sem edição. É a entrada do matcher, nunca o destino de escrita."""
    with LISTA_MORB_CID_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _parse_token(code: str, raw_token: str) -> _Token:
    token = raw_token.strip()
    if "-" in token:
        start, end = (t.strip() for t in token.split("-"))
    else:
        start = end = token
    kind = "4" if "." in start else "3"
    return _Token(kind=kind, start=start, end=end, code=code)


def build_index(cid_map: dict[str, str]) -> CidIndex:
    """Pré-compila `cid_map` num índice agrupado por letra inicial do CID.

    Cada token é registrado sob a(s) letra(s) que sua faixa pode cobrir — na prática quase
    sempre uma letra só, mas um token cuja faixa cruza letras (ex.: `X85-Y09`, achado real no
    `lista-morb-cid.json`) é registrado em TODAS as letras entre `start[0]` e `end[0]`,
    inclusive, para que uma consulta em qualquer uma delas encontre o token.
    """
    by_letter: dict[str, list[_Token]] = {}

    for code, value in cid_map.items():
        for raw_token in value.split(","):
            token = _parse_token(code, raw_token)
            primeira, ultima = token.start[0], token.end[0]
            for letra_ord in range(ord(primeira), ord(ultima) + 1):
                by_letter.setdefault(chr(letra_ord), []).append(token)

    return CidIndex(by_letter=by_letter)


def match_category(diag_princ: str, index: CidIndex) -> str | None:
    """Devolve o `tabnetCode` cuja faixa cobre `diag_princ` (3 ou 4 caracteres, sem ponto), ou
    `None` se nenhuma categoria casar — NUNCA uma categoria "resto de" por omissão.

    Mesma semântica das cinco formas de valor do spike: prefixo/faixa de 3 caracteres cobre
    TODOS os subcódigos; exato/faixa de 4 caracteres compara com ponto (`A18.3`).
    """
    if not diag_princ:
        return None

    diag3 = diag_princ[:3]
    diag4_dotted = f"{diag3}.{diag_princ[3]}" if len(diag_princ) == 4 else None

    candidatos = index.by_letter.get(diag_princ[0], [])
    for token in candidatos:
        if token.kind == "4":
            if diag4_dotted is not None and token.start <= diag4_dotted <= token.end:
                return token.code
        else:
            if token.start <= diag3 <= token.end:
                return token.code

    return None
