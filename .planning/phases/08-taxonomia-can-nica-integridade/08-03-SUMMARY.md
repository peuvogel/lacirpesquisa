---
phase: 08-taxonomia-can-nica-integridade
plan: 03
subsystem: catalog-pipeline
tags: [catalog, taxonomy, validation, fail-closed, vitest, tabnet]

# Dependency graph
requires:
  - phase: 08-02
    provides: generateFromSnapshot()/buildDiseases()/renderDiseasesJson()/renderListaJson() as pure exports over the committed snapshot, rename-map.json computed from the diff (21 tombstones), and the frozen pre-migration fixture (src/test/fixtures/taxonomy/diseases.pre-migracao.json)
provides:
  - "Five pure, exported invariant functions in scripts/catalog/validate.mjs — checkSlugConsistency (A), checkRegeneration/checkRegenerationFromDisk (B), checkPartition (D), checkColumnMapKeys (D2 extension) — same fail-closed molde as checkEntry, none wired into main() yet"
  - "src/features/catalog/taxonomyInvariants.test.ts — 16 vitest cases proving TAX-02: invariant A run against the frozen pre-migration fixture returns exactly the 21 tombstones from rename-map.json (set-equal, never transcribed), with the avc->outras_doencas_do_olho_e_anexos message asserted literally"
  - "Manual proof (not committed) that reintroducing a KNOWN_BY_CODE-style override makes the invariant fail red, confirming the test suite actually exercises the defect class it exists to catch"
