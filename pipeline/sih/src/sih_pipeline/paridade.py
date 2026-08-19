"""Paridade site × TabNet — as DUAS comparações, medidas separadamente (09-16).

O critério de aceitação do operador: *"quando user puxe dado tabnet e site lado a lado sejam
iguais e se diferentes justificados"*. Um aluno vai colocar os dois lado a lado. Onde puderem
ser iguais, têm que ser iguais; onde não puderem, a diferença precisa ser **medida e
explicada**.

Isso são duas comparações, e colapsá-las numa só é o erro que esta fase inteira já cometeu uma
vez (ver o resíduo fantasma do SC-7, `test_reconcile_gate.py`):

| Comparação | O que prova | Esperado |
|---|---|---|
| site × TabNet **bem-formado** | correção | **exatamente igual** |
| site × TabNet **ingênuo** | a justificativa que o app precisa mostrar | site maior, por uma quantia medida |

**Por que existe uma consulta "ingênua" e por que ela não é um erro do aluno.** O site agrega
por `DT_INTER` (data de internação): o ano de uma linha é o ano em que a hospitalização
aconteceu. O TabNet tabula `Coluna=Ano_atendimento`, que é a mesma coisa — mas só enxerga o que
está nos arquivos de competência que o usuário **submeteu**. O TabNet abre com os 12 arquivos de
um ano selecionados, então a consulta natural mede "internações de Y faturadas em Y" e perde as
internações de Y faturadas em Y+1 (tipicamente as de novembro/dezembro). A diferença não é ruído
nem erro de ninguém: é uma propriedade do faturamento do SUS, e o app tem que saber dizer isso.

Este módulo não toca rede: recebe os dois oráculos já raspados (ver `oracle_scrape.py`, que
ganhou a janela de competência) e o agregado do site, e produz a medição, a distribuição e a
justificativa legível por máquina.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

# Frase que o app mostra ao aluno quando os dois números não batem porque a consulta do TabNet
# foi a natural. Fica AQUI, uma vez, em vez de espalhada por telas: é a explicação do mecanismo,
# não um aviso genérico de "os dados podem divergir".
RAZAO_DIVERGENCIA_JANELA_CURTA = (
    "Contado pela data de internação. O TabNet, por padrão, conta pela competência de "
    "faturamento e mostra menos — a diferença são as internações faturadas no ano seguinte."
)
"""A mesma explicação de `RAZAO_DIVERGENCIA_JANELA`, em UMA frase, para caber na tela ao lado do
número (09-18). A longa continua sendo a fonte para relatório e para quem quiser reproduzir a
consulta; esta é a que o aluno lê sem sair do fluxo.

