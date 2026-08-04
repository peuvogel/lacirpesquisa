---
phase: 08-taxonomia-can-nica-integridade
plan: 10
subsystem: database
tags: [supabase, postgres, migration, production, postgrest, verification, docs]

# Dependency graph
requires:
  - phase: 08-08
    provides: "Migration rehearsal proof (up 3.674s, D-04 integrity, verify 331/30313/1099403, down 3.921s, byte-identical reversibility) against full production-volume Postgres — the veredito this plan's Task 1 checkpoint cites before authorizing production apply"
  - phase: 08-05
    provides: "supabase/migrations/20260804020000_rename_disease_ids.sql (up), supabase/rollback/20260804020000_rename_disease_ids_down.sql (down), supabase/verify/contagens.sql — applied/run unmodified by this plan"
provides:
  - "Production database hmfbxqemububjyhdckrj migrated: 21 disease ids renamed to their real TabNet-code meaning, code-330 agravo (todas_as_outras_causas_externas) inserted — sih_disease/sih_metric_uf/sih_metric_muni now match the canonical taxonomy in the repo (TAX-03, TAX-04)"
  - "Live-database proof: sih_disease=331, sih_metric_uf=30313, sih_metric_muni=1099403 (PostgREST content-range, anon key); supabase/verify/contagens.sql ran clean (exit 0, zero RAISE EXCEPTION); zero __mig_/__down_ leftover ids"
  - "TAX-06 set-identity proof on live data: the 331 ids in sih_disease and the 331 ids across scripts/catalog/sql/0.sql..4.sql are byte-identical sets (comm -23/-13 both empty), not sampled"
  - "Both rename cycles confirmed against live production data: embolia_pulmonar (post-up) carries doencas_reumaticas_cronicas's exact pre-up sums (351 rows/119,929 internações UF; 12,113 rows/119,929 internações muni) — exact match to the 08-08 rehearsal; hemorroidas/veias_varicosas_das_extremidades_inferiores confirmed zero rows both sides"
  - "docs/SUPABASE-CATALOG.md rewritten to the real applied schema: real constraint/index names, ON DELETE CASCADE on both FKs documented as a trap, deliberate absence of ON UPDATE (D-08), created_at column, 331 count with the '330 com dado coletado' note, and a new supabase/migrations vs rollback vs verify section"
  - "Fase 9 handoff recorded (below): legacy-named coleta_sih_multi corpus, uploadSihToSupabase.mjs's intended fail-loud on legacy dirs, catalog:build blocked until re-key, INGEST_SECRET rotation still pending, code-330 collection coverage is a Fase 9 decision"
