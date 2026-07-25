---
phase: 01-redesign-base-react-shell
plan: 04
subsystem: ui
tags: [chart.js, react-hooks, pt-BR-formatting, vitest, canvas-export]

requires:
  - phase: 01-01
    provides: Vite/React/Tailwind v4 scaffold, shadcn primitives, vitest+jsdom test harness
provides:
  - "src/shared/format.ts — pt-BR number formatting (fmtNumber/fmtP/fmtSigned) shared by every result screen"
  - "src/shared/charts/chartTheme.ts — teal-retinted COLORS + BASE_OPTS chart theme"
  - "src/shared/charts/ChartCanvas.tsx — Chart.js lifecycle wrapper (React-owned, destroy-before-recreate)"
  - "src/shared/charts/useChartExport.ts — PNG export hook (UI-04)"
affects: [phase-2-migrated-tests, phase-3-result-screens, phase-6-mapas-choropleth, 01-10-teste-demo]

tech-stack:
  added: []
  patterns:
    - "Chart.js instance owned by a single useEffect keyed on [canvasEl, type, data, options]; destroy-before-recreate, destroy-on-unmount — no global Map registry"
    - "Canvas ref exposed via a callback ref (setCanvasRef) so onCanvasReady fires exactly when the DOM node attaches/detaches, decoupled from Chart.js instance churn"
    - "mergeChartOptions does a one-level-deep merge of plugins/scales over a shallow spread, avoiding both a full deep-merge dependency and BASE_OPTS being clobbered by partial overrides"

key-files:
  created:
    - src/shared/format.ts
    - src/shared/format.test.ts
    - src/shared/charts/chartTheme.ts
    - src/shared/charts/ChartCanvas.tsx
    - src/shared/charts/ChartCanvas.test.tsx
    - src/shared/charts/useChartExport.ts
    - src/shared/charts/useChartExport.test.ts
  modified: []

key-decisions:
  - "chartTheme.ts retints only COLORS.primary (#22c55e -> #10b981) and COLORS.background (#0f1117 -> #0a0f0d) per the plan's exact scope; all other literal rgba values (primaryLight, tooltip borderColor, etc.) are ported unchanged even though they still reference the old green hex, matching v1.0's visual texture outside the two mandated retints"
  - "titleFont.weight changed from the string '600' to the number 600 — Chart.js's FontSpec type only accepts number | 'normal' | 'bold' | 'lighter' | 'bolder', so the numeric form is the type-correct equivalent with identical rendered weight"
  - "mergeChartOptions added to chartTheme.ts (optional per plan) because a shallow spread of caller options over BASE_OPTS would have dropped BASE_OPTS's plugins/scales entirely on any partial override"

patterns-established:
  - "Chart.js instance lifecycle: one useEffect per ChartCanvas instance, keyed on [canvasEl, type, data, options], always destroy-then-create, cleanup destroys — this is the pattern every future chart component in Phases 2/3/6 should replicate"
  - "PNG export: useChartExport(canvasRef) returns a memoized callback wrapping canvas.toDataURL + synthetic <a download> click, no screenshot library"

requirements-completed: [UI-04]

duration: 15min
completed: 2026-07-25
---

# Phase 1 Plan 04: Chart Theme, ChartCanvas, PNG Export, pt-BR Formatting Summary

**Chart.js lifecycle wrapper, PNG export hook, and pt-BR number formatting ported from `chart-manager.js`/`app.js` with the CDN import replaced by the bundled npm dependency and the chart palette retinted to teal.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-25T17:07:00Z
- **Completed:** 2026-07-25T17:21:26Z
- **Tasks:** 3 completed
- **Files modified:** 7 created

## Accomplishments
- `fmtNumber`/`fmtP`/`fmtSigned` ported verbatim from `assets/js/app.js:85-107` as standalone typed functions, with literal-value tests (not `toLocaleString`-derived) guarding pt-BR formatting parity
- `ChartCanvas` owns the Chart.js instance through a single `useEffect`, proven by test to destroy-before-recreate on data change and destroy-on-unmount — replaces the legacy global `Map` registry structurally
- `useChartExport` implements UI-04 (PNG download) with the v1.0 default filename `grafico-lacirstat.png`, custom filename support, and a safe null-ref no-op
- Chart.js now resolves exclusively from the bundled `chart.js` npm dependency — the CDN import (`https://cdn.jsdelivr.net/npm/chart.js@4.4.2/+esm`) from `chart-manager.js` does not exist anywhere under `src/`
- Chart theme retinted to teal `#10b981` on `#0a0f0d` per UI-SPEC, with every other v1.0 chart visual (grid/tick/label rgba, 600ms `easeOutQuart` animation) preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Port pt-BR formatting helpers with parity coverage** - `86d56cc` (feat)
2. **Task 2: Port the chart theme and build the ChartCanvas lifecycle wrapper** - `e5a2521` (feat)
3. **Task 3: Implement the PNG export hook (UI-04)** - `1bd47ee` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified
- `src/shared/format.ts` - `fmtNumber`, `fmtP`, `fmtSigned` standalone pt-BR formatters
- `src/shared/format.test.ts` - literal-value parity tests for all three formatters
- `src/shared/charts/chartTheme.ts` - `COLORS`, `BASE_OPTS`, `mergeChartOptions` (teal-retinted chart theme)
- `src/shared/charts/ChartCanvas.tsx` - Chart.js lifecycle wrapper component
- `src/shared/charts/ChartCanvas.test.tsx` - destroy-before-recreate, unmount-destroy, aria-label tests (chart.js mocked via `vi.hoisted`)
- `src/shared/charts/useChartExport.ts` - PNG export hook (UI-04)
- `src/shared/charts/useChartExport.test.ts` - toDataURL args, filename default/override, anchor cleanup, null-ref safety tests

