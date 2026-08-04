---
phase: 08-taxonomia-can-nica-integridade
plan: 08
subsystem: database
tags: [supabase, postgres, migration-rehearsal, docker, explain-analyze, rename]

# Dependency graph
requires:
  - phase: 08-05
    provides: "supabase/migrations/20260804020000_rename_disease_ids.sql (up), supabase/rollback/20260804020000_rename_disease_ids_down.sql (down), supabase/verify/contagens.sql — the exact three files this plan rehearses, unmodified"
  - phase: 08-06
    provides: "The flip that makes rename-map.json's 21 pairs the live meaning of the migration: canonical taxonomy is 331 agravos, and the two verified rename cycles (186<->187, 173<->182) are the real hazard this rehearsal targets"
  - phase: 08-02
    provides: "scripts/catalog/rename-map.json — source of the 21 old ids used to measure per-id row counts and select cycle samples"
provides:
  - "Measured proof (not estimate) that the up/down cycle runs clean against a full production-volume copy (330/30313/1099403 rows) with real PK, FK ON DELETE CASCADE, and RLS: up 3.674s wall, down 3.921s wall, D-04 integrity proof passing both directions with zero RAISE EXCEPTION"
  - "Byte-for-byte reversibility proof (D-03): aggregate-by-agravo-by-measure snapshot before the up is diff-identical to the same snapshot after the down, zero tolerance"
  - "EXPLAIN (ANALYZE, BUFFERS) profile of pass 1, isolated in its own ROLLBACK-ed transaction: 2123ms execution time, FK trigger overhead broken out per constraint (sih_metric_muni_disease_id_fkey trigger alone = 476ms across 200636 calls)"
  - "Confirmed the two rename cycles resolve correctly against real production data: embolia_pulmonar (post-up) carries doencas_reumaticas_cronicas's exact pre-up sums; hemorroidas/outras_doencas_veias both correctly have zero metric rows on both sides"
  - "Per-id row volume confirmed against the actual dump, not estimated: 4,195 in sih_metric_uf and 200,636 in sih_metric_muni for the 21 renamed ids — exact match to the planning-time measurement, zero divergence"
  - "Production dump timing for Fase 9 planning: supabase db dump --linked --data-only -s public took 32m33s for 1.13M rows, 112.5MB output"