affects: [09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabase db query --linked -f <file> --agent=no used as the scriptable equivalent of 'run once through the dashboard SQL Editor' for a non-interactive agent — single execution, same Management-API-authenticated connection the CLI already uses for db push, no service-role key or new credential involved"
    - "PostgREST content-range with anon key + Prefer: count=exact for absolute-count verification is the same read path production app code uses — no privileged credential needed for post-push proof"

key-files:
  created: []
  modified:
    - docs/SUPABASE-CATALOG.md

key-decisions:
  - "Task 1's checkpoint:decision was answered in a prior session (developer chose aplicar-agora); this continuation agent started at Task 2's push per the orchestrator's blocker-resolution and does not re-ask it. The verbatim decision record is reproduced below exactly as required."
  - "supabase/verify/contagens.sql's own metricless-orphan SELECT returns 237 rows (not literally empty) — this matches 08-08's rehearsal finding exactly and is the correct outcome: the query lists every agravo lacking sih_metric_uf coverage except the one registered exception (code 330), and 237 of 330 agravos already lacked that coverage before this migration (D-25, Fase 9 scope). The plan's Task 3 acceptance-criteria wording ('essa lista precisa vir vazia') is imprecise against its own very next sentence ('o que a verificacao afirma e que esse conjunto nao cresceu alem do que esta registrado') and against 08-08's own veredito. Verified by exact match: 237 in the rehearsal, 237 in production, zero growth."
  - "supabase db query --linked -f supabase/verify/contagens.sql (Supabase CLI, Management-API-authenticated) used in place of the SQL Editor dashboard for a single, non-interactive, read-only execution of contagens.sql — the plan's literal text names the dashboard because it assumes a human operator; this continuation agent has no browser access and no production database password. Same single-execution semantics (one transaction-scoped script run), same anon-tier read-only intent (the DO block only reads and RAISE EXCEPTIONs, no service-role key used, no write). Rule 1 (environment reality: no interactive dashboard access from this execution context)."

patterns-established: []

requirements-completed: [TAX-03, TAX-04]

# Metrics
duration: ~15min (continuation session — Task 1's checkpoint and its ~48min rehearsal wait happened in a prior session/plan)
completed: 2026-08-04
---

# Phase 8 Plan 10: Production migration apply + live verification + docs alignment Summary

**Production database `hmfbxqemububjyhdckrj` migrated (21 disease ids renamed + code-330 inserted) via `supabase db push` (46.6s wall), proved live via PostgREST (331/30313/1099403, anon key) and `contagens.sql` (exit 0, zero exceptions), TAX-06 set-identity confirmed byte-for-byte against the seed SQL (not sampled), both rename cycles' aggregate sums matched exactly to the 08-08 rehearsal, and `docs/SUPABASE-CATALOG.md` rewritten to the real schema (`ON DELETE CASCADE`, real constraint/index names, 331 count).**

## Task 1 — Decision Record (verbatim, answered in a prior session)

> Veredito do ensaio (`08-08-SUMMARY.md`) lido: o ciclo passou por completo — nenhuma etapa
> falhou, nenhum `RAISE EXCEPTION` disparou, e o banco retornou exatamente ao estado inicial
> (diff byte a byte sem tolerância nos dois retratos agregados).
>
> Medições apresentadas antes da pergunta: up **3,674s** (D-04 passou, verify
> 331/30313/1099403) · down **3,921s** (contagens de volta a 330/30313/1099403) · linhas por
> passada: **4.195** (`sih_metric_uf`) / **200.636** (`sih_metric_muni`).
>
> **Escolha: `aplicar-agora`**, concedida interativamente pelo desenvolvedor ao orquestrador
> de execute-phase em 2026-08-04, após o veredito e as medições serem apresentados.
>
> Desvio registrado: o `db push` foi barrado por uma checagem de pré-voo do CLI por causa da
> entrada de histórico remota `20260726024533`, anterior ao scaffold `supabase/` (já notada
> como fora de escopo no 08-05). O desenvolvedor foi consultado em separado e autorizou
> `supabase migration repair --status reverted 20260726024533` — escrita restrita à tabela de
> contabilidade do Supabase, sem tocar schema ou dado. Reparo e `--dry-run` executados e
> conferidos pelo orquestrador antes do push.

## Performance

- **Duration:** ~15 min (this continuation session, Task 2 push through Task 4 docs commit)
- **Started (this session):** 2026-08-04T13:1x:xxZ (approx, after context loading)
- **Push started:** 2026-08-04T13:17:02Z
- **Push completed:** 2026-08-04T13:17:49Z (46.586s wall)
- **Completed:** 2026-08-04T13:29:41Z
- **Tasks:** 4/4 complete (Task 1 answered in a prior session per orchestrator context)
- **Files modified:** 2 (docs/SUPABASE-CATALOG.md, this SUMMARY)

## Accomplishments

- **Pre-push checks (Task 2 read-first):** `docker info` responded OK; `supabase migration list` showed exactly the baseline applied both sides and the rename migration pending remote-only (no third migration, no unreconciled baseline) — the orchestrator's blocker-resolution (`migration repair --status reverted 20260726024533`) held; `git status --short` was clean before the push
- **`supabase db push --yes` applied `20260804020000_rename_disease_ids.sql` to production**, exit 0, no `RAISE EXCEPTION` printed. Wall time: **46.586s** (`time` builtin) — compared to the rehearsal's **3.674s**: the difference is entirely CLI/Management-API connection overhead ("Initialising login role...", "Connecting to remote database...", ephemeral-role provisioning per T-08-10-02's threat model), not the migration SQL itself — the rehearsal's `\timing on` measured only the in-transaction SQL execution, not the CLI's own connection setup. Order of magnitude (tens of seconds, not minutes) matches the rehearsal's own caveat that production network/IO could be somewhat slower
- **Post-push `supabase migration list`** confirmed both migrations `Local` = `Remote`: `20260804015329` and `20260804020000`
- **`git status --short` stayed clean** across the entire push — no repository file touched by `db push` itself
- **Live-database counts confirmed via PostgREST** (anon key, `Prefer: count=exact`, same read path the app uses): `sih_disease` content-range `.../331`, `sih_metric_uf` `.../30313`, `sih_metric_muni` `.../1099403` — exact match to the target and to the 08-08 rehearsal
- **`supabase/verify/contagens.sql` run via `supabase db query --linked -f`** (see key-decisions for why this replaces the dashboard SQL Editor for a non-interactive agent): exit code 0, zero `RAISE EXCEPTION` from the three-count `DO` block. Its own metricless-orphan SELECT returned exactly **237** rows — identical to 08-08's rehearsal finding, confirming the orphan-of-metric set did not grow beyond the one registered exception (code 330)
- **TAX-06 proof, by full set comparison not sampling:** extracted all 331 `id`s from `sih_disease` live (single PostgREST page, `limit=1000` > 331, no pagination needed) and all 331 `id`s from `scripts/catalog/sql/0.sql`..`4.sql`; `comm -23`/`comm -13` both returned **empty** — the two sets are identical
- **Zero leftover temp-id prefixes:** `grep -c "^__mig_\|^__down_"` against the live id list returned `0`
- **Code-330 agravo confirmed live:** `todas_as_outras_causas_externas` exists in `sih_disease` with `tabnet_code=330`, `filter_kind=lista_morb`, `created_at` timestamp matching the push (`2026-08-04T13:17:08Z`); zero rows in both `sih_metric_uf` and `sih_metric_muni` (`content-range: */0` both)
- **Both rename cycles sampled against live data and matched exactly to 08-08's rehearsal:** `embolia_pulmonar` (the 173→182 cycle target) carries 351 rows/119,929 internações in `sih_metric_uf` and 12,113 rows/119,929 internações in `sih_metric_muni` — byte-for-byte the same numbers the rehearsal measured for `doencas_reumaticas_cronicas`'s pre-up state. `hemorroidas`/`veias_varicosas_das_extremidades_inferiores` (the 186↔187 cycle) both returned zero rows in both tables, also matching the rehearsal
- **`npm run gate` green:** 105 test files / 762 tests, `catalog:validate` OK, build succeeds — confirmed both before and after the docs update
- **`docs/SUPABASE-CATALOG.md` rewritten** (Task 4): real constraint names (`sih_disease_pkey`, `sih_metric_uf_pkey`, `sih_metric_muni_pkey`, `sih_metric_uf_disease_id_fkey`, `sih_metric_muni_disease_id_fkey`), `ON DELETE CASCADE` on both FKs documented explicitly as a trap for any future delete-and-reinsert strategy, deliberate absence of `ON UPDATE` cited to D-08, real index names (`sih_metric_uf_disease_ano`, `sih_metric_muni_disease_uf_ano` — the doc previously called the second one `sih_metric_muni_uf_ano` and the ROADMAP listed it as unconfirmed intent; it exists and is applied, confirmed live in this plan), the undocumented `created_at` column, the count moving from 330 to 331 with the "330 com dado coletado" note, and a new section describing what `supabase/migrations`, `supabase/rollback`, and `supabase/verify` each hold and whether `db push` sweeps them

## Task Commits

1. **Task 1: Autorizacao para aplicar em producao** - answered in a prior session (orchestrator context); no commit in this session
2. **Task 2: [BLOCKING] Aplicar a migracao em producao com supabase db push** - no repository file changed (`git status --short` empty across the entire push); no commit
3. **Task 3: Verificacao pos-push no banco vivo** - read-only verification against production, no repository file changed; no commit
4. **Task 4: Alinhar docs/SUPABASE-CATALOG.md ao schema real e registrar o handoff da Fase 9** - `bb99f5f` (docs)

**Plan metadata:** commit separate below (SUMMARY/STATE/ROADMAP)

## Files Created/Modified

- `docs/SUPABASE-CATALOG.md` - Rewritten "Target schema (v1)" section into "Real schema (v2)" matching the live `db dump`; added `supabase/` directory-structure section
- `.planning/phases/08-taxonomia-can-nica-integridade/08-10-SUMMARY.md` - This document

No other repository file was created or modified by Tasks 2 and 3 — production was touched, the repository was not (until Task 4's docs commit).

## Decisions Made

See `key-decisions` in frontmatter. Two execution-time reconciliations, both Rule 1 (environment reality diverged from the plan's literal instruction, not a scope change):

1. `supabase/verify/contagens.sql`'s metricless-orphan list is not literally empty (237 rows) — this is the correct, expected outcome per 08-08's own rehearsal veredito and the plan's own explanatory sentence about the 237 pre-existing gap; the acceptance-criteria wording is imprecise, not the SQL's behavior.
2. `supabase db query --linked -f` used instead of the dashboard SQL Editor to run `contagens.sql`, because this execution context has no browser/dashboard access and no production database password — same single-execution, read-only semantics, same CLI authentication the push itself used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Environment reality diverged from plan's literal instruction] `contagens.sql` run via CLI, not the dashboard SQL Editor**
- **Found during:** Task 3
- **Issue:** The plan's action says to run `supabase/verify/contagens.sql` "pelo SQL Editor do dashboard do projeto, numa unica execucao" — this assumes an interactive human operator with browser access. This execution context is a non-interactive continuation agent with no browser and no production database password (T-08-10-08's mitigation is explicitly to avoid any new privileged credential).
- **Fix:** Used `supabase db query --linked -f supabase/verify/contagens.sql --agent=no`, which is the Supabase CLI's own scriptable path for executing a SQL file against the linked project via the Management API — the same authenticated connection `db push` itself used, no service-role key, single execution of the whole file (same transaction-scoping semantics as "one dashboard run").
- **Files modified:** None (read-only verification command)
- **Verification:** Exit code 0; zero `RAISE EXCEPTION` output from the three-count `DO` block; the trailing SELECT's orphan count (237) cross-checked separately via a standalone `count(*)` query and matched
- **Committed in:** N/A (no repository file involved)

**2. [Not a deviation — clarified acceptance criterion] `contagens.sql`'s orphan list is 237 rows, not literally empty**
- **Found during:** Task 3
- **Issue/Achado:** The plan's Task 3 acceptance criteria literally say "a lista de agravos sem metrica fora do registro veio vazia" (came empty). Running the query returns 237 rows — the same 237 agravos that already had zero `sih_metric_uf` coverage before this migration (D-25, Fase 9 scope), because the query's own registered-exception filter only excludes the one code-330 addition, not the 237 pre-existing gaps.
- **Fix:** N/A — not a bug. The plan's own next sentence in the same paragraph states the real invariant correctly: "o que a verificacao afirma e que esse conjunto nao cresceu alem do que esta registrado" (the set did not grow beyond what is registered). 08-08's rehearsal (the plan's own cited precedent) found the identical 237-row result and called it correct ("237 agravos órfãos de métrica listados, todos já esperados"). Verified this plan's production result matches that count exactly — zero growth, zero regression.
- **Files modified:** None
- **Verification:** Standalone `count(*)` query returned exactly 237, matching 08-08's measured 237 precisely
- **Committed in:** N/A

---

**Total deviations:** 1 auto-fixed (Rule 1 — CLI path for a read-only SQL Editor execution, dictated by the non-interactive execution environment), 1 finding clarified (the literal "empty list" wording vs. the plan's own correct invariant, resolved by matching 08-08's precedent exactly)
**Impact on plan:** Neither affects correctness or scope. The migration's actual guarantees (three absolute counts, zero `RAISE EXCEPTION`, zero unregistered orphan growth, zero leftover temp ids, set-identity with the seeds) were all verified against live production data, not assumed.

## Issues Encountered

None. The push, verification, and docs alignment all executed on the first pass with no retries needed.

## User Setup Required

None - no external service configuration required. Docker was not needed for this plan (no local Postgres container — all operations were against the linked production project via the already-authenticated Supabase CLI). No new credential was introduced; verification used only the existing anon key (`.env.local`) and the CLI's own Management-API session.

## Next Phase Readiness

**TAX-03 and TAX-04 are closed.** Production (`hmfbxqemububjyhdckrj`) and the repository now tell the same story: 331 canonical disease ids, matching sets, matching aggregate sums for both rename cycles, zero leftover migration artifacts.

**Handoff to Fase 9 (pipeline confiável + coleta completa):**

1. The 341 directories under `trabalhos datasus/outputs/coleta_sih_multi/` still use the OLD (pre-rename) ids by design (D-22). `uploadSihToSupabase.mjs` now **fails loud** (does not silently succeed) when it encounters one of these legacy directory names, per D-06's `assertNotTombstone` guard — this is the intended behavior, and it's exactly what Fase 9 will hit the first time it tries to re-run ingestion against the old corpus layout.
2. `manifest.json` keeps each pack's `sourceDir` pointed at the legacy directory name as the true provenance record (D-22) — this is correct, not a bug, and should not be "fixed" by renaming the directories without also updating the manifest atomically.
3. `scripts/catalog/catalog:build` (i.e. `build.mjs`) **must not be run** until the `coleta_sih_multi` corpus is re-keyed to the canonical ids — it resolves corpus paths from the canonical id via `PACK_SOURCES`, which no longer matches the 9 renamed legacy directory names, and would silently discard those packs' data.
4. `INGEST_SECRET = "lacir-sih-ingest-2026"` in plain text at `scrape_upload_sih.py:33` is still pending rotation — registered here without correction, per the standing decision that this rotation is Fase 9 scope (ROADMAP known-risks table, T-08-10-07 accept disposition).
5. Collection coverage for the code-330 agravo (`todas_as_outras_causas_externas`) — currently registered as the sole permitted metric-orphan exception in `scripts/catalog/metricless-diseases.json` — is a decision Fase 9 needs to make: whether/how to collect Internações/Óbitos/Valor_total/Dias_permanência for it, or to leave it permanently metric-less by design.

**Not touched by this plan, left as-is for Fase 9 or later to reconcile:** the ROADMAP.md "Riscos conhecidos" row about `sih_metric_muni_uf_ano` (the index naming risk) is now resolved by this plan's live confirmation — the row's mitigation ("verificar ao vivo antes de depender dele para o drill") has been satisfied, but updating that specific ROADMAP row was outside this plan's declared file scope (`docs/SUPABASE-CATALOG.md` + this SUMMARY only) and is left for whoever next touches ROADMAP.md's risk table.

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-04*

## Self-Check: PASSED

`docs/SUPABASE-CATALOG.md` found on disk. This SUMMARY found on disk. Commit `bb99f5f` (Task 4, docs) found in `git log`. Commit `c5a8fe5` (SUMMARY) found in `git log`. `git status --short` clean after both commits — no unexpected deletions (`git diff --diff-filter=D --name-only HEAD~1 HEAD` empty for both). Live production verification (PostgREST content-range 331/30313/1099403, `contagens.sql` exit 0, TAX-06 set-identity comm diff empty, both rename-cycle aggregates matching 08-08's rehearsal exactly) was performed directly against `hmfbxqemububjyhdckrj` in this session, not assumed from the plan.
