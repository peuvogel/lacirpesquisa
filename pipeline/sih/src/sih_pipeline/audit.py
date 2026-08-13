"""Auditoria de cobertura (PIPE-05) -- ledger de arquivo (Camada 1) x ledger de cobertura
(Camada 2, `sih_collection_status`) x fonte servida (`sih_metric_uf`, via PostgREST paginado).

Purpose: o pipeline aposentado registrou 341 agravos como "coletados" com dois terços vazios
dentro -- sucesso sem prova (ver `.planning/notes/2026-08-04-pysus-microdado-spike.md` §6). Este
módulo é a prova: compara o produto cartesiano completo de (disease_id, medida, grao, local, ano)
-- 331 agravos x 4 medidas x 2 graos x 2 locais x 13 anos ~= 69 mil combinações, D-13 -- contra o
que `sih_collection_status` de fato tem e contra o que a fonte servida de fato tem, e reporta a
diferença por nome, nunca por confiança (T-09-44).

D-13: a chave de `sih_collection_status` é (disease_id, medida, grao, local, ano), com `ano`
obrigatório -- sem ele, um ano ainda incompleto no FTP do DataSUS fica indistinguível de um ano
fechado, e o mapa da Fase 10 pintaria buraco como zero. `anos_incompletos_no_ledger` torna isso
visível a partir da Camada 1 (o ledger de arquivo local), independente do que a Camada 2 diz.

D-14: a regra que distingue ZERO VERDADEIRO de AUSENTE nasce aqui, como função pura
(`classificar_ausencia`), com docstring citando a decisão, para que a Fase 10 possa portá-la ou
consumi-la sem reinterpretar (MAPA-03/MAPA-04):

  - `status = 'coletado'` + linha de métrica ausente -> ZERO VERDADEIRO (processamos essa
    combinação com sucesso e nenhum território teve internação -- não é ausência de dado).
  - `status` em `('falhou', 'nunca_tentado')` + linha de métrica ausente -> AUSENTE (não
    processamos essa combinação com sucesso -- a ausência de linha É ausência de dado).
  - combinação sem NENHUMA linha em `sih_collection_status` -> FALTANTE. Achado real, registrado
    aqui e não escondido: hoje só o grão `uf` tem escritor de Camada 2
    (`upload.py::_persistir_collection_status`) -- o grão `municipio` (D-20, dado servido do
    Storage, não do Postgres) não tem nenhum escritor equivalente ainda. Toda combinação de grão
    `municipio` cai em `faltantes` por construção (nenhuma tentativa foi sequer registrada),
    nunca classificada como zero verdadeiro por engano -- ver `main()` para como isso é reportado.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sih_pipeline.enumerate import UFS
from sih_pipeline.ledger import STATUS_BAIXADO, FileLedger
from sih_pipeline.paths import repo_root
from sih_pipeline.upload import _PAGE_SIZE, _fetch, _parse_content_range_total

_SCHEMA = json.loads((repo_root() / "scripts" / "catalog" / "schema-v3.json").read_text("utf-8"))
MEDIDAS: tuple[str, ...] = tuple(_SCHEMA["medidas"])
GRAOS: tuple[str, ...] = tuple(_SCHEMA["graos"])
LOCAIS: tuple[str, ...] = tuple(_SCHEMA["locais"])
ANO_MIN: int = _SCHEMA["anoMin"]
ANO_MAX: int = _SCHEMA["anoMax"]

STATUS_COLETADO = "coletado"
STATUS_FALHOU = "falhou"
STATUS_NUNCA_TENTADO = "nunca_tentado"

# (disease_id, medida, grao, local, ano) -- a chave exata de sih_collection_status (D-13).
CoverageKey = tuple[str, str, str, str, int]

_ARQUIVOS_ESPERADOS_POR_ANO = len(UFS) * 12  # 27 x 12 = 324


# ---------------------------------------------------------------------------
# Universo esperado (D-13).
# ---------------------------------------------------------------------------


def carregar_disease_ids() -> tuple[str, ...]:
    """Os `id` dos 331 agravos canônicos de `scripts/catalog/diseases.json` -- nunca uma lista
    literal aqui (mesma disciplina de `aggregate.py::_load_disease_ids`/`_load_procedure_disease_map`)."""
    path = repo_root() / "scripts" / "catalog" / "diseases.json"
    with path.open("r", encoding="utf-8") as fh:
        entries = json.load(fh)
    return tuple(entry["id"] for entry in entries)


def cartesiano_completo(
    *,
    disease_ids: Iterable[str],
    medidas: Iterable[str] = MEDIDAS,
    graos: Iterable[str] = GRAOS,
    locais: Iterable[str] = LOCAIS,
    anos: Iterable[int] = range(ANO_MIN, ANO_MAX + 1),
) -> frozenset[CoverageKey]:
    """O produto cartesiano completo que `sih_collection_status` deveria cobrir (D-13): 331
    agravos x 4 medidas x 2 graos x 2 locais x 13 anos ~= 69 mil combinações em produção; os
    parâmetros existem para que os testes montem universos sintéticos pequenos."""
    return frozenset(
        (disease_id, medida, grao, local, ano)
        for disease_id in disease_ids
        for medida in medidas
        for grao in graos
        for local in locais
        for ano in anos
    )


# ---------------------------------------------------------------------------
# D-14 -- a regra, como função pura.
# ---------------------------------------------------------------------------


def classificar_ausencia(status: str) -> str:
    """A regra do D-14, como função pura -- sem I/O, sem estado, pronta para a Fase 10 portar ou
    importar sem reinterpretar (MAPA-03/MAPA-04).

    Recebe o `status` do ledger de cobertura (`sih_collection_status`) de uma combinação
    (disease_id, medida, grao, local, ano) que JÁ SE CONFIRMOU sem linha de métrica
    correspondente -- decide se a ausência da linha significa ZERO VERDADEIRO ou AUSÊNCIA:

    - `status == 'coletado'`: o ledger diz que processamos esta combinação com sucesso e nenhum
      território teve internação -- ZERO VERDADEIRO, nunca ausência de dado.
    - qualquer outro status (`'falhou'`, `'nunca_tentado'`): não processamos esta combinação com
      sucesso -- a ausência de linha É ausência de dado, não zero.

    Devolve `"zero_verdadeiro"` ou `"ausente"`, nunca outro valor -- as duas classes são
    mutuamente exclusivas por construção (D-14: "a mesma combinação nunca aparece nas duas
    listas")."""
    return "zero_verdadeiro" if status == STATUS_COLETADO else "ausente"


@dataclass(frozen=True)
class CoverageReport:
    """O resultado medido de `audit_coverage` -- nunca uma alegação de sucesso sem prova
    (T-09-44). Cada combinação do cartesiano cai em exatamente um balde: `coletado` (contagem,
    saudável, com dado), `zero_verdadeiro`, `ausente` ou `faltantes` (D-14)."""

    total_esperado: int
    coletado: int
    zero_verdadeiro: tuple[CoverageKey, ...]
    ausente: tuple[CoverageKey, ...]
    faltantes: tuple[CoverageKey, ...]
    contagem_por_status: dict[str, int]
    anos_incompletos: dict[int, int]
    ok: bool

    def resumo(self) -> str:
        return (
            f"esperado={self.total_esperado} coletado={self.coletado} "
            f"zero_verdadeiro={len(self.zero_verdadeiro)} ausente={len(self.ausente)} "
            f"faltantes={len(self.faltantes)} status={self.contagem_por_status} "
            f"anos_incompletos={self.anos_incompletos} ok={self.ok}"
        )


def audit_coverage(
    *,
    cartesiano: frozenset[CoverageKey],
    status_rows: Sequence[Mapping[str, Any]],
    metric_keys: frozenset[CoverageKey],
    anos_incompletos: Mapping[int, int] | None = None,
) -> CoverageReport:
    """Compara `cartesiano` (o universo completo esperado, D-13) contra `status_rows` (o que
    `sih_collection_status` de fato tem, já lido -- ver `_fetch_all_paginated`) e `metric_keys`
    (o que a fonte servida de fato tem linha -- `sih_metric_uf` para grão `uf`), e classifica
    cada combinação do cartesiano:

    - presente em `metric_keys` -> `coletado` (contagem; saudável, com dado servido)
    - ausente de `metric_keys`, com linha em `status_rows` -> classificado por D-14
      (`classificar_ausencia`): `zero_verdadeiro` ou `ausente`
    - ausente de `status_rows` por inteiro (nenhuma linha, nenhum status conhecido) ->
      `faltantes` -- nem tentativa foi registrada; é a prova que PIPE-05 pede: o ledger de
      cobertura precisa provar que cobre o que alega cobrir, e uma combinação sem NENHUMA linha
      denuncia exatamente o contrário.

    A mesma combinação nunca aparece em `zero_verdadeiro` E `ausente` ao mesmo tempo -- garantido
    por construção (cada combinação passa por exatamente um `if`/`elif`) e verificado de novo no
    fim, porque essa garantia é o que impede o D-14 de virar ambíguo sob refatoração futura."""
    status_index: dict[CoverageKey, str] = {}
    for row in status_rows:
        chave: CoverageKey = (
            row["disease_id"],
            row["medida"],
            row["grao"],
            row["local"],
            int(row["ano"]),
        )
        status_index[chave] = row["status"]

    coletado = 0
    zero_verdadeiro: list[CoverageKey] = []
    ausente: list[CoverageKey] = []
    faltantes: list[CoverageKey] = []
    contagem_por_status: dict[str, int] = {}

    for chave in sorted(cartesiano):
        status = status_index.get(chave)

        if status is None:
            faltantes.append(chave)
            continue

        contagem_por_status[status] = contagem_por_status.get(status, 0) + 1

        if chave in metric_keys:
            coletado += 1
            continue

        classe = classificar_ausencia(status)
        if classe == "zero_verdadeiro":
            zero_verdadeiro.append(chave)
        else:
            ausente.append(chave)

    if set(zero_verdadeiro) & set(ausente):
        raise AssertionError(
            "audit_coverage: uma combinação apareceu em zero_verdadeiro E ausente ao mesmo "
            "tempo -- a regra do D-14 quebrou (ver classificar_ausencia); nunca deveria "
            "acontecer, dado que os dois blocos são mutuamente exclusivos por construção."
        )

    ok = (
        contagem_por_status.get(STATUS_FALHOU, 0) == 0
        and contagem_por_status.get(STATUS_NUNCA_TENTADO, 0) == 0
    )

    return CoverageReport(
        total_esperado=len(cartesiano),
        coletado=coletado,
        zero_verdadeiro=tuple(zero_verdadeiro),
        ausente=tuple(ausente),
        faltantes=tuple(faltantes),
        contagem_por_status=contagem_por_status,
        anos_incompletos=dict(anos_incompletos or {}),
        ok=ok,
    )


# ---------------------------------------------------------------------------
# Camada 1 -- ano incompleto no FTP (D-13): um ano com menos de 27x12 arquivos `baixado` no
# ledger de arquivo local fica visível mesmo que todo agravo já tenha linha na Camada 2.
# ---------------------------------------------------------------------------


def anos_incompletos_no_ledger(
    file_ledger: FileLedger, *, anos: Iterable[int] = range(ANO_MIN, ANO_MAX + 1)
) -> dict[int, int]:
    """Para cada `ano` de `anos`, conta quantos dos `27x12=324` arquivos `RD{uf}{aa}{mm}`
    esperados estão `baixado` no ledger de arquivo (Camada 1, local -- nunca `sih_collection_status`,
    que não sabe nada sobre arquivo). Um ano com contagem menor que 324 é reportado como
    incompleto -- D-13 existe exatamente para tornar isso visível, mesmo que TODO agravo já tenha
    linha de métrica para esse ano (o caso normal do ano mais recente da janela, ainda em
    publicação no FTP do DataSUS no momento em que a corrida rodou)."""
    resultado: dict[int, int] = {}
    for ano in anos:
        aa = ano % 100
        baixados = sum(
            1
            for uf in UFS
            for mm in range(1, 13)
            if file_ledger.status(f"RD{uf}{aa:02d}{mm:02d}") == STATUS_BAIXADO
        )
        if baixados < _ARQUIVOS_ESPERADOS_POR_ANO:
            resultado[ano] = baixados
    return resultado


# ---------------------------------------------------------------------------
# Leitura paginada -- reusa os primitivos de baixo nível de `upload._fetch`/
# `upload._parse_content_range_total` (T-09-11/Pitfall 13: nunca confiar em HTTP 200 sozinho),
# nunca reimplementa a paginação. `recount_via_postgrest` (09-10) não serve aqui porque só conta,
# descarta as linhas -- este módulo precisa das linhas para classificar cada combinação.
# ---------------------------------------------------------------------------


def _fetch_all_paginated(
    tabela: str, *, select: str = "*", filtros: Mapping[str, str] | None = None
) -> list[dict[str, Any]]:
    """Lê TODAS as linhas de `tabela` via PostgREST, paginando pelo cabeçalho `Range` -- segue
    lendo página a página até cobrir o total anunciado em `content-range`; se a soma do que foi
    lido não bater com o total anunciado, levanta `RuntimeError` (MAPA-06/Pitfall 13: falhar alto
    em vez de reportar cobertura que não foi de fato lida)."""
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_role = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    params = {"select": select, **dict(filtros or {})}
    query = urllib.parse.urlencode(params)

    linhas: list[dict[str, Any]] = []
    total_anunciado: int | None = None
    offset = 0

    while True:
        url = f"{supabase_url}/rest/v1/{tabela}?{query}"
        request = urllib.request.Request(
            url,
            method="GET",
            headers={
                "Authorization": f"Bearer {service_role}",
                "apikey": service_role,
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + _PAGE_SIZE - 1}",
                "Prefer": "count=exact",
            },
        )
        body, headers = _fetch(request)
        pagina = json.loads(body)
        anunciado = _parse_content_range_total(headers)

        if total_anunciado is None:
            total_anunciado = anunciado
        elif anunciado != total_anunciado:
            raise RuntimeError(
                f"audit: content-range mudou de total no meio da paginação de {tabela!r} "
                f"({total_anunciado} -> {anunciado}) -- dado mudando sob a leitura, abortando em "
                "vez de reportar um total que pode estar errado."
            )

        linhas.extend(pagina)

        if len(pagina) < _PAGE_SIZE or len(linhas) >= total_anunciado:
            break
        offset += _PAGE_SIZE

    if total_anunciado is not None and len(linhas) != total_anunciado:
        raise RuntimeError(
            f"audit: leu {len(linhas)} de {total_anunciado} linha(s) anunciadas em content-range "
            f"para {tabela!r} -- leitura truncada (MAPA-06/RESEARCH Pitfall 13). Nunca reportar "
            "uma cobertura que não foi de fato lida."
        )

    return linhas