affects: [08-04, 08-05, 08-06, 08-08, 08-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "checkX(data) -> string[] molde extended to four new invariants — never throw/process.exit/console inside the pure function, only main() (unchanged, still not calling any of the five) decides exit code"
    - "columnMap.json standard-column shape (STANDARD_COLUMNS) duplicated by hand in validate.mjs rather than imported from syncColumnMap.mjs, because that script has unconditional top-level disk reads (not a side-effect-free module) — the duplication is intentional, documented inline"
    - "String-exact regeneration diffing (invariant B) reports the first differing character offset plus a short excerpt on each side, rather than a boolean pass/fail, to make a future CLI failure message actionable"

key-files:
  created:
    - src/features/catalog/taxonomyInvariants.test.ts
  modified:
    - scripts/catalog/validate.mjs

key-decisions:
  - "checkSlugConsistency's allowlist is a required parameter (Set<string> | string[]), never a literal inside the function body — the caller derives it from extra-diseases.json's reason field, keeping validate.mjs itself free of any real disease id literal (verified: grep -c amputacao_mmii scripts/catalog/validate.mjs == 0)"
  - "checkRegeneration takes two plain {diseasesText, listaText} bags instead of reading disk itself, so it's directly unit-testable against in-memory mutations; checkRegenerationFromDisk is a thin wrapper that reads scripts/catalog/diseases.json + src/features/catalog/diseases.lista.json and delegates — this is the function main() will call in 08-06 (D-24), not checkRegeneration directly"
  - "checkPartition's four message shapes (both-sides, neither-side, disease-without-snapshot-or-extras, empty-reason) are distinguished by structure, not by an error-code enum, matching the PT-BR free-text convention already used by checkEntry"
  - "checkColumnMapKeys checks the five standard columns for exact id+label match against the canonical disease, and checks every other (non-standard) sih.-prefixed column only on the id's middle path segment — this is what will catch columnMap.json's cnes.*/sidra.* shared columns being left alone while sih.<id>.* leaves get validated"

patterns-established:
  - "Regression-proof-by-mutation as manual verification step for new invariants: temporarily reintroduce the exact defect class the invariant exists to catch (here, a KNOWN_BY_CODE-style override), confirm the relevant test goes red, then revert and confirm git diff is clean — done for invariant A per this plan's own acceptance criteria, not committed to the repo"

requirements-completed: [TAX-01, TAX-02, TAX-06]

# Metrics
duration: ~10min
completed: 2026-08-03
---

# Phase 8 Plan 3: Invariantes A, B, D, D2 + prova de TAX-02 contra a fixture pré-migração Summary

**Quatro invariantes de taxonomia (slug, regeneração byte-idêntica, partição completa, chaves de `columnMap.json`) escritos como funções puras no molde de `checkEntry`, com prova executável de que o invariante A acusa exatamente os 21 registros corrompidos do `rename-map.json` ao rodar contra a fixture pré-migração — nenhum ligado ao `main()` ainda.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-03T22:04:43-03:00 (immediately after 08-02's completion commit)
- **Completed:** 2026-08-03T22:15:04-03:00
- **Tasks:** 2/2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `scripts/catalog/validate.mjs` gained five new exported pure functions — `checkSlugConsistency`, `checkRegeneration`, `checkRegenerationFromDisk`, `checkPartition`, `checkColumnMapKeys` — all following the existing fail-closed molde (`string[]` return, never throw/exit), none called from `main()` (verified: `catalog:validate` still exits 0 and prints `catalog:validate OK`)
- Ran the four invariants live against real repo data as a sanity check before writing the vitest suite: invariant A returns exactly 21 errors against the pre-migration fixture (matching `rename-map.json`'s 21 tombstones exactly), 0 against the canonical regeneration (with allowlist), and exactly 1 (`amputacao_mmii`) without an allowlist; invariant D returns 0 against real snapshot+exclusions+canonical+extras
- `src/features/catalog/taxonomyInvariants.test.ts` — 16 vitest cases (above the 12-case floor) proving TAX-02's literal claim ("o bug avc para 163 seria barrado"): the central case asserts `checkSlugConsistency` over the frozen fixture returns a message set identical to `rename-map.json`'s `tombstones` array (derived, never transcribed — `grep -c "'ait'"` returns 0), and that the `avc` message cites the exact expected slug `outras_doencas_do_olho_e_anexos`
- Manually proved the test suite is load-bearing, not just self-consistent: temporarily reintroduced a `KNOWN_BY_CODE`-style override (`code === '163' ? 'avc' : slugify(...)`) into `buildDiseases()` in `sync-lista-morb.mjs`, reran the suite, watched the two "taxonomia canônica passa limpo" cases go red (2 failed / 14 passed), then reverted and confirmed `git diff --stat scripts/catalog/sync-lista-morb.mjs` was empty before continuing — this change was never committed
- Invariant B's formatting-asymmetry case (`diseases.json` indented vs `diseases.lista.json` minified) is explicitly covered: re-serializing the runtime array with 2-space indentation instead of minified is caught as a `diseases.lista.json` divergence
- The extension D2 (`checkColumnMapKeys`) is proven against three synthetic scenarios — a tombstone key with no matching disease, a `lista_morb` disease missing its pack key entirely, and a leaf whose `label` was swapped for another disease's — the third being the direct analog of the misleading `sih.avc_uf` → "AVC" labels that currently exist in the real `columnMap.json`
- The repo's shipped taxonomy remains untouched: `scripts/catalog/diseases.json`, `src/features/catalog/diseases.lista.json`, and `scripts/catalog/columnMap.json` do not appear in `git status` after this plan's work — none of the five new functions were called from `main()`

## Task Commits

1. **Task 1: Invariantes A, B, D e D2 como funcoes puras em validate.mjs** - `bfed06f` (feat)
2. **Task 2: Prova de TAX-02 — invariantes rodando contra a fixture pre-migracao** - `850c585` (test)

_No separate plan-metadata commit — this SUMMARY/STATE/ROADMAP update commit follows below._

## Files Created/Modified
- `scripts/catalog/validate.mjs` - Added `checkSlugConsistency`/`checkRegeneration`/`checkRegenerationFromDisk`/`checkPartition`/`checkColumnMapKeys` plus two small private helpers (`firstDiffOffset`, `regenerationDiffMessage`) and a hand-kept `STANDARD_COLUMNS` table mirroring `syncColumnMap.mjs`'s column shape; imports `slugify` from `listaMorbSource.mjs`, `generateFromSnapshot` from `sync-lista-morb.mjs`, and `ROOT` from `paths.mjs`
- `src/features/catalog/taxonomyInvariants.test.ts` - New vitest file (235 lines, 16 cases) under `src/` per the blocking test-location constraint (08-VALIDATION.md); imports cross-tree from `../../../scripts/catalog/validate.mjs`, `sync-lista-morb.mjs`, and `listaMorbSource.mjs`

## Decisions Made
See `key-decisions` in frontmatter. All were implementation-detail choices within the scope Claude's Discretion granted by 08-CONTEXT.md (exact split of invariants between CLI and vitest was already decided in 08-01/08-02's `validate.mjs` molde; this plan only extended it). No architectural decisions were needed — D-24 (renaming and invariants in the same commit) is honored by construction: none of the five functions are called from `main()`.

## Deviations from Plan

None — plan executed exactly as written. One thing worth flagging as a near-miss, caught before commit: the first draft of `checkPartition`'s JSDoc comment used the literal string `amputacao_mmii` as an example, which would have failed the Task 1 acceptance criterion `grep -c "amputacao_mmii" scripts/catalog/validate.mjs` returning `0`. Caught by running the grep check proactively before committing (not after a red gate), rewritten to reference "segunda fonte de entrada (D-14)" instead. Not logged as a Rule 1-3 deviation since it was corrected during initial authoring, before the file was ever staged.

## Issues Encountered

TypeScript build (`tsc -b`) initially failed on two `Record<string, unknown>` annotations in the D2 test cases — `checkColumnMapKeys`'s JSDoc parameter type (`Record<string, Record<string, {id?, label?}>>`) doesn't structurally accept `Record<string, unknown>` because `unknown` isn't assignable to the nested object type. Fixed by introducing a local `SyntheticColumnMap` type alias matching the actual JSDoc shape and typing the two mutable test fixtures against it instead of `unknown`. Verified with `npx tsc -b` (clean) and a full `npm run test:run` rerun (100 files / 707 tests) after the fix — not logged as a deviation since it was corrected during initial authoring of the new test file, before it was staged or committed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `checkSlugConsistency`, `checkRegeneration`, `checkRegenerationFromDisk`, `checkPartition`, and `checkColumnMapKeys` are ready, tested, and importable for plan 08-06, which is where D-24 wires them into `validate.mjs`'s `main()` in the same commit as the actual id rename — until then the gate stays green because nothing calls them
- `checkRegenerationFromDisk()` is the specific entry point 08-06's `main()` should call (not `checkRegeneration` directly) — it already knows how to read `scripts/catalog/diseases.json` and `src/features/catalog/diseases.lista.json` from disk
- `checkColumnMapKeys` is ready to run against the real `scripts/catalog/columnMap.json` once a plan regenerates it post-rename; this plan only proved it against synthetic fixtures, per the plan's own scope (D2's real-data pass is future work, not required here)
- `npm run gate` is green (100 test files / 707 tests, typecheck clean, build succeeds)
- Downstream plans should be aware that `checkPartition`'s message format cites `tabnetCode` (not `id`) for partition violations, and `checkColumnMapKeys`'s messages cite the pack key (`sih.<id>_uf`) plus column name — useful for anyone writing a future CLI failure-preview against these once wired in 08-06

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 3 created/referenced files found on disk (scripts/catalog/validate.mjs, src/features/catalog/taxonomyInvariants.test.ts, this SUMMARY). Both task commits (bfed06f, 850c585) found in git log.
