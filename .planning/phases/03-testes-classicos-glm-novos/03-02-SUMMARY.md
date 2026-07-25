---
phase: 03-testes-classicos-glm-novos
plan: 02
subsystem: tests
tags: [chi-square, contingency, cramers-v, assumption-nudges, flowsteps, jasp-golden]

requires:
  - phase: 03-testes-classicos-glm-novos
    plan: 01
    provides: runChiSquareIndependence, AssumptionNudgeStrip, golden fixtures
provides:
  - Complete qui-quadrado module (engine + ConfigPanel + FlowSteps + chart)
  - contingencyChart factory (observed vs expected grouped bars)
  - ColumnPreviewTable categorical-pair confirm mode
affects: [03-05, 03-03, 03-04]

tech-stack:
  added: []
  patterns: [categorical-only TABULAR_OPTIONS, computeAssumptionNudges with Fisher tip for 2×2 sparse]

key-files:
  created:
    - src/features/tests/qui-quadrado/quiQuadradoConfig.ts
    - src/features/tests/qui-quadrado/quiQuadradoEngine.ts
    - src/features/tests/qui-quadrado/quiQuadradoEngine.test.ts
    - src/features/tests/qui-quadrado/quiQuadradoInterpretation.ts
    - src/features/tests/qui-quadrado/quiQuadradoInterpretation.test.ts
    - src/features/tests/qui-quadrado/quiQuadradoCharts.ts
    - src/features/tests/qui-quadrado/QuiQuadradoConfigPanel.tsx
    - src/features/tests/qui-quadrado/QuiQuadradoTest.tsx
    - src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx
    - src/shared/charts/chartFactories/contingencyChart.ts
  modified:
    - src/routes/estatistica/ColumnPreviewTable.tsx

key-decisions:
  - "Categorical columns use String trim only — never statsEngine.parseNumber in dataset builder"
  - "ColumnPreviewTable confirmMode categorical-pair enables χ² without fake numeric role"
  - "Registry left em-breve until 03-05 Wave A gate"

patterns-established:
  - "Qui-quadrado engine: build contingency from row-level categoricals → runChiSquareIndependence"
  - "Results: AssumptionNudgeStrip above ResultsPanelWithCustomizer with exportFilename qui-quadrado-lacirstat.png"

requirements-completed: [TEST-04, UX-02]

duration: 8min
completed: 2026-07-25
---

# Phase 3 Plan 02: Qui-quadrado Module Summary

**Chi-square independence module with JASP golden parity, Cramér's V metrics, expected-cell nudges, and observed-vs-expected chart — registry deferred to 03-05.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-25T21:28:00Z
- **Completed:** 2026-07-25T21:36:00Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- Ported `quiQuadradoEngine` building 3×2 contingency from two categorical columns with golden parity at fmtP/fmtNumber precision
- Shipped `computeAssumptionNudges` warning on expected < 5 (% cells) plus Fisher tip for sparse 2×2 tables
- Complete FlowSteps UI with `AssumptionNudgeStrip`, interpretation, and `contingencyChart` grouped-bar preset + PNG export
- Extended `ColumnPreviewTable` with `categorical-pair` confirm mode for Phase 3 frequency tests

## Task Commits

1. **Task 1: Port qui-quadrado engine and golden tests** — `b81cc85` (feat)
2. **Task 2: Port interpretation, contingency chart, and FlowSteps UI** — `92cdced` (feat)

## Files Created/Modified

- `src/features/tests/qui-quadrado/*` — full module (config, engine, interpretation, charts, UI, tests)
- `src/shared/charts/chartFactories/contingencyChart.ts` — pure ChartData+Options observed vs expected bars
- `src/routes/estatistica/ColumnPreviewTable.tsx` — `confirmMode: categorical-pair` + `onRoleAdjust`

## Test Results

```
npm run test:run -- src/features/tests/qui-quadrado/
→ 20 passed (engine 8, interpretation 3, UI 2, plus ColumnPreviewTable regression)

npm run typecheck
→ pre-existing failures in postHocHeatmapChart.ts / chartOverrides.ts (unrelated)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] ColumnPreviewTable blocked categorical-only confirm**
- **Found during:** Task 2 UI smoke testing
- **Issue:** Default validation required a numeric column role — χ² exemplo could never reach "Analisar dados"
- **Fix:** Added `confirmMode: 'categorical-pair'` validating requiredKeys mapping via `deriveRecognizedColumnsFromRoles`
- **Files modified:** `src/routes/estatistica/ColumnPreviewTable.tsx`, `QuiQuadradoConfigPanel.tsx`
- **Commit:** `92cdced`

**2. [Rule 2 - Missing Critical] Soft-reset on role change wiring**
- **Found during:** Task 2 ConfigPanel
- **Issue:** Plan requires D-13 soft-reset on role change; no mode toggle in χ² module
- **Fix:** `onRoleAdjust` callback on ColumnPreviewTable clears confirmed results and shows SoftResetAlert
- **Commit:** `92cdced`

## Self-Check: PASSED

- FOUND: src/features/tests/qui-quadrado/QuiQuadradoTest.tsx
- FOUND: src/features/tests/qui-quadrado/quiQuadradoEngine.ts
- FOUND: src/shared/charts/chartFactories/contingencyChart.ts
- FOUND: commit b81cc85
- FOUND: commit 92cdced

## Known Stubs

None — module computes full results for exemplo fixture; registry flip intentionally deferred to 03-05.

## Threat Flags

None beyond plan mitigations (string[] interpretation, 20×20 cap via statsEngine, categorical coercion validation).

## Next Phase Readiness

- Module mountable in `EstatisticaPage` during 03-05 Wave A gate
- `contingencyChart.ts` reusable if other frequency visualizations needed
- `categorical-pair` confirm mode ready for any two-categorical test

---
*Phase: 03-testes-classicos-glm-novos*
*Completed: 2026-07-25*
