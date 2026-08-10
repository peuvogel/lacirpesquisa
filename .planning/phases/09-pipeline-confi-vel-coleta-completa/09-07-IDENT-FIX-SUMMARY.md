---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 07-IDENT-FIX
subsystem: infra
tags: [python, pyarrow, sih, aggregation, ident, aih, sc-7, tdd, reconciliation]

# Dependency graph
requires:
  - phase: 09-07
    provides: "aggregate.py original (NEEDED_COLUMNS, aggregate_parquet_dir, fixture rdac_2019.parquet) -- base editada por este fix"
  - phase: 09-08-INVESTIGACAO
    provides: "mecanismo IDENT='5' identificado (achado 09-08-INVESTIGACAO, 2026-08-10) -- PENDENTE_sete_categorias_delta_extremo_sp caracterizada mas correção fora de escopo daquela investigação"
provides:
  - "aggregate.py: filtro IDENT='1' aplicado -- internacoes conta só AIH normal, exclui AIH de longa permanência (IDENT='5')"
  - "tests/fixtures/rdac_2019.parquet: regenerada com coluna IDENT incluída (44.589 registros preservados)"
  - "cid-divergencias.json: PENDENTE_sete_categorias_delta_extremo_sp RESOLVIDA (bloqueiaUpload=false), residuoNaoBloqueante documentado"
  - "test_reconcile_gate.py: docstring/comentários atualizados com a remedição pós-fix -- composição numérica (34/61/3) inalterada, medida não assumida"
  - "reconciliacao-sc7.md: seção nova 'Remedição pós-fix IDENT, 2026-08-10' com a medição completa"
