---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 13
subsystem: catalog
tags: [postgrest, node, javascript, catalog, data-provenance, tdd, tax-06, d-19]

# Dependency graph
requires:
  - phase: 09-10
    provides: "sih_metric_uf em produção com o dataset completo (207.664 linhas, 331 agravos, dois locais) -- a fonte que este plano lê"
  - phase: 09-12
    provides: "sih_collection_status com derived_at/cid_map_version por (disease_id, medida, grão, local, ano) -- a fonte de proveniência que os packs herdam (DATA-04); cobertura auditada e aprovada pelo operador para os 10 agravos que este plano serve"
provides:
  - "Os 10 packs de public/data/catalog/packs/ regerados a partir de sih_metric_uf/sih_collection_status via PostgREST (chave anon), não mais do corpus TabNet de 654 CSVs (424 deles com 0 bytes)"
  - "generateSihPacks.mjs -- gerador único e reexecutável dos 10 packs, exports PACK_IDS/buildPack/main, paginação Range/content-range obrigatória"
  - "metricless-diseases.json vazio -- código 330 confirmado com dado real em sih_metric_uf"
  - "catalog:build volta a ser rodável (proibição do handoff 08-10 dissolvida por aposentadoria do corpus, não por re-chaveamento) -- consome os packs já gerados, não monta mais a partir de CSV"
  - "paths.mjs sem os 3 diretórios de corpus de coleta SIH em ALLOWED_PREFIXES/PACK_SOURCES -- corpusPath()/tombstones.mjs preservados"
  - "Achado real: paginação PostgREST sem order= explícito não é estável entre requisições -- reproduzido, corrigido no gerador, registrado como achado (não corrigido) para audit.py/upload.py"