def _metric_keys_grao_uf(linhas_metric_uf: Sequence[Mapping[str, Any]]) -> frozenset[CoverageKey]:
    """De linhas cruas de `sih_metric_uf` (só `disease_id`/`local`/`ano` -- D-13 não distingue
    território na chave de cobertura) para o conjunto de chaves
    (disease_id, medida, grao='uf', local, ano) com AO MENOS UM território reportando -- cada
    linha de `sih_metric_uf` carrega as 4 medidas juntas (colunas de uma linha, não linhas
    separadas), então uma linha alcançada implica as 4 medidas presentes de uma vez."""
    combos = {(linha["disease_id"], linha["local"], int(linha["ano"])) for linha in linhas_metric_uf}
    return frozenset(
        (disease_id, medida, "uf", local, ano)
        for disease_id, local, ano in combos
        for medida in MEDIDAS
    )


# ---------------------------------------------------------------------------
# CLI -- contrato único que cli.py (09-04, dono único) resolve para o subcomando `audit`.
# ---------------------------------------------------------------------------


def main(argv: list[str]) -> int:
    """PIPE-05: um comando, uma resposta medida sobre se a coleta capturou o que afirma ter
    capturado -- compara o ledger de arquivo (Camada 1, local), o ledger de cobertura (Camada 2,
    `sih_collection_status`) e a fonte servida (`sih_metric_uf`, via PostgREST paginado).

    Achado real, registrado aqui e em `pipeline/sih/reports/cobertura-final.md`, não escondido:
    hoje só o grão `uf` tem escritor de Camada 2 (`upload.py::_persistir_collection_status`) -- o
    grão `municipio` (D-20, dado servido do Storage, não do Postgres) não tem nenhum escritor
    equivalente ainda. Toda combinação desse grão cai em `faltantes` aqui, por construção
    (nenhuma tentativa foi sequer registrada em `sih_collection_status`), nunca classificada como
    zero verdadeiro por engano -- `main()` imprime essa quebra por grão explicitamente para que o
    operador nunca confunda "sem escritor" com "zero verdadeiro"."""
    parser = argparse.ArgumentParser(prog="sih_pipeline.audit")
    parser.parse_args(argv)

    disease_ids = carregar_disease_ids()
    cartesiano = cartesiano_completo(disease_ids=disease_ids)

    status_rows = _fetch_all_paginated(
        "sih_collection_status", select="disease_id,medida,grao,local,ano,status"
    )
    linhas_metric_uf = _fetch_all_paginated("sih_metric_uf", select="disease_id,local,ano")
    metric_keys = _metric_keys_grao_uf(linhas_metric_uf)

    file_ledger = FileLedger.load()
    incompletos = anos_incompletos_no_ledger(file_ledger)

    report = audit_coverage(
        cartesiano=cartesiano,
        status_rows=status_rows,
        metric_keys=metric_keys,
        anos_incompletos=incompletos,
    )

    print(f"audit: {report.resumo()}")

    if report.faltantes:
        por_grao: dict[str, int] = {}
        for _disease_id, _medida, grao, _local, _ano in report.faltantes:
            por_grao[grao] = por_grao.get(grao, 0) + 1
        print(
            f"audit: faltantes por grão -- {por_grao} (grão sem escritor de Camada 2 cai aqui "
            "por inteiro, nunca em zero_verdadeiro)"
        )

    if incompletos:
        print(f"audit: ano(s) incompleto(s) no ledger de arquivo (Camada 1) -- {incompletos}")

    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
