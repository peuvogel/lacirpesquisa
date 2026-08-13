---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 10
subsystem: database
tags: [python, psycopg, postgres, copy, supabase, postgrest, storage, sql-codegen, production]

# Dependency graph
requires:
  - phase: 09-01
    provides: ".env.pipeline com SIH_PIPELINE_DB_URL (Session Pooler) — credencial usada pela corrida real"
  - phase: 09-03
    provides: "schema v3 em produção (sih_metric_uf com local, sih_collection_status com o check de proveniência)"
  - phase: 09-04
    provides: "a corrida completa de coleta (27/27 UFs agregado_reciclado, MA retomado, guarda de trava resolvida) — o gate que deferiu esta execução"
  - phase: 09-06
    provides: "a restrição de ORDEM (população só depois de sih_metric_muni evacuada) — codificada em _assert_municipio_evacuado, agora PROVADA contra produção real"
  - phase: 09-09
    provides: "partitions.py::build_partition/upload_partition — reaproveitados sem alteração para subir as 27 partições reais ao Storage"
  - phase: 09-11
    provides: "scripts/catalog/cid-divergencias.json aprovado — a fonte de divergencia_pct/divergencia_razao gravada em sih_collection_status"
provides:
  - "A substituição real do D-16 executada e provada contra produção: sih_metric_uf trocou de 30.313 linhas TabNet para 207.131 linhas de microdado (330 agravos, os dois locais), numa transação atômica, com sih-swap-contagens.sql saindo 0 (5 blocos RAISE EXCEPTION, nenhum disparou)"
  - "sih_collection_status populado pela primeira vez em produção: 33.456 linhas 'coletado', todas com derived_at/cid_map_version não nulos — PIPE-02/DATA-04 passam a ser fatos observáveis, não só código testado"
  - "As 27 partições de município (D-20) geradas com dado real e enviadas ao bucket sih-municipio pela primeira vez em produção — 130,31 MB total, SP (maior) em 19,26 MB, 2,6x sob o teto de 50 MB/objeto; leitura anônima provada (200), escrita anônima recusada (403 RLS). sih_metric_muni NÃO foi removido do banco — essa remoção é do 09-14, fora do escopo desta plan"
  - "A restrição de ORDEM do 09-06 provada ao vivo, não só em teste local: swap() para sih_population_total_uf contra produção real levantou RuntimeError citando sih_metric_muni, porque a tabela ainda existe — população continua estruturalmente bloqueada até o 09-14 rodar"
  - "Dois bugs reais encontrados e corrigidos durante a própria execução: main() nunca escrevia sih_collection_status (Rule 1), e a primeira correção usava INSERT por linha, medido em 35+ minutos sem terminar contra produção — reescrita para COPY em lote (Rule 3)"
