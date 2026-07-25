---
phase: 03-testes-classicos-glm-novos
plan: 03
subsystem: ui
tags: [anova, tukey, post-hoc, heatmap, assumption-nudges, flowsteps, golden-parity]

requires:
  - phase: 03-testes-classicos-glm-novos
    plan: 01
    provides: statsEngine oneWayAnova/tukeyHsd, AssumptionNudgeStrip, golden fixtures
provides:
  - Complete anova-tukey feature module (engine + UI + charts + tests)
  - postHocHeatmapChart factory for Wave A2 modules (03-04 reuse)
  - Pairwise table pattern between nudge strip and ResultsPanelWithCustomizer
affects: [03-04, 03-05]

tech-stack:
  added: []
  patterns: [PairwiseRow sorted by pAdj, heatmap preset gated at k≤6, Kruskal cross-nudge via onNavigateTest]

key-files:
  created:
    - src/features/tests/anova-tukey/anovaEngine.ts
    - src/features/tests/anova-tukey/AnovaTukeyTest.tsx
    - src/shared/charts/chartFactories/postHocHeatmapChart.ts
    - src/shared/charts/chartFactories/anovaChart.ts
  modified: []

key-decisions:
  - "Registry flip and EstatisticaPage mount deferred to 03-05 per plan"
  - "Heatmap preset uses scatter visualType; gallery shows catalog label Dispersão with id chart-type-heatmap"
  - "DoS caps: max 20 groups and 10k total observations before Tukey all-pairs"

patterns-established:
  - "Post-hoc table: Comparações par a par section with ColumnPreviewTable-style mono bordered table"
  - "computeAssumptionNudges: unequal n ratio>3 or SD ratio>2 → warning + kruskal-dunn CTA; k=2 → t-Student info"

requirements-completed: [TEST-05, UX-02]

duration: 8min
completed: 2026-07-25
---

# Phase 3 Plan 03: ANOVA+Tukey Module Summary

**One-way ANOVA + Tukey HSD module with JASP golden parity, pairwise table, optional p-adjusted heatmap (k≤6), and Kruskal cross-nudges — registry flip deferred to 03-05.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-25T21:28:00Z
- **Completed:** 2026-07-25T21:31:06Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- Ported `anovaEngine` wrapping `statsEngine.oneWayAnova` + `tukeyHsd` with golden parity and assumption nudges (UX-02)
- Shipped `AnovaTukeyTest` FlowSteps shell: nudge strip → pairwise table → metrics/charts/interpretation
- Added `anovaChart` (group means + CI) and `postHocHeatmapChart` (Tukey p-adjusted matrix) for 03-04 reuse
- 16 Vitest cases green across engine, interpretation, and RTL smoke

## Task Commits

1. **Task 1: Port ANOVA+Tukey engine and golden tests** — `ddce42a` (feat)
2. **Task 2: UI with pairwise table, charts, and FlowSteps shell** — `9e99781` (feat)

## Files Created/Modified

- `src/features/tests/anova-tukey/*` — full module (config, engine, interpretation, charts, Test, tests)
- `src/shared/charts/chartFactories/anovaChart.ts` — group means bar preset data
- `src/shared/charts/chartFactories/postHocHeatmapChart.ts` — adjusted-p heatmap for k≤6

## Test Results

```
npm run test:run -- src/features/tests/anova-tukey/
→ 16 passed

npm run typecheck
→ pre-existing chartOverrides.ts error only; new anova/postHoc files clean
```

## Decisions Made

- Used existing `ColumnPreviewTable.onRoleAdjust` for soft-reset on grupo/desfecho role edits (no ColumnPreviewTable fork)
- RTL heatmap assertion uses `#chart-type-heatmap` because ResultsPanel maps scatter presets to catalog label "Dispersão"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Golden Tukey test assumed first sorted row equals golden contrast**
- **Found during:** Task 1 engine tests
- **Issue:** Sorting by pAdj puts A−C first, not A−B
- **Fix:** Match golden row by contrast string; assert sort order separately
- **Commit:** `ddce42a`

**2. [Rule 3 - Blocking] postHocHeatmapChart tooltip TypeScript errors**
- **Found during:** Task 2 typecheck
- **Issue:** `item.raw` typed as unknown in Chart.js callbacks
- **Fix:** Cast raw points to `{ x: number; y: number }`
- **Commit:** `9e99781`

None beyond the above — registry intentionally not flipped (03-05).

## TDD Gate Compliance

Task 1 marked `tdd="true"` — engine tests and implementation landed in a single feat commit (`ddce42a`) after RED/GREEN in one session. Separate test-only commit not created.

## Issues Encountered

None blocking. Global `npm run typecheck` still fails on pre-existing `chartOverrides.ts` (not introduced by this plan).

## User Setup Required

None.

## Next Phase Readiness

- Module ready for Wave A gate once 03-04 (Kruskal) and 03-05 (registry + EstatisticaPage wiring) complete
- `postHocHeatmapChart.ts` available for Kruskal-Dunn plan dependency

## Self-Check: PASSED

- FOUND: src/features/tests/anova-tukey/AnovaTukeyTest.tsx
- FOUND: src/shared/charts/chartFactories/postHocHeatmapChart.ts
- FOUND: commit ddce42a
- FOUND: commit 9e99781

---
*Phase: 03-testes-classicos-glm-novos*
*Completed: 2026-07-25*