affects: ["Fase 10 (se algum dia migrar Variáveis para o mesmo caminho de Storage/Supabase que Mapas -- hoje fora de escopo, ver 09-CONTEXT deferred)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildPack() pura (sem I/O) separada da orquestração de rede (fetchPackContext/main) -- testável offline com fixtures reconstruídas do pack já commitado, nunca tocando PostgREST em npm run gate (molde de loadMunicipioPartition.test.ts, D-09)"
    - "Paginação PostgREST com order= explícito sobre colunas de chave primária -- Range/content-range sozinhos não bastam para estabilidade entre requisições (achado real desta task, não só o Pitfall 13 já conhecido)"
    - "D-14 (zero verdadeiro vs ausência) implementado em JS: linha ausente + status coletado = 0; status falhou/nunca_tentado/sem entrada = null, nunca coagido"
    - "Colunas de fonte externa ao pipeline SIH-RD (CNES/população) congeladas do pack já commitado em vez de recolhidas -- D-19 aposenta o corpus de doença, não o CNES/SIDRA"
    - "generatedAt de manifest.json derivado do derivedAt dos packs (proveniência), nunca de Date.now() -- catalog:build precisa ser idempotente, um timestamp de parede quebraria isso"

key-files:
  created:
    - scripts/catalog/generateSihPacks.mjs
    - src/features/catalog/sihPacks.test.ts
  modified:
    - scripts/catalog/build.mjs
    - scripts/catalog/paths.mjs
    - scripts/catalog/metricless-diseases.json
    - public/data/catalog/packs/*.json (10 arquivos)
    - public/data/catalog/manifest.json
    - public/data/catalog/variables.json
    - src/features/catalog/catalogAnalysisData.test.ts
    - src/features/catalog/renameMigration.test.ts
    - src/routes/mapas/assembleHandoffTable.test.ts

key-decisions:
  - "[Achado real, Rule 1] Paginação PostgREST sem order= explícito não garante o mesmo corte de página entre duas requisições Range da mesma leitura -- uma linha pode sumir de uma página e reaparecer duplicada em outra com o total de content-range permanecendo idêntico. Reproduzido deterministicamente (a mesma chave ausente numa corrida, presente na seguinte, total sempre 3495). Corrigido com order=disease_id.asc,uf_codigo.asc,ano.asc (chave primária com local fixado pelo filtro) + guarda de chave duplicada que aborta alto. audit.py::_fetch_all_paginated e upload.py::recount_via_postgrest (Python, fora do file_scope desta plan) usam o MESMO padrão sem order= -- registrado como achado para o dono desses módulos, não corrigido aqui."
  - "[Achado real, Rule 1] sih_metric_uf.uf_nome está NULL em produção para toda linha (gap pré-existente de upload.py, fora do file_scope) -- nome por extenso restaurado por tabela estática local em vez de perdido silenciosamente."
  - "[Decisão de execução] Colunas de junção CNES/população (medicos_vasculares_sus/populacao/medicos_vasculares_por_100k) dos 2 packs legados (embolia, amputação) congeladas do pack já commitado, não recoletadas -- fonte alheia ao pipeline SIH-RD desta fase (CNES/SIDRA, não SIH-RD); D-19 aposenta só o corpus de doença (654 CSVs), nunca discutiu CNES/população."
  - "[Rule 1, deviation fora do file_scope original] catalogAnalysisData.test.ts e assembleHandoffTable.test.ts travavam internações SP/2019 de embolia em 5660 (valor TabNet-era) -- atualizados para 5709 (valor medido pós-substituição D-16, a mesma fonte que produziu os 207.664 linhas já em produção desde o 09-10)."
  - "[Rule 3, deviation fora do file_scope original] renameMigration.test.ts regenera a migração Fase 8 JÁ APLICADA em produção contra metricless-diseases.json -- esvaziar o arquivo vivo quebraria essa prova histórica. Corrigido congelando o snapshot de metricless-diseases.json no estado em que a migração foi gerada (mesma disciplina de rename-map.json/SCOPE_EXCLUDE_RELATIVE_PATHS, 08-06)."

patterns-established:
  - "Gerador de artefato remoto (PostgREST) com função pura de montagem separada da orquestração de rede -- suite de teste do artefato nunca precisa de credencial/rede, só do arquivo já commitado como fixture"

requirements-completed: [DATA-01, DATA-04]

# Metrics
duration: ~3h30min (inclui reprodução e correção de um bug real de paginação PostgREST, descoberto só porque o gerador foi rodado repetidamente contra produção)
completed: 2026-08-13
---

# Phase 9 Plan 13: Fechar o ciclo TAX-06 sobre o dado novo Summary

**Os 10 packs de Variáveis são regerados a partir de `sih_metric_uf`/`sih_collection_status` (PostgREST, chave anon) em vez do corpus TabNet de 654 CSVs, `catalog:build` volta a ser rodável, e uma instabilidade real de paginação PostgREST (linha some de uma página e reaparece duplicada em outra, mesmo total anunciado) foi reproduzida e corrigida antes de qualquer commit.**

## Performance

- **Duration:** ~3h30min (inclui investigação e correção de um bug real de paginação, várias corridas de verificação de idempotência contra produção)
- **Tasks:** 3/3 completas (Task 1 auto, Task 2 auto+TDD, Task 3 auto)
- **Files modified:** 16 (2 criados, 14 modificados — incluindo 10 packs + manifest.json/variables.json regenerados)

## Accomplishments

- **Inventário confirmado por grep** (Task 1): o único consumidor de runtime de `public/data/catalog/packs/` é `src/features/catalog/catalogAnalysisData.ts` (10 imports estáticos, intocado) + `catalogAnalysisData.test.ts`. `applyRenameMap.mjs`/`syncPackImports.mjs`/`collection-order.json` são ferramentas de build, não consumidores.
- **`generateSihPacks.mjs`**: lê `sih_metric_uf` (grão UF, local=ocorrência) e `sih_collection_status` (proveniência + regra D-14) via PostgREST paginado, monta os 10 packs com `buildPack()` pura, escreve atomicamente. `--dry-run` prova as 10 contagens sem escrever nada.
- **Os 10 packs regenerados contra produção real, duas vezes, com hash idêntico** (idempotência provada por 4 corridas consecutivas, não só uma) — ver tabela de variação abaixo.
- **`metricless-diseases.json` esvaziado** — confirmado por consulta real que o código 330 (`todas_as_outras_causas_externas`) tem linha em `sih_metric_uf`.
- **`sihPacks.test.ts`** (34 testes): prova offline de regeneração byte a byte (10 packs, reconstruídos do arquivo já commitado, nunca toca rede — molde `loadMunicipioPartition.test.ts`/D-09), cobertura 2013-2025×27 UFs, ausência de tombstone, `metricless-diseases.json` vazio, e os 3 estados de D-14 (`coletado`+ausente=0, `falhou`=null, sem status=null) com fixture sintética.
- **`catalog:build` repontado** (Task 3): consome os packs já gerados por `generateSihPacks.mjs` em vez de montar a partir de CSV — `catalog:build` volta a ser rodável (a proibição do handoff 08-10 se dissolve por aposentadoria do corpus, não por re-chaveamento). 3 corridas consecutivas produzem `manifest.json`/`variables.json` byte idênticos.
- **`paths.mjs` podado**: as 3 entradas de `ALLOWED_PREFIXES` do corpus de coleta SIH (654 CSVs multi-doença + os 2 diretórios legados de embolia/amputação), `multiPackSource()`, `LEGACY_PACKS` e o laço `PACK_SOURCES` removidos. `corpusPath()`/`corpusExists()` (leitor de `build/catalogos`, sem chamador hoje mas mantido por precaução textual do plano) e a guarda `assertNotTombstone`/`tombstones.mjs` (invariante da Fase 8, `noTombstoneLiterals.test.ts`) preservados intocados.
- **Achado real e corrigido antes do commit** (Rule 1, o mais significativo desta sessão): paginação PostgREST sem `order=` explícito não é estável entre requisições — uma linha pode sumir de uma página e reaparecer duplicada em outra, com o total anunciado em `content-range` permanecendo idêntico (a checagem de truncamento sozinha não pega isso). Reproduzido deterministicamente contra produção real (chave `infarto_cerebral|11|2013` ausente numa corrida, presente na seguinte, total sempre 3495 nas duas). Corrigido com `order=` explícito sobre a chave primária + guarda de chave duplicada que aborta alto. Ver "Deviations" e "Threat Flags" abaixo.

### Comparação antes/depois (internações no ano mais recente, 2025)

| Pack | Antes | Depois | Δ% | Linhas antes → depois |
|---|---:|---:|---:|---|
| embolia_e_trombose_arteriais | 24.673 | 26.546 | +7,59% | 351 → 351 |
| amputacao_mmii | 29.552 | 32.100 | +8,62% | 351 → 351 |
| acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem | 191.738 | 202.534 | +5,63% | 351 → 351 |
| flebite_tromboflebite_embolia_e_trombose_venosa | 48.076 | 50.016 | +4,04% | 351 → 351 |
| infarto_cerebral | 26.345 | 28.202 | +7,05% | 351 → 351 |
| laringite_e_traqueite_agudas | 6.428 | 6.558 | +2,02% | 351 → 351 |
| otite_media_e_outr_transt_ouvido_medio_apof_mast | 22.120 | 22.953 | +3,77% | 351 → 351 |
| outras_doencas_das_arterias_arteriolas_e_capilares | 34.745 | 37.416 | +7,69% | 350 → 351 |
| outras_doencas_do_olho_e_anexos | 40.276 | 41.916 | +4,07% | 351 → 351 |
| outras_doencas_vasculares_perifericas | 21.576 | 23.166 | +7,37% | 337 → 351 |

Todas as variações estão na mesma ordem de grandeza já explicada pela divergência de lote do SC-7 (`ANO_CMPT` vs `DT_INTER`, banda +3,7% a +21,1% já aceita em `cid-divergencias.json`) — nenhuma fora do esperado, nenhuma investigação adicional necessária. Os 3 packs que ganharam linhas (350→351, 337→351) fecham a cobertura da janela completa 2013-2025 que o corpus legado não tinha.

## Risco didático das 8 categorias de causa externa (09-12) — verificado, não aplicável a estes 10 packs

Conferido explicitamente contra a lista registrada em `pipeline/sih/reports/cobertura-final.md` §6.2 (Grupo A: `acidentes_de_transporte`, `afogamento_e_submersao_acidentamente`, `agressoes`, `envenenamento_intox_exposicao_substancias_nocivas`, `exposicao_ao_fumo_ao_fogo_e_as_chamas`, `lesoes_autoprovocadas_voluntariamente`, `quedas`, `todas_as_outras_causas_externas`): **nenhum dos 10 disease_id servidos pelos packs desta plan está nessa lista.** Nenhuma ação de metadado adicional foi necessária nos packs. Registrado aqui explicitamente, conforme pedido, para que a ausência de tratamento não seja lida como omissão.

## Task Commits

1. **Task 1: `generateSihPacks.mjs` — gerador dos 10 packs a partir da fonte servida** — `e631e2f` (feat)
2. **Task 2: packs regenerados, `sihPacks.test.ts`, `metricless-diseases.json` vazio, fix de paginação + testes downstream** — `03ef66a` (feat)
3. **Task 3: `catalog:build` consome os packs gerados, corpus legado sai do caminho de build** — `9a8651e` (feat)

**Plan metadata:** (este commit — `docs: complete plan`)

## Files Created/Modified

- `scripts/catalog/generateSihPacks.mjs` — `PACK_IDS`, `fetchAllPaginated`, `buildPack`, `main` (contrato do subcomando `catalog:sih-packs`, já declarado pelo `09-02`)
- `src/features/catalog/sihPacks.test.ts` — 34 testes, prova offline de regeneração + os 6 comportamentos declarados
- `scripts/catalog/build.mjs` — repontado para ler os packs já gerados; URLs oficiais TabNet/CNES/SIDRA centralizadas; `generatedAt` derivado do `derivedAt` dos packs
- `scripts/catalog/paths.mjs` — `ALLOWED_PREFIXES`/`multiPackSource`/`LEGACY_PACKS`/laço `PACK_SOURCES` do corpus removidos; `corpusPath`/`corpusExists`/guarda de tombstone preservados
- `scripts/catalog/metricless-diseases.json` — `[]`
- `public/data/catalog/packs/*.json` (10 arquivos) — conteúdo regerado da fonte servida
- `public/data/catalog/manifest.json`, `public/data/catalog/variables.json` — regerados por `catalog:build`
- `src/features/catalog/catalogAnalysisData.test.ts`, `src/routes/mapas/assembleHandoffTable.test.ts` — valor hardcoded de internações SP/2019 atualizado de 5660 (TabNet-era) para 5709 (medido pós-D-16)
- `src/features/catalog/renameMigration.test.ts` — `loadMetricless()` congelado no snapshot histórico de `metricless-diseases.json` (a migração Fase 8 já aplicada em produção não pode reivindicar conteúdo diferente do que tinha quando foi gerada)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: (1) achado real de instabilidade de paginação PostgREST corrigido com `order=` explícito, registrado como achado não corrigido para `audit.py`/`upload.py`; (2) `uf_nome` NULL em produção coberto por tabela estática local; (3) colunas CNES/população dos 2 packs legados congeladas (fonte alheia a esta fase); (4) dois testes com valor hardcoded desatualizado corrigidos para o dado real novo; (5) `renameMigration.test.ts` congelado contra o estado histórico de `metricless-diseases.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug real, achado nesta sessão] Paginação PostgREST instável entre requisições sem `order=` explícito**
- **Found during:** Task 2, verificação de idempotência (rodar o gerador duas vezes deveria produzir bytes idênticos — não produzia, para 8 dos 10 packs)
- **Issue:** Sem `order=` explícito, o Postgres/PostgREST não garante o mesmo corte de página entre duas requisições `Range` da mesma leitura paginada — uma linha pode sumir de uma página e reaparecer duplicada em outra, com o total anunciado em `content-range` permanecendo idêntico nas duas corridas (a checagem "total lido == total anunciado", que já existia, não detecta isso, porque ela também bate nas duas corridas). Reproduzido de forma determinística e isolada: a chave `infarto_cerebral|11|2013` ficava ausente do resultado numa chamada e presente na seguinte, sempre com 3495 linhas totais nas duas.
- **Fix:** `order=disease_id.asc,uf_codigo.asc,ano.asc` (para `sih_metric_uf`) / `order=disease_id.asc,medida.asc,ano.asc` (para `sih_collection_status`) — as colunas da chave primária com a dimensão fixada pelo filtro (`local`/`grao`), formando ordem total sem empate. Guarda adicional: `metricRowsByUfAno` levanta erro alto se encontrar chave duplicada (defesa em profundidade, mesmo que a causa raiz — falta de `order=` — já esteja corrigida).
- **Files modified:** `scripts/catalog/generateSihPacks.mjs`
- **Verification:** 8 fetches consecutivos isolados com a chave suspeita, todos idênticos; 4 corridas completas do gerador, hash idêntico dos 10 arquivos em todas.
- **Committed in:** `03ef66a`
- **Nota para os donos de `audit.py`/`upload.py` (fora do `file_scope` desta plan, não corrigido):** `_fetch_all_paginated` (audit.py) e `recount_via_postgrest` (upload.py) usam o MESMO padrão de paginação sem `order=` explícito. Como ambos leem tabelas MUITO maiores (`sih_collection_status` 67.120 linhas, `sih_metric_uf` 207.664 linhas) com muito mais páginas que o caso de 10 disease_id/3495 linhas medido aqui, a superfície para o mesmo defeito é maior lá, não menor. Registrado aqui como achado explícito para quem for revisar esses dois módulos.

**2. [Rule 1 - Bug pré-existente, fora da origem de escrita] `sih_metric_uf.uf_nome` NULL em produção**
- **Found during:** Task 2, primeira geração real (todos os 10 packs saíram com `uf_nome: null`)
- **Issue:** `upload.py` nunca escreveu `uf_nome` em `sih_metric_uf` — a coluna existe no schema mas está NULL para toda linha, confirmado por consulta direta. Os packs legados (pré-regeneração) tinham nome por extenso porque vinha do corpus CSV antigo, não da fonte nova.
- **Fix:** Tabela estática local `UF_NOME` (sigla → nome IBGE) em `generateSihPacks.mjs`, mesmo nível de "dado literal" que `enumerate.py::UFS` já usa no pipeline Python — sem depender da coluna quebrada.
- **Files modified:** `scripts/catalog/generateSihPacks.mjs`
- **Verification:** `uf_nome: "São Paulo"` presente nos 10 packs regenerados; `upload.py` não tocado (fora do `file_scope`).
- **Committed in:** `03ef66a`

**3. [Rule 1 - Deviation fora do `files_modified` original, causada diretamente pelo dado novo] Valor hardcoded desatualizado em dois testes downstream**
- **Found during:** Task 2, `npm run gate` após regenerar os packs (2 falhas)
- **Issue:** `catalogAnalysisData.test.ts` e `assembleHandoffTable.test.ts` travavam internações de embolia SP/2019 em `5660` (o valor do corpus TabNet legado). O valor real medido pós-substituição D-16 (a mesma fonte que já está em produção desde o `09-10`) é `5709` — a diferença é o próprio objetivo desta fase (trocar a fonte), não um bug de leitura.
- **Fix:** Ambos os testes atualizados para `5709`, com comentário explicando a origem da mudança.
- **Files modified:** `src/features/catalog/catalogAnalysisData.test.ts`, `src/routes/mapas/assembleHandoffTable.test.ts`
- **Verification:** `npx vitest run` — 830/830 verde.
- **Committed in:** `03ef66a`

**4. [Rule 3 - Blocking, fora do `files_modified` original] `renameMigration.test.ts` regenerava a migração Fase 8 já aplicada contra o `metricless-diseases.json` VIVO**
- **Found during:** Task 2, esvaziar `metricless-diseases.json` (ação explícita do plano)
- **Issue:** `renameMigration.test.ts` (Fase 8, D-01/D-03/D-04/D-05/D-25) regenera em memória `supabase/migrations/20260804020000_rename_disease_ids.sql` + rollback + verify — arquivos JÁ APLICADOS em produção (08-10) — e compara byte a byte contra o que está commitado. Esses três arquivos foram gerados quando `metricless-diseases.json` tinha 1 entrada (código 330); esvaziá-lo quebrou 3 testes porque a regeneração passou a divergir do SQL histórico.
- **Fix:** `loadMetricless()` em `renameMigration.test.ts` passou a devolver um snapshot CONGELADO (o conteúdo de `metricless-diseases.json` no momento em que a migração foi gerada), em vez de ler o arquivo vivo — mesma disciplina de `rename-map.json`/`SCOPE_EXCLUDE_RELATIVE_PATHS` (08-06 SUMMARY): os três arquivos SQL são fato histórico imutável, não podem reivindicar conteúdo diferente do que realmente rodou contra produção.
- **Files modified:** `src/features/catalog/renameMigration.test.ts`
- **Verification:** `npx vitest run src/features/catalog/renameMigration.test.ts` — 12/12 verde.
- **Committed in:** `03ef66a`

---

**Total deviations:** 4 auto-corrigidas (2 Rule 1 bugs reais descobertos nesta sessão, 1 Rule 1 de teste desatualizado pela mudança de fonte, 1 Rule 3 de teste bloqueado por uma dependência entre fases não antecipada no `file_scope`). Nenhuma fora do que os achados genuínos desta própria execução exigiam — as duas últimas tocam arquivos fora do `files_modified` original da plan, documentadas explicitamente por serem consequência direta e inevitável da troca de fonte que é o próprio objetivo desta plan.

## Issues Encountered

- **A investigação da instabilidade de paginação consumiu a maior parte do tempo desta sessão** — o sintoma inicial (packs diferentes entre duas corridas, `git diff` contra `HEAD` sempre grande demais para interpretar) exigiu isolar a causa com testes diretos e repetidos contra produção real (não simulável localmente) antes de identificar que o total de `content-range` permanecia idêntico enquanto o CONTEÚDO das páginas mudava — a forma mais traiçoeira do Pitfall 13, porque a checagem de truncamento já existente não a detecta.

## User Setup Required

Nenhum novo. `.env.local` (já existente, `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) cobriu toda a execução — lido por um parser local em `generateSihPacks.mjs`, nunca impresso.

## Next Phase Readiness

- **TAX-06/D-19 fechados**: os 10 packs são gerados, nunca escritos à mão, com teste que prova a regeneração e impede edição manual.
- **DATA-04 fechado**: todo pack carrega `derivedAt`/`cidMapVersion`, os mesmos valores que `sih_collection_status` carrega para aquele agravo.
- **`catalog:build` desbloqueado**: a proibição do handoff 08-10 está formalmente dissolvida — qualquer plano futuro pode rodá-lo sem checkpoint.
- **Achado aberto, não bloqueante, para quem revisar `audit.py`/`upload.py`** (Python, fora do `file_scope` desta plan): ambos paginam PostgREST sem `order=` explícito, o mesmo padrão que se provou instável aqui. Não há evidência de que já tenha produzido um número errado em produção (os totais sempre bateram, e as decisões tomadas com base neles — cobertura aprovada, 09-12 — foram medidas mais de uma vez com resultado consistente), mas a exposição existe e cresce com o tamanho da tabela paginada.
- **09-14 permanece o único plano pendente da fase** — nenhuma mudança de bloqueio desta plan quanto a ele.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-13*

## Self-Check: PASSED

Todos os 11 arquivos citados (`generateSihPacks.mjs`, `sihPacks.test.ts`, `build.mjs`, `paths.mjs`,
`metricless-diseases.json`, um pack de amostra, `manifest.json`, `variables.json`,
`catalogAnalysisData.test.ts`, `renameMigration.test.ts`, `assembleHandoffTable.test.ts`) existem
no disco; os 3 hashes de commit (`e631e2f`, `03ef66a`, `9a8651e`) existem em
`git log --oneline --all`. `npm run gate` verde após cada um dos 3 commits (109 arquivos de teste
frontend / 830 testes; suíte Python completa; build).
