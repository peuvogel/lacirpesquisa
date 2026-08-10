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
EXPLICADO (era ausente). Novo estado: `exato=34, explicado=61, inexplicado=3`. Os 3 inexplicados
restantes (`doenca_de_alzheimer`, `tuberculose_do_sistema_nervoso`, `tuberculose_pulmonar`) têm
faixa CID correta (confirmada contra a mesma fonte autoritativa) — o mecanismo do delta foi
IDENTIFICADO nesta mesma investigação (AIH tipo 5/longa permanência, `IDENT='5'`, não filtrada
por `aggregate.py`), mas a correção pertence a `aggregate.py` (fora do escopo de arquivo desta
investigação, dono 09-07) — ver `cid-divergencias.json`,
`PENDENTE_sete_categorias_delta_extremo_sp`. Continuam BLOQUEANDO o upload do `09-10` por essa
razão, não mais por "mecanismo desconhecido". `ReconciliationResult.ok` é `False` sobre esta
fixture HOJE, DE PROPÓSITO: o gate não pode fingir sucesso sobre uma pendência que segue aberta
(D-02 proíbe inventar mecanismo tanto quanto proíbe banda de tolerância).

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
_INEXPLICADOS_CONHECIDOS = frozenset(
    {
        "doenca_de_alzheimer",  # tabnetCode 146 -- delta extremo; mecanismo IDENTIFICADO (AIH tipo 5,
        # IDENT='5', não filtrada por aggregate.py) mas correção fora do escopo de arquivo desta
        # investigação (dono: 09-07)
        "tuberculose_do_sistema_nervoso",  # tabnetCode 10 -- mesmo mecanismo (AIH tipo 5), mesma razão
        "tuberculose_pulmonar",  # tabnetCode 7 -- mesmo mecanismo (AIH tipo 5), mesma razão
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
    # result.ok é False hoje, DE PROPÓSITO -- ver docstring do módulo: o gate não finge sucesso
    # sobre uma pendência que segue aberta (mecanismo AIH tipo 5 identificado, correção pendente
    # em aggregate.py, fora do escopo de arquivo desta investigação -- dono 09-07).
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
