---
phase: 02-migrar-testes-existentes
plan: 04
subsystem: testing
tags: [correlacao, pearson, spearman, vitest, chart-customizer, differential-parity, flowsteps]

requires:
  - phase: 02-migrar-testes-existentes
    provides: statsEngine port, chart factories, shared Configurar components, ResultsPanelWithCustomizer
provides:
  - Complete Correlação Pearson/Spearman module (engine, interpretation, charts, FlowSteps UI)
  - Differential parity vs legacy Stats at display precision
  - RTL smoke test for Usar exemplo → Resultados path
affects: [02-06]

tech-stack:
  added: []
  patterns: [vm oracle for legacy correlacao module.js in Vitest, method soft-reset on Pearson/Spearman switch D-13]

key-files:
  created:
    - src/features/tests/correlacao/correlacaoConfig.ts
    - src/features/tests/correlacao/correlacaoEngine.ts
    - src/features/tests/correlacao/correlacaoEngineHelpers.ts
    - src/features/tests/correlacao/correlacaoEngine.test.ts
    - src/features/tests/correlacao/correlacaoInterpretation.ts
    - src/features/tests/correlacao/correlacaoInterpretation.test.ts
    - src/features/tests/correlacao/correlacaoCharts.ts
    - src/features/tests/correlacao/CorrelacaoConfigPanel.tsx
    - src/features/tests/correlacao/CorrelacaoDatasusKnobs.tsx
    - src/features/tests/correlacao/CorrelacaoTest.tsx
    - src/features/tests/correlacao/CorrelacaoTest.test.tsx
    - src/features/tests/correlacao/correlacaoDatasusUtils.ts
    - src/test/correlacaoModuleOracle.ts
  modified: []

key-decisions:
  - "Single registry entry with Pearson/Spearman method toggle in Configurar (Pearson default)"
  - "Method switch soft reset keeps paste text, clears confirmed dataset and DATASUS knobs (D-13)"
  - "Engine parity via legacy Stats oracle; interpretation HTML via vm slice (Pitfall 2)"
  - "Module built but not wired in EstatisticaPage — registry flip deferred to 02-06"

patterns-established:
  - "correlacaoModuleOracle: vm-evaluates buildPearson/SpearmanInterpretationHtml from module.js lines"
  - "Interpretation returns string[] only — InterpretationText renders plain paragraphs (T-02-01)"

requirements-completed: [TEST-02]

duration: 8min
completed: 2026-07-25
---

# Phase 02 Plan 04: Correlação Pearson/Spearman Summary

**Pearson/Spearman correlation on FlowSteps with display-rounded legacy parity, customizable scatter charts, and PT interpretation — awaiting registry flip in 02-06**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-25T19:16:00Z
- **Completed:** 2026-07-25T19:24:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Ported correlacao engine with x/y pair builder, statsEngine pearson/spearman, outlier flags, and DATASUS deriveCorrelationPairs wrapper
- Added PT interpretation (string[] paragraphs) with significance conclusion parity for both methods at α=0.05
- Shipped three scatter chart presets wired to ResultsPanelWithCustomizer (default: scatter for Pearson, rank scatter for Spearman)
- Shipped CorrelacaoTest FlowSteps orchestrator with method cards, soft reset, Usar exemplo, DATASUS knobs, and RTL smoke tests (14 tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Port correlacao engine and parity tests** - `4130279` (feat)
2. **Task 2: Port interpretation and chart presets** - `158f4d6` (feat)
3. **Task 3: Wire CorrelacaoTest UI and RTL smoke test** - `6545537` (feat)

## Files Created/Modified

- `src/features/tests/correlacao/correlacaoEngine.ts` - Dataset builder, pearson/spearman, metrics, DATASUS derive, outlier flags
- `src/features/tests/correlacao/correlacaoInterpretation.ts` - Plain PT paragraphs with significance parity helpers
- `src/features/tests/correlacao/correlacaoCharts.ts` - Dispersão, rank scatter, scatter+fit presets
- `src/features/tests/correlacao/CorrelacaoTest.tsx` - FlowSteps orchestrator with ResultsPanelWithCustomizer
- `src/test/correlacaoModuleOracle.ts` - vm slice for legacy interpretation HTML builders

## Decisions Made

- Used legacy Stats oracle for numeric parity (same approach as 02-03) — module.js has no pure runAnalysis export (Pitfall 2)
- vm slice loads buildPearsonInterpretationHtml/buildSpearmanInterpretationHtml for D-07/D-10 conclusion parity tests
- Pearson default; soft reset on method change per D-13 discretion for Correlação

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] vm oracle for legacy module.js interpretation**
- **Found during:** Task 1 (parity test design)
- **Issue:** Vitest cannot import tests/correlacao/module.js due to chart-manager CDN Chart.js dependency (same as 02-03)
- **Fix:** Added `src/test/correlacaoModuleOracle.ts` vm-evaluating interpretation HTML builders; engine parity uses `loadLegacyStatsOracle()` directly on x/y vectors
- **Files modified:** src/test/correlacaoModuleOracle.ts, correlacaoEngine.test.ts, correlacaoInterpretation.test.ts
- **Verification:** 14 tests pass under `npm run test:run -- src/features/tests/correlacao/`
- **Committed in:** 4130279, 158f4d6

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Oracle approach matches 02-03 pattern; no change to user-facing behavior.

## Issues Encountered

None beyond expected module.js import blocker — resolved via vm oracle per RESEARCH Pitfall 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-02 module complete and smoke-tested; ready for EstatisticaPage registry wiring in 02-06
- Parallel-safe with 02-05 (no shared file overlap)

## Self-Check: PASSED

- FOUND: src/features/tests/correlacao/correlacaoEngine.ts
- FOUND: src/features/tests/correlacao/CorrelacaoTest.tsx
- FOUND: src/test/correlacaoModuleOracle.ts
- FOUND: commit 4130279
- FOUND: commit 158f4d6
- FOUND: commit 6545537

---
*Phase: 02-migrar-testes-existentes*
*Completed: 2026-07-25*
