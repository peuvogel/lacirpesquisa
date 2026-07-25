---
phase: 05-variaveis-no-site-scrape-referencias
plan: 02
subsystem: infra
tags: [catalog, validate, provenance, pretest, d-05, d-06, typescript, node-esm]

requires:
  - phase: 05-variaveis-no-site-scrape-referencias
    provides: public/data/catalog packs + variables.json from 05-01
provides:
  - Fail-closed catalog:validate (D-05/D-06) with shared CNES/pop cross-pack check
  - Shared CatalogEntry/Manifest/PackFile TypeScript types
  - pretest + test:run wiring for catalog:validate (D-10)
affects:
  - 05-03 loadCatalog / Variáveis UI
  - 05-05 Mapas catalogAnalysisData swap
  - CI and local npm test runs

tech-stack:
  added: []
  patterns:
    - Hand-check validate.mjs (no Zod) exporting checkEntry/checkCatalog for vitest
    - pretest + explicit test:run chain both gate on catalog:validate

key-files:
  created:
    - src/features/catalog/types.ts
    - scripts/catalog/validate.mjs
    - src/features/catalog/validateCatalogEntry.test.ts
  modified:
    - package.json

key-decisions:
  - "Pure validation lives in validate.mjs (exported) so CLI and vitest share one rule set"
  - "Shared CNES/pop metrics fail closed on divergence across packs (RESEARCH A2)"
  - "test:run explicitly chains catalog:validate; pretest covers npm test / vitest interactive"

patterns-established:
  - "Orphan/incomplete provenance never ships — validate exits non-zero with stderr list"
  - "CatalogEntry types mirror D-05 mandatory fields used by validate"

requirements-completed: [CAT-02, CAT-05]

duration: 1min
completed: 2026-07-25
---

# Phase 5 Plan 02: Schema + validation gate Summary

**Fail-closed `catalog:validate` enforces D-05/D-06 provenance (http(s) URL, methodology, loadable pack columns, unique ids, shared CNES/pop equality) with shared TypeScript types and pretest wiring — zero new deps**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-07-25T22:40:55Z
- **Completed:** 2026-07-25T22:42:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Exported `VariableType`, `CatalogEntry`, `Manifest`, `PackFile`, `PackRow` in `src/features/catalog/types.ts`
- Implemented `scripts/catalog/validate.mjs` with `checkEntry` / `checkCatalog` (fail-closed); committed catalog exits 0 (~0.4s)
- Vitest suite proves orphan fixtures fail; valid mini catalog and committed assets pass
- Wired `pretest` + `test:run` to run `catalog:validate` before vitest

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing provenance tests** - `913f847` (test)
2. **Task 1 (GREEN): types + validate.mjs** - `2da3f55` (feat)
3. **Task 2: pretest / test:run wiring** - `a325472` (chore)

**Plan metadata:** `f2309fb` (docs: complete plan)

## Files Created/Modified

- `src/features/catalog/types.ts` — shared catalog schema types (D-05)
- `scripts/catalog/validate.mjs` — fail-closed gate over `public/data/catalog`
- `src/features/catalog/validateCatalogEntry.test.ts` — unit coverage for orphan/URL/loadable/duplicate/shared rules
- `package.json` — `pretest`, `test:run` chain; existing `catalog:build` / `catalog:validate` kept

## Decisions Made

- Single source of validation rules in `validate.mjs` (imported by vitest) rather than duplicating checks in TypeScript
- Cross-pack shared metrics (`medicos_vasculares_sus`, `populacao`, `medicos_vasculares_por_100k`) hard-fail on first divergence sample
- Keep interactive `npm test` gated via npm `pretest`; CI-style `test:run` also chains validate explicitly

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED: `913f847` — `test(05-02): add failing test for catalog provenance validation`
- GREEN: `2da3f55` — `feat(05-02): fail-closed catalog provenance validation gate`
- REFACTOR: not needed

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `catalog:validate` is enforceable for 05-03+ consumers of `variables.json` / packs
- Ready for loadCatalog UI and Mapas facade swap to assume provenance-complete entries

## Self-Check: PASSED

- FOUND: `src/features/catalog/types.ts`
- FOUND: `scripts/catalog/validate.mjs`
- FOUND: `src/features/catalog/validateCatalogEntry.test.ts`
- FOUND: commit `913f847`
- FOUND: commit `2da3f55`
- FOUND: commit `a325472`
- FOUND: `npm run catalog:validate` exit 0

---
*Phase: 05-variaveis-no-site-scrape-referencias*
*Completed: 2026-07-25*
