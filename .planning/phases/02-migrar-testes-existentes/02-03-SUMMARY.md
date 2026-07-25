---
phase: 02-migrar-testes-existentes
plan: 03
subsystem: testing
tags: [t-student, welch, vitest, chart-customizer, differential-parity, flowsteps]

requires:
  - phase: 02-migrar-testes-existentes
    provides: statsEngine port, chart factories, shared Configurar components, ResultsPanelWithCustomizer
provides:
  - Complete t de Student module (engine, interpretation, charts, FlowSteps UI)
  - Differential parity vs tests/t-student/module.js at display precision
  - RTL smoke test for Usar exemplo → Resultados path
affects: [02-06]

tech-stack:
  added: []
  patterns: [vm oracle for legacy module.js in Vitest, wide-format tabular aliases, soft reset on mode switch D-13]

key-files:
  created:
    - src/features/tests/t-student/tStudentConfig.ts
    - src/features/tests/t-student/tStudentEngine.ts
    - src/features/tests/t-student/tStudentEngine.test.ts
    - src/features/tests/t-student/tStudentInterpretation.ts
    - src/features/tests/t-student/tStudentInterpretation.test.ts
    - src/features/tests/t-student/tStudentCharts.ts
    - src/features/tests/t-student/TStudentConfigPanel.tsx
    - src/features/tests/t-student/TStudentDatasusKnobs.tsx
    - src/features/tests/t-student/TStudentTest.tsx
    - src/features/tests/t-student/TStudentTest.test.tsx
    - src/features/tests/t-student/tStudentDatasusUtils.ts
    - src/test/tStudentModuleOracle.ts
  modified: []

key-decisions:
  - "Welch-only independent path labeled t independente (Welch); no equal-variance toggle (D-14)"
  - "Mode switch soft reset keeps paste text, clears confirmed dataset and DATASUS knobs (D-13)"
  - "Legacy module.js parity via vm slice oracle — direct ESM import blocked by chart-manager CDN URL"
  - "Module built but not wired in EstatisticaPage — registry flip deferred to 02-06"

patterns-established:
  - "tStudentModuleOracle: vm-evaluates safeWelch/safePaired/buildManualInterpretation from module.js lines"
  - "Interpretation returns string[] only — InterpretationText renders plain paragraphs (T-02-01)"

requirements-completed: [TEST-01]

duration: 6min
completed: 2026-07-25
---

# Phase 02 Plan 03: t de Student Module Summary

**Welch/paired t-Student on FlowSteps with display-rounded legacy parity, customizable charts, and PT interpretation — awaiting registry flip in 02-06**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-25T19:16:00Z
- **Completed:** 2026-07-25T19:22:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Ported `safeWelch`/`safePaired` engine with wide-format dataset builder, UI-SPEC validation messages, and DATASUS derive wrapper
- Added PT interpretation (string[] paragraphs) and three chart presets wired to `ResultsPanelWithCustomizer` (default: diff IC95%)
- Shipped `TStudentTest` FlowSteps orchestrator with mode cards, soft reset, Usar exemplo, DATASUS knobs, and RTL smoke tests (13 tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Port t-Student engine and differential tests** - `169d5a6` (feat)
2. **Task 2: Port interpretation and chart presets** - `c079243` (feat)
3. **Task 3: Wire TStudentTest FlowSteps UI and RTL smoke test** - `b62c596` (feat)

## Files Created/Modified

- `src/features/tests/t-student/tStudentEngine.ts` - Welch/paired computation, dataset builder, metrics, DATASUS derive
- `src/features/tests/t-student/tStudentInterpretation.ts` - Plain PT interpretation paragraphs
- `src/features/tests/t-student/tStudentCharts.ts` - Chart preset definitions for customizer
- `src/features/tests/t-student/TStudentTest.tsx` - FlowSteps orchestrator (Dados → Configurar → Resultados)
- `src/test/tStudentModuleOracle.ts` - Vm oracle for legacy module.js exports in Vitest

## Decisions Made

- Default mode independent (Welch label visible); paired via mode choice cards (D-12)
- Research question trimmed to 500 chars at interpretation build time (T-02-04)
- DATASUS derive uses normalized preview from wizard session via minimal `datasusSourceFromPublic` adapter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vm oracle instead of direct module.js ESM import**
- **Found during:** Task 1 (tStudentEngine.test.ts)
- **Issue:** `tests/t-student/module.js` imports `chart-manager.js` which loads Chart.js from `https://` CDN — Vitest ESM loader rejects it
- **Fix:** Created `src/test/tStudentModuleOracle.ts` vm-slicing `safeWelch`/`safePaired`/`buildManualInterpretation` from module.js source lines
- **Files modified:** `src/test/tStudentModuleOracle.ts`, test imports updated
- **Verification:** 6 engine + 4 interpretation differential tests pass
- **Committed in:** `169d5a6`, `c079243`

**2. [Rule 1 - Bug] TABNET derive test category selection**
- **Found during:** Task 1 (engine derive fixture test)
- **Issue:** Default slice(0,2)/slice(2,4) yielded vectors.A.length=1 (ok:false) — insufficient for Welch smoke assertion
- **Fix:** Filter Total category; use 3+2 category split ensuring ≥2 observations per group
- **Files modified:** `tStudentEngine.test.ts`
- **Verification:** TABNET derive parity test passes
- **Committed in:** `169d5a6`, `b62c596`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Oracle approach preserves D-09 differential parity intent; no scope change.

## Issues Encountered

None beyond deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-01 module complete and smoke-tested; ready for registry flip in 02-06 (`EstatisticaPage` wiring)
- Correlação/Prais plans can reuse shared components and oracle pattern established here

## Self-Check: PASSED

- FOUND: src/features/tests/t-student/TStudentTest.tsx
- FOUND: src/features/tests/t-student/tStudentEngine.test.ts
- FOUND: src/test/tStudentModuleOracle.ts
- FOUND: commit 169d5a6
- FOUND: commit c079243
- FOUND: commit b62c596

---
*Phase: 02-migrar-testes-existentes*
*Completed: 2026-07-25*
