---
phase: 02-migrar-testes-existentes
plan: 01
subsystem: testing
tags: [vitest, stats-engine, datasus, chartjs-plugin-annotation, differential-parity]

requires:
  - phase: 01-redesign-base-react-shell
    provides: parseTabular/datasusNormalizer ports, ChartCanvas, legacyAdapters partial Stats
provides:
  - Full Stats engine port with legacy differential parity
  - derive* numeric verification on TABNET fixtures
  - chartjs-plugin-annotation registration helper
  - Six committed test fixtures (3 exemplo + 3 TABNET derive)
affects: [02-02, 02-03, 02-04, 02-05, 02-06]

tech-stack:
  added: [chartjs-plugin-annotation@^3.1.0]
  patterns: [vm-loaded legacy Stats oracle, display-rounded parity via fmtP/fmtNumber, idempotent Chart.register for annotations]

key-files:
  created:
    - src/shared/stats/statsEngine.ts
    - src/shared/stats/statsEngine.test.ts
    - src/shared/charts/chartAnnotationSetup.ts
    - src/test/legacyStatsOracle.ts
    - src/shared/data-input/datasusNormalizer.derive.test.ts
    - src/test/fixtures/tests/t-student-exemplo.txt
    - src/test/fixtures/tests/correlacao-exemplo.txt
    - src/test/fixtures/tests/prais-exemplo.txt
    - src/test/fixtures/tabnet/t-student-derive.txt
    - src/test/fixtures/tabnet/correlacao-derive.txt
    - src/test/fixtures/tabnet/prais-derive.txt
  modified:
    - package.json
    - package-lock.json
    - src/shared/data-input/legacyAdapters.ts
    - src/shared/data-input/types.ts
    - src/shared/charts/ChartCanvas.tsx

key-decisions:
  - "Legacy Stats oracle loaded via vm from app.js:240-533 slice (app.js does not export Stats)"
  - "LegacyStatsAdapter extended with full Stats surface typed via statsEngine result interfaces"
  - "derive test buildSource normalizes parsed TABNET before getCategoryOptions/getMetricOptions"

patterns-established:
  - "displayParity helper: assert fmtP/fmtNumber/fmtSigned equality for D-08 rounded parity"
  - "TABNET derive fixtures require normalizeDatasusSource before derive* calls"

requirements-completed: [TEST-01, TEST-02, TEST-03]

duration: 12min
completed: 2026-07-25
---

# Phase 02 Plan 01: Wave 0 Stats + derive parity Summary

**Full Stats engine port with vm-oracle differential tests, derive* TABNET verification, and chartjs-plugin-annotation registered once**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T19:09:00Z
- **Completed:** 2026-07-25T19:21:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Ported entire `Stats` object from `assets/js/app.js:240-533` to `statsEngine.ts` with differential parity suite (welchT, pearson, spearman, rank, tcdf, tInv, fisherCI, praisWinsten)
- Installed `chartjs-plugin-annotation@^3.1.0` after approved checkpoint; idempotent registration via `chartAnnotationSetup.ts` wired into `ChartCanvas`
- Verified all four `derive*` helpers against legacy `datasus-normalizer.js` on dedicated TABNET fixtures; committed six exemplo/TABNET fixtures per D-09

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify chartjs-plugin-annotation legitimacy and install** - `8038648` (chore)
2. **Task 2: Port full Stats engine with differential parity tests** - `6f0d8fd` (feat)
3. **Task 3: Verify derive* helpers and commit parity fixtures** - `07c2809` (test)

## Files Created/Modified

- `src/shared/stats/statsEngine.ts` - Full typed Stats port (pearson, welchT, praisWinsten, tcdf, etc.)
- `src/shared/stats/statsEngine.test.ts` - Differential parity vs vm-loaded legacy Stats
- `src/test/legacyStatsOracle.ts` - Read-only vm harness for untouched app.js Stats slice
- `src/shared/charts/chartAnnotationSetup.ts` - One-time Annotation plugin registration
- `src/shared/data-input/datasusNormalizer.derive.test.ts` - derive* differential parity on TABNET fixtures
- `src/test/fixtures/tests/*.txt` - Exemplo fixtures from test config.json files
- `src/test/fixtures/tabnet/*-derive.txt` - TABNET derive oracles per test module

## Decisions Made

- Used `vm.runInNewContext` on the app.js Stats slice because `app.js` does not export `Stats` and importing the full module pulls DOM/manifest bootstrap code
- Extended `LegacyStatsAdapter` with typed result interfaces imported from `statsEngine.ts` rather than loose Record types
- derive test `buildSource` calls `normalizeDatasusSource` so category/metric options populate from normalized records

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] derive fixtures needed normalized source before derive***
- **Found during:** Task 3 (derive.test.ts)
- **Issue:** `getCategoryOptions`/`getMetricOptions` read `source.normalized` — parsed-only sources returned empty arrays
- **Fix:** `buildSource` now attaches `normalizeDatasusSource` result before derive calls
- **Files modified:** `src/shared/data-input/datasusNormalizer.derive.test.ts`
- **Verification:** All 7 derive tests pass
- **Committed in:** `07c2809`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for derive* tests to exercise real TABNET data; no scope creep.

## Issues Encountered

None beyond the normalized-source requirement above.

## User Setup Required

None — chartjs-plugin-annotation install completed after human-approved checkpoint.

## Next Phase Readiness

- Wave 0 gate complete: Stats port and derive* verification green
- Ready for 02-02+ test module UI/engine plans
- Existing `parseTabular.test.ts` parity suite remains green

## Self-Check: PASSED

- FOUND: src/shared/stats/statsEngine.ts
- FOUND: src/shared/stats/statsEngine.test.ts
- FOUND: src/shared/data-input/datasusNormalizer.derive.test.ts
- FOUND: src/test/fixtures/tests/t-student-exemplo.txt
- FOUND: src/test/fixtures/tabnet/t-student-derive.txt
- FOUND: 8038648
- FOUND: 6f0d8fd
- FOUND: 07c2809

---
*Phase: 02-migrar-testes-existentes*
*Completed: 2026-07-25*
