---
phase: 02-migrar-testes-existentes
plan: 02
subsystem: ui
tags: [chart.js, chart-factories, chart-customizer, shadcn, react, vitest]

requires:
  - phase: 02-migrar-testes-existentes
    plan: 01
    provides: chartjs-plugin-annotation registration, Stats engine, ChartCanvas annotation wiring
provides:
  - Pure chart factory builders (t-Student, scatter, timeseries, residual)
  - ChartCustomizer + useChartCustomizer with debounced options merge
  - ResultsPanelWithCustomizer 62/38 layout for migrated tests
  - Six shared Configurar components (DidacticCards, AlphaSelector, etc.)
affects: [02-03, 02-04, 02-05, 02-06]

tech-stack:
  added: [shadcn collapsible, select, label, switch]
  patterns: [pure ChartData+Options factories, debounced customizer merge ~150ms, axis label sanitization 120 chars, D-06 demo stays on plain ResultsPanel]

key-files:
  created:
    - src/shared/charts/chartFactories/tStudentCharts.ts
    - src/shared/charts/chartFactories/scatterChart.ts
    - src/shared/charts/chartFactories/timeseriesChart.ts
    - src/shared/charts/chartFactories/residualChart.ts
    - src/shared/charts/chartFactories/index.ts
    - src/shared/charts/chartFactories/chartFactories.test.ts
    - src/shared/charts/useChartCustomizer.ts
    - src/shared/charts/useChartCustomizer.test.ts
    - src/shared/charts/ChartCustomizer.tsx
    - src/shared/charts/ResultsPanelWithCustomizer.tsx
    - src/features/tests/shared/DidacticCards.tsx
    - src/features/tests/shared/AlphaSelector.tsx
    - src/features/tests/shared/ResearchQuestionField.tsx
    - src/features/tests/shared/ModeChoiceCard.tsx
    - src/features/tests/shared/SoftResetAlert.tsx
    - src/features/tests/shared/UseExampleButton.tsx
    - src/features/tests/shared/sharedComponents.test.tsx
    - src/components/ui/collapsible.tsx
    - src/components/ui/select.tsx
    - src/components/ui/label.tsx
    - src/components/ui/switch.tsx
  modified: []

key-decisions:
  - "Chart factories return pure { data, options } — no imperative Chart() instantiation"
  - "Theme variant merge preserves existing scale title config (spread base scale before grid override)"
  - "Demo (TesteDemo) unchanged — ResultsPanelWithCustomizer only for migrated tests per D-06"
  - "Axis title inputs sanitized/truncated to 120 chars (T-02-01 mitigation)"

patterns-established:
  - "useChartCustomizer: presets + debounced mergeCustomizerIntoOptions before ChartCanvas update"
  - "ModeChoiceCard: role=radiogroup container, role=radio cards with aria-checked, 44px min height"

requirements-completed: [TEST-01, TEST-02, TEST-03]

duration: 3min
completed: 2026-07-25
---

# Phase 02 Plan 02: Shared chart infrastructure + Configurar components Summary

**Pure chart factories from chart-manager.js, ChartCustomizer with debounced merge and 3 theme variants, ResultsPanelWithCustomizer layout, and six reusable Configurar building blocks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-25T19:12:25Z
- **Completed:** 2026-07-25T19:15:20Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- Ported all chart-manager.js render functions to pure `build*` factories returning ChartData + ChartOptions with pt-BR tooltip formatters
- Built ChartCustomizer panel (tipo de gráfico, eixos, anotações, tema visual) with `useChartCustomizer` hook debouncing ~150ms for PNG-safe canvas updates
- Created ResultsPanelWithCustomizer with 62/38 desktop grid and collapsible customizer on mobile; TesteDemo unchanged on plain ResultsPanel
- Shipped six shared Configurar components with UI-SPEC copy, ARIA roles, and RTL smoke tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Port chart factories from chart-manager.js** - `8b58df2` (feat)
2. **Task 2: Build ChartCustomizer and ResultsPanelWithCustomizer** - `2fec815` (feat)
3. **Task 3: Create shared Configurar components** - `ac2e4d1` (feat)

**Plan metadata:** `f953bc1` (docs: complete plan)

## Files Created/Modified

- `src/shared/charts/chartFactories/*.ts` - Pure data/options builders for t-Student, Pearson/Spearman scatter, Prais timeseries/residual
- `src/shared/charts/useChartCustomizer.ts` - Preset switch, axis/annotation/theme state, debounced options merge
- `src/shared/charts/ChartCustomizer.tsx` - Deep customize panel with UI-SPEC copy
- `src/shared/charts/ResultsPanelWithCustomizer.tsx` - Metrics + chart/customizer grid + interpretation + PNG export
- `src/features/tests/shared/*.tsx` - DidacticCards, AlphaSelector, ResearchQuestionField, ModeChoiceCard, SoftResetAlert, UseExampleButton

## Decisions Made

- Theme variant grid merge spreads existing scale config before applying grid color — prevents wiping axis titles set by customizer
- ChartCustomizer axis labels pass through `sanitizeAxisLabel` (120 char max) as Chart.js text options only — never innerHTML (T-02-01)
- Demo stays on plain ResultsPanel; migrated tests mount ResultsPanelWithCustomizer in plans 02-03 through 02-05

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Theme variant merge wiped axis title config**
- **Found during:** Task 2 (useChartCustomizer debounce test)
- **Issue:** `applyThemeVariant` shallow-merged `scales.x` with only `{ grid }`, replacing title set by axis label merge
- **Fix:** Spread existing scale config before applying grid color override
- **Files modified:** `src/shared/charts/useChartCustomizer.ts`
- **Verification:** `useChartCustomizer.test.ts` debounce test passes; typecheck clean
- **Committed in:** `2fec815`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correct axis title display after theme changes. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Verification

- `npm run test:run -- src/shared/charts/chartFactories/chartFactories.test.ts` — 8/8 passed
- `npm run test:run -- src/shared/charts/useChartCustomizer.test.ts` — 5/5 passed
- `npm run test:run -- src/features/tests/shared/sharedComponents.test.tsx` — 3/3 passed
- `npm run test:run` — 282/282 passed
- `npm run typecheck` — clean
- TesteDemo unchanged: no `ResultsPanelWithCustomizer` import (grep confirmed)

## Next Phase Readiness

- Chart factories, customizer, and shared Configurar components ready for t-Student engine wiring in 02-03
- Correlação (02-04) and Prais-Winsten (02-05) can reuse same infrastructure
- Registry flip and EstatisticaPage mount deferred to 02-06 as planned

## Self-Check: PASSED

- FOUND: src/shared/charts/chartFactories/index.ts
- FOUND: src/shared/charts/ChartCustomizer.tsx
- FOUND: src/shared/charts/ResultsPanelWithCustomizer.tsx
- FOUND: src/features/tests/shared/ModeChoiceCard.tsx
- FOUND: 8b58df2, 2fec815, ac2e4d1

---
*Phase: 02-migrar-testes-existentes*
*Completed: 2026-07-25*