Universal por construção: descreve o MÉTODO de contagem, não uma exceção de um agravo. Por isso
mora aqui e não em `cid-divergencias.json`, que é lista de exceção por `diseaseId`."""


RAZAO_DIVERGENCIA_JANELA = (
    "Este número conta internações pela data de internação (DT_INTER), incluindo as que foram "
    "faturadas em competências posteriores. A consulta padrão do TabNet submete apenas os 12 "
    "arquivos de competência do próprio ano, então ela não enxerga as internações do fim do ano "
    "faturadas no ano seguinte. Para reproduzir este número no TabNet, submeta também as "
    "competências do ano seguinte."
)


@dataclass(frozen=True)
class MedicaoParidade:
    """Um agravo/UF/ano medido nas três pontas."""

    disease_id: str
    uf: str
    ano: int
    site: int
    bem_formado: int
    ingenuo: int

    @property
    def delta_bem_formado(self) -> int:
        """site - TabNet bem-formado. Zero é a barra; qualquer outra coisa é achado."""
        return self.site - self.bem_formado

    @property
    def paridade_exata(self) -> bool:
        return self.delta_bem_formado == 0

    @property
    def delta_ingenuo(self) -> int:
        return self.site - self.ingenuo

    @property
    def pct_ingenuo(self) -> float | None:
        """Lacuna percentual sobre o denominador ingênuo, ou `None` quando ele é zero.

        Agravo raro em UF pequena pode dar TabNet ingênuo = 0 e site = 2. Percentual não existe
        aí; devolver 0% ou infinito seria mentir em alguma direção. `None` é o honesto, e quem
        consome precisa lidar com ele explicitamente.
        """
        if self.ingenuo == 0:
            return None
        return self.delta_ingenuo / self.ingenuo * 100


def _percentil(valores_ordenados: Sequence[float], q: float) -> float:
    """Percentil por interpolação linear (mesmo método do `numpy.percentile` default)."""
    if not valores_ordenados:
        raise ValueError("_percentil: sequência vazia")
    if len(valores_ordenados) == 1:
        return float(valores_ordenados[0])
    pos = (len(valores_ordenados) - 1) * q
    baixo = int(pos)
    alto = min(baixo + 1, len(valores_ordenados) - 1)
    fracao = pos - baixo
    return float(valores_ordenados[baixo] * (1 - fracao) + valores_ordenados[alto] * fracao)


def distribuicao(medicoes: Iterable[MedicaoParidade]) -> dict[str, Any]:
    """Resume as medições — **distribuição, nunca só a média**.

    Uma média sozinha esconde exatamente o que interessa aqui: os agravos onde a diferença entre
    o site e a consulta ingênua é grande o bastante para um aluno achar que um dos dois está
    errado.
    """
    medicoes = list(medicoes)
    pcts = sorted(m.pct_ingenuo for m in medicoes if m.pct_ingenuo is not None)

    resumo: dict[str, Any] = {
        "n": len(medicoes),
        "paridade_exata": sum(1 for m in medicoes if m.paridade_exata),
        "paridade_divergente": sum(1 for m in medicoes if not m.paridade_exata),
        "sem_pct_denominador_zero": sum(1 for m in medicoes if m.pct_ingenuo is None),
        "site_maior_que_ingenuo": sum(1 for m in medicoes if m.delta_ingenuo > 0),
        "site_igual_ao_ingenuo": sum(1 for m in medicoes if m.delta_ingenuo == 0),
        "site_menor_que_ingenuo": sum(1 for m in medicoes if m.delta_ingenuo < 0),
        "delta_ingenuo_absoluto_total": sum(m.delta_ingenuo for m in medicoes),
        "total_site": sum(m.site for m in medicoes),
        "total_bem_formado": sum(m.bem_formado for m in medicoes),
        "total_ingenuo": sum(m.ingenuo for m in medicoes),
    }
    if pcts:
        resumo |= {
            "min_pct": pcts[0],
            "p25_pct": _percentil(pcts, 0.25),
            "mediana_pct": _percentil(pcts, 0.50),
            "p75_pct": _percentil(pcts, 0.75),
            "p90_pct": _percentil(pcts, 0.90),
            "max_pct": pcts[-1],
        }
    return resumo


def medir(
    site: dict[str, int],
    bem_formado: Sequence[dict],
    ingenuo: Sequence[dict],
    *,
    uf: str,
    ano: int,
) -> list[MedicaoParidade]:
    """Casa as três pontas por `disease_id`.

    Recusa oráculos sobre conjuntos de agravos diferentes: comparar duas janelas sobre populações
    diferentes é a MESMA classe de erro que produziu o resíduo fantasma do SC-7, e ela não pode
    reaparecer por descuido de chamada.

    Agravo ausente do agregado conta como 0 — e **aparece** na medição em vez de sumir dela: um
    agravo que o TabNet tem e o site não é exatamente o defeito que esta medição existe para
    pegar.
    """
    bf = {e["diseaseId"]: int(e["valorTabnet"]) for e in bem_formado}
    ing = {e["diseaseId"]: int(e["valorTabnet"]) for e in ingenuo}

    if set(bf) != set(ing):
        so_bf = sorted(set(bf) - set(ing))[:5]
        so_ing = sorted(set(ing) - set(bf))[:5]
        raise ValueError(
            "medir: os dois oráculos precisam cobrir o mesmo conjunto de agravos "
            f"(só no bem-formado: {so_bf}; só no ingênuo: {so_ing})"
        )

    return [
        MedicaoParidade(
            disease_id=disease_id,
            uf=uf,
            ano=ano,
            site=int(site.get(disease_id, 0)),
            bem_formado=bf[disease_id],
            ingenuo=ing[disease_id],
        )
        for disease_id in sorted(bf)
    ]


def valores_do_site(
    caminho_agregado: Path,
    *,
    uf_codigo: str,
    ano: int,
    grao: str = "uf",
    local: str = "ocorrencia",
    medida: str = "internacoes",
) -> dict[str, int]:
    """Lê do parquet agregado o valor de cada agravo para o recorte pedido.

    Import de `pyarrow` local de propósito: os testes desta medição não precisam dele, e o módulo
    é importado por caminhos que só querem `RAZAO_DIVERGENCIA_JANELA`.
    """
    import pyarrow.parquet as pq

    tabela = pq.read_table(caminho_agregado).to_pydict()
    fora: dict[str, int] = {}
    for i in range(len(tabela["disease_id"])):
        if (
            tabela["grao"][i] != grao
            or tabela["local"][i] != local
            or tabela["ano"][i] != ano
            or tabela["territorio_codigo"][i] != uf_codigo
        ):
            continue
        valor = tabela[medida][i]
        if valor is not None:
            fora[tabela["disease_id"][i]] = int(valor)
    return fora


def to_justificativa_json(
    medicoes: Sequence[MedicaoParidade],
    *,
    grao: str,
    local: str,
    medida: str,
) -> dict[str, Any]:
    """Documento legível por máquina que uma fase de UI (ou o `upload.py`) consegue consumir.

    A chave de cada entrada é exatamente a PK de `sih_collection_status`
    (`disease_id, medida, grao, local, ano`), e os campos `divergencia_pct`/`divergencia_razao`
    são exatamente as colunas que aquela tabela já tem — ou seja, **existe lugar natural para
    esta justificativa e ele não precisa ser inventado**. Gravar lá é trabalho do `upload.py`
    (fora do escopo de arquivo do 09-16); este documento é a fonte pronta para isso.
    """
    return {
        "gerado_em": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "metodologia": {
            "site": {
                "chave_de_ano": "DT_INTER",
                "descricao": (
                    "ano em que a internação ACONTECEU; a coleta submete todas as competências "
                    "necessárias para fechar o ano, inclusive as do ano seguinte"
                ),
            },
            "tabnet_bem_formado": {
                "janela_competencia": 1,
                "descricao": (
                    "submete as 12 competências do ano + as 12 do ano seguinte, lendo a coluna "
                    "Ano_atendimento do ano pedido"
                ),
            },
            "tabnet_ingenuo": {
                "janela_competencia": 0,
                "descricao": (
                    "submete apenas os 12 arquivos de competência do próprio ano -- a seleção "
                    "padrão do TabNet, e portanto a consulta que um aluno faz sem instrução"
                ),
            },
        },
        "distribuicao": distribuicao(medicoes),
        "entradas": [
            {
                "disease_id": m.disease_id,
                "medida": medida,
                "grao": grao,
                "local": local,
                "ano": m.ano,
                "uf": m.uf,
                "site": m.site,
                "tabnet_bem_formado": m.bem_formado,
                "tabnet_ingenuo": m.ingenuo,
                "paridade_exata": m.paridade_exata,
                "delta_bem_formado": m.delta_bem_formado,
                "delta_ingenuo": m.delta_ingenuo,
                "divergencia_pct": m.pct_ingenuo,
                "divergencia_razao": RAZAO_DIVERGENCIA_JANELA,
            }
            for m in medicoes
        ],
    }


def render_markdown(medicoes: Sequence[MedicaoParidade], *, titulo: str) -> str:
    """Relatório humano — a tabela que o operador lê para decidir, com a distribuição no topo."""
    d = distribuicao(medicoes)
    linhas = [
        f"## {titulo}",
        "",
        f"- Pares medidos: **{d['n']}**",
        f"- Paridade bem-formada EXATA: **{d['paridade_exata']}/{d['n']}** "
        f"(divergentes: {d['paridade_divergente']})",
        f"- Site × ingênuo: site maior em {d['site_maior_que_ingenuo']}, "
        f"igual em {d['site_igual_ao_ingenuo']}, menor em {d['site_menor_que_ingenuo']}",
        f"- Totais: site {d['total_site']} · bem-formado {d['total_bem_formado']} "
        f"· ingênuo {d['total_ingenuo']}",
    ]
    if "mediana_pct" in d:
        linhas += [
            f"- Lacuna da consulta ingênua (%): min {d['min_pct']:.2f} · p25 {d['p25_pct']:.2f} "
            f"· **mediana {d['mediana_pct']:.2f}** · p75 {d['p75_pct']:.2f} "
            f"· p90 {d['p90_pct']:.2f} · max {d['max_pct']:.2f}",
        ]
    linhas += [
        "",
        "| agravo | UF | ano | site | TabNet bem-formado | Δ | TabNet ingênuo | Δ | Δ% |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for m in sorted(medicoes, key=lambda x: (-x.site, x.disease_id)):
        pct = "—" if m.pct_ingenuo is None else f"{m.pct_ingenuo:+.2f}%"
        marca = "" if m.paridade_exata else " ⚠"
        linhas.append(
            f"| {m.disease_id} | {m.uf} | {m.ano} | {m.site} | {m.bem_formado} | "
            f"{m.delta_bem_formado:+d}{marca} | {m.ingenuo} | {m.delta_ingenuo:+d} | {pct} |"
        )
    return "\n".join(linhas) + "\n"


def salvar_justificativa(doc: dict[str, Any], caminho: Path) -> Path:
    caminho.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    return caminho


def main(argv: list[str]) -> int:
    """Roda a medição ao vivo para um recorte UF/ano e grava relatório + justificativa.

    Invocado como `uv run python -m sih_pipeline.paridade --uf AC --ano 2019` — deliberadamente
    NÃO registrado em `cli.py`, cujo cabeçalho declara dono único (09-04) e diz que nenhum outro
    plano da fase edita aquele arquivo.
    """
    import argparse

    from sih_pipeline.oracle_scrape import (
        UF_CODE_BY_SIGLA,
        fetch_arquivos_disponiveis,
        scrape_pairs,
    )
    from sih_pipeline.paths import cache_path, repo_root, reports_path

    parser = argparse.ArgumentParser(prog="paridade")
    parser.add_argument("--uf", required=True)
    parser.add_argument("--ano", required=True, type=int)
    parser.add_argument(
        "--agravos",
        default=None,
        help="lista separada por vírgula; default = todos os agravos com tabnetCode",
    )
    parser.add_argument("--sufixo-saida", default=None, help="sufixo dos arquivos em reports/")
    args = parser.parse_args(argv)

    diseases = json.loads(
        (repo_root() / "scripts" / "catalog" / "diseases.json").read_text(encoding="utf-8")
    )
    por_id = {d["id"]: d for d in diseases if d.get("tabnetCode")}
    escolhidos = (
        [a.strip() for a in args.agravos.split(",") if a.strip()]
        if args.agravos
        else sorted(por_id)
    )
    faltando = [a for a in escolhidos if a not in por_id]
    if faltando:
        print(f"paridade: agravos sem tabnetCode ou inexistentes: {faltando}", file=__import__("sys").stderr)
        return 2

    pares = [
        {"tabnetCode": por_id[a]["tabnetCode"], "diseaseId": a, "uf": args.uf, "ano": args.ano}
        for a in escolhidos
    ]

    disponiveis = fetch_arquivos_disponiveis()
    ingenuo = scrape_pairs(pares, janela=0)
    bem_formado = scrape_pairs(pares, janela=1, disponiveis=disponiveis)

    site = valores_do_site(
        cache_path(f"agregados/{args.uf}.parquet"),
        uf_codigo=UF_CODE_BY_SIGLA[args.uf],
        ano=args.ano,
    )

    medicoes = medir(site, bem_formado, ingenuo, uf=args.uf, ano=args.ano)

    sufixo = args.sufixo_saida or f"{args.uf}-{args.ano}"
    md = reports_path(f"paridade-{sufixo}.md")
    js = reports_path(f"paridade-{sufixo}.json")
    md.write_text(
        render_markdown(medicoes, titulo=f"Paridade site × TabNet — {args.uf}/{args.ano}"),
        encoding="utf-8",
    )
    salvar_justificativa(
        to_justificativa_json(medicoes, grao="uf", local="ocorrencia", medida="internacoes"), js
    )
    print(json.dumps(distribuicao(medicoes), ensure_ascii=False, indent=2))
    print(f"paridade: {md}")
    print(f"paridade: {js}")
    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main(sys.argv[1:]))
