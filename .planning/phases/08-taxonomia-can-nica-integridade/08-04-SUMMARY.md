---
phase: 08-taxonomia-can-nica-integridade
plan: 04
subsystem: catalog-pipeline
tags: [catalog, taxonomy, rename-engine, supabase-guard, sql-seeds, vitest]

# Dependency graph
requires:
  - phase: 08-02
    provides: rename-map.json (21 renames, 1 addition, 21 tombstones, computed from the diff, D-12), generateFromSnapshot() as the pure canonical-taxonomy source, and the frozen pre-migration fixture (src/test/fixtures/taxonomy/diseases.pre-migracao.json)
provides:
  - "scripts/catalog/tombstones.mjs — single source of tombstone ids and anchored patterns (TOMBSTONES/CANONICAL_BY_OLD read from rename-map.json, tombstonePatterns, findTombstoneHits, assertNotTombstone), shared by the rename engine and (in a later plan) invariant F so rewrite and scan can never disagree"
  - "scripts/catalog/uploadSihToSupabase.mjs guarded with assertNotTombstone on every corpus directory name and every disease_id row before upsert — refuses hemorroidas/embolia_pulmonar (the two verified rename cycles) same as any other tombstone (D-06)"
  - "scripts/catalog/applyRenameMap.mjs — the rename engine (--dry-run/--apply/--check), proven in dry-run to cover packs, manifest.json, variables.json, columnMap.json and code-source with sobras: 0 and zero disk mutation; --apply itself refuses to run until 08-06"
  - "scripts/catalog/generateDiseaseSeeds.mjs — renderSeedChunks(diseases, chunkSize), proven byte-identical against the five committed sql/*.sql when fed the pre-migration fixture; main() not run"
  - "src/features/catalog/tombstones.test.ts — 8 vitest cases covering seed fidelity, anchored-pattern precision (three legacy forms excluded, three agravo forms matched), and the write-path guard"
  - "package.json: catalog:apply-rename and catalog:seeds scripts (not chained into pretest/gate)"