affects: [08-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Disposable rehearsal Postgres from the same supabase/postgres:X.Y.Z image the Supabase CLI itself downloads (not a bare postgres:17 image) — ships the anon/authenticated/service_role roles the baseline schema's RLS policies reference, so RLS applies without error and is exercised for real, not skipped"
    - "Aggregate-by-agravo-by-measure snapshot captured to a file OUTSIDE the migration's own transaction, before the up runs — count(*) alone cannot detect a shuffle between the 21 renamed ids (the three absolute counts would stay identical even if two agravos' data were swapped), so the D-03 reversibility proof needs the same four-measure aggregation the migration's own D-04 check uses, but captured independently for an after-the-down comparison"
    - "EXPLAIN (ANALYZE, BUFFERS) measured in its own BEGIN/ROLLBACK transaction, never inside the same session as the real up/down apply — keeps the cost measurement from polluting the state under test and avoids re-running the real mutation twice"

key-files:
  created:
    - .planning/phases/08-taxonomia-can-nica-integridade/08-08-SUMMARY.md
  modified: []

key-decisions:
  - "supabase/postgres:17.6.1.147 (the short tag the plan's <interfaces> block names) was not present in the local Docker image cache under that exact tag — only under the full registry path public.ecr.aws/supabase/postgres:17.6.1.147, which is what the Supabase CLI itself had pulled during 08-05's db pull/db dump. Used the full registry ref for docker run; same image digest, same roles/extensions, zero behavioral difference. Rule 1 (environment reality diverged from the plan's literal command), not a scope change."
  - "The 186<->187 rename cycle (hemorroidas <-> outras_doencas_veias) turned out to have zero rows in both sih_metric_uf and sih_metric_muni on both sides of the swap, before and after — both codes 186 and 187 are among the 237 agravos already missing sih_metric_uf coverage (Fase 9 scope, D-25). This does not weaken the rehearsal: the 173<->182 cycle (doencas_reumaticas_cronicas <-> embolia_pulmonar) has real data on both sides and was confirmed to swap correctly (post-up embolia_pulmonar's aggregate sums equal pre-up doencas_reumaticas_cronicas's aggregate sums, exactly, uf and muni)."

patterns-established:
  - "Any future production-migration rehearsal for this project should dump with --data-only -s public against the linked project, restore into a disposable supabase/postgres:<tag> container matching the CLI's own cached image, and run the up/verify/down/verify cycle with \\timing on and a single EXPLAIN (ANALYZE, BUFFERS)-in-ROLLBACK pass for cost measurement — this plan is the template 08-10 cites before touching production"

requirements-completed: [TAX-03, TAX-04]

# Metrics
duration: ~48min (dominated by the 32m33s production data dump, which cannot be parallelized with itself and per the plan's own instruction must not be interrupted)
completed: 2026-08-04
---

# Phase 8 Plan 8: Migration rehearsal against a full production-volume local Postgres Summary

**Up (3.674s) → D-04 integrity proof (passed) → verify (331/30313/1099403) → down (3.921s) → byte-identical reversibility proof — all measured against a real `pg_dump --data-only` restore (330/30,313/1,099,403 rows) with production's actual PK/FK `ON DELETE CASCADE`/RLS, not a synthetic fixture.**

## Veredito

**O ciclo passou por completo.** Nenhuma etapa falhou, nenhum `RAISE EXCEPTION` disparou, e o banco retornou exatamente ao estado inicial (diff byte a byte sem tolerância nos dois arquivos de retrato agregado). A plan 08-10 está desbloqueada por este documento.

## Performance

- **Duration:** ~48 min (Task 1 dump: 32m33s; everything else: ~15min)
- **Started:** 2026-08-04T11:14:07Z (first `docker info`/dump attempt)
- **Completed:** 2026-08-04T11:58:25Z
- **Tasks:** 3/3 completed
- **Files modified:** 1 (this SUMMARY — no other repository file was touched, per plan design)

## Measurements Table

| Etapa | Tempo de parede | Linhas afetadas / observadas | Observação |
|---|---|---|---|
| `docker info` (pré-requisito) | instantâneo | — | Docker já estava rodando |
| `supabase db dump --linked --data-only -s public` (produção, **leitura pura**) | **32m 33s** (11:16:25Z → 11:48:58Z) | 1.130.107 linhas de SQL, 112.496.221 bytes (~112,5 MB) | Único comando remoto da plan; nenhuma escrita em produção |
| Schema baseline aplicado (`20260804015329_remote_schema.sql`) | sub-segundo | 3 tabelas, 3 PK, 2 FK `ON DELETE CASCADE`, 2 índices, 3 policies RLS | Zero statements falharam — todo o baseline aplicou de primeira |
| Restauração dos dados (`prod_data.sql` no container) | **13s** (11:52:20Z → 11:52:33Z) | 330 + 30.313 + 1.099.403 linhas inseridas | `session_replication_role = replica` no dump desativa triggers/RLS durante a carga |
| Contagens de partida | — | **330 / 30.313 / 1.099.403** | Bateram exatamente contra o alvo medido em produção (RESEARCH 3.2) |
| Linhas dos 21 ids renomeados — `sih_metric_uf` | — | **4.195** | 0% de divergência contra a estimativa do planejamento (4.195) |
| Linhas dos 21 ids renomeados — `sih_metric_muni` | — | **200.636** | 0% de divergência contra a estimativa do planejamento (200.636) |
| **UP** (`--single-transaction`, `\timing on`) | **3.674s** wall total | 21 / 4.195 / 200.636 por passada (2 passadas) | Passada 1: 1.656ms · Passada 2: 1.574ms · Prova D-04: 283ms |
| `supabase/verify/contagens.sql` pós-UP | — | **331 / 30.313 / 1.099.403** | Passou sem `RAISE EXCEPTION`; 237 agravos órfãos de métrica listados, todos já esperados (nenhum além do registrado) |
| `EXPLAIN (ANALYZE, BUFFERS)` da passada 1, isolado (`BEGIN`...`ROLLBACK`) | **2.123ms** execution time | 21 / 4.195 / 200.636 | Buffers: `shared hit=2.267.181 read=13.175 dirtied=5.382 written=9.490`. Overhead de trigger de FK: `sih_metric_muni_disease_id_fkey` = 476,4ms/200.636 chamadas; `sih_metric_uf_disease_id_fkey` = 10,0ms/4.195 chamadas; triggers em `sih_disease` = 15,3ms + 0,8ms/21 chamadas cada |
| **DOWN** (`--single-transaction`, `\timing on`) | **3.921s** wall total | 21 / 4.195 / 200.636 por passada (2 passadas) | Passada 1: 1.587ms · Passada 2: 1.872ms · Prova D-04: 290ms |
| Contagens pós-DOWN | — | **330 / 30.313 / 1.099.403** | Idênticas à partida |
| Retrato agregado pós-DOWN vs pré-UP (`diff`, sem tolerância) | — | **IDÊNTICO** em `sih_metric_uf` e `sih_metric_muni` | Prova D-03: reversibilidade é script testado, não restauração manual |

## Accomplishments

- Postgres local restaurado de uma cópia real de produção (`pg_dump --data-only -s public`, 1,13M linhas) rodando na mesma imagem `supabase/postgres:17.6.1.147` que o CLI já usa — traz os papéis `anon`/`authenticated`/`service_role`, então as três policies de RLS do baseline aplicaram e ficaram ativas de verdade, exercitando metade da razão de existir do D-02
- Schema baseline (`20260804015329_remote_schema.sql`) aplicado sem nenhuma falha: as três tabelas, as três PK, as duas FK `ON DELETE CASCADE` (`sih_metric_uf_disease_id_fkey`, `sih_metric_muni_disease_id_fkey`) e os dois índices reais (`sih_metric_uf_disease_ano`, `sih_metric_muni_disease_uf_ano`) — nenhum subconjunto precisou ser aplicado manualmente
- Ciclo UP → verificação → DOWN → verificação exercitado por completo contra o volume real: UP em 3,674s, prova de integridade agregada D-04 (soma de `internacoes`/`obitos`/`valor_total`/`dias_permanencia` por agravo, via `IS DISTINCT FROM`) passou sem exceção, `contagens.sql` confirmou 331/30.313/1.099.403, DOWN em 3,921s devolveu o banco a 330/30.313/1.099.403
- Os dois ciclos de renomeação (186↔187, 173↔182) — a razão real de a migração precisar de duas passadas — foram conferidos por amostra contra dados reais de produção: `embolia_pulmonar` pós-UP carrega exatamente as somas que `doencas_reumaticas_cronicas` tinha pré-UP (351 linhas/119.929 internações em UF; 12.113 linhas/119.929 internações em município); `hemorroidas`/`outras_doencas_veias` têm zero linhas em ambos os lados — um `UPDATE` sequencial teria violado a PK justamente aqui, e a passada dupla com id temporário provou resolver isso corretamente contra dados reais, não só contra o fixture do RESEARCH 4.2
- O agravo do código 330 (`todas_as_outras_causas_externas`) existe em `sih_disease` após o UP com zero linhas em ambas as tabelas de métrica, e desaparece após o DOWN — confirmado por consulta direta, não só pela prova interna da transação
- O conjunto de agravos órfãos de métrica (237, já existente antes da migração — Fase 9, não regressão) cresceu exatamente pelo id registrado em `metricless-diseases.json` (`todas_as_outras_causas_externas`) e por nenhum outro, conferido via `supabase/verify/contagens.sql`
- Custo e perfil de lock medidos, não estimados: `EXPLAIN (ANALYZE, BUFFERS)` isolado da passada 1 mostra 2,1s de execução, com ~500ms desse tempo atribuídos aos triggers de checagem de FK (a maior parte, 476ms, no trigger de `sih_metric_muni` — o `NOT DEFERRABLE` checa ao fim do statement inteiro, então pai e filhas "andam juntos" sem violar a FK em nenhum momento intermediário, exatamente como o comentário do arquivo de migração previa). Dezenas de segundos totais (não minutos) confirma a expectativa do planejamento — a janela de manutenção em produção é aceitável (RESEARCH A5 respondida)
- Reversibilidade (D-03) provada por diff byte a byte, sem tolerância, entre o retrato agregado por agravo × medida capturado antes do UP e o mesmo retrato recomputado depois do DOWN — em ambas as tabelas de métrica
- Ambiente inteiro descartável: container `lacir-ensaio` e o dump de 112,5MB de produção destruídos ao fim (ver Task 3 abaixo)

## Task Commits

Esta plan não modifica nenhum arquivo versionado do repositório nas Tasks 1 e 2 — o dump de produção é gravado sob `.local/` (gitignorado desde a 08-05) e o container é efêmero. `git status --short` ficou vazio depois de ambas. O único artefato do repositório é este SUMMARY, na Task 3.

1. **Task 1: Pre-requisitos, dump de produção e restauração local** - sem commit (nenhum arquivo do repositório alterado; `.local/supabase/prod_data.sql` é gitignorado)
2. **Task 2: Ciclo up, verificação, down, verificação — com medição de tempo** - sem commit (mesmas razões; medições ficaram em arquivos escrata sob `.local/`, apagados na Task 3)
3. **Task 3: Registrar as medições e destruir o ambiente do ensaio** - commit deste SUMMARY (docs)

**Plan metadata:** commit separado abaixo (SUMMARY/STATE/ROADMAP)

## Files Created/Modified

- `.planning/phases/08-taxonomia-can-nica-integridade/08-08-SUMMARY.md` - Este documento — as medições que a plan 08-10 cita antes de tocar produção

Nenhum outro arquivo do repositório foi criado ou modificado. `.local/supabase/prod_data.sql` e os arquivos-escrata de medição (`retrato_antes_*.txt`, `retrato_depois_*.txt`, `up_with_timing.sql`, `down_with_timing.sql`, `explain_pass1.sql`, `*_output.log`, `*.log`) foram todos apagados ao fim da Task 3 — nenhum jamais entrou em `git status` (gitignorados desde a 08-05).

## Decisions Made

Ver `key-decisions` no frontmatter. A única decisão de execução foi reconciliar o tag literal de imagem Docker do `<interfaces>` da plan (`supabase/postgres:17.6.1.147`) com o que estava de fato em cache nesta máquina (`public.ecr.aws/supabase/postgres:17.6.1.147`, baixado pelo próprio Supabase CLI na 08-05) — mesmo digest de imagem, mesmo comportamento, apenas o path do registry difere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Environment reality diverged from plan's literal command] Tag de imagem Docker sem o prefixo do registry não estava em cache**
- **Found during:** Task 1, antes de `docker run`
- **Issue:** O `<interfaces>` da plan especifica `docker run ... supabase/postgres:17.6.1.147`. `docker images` mostrou que esse tag curto não existe localmente — a imagem que o Supabase CLI baixou na 08-05 está registrada como `public.ecr.aws/supabase/postgres:17.6.1.147` (mesmo digest `ac581882596e`). Rodar o comando literal teria disparado um `docker pull` desnecessário (ou falhado, dependendo da configuração de registry mirror).
- **Fix:** Usado o tag completo `public.ecr.aws/supabase/postgres:17.6.1.147` em `docker run`. Mesma imagem, mesmos papéis `anon`/`authenticated`/`service_role`, comportamento idêntico — confirmado pelo `docker images` listando o mesmo `IMAGE ID` sob os dois tags equivalentes.
- **Files modified:** Nenhum (comando ad-hoc, não código versionado)
- **Verification:** Container subiu, `pg_isready` respondeu em 1s, schema baseline aplicou sem erro, RLS ficou ativa nas três tabelas — confirmando que é a imagem correta
- **Committed in:** N/A (nenhum arquivo de repositório envolvido)

**2. [Não é deviation — achado registrado] Dump de dados de produção levou 32m33s, não segundos**
- **Found during:** Task 1
- **Issue/Achado:** O comando `supabase db dump --linked --data-only -s public` sozinho levou 32 minutos e 33 segundos para 1,13M linhas (112,5 MB de saída). A plan já avisava "a operação demora; não interromper" mas não dava um número — este é o número, útil para a Fase 9 (coleta completa vai lidar com volumes de escrita comparáveis).
- **Fix:** N/A — não é um problema, é uma medição solicitada explicitamente pela Task 3 ("o tempo que o dump de dados levou, que é informação útil para a Fase 9").
- **Files modified:** Nenhum
- **Verification:** N/A
- **Committed in:** N/A

---

**Total deviations:** 1 auto-fixed (Rule 1 — path de imagem Docker), 1 achado registrado sem necessidade de fix (tempo do dump)
**Impact on plan:** Nenhum impacto na mecânica ou no resultado do ensaio — a imagem usada é bit-a-bit a mesma que o `<interfaces>` da plan pretendia (mesmo `IMAGE ID`), e o tempo de dump é uma medição, não uma falha.

## Issues Encountered

Nenhum problema real. A única fricção operacional foi de ferramenta de execução (timeout de 2 minutos do shell interativo exigiu rodar o `db dump` de 32 minutos em background com polling) — não é um problema do ensaio em si, e não deixou nenhum artefato pela metade: o comando completou com `exit=0` e o arquivo final bateu a contagem esperada de linhas.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Docker Desktop já estava rodando e o Supabase CLI já estava autenticado nesta máquina (confirmado antes de qualquer comando, per Task 1).

## Next Phase Readiness

- **A plan 08-10 (aplicação em produção) está desbloqueada.** Este SUMMARY é o documento que o `[BLOCKING]` da 08-10 cita: o ciclo completo (up → D-04 → verify → down → verify de reversibilidade) passou contra volume real de produção, sem nenhuma etapa falhando.
- Os três arquivos que a 08-10 vai aplicar (`supabase/migrations/20260804020000_rename_disease_ids.sql`, `supabase/rollback/20260804020000_rename_disease_ids_down.sql`, `supabase/verify/contagens.sql`) **não foram modificados** por esta plan — são os mesmos bytes gerados na 08-05 e rehearsed aqui sem qualquer edição.
- Custo esperado em produção: dezenas de segundos por direção (3,674s UP / 3,921s DOWN aqui, num container local sem réplicas nem carga concorrente — produção pode ser um pouco mais lenta por rede/IO, mas a ordem de grandeza — segundos, não minutos — está confirmada). O trigger de FK em `sih_metric_muni` é o maior contribuinte individual de custo (~476ms de ~2,1s na passada 1 isolada).
- Nenhum artefato de produção ficou no disco: `.local/supabase/prod_data.sql` (112,5 MB) apagado ao fim da Task 3, container `lacir-ensaio` parado e removido (`--rm`).
- Para a Fase 9: o tempo de dump de dados (32m33s para 1,13M linhas de leitura) é um número de referência útil para dimensionar a nova coleta completa (4 medidas × 330 agravos × UF+município).

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-04*

## Self-Check: PASSED

`08-08-SUMMARY.md` found on disk. Commit `cf73cef` found in git log. Container `lacir-ensaio` confirmed absent from `docker ps -a` (0 matches). `.local/supabase/prod_data.sql` confirmed deleted. `npm run gate` green (104 test files / 747 tests, catalog:validate OK, build succeeds) after this plan's work, confirming zero code impact.