affects: [09-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IDENT (tipo de AIH) excluído ANTES do matcher (continue explícito no loop de aggregate_parquet_dir), nunca contado como descarte -- exclusão semântica deliberada da medida, distinta de falha de categorização do CID"
    - "Remedição de gate: comparar agregado pós-fix contra cada valor 'agregado=' já registrado em paresQueMotivaram de cid-divergencias.json, categoria a categoria -- prova (não suposição) de que a divergência de lote já aceita continua valendo na mesma magnitude"

key-files:
  created:
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-07-IDENT-FIX-SUMMARY.md
  modified:
    - pipeline/sih/src/sih_pipeline/aggregate.py
    - pipeline/sih/tests/test_aggregate.py
    - pipeline/sih/tests/fixtures/rdac_2019.parquet
    - pipeline/sih/tests/test_reconcile_gate.py
    - scripts/catalog/cid-divergencias.json
    - pipeline/sih/reports/reconciliacao-sc7.md
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-07-SUMMARY.md
    - .planning/STATE.md

key-decisions:
  - "Operador aprovou (2026-08-10): contar só IDENT='1' (AIH normal) em internacoes -- uma renovação de AIH de longa permanência é faturamento continuado da MESMA hospitalização, não uma nova admissão; contar as duas juntas duplica a internação. O TabNet (oráculo) evidentemente já conta só a AIH inicial."
  - "TDD: RED verificado isoladamente restaurando a versão commitada de aggregate.py/fixture antes do commit RED (3 failed/13 passed, zero erros de coleção) -- disciplina necessária porque o pre-commit hook lê o working tree, não o índice git (mesmo padrão documentado pelo 09-07)"
  - "Fixture rdac_2019.parquet regenerada (não apenas aggregate.py editado) -- IDENT precisava existir na fixture para o filtro funcionar; regenerada dos mesmos 12 arquivos reais de AC/2019 do 09-07, preservando os 44.589 registros"
  - "PENDENTE_sete_categorias_delta_extremo_sp RESOLVIDA por medição em SP/2019 com o código real (não script ad-hoc): os 7 deltas colapsam de +45%-3.451% para +3,7%-21,1%, dentro da banda já aceita de divergência de lote"
  - "Gate AC/2019 (test_reconcile_gate.py) NÃO foi afrouxado -- composição 34/61/3 permanece idêntica, medida diretamente: os 26 registros IDENT='5' de AC/2019 pertencem 100% a duas categorias psiquiátricas (esquizofrenia, outros transtornos mentais) sem par no oráculo AC, então o fix não move nenhum valor comparado pelo gate. Os 3 inexplicados restantes continuam com os MESMOS deltas de antes (+12,12%/+50%/+50%) -- resíduo de amostra pequena, mecanismo diferente do delta extremo de SP, não bloqueante, documentado honestamente sem inventar explicação"
  - "Divergência de lote (competência de processamento) verificada categoria a categoria contra as 60 entradas já aceitas em cid-divergencias.json: zero mudaram de valor em AC/2019 -- o fix de IDENT não absorveu nada do que já estava atribuído à competência de processamento nesta UF (medido, não assumido). Em SP/2019 não foi remedido para as demais ~106 categorias (fora do orçamento deste fix) -- registrado como item de acompanhamento, não como conclusão"

requirements-completed: []  # Fix de dados sobre trabalho já entregue (DATA-03, 09-07) -- não introduz requisito novo

# Metrics
duration: ~50min
completed: 2026-08-10
---

# Fix IDENT='1' em aggregate.py: resolução da pendência B do SC-7 Summary

**`aggregate.py` agora conta só `IDENT='1'` (AIH normal) na medida `internacoes`, excluindo `IDENT='5'` (renovação de faturamento da mesma internação de longa permanência) -- fix TDD aprovado pelo operador que fecha a segunda das duas pendências que bloqueavam o upload do 09-10; remedição completa do SC-7 mostra que o gate AC/2019 fica byte-idêntico (26 registros IDENT='5' do Acre pertencem só a categorias psiquiátricas sem par no oráculo) enquanto as 7 categorias de delta extremo em SP/2019 colapsam de +45%-3.451% para +3,7%-21,1%.**

## Performance

- **Duration:** ~50 min
- **Tasks:** brief avulso do coordenador, sem PLAN.md -- TDD (RED/GREEN) + remedição completa do SC-7
- **Files modified:** 8 (1 criado -- este SUMMARY --, 7 modificados)

## Accomplishments

- **Fix TDD aplicado em `aggregate.py`.** `NEEDED_COLUMNS` ganhou `IDENT`; o loop de
  `aggregate_parquet_dir` exclui qualquer registro com `IDENT` diferente de `'1'` ANTES de
  chamar o matcher (`continue` explícito), nunca contado como descarte -- não é falha de
  categorização do CID, é exclusão semântica deliberada da medida.
- **RED verificado isoladamente.** Dois testes novos (`test_ident_diferente_de_1_e_excluido_da_
  contagem`, sintético; `test_ident_5_excluido_da_contagem_real_ac_2019`, sobre a fixture real de
  AC/2019) confirmados falhos (3 failed/13 passed, zero erros de coleção) restaurando
  temporariamente a versão commitada anterior de `aggregate.py` e da fixture antes do commit RED
  -- mesma disciplina que o 09-07 documentou para o pre-commit hook (lê o working tree, não o
  índice git).
- **Fixture `rdac_2019.parquet` regenerada** a partir dos mesmos 12 arquivos reais de AC/2019
  (`RDAC1901`..`RDAC1912`) do 09-07, agora projetando `IDENT` também -- 44.589 registros
  preservados, 267 KB → 347 KB.
- **Gate SC-7 (AC/2019) remedido e comprovado byte-idêntico.** `exato=34, explicado=61,
  inexplicado=3`, exatamente os mesmos 98 disease_ids nos mesmos três buckets de antes do fix --
  verificado categoria a categoria, não só por contagem. Causa medida: os 26 registros
  `IDENT='5'` do dataset inteiro de AC/2019 pertencem 100% a
  `esquizofrenia_transt_esquizotipicos_e_delirantes` (24) e
  `outros_transtornos_mentais_e_comportamentais` (2) -- nenhuma das duas tem par no oráculo AC,
  então o fix não move nenhum valor que o gate compara. Achado novo: confirma por medição a
  hipótese de "saúde mental de longa permanência" que a investigação de 2026-08-10 tinha deixado
  registrada como não-testada.
- **7 categorias remedidas contra SP/2019 com o código real** (não um script ad-hoc, o cache
  local completo de `RDSP1901`..`RDSP1912`, 2.606.482 registros): deltas colapsam de +45%-3.451%
  para +3,7%-21,1%, reproduzindo dentro de arredondamento os números que a investigação anterior
  tinha calculado com um script auxiliar -- boa validação cruzada. Todas as sete caem agora na
  mesma ordem de grandeza de divergências de lote já aceitas (ex.: `insuficiencia_cardiaca`
  +15,96%, `infarto_cerebral` +24,81%).
- **`PENDENTE_sete_categorias_delta_extremo_sp` RESOLVIDA** -- `bloqueiaUpload` alterado para
  `false` em `cid-divergencias.json`. As DUAS pendências que bloqueavam o upload do 09-10
  (colisão de códigos 9/77, resolvida em 2026-08-10 pela investigação anterior; e as sete
  categorias de delta extremo, resolvida por este fix) estão agora ambas resolvidas.
- **Divergência de lote verificada intacta em AC/2019, não assumida.** Comparado o agregado
  pós-fix contra cada valor `agregado=` já registrado em `paresQueMotivaram` das 60 divergências
  aceitas em `cid-divergencias.json`: zero categorias mudaram de valor -- o fix de IDENT não
  absorveu nada do que já estava atribuído ao efeito de competência de processamento
  (`ANO_CMPT`/`DT_INTER`) nesta UF.
- **Resíduo honesto documentado, não escondido.** 3 das 7 categorias
  (`tuberculose_pulmonar`/7, `tuberculose_do_sistema_nervoso`/10, `doenca_de_alzheimer`/146)
  continuam `inexplicado` no gate AC, com os MESMOS deltas de antes (+12,12%/+50%/+50%) --
  mecanismo diferente do delta extremo de SP (0% `IDENT='5'` nestas 3 categorias em AC), ruído de
  amostra pequena, não-bloqueante, registrado em `cid-divergencias.json` (`residuoNaoBloqueante`).

## Task Commits

1. **RED: teste falho -- IDENT!='1' precisa ser excluído** - `defa477` (test)
2. **GREEN: aggregate.py -- contar só IDENT='1'** - `53b7323` (feat)
3. **Remedição SC-7 pós-fix -- pendência B resolvida** - `dfcffed` (docs)

**Plan metadata:** (este commit, seguinte)

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/aggregate.py` -- `NEEDED_COLUMNS` ganha `IDENT`; filtro
  `IDENT != '1'` excluído antes do matcher
- `pipeline/sih/tests/test_aggregate.py` -- 2 testes novos (sintético + fixture real); 4 testes
  sintéticos preexistentes + `test_needed_columns_...` ganharam `IDENT` nas tabelas/asserção
- `pipeline/sih/tests/fixtures/rdac_2019.parquet` -- regenerada com coluna `IDENT`, 44.589
  registros preservados
- `pipeline/sih/tests/test_reconcile_gate.py` -- docstring/comentários atualizados com a
  remedição pós-fix; composição numérica (34/61/3) inalterada
- `scripts/catalog/cid-divergencias.json` -- `PENDENTE_sete_categorias_delta_extremo_sp`
  `bloqueiaUpload: false`, `resolvidoEm`/`resolvidoPor`, campo novo `residuoNaoBloqueante`
- `pipeline/sih/reports/reconciliacao-sc7.md` -- seção nova "Remedição pós-fix IDENT,
  2026-08-10" com a medição completa
- `.planning/phases/09-pipeline-confi-vel-coleta-completa/09-07-SUMMARY.md` -- nota tardia
  anexada avisando que `aggregate.py` foi amendado depois daquela SUMMARY
- `.planning/STATE.md` -- bloqueios abertos atualizados (este commit)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: operador aprovou contar só `IDENT='1'`
(renovação de AIH de longa permanência é faturamento continuado, não nova admissão); TDD RED
verificado isoladamente contra o código pré-fix antes de cada commit; gate AC/2019 mantido
exatamente na composição medida (34/61/3), sem afrouxar nem inventar explicação para o resíduo
de 3 categorias que o fix genuinamente não resolve nesta UF (mecanismo diferente).

## Deviations from Plan

Não há PLAN.md formal para este fix (brief avulso do coordenador) -- as "Rules" de desvio se
aplicam ao brief como espécie de plano implícito.

### Auto-fixed Issues

Nenhum bug/funcionalidade crítica faltante encontrado além do próprio objeto do fix. Um item
correlato foi descoberto durante a remedição e tratado por Rule 2 (documentação, não código):

**1. [Rule 2 - achado correlato, documentado] Fixture `rdac_2019.parquet` precisava ser
regenerada para incluir `IDENT`**
- **Encontrado durante:** verificação do RED -- `NEEDED_COLUMNS` original não incluía `IDENT`,
  então a fixture de gate commitada também não tinha essa coluna
- **Ação:** fixture regenerada a partir dos mesmos 12 arquivos reais de AC/2019 do 09-07,
  projetando `IDENT` também -- sem mudança de linhas (44.589 preservadas)
- **Verificação:** `test_aggregate.py`/`test_reconcile_gate.py`/`test_partitions.py`/
  `test_reconcile.py` (todos consumidores da fixture compartilhada) continuam verdes
- **Committed in:** `53b7323` (commit GREEN)

---

**Total deviations:** 1 (achado correlato necessário, documentado, dentro do fluxo GREEN)
**Impact on plan:** Nenhum impacto negativo -- necessário para o fix funcionar sobre dado real.

## Issues Encountered

- **SP/2019 não foi remedido por completo (113 pares do oráculo) neste fix** -- só as 7
  categorias designadas pela pendência B foram remedidas contra SP/2019, com o código real. É
  plausível que outras categorias de SP tenham alguma fração pequena de `IDENT='5'` reduzindo
  levemente seus deltas também (a baseline de `IDENT='5'` no dataset inteiro de SP é 2,7%,
  medida) -- não medido nesta rodada, registrado como item de acompanhamento honesto, não como
  conclusão. Não reabre nenhuma decisão do checkpoint do 09-11.

## User Setup Required

None -- nenhuma configuração de serviço externo necessária. Dados de AC/2019 e SP/2019 já
estavam em `~/.lacir/sih-cache/parquet/` (verificado antes de qualquer trabalho, nenhum
re-download disparado).

## Next Phase Readiness

- **09-10 deixa de estar bloqueado pelo SC-7.** As duas pendências (`PENDENTE_colisao_codigos_
  9_e_77` e `PENDENTE_sete_categorias_delta_extremo_sp`) têm `bloqueiaUpload: false` em
  `scripts/catalog/cid-divergencias.json`.
- `aggregate.py` pronto para a corrida completa (quando o bloqueio de disco do 09-04 for
  resolvido) -- o filtro `IDENT='1'` se aplica a qualquer parquet, não só à fixture de gate.
- Nenhuma pergunta deste fix precisa de novo checkpoint clínico do operador -- a decisão de
  contar só `IDENT='1'` já foi tomada e aprovada antes deste fix (brief do coordenador registra
  a rationale do operador); a remedição confirma que a decisão produz o resultado esperado.
- Resíduo não-bloqueante das 3 categorias em AC (`residuoNaoBloqueante` em
  `cid-divergencias.json`) fica disponível para quem eventualmente quiser investigá-lo -- não é
  responsabilidade de nenhuma plan futura hoje, mas está documentado para não se perder.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-10*

## Self-Check: PASSED

Todos os 8 arquivos listados em Files Created/Modified existem no disco (verificado com `[ -f ]`
em cada caminho); os 3 hashes de commit (`defa477`, `53b7323`, `dfcffed`) existem em
`git log --oneline --all`; `scripts/catalog/cid-divergencias.json` validado com `json.load` sem
erro (64 entradas); `uv run pytest` (122 passed, 1 skipped) e `npm run gate` verdes após cada
commit.