## Decisions Made
- Kept `primaryLight`/other rgba literals in `chartTheme.ts` unchanged from v1.0 (only `primary` and `background` retinted), per the plan's explicit two-value scope — avoids scope creep into a full palette redesign this plan didn't call for
- Used a callback ref (`setCanvasRef`) rather than a plain `useRef` + a second effect to fire `onCanvasReady`, so the parent is notified exactly on DOM attach/detach rather than on every Chart.js instance recreation
- `mergeChartOptions` merges one level into `plugins`/`scales` only (not a full recursive deep merge) — sufficient for every current chart config shape and avoids adding a deep-merge dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `titleFont.weight` type mismatch in `chartTheme.ts`**
- **Found during:** Task 2 (`npm run typecheck`)
- **Issue:** Ported value `weight: '600'` (string) is not assignable to Chart.js's `FontSpec.weight` type (`number | 'normal' | 'bold' | 'lighter' | 'bolder' | ... | null`)
- **Fix:** Changed to the numeric literal `weight: 600`, which Chart.js accepts and renders identically (canvas font-weight resolution treats both the same way)
- **Files modified:** `src/shared/charts/chartTheme.ts`
- **Verification:** `npm run typecheck` passes
- **Committed in:** `e5a2521` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed generic-type indexing error in `mergeChartOptions`**
- **Found during:** Task 2 (`npm run typecheck`)
- **Issue:** Indexing `ChartOptions<T>['plugins']`/`['scales']` for a generic `T` is not valid TypeScript (`ChartOptions<T>` isn't statically indexable when `T` isn't a literal)
- **Fix:** Merged through an untyped `Record<string, unknown>` intermediate and cast back to `ChartOptions<T>` once at the return boundary, instead of indexing the generic type mid-expression
- **Files modified:** `src/shared/charts/chartTheme.ts`
- **Verification:** `npm run typecheck` passes
- **Committed in:** `e5a2521` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed `vi.mock` hoisting TDZ error in `ChartCanvas.test.tsx`**
- **Found during:** Task 2 (`npx vitest run`)
- **Issue:** `vi.mock('chart.js', ...)` factories are hoisted above top-level `const` declarations; the initial mock spies were declared as plain top-level `const`s and threw "Cannot access 'ChartMock' before initialization"
- **Fix:** Wrapped the mock spy creation in `vi.hoisted(() => {...})`, which vitest hoists alongside the `vi.mock` call
- **Files modified:** `src/shared/charts/ChartCanvas.test.tsx`
- **Verification:** `npx vitest run src/shared/charts/ChartCanvas.test.tsx` passes
- **Committed in:** `e5a2521` (Task 2 commit)

**4. [Rule 1 - Bug] Fixed "not a constructor" error from an arrow-function `vi.fn()` mock**
- **Found during:** Task 2 (`npx vitest run`)
- **Issue:** `ChartCanvas` calls `new Chart(...)`, but the mock implementation was an arrow function, which cannot be invoked with `new` in JS
- **Fix:** Changed the mock implementation to a named `function` expression, which supports `new`
- **Files modified:** `src/shared/charts/ChartCanvas.test.tsx`
- **Verification:** All 4 `ChartCanvas.test.tsx` tests pass
- **Committed in:** `e5a2521` (Task 2 commit)

**5. [Rule 1 - Bug] Fixed stale-index assumption in `useChartExport.test.ts`'s `appendChild` spy**
- **Found during:** Task 3 (`npx vitest run`)
- **Issue:** Tests assumed the export anchor was `appendChildSpy.mock.calls[0][0]`, but `@testing-library/react`'s `renderHook` also appends its own container `<div>` to `document.body`, and repeated `vi.spyOn` calls across tests accumulated call history without resetting (also caused a false-positive on the null-ref no-op assertion)
- **Fix:** Added a `getAppendedAnchor` helper that filters `appendChildSpy.mock.calls` for an actual `HTMLAnchorElement`, and added `afterEach(() => vi.restoreAllMocks())` so spies don't accumulate state across tests
- **Files modified:** `src/shared/charts/useChartExport.test.ts`
- **Verification:** All 5 `useChartExport.test.ts` tests pass
- **Committed in:** `1bd47ee` (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (all Rule 1 — bugs surfaced by `tsc`/`vitest` during implementation, none behavior-altering to the shipped runtime code beyond the `weight` numeric-type correction)
**Impact on plan:** All fixes were required to get `npm run typecheck` and `npx vitest run` green as the plan's own verification commands demand; no scope creep — every fix stayed inside the files the plan already targeted.

## Issues Encountered
None beyond the auto-fixed deviations above — all resolved inline during task execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The chart/export/format layer is ready for `01-10` (Teste demo results) and every Phase 2/3/6 result screen to consume directly via `ChartCanvas`, `useChartExport`, `chartTheme`, and `format.ts`
- **Manual check deferred to end-of-phase pass (per plan Task 3):** once `01-10` renders a real chart, click "Baixar gráfico (PNG)" and open the downloaded file to confirm it's a real PNG with the dark background and teal series — jsdom's `toDataURL` stub cannot verify actual pixel output, so this is a human-only verification noted in the plan's `<verify><human-check>` block, not an automated gap
- No blockers

## Self-Check: PASSED

All 7 created files verified present on disk; all 3 task commit hashes (`86d56cc`, `e5a2521`, `1bd47ee`) verified in git log. Full plan-level verification re-run: `npm run test:run` (5 files, 24 tests passed), `npm run typecheck` (clean), CDN-absence gate (`grep -rn 'cdn.jsdelivr.net' src` → 0 matches).

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
