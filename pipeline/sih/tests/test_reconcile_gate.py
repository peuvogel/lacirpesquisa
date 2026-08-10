"""Gate permanente: a reconciliação reproduz o subset do oráculo que AC/2019 prova — invocado
por `npm run gate` via `uv run pytest tests/test_reconcile_gate.py` — SC-7/D-06.

Fixture congelada e versionada (`oracle_ac_2019.json`, subconjunto `uf == "AC"` de
`oracle_tabnet.json`) + fixture parquet pequena (`rdac_2019.parquet`, ~267 KB) — nunca os 10 GB
completos, nunca uma requisição de rede. O refresh do oráculo é comando explícito e documentado
(`uv run python -m sih_pipeline.cli oracle-scrape --uf AC --ano 2019`), jamais parte automática
deste gate (mesmo padrão "snapshot versionado em vez de busca ao vivo" da Fase 8 D-09).

Estado em 2026-08-10 (checkpoint clínico do 09-11, D-07 — quatro decisões do operador registradas
em `scripts/catalog/cid-corrections.json`/`cid-divergencias.json`): `exato=33, explicado=60,
inexplicado=5`. Os 5 inexplicados eram pendências que BLOQUEAVAM o upload do `09-10` por decisão
explícita do operador (códigos `9`/`77`, colisão residual; e 3 das 7 categorias de delta extremo
reveladas pela confirmação em SP/2019).

ATUALIZADO em 2026-08-10 (investigação nova, `09-08-INVESTIGACAO`, resolução de
`PENDENTE_colisao_codigos_9_e_77`): a faixa correta dos códigos `9` e `77` foi determinada por
fonte autoritativa (tabela oficial DATASUS `mxcid10lm.htm`) + medição empírica ao vivo — ver
`cid-corrections.json` (tabnetCodes 9/15/77) e `pipeline/sih/reports/reconciliacao-sc7.md`. Isso
libera o efeito das correções já aprovadas dos códigos `14`/`274`: `tuberculose_miliar` passa a
bater EXATO (era ausente) e `doencas_infecciosas_e_parasitarias_congenitas` passa a ser
EXPLICADO (era ausente). Novo estado: `exato=34, explicado=61, inexplicado=3`.

ATUALIZADO DE NOVO em 2026-08-10 (fix aprovado pelo operador em `aggregate.py`, 09-07, commits
`53b7323`/`defa477`, resolução de `PENDENTE_sete_categorias_delta_extremo_sp`): `aggregate.py`
agora conta só `IDENT='1'` (AIH normal) em `internacoes` — `IDENT='5'` é renovação de faturamento
da MESMA internação de longa permanência, não uma nova admissão. Remedido em SP/2019 com o código
real (não um script ad-hoc): as 7 categorias de delta extremo colapsam de +45%–+3.451% para
+3,7%–+21,1%, dentro da banda já aceita de divergência de lote — `PENDENTE_sete_categorias_delta_
extremo_sp` tem `bloqueiaUpload: false` em `cid-divergencias.json`.

**A composição do gate AC/2019 (`exato=34, explicado=61, inexplicado=3`) fica BYTE-IDÊNTICA antes
e depois deste fix** — medido diretamente (não assumido): os 3 inexplicados restantes
(`doenca_de_alzheimer`, `tuberculose_do_sistema_nervoso`, `tuberculose_pulmonar`) têm 0% de
`IDENT='5'` em AC/2019 nestas 3 categorias especificamente (os 26 registros `IDENT='5'` do
dataset inteiro de AC/2019 pertencem 100% a `esquizofrenia_transt_esquizotipicos_e_delirantes`
(24) e `outros_transtornos_mentais_e_comportamentais` (2), nenhuma das quais tem par no oráculo
AC/2019) — por isso o fix não move nenhum valor agregado desta fixture pequena. O resíduo AC
destas 3 categorias (deltas +12,12%/+50%/+50%, denominadores de 33/2/4 -- ruído de amostra
pequena) é genuíno, mas de mecanismo DIFERENTE do delta extremo de SP (que era IDENT) — a mesma
classe de ruído da divergência de lote já aceita para as outras 53 categorias, mas que a decisão
4 do checkpoint clínico do 09-11 excluiu deliberadamente dessa aceitação em lote, pendente de
investigação individual. Este teste NÃO inventa essa investigação — mantém os 3 pares
honestamente `inexplicado`. `ReconciliationResult.ok` é `False` sobre esta fixture HOJE, DE
PROPÓSITO: o gate não pode fingir sucesso sobre um resíduo que segue sem razão escrita própria
(D-02 proíbe inventar mecanismo tanto quanto proíbe banda de tolerância). Ver
`pipeline/sih/reports/reconciliacao-sc7.md` §"Remedição pós-fix IDENT, 2026-08-10" para a
medição completa (SP/2019, código real, não script ad-hoc).

O que este gate protege não é "zero inexplicado" — é a COMPOSIÇÃO EXATA do conjunto inexplicado.
Se o conjunto mudar (para mais OU para menos entradas), o matcher, `cid-corrections.json` ou
`cid-divergencias.json` mudaram desde o checkpoint de 2026-08-10, e alguém precisa decidir — com
o mesmo cuidado do checkpoint clínico — se é uma correção legítima (que atualiza este teste
deliberadamente) ou uma regressão silenciosa (que precisa ser revertida).
"""

