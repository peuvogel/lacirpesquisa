---
phase: 04-mapas-como-interface-estatistica
plan: 07
subsystem: ui
tags: [mapas, handoff, MAP-09, ReviewAnalysisDialog, assembleHandoffTable, D-20, D-21, D-22]

requires:
  - phase: 04-04
    provides: GroupBar, SelectionSummaryStrip, mapAnalysisState
  - phase: 04-06
    provides: MapPrimaryActionBar, canReview gating, group time/variables
provides:
  - ReviewAnalysisDialog primary MAP-09 handoff UI (R6)
  - assembleHandoffTable wide-format rows from groups + mock time-series
  - Extended suggestResearchForSelection for groups/compare-time/multi-var
  - guardHandoffTestId + MAPAS_TABULAR_OPTIONS shared handoff utilities
affects: [04-08]

tech-stack:
  added: []
  patterns:
    - "assembleHandoffTable → setDataset → deriveRecognizedColumnsFromTabular → navigate state"
    - "suggestResearchForSelection({ groups, provenance }) group-aware heuristics"
    - "Collection links collapsed under Ver fontes oficiais (D-22 secondary path)"

key-files:
  created:
    - src/routes/mapas/ReviewAnalysisDialog.tsx
    - src/routes/mapas/assembleHandoffTable.ts
    - src/routes/mapas/SuggestedTestCard.tsx
    - src/routes/mapas/TestPickerSelect.tsx
    - src/routes/mapas/mapHandoffShared.ts
    - src/routes/mapas/ReviewAnalysisDialog.test.tsx
    - src/routes/mapas/assembleHandoffTable.test.ts
  modified:
    - src/routes/mapas/suggestResearchForSelection.ts
    - src/routes/mapas/suggestResearchForSelection.test.ts
    - src/routes/mapas/MapasPage.tsx
    - src/routes/mapas/IniciarPesquisaModal.tsx
    - src/routes/mapas/mockCollectionLinks.ts

key-decisions:
  - "Primary handoff path assembles mock table without paste when groups complete (D-21)"
  - "Hybrid/paste provenance prefers paste rows when provided to assembleHandoffTable"
  - "IniciarPesquisaModal deprecated; ReviewAnalysisDialog re-exported for migration"
  - "Removed continuous mapSelection sync from MapasPage — mapAnalysis is canonical"

patterns-established:
  - "Pattern: ReviewAnalysisDialog Ir para Estatística publishes activeTestId + recognizedColumns"
  - "Pattern: guardHandoffTestId rejects unavailable testIds before navigate (T-04-07-01)"
  - "Pattern: suggestResearchFromFlatSelection legacy adapter for deprecated modal"

requirements-completed: [MAP-09]

duration: 22min
completed: 2026-07-25
---

# Phase 4 Plan 07: ReviewAnalysisDialog MAP-09 Handoff Summary

**Group-aware review dialog assembles wide tabular rows, suggests editable tests, and navigates to Estatística with activeTestId and recognizedColumns — replacing the Phase 1 paste-only stub**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-25T22:23:00Z
- **Completed:** 2026-07-25T22:45:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `assembleHandoffTable` produces Território;Grupo;Período;{variables} wide rows from mock time-series (10k row cap)
- `suggestResearchForSelection` extended for 2-group t-student, 3+ anova, compare-time prais-winsten, multi-var correlacao
- `ReviewAnalysisDialog` with UI-SPEC copy, SuggestedTestCard, TestPickerSelect, collapsed collection links
- MapasPage **Revisar e analisar** opens full handoff; IniciarPesquisaModal deprecated
- 34 handoff-related tests green; typecheck clean

## Task Commits

1. **Task 1: assembleHandoffTable + extended suggestion heuristics** - `2d539e9` (feat)
2. **Task 2: ReviewAnalysisDialog, SuggestedTestCard, TestPickerSelect** - `321e8a4` (feat)
3. **Task 3: Wire MapasPage; deprecate IniciarPesquisaModal** - `a163602` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/routes/mapas/assembleHandoffTable.ts` — Wide table assembly from groups + mock metrics; hybrid paste override
- `src/routes/mapas/suggestResearchForSelection.ts` — Group/time/multi-var heuristics; legacy flat adapter
- `src/routes/mapas/ReviewAnalysisDialog.tsx` — Primary MAP-09 review + handoff dialog (R6)
- `src/routes/mapas/mapHandoffShared.ts` — MAPAS_TABULAR_OPTIONS, resolveHandoffTestId, guardHandoffTestId
- `src/routes/mapas/SuggestedTestCard.tsx` — Accent-bordered primary suggestion display
- `src/routes/mapas/TestPickerSelect.tsx` — Registry-filtered test override select
- `src/routes/mapas/MapasPage.tsx` — ReviewAnalysisDialog wired; mapSelection sync removed

## Decisions Made

- Paste-only fallback inside dialog deferred — primary path uses assembled mock rows when groups complete
- Radix Select override tested via guardHandoffTestId unit test (jsdom pointer-capture limitations)
- Added `Internações hospitalares` to MOCK_COLLECTION_LINKS for mock variable label alignment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added mock variable label to collection links map**
- **Found during:** Task 2 verification (ReviewAnalysisDialog.test.tsx)
- **Issue:** getCollectionLinks keyed on Phase 1 labels; mock IDs use "Internações hospitalares"
- **Fix:** Added matching entry in mockCollectionLinks.ts
- **Files modified:** `src/routes/mapas/mockCollectionLinks.ts`
- **Committed in:** `321e8a4`

None other — plan executed as written.

---

**Total deviations:** 1 auto-fixed (1 blocking test)
**Impact on plan:** No scope change.

## TDD Gate Compliance

Task 1 marked `tdd="true"` — tests and implementation landed in single feat commit (`2d539e9`) rather than separate RED/GREEN commits. All 14 Task 1 behavior tests pass.

## Issues Encountered

Radix Select dropdown interaction unreliable in jsdom (hasPointerCapture). Override behavior verified via `guardHandoffTestId` unit test instead of full UI select flow.

## Next Phase Readiness

- Wave 7 (04-08) can run integration verification across full Mapas → Estatística flow
- EstatisticaPage already consumes `activeTestId` + `recognizedColumns` from location.state
- Paste-only hybrid handoff can be wired when paste→variable pipeline lands (Phase 5)

## Self-Check: PASSED

- FOUND: src/routes/mapas/ReviewAnalysisDialog.tsx
- FOUND: src/routes/mapas/assembleHandoffTable.ts
- FOUND: src/routes/mapas/SuggestedTestCard.tsx
- FOUND: src/routes/mapas/TestPickerSelect.tsx
- FOUND: 2d539e9, 321e8a4, a163602

---
*Phase: 04-mapas-como-interface-estatistica*
*Completed: 2026-07-25*
