---
phase: 03-testes-classicos-glm-novos
plan: 04
subsystem: ui
tags: [kruskal-wallis, dunn, post-hoc, heatmap, assumption-nudges, flowsteps, golden-parity]

requires:
  - phase: 03-testes-classicos-glm-novos
    plan: 01
    provides: statsEngine kruskalWallis/dunnPostHoc/rank, AssumptionNudgeStrip, golden fixtures
  - phase: 03-testes-classicos-glm-novos
    plan: 03
    provides: postHocHeatmapChart factory, anovaChart factory, pairwise table pattern
provides:
  - Complete kruskal-dunn feature module (engine + UI + charts + tests)
  - Nonparametric Wave A2b counterpart to ANOVA+Tukey
affects: [03-05]

tech-stack:
  added: []
  patterns: [Dunn Holm pAdj sort, median chart via anovaChart adapter, rank-alternative nudge always-on]

key-files:
  created:
    - src/features/tests/kruskal-dunn/kruskalEngine.ts
    - src/features/tests/kruskal-dunn/KruskalDunnTest.tsx
    - src/features/tests/kruskal-dunn/kruskalCharts.ts
  modified: []

key-decisions:
  - "Registry flip and EstatisticaPage mount deferred to 03-05 per plan"
  - "Dunn pairwise table omits IC column (Dunn z-stat only; no CI from engine)"
  - "Median summary reuses anovaChart via synthetic OneWayAnovaResult with median as mean"

patterns-established:
  - "Kruskal nudges: always rank-alternative info; k=2 Mann-Whitney + single-contrast tip; k≥3 Dunn table tip"
  - "Pairwise table between AssumptionNudgeStrip and ResultsPanelWithCustomizer (same as ANOVA)"

requirements-completed: [TEST-06, UX-02]

duration: 2min
completed: 2026-07-25
---

# Phase 3 Plan 04: Kruskal-Wallis + Dunn Module Summary

**Kruskal-Wallis + Dunn post-hoc module with JASP golden parity, Holm-adjusted pairwise table, median/heatmap charts reusing 03-03 factories — registry flip deferred to 03-05.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-25T21:31:00Z
- **Completed:** 2026-07-25T21:32:44Z
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments

- Ported `kruskalEngine` wrapping `statsEngine.kruskalWallis` + `dunnPostHoc` with golden parity and assumption nudges (UX-02)
- Shipped `KruskalDunnTest` FlowSteps shell: nudge strip → pairwise table → metrics/charts/interpretation
- Reused `anovaChart` (median summary) and `postHocHeatmapChart` (Dunn p-adjusted matrix, k≤6) from 03-03
- 16 Vitest cases green across engine, interpretation, and RTL smoke

## Task Commits

1. **Task 1: Port Kruskal+Dunn engine and golden tests** — `7f9d994` (feat)
2. **Task 2: UI with pairwise table and FlowSteps shell** — `28e65ae` (feat)

## Files Created/Modified

- `src/features/tests/kruskal-dunn/*` — full module (config, engine, interpretation, charts, Test, tests)

## Test Results

```
npm run test:run -- src/features/tests/kruskal-dunn/
→ 16 passed

npm run typecheck
→ pre-existing chartOverrides.ts error only; new kruskal files clean
```

## Decisions Made

- Dunn table shows contrast, z-statistic, p ajustado (no IC — engine does not provide Dunn CIs)
- Median chart adapts `buildAnovaMeansChartData` by mapping medians to groupStats.mean
- Registry intentionally not flipped (03-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RTL nudge test matched multiple elements**
- **Found during:** Task 2 KruskalDunnTest.test.tsx
- **Issue:** `getByText(/postos|ranks/)` matched interpretation and metric hints too
- **Fix:** Assert specific rank-alternative nudge message + `data-testid="assumption-nudge-strip"`
- **Commit:** `28e65ae`

None beyond the above — plan executed as written.

## TDD Gate Compliance

Task 1 marked `tdd="true"` — engine tests and implementation landed in a single feat commit (`7f9d994`). Separate test-only RED commit not created.

## Issues Encountered

None blocking. Global `npm run typecheck` still fails on pre-existing `chartOverrides.ts` (not introduced by this plan).

## User Setup Required

None.

## Next Phase Readiness

- Module ready for Wave A gate once 03-05 (registry + EstatisticaPage wiring) completes
- Parallel-safe with 03-03; reuses `postHocHeatmapChart.ts` without modification

## Self-Check: PASSED

- FOUND: src/features/tests/kruskal-dunn/KruskalDunnTest.tsx
- FOUND: src/features/tests/kruskal-dunn/kruskalEngine.ts
- FOUND: commit 7f9d994
- FOUND: commit 28e65ae

---
*Phase: 03-testes-classicos-glm-novos*
*Completed: 2026-07-25*