from __future__ import annotations

import json
from pathlib import Path

from sih_pipeline.aggregate import GRAO_UF, LOCAL_OCORRENCIA, aggregate_parquet_dir
from sih_pipeline.codigos import UF_POR_CODIGO
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import build_index, load_cid_map
from sih_pipeline.reconcile import compare, load_divergencias

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
PARQUET_FIXTURE = FIXTURES_DIR / "rdac_2019.parquet"
ORACLE_AC_2019_PATH = FIXTURES_DIR / "oracle_ac_2019.json"

_MEDIDAS = ("internacoes", "obitos", "valor_total", "dias_permanencia")

# Conjunto conhecido dos 3 pares que permanecem inexplicado (atualizado 2026-08-10, investigação
# nova 09-08-INVESTIGACAO -- ver cid-divergencias.json, entrada
# "PENDENTE_sete_categorias_delta_extremo_sp"). tuberculose_miliar e
# doencas_infecciosas_e_parasitarias_congenitas SAÍRAM deste conjunto: a colisão residual dos
# códigos 9/77 foi resolvida (PENDENTE_colisao_codigos_9_e_77), liberando o efeito das correções
# já aprovadas dos códigos 14/274 -- tuberculose_miliar agora bate EXATO, e
# doencas_infecciosas_e_parasitarias_congenitas agora é EXPLICADO.
#
# ATUALIZADO DE NOVO 2026-08-10 (fix em aggregate.py, IDENT='1' só): estes 3 disease_ids
# PERMANECEM neste conjunto -- medido, não assumido: AC/2019 tem 0% de IDENT='5' nestas 3
# categorias especificamente (os 26 registros IDENT='5' do dataset inteiro pertencem a
# esquizofrenia/outros transtornos mentais, sem par no oráculo AC), então o fix não move nenhum
# valor agregado desta fixture. O mecanismo que causava o delta EXTREMO em SP (IDENT) está
# corrigido -- PENDENTE_sete_categorias_delta_extremo_sp tem bloqueiaUpload=false -- mas o
# resíduo pequeno e específico do AC (+12,12%/+50%/+50%, ruído de amostra pequena, denominadores
# 33/2/4) é um mecanismo DIFERENTE, sem razão escrita própria, que a decisão 4 do checkpoint do
# 09-11 excluiu deliberadamente da aceitação em lote. Ver docstring do módulo.
_INEXPLICADOS_CONHECIDOS = frozenset(
    {
        "doenca_de_alzheimer",  # tabnetCode 146 -- delta extremo em SP RESOLVIDO (IDENT='1' só);
        # resíduo de AC (+50%, agregado=6/tabnet=4) inalterado pelo fix, 0% IDENT='5' nesta
        # categoria em AC/2019 -- ruído de amostra pequena, sem razão escrita própria
        "tuberculose_do_sistema_nervoso",  # tabnetCode 10 -- mesma situação (+50%, agregado=3/tabnet=2)
        "tuberculose_pulmonar",  # tabnetCode 7 -- mesma situação (+12,12%, agregado=37/tabnet=33)
    }
)


def _load_oracle_ac_2019() -> list[dict]:
    with ORACLE_AC_2019_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _agregar(cid_map_corrigido) -> dict[tuple[str, str, int, str], float]:
    index = build_index(cid_map_corrigido)
    linhas = aggregate_parquet_dir(PARQUET_FIXTURE, index)

    agregado: dict[tuple[str, str, int, str], float] = {}
    for linha in linhas:
        if linha.grao != GRAO_UF or linha.local != LOCAL_OCORRENCIA:
            continue
        uf_sigla = UF_POR_CODIGO[linha.territorio_codigo]
        for medida in _MEDIDAS:
            valor = getattr(linha, medida)
            if valor is None:
                continue
            agregado[(linha.disease_id, uf_sigla, linha.ano, medida)] = valor
    return agregado


def _rodar_reconciliacao(*, oraculo=None, corrections=None):
    corrections_reais = corrections if corrections is not None else load_corrections()
    agregado = _agregar(apply_corrections(load_cid_map(), corrections_reais))
    oraculo_usado = oraculo if oraculo is not None else _load_oracle_ac_2019()
    divergencias = load_divergencias()
    return compare(agregado, oraculo_usado, divergencias)


