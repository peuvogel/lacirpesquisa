---
phase: 04-mapas-como-interface-estatistica
plan: 06
subsystem: ui
tags: [mapas, temporalidade, group-config, provenance, MAP-06, canReview]

requires:
  - phase: 04-04
    provides: GroupBar, SelectionSummaryStrip, mapAnalysisState groups/activeGroupId
  - phase: 04-05
    provides: drill-down map shell, mockAnalysisData choropleth base
provides:
  - GroupConfigPanel per-group time + variable configuration (R4 Mode B)
  - TemporalidadeControl point/range/compare with validation
  - VariableCheckboxList with Exemplo didático provenance badges
  - MapPrimaryActionBar with gated Revisar e analisar CTA
  - Tablet Sheet fallback for group config panel
affects: [04-07, 04-08]

tech-stack:
  added: []
  patterns:
    - "getMockVariableIdsByUf bridges mockAnalysisData IDs to computeVariableIntersection"
    - "canReview = groups.length > 0 && groups.every(isGroupComplete)"
    - "active group first variableId drives choropleth coloring"

key-files:
  created:
    - src/routes/mapas/TemporalidadeControl.tsx
    - src/routes/mapas/GroupConfigPanel.tsx
    - src/routes/mapas/VariableCheckboxList.tsx
    - src/routes/mapas/MapPrimaryActionBar.tsx
    - src/routes/mapas/GroupConfigPanel.test.tsx
  modified:
    - src/routes/mapas/mapAnalysisState.ts
    - src/routes/mapas/mapAnalysisState.test.ts
    - src/routes/mapas/mockAnalysisData.ts
    - src/routes/mapas/MapasPage.tsx

key-decisions:
  - "canReview requires every group complete (not just one) per MAP-06 acceptance"
  - "Invalid range shows warning and excludes group from isTimeValid (non-blocking UI)"
  - "VariablePanel removed from MapasPage; GroupConfigPanel is sole R4 Mode B surface"
  - "ReviewHandoffDialog stub opens on Revisar e analisar — full handoff deferred Wave 6"

patterns-established:
  - "Pattern: TemporalidadeControl Quando analisar? empty state until point/range/compare set"
  - "Pattern: VariableCheckboxList provenance footnote for didactic vs paste hybrid (D-15)"
  - "Pattern: MapPrimaryActionBar consolidates Limpar mapa confirm with UI-SPEC copy"

requirements-completed: [MAP-06]

duration: 18min
completed: 2026-07-25
---

# Phase 4 Plan 06: GroupConfigPanel temporality + variables Summary

**Per-group temporalidade (point/range/compare) and multi-variable selection with provenance badges, gating Revisar e analisar until all groups complete**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-25T22:04:00Z
- **Completed:** 2026-07-25T22:22:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- TemporalidadeControl with Ano único / Intervalo de anos / Comparar dois períodos (UI-SPEC copy)
- GroupConfigPanel scopes variables to group territories with intersection + partial destructive notes
- Provenance badges (Exemplo didático) and footnote on every variable row
- MapPrimaryActionBar + MapasPage R4/R5 wiring; tablet Sheet fallback at &lt;1024px
- canReview gates Revisar e analisar; review dialog stub for Wave 6

## Task Commits

1. **Task 1: TemporalidadeControl + time reducer tests** - `4daed51` (feat)
2. **Task 2: GroupConfigPanel + VariableCheckboxList** - `47b843b` (feat)
3. **Task 3: MapPrimaryActionBar + MapasPage wiring** - `45ae5ec` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/routes/mapas/TemporalidadeControl.tsx` — Three-mode time picker with range validation warning
- `src/routes/mapas/GroupConfigPanel.tsx` — Per-group panel: time → variables with empty states
- `src/routes/mapas/VariableCheckboxList.tsx` — Checkbox list with provenance badges and footnote
- `src/routes/mapas/MapPrimaryActionBar.tsx` — Revisar e analisar + Colar/Limpar secondary actions
- `src/routes/mapas/mapAnalysisState.ts` — clampYear, isRangeTimeInvalid, stricter canReview
- `src/routes/mapas/mockAnalysisData.ts` — Time-series years, label↔ID crosswalk, getMockVariableIdsByUf
- `src/routes/mapas/MapasPage.tsx` — R4 group/paste/explore modes, Sheet fallback, review stub

## Decisions Made

- canReview changed from `some` to `every` group complete — matches plan must-have truth
- mockVariablesByUF labels mapped to stable mock.* IDs for intersection without rewriting Phase 1 fixture
- matchMedia guarded in tests (jsdom lacks API) — desktop panel path used in unit tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate export parse error in mapAnalysisState**
- **Found during:** Task 1 verification
- **Issue:** clampYear/isRangeTimeInvalid exported twice (inline + re-export block)
- **Fix:** Removed duplicate re-export entries
- **Files modified:** `src/routes/mapas/mapAnalysisState.ts`
- **Committed in:** `4daed51`

**2. [Rule 3 - Blocking] Guarded matchMedia for jsdom test environment**
- **Found during:** Task 3 verification (MapasPage.test.tsx)
- **Issue:** window.matchMedia undefined in vitest
- **Fix:** Early return in useIsTabletViewport when matchMedia unavailable
- **Files modified:** `src/routes/mapas/MapasPage.tsx`
- **Committed in:** `45ae5ec`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking test)
**Impact on plan:** No scope change; tests and typecheck green.

## TDD Gate Compliance

Task 1 marked `tdd="true"` — tests and implementation landed in a single feat commit (`4daed51`) rather than separate RED/GREEN commits. Behavior covered by expanded `mapAnalysisState.test.ts` (23 tests green).

## Known Stubs

| File | Stub | Resolved in |
|------|------|-------------|
| `MapasPage.tsx` | Review dialog open-only stub (no handoff) | Wave 6 (04-07/04-08) |
| `VariableCheckboxList.tsx` | Paste-sourced variables hook exists but no paste→variable pipeline yet | Phase 5 catalog |
| `VariablePanel.tsx` | Legacy component retained for tests; not used on MapasPage | Wave 6 cleanup optional |

## Issues Encountered

None blocking. 99/99 mapas tests pass; typecheck clean.

## Next Phase Readiness

- Wave 6 can implement ReviewHandoffDialog wired to `reviewOpen` state and `canReview`
- Group time + variable shape ready for MAP-09 tabular handoff assembly
- mockAnalysisData time-series helper ready for compare-mode choropleths

## Self-Check: PASSED

- FOUND: src/routes/mapas/TemporalidadeControl.tsx
- FOUND: src/routes/mapas/GroupConfigPanel.tsx
- FOUND: src/routes/mapas/VariableCheckboxList.tsx
- FOUND: src/routes/mapas/MapPrimaryActionBar.tsx
- FOUND: 4daed51, 47b843b, 45ae5ec

---
*Phase: 04-mapas-como-interface-estatistica*
*Completed: 2026-07-25*
