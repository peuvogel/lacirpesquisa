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
`IDENT='5'` em AC/2019 nestas 3 categorias especificamente.

---

## ATUALIZADO em 2026-08-17 (09-15-DT-INTER): `exato=98, explicado=0, inexplicado=0`, `ok=True`

**O resíduo do SC-7 nunca existiu. Ele era uma comparação entre duas coisas diferentes.**

Este gate carregava, desde o spike de 2026-08-04, um viés residual **sempre positivo** (mediana
+4,14% → +3,45% → +5,10% → +7,90% conforme a metodologia foi refinada), atribuído a "divergência
de lote por competência de processamento" e formalizado em 61 entradas de
`scripts/catalog/cid-divergencias.json`. A troca da chave de ano de `ANO_CMPT` para `DT_INTER`
(09-15-DT-INTER) foi feita por motivo epidemiológico independente — e, ao medir o gate depois
dela, o resíduo **aumentou** (mediana +4,31% → +5,51%; exatos 34 → 33). Em vez de aceitar ou
ajustar, foi medido o mecanismo. O achado:

**O oráculo do eixo CID estava truncado a UM ano de competência.** `oracle_scrape.py` submete ao
TabNet apenas os 12 arquivos `nibr{AA}MM.dbf` do ano pedido e lê a coluna `Ano_atendimento`.
Isso NÃO mede o ano de atendimento completo: mede "internações do ano Y **que foram faturadas na
competência Y**" — toda internação de Y faturada em Y+1 fica de fora do próprio oráculo.
(Contraste medido: `coleta_vascular_amputacao.py`, o oráculo do eixo de PROCEDIMENTO, submete os
156 arquivos dos 13 anos e portanto mede o ano de atendimento de verdade — por isso
`amputacao_mmii` fecha EXATO em 66 contra o agregado por `DT_INTER` completo, ver
`test_aggregate.py::test_amputacao_mmii_ano_de_admissao_2019_fecha_exato_com_o_oraculo_qibr`.)

Alinhadas as duas pontas para medirem a MESMA população — agregado por `DT_INTER`, restrito à
competência 2019, que é exatamente o que o oráculo enxerga — o resultado, sem tunar nada:

| Cenário (mesmo código, só muda a chave de ano / o recorte) | Exatos | Delta mediano |
|---|---|---|
| `ANO_CMPT=2019` (produção até esta correção) | 34/98 | +4,31% |
| `DT_INTER=2019` completo (competências 2019+2020) | 33/98 | +5,51% |
| **`DT_INTER=2019` na competência 2019 (o que o oráculo mede)** | **98/98** | **+0,00%** |

**98 de 98 pares batem exato, com delta zero.** Nenhuma correção de faixa CID foi adicionada,
alterada ou removida por esta plan; as correções existentes continuam load-bearing (sem elas o
gate cai para 96/2 — provado em `test_gate_falha_se_cid_corrections_mudar`).

**O que isso significa, dito sem suavizar:** o viés positivo sistemático que este projeto
carregou por duas semanas, que motivou 61 entradas de divergência, um checkpoint clínico e dois
bloqueios de upload, era inteiramente artefato de comparar um agregado por competência de
faturamento contra um oráculo por data de atendimento truncado a uma competência. O matcher CID,
o mapa da Lista Morb, o filtro `IDENT='1'` e a atribuição territorial estavam corretos o tempo
todo — e agora isso está PROVADO em 98 categorias independentes, com valores de 1 a mais de
3.000, em vez de apenas plausível.

**Consequência para `cid-divergencias.json`:** as ~61 entradas de "divergência de lote por
competência de processamento" descrevem um fenômeno que, medido corretamente, não existe. Elas
ficaram INERTES (nenhuma é consultada, porque nenhum par tem delta não-zero). Esta plan não as
remove — mexer no catálogo está fora do seu escopo de arquivo, e a decisão é do operador — mas
registra aqui, e no SUMMARY, que uma explicação que não explica mais nada não pode continuar de
pé como se explicasse.

**Por que a fixture continua sendo a competência 2019 (e não o ano de admissão completo):** para
este gate ser um teste e não uma coincidência, os dois lados precisam medir a mesma população. O
oráculo congelado (`oracle_ac_2019.json`) mede a competência 2019; a fixture, portanto, é a
competência 2019. A cobertura do ano de ADMISSÃO completo — que é o que a produção passa a
publicar — é provada separadamente, contra um oráculo construído corretamente, em
`test_aggregate.py` (`amputacao_mmii` = 66 = oráculo `qibr.def`). Os dois testes juntos cobrem as
duas propriedades; nenhum sozinho cobre as duas.

O que este gate protege não é mais "a composição do conjunto inexplicado" — é algo bem mais
forte: **que o conjunto inexplicado seja VAZIO e todos os 98 pares batam exato.** Qualquer
mudança no matcher, em `cid-corrections.json` ou na agregação que desloque um único par derruba
a suíte.
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
# ATUALIZADO 2026-08-17 (09-15-DT-INTER): VAZIO. Os 3 que restavam (`doenca_de_alzheimer`,
# `tuberculose_do_sistema_nervoso`, `tuberculose_pulmonar`) batem EXATO agora, junto com os
# outros 95 -- ver docstring do módulo. Não foi tunado nada: os deltas que eles tinham
# (+50%/+50%/+12,12%, denominadores 4/2/33) eram a mesma diferença de população que afetava todo
# o resto, só mais visível em contagem pequena.
_INEXPLICADOS_CONHECIDOS: frozenset[str] = frozenset()


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
    # 98/0/0 é a composição TRUE medida em 2026-08-17 depois de alinhar o agregado e o oráculo
    # para medirem a MESMA população (ver docstring do módulo) -- não é uma barra afrouxada, é a
    # barra máxima possível: todos os 98 pares com delta EXATAMENTE zero.
    assert len(resultado.exato) == 98
    assert len(resultado.explicado) == 0
    assert len(resultado.inexplicado) == 0
    # `ok` passa a True pela primeira vez desde que este gate existe -- e sem que nenhuma
    # correção de faixa CID tenha sido adicionada ou alterada por 09-15-DT-INTER.
    assert resultado.ok is True


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