def test_oracle_ac_2019_contem_so_pares_de_ac():
    entradas = _load_oracle_ac_2019()

    assert len(entradas) > 0
    assert all(e["uf"] == "AC" for e in entradas)


def test_oracle_ac_2019_preserva_raspadoem_por_entrada():
    entradas = _load_oracle_ac_2019()

    assert all("raspadoEm" in e and e["raspadoEm"] for e in entradas)


def test_gate_agrega_fixture_pequena_e_compara_com_oraculo_congelado():
    resultado = _rodar_reconciliacao()

    inexplicados_ids = {p.disease_id for p in resultado.inexplicado}
    assert inexplicados_ids == _INEXPLICADOS_CONHECIDOS, (
        "conjunto de inexplicados mudou -- esperado "
        f"{sorted(_INEXPLICADOS_CONHECIDOS)}, obtido {sorted(inexplicados_ids)}. Isso significa "
        "que o matcher, cid-corrections.json ou cid-divergencias.json mudaram desde o checkpoint "
        "clínico de 2026-08-10 -- decida com o mesmo cuidado do checkpoint se é correção "
        "legítima (atualize este teste deliberadamente, junto de cid-divergencias.json/"
        "STATE.md) ou regressão silenciosa (reverta a mudança).\n"
        + resultado.render_markdown()
    )
    assert len(resultado.exato) == 34
    assert len(resultado.explicado) == 61
    assert len(resultado.inexplicado) == 3
    # result.ok é False hoje, DE PROPÓSITO -- ver docstring do módulo: 34/61/3 é a composição
    # TRUE medida DEPOIS do fix de IDENT='1' em aggregate.py (09-07, 2026-08-10) -- byte-idêntica
    # à composição pré-fix, porque AC/2019 tem 0% de IDENT='5' nas 3 categorias que permanecem
    # inexplicado. O gate não finge sucesso sobre um resíduo pequeno de AC que segue sem razão
    # escrita própria (mecanismo diferente do delta extremo de SP, já resolvido).
    assert resultado.ok is False


def test_gate_falha_se_cid_corrections_mudar():
    # Prova viva (in-memory, sem tocar o arquivo real): uma correção nova que desvia o código
    # 105 (doenca_de_hodgkin, tem par no oráculo e hoje é "explicado" -- só 5 registros reais em
    # AC/2019, longe do teto de descarte T-09-30) para uma faixa CID inexistente nos dados reais
    # (Z99) faz esse par virar "ausente" no agregado -- e ausência nunca é resgatada por
    # divergência (só delta não-zero é, ver docstring de reconcile.py) -- então a composição do
    # conjunto inexplicado muda. As 4 correções JÁ aprovadas (75/74/14/274) não têm par próprio no
    # oráculo (ver reconciliacao-sc7.md), então mexer nelas não move este conjunto por si só --
    # por isso a prova usa uma correção adicional sobre um código que tem par mensurável, o mesmo
    # tipo de mudança que esta suíte precisa detectar.
    corrections_reais = load_corrections()
    corrections_alteradas = [
        *corrections_reais,
        {
            "tabnetCode": "105",
            "oldRange": "C81",
            "newRange": "Z99",
            "reason": "Corrupção deliberada só para esta prova viva -- nunca aplicada de verdade.",
            "reconciliationPair": "teste",
        },
    ]

    resultado = _rodar_reconciliacao(corrections=corrections_alteradas)

    inexplicados_ids = {p.disease_id for p in resultado.inexplicado}
    assert inexplicados_ids != _INEXPLICADOS_CONHECIDOS


def test_gate_falha_se_oraculo_mudar():
    # Prova viva (in-memory, sem tocar o arquivo real): alterar o valorTabnet de uma entrada hoje
    # "exato" (amebiase, tabnetCode 4 -- sem divergência registrada) introduz um delta não-zero
    # sem razão associada -- vira "inexplicado" e desloca a composição. Uma entrada já
    # "explicado" não serviria para esta prova: qualquer delta não-zero nela continua resgatado
    # pela mesma divergência, mascarando a mudança.
    entradas = _load_oracle_ac_2019()
    entradas_alteradas = [dict(e) for e in entradas]
    for i, entrada in enumerate(entradas_alteradas):
        if entrada["diseaseId"] == "amebiase":
            entradas_alteradas[i] = {**entrada, "valorTabnet": entrada["valorTabnet"] + 999}
            break
    else:
        raise AssertionError("fixture não contém mais 'amebiase' -- ajustar esta prova")

    resultado = _rodar_reconciliacao(oraculo=entradas_alteradas)

    inexplicados_ids = {p.disease_id for p in resultado.inexplicado}
    assert inexplicados_ids != _INEXPLICADOS_CONHECIDOS