affects: [08-05, 08-06, 08-08, 08-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single combined regex (one regex.exec pass over the original text) instead of a sequential per-rename replace loop, specifically to make the two rename cycles (186<->187, 173<->182) resolve correctly in one pass without a freshly-written canonical id being re-matched by a later rename in the same pass"
    - "Fresh-object-build (never in-place key mutation) for columnMap.json/variables.json/manifest.json transforms — sidesteps the two-cycle collision entirely, since every source key/entry maps independently into a brand-new destination object"
    - "sobras (leftover) count after simulating a rewrite excludes ids that are simultaneously a tombstone and the canonical target of a different rename — their correct post-rename reappearance is not a bug, applied identically in applyRenameMap.mjs and in the seed-fidelity test"
    - "Scope-exclusion allowlist for code-source files whose old-id literals are historical-fact assertions about rename-map.json's own immutable content, not living identity references — same molde applied twice (renameMap.test.ts from 08-02, tombstones.test.ts from this plan)"

key-files:
  created:
    - scripts/catalog/tombstones.mjs
    - scripts/catalog/applyRenameMap.mjs
    - scripts/catalog/generateDiseaseSeeds.mjs
    - src/features/catalog/tombstones.test.ts
  modified:
    - scripts/catalog/uploadSihToSupabase.mjs
    - package.json

key-decisions:
  - "CANONICAL_BY_OLD maps old id -> canonical id string (not a richer object); assertNotTombstone's error message only needs the canonical id to satisfy D-06's 'cite id + contexto + canonico' requirement"
  - "tombstonePatterns' three anchored forms (packId sih.<old>_uf, variableIdPrefix sih.<old>., bareQuoted quote-delimited) are each verified in this plan against the actual repo content to confirm they exclude the three legacy forms (parseCsv.mjs column names, paths.mjs/mergeMultiIntoLegacyCsv.mjs corpus dir and file names) by construction, not by an exception list"
  - "applyRenameMap.mjs's code-source substitution uses one combined regex.exec pass (not N sequential per-rename replace() calls) specifically because a sequential loop would let one cycle's freshly-written canonical text be re-matched and corrupted by the other cycle's rename in the same pass — proven necessary, not just tidier, by tracing the 186/187 and 173/182 cycles through the actual columnMap.json data"
  - "Excluded src/features/catalog/renameMap.test.ts and src/features/catalog/tombstones.test.ts from the rename engine's code-source scope: both assert historical facts about rename-map.json's own content (which old ids exist, which two are cycles) that stay true forever regardless of whether the live taxonomy has flipped — rewriting their literals would make a currently-true assertion false once 08-06 runs --apply"

patterns-established:
  - "Any new invariant or engine that scans/rewrites by anchored id pattern must be tested against the two verified rename cycles specifically (186<->187, 173<->182), not just against a generic id — this is where naive text substitution silently corrupts data, and it only shows up when you trace an id that is both a tombstone and someone else's canonical target through the actual pipeline"

requirements-completed: [TAX-06]

# Metrics
duration: ~25min
completed: 2026-08-04
---

# Phase 8 Plan 4: Motor de renomeacao (dry-run), guarda Supabase e seeds geradas Summary

**`tombstones.mjs` como fonte unica de padroes ancorados e guarda de escrita no Supabase (D-06), `applyRenameMap.mjs` como motor de renomeacao provado em dry-run (9 packs, 50 entradas de `variables.json`, 21 chaves de `columnMap.json`, 22 arquivos de codigo, `sobras: 0`), e `generateDiseaseSeeds.mjs` reproduzindo os `sql/*.sql` commitados byte a byte — nada renomeado ainda.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-03T22:20:00-03:00 (immediately after 08-03's completion commit)
- **Completed:** 2026-08-03T22:44:13-03:00
- **Tasks:** 3/3 completed
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- `scripts/catalog/tombstones.mjs` is the single source of truth for dead ids: `TOMBSTONES`/`CANONICAL_BY_OLD` read from `rename-map.json` (zero literal ids in the module — `grep -c "'avc'"` returns 0), `tombstonePatterns(oldId)` returning the three anchored forms, `findTombstoneHits` shared by the rename engine now and by invariant F in a later plan, and `assertNotTombstone` — the only throwing function, guarding the write path
- Verified against real repo content, not assumption: the anchored patterns produce zero hits on `parseCsv.mjs`'s legacy CSV column names and on `paths.mjs`'s corpus `sourceDir`, while correctly matching `paths.mjs`'s `LEGACY_PACKS` key and its duplicated `disease.id === 'embolia_trombose'` guard
- `scripts/catalog/uploadSihToSupabase.mjs` now calls `assertNotTombstone` on every `coleta_sih_multi` directory name before building rows, and on every `disease_id` in every row before each upsert — confirmed to throw for both `hemorroidas` and `embolia_pulmonar` (the two ids that are simultaneously a tombstone and someone else's canonical id today)
- `scripts/catalog/applyRenameMap.mjs` (`--dry-run` default / `--apply` / `--check`) computes, from `rename-map.json` alone, exactly what would change in each artifact: 9 pack files (never `sih.amputacao_mmii_uf`), 9 `manifest.json` packIds (sourceDir preserved, D-22), 50 `variables.json` entries, 21 `columnMap.json` key moves + 21 prunes, and 22 code-source files (build.mjs, paths.mjs, syncColumnMap.mjs, syncPackImports.mjs, taxonomy.ts, catalogAnalysisData.ts, mockAnalysisData.ts, and 15 test files) — then simulates every substitution in memory and confirms `sobras: 0`. `git status` stays clean after running it; `--apply` refuses to run in this plan (08-06 applies it, per D-24)
- Discovered and traced the two verified rename cycles (186↔187, 173↔182) through the actual `columnMap.json` data during implementation: a naive sequential per-rename text replace would let one cycle's freshly-written canonical text get re-matched and corrupted by the other cycle's rename in the same pass. Fixed by using one combined `regex.exec` pass over the original text instead of N sequential `replace()` calls — proven correct by re-running the dry-run and confirming `sobras: 0` with the actual two-cycle data present in `columnMap.json`
- `scripts/catalog/generateDiseaseSeeds.mjs` exports `renderSeedChunks(diseases, chunkSize)`; applied to the frozen pre-migration fixture (330 entries, chunk 80) it reproduces all five committed `sql/0.sql`..`sql/4.sql` byte-for-byte (verified with no normalization — exact string equality, including the no-trailing-newline / no-trailing-comma-on-last-row details). Applied to the canonical taxonomy (`generateFromSnapshot()`, 331 entries) it produces 5 chunks summing 331 value lines, last chunk 11, last entry `amputacao_mmii`. `main()` was not run — `git status` shows no change under `scripts/catalog/sql/`
- `src/features/catalog/tombstones.test.ts` — 8 vitest cases (above the 7-case floor): seed fidelity against the real committed files, canonical-taxonomy shape, zero tombstones in generated seeds (net of the two legitimate cycle reappearances), the three legacy forms staying unmatched, the three agravo forms matching with correct `form` labels, and the write-path guard throwing for both cycle ids and not for `amputacao_mmii`

## Task Commits

1. **Task 1: tombstones.mjs — padroes ancorados e guarda de escrita (D-06)** - `e233b0c` (feat)
2. **Task 2: applyRenameMap.mjs — o motor de renomeacao, em dry-run** - `38709c7` (feat)
3. **Task 3: generateDiseaseSeeds.mjs — seeds SQL geradas, com prova de fidelidade** - `d1bcccd` (feat)
4. **Post-hoc fix (Rule 1, found during Task 3 re-verification):** `e30caab` (fix) — excluded `tombstones.test.ts` from the engine's own scope

_No separate plan-metadata commit — this SUMMARY/STATE/ROADMAP update commit follows below._

## Files Created/Modified
- `scripts/catalog/tombstones.mjs` - `TOMBSTONES`/`CANONICAL_BY_OLD`/`tombstonePatterns`/`findTombstoneHits`/`assertNotTombstone`, all derived from `rename-map.json`, no id literal
- `scripts/catalog/uploadSihToSupabase.mjs` - `assertNotTombstone` on every corpus directory name and every row's `disease_id` before upsert
- `scripts/catalog/applyRenameMap.mjs` - three-mode rename engine (`--dry-run`/`--apply`/`--check`), per-artifact plan functions for packs/manifest/variables/columnMap, single-pass combined-regex code-source substitution, `sobras` leftover count with cycle-aware exclusion, scope-exclusion allowlist for `renameMap.test.ts` and `tombstones.test.ts`
- `scripts/catalog/generateDiseaseSeeds.mjs` - `renderSeedChunks(diseases, chunkSize)` exported pure function + CLI `main()` that clears and rewrites `sql/*.sql`
- `src/features/catalog/tombstones.test.ts` - 8 vitest cases covering Task 1 and Task 3
- `package.json` - added `catalog:apply-rename` and `catalog:seeds` scripts

## Decisions Made
See `key-decisions` in frontmatter. The one decision not pre-locked by 08-CONTEXT.md: whether `applyRenameMap.mjs`'s code-source substitution could be a simple sequential per-rename `replace()` loop, resolved by tracing the two verified cycles through real `columnMap.json` data and finding it corrupts one cycle's output — switched to a single combined-regex pass, which resolves both cycles correctly by construction (each old-id token is matched and replaced exactly once against the original text).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Excluded `applyRenameMap.mjs`'s own doc-comment example from triggering its own scan**
- **Found during:** Task 2, first dry-run run
- **Issue:** A doc comment explaining why `renameMap.test.ts` is excluded quoted `'hemorroidas'` as an example, which the engine's own scan then flagged as an occurrence to rewrite in `applyRenameMap.mjs` itself — violating the plan's own requirement that the engine contain no id literal
- **Fix:** Rewrote the comment to describe the cycle without quoting the literal id
- **Files modified:** scripts/catalog/applyRenameMap.mjs
- **Verification:** `findTombstoneHits` over the file's own text returns 0 hits; `grep -c "'embolia_trombose'"` returns 0
- **Committed in:** `38709c7` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Excluded `renameMap.test.ts` from the rename engine's code-source scope**
- **Found during:** Task 2, while verifying the dry-run report against the plan's acceptance criteria (report initially listed 23 files / 16 test files instead of the expected 22 / 15)
- **Issue:** `renameMap.test.ts` (created in 08-02) asserts things like "the `old` field of the tabnetCode-186 rename record equals a specific dead id" against the *committed* `rename-map.json`, which never changes after the flip. The engine's anchored patterns matched its old-id literals (10 occurrences) and would have rewritten them to the canonical form, making a permanently-true assertion false the next time 08-06 runs `--apply`
- **Fix:** Added a `SCOPE_EXCLUDE_RELATIVE_PATHS` allowlist to `applyRenameMap.mjs`, documented inline with the exact rationale (same class of exclusion as `rename-map.json` itself: this is the one other place an old id is legitimately permanent, not a tombstone to purge)
- **Files modified:** scripts/catalog/applyRenameMap.mjs
- **Verification:** dry-run report now lists exactly 15 test files (matching the plan's stated blast-radius count) and 22 code-source files total; `sobras: 0` unchanged
- **Committed in:** `38709c7` (Task 2 commit)

**3. [Rule 1 - Bug] Excluded `tombstones.test.ts` (this plan's own Task 3 deliverable) from the rename engine's scope**
- **Found during:** Task 3, during the plan-level overall re-verification step (after all three tasks were already committed)
- **Issue:** The `assertNotTombstone` cycle-id test cases in the newly-created `tombstones.test.ts` name `hemorroidas`/`embolia_pulmonar` specifically as the two verified cycle ids and assert the thrown message cites their canonical target — the same historical-fact-assertion pattern as `renameMap.test.ts`. Rewriting the first argument to its own canonical form would make `assertNotTombstone` stop throwing for it (no longer a tombstone), flipping `.toThrow(...)` to red once `--apply` runs in 08-06
- **Fix:** Added `src/features/catalog/tombstones.test.ts` to the same `SCOPE_EXCLUDE_RELATIVE_PATHS` allowlist, with inline rationale distinguishing it from the file's other (rewrite-safe) `'avc'`-based test cases
- **Files modified:** scripts/catalog/applyRenameMap.mjs
- **Verification:** dry-run report returns to 22 code-source files (from a transient 23), `sobras: 0`; full `npm run gate` green (101 files / 715 tests, typecheck clean, build succeeds)
- **Committed in:** `e30caab` (separate follow-up commit, since Tasks 1-3 were already committed when this was found — not amended, per no-amend policy)

---

**Total deviations:** 3 auto-fixed (1 self-referential literal in a doc comment, 2 missing-critical scope exclusions preventing future test corruption)
**Impact on plan:** All three are necessary for `applyRenameMap.mjs` to be safe to run as-is in 08-06 without manual patching. No scope creep — all three were found by directly exercising the engine (running `--dry-run`, tracing the two verified cycles, and re-verifying after commit) rather than speculative hardening.

## Issues Encountered

The two verified rename cycles (186↔187 `hemorroidas`, 173↔182 `embolia_pulmonar`) surfaced as a real correctness question in three separate places during this plan, not just the one place D-06 explicitly calls out (the Supabase write guard):
1. `applyRenameMap.mjs`'s code-source substitution (fixed with a single combined-regex pass instead of sequential replace)
2. The "sobras" leftover count after simulating the rewrite (both in the engine and in the seed-fidelity test) — a canonical id that is textually identical to a *different* tombstone is a correct reappearance, not a leftover, so both `sobras` counters explicitly exclude the two cycle ids from what counts as a leftover, with the exclusion set derived from `rename-map.json` data (`Object.values(CANONICAL_BY_OLD).filter(c => TOMBSTONES.includes(c))`) rather than hand-typed, keeping the "never hand-transcribe ids" discipline (D-12) intact even for this narrower exclusion
3. Two test files (one from 08-02, one from this plan) whose assertions are tied to the *specific string values* of the two cycle ids as historical facts, not living references — both excluded from the rename engine's scope

None of these were anticipated in the plan's `<action>` text or `08-PATTERNS.md`; all three were found by actually running the engine against the real 21-rename dataset rather than a simplified example, which is exactly why the plan requires proving `sobras: 0` in dry-run before any `--apply` is allowed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `scripts/catalog/applyRenameMap.mjs --dry-run` is the acceptance gate for this plan and is green (`sobras: 0`, `git status` clean)
- `--apply` is implemented but refuses to run — 08-06 is expected to remove that refusal (or call the exported plan functions directly) in the same commit as wiring the five invariants from 08-03 into `validate.mjs`'s `main()`, per D-24
- `--check` is implemented and correctly reports the current (pre-flip) state as failing (359 tombstone hits in scope today) — this is expected and will be the post-`--apply` acceptance check in 08-06
- `generateDiseaseSeeds.mjs`'s `main()` is ready for 08-06 to invoke once `diseases.json` has actually been regenerated — running it today would just reproduce today's (still-corrupted) seeds
- Downstream plans should be aware of the `SCOPE_EXCLUDE_RELATIVE_PATHS` allowlist in `applyRenameMap.mjs`: any future test file that asserts specific old-id values as historical facts about `rename-map.json` (rather than using them as interchangeable examples) needs to be added there before `--apply` runs
- `npm run gate` is green (101 test files / 715 tests, typecheck clean, build succeeds)

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 6 created/referenced files found on disk. All 4 commits (e233b0c, 38709c7, d1bcccd, e30caab) found in git log.
