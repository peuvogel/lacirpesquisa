---
phase: 04-mapas-como-interface-estatistica
plan: 04
subsystem: ui
tags: [mapas, dnd-kit, groups, presets, selection-summary, MAP-07, MAP-08, MAP-10]

requires:
  - phase: 04-01
    provides: @dnd-kit, mapAnalysisState, territoryCatalog presets
  - phase: 04-02
    provides: BrazilMapCanvas, MapGeoPath glow, mockAnalysisData
  - phase: 04-03
    provides: TerritoryPastePanel, MapasPage paste wiring
provides:
  - GroupBar with @dnd-kit drop zones and Criar grupo com seleção
  - PresetRegionPills for N/NE/CO/SE/S and health macro-regions
  - SelectionSummaryStrip with empty/partial/complete plain-PT copy
  - Single-screen MapasPage R1–R5 shell with map↔group glow sync
affects: [04-05, 04-06, 04-07, 04-08]

tech-stack:
  added: []
  patterns:
    - "deriveSelectionSummary(state, ungroupedTerritories) for R2 live copy"
    - "buildUngroupedTerritories filters grouped siglas from map selection"
    - "GroupBar DndContext + KeyboardSensor; button duplicates drop (D-05)"
    - "mapAnalysis synced to SessionProvider on every reducer commit"

key-files:
  created:
    - src/routes/mapas/SelectionSummaryStrip.tsx
    - src/routes/mapas/SelectionSummaryStrip.test.tsx
    - src/routes/mapas/GroupBar.tsx
    - src/routes/mapas/GroupBar.test.tsx
    - src/routes/mapas/GroupChip.tsx
    - src/routes/mapas/PresetRegionPills.tsx
  modified:
    - src/routes/mapas/mapAnalysisState.ts
    - src/routes/mapas/MapasPage.tsx
    - src/routes/mapas/BrazilMapCanvas.tsx
    - src/geo/territoryCatalog.ts
    - src/index.css

key-decisions:
  - "ungrouped UF selection stays in MapasPage local state; groups live in mapAnalysisState"
  - "Group limits: 10 groups max, 27 territories per group (T-04-04-01)"
  - "Tablet Sheet fallback for R4 deferred to Wave 5 polish — desktop-first acceptable per CONTEXT"
  - "Revisar e analisar stub wired to derived.canReview; dialog handoff deferred Wave 6"

patterns-established:
  - "Pattern: SelectionSummaryStrip aria-live polite with UI-SPEC verbatim empty/partial copy"
  - "Pattern: lacir-drop-target--active + lacir-map-glow--eligible pulse on ungrouped selection"

requirements-completed: [MAP-07, MAP-08, MAP-10]

duration: 28min
completed: 2026-07-25
---

# Phase 4 Plan 04: GroupBar DnD + Summary Strip Summary

**@dnd-kit GroupBar with regional/health presets, always-visible plain-PT SelectionSummaryStrip, and single-screen Mapas with glowing map↔group sync**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-25T22:15:00Z
- **Completed:** 2026-07-25T22:43:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- SelectionSummaryStrip renders empty/partial/complete UI-SPEC copy with `aria-live="polite"`
- GroupBar: preset pills (N/NE/CO/SE/S + health macros), DnD drop zones, renamable GroupChips, explicit **Criar grupo com seleção**
- MapasPage upgraded to R1–R5 single-screen layout; map paths glow for ungrouped selection and group membership
- `formatTimeSummary` exported for Wave 6 handoff reuse

## Task Commits

1. **Task 1 RED: SelectionSummaryStrip tests** - `8065419` (test)
2. **Task 1 GREEN: SelectionSummaryStrip + summary derivation** - `ad5fe89` (feat)
3. **Task 2: GroupBar, GroupChip, PresetRegionPills** - `2cedb6b` (feat)
4. **Task 3: MapasPage single-screen upgrade** - `ba4cfa8` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/routes/mapas/SelectionSummaryStrip.tsx` — R2 live summary strip (empty/partial/complete)
- `src/routes/mapas/GroupBar.tsx` — DndContext, drop zones, preset wiring, buildUngroupedTerritories
- `src/routes/mapas/GroupChip.tsx` — Inline rename (Enter/Escape/F2), delete confirm dialog
- `src/routes/mapas/PresetRegionPills.tsx` — Grande região + health macro pills with tooltips
- `src/routes/mapas/mapAnalysisState.ts` — deriveSelectionSummary, formatTimeSummary, group caps
- `src/routes/mapas/MapasPage.tsx` — useMapAnalysis + session sync, R1–R5 layout
- `src/routes/mapas/BrazilMapCanvas.tsx` — groupMembership glow, eligible pulse, highlight sync
- `src/index.css` — `.lacir-drop-target--active`, `.lacir-map-glow--eligible` pulse

## Decisions Made

- Ungrouped map selection remains local React state; groups/time/variables in mapAnalysisState reducer
- Health macro presets create municipio-level TerritoryRefs per territoryCatalog (MAP-08)
- Escape clears ungrouped selection; Shift+Escape opens clear-all confirm when groups exist

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken handleApplyPreset closure in GroupBar**
- **Found during:** Task 3 (typecheck)
- **Issue:** Incomplete useCallback left syntax error after onGroupCreated refactor
- **Fix:** Restored closing braces and dependency array
- **Files modified:** `src/routes/mapas/GroupBar.tsx`
- **Committed in:** `ba4cfa8`

**2. [Rule 3 - Blocking] Updated VariablePanel.test empty copy to match UI-SPEC Mode A**
- **Found during:** Task 3 verification
- **Issue:** VariablePanel empty body updated per plan but test still expected Phase 1 copy
- **Fix:** Aligned EMPTY_BODY constant with UI-SPEC verbatim text
- **Files modified:** `src/routes/mapas/VariablePanel.test.tsx`
- **Committed in:** `ba4cfa8`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking test)
**Impact on plan:** No scope change; correctness and test green required.

## Known Stubs

| File | Stub | Resolved in |
|------|------|-------------|
| `MapasPage.tsx` | Revisar e analisar disabled until `derived.canReview` — no dialog yet | Wave 5/6 |
| `MapasPage.tsx` | GroupConfigPanel (R4 Mode B) not wired — VariablePanel explore/paste only | Wave 5 |
| `VariablePanel.tsx` | Legacy "Iniciar pesquisa" button still rendered when UFs selected | Wave 6 ReviewHandoffDialog |

## Issues Encountered

None blocking. Tablet Sheet fallback for R4 documented as Wave 5 defer per plan discretion.

## Next Phase Readiness

- Wave 5 (04-05): GroupConfigPanel temporalidade + variable checklist can attach to `activeGroupId`
- Groups, presets, and summary strip are prerequisite infrastructure — ready
- `formatTimeSummary` available for handoff assembly in Wave 6

## Self-Check: PASSED

- FOUND: src/routes/mapas/SelectionSummaryStrip.tsx
- FOUND: src/routes/mapas/GroupBar.tsx
- FOUND: src/routes/mapas/GroupChip.tsx
- FOUND: src/routes/mapas/PresetRegionPills.tsx
- FOUND: 8065419, ad5fe89, 2cedb6b, ba4cfa8

---
*Phase: 04-mapas-como-interface-estatistica*
*Completed: 2026-07-25*
