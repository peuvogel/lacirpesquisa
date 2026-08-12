"""Agregação por (agravo, medida, grão, local, ano) — DATA-01/DATA-02/DATA-03.

Lê os diretórios/arquivos `.parquet` já decodificados pelo `pysus` (ou a fixture congelada de
gate) via `pyarrow.dataset`, projetando SÓ `NEEDED_COLUMNS` (RESEARCH Pattern 3) — nunca a rota
de conveniência de alto nível do `pysus` para ler o parquet de volta como dataframe, que é
enviesada para o SINAN, não para o SIH (RESEARCH Pitfall 2, 09-PATTERNS.md §aggregate.py).

`VAL_TOT`/`DIAS_PERM` chegam como string com padding de espaço (Pitfall 1, `'        459.40'`,
`'    2'`) — `utf8_trim_whitespace` + `cast` explícitos são obrigatórios antes de qualquer soma.

Desvio medido do RESEARCH: a pesquisa assumiu que `MORTE` já chega `Int64` e não precisa de
cast. Medido ao vivo nesta plan (arquivo real `RDAC1901.parquet`, decodificado por
`pysus==1.0.1`): `MORTE` chega como STRING (`'0'`/`'1'`), igual a `VAL_TOT`/`DIAS_PERM`. O código
abaixo trata os dois casos possíveis (string ou inteiro) e levanta `TypeError` para qualquer
outro tipo — nunca assume, sempre verifica (é exatamente a disciplina que o plano já pedia:
"o código precisa **verificar** o tipo e falhar alto se ele mudar, em vez de assumir").

Correção 2026-08-10 (achado 09-08-INVESTIGACAO, decisão do operador): `IDENT` (tipo de AIH) só
conta `'1'` (AIH normal/nova admissão) em `internacoes`. `IDENT='5'` é renovação MENSAL de
faturamento de uma internação de longa permanência — a MESMA hospitalização, não uma nova —
contá-la infla categorias crônicas (demência, Parkinson, Alzheimer, formas graves de
tuberculose) em ordens de grandeza sem afetar condições agudas. Ver
`pipeline/sih/reports/reconciliacao-sc7.md` §"Investigação nova, 2026-08-10" para a medição
completa (deltas SP/2019 colapsam de +45%/+108%/+665% para +3,7%/+21,1% ao filtrar só
`IDENT='1'`).

A janela de anos (D-11, `schema-v3.json` `anoMin`/`anoMax`) e os valores canônicos de `grao`/
`local`/`medidas` vêm do próprio `schema-v3.json` — nunca reescritos como literal solto aqui, a
mesma disciplina de fonte única que `codigos.py` aplica a UF/município.

Recuperação de `amputacao_mmii` (09-XX-PROCEDIMENTO, 2026-08-12, brief avulso do coordenador,
sem PLAN.md formal). `amputacao_mmii` é o único agravo de `scripts/catalog/extra-diseases.json`
(Fase 8) com `filterKind: "procedimento"` — vem de `sih/cnv/qibr.def` (procedimentos
hospitalares SIH), fora da Lista Morb CID-10 que `match_category`/`matcher.py` cobrem. Por isso
nunca casa por `DIAG_PRINC`: casa por `PROC_REA` (procedimento realizado, código SIGTAP de 10
dígitos, campo oficial e ESTÁVEL do SIH-RD), um SEGUNDO eixo de classificação, independente do
eixo CID e testado em paralelo a ele para CADA registro (um mesmo registro pode contribuir para
as duas classificações ao mesmo tempo — nenhuma delas isenta ou substitui a outra). Ver
`_PROC_REA_AMPUTACAO_MMII` abaixo para a medição completa que estabeleceu o código certo.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, NamedTuple

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.dataset as ds

from sih_pipeline.codigos import municipio6, uf_de_municipio
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import CidIndex, build_index, load_cid_map, match_category
from sih_pipeline.paths import cache_path, repo_root

NEEDED_COLUMNS = [
    "DIAG_PRINC",
    "MUNIC_MOV",
    "MUNIC_RES",
    "MORTE",
    "VAL_TOT",
    "DIAS_PERM",
    "ANO_CMPT",
    "IDENT",
    "PROC_REA",
]

# IDENT='1' é a única AIH que conta como internação nova -- ver docstring do módulo.
_IDENT_AIH_NORMAL = "1"

# Taxa de descarte (DIAG_PRINC sem categoria) acima da qual a agregação levanta -- T-09-30,
# spike mediu 0,016% em 44.589 registros de AC/2019.
_MAX_TAXA_DESCARTE = 0.001

# --- Eixo de PROCEDIMENTO (amputacao_mmii, filterKind="procedimento") -----------------------
#
# `scripts/catalog/extra-diseases.json` (Fase 8) registra `amputacao_mmii` com `tabnetCode`
# "3331" e `def: "sih/cnv/qibr.def"`. Esse `tabnetCode` NÃO é o código SIGTAP do procedimento —
# é o ÍNDICE POSICIONAL da opção dentro do `<select name="SProcedimento" MULTIPLE>` do
# formulário TabNet de `qibr.def` (medido ao vivo, 2026-08-12: 5.695 opções, cada uma
# `"<índice>" -> "<código SIGTAP de 10 dígitos> <descrição>"`, ordenadas pelo próprio código
# SIGTAP). Esse índice DERIVA quando o DATASUS insere um procedimento SIGTAP novo no meio da
# lista — medido, não suposto:
#
#   - O HTML cru de um script legado
#     (`trabalhos datasus/outputs/coleta_vascular_amputacao/raw_sih_internacoes_amputacao_mmii.html`,
#     raspado 2026-06-17) usou `SProcedimento=3331` e o TabNet ecoou de volta "Procedimento:
#     0408050012 AMPUTACAO / DESARTICULACAO DE MEMBROS INFERIORES" na própria resposta —
#     correto NAQUELE dia.
#   - Re-raspado ao vivo em 2026-08-12 (~2 meses depois): o índice 3331 passou a apontar para
#     "0408040351 TRATAMENTO DE ARTICULACAO COXO-FEMORAL C/ IMOBILIZACAO GESSADA" (procedimento
#     totalmente diferente), e "0408050012 AMPUTACAO / DESARTICULACAO DE MEMBROS INFERIORES"
#     migrou para o índice 3332.
#
# Por isso esta agregação casa por `PROC_REA` (o código SIGTAP, campo oficial e ESTÁVEL do
# SIH-RD), nunca por um índice posicional do TabNet re-derivado a cada corrida — mesma
# disciplina de fonte autoritativa + medição empírica (nunca suposição) das colisões de faixa
# CID 9/15/77 do 09-08-INVESTIGACAO, aplicada aqui a um eixo diferente do TabNet.
#
# Reconciliado ao vivo (2026-08-12) contra dado real de AC/2019 (12 arquivos RDAC1901..1912,
# 44.589 registros): `PROC_REA=="0408050012" AND IDENT='1' AND ANO_CMPT=2019` mede 50
# internações. O oráculo TabNet (`Ano_atendimento=2019`, coluna por `DT_INTER`, não `ANO_CMPT`)
# mede 66 — a mesma ordem de grandeza do resíduo de competência de processamento já documentado
# em todo o SC-7 (`ANO_CMPT` vs `DT_INTER`), não um erro de mapeamento: medido que 45 dos 50
# registros de `ANO_CMPT=2019` têm `DT_INTER` em 2019 (5 são competência atrasada de admissões de
# 2018), e que só os 2 primeiros meses de 2020 (RDAC2001+RDAC2002) já somam 20 registros
# adicionais com `PROC_REA` casado, `IDENT='1'` e `DT_INTER=2019` — 45+20=65, a 1 unidade do
# oráculo (66), sem nenhum ajuste de código. Ver o SUMMARY desta plan
# (`09-XX-PROCEDIMENTO-SUMMARY.md`) para o relato completo, incluindo a reconciliação nacional.
_PROC_REA_AMPUTACAO_MMII = "0408050012"


def _load_procedure_disease_map() -> dict[str, str]:
    """`PROC_REA` (código SIGTAP) -> `disease_id`, para os agravos com `filterKind:
    "procedimento"` em `scripts/catalog/extra-diseases.json` (Fase 8) — hoje só
    `amputacao_mmii`. O `disease_id` sempre vem do próprio catálogo (nunca um literal solto
    aqui, mesma disciplina de `_load_disease_ids`) e é conferido contra
    `scripts/catalog/diseases.json` — mas o CÓDIGO SIGTAP correto (a chave do dict devolvido)
    nunca pode vir do `tabnetCode` do catálogo (índice posicional do TabNet, provado instável
    acima); vem só de uma constante medida e documentada nesta seção. Levanta `KeyError` se o
    catálogo algum dia registrar um agravo `filterKind: "procedimento"` sem `disease_id`
    conhecido ou sem código SIGTAP medido — falha alta em vez de ignorar silenciosamente um
    agravo novo (mesma disciplina de `_load_disease_ids`)."""
    path = repo_root() / "scripts" / "catalog" / "extra-diseases.json"
    with path.open("r", encoding="utf-8") as fh:
        entries = json.load(fh)

    known_disease_ids = set(_load_disease_ids().values())
    # Códigos SIGTAP medidos/documentados acima -- NUNCA derivados do tabnetCode do catálogo.
    proc_rea_by_disease_id = {"amputacao_mmii": _PROC_REA_AMPUTACAO_MMII}

    out: dict[str, str] = {}
    for entry in entries:
        if entry.get("filterKind") != "procedimento":
            continue
        disease_id = entry["id"]
        if disease_id not in known_disease_ids:
            raise KeyError(
                f"aggregate: extra-diseases.json tem {disease_id!r} (filterKind=procedimento) "
                "sem disease_id correspondente em scripts/catalog/diseases.json -- taxonomia "
                "dessincronizada."
            )
        proc_rea = proc_rea_by_disease_id.get(disease_id)
        if proc_rea is None:
            raise KeyError(
                f"aggregate: extra-diseases.json tem {disease_id!r} (filterKind=procedimento) "
                "sem código SIGTAP medido/documentado em _load_procedure_disease_map -- nunca "
                "inferir do tabnetCode (índice posicional instável do TabNet, ver docstring)."
            )
        out[proc_rea] = disease_id
    return out


def _load_schema_v3() -> dict[str, Any]:
    path = repo_root() / "scripts" / "catalog" / "schema-v3.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


_SCHEMA = _load_schema_v3()
GRAO_UF, GRAO_MUNICIPIO = _SCHEMA["graos"]
LOCAL_OCORRENCIA, LOCAL_RESIDENCIA = _SCHEMA["locais"]
ANO_MIN: int = _SCHEMA["anoMin"]
ANO_MAX: int = _SCHEMA["anoMax"]


def _load_disease_ids() -> dict[str, str]:
    """`tabnetCode -> disease_id`, lido de `scripts/catalog/diseases.json` — NUNCA
    `slugify(label)` local (a origem do defeito de ids duplicados da Fase 8)."""
    path = repo_root() / "scripts" / "catalog" / "diseases.json"
    with path.open("r", encoding="utf-8") as fh:
        entries = json.load(fh)
    return {entry["tabnetCode"]: entry["id"] for entry in entries}


class Row(NamedTuple):
    disease_id: str
    grao: str
    local: str
    territorio_codigo: str
    ano: int
    internacoes: int
    obitos: int
    valor_total: float
    dias_permanencia: int
    taxa_mortalidade: float | None


def _taxa_mortalidade(*, obitos: int, internacoes: int) -> float | None:
    """`obitos / internacoes` quando `internacoes > 0`; `None` (NUNCA `0`) quando `internacoes
    == 0` — ausência não é zero (T-09-30, a razão de existir desta função separada)."""
    if internacoes <= 0:
        return None
    return obitos / internacoes


def _cast_morte(morte_col: pa.Array | pa.ChunkedArray) -> pa.Array | pa.ChunkedArray:
    """Normaliza `MORTE` para `int64`, verificando o tipo real em vez de assumir (ver docstring
    do módulo — desvio medido do RESEARCH). Levanta `TypeError` para qualquer tipo que não seja
    string nem inteiro, para que uma mudança futura de schema do `pysus` falhe alto."""
    if pa.types.is_string(morte_col.type) or pa.types.is_large_string(morte_col.type):
        return pc.cast(pc.utf8_trim_whitespace(morte_col), "int64")
    if pa.types.is_integer(morte_col.type):
        return pc.cast(morte_col, "int64")
    raise TypeError(
        f"aggregate: MORTE com tipo inesperado {morte_col.type!r} — o pysus mudou o schema "
        "desta coluna; verificar antes de prosseguir (RESEARCH Pitfall 2)."
    )


def aggregate_parquet_dir(path: str | Path, index: CidIndex) -> list[Row]:
    """Lê `path` (diretório ou arquivo `.parquet`, real ou fixture) numa passada só e agrega
    por `(disease_id, grao, local, territorio_codigo, ano)`.

    Cada registro válido (ano dentro da janela D-11 E `IDENT='1'`) é testado contra DOIS eixos de
    classificação INDEPENDENTES — `DIAG_PRINC` casado pelo matcher CID (`match_category`,
    330 agravos da Lista Morb) e `PROC_REA` casado pelo mapa de procedimento
    (`_load_procedure_disease_map`, hoje só `amputacao_mmii`, ver docstring do módulo) — e
    contribui para EXATAMENTE 4 linhas de saída POR `disease_id` casado (não por registro): um
    registro que casa só CID gera 4 linhas; só procedimento, 4 linhas; os DOIS, 8 linhas (4 para
    cada `disease_id`, nenhum eixo isenta ou substitui o outro). As 4 linhas de cada
    `disease_id` são `(uf, ocorrencia)`, `(uf, residencia)`, `(municipio, ocorrencia)`,
    `(municipio, residencia)` — `MUNIC_MOV` alimenta ocorrência, `MUNIC_RES` alimenta residência
    (D-09), e o grão UF é derivado do grão município via `uf_de_municipio`, nunca lido de uma
    coluna separada.

    Registros com `IDENT` diferente de `'1'` (achado 09-08-INVESTIGACAO, 2026-08-10: `'5'` é
    renovação de faturamento da MESMA internação de longa permanência, não uma nova admissão)
    são excluídos ANTES de qualquer um dos dois eixos — nunca contados como descarte, porque não
    é falha de categorização, é exclusão semântica deliberada da medida `internacoes`, aplicada
    igualmente aos dois eixos (mesmo `continue` único no laço).

    Registros cujo `DIAG_PRINC` não casa em nenhuma categoria CID são contados como descarte
    (SÓ o eixo CID — o eixo de procedimento nunca isenta nem contribui para este contador,
    são medidas independentes); acima de `_MAX_TAXA_DESCARTE` (0,1%) a função levanta
    `ValueError` (T-09-30).
    """
    dataset = ds.dataset(str(path), format="parquet")
    table = dataset.to_table(columns=NEEDED_COLUMNS)

    val_tot = pc.cast(pc.utf8_trim_whitespace(table["VAL_TOT"]), "float64").to_pylist()
    dias_perm = pc.cast(pc.utf8_trim_whitespace(table["DIAS_PERM"]), "int64").to_pylist()
    morte = _cast_morte(table["MORTE"]).to_pylist()
    ano_cmpt = pc.cast(pc.utf8_trim_whitespace(table["ANO_CMPT"]), "int64").to_pylist()
    ident = pc.utf8_trim_whitespace(table["IDENT"]).to_pylist()
    proc_rea = pc.utf8_trim_whitespace(table["PROC_REA"]).to_pylist()
    diag_princ = table["DIAG_PRINC"].to_pylist()
    munic_mov = table["MUNIC_MOV"].to_pylist()
    munic_res = table["MUNIC_RES"].to_pylist()

    disease_ids = _load_disease_ids()
    procedure_map = _load_procedure_disease_map()

    acumulador: dict[tuple[str, str, str, str, int], dict[str, float | int]] = {}
    total = len(diag_princ)
    descartes = 0

    for i in range(total):
        ano = ano_cmpt[i]
        if ano is None or not (ANO_MIN <= ano <= ANO_MAX):
            continue

        if ident[i] != _IDENT_AIH_NORMAL:
            continue

        disease_ids_casados: list[str] = []

        tabnet_code = match_category(diag_princ[i], index)
        if tabnet_code is None:
            descartes += 1
        else:
            disease_id = disease_ids.get(tabnet_code)
            if disease_id is None:
                raise KeyError(
                    f"aggregate: tabnetCode {tabnet_code!r} (devolvido pelo matcher) sem "
                    "disease_id correspondente em scripts/catalog/diseases.json — taxonomia "
                    "dessincronizada do mapa CID."
                )
            disease_ids_casados.append(disease_id)

        procedure_disease_id = procedure_map.get(proc_rea[i])
        if procedure_disease_id is not None:
            disease_ids_casados.append(procedure_disease_id)

        if not disease_ids_casados:
            continue

        mov6 = municipio6(munic_mov[i])
        res6 = municipio6(munic_res[i])
        mov_uf = uf_de_municipio(mov6)
        res_uf = uf_de_municipio(res6)

        val = val_tot[i]
        dias = dias_perm[i]
        obito = morte[i]

        for disease_id in disease_ids_casados:
            for grao, local, territorio in (
                (GRAO_UF, LOCAL_OCORRENCIA, mov_uf),
                (GRAO_UF, LOCAL_RESIDENCIA, res_uf),
                (GRAO_MUNICIPIO, LOCAL_OCORRENCIA, mov6),
                (GRAO_MUNICIPIO, LOCAL_RESIDENCIA, res6),
            ):
                chave = (disease_id, grao, local, territorio, ano)
                entrada = acumulador.setdefault(
                    chave,
                    {"internacoes": 0, "obitos": 0, "valor_total": 0.0, "dias_permanencia": 0},
                )
                entrada["internacoes"] += 1
                entrada["obitos"] += obito
                entrada["valor_total"] += val
                entrada["dias_permanencia"] += dias

    if total > 0:
        taxa_descarte = descartes / total
        if taxa_descarte > _MAX_TAXA_DESCARTE:
            raise ValueError(
                f"aggregate: taxa de descarte (DIAG_PRINC sem categoria) {descartes}/{total} "
                f"({taxa_descarte:.4%}) acima do limite {_MAX_TAXA_DESCARTE:.1%} (T-09-30)"
            )

    linhas: list[Row] = []
    for (disease_id, grao, local, territorio, ano), valores in acumulador.items():
        internacoes = int(valores["internacoes"])
        obitos = int(valores["obitos"])
        linhas.append(
            Row(
                disease_id=disease_id,
                grao=grao,
                local=local,
                territorio_codigo=territorio,
                ano=ano,
                internacoes=internacoes,
                obitos=obitos,
                valor_total=float(valores["valor_total"]),
                dias_permanencia=int(valores["dias_permanencia"]),
                taxa_mortalidade=_taxa_mortalidade(obitos=obitos, internacoes=internacoes),
            )
        )

    return linhas


def aggregate_years(
    parquet_root: str | Path, index: CidIndex, *, anos: list[int] | None = None
) -> list[Row]:
    """Agrega `parquet_root` (o cache de parquet inteiro, ou um subconjunto) e filtra por
    `anos` quando informado — wrapper fino sobre `aggregate_parquet_dir`, sem segunda leitura
    da tabela (o filtro roda sobre as `Row` já computadas, D-01: agregação é de graça)."""
    linhas = aggregate_parquet_dir(parquet_root, index)
    if anos is None:
        return linhas
    anos_set = set(anos)
    return [linha for linha in linhas if linha.ano in anos_set]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="sih_pipeline.aggregate")
    parser.add_argument("--ano", type=int, default=None, help="filtra por um único ano")
    parser.add_argument("--uf", type=str, default=None, help="filtra por sigla de UF")
    parser.add_argument(
        "--dry-run", action="store_true", help="agrega e reporta, sem escrever nada em disco"
    )
    args = parser.parse_args(argv)

    cid_map = apply_corrections(load_cid_map(), load_corrections())
    index = build_index(cid_map)

    parquet_root = cache_path("parquet")
    if not parquet_root.exists() or not any(parquet_root.iterdir()):
        print("aggregate: nenhum parquet em cache_path('parquet') — nada a agregar")
        return 0

    anos = [args.ano] if args.ano is not None else None
    linhas = aggregate_years(parquet_root, index, anos=anos)

    if args.uf:
        linhas = [
            linha
            for linha in linhas
            if (linha.grao == GRAO_UF and linha.territorio_codigo == args.uf)
            or (linha.grao == GRAO_MUNICIPIO and uf_de_municipio(linha.territorio_codigo) == args.uf)
        ]

    print(f"aggregate: {len(linhas)} linha(s) agregada(s)")

    if args.dry_run:
        print("aggregate: --dry-run, nada escrito")
        return 0

    # Escrita persistente dos agregados (T-09-08: sempre via cache_path, nunca fora do cache)
    # fica a cargo dos consumidores dedicados (partitions.py/09-09, upload.py/09-10) — esta
    # plan entrega a função de agregação, não o pipeline de escrita completo.
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
