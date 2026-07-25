---
phase: 03-testes-classicos-glm-novos
plan: 07
subsystem: testing
tags: [glm, negative-binomial, poisson-handoff, vitest, chart.js]

requires:
  - phase: 03-06
    provides: Poisson module with NB handoff CTA and shared GLM shell
provides:
  - Complete binomial-negativa feature folder (engine + UI)
  - fitNegativeBinomial wrapper with θ metric and equidispersion info nudge
  - Handoff bootstrap via handoffRecognizedColumns prop (D-20)
affects: [03-09-registry-flip, EstatisticaPage]

tech-stack:
  added: []
  patterns:
    - "Clone Poisson GLM shell for NB with fitNegativeBinomial"
    - "sanitizeRecognizedColumns filters out-of-range handoff indices"
    - "glmCoefForestChart preset for coefficient forest"

key-files:
  created:
    - src/features/tests/binomial-negativa/binomialNegativaEngine.ts
    - src/features/tests/binomial-negativa/BinomialNegativaTest.tsx
    - src/features/tests/binomial-negativa/binomialNegativaConfig.ts
    - src/features/tests/binomial-negativa/binomialNegativaCharts.ts
  modified: []

key-decisions:
  - "handoffRecognizedColumns prop mirrors KruskalDunnTest pattern — registry wiring deferred to 03-09"
  - "Info nudge explains θ equidispersion relaxation whenever theta is finite (D-06)"
  - "sanitizeRecognizedColumns drops out-of-range indices on bootstrap (T-03-07-01)"

patterns-established:
  - "NB module accepts Poisson handoff column roles without re-parsing paste"

requirements-completed: [TEST-08, UX-02]

duration: 8min
completed: 2026-07-25
---

# Phase 3 Plan 07: Binomial Negativa Summary

**Negative Binomial GLM module with θ dispersion metric, equidispersion info nudge, and Poisson handoff column bootstrap**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-25T21:38:06Z
- **Completed:** 2026-07-25T21:46:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- NB engine matches JASP golden (`binomial-negativa-exemplo.golden.json`) at display precision including θ
- Complete FlowSteps UI with forest chart preset, interpretation, and assumption nudge strip
- Handoff bootstrap preserves `recognizedColumns` from Poisson CTA with index sanitization
- 13 tests green across engine, interpretation, and component smoke flows

## Task Commits

Each task was committed atomically:

1. **Task 1: Port NB engine and golden tests** - `58217de` (feat)
2. **Task 2: NB UI with handoff bootstrap and FlowSteps shell** - `83a57e2` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/features/tests/binomial-negativa/binomialNegativaConfig.ts` - TABULAR_OPTIONS, didactic cards, example fixture
- `src/features/tests/binomial-negativa/binomialNegativaEngine.ts` - fitNegativeBinomial wrapper, metrics, nudges
- `src/features/tests/binomial-negativa/binomialNegativaEngine.test.ts` - golden parity, θ metrics, nudge tests
- `src/features/tests/binomial-negativa/binomialNegativaInterpretation.ts` - plain PT interpretation with θ context
- `src/features/tests/binomial-negativa/binomialNegativaCharts.ts` - glmCoefForestChart + observed vs predicted presets
- `src/features/tests/binomial-negativa/BinomialNegativaConfigPanel.tsx` - configure step with ColumnPreviewTable
- `src/features/tests/binomial-negativa/BinomialNegativaTest.tsx` - FlowSteps orchestrator with handoff bootstrap
- `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx` - smoke, handoff, soft-reset tests
- `src/features/tests/binomial-negativa/binomialNegativaInterpretation.test.ts` - interpretation and chart preset tests

## Decisions Made

- Registry and EstatisticaPage wiring intentionally omitted — plan 03-09 owns the flip
- Handoff uses `handoffRecognizedColumns` prop (same as KruskalDunnTest) rather than reading location.state directly in the test module
- Equidispersion info nudge always shown when θ is finite, per D-06 minimum nudge set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing `tsc` error in `src/shared/charts/chartOverrides.ts` (unrelated to this plan) — NB module tests pass independently

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NB module complete and ready for registry flip in 03-09
- EstatisticaPage needs `case 'binomial-negativa'` and Poisson import when registry goes live
- Parallel-safe with 03-08 (Logística)

## Self-Check: PASSED

- FOUND: src/features/tests/binomial-negativa/binomialNegativaEngine.ts
- FOUND: src/features/tests/binomial-negativa/BinomialNegativaTest.tsx
- FOUND: commit 58217de
- FOUND: commit 83a57e2

---
*Phase: 03-testes-classicos-glm-novos*
*Completed: 2026-07-25*
