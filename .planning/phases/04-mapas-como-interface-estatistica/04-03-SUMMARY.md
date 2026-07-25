---
phase: 04-mapas-como-interface-estatistica
plan: 03
subsystem: ui
tags: [mapas, territory-paste, uf-matching, normalizeHeaderToken, MAP-02]

requires:
  - phase: 04-01
    provides: matchTerritoryLabels engine, ufCodes crosswalk, mapAnalysis session slice
provides:
  - matchUfPaste offline UF name/sigla paste engine with 100-line cap
  - TerritoryPastePanel with matched/unmatched report (Mode C)
  - MapasPage Colar territórios toggle wiring with map selection sync
affects: [04-04, 04-06, 04-07]

tech-stack:
  added: []
  patterns:
    - "Debounced 300ms territory paste parse with blur flush"
    - "matchUfPaste dedupes siglas preserving first occurrence order"
    - "mapAnalysis provenance paste/hybrid on territory paste"

key-files:
  created:
    - src/routes/mapas/TerritoryPastePanel.tsx
    - src/routes/mapas/TerritoryPastePanel.test.tsx
    - src/routes/mapas/MapasPage.test.tsx
  modified:
    - src/geo/matchTerritoryLabels.ts
    - src/geo/matchTerritoryLabels.test.ts
    - src/routes/mapas/MapasPage.tsx

key-decisions:
  - "100-line UF paste cap (T-04-03-02) separate from 5000-line matchTerritoryLabels batch API"
  - "Merge pasted siglas into existing selectedUFs rather than replace"
  - "Keep paste panel open after match per D-03 progressive disclosure"

patterns-established:
  - "Pattern: TerritoryPastePanel debounced parse + aria-live match report"
  - "Pattern: Context panel Mode C toggle via Colar territórios secondary button"

requirements-completed: [MAP-02]

duration: 18min
completed: 2026-07-25
---

# Phase 4 Plan 03: Territory Paste UF Matching Summary

**UF name/sigla paste with offline matchUfPaste engine, TerritoryPastePanel match report, and MapasPage selection sync**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-25T22:13:00Z
- **Completed:** 2026-07-25T22:31:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Extended `matchUfPaste` with alias table, dedupe, 100-line DoS cap, and table-driven tests for all 27 UFs
- Built `TerritoryPastePanel` with UI-SPEC copy, debounced parse, Reconhecidos/Não reconhecidos report, Ver detalhes error disclosure
- Wired Mode C into MapasPage: Colar territórios toggle merges pasted siglas into map selection and sets mapAnalysis provenance

## Task Commits

1. **Task 1 RED: UF paste matching tests** - `3aea576` (test)
2. **Task 1 GREEN: matchUfPaste engine** - `0266750` (feat)
3. **Task 2: TerritoryPastePanel component** - `9673fb3` (feat)
4. **Task 3: MapasPage integration tests** - `e832cff` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/geo/matchTerritoryLabels.ts` — `matchUfPaste`, UF alias table, 100-line cap
- `src/geo/matchTerritoryLabels.test.ts` — table-driven UF paste cases
- `src/routes/mapas/TerritoryPastePanel.tsx` — paste textarea + match report UI
- `src/routes/mapas/TerritoryPastePanel.test.tsx` — RTL debounce/blur/report tests
- `src/routes/mapas/MapasPage.tsx` — Mode C toggle, onMatched merge, provenance
- `src/routes/mapas/MapasPage.test.tsx` — paste selects BA, unmatched non-blocking

## Decisions Made

- Kept `matchTerritoryLabels` 5000-line cap for batch API; `matchUfPaste` uses stricter 100-line cap per threat model
- MapasPage wiring landed in parallel 04-02 commit; this plan added integration tests and verified behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- MapasPage.test.tsx required MemoryRouter wrapper for IniciarPesquisaModal useNavigate
- userEvent with fake timers timed out on Ver detalhes click; switched to fireEvent

## User Setup Required

None

## Next Phase Readiness

- Wave 4 (04-04): municipality matching can extend matchTerritoryLabels with scoped UF catalog
- Wave 6: tabular **Colar dados** remains separate from territory paste button
- 86 mapas + geo tests green

## Self-Check: PASSED

- FOUND: src/routes/mapas/TerritoryPastePanel.tsx
- FOUND: src/geo/matchTerritoryLabels.ts (matchUfPaste)
- FOUND: src/routes/mapas/MapasPage.test.tsx
- FOUND: commit 3aea576
- FOUND: commit 0266750
- FOUND: commit 9673fb3
- FOUND: commit e832cff

---
*Phase: 04-mapas-como-interface-estatistica*
*Completed: 2026-07-25*