affects: [09-12, 09-13, 09-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_persistir_collection_status segue o MESMO padrão de copy_to_staging: COPY em lote para uma tabela de staging descartável, seguido de UM INSERT...SELECT...ON CONFLICT — nunca um INSERT por linha contra uma conexão pooled remota (medido ao vivo: ~33 mil round-trips síncronos levaria 35+ minutos; o COPY em lote fechou a mesma carga em segundos)"
    - "Upsert idempotente pela PK real (disease_id, medida, grao, local, ano) em sih_collection_status — uma segunda corrida completa regrava exatamente as mesmas linhas, só atualizando derived_at/cid_map_version/row_count para os valores da corrida mais recente (PIPE-03/SC-3, provado 3x contra produção real: 207.131 idêntico nas três execuções)"
    - "'Evacuar para o Storage' (D-20) e 'aposentar do banco' são dois passos DIFERENTES e intencionalmente desacoplados: esta plan completou o primeiro (upload real das 27 partições, usando partitions.py sem modificá-lo) para preparar o segundo (DROP de sih_metric_muni, exclusivo do 09-14, que exige a migração gerada declarada em seus próprios files_modified)"

key-files:
  created: []
  modified:
    - pipeline/sih/src/sih_pipeline/upload.py
    - pipeline/sih/tests/test_upload.py
    - scripts/catalog/generateSihSwapVerify.mjs
    - supabase/verify/sih-swap-contagens.sql
    - src/features/catalog/sihSwapVerify.test.ts

key-decisions:
  - "Execução real autorizada pelo operador (2026-08-12): a coleta fechou 27/27 UFs agregado_reciclado, 0 falhou, e a partição de SP (o último pressuposto aberto do 09-09, antes só projetada em 15,2–20,5 MB) foi medida de verdade em 19,26 MB antes da substituição — dentro da faixa projetada e 2,6x sob o teto de 50 MB/objeto confirmado ao vivo pelo 09-09."
  - "Escopo de Task 3 confirmado pela LEITURA do próprio upload.py, não pela interpretação: main() explicitamente recusa qualquer --tabela diferente de sih_metric_uf ('ainda não tem carga implementada nesta plan'). A carga de população fica fora do escopo desta plan por desenho, não por omissão — só a validação de ordem (_assert_municipio_evacuado) precisa estar pronta e provada, o que esta execução fez."
  - "'Evacuar município para o Storage' executado como upload real das 27 partições (dado + rede), reaproveitando partitions.py inalterado — NÃO como DROP TABLE sih_metric_muni, que pertence exclusivamente ao 09-14 (arquivos de migração próprios, gate [BLOCKING] com pré-condição de paridade de contagem, ainda não construídos). sih_metric_muni permanece em produção (1.099.403 linhas, 319 MB) até o 09-14 rodar."
  - "[Rule 1 - Bug] main() nunca chamava build_collection_status_rows, apesar de a função existir e ser testada desde a Task 2 — a primeira corrida real (207.131 linhas de sih_metric_uf) deixou sih_collection_status vazia, o que teria feito a prova (3) do verify (nenhuma linha órfã da fonte TabNet) falhar para TODAS as 207.131 linhas. Corrigido com _persistir_collection_status, chamada logo após swap()."
  - "[Rule 3 - Blocking] A primeira versão do fix escrevia sih_collection_status com um INSERT...ON CONFLICT por linha — medido ao vivo contra produção: mais de 35 minutos sem terminar para ~33 mil linhas (round-trip síncrono pelo Session Pooler por linha). Interrompido (kill limpo, nada commitado — a escrita inteira vivia numa transação aberta) e reescrito para COPY em lote + um único INSERT...SELECT, no mesmo padrão de copy_to_staging. A segunda tentativa real completou em ~3m29s."
  - "amputacao_mmii (o único agravo com filterKind='procedimento', não 'lista_morb') aparece como órfão na consulta de inspeção final do verify — achado esperado, não um defeito desta execução: é uma exceção documentada desde a Fase 8 (extra-diseases.json/09-PATTERNS.md), fora da Lista Morb CID-10 que matcher.py cobre. 330/331 agravos têm dado; o 331º precisaria de um matcher por código de procedimento, fora do escopo do matcher CID-based construído nesta fase."

patterns-established:
  - "Ordem real de execução do D-16 provada, não só documentada: copy_to_staging -> swap -> _persistir_collection_status -> recount_via_postgrest -> só se conferir -> release_cache, medida 3x contra produção com resultado idêntico"
  - "Restrição de ORDEM entre município e população verificada tanto em teste local (Docker) quanto ao vivo contra o catálogo real de produção — as duas provas guardadas, nenhuma delas dispensando a outra"

requirements-completed: [PIPE-02, PIPE-03, PIPE-04, DATA-01, DATA-04]

# Metrics
duration: ~1h35min (inclui uma tentativa de escrita de sih_collection_status que ficou presa por 35+ min e foi interrompida/corrigida antes de prosseguir)
completed: 2026-08-12
---

# Phase 9 Plan 10: Substituição atômica de produção (D-16) executada e provada Summary

**`sih_metric_uf` trocou de 30.313 linhas TabNet para 207.131 linhas de microdado real (330 agravos, os dois locais) numa transação atômica contra o Supabase de produção, com `sih_collection_status` populado pela primeira vez (33.456 linhas de proveniência), as 27 partições de município reais enviadas ao Storage, e a restrição de ordem população-após-município provada ao vivo — dois bugs reais (proveniência nunca escrita, depois lenta demais) encontrados e corrigidos durante a própria execução.**

## Performance

- **Duration:** ~1h35min de relógio (inclui uma tentativa de `INSERT` por linha que ficou presa por 35+ minutos, interrompida e corrigida)
- **Tasks:** 1/1 (Task 3 do 09-10 — Tasks 1 e 2 já estavam completas e commitadas de sessão anterior)
- **Files modified:** 5 (`upload.py`, `test_upload.py`, `generateSihSwapVerify.mjs`, `sih-swap-contagens.sql`, `sihSwapVerify.test.ts`)

## Accomplishments

- **Grão município evacuado para o Storage (D-20, preparação)**: as 27 partições reais geradas e enviadas ao bucket `sih-municipio` (só AC existia de uma medição anterior) — 130,31 MB total, SP (maior) em 19,26 MB (2,6x sob o teto de 50 MB/objeto), leitura anônima confirmada (200) e escrita anônima recusada (403, RLS default-deny sobre `storage.objects`). `sih_metric_muni` continua no banco — a remoção da tabela é exclusiva do `09-14`.
- **A substituição real do D-16 executada**: `upload.py` copiou 207.131 linhas para staging, o `swap` trocou `sih_metric_uf` atomicamente (TRUNCATE+INSERT+DROP numa transação), e `recount_via_postgrest` releu exatamente 207.131 linhas via PostgREST paginado — nem uma a mais, nem a menos. Confirmado de forma independente por consulta direta: 103.353 `ocorrencia` + 103.778 `residencia` = 207.131.
- **`sih_collection_status` populado pela primeira vez em produção**: 33.456 linhas `coletado`, todas com `derived_at`/`cid_map_version` não nulos, um único `cid_map_version` na corrida inteira (consistência interna provada por consulta).
- **`sih-swap-contagens.sql` rodou contra produção real e saiu 0**: os cinco blocos `RAISE EXCEPTION` não dispararam. `ESPERADO_SIH_METRIC_UF`/`CID_MAP_VERSION_DA_CORRIDA` deixaram de ser `null` e passaram a carregar os valores medidos, regenerados a partir do gerador (nunca escritos à mão).
- **Leitura/escrita anônima provada pelo caminho real do app (PostgREST)**: `GET` em `sih_metric_uf`/`sih_collection_status` devolve 200; `POST` devolve 401; `PATCH`/`DELETE` com filtro real devolvem 204 mas **zero linhas afetadas** (confirmado por contagem direta pós-tentativa) — só existe policy de `SELECT` para `anon`/`authenticated`.
- **Restrição de ORDEM do 09-06 provada AO VIVO, não só em teste local**: `swap(conn, 'sih_population_total_uf')` contra produção real levantou `RuntimeError` citando `sih_metric_muni` — a tabela população continua estruturalmente inalcançável até o `09-14` evacuar o município do banco.
- **Dois bugs reais encontrados e corrigidos durante a própria execução** (ver Deviations): `main()` nunca escrevia `sih_collection_status`, e a primeira correção era lenta demais para uma conexão pooled remota.

## Task Commits

1. **Fix (Rule 1): `main()` passa a persistir `sih_collection_status` após o swap** — `7bfb559` (fix)
2. **Fix (Rule 3): `_persistir_collection_status` reescrita para COPY em lote, não `INSERT` por linha** — `91036d5` (fix)
3. **Task 3: verify preenchido com os valores medidos na corrida real** — `26196cb` (feat)

**Plan metadata:** (este commit — `docs: complete plan`)

_Nota: Tasks 1 e 2 do 09-10 (commits `a0b8362`/`685a91b`, sessão anterior) e o mecanismo de Task 3
(`generateSihSwapVerify.mjs`/`sih-swap-contagens.sql`/`sihSwapVerify.test.ts` com defaults `null`,
commit `f4e8a77`, mesma sessão anterior) não foram refeitos — só a execução real, gated até a
coleta completar, rodou nesta sessão, junto dos dois bugs que essa execução real revelou._

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/upload.py` — `_persistir_collection_status` nova (COPY em lote +
  upsert), chamada em `main()` logo após `swap()`
- `pipeline/sih/tests/test_upload.py` — teste de ordem de chamadas (`main()` chama
  `_persistir_collection_status` entre `swap` e `recount_via_postgrest`) e teste contra Postgres
  local (Docker) provando upsert idempotente pela PK real
- `scripts/catalog/generateSihSwapVerify.mjs` — `ESPERADO_SIH_METRIC_UF=207131`,
  `CID_MAP_VERSION_DA_CORRIDA` preenchido com o hash medido
- `supabase/verify/sih-swap-contagens.sql` — regenerado a partir do gerador, nunca editado à mão
- `src/features/catalog/sihSwapVerify.test.ts` — as duas asserções que travavam as constantes em
  `null` atualizadas para os valores reais medidos (mesma disciplina do `VERIFY_COUNTS` da Fase 8)

## Decisões medidas nesta execução (números reais, nunca estimados)

| Prova | Esperado/contexto | Medido |
|---|---|---|
| Coleta completa antes de substituir | 27/27 UFs `agregado_reciclado`, 0 `falhou` | **27/27, 0 falhou** (confirmado antes de iniciar) |
| Partição SP (D-21, item de acompanhamento do 09-09) | projetada 15,2–20,5 MB | **19,26 MB** (1.747.786 linhas, dentro da faixa) |
| 27 partições no Storage | teto 50 MB/objeto | **130,31 MB total, maior=SP 19,26 MB** (2,6x sob o teto) |
| `sih_metric_uf` antes → depois | TabNet legado → microdado | **30.313 → 207.131** |
| `sih_metric_uf` por `local` | ocorrencia + residencia | **103.353 + 103.778 = 207.131** |
| Diferença de agravos no `sih_metric_uf` | 331 na taxonomia | **330 com dado** (`amputacao_mmii`, `filterKind=procedimento`, fora do escopo do matcher CID) |
| `sih_collection_status` | vazia antes | **33.456 linhas `coletado`, 0 sem `derived_at`/`cid_map_version`** |
| `sih-swap-contagens.sql` contra produção | 5 `RAISE EXCEPTION` | **exit 0, nenhum disparou** |
| Tempo de parede — `COPY`+`swap`+recount (sih_metric_uf) | — | **~3min5s** (primeira corrida completa) |
| Tempo de parede — `_persistir_collection_status` (versão COPY em lote) | — | **~3min29s para o ciclo inteiro** (`copy`+`swap`+`persist`+`recount`+`release_cache`) |
| Tempo de parede — `_persistir_collection_status` (versão `INSERT` por linha, ABANDONADA) | — | **35+ min sem terminar** (interrompida) |
| `sih_metric_muni` | inalterado, aguardando 09-14 | **1.099.403 linhas, 319 MB, intocado** |
| Tamanho do banco | teto 500 MB | **336 MB → 404 MB** (headroom de ~96 MB antes de o 09-14 liberar 319 MB) |
| Restrição de ordem população/município | deve recusar | **`RuntimeError` real, citando `sih_metric_muni`, confirmado ao vivo** |
| Escrita anônima (PostgREST) | deve ser recusada | **POST 401; PATCH/DELETE 204 mas 0 linhas afetadas (RLS)** |
| Escrita anônima (Storage) | deve ser recusada | **PUT/POST 403 (RLS `storage.objects`)** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `main()` nunca chamava `build_collection_status_rows` — `sih_collection_status` ficaria vazia após o swap real**
- **Found during:** execução real da Task 3, logo após a primeira corrida completa de `sih_metric_uf` (207.131 linhas copiadas, swap bem-sucedido, `recount_via_postgrest` confirmando 207.131)
- **Issue:** `build_collection_status_rows` existia e era testada isoladamente desde a Task 2 (sessão anterior), mas `main()` nunca a invocava. A prova (3) de `sih-swap-contagens.sql` — nenhuma linha de `sih_metric_uf` sem entrada `coletado` correspondente em `sih_collection_status` com o `cid_map_version` da corrida — teria falhado para as 207.131 linhas inteiras, porque a tabela de proveniência estava vazia.
- **Fix:** `_persistir_collection_status` nova, chamada em `main()` logo após `swap()` e antes de `recount_via_postgrest` — calcula `derived_at`/`cid_map_version` uma vez para a corrida inteira e escreve uma linha por `(disease_id, medida, grao, local, ano)` presente em `linhas`.
- **Files modified:** `pipeline/sih/src/sih_pipeline/upload.py`, `pipeline/sih/tests/test_upload.py`
- **Verification:** Suíte Python inteira verde (169 testes); teste de ordem de chamadas provando que `_persistir_collection_status` roda entre `swap` e `recount_via_postgrest`; teste contra Postgres local (Docker) provando escrita + upsert idempotente pela PK real.
- **Committed in:** `7bfb559`

**2. [Rule 3 - Blocking] Primeira versão de `_persistir_collection_status` fazia `INSERT` por linha — medido em 35+ minutos sem terminar contra produção**
- **Found during:** execução real da Task 3, ao rodar `upload.py` com o fix do item 1 contra produção (não em teste — o teste Docker local não expôs o problema porque a fixture é pequena)
- **Issue:** A implementação inicial fazia um `INSERT ... ON CONFLICT` por linha dentro de um laço Python, contra a conexão Session Pooler (pooled, latência de rede por round-trip). Para as ~33.456 linhas reais da corrida completa (13 anos × 330 agravos × 2 locais × 4 medidas, filtrado pelas combinações com dado), a transação ficou aberta por mais de 35 minutos sem terminar — medido ao vivo via `pg_stat_activity` (`duracao_transacao`). Interrompido (`kill`) antes de comprometer mais tempo de sessão; seguro porque nada tinha sido commitado (a escrita inteira vivia numa única transação aberta — confirmado por `sih_collection_status` voltando a 0 linhas após o kill).
- **Fix:** Reescrito para o mesmo padrão de `copy_to_staging`: `COPY` em lote para uma tabela de staging descartável (`sih_collection_status_staging`), seguido de UM `INSERT ... SELECT ... ON CONFLICT` só, depois `DROP` da staging — mesma lição que já levou `sih_metric_uf` a usar `COPY` em vez de milhões de `INSERT` via HTTP (D-17).
- **Files modified:** `pipeline/sih/src/sih_pipeline/upload.py`
- **Verification:** Suíte Python inteira verde; a segunda corrida real completou o ciclo inteiro (`copy`+`swap`+`persist`+`recount`+`release_cache`) em ~3min29s, escrevendo as 33.456 linhas corretamente (confirmado por consulta direta e pelo verify passando).
- **Committed in:** `91036d5`

---

**3. [Rule 1 - Bug] `state.update-progress`/`state.add-decision`/`state.record-session` do SDK sobrescrevem `progress` do `STATE.md` com contagem que inclui SUMMARYs ad-hoc sem `PLAN.md`, e um segundo agravante (fase 9 tratada como "completa" por `summaryCount >= planCount`)**
- **Found during:** `state_updates` (passo final da execução, depois do self-check) — mesma classe de bug que a sessão anterior do `09-10` já tinha registrado para `roadmap.update-plan-progress`, mas manifestando num lugar diferente (o bloco `progress` do frontmatter de `STATE.md`, computado por `buildStateFrontmatter`/`syncStateFrontmatter` em `$HOME/.claude/get-shit-done/bin/lib/state.cjs` — fora deste repositório, fora de qualquer `file_scope` desta plan)
- **Issue:** Toda escrita em `STATE.md` via `gsd-sdk query state.*` resincroniza `progress.*` a partir de uma varredura de disco que soma `summaryCount` por fase incluindo `*-SUMMARY.md` sem `*-PLAN.md` correspondente (`09-04-COLETA-INCREMENTAL`, `09-04-GUARDA-TRAVAMENTO`, `09-07-IDENT-FIX`, `09-08-INVESTIGACAO`, `09-09-ADAPTACAO-AGREGADOS`, `09-09-FIX-RESIDENCIA`) — e trata uma fase como `completed` quando `summaryCount >= planCount`, o que classificou erroneamente a Fase 9 como concluída (16 summaries ≥ 14 plans) mesmo com `09-12`/`09-13`/`09-14` genuinamente pendentes. `total_plans`/`completed_plans`/`completed_phases`/`percent` ficaram incoerentes entre si (`completed_plans: 33 > total_plans: 31`, `percent` oscilando entre 50% e 100% dependendo de qual comando escreveu por último — `computeProgressPercent` usa `min(fração_de_planos, fração_de_fases)`, então os dois numeradores inflados produzem resultados diferentes conforme o caminho de código).
- **Fix:** Corrigido manualmente para os números reais, computados por leitura direta do disco (não por um segundo comando do SDK, que sofreria do mesmo defeito): `total_phases=6`/`completed_phases=2` (só Fases 7 e 8 estão de fato `[x]` no `ROADMAP.md`), `total_plans=31`/`completed_plans=27` (soma de `PLAN.md` com `SUMMARY.md` correspondente nas Fases 7+8+9, excluindo os 6 SUMMARYs ad-hoc), `percent=33` (`min(27/31, 2/6)*100`, arredondado). Aplicado como a ÚLTIMA edição em `STATE.md` nesta sessão — nenhum comando `gsd-sdk query state.*` roda depois, então a correção não é revertida pelo mesmo resync.
- **Files modified:** `.planning/STATE.md` (só o bloco `progress` do frontmatter — o mesmo defeito em `$HOME/.claude/get-shit-done/bin/lib/state.cjs` não foi tocado, está fora deste repositório)
- **Verification:** `grep -A5 '^progress:' .planning/STATE.md` confirma os cinco números coerentes entre si (`completed_plans <= total_plans`, `completed_phases <= total_phases`); `ROADMAP.md` linha 24 e a tabela de progresso confirmam Fase 9 como `[ ]`/`In Progress`, não `[x]`/`Complete`.
- **Committed in:** este commit (SUMMARY + STATE.md + ROADMAP.md)

---

**Total deviations:** 3 auto-fixed (1 bug de correção — Rule 1; 1 bloqueante de desempenho — Rule 3; 1 bug de contagem no harness de execução — Rule 1, mesma classe já registrada pela sessão anterior para `ROADMAP.md`, agora também em `STATE.md`). Os dois primeiros foram encontrados pela própria execução real contra produção, não haviam sido expostos pelo ensaio local da sessão anterior (fixtures pequenas não revelam custo de round-trip por linha).
**Impact on plan:** Os dois primeiros fixes eram necessários para a Task 3 completar de fato — sem o primeiro, o verify falharia estruturalmente (207.131 linhas órfãs); sem o segundo, a corrida não terminaria em tempo hábil de sessão. O terceiro corrige um falso "Fase 9 completa"/contagem incoerente que teria enganado a próxima sessão sobre o estado real da fase (mesmo padrão de cautela do `09-10-SUMMARY.md` anterior). Nenhum escopo além do que a própria Task 3 já exigia (persistir `sih_collection_status`, provado pela prova 3 do verify que a sessão anterior já tinha escrito) mais o protocolo padrão de `state_updates`.

## Issues Encountered

- **`amputacao_mmii` órfão de `sih_metric_uf`** (achado pela query de inspeção final do verify, não um erro): é o único agravo com `filterKind: "procedimento"` (330 dos 331 são `lista_morb`) — uma exceção documentada desde a Fase 8 (`extra-diseases.json`, citada em `09-PATTERNS.md`), fora da Lista Morb CID-10 que `matcher.py` cobre. Não é um defeito desta execução nem desta fase; ficaria fora do `file_scope` mesmo se fosse (exigiria um matcher por código de procedimento em `matcher.py`, dono `09-07`). Registrado para decisão futura.
- **`supabase db query --linked -f` não usado** — mesmo bloqueio já documentado desde o `09-03`/`STATE.md` (sem `SUPABASE_ACCESS_TOKEN`). Usado `psql "$SIH_PIPELINE_DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/verify/sih-swap-contagens.sql` (mesmo padrão já provado pelo `09-03`), com `export PATH="$(brew --prefix libpq)/bin:$PATH"`.

## Contexto de qualidade do dado (registrado, não escondido)

O dado que subiu é honesto mas não perfeito, e o operador aprovou isso cientemente antes desta
execução (ver `STATE.md`, decisões do `09-08`/`09-11`/fix IDENT):

- **SC-7 fecha com `exato=34, explicado=61, inexplicado=3`, `result.ok=False` por desenho** — os 3
  inexplicados (`tuberculose_pulmonar`, `tuberculose_do_sistema_nervoso`, `doenca_de_alzheimer` em
  AC/2019) são um resíduo pequeno de amostra sem explicação inventada, não escondido atrás de um
  gate que force "zero inexplicado".
- **Divergência de lote (competência de processamento, `ANO_CMPT` vs `DT_INTER`)** cobre 53
  categorias com razão escrita e medida duas vezes (AC +7,90%, SP +5,10%) — reduz mas não zera o
  viés esperado entre a competência de processamento (TabNet) e a data de internação (microdado).
  Este viés está PRESENTE nas 207.131 linhas que subiram; não é um defeito desta execução, é a
  natureza da fonte, documentada desde o `09-08`/`09-11`.

## User Setup Required

Nenhum novo — `.env.pipeline` (criado em sessão anterior) cobriu toda a execução. `.env.local`
(frontend, `VITE_SUPABASE_ANON_KEY`/`VITE_SUPABASE_URL`) usado só para as provas de leitura/escrita
anônima, nunca impresso.

## Next Phase Readiness

- **`sih_metric_uf` e `sih_collection_status` estão servindo dado real de produção agora** —
  qualquer consumo futuro (Fase 10, `09-12`/`09-13`) lê microdado, não mais TabNet.
- **As 27 partições de município estão reais no Storage** — `09-14` pode verificar a pré-condição
  de paridade de contagem (partições vs `sih_metric_muni`) contra dado genuíno, não mais uma
  medição parcial (só AC).
- **`09-14` continua sendo quem drop `sih_metric_muni` e libera espaço para população** — a
  restrição de ordem foi provada ao vivo nesta sessão (RuntimeError real), então o `09-14` não
  precisa redescobrir isso, só executá-lo.
- **Carga de `sih_population_*` continua fora do escopo de qualquer plan existente** — `upload.py`
  recusa `--tabela` diferente de `sih_metric_uf` por desenho; nenhum plan da fase declara dono
  explícito da carga real de população (só `_assert_municipio_evacuado`, que a bloqueia até o
  `09-14`). Registrado para o planejamento da Fase 10 ou de uma plan futura.
- **`amputacao_mmii` sem dado**: decisão futura necessária — construir um matcher por código de
  procedimento (fora da Lista Morb CID-10) ou aceitar a lacuna como conhecida e documentada.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-12*

## Self-Check: PASSED

Todos os 6 arquivos (`upload.py`, `test_upload.py`, `generateSihSwapVerify.mjs`,
`sih-swap-contagens.sql`, `sihSwapVerify.test.ts`, este SUMMARY) existem no disco; todos os 3
hashes de commit (`7bfb559`, `91036d5`, `26196cb`) existem em `git log --oneline --all`.

---

# Segunda substituição de produção — dataset completo, 331 agravos (2026-08-12/13)

**Ad-hoc, sem `PLAN.md` formal — o brief operacional do coordenador é o spec.** Reaproveita
`upload.py`/`partitions.py` do 09-10 sem nenhuma alteração (ambos já construídos, testados e
executados uma vez com sucesso); esta segunda corrida existe porque a primeira rodou ANTES de a
re-coleta nacional incorporar o eixo de procedimento que recupera `amputacao_mmii`
(09-10-PROCEDIMENTO) — o 331º agravo, o único `filterKind: "procedimento"`, invisível a um
matcher só-CID.

## Por que esta segunda corrida

A re-coleta nacional completa (27/27 UFs `agregado_reciclado`, 0 `falhou` — confirmado em
`~/.lacir/sih-cache/agregados/collect_state.json` antes de tocar em qualquer coisa) rodou com o
eixo `PROC_REA` novo (SIGTAP `0408050012`) mais os guardas de qualidade de dado construídos ao
longo da fase (município em branco, agregação vazia, download vazio, autocura de ledger). A
primeira substituição (207.131 linhas/330 agravos) ficou correta para o dado que existia então,
mas nunca teve `amputacao_mmii`.

## Estado ANTES (medido, não assumido — via `psql` pelo Session Pooler)

| Tabela | Linhas |
|---|---|
| `sih_metric_uf` | 207.131 (330 agravos distintos, `amputacao_mmii` órfão) |
| `sih_collection_status` | 33.456 |
| `sih_disease` | 331 |
| `sih_metric_muni` | 1.099.403 |
| Tamanho do banco | 404 MB |

## Execução (ordem seguida, medida em cada etapa)

1. **Sanidade prévia**: nenhum processo `collect`/`download` vivo (`ps aux`), suíte Python
   completa verde (259 testes), `--dry-run` de `upload.py` mediu 207.664 linha(s) de 331
   agravo(s) sem escrever nada.
2. **Partições de município regeneradas e reenviadas ao Storage** (D-20, preparação para o
   09-14) — `partitions --todas --upload` rodado detached via `nohup` (27 UFs, ~3min30s de
   parede, `23:49:33` a `23:52:47`): as 27 partições reais no bucket `sih-municipio`,
   **130,05 MB total** (era 130,31 MB), **SP (maior) em 19,36 MB** (era 19,26 MB — cresceu com a
   amputação incluída), **2,6× sob o teto de 50 MB/objeto**. Nenhuma dependência de ordem com o
   swap de `sih_metric_uf` (tabelas diferentes, destinos diferentes — Storage vs Postgres); feito
   antes por ser a parte reversível/aditiva.
3. **A substituição real do D-16, `upload.py --tabela sih_metric_uf`**, rodada detached via
   `nohup` (a sessão que a lançou fechou no meio do polling — ver "Interrupção de sessão"
   abaixo). Log do processo detached (sobreviveu à sessão, `nohup`+`disown`):
   `START 2026-08-13T02:53:58Z` → `207664 linha(s) copiada(s), 207664 relida(s) via PostgREST` →
   `EXITCODE=0` → `END 2026-08-13T02:57:27Z` — **3min29s de parede**, idêntico à ordem de
   grandeza da primeira corrida (o mesmo padrão `copy_to_staging → swap → persist_collection_status
   → recount_via_postgrest → release_cache`, sem nenhuma mudança de código).

## Interrupção de sessão (registrado honestamente, não escondido)

A sessão que lançou o `upload.py` detached fechou NO MEIO do polling — o coordenador verificou
diretamente contra produção depois (`sih_metric_uf`=207.664/331 agravos, `amputacao_mmii`=702
linhas, sem tabela de staging órfã) e confirmou que a parte irreversível já tinha completado com
sucesso antes do fechamento. Esta sessão de continuação **reverificou tudo de forma
independente** (nunca assumindo o relato do coordenador sozinho) antes de prosseguir para a
escrituração — ver seção seguinte, todos os números medidos de novo, direto contra produção.

## Estado DEPOIS (medido de novo, de forma independente, via `psql` pelo Session Pooler)

| Tabela/prova | Antes | Depois | Delta |
|---|---|---|---|
| `sih_metric_uf` | 207.131 | **207.664** | +533 |
| Agravos distintos em `sih_metric_uf` | 330 | **331** | +1 (`amputacao_mmii`) |
| `sih_metric_uf` local=ocorrencia | 103.353 | 103.619 | +266 |
| `sih_metric_uf` local=residencia | 103.778 | 104.045 | +267 |
| `amputacao_mmii` em `sih_metric_uf` | 0 (órfão) | **702** | 27 UFs × 13 anos × 2 locais, completo |
| `sih_collection_status` | 33.456 | **33.560** | +104 (exatamente `amputacao_mmii`: 2 locais × 13 anos × 4 medidas) |
| `sih_disease` sem linha em `sih_metric_uf` (inspeção final do verify) | 1 (`amputacao_mmii`) | **0** | todos os 331 agravos com dado |
| `sih_metric_muni` | 1.099.403 | 1.099.403 | 0 (intocada — segue sendo o 09-14 quem remove) |
| Tamanho do banco | 404 MB | **420 MB** | +16 MB (headroom de ~80 MB antes do teto de 500 MB, e o 09-14 ainda libera 319 MB) |
| `cid_map_version` da corrida | `5395d951...8963f` | **o mesmo hash** | `lista-morb-cid.json`/`cid-corrections.json` não mudaram — só o eixo de procedimento em `aggregate.py` mudou, fora deste hash |
| Tabela de staging órfã (`*_staging`) | — | **nenhuma** | swap transacional completou limpo |
| `sih-swap-contagens.sql` (regenerado, `ESPERADO_SIH_METRIC_UF=207664`) contra produção | — | **exit 0** | 5 blocos `RAISE EXCEPTION`, nenhum disparou |

## `amputacao_mmii` provado end-to-end pelo caminho real do app (PostgREST anônimo, não SQL)

`GET {SUPABASE_URL}/rest/v1/sih_metric_uf?disease_id=eq.amputacao_mmii&ano=eq.2019&local=eq.ocorrencia`
com a chave `anon` (não `service_role`) devolveu **HTTP 200** com dado real: `RO`=133
internações/17 óbitos, `AC`=50 internações/6 óbitos — o valor de AC bate exatamente com a
reconciliação do `09-10-PROCEDIMENTO` (`PROC_REA=='0408050012' AND IDENT=='1' AND
ANO_CMPT==2019` → 50 internações, medido contra os 12 arquivos reais re-baixados). Esta é a prova
de que o dado chega pelo caminho que o app efetivamente usa, não só uma consulta SQL direta.

## Leitura/escrita anônima reconfirmada (PostgREST + Storage)

| Caminho | Esperado | Medido |
|---|---|---|
| `GET sih_metric_uf` (anon) | 200 | **200**, dado real |
| `POST sih_metric_uf` (anon) | recusado | **401**, `new row violates row-level security policy` |
| `GET storage/.../sih-municipio/v1/SP.json.gz` (anon, público) | 200 | **200**, 20.299.075 bytes (19,36 MB) |
| `POST storage/.../sih-municipio/...` (anon) | recusado | **403**, `AccessDenied` (RLS) |

## Discrepância de 3 linhas investigada e explicada (207.667 vs 207.664)

O coordenador havia contado **207.667** chaves únicas `(disease_id, local, territorio_codigo,
ano)` somando os 27 `agregados/{uf}.parquet` diretamente; a produção real ficou em **207.664** —
3 a menos. Medido (não assumido) por que: concatenar os 27 agregados de grão UF sem passar pela
resolução de dono territorial dá 481.135 linhas cruas, que colapsam para 207.667 chaves únicas
por deduplicação simples. Mas 3 dessas linhas têm `territorio_codigo` (derivado de `UF_ZI`, o
campo oficial do SIH-RD para a UF do estabelecimento, mesmo mecanismo do
`09-04-FIX-MUNICIPIO-BRANCO`) malformado — `'02'`, `'00'`, `'  '` (dois espaços), nenhum dos 27
códigos de UF válidos:

| Arquivo de origem | Agravo | UF_ZI malformado | Ano |
|---|---|---|---|
| `AM.parquet` | `neoplasia_maligna_do_colon` | `'02'` | 2023 |
| `CE.parquet` | `outras_malformacoes_do_aparelho_geniturinario` | `'00'` | 2023 |
| `DF.parquet` | `flebite_tromboflebite_embolia_e_trombose_venosa` | `'  '` | 2022 |

`partitions._uf_dona`/`construir_indice_territorial` já tratam código de território desconhecido
como estado NORMAL (`dona is None -> continue`, comportamento documentado desde o
`09-09-FIX-RESIDENCIA`: "nunca deveria acontecer com dado real do SIH... mas não quebra
silenciosamente coagindo para uma UF errada") — as 3 linhas são descartadas silenciosamente, não
uma UF errada. 207.667 − 3 = 207.664, exatamente a contagem de produção. Não é um defeito desta
corrida nem desta plan; é a mesma classe de achado do `09-04-FIX-MUNICIPIO-BRANCO` (`MUNIC_MOV`/
`MUNIC_RES` ilegível, 8 registros em 82 milhões), numa escala ainda menor (3 em 207.667, 0,0014%),
e num campo diferente (`UF_ZI`, não `MUNIC_MOV`/`MUNIC_RES`). `aggregate.py`/`partitions.py`
estão fora do `file_scope` desta corrida (dono declarado: fases anteriores) — registrado aqui
para decisão futura, não corrigido.

## Contexto de qualidade do dado (registrado de novo, não escondido — vale para as 207.664 linhas)

- **SC-7 fecha com `exato=34, explicado=61, inexplicado=3`, `result.ok=False` por desenho** — os
  3 inexplicados (`tuberculose_pulmonar`, `tuberculose_do_sistema_nervoso`,
  `doenca_de_alzheimer` em AC/2019) continuam um resíduo pequeno de amostra sem explicação
  inventada, não escondido atrás de um gate que force "zero inexplicado". Nada nesta corrida
  mudou o eixo CID que o SC-7 mede.
- **Divergência de lote (competência de processamento, `ANO_CMPT` vs `DT_INTER`)** cobre 53
  categorias com razão escrita e medida duas vezes (AC +7,90%, SP +5,10%) — reduz mas não zera o
  viés esperado entre a competência de processamento (TabNet) e a data de internação (microdado).
  Este viés está presente nas 207.664 linhas que subiram; natureza da fonte, não defeito desta
  execução.
- **Reconciliação própria de `amputacao_mmii`** (09-10-PROCEDIMENTO, contra o oráculo TabNet
  legado, AC completo/13 anos): **816 internações medidas vs 810 do oráculo (+0,74%)**, óbitos
  **idênticos (94=94)** — divergência ano-a-ano explicada pelo MESMO mecanismo `ANO_CMPT`/
  `DT_INTER` já aceito para as outras 330 categorias, confirmado de forma independente num eixo
  de classificação totalmente diferente (procedimento SIGTAP, não CID).

## Task Commits (segunda corrida)

1. **fix (09-10-segunda-substituicao): `sih-swap-contagens.sql` regenerado para 207.664
   linhas/331 agravos** — `df95381` (fix) — `generateSihSwapVerify.mjs`
   (`ESPERADO_SIH_METRIC_UF` atualizado, `CID_MAP_VERSION_DA_CORRIDA` confirmado inalterado),
   `sih-swap-contagens.sql` regenerado (nunca editado à mão), `sihSwapVerify.test.ts` atualizado
   para a mesma contagem (os asserts hardcoded que travam o verify contra o valor medido).
2. **Este SUMMARY + STATE.md + ROADMAP.md** — commit seguinte a este arquivo.

_Nota: a substituição real (partições regeneradas/reenviadas + swap de `sih_metric_uf`) já tinha
completado com sucesso ANTES do fechamento de sessão relatado acima — nenhum commit de código de
pipeline foi necessário nesta corrida (`upload.py`/`partitions.py` reaproveitados sem nenhuma
alteração, como o brief pediu); só a escrituração (verify regenerado + testes + docs) ficou
pendente e foi completada nesta sessão de continuação, com todo número reconferido de forma
independente contra produção antes de ser escrito aqui._

## Next Phase Readiness (atualização)

- **`amputacao_mmii` está servindo dado real de produção agora**, pelo caminho anônimo real do
  app (PostgREST) — a lacuna registrada no `09-10-PROCEDIMENTO-SUMMARY.md` está fechada.
- **As 27 partições de município no Storage refletem o dataset completo** (331 agravos,
  incluindo `amputacao_mmii`) — qualquer drill de município feito pelo app a partir de agora lê
  o dado atualizado.
- **`09-14` segue sendo quem remove `sih_metric_muni`** — nenhuma mudança nesta corrida quanto a
  isso; `sih_metric_muni` permanece intocada (1.099.403 linhas). O bloqueio registrado pelo
  `09-10-PROCEDIMENTO` ("09-14 não pode rodar até `amputacao_mmii` estar em produção") está
  **RESOLVIDO** por esta corrida — `amputacao_mmii` está em produção agora.
- **Discrepância de 3 linhas (UF_ZI malformado)** registrada para decisão futura — mesma classe
  do `09-04-FIX-MUNICIPIO-BRANCO`, escala menor (3 em 207.667), não bloqueante.

## Self-Check (segunda corrida): PASSED

- `scripts/catalog/generateSihSwapVerify.mjs`, `supabase/verify/sih-swap-contagens.sql`,
  `src/features/catalog/sihSwapVerify.test.ts` existem no disco e o commit `df95381` existe em
  `git log --oneline --all`.
- `node scripts/catalog/generateSihSwapVerify.mjs` rodado duas vezes produz bytes idênticos
  (idempotente).
- `npx vitest run src/features/catalog/sihSwapVerify.test.ts` — 12/12 testes verdes.
- `psql "$SIH_PIPELINE_DB_URL" -f supabase/verify/sih-swap-contagens.sql` — exit 0 contra
  produção real.
- `npm run gate` (suíte completa: `catalog:validate` + `pipeline:test` [796 testes Python] +
  `vitest run` [frontend] + `tsc -b && vite build`) — verde, exit 0.
- Todas as contagens de produção (`sih_metric_uf`, `sih_collection_status`, `sih_disease`,
  `sih_metric_muni`, tamanho do banco, ausência de tabela `*_staging`) reconferidas
  independentemente via `psql` pelo Session Pooler, não assumidas do relato do coordenador.
