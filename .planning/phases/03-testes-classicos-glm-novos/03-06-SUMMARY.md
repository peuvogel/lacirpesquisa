---
phase: 03-testes-classicos-glm-novos
plan: 06
subsystem: testing
tags: [poisson, glm, overdispersion, chart.js, vitest]

requires:
  - phase: 03-01
    provides: glmEngine.fitPoisson IRLS core
  - phase: 03-05
    provides: EstatisticaHandoffState cross-test navigation pattern
provides:
  - Complete poisson feature module (engine, UI, charts, tests)
  - glmCoefForestChart shared factory for NB and Logistic
  - Overdispersion nudge + explicit NB handoff CTA (no auto-switch)
affects: [03-07, 03-08, 03-09]

tech-stack:
  added: []
  patterns:
    - GLM module clone from Wave A shell with AssumptionNudgeStrip + ResultsPanelWithCustomizer
    - Poisson→NB handoff via onNavigateTest whitelist (binomial-negativa only)

key-files:
  created:
    - src/features/tests/poisson/poissonConfig.ts
    - src/features/tests/poisson/poissonEngine.ts
    - src/features/tests/poisson/poissonEngine.test.ts
    - src/features/tests/poisson/poissonInterpretation.ts
    - src/features/tests/poisson/poissonInterpretation.test.ts
    - src/features/tests/poisson/poissonCharts.ts
    - src/features/tests/poisson/PoissonConfigPanel.tsx
    - src/features/tests/poisson/PoissonTest.tsx
    - src/features/tests/poisson/PoissonTest.test.tsx
    - src/shared/charts/chartFactories/glmCoefForestChart.ts
  modified: []

key-decisions:
  - "Registry flip deferred to 03-09 — module complete but not mounted in EstatisticaPage yet"
  - "Overdispersion threshold 1.25 (χ²/gl) triggers warning + NB CTA; user must navigate explicitly"
  - "Didactic scope: contagem + one numeric preditor (main effects only)"

patterns-established:
  - "Poisson engine: buildDatasetFromConfirmed → validate → fitPoisson → overdispersionRatio metric"
  - "NB handoff preserves recognizedColumns; handleCrossTestHandoff whitelists binomial-negativa"

requirements-completed: [TEST-07, UX-02]

duration: 8min
completed: 2026-07-25
---

# Phase 3 Plan 06: Regressão de Poisson Summary

**Poisson GLM module with JASP golden parity, overdispersion χ²/gl check, and explicit Binomial Negativa handoff CTA**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files created:** 10

## Accomplishments

- Shipped `poissonEngine` wrapping `glmEngine.fitPoisson` with validation, metrics, and assumption nudges
- Golden parity vs `poisson-exemplo.golden.json` at display precision (coefficients, p, deviance, overdispersion ratio)
- Full FlowSteps UI with forest chart preset, interpretation, soft-reset, and dual NB CTAs (nudge strip + actions button)
- Added reusable `glmCoefForestChart.ts` for Wave B GLM modules

## Task Commits

1. **Task 1: Port Poisson engine and golden tests** - `a05cf11` (feat)
2. **Task 2: GLM forest chart and Poisson FlowSteps UI** - `96c7a3d` (feat)

## Files Created/Modified

- `src/features/tests/poisson/poissonEngine.ts` - Dataset builder, fit wrapper, overdispersion nudges
- `src/features/tests/poisson/PoissonTest.tsx` - FlowSteps orchestrator with NB handoff
- `src/shared/charts/chartFactories/glmCoefForestChart.ts` - Horizontal coefficient forest factory

## Decisions Made

- Registry and EstatisticaPage mount deferred to 03-09 per plan — module is test-complete in isolation
- Overdispersed nudge test uses synthetic paste data (NB exemplo is not overdispersed under Poisson fit)
- NB navigation whitelisted to `binomial-negativa` only (T-03-06-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed overdispersion test fixture**
- **Found during:** Task 1 (engine nudge tests)
- **Issue:** `binomial-negativa-exemplo` Poisson fit yields χ²/gl ≈ 0.92, not > 1.25
- **Fix:** Use synthetic equi-exposure counts with high variance for overdispersion nudge assertions
- **Files modified:** `poissonEngine.test.ts`
- **Committed in:** `a05cf11`

None otherwise — plan executed as written.

## Issues Encountered

- Pre-existing `chartOverrides.ts` typecheck error unrelated to this plan (out of scope)

## Next Phase Readiness

- `glmCoefForestChart` ready for 03-07 (Binomial Negativa) and 03-08 (Logística)
- 03-09 should flip registry + wire `PoissonTest` in `EstatisticaPage` with `onNavigateTest`

## Self-Check: PASSED

- FOUND: src/features/tests/poisson/poissonEngine.ts
- FOUND: src/features/tests/poisson/PoissonTest.tsx
- FOUND: src/shared/charts/chartFactories/glmCoefForestChart.ts
- FOUND: .planning/phases/03-testes-classicos-glm-novos/03-06-SUMMARY.md
- FOUND: commit a05cf11
- FOUND: commit 96c7a3d

---
*Phase: 03-testes-classicos-glm-novos*
*Completed: 2026-07-25*
