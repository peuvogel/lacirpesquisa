---
phase: 01-redesign-base-react-shell
plan: 12
subsystem: ui
tags: [react, beforeunload, session, vitest, shadcn]

requires:
  - phase: 01-redesign-base-react-shell
    provides: SessionProvider hasData/clearSession, EstatisticaPage shell, TesteDemo ResultsPanel actions slot
provides:
  - useLeaveWarning hook with closure-safe [hasData] effect deps
  - LeaveWarningGuard mounted only on Estatística route
  - ClearDataButton with UI-SPEC confirmation dialog
affects: [phase-2-test-modules, ui-05-verification]

tech-stack:
  added: []
  patterns:
    - "Route-scoped invisible guard component for beforeunload (D-18)"
    - "Destructive clear resets session plus host module local state via onCleared"

key-files:
  created:
    - src/shared/hooks/useLeaveWarning.ts
    - src/shared/hooks/useLeaveWarning.test.ts
    - src/routes/estatistica/LeaveWarningGuard.tsx
    - src/routes/estatistica/ClearDataButton.tsx
    - src/routes/estatistica/ClearDataButton.test.tsx
  modified:
    - src/routes/estatistica/EstatisticaPage.tsx
    - src/routes/estatistica/demo/TesteDemo.tsx

key-decisions:
  - "beforeunload only via useLeaveWarning(hasData) with [hasData] deps — no useBlocker"
  - "LeaveWarningGuard structural route scoping instead of route-name conditionals"
  - "ClearDataButton onCleared resets TesteDemo tabular input and returns flow to Dados"

patterns-established:
  - "Pattern: invisible route guard component mounts hook, detaches on unmount"
  - "Pattern: destructive session clear pairs clearSession() with module onCleared callback"

requirements-completed: [UI-05]

duration: 12min
completed: 2026-07-25
---

# Phase 1 Plan 12: Leave Warning + Limpar dados Summary

**Native beforeunload on Estatística only when session has data, plus confirmed Limpar dados that clears session and demo module state — no persistent refresh banner.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T18:07:00Z
- **Completed:** 2026-07-25T18:19:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `useLeaveWarning(hasData)` attaches `beforeunload` only while data exists, re-binding on every `hasData` change to avoid stale closures
- `LeaveWarningGuard` mounted exclusively in `EstatisticaPage`; listener removed automatically when navigating to Mapas/Meta-análise/Variáveis
- `ClearDataButton` with exact UI-SPEC copy opens a confirmation dialog; confirm clears session and resets TesteDemo to the Dados step
- No persistent refresh-loss banner copy anywhere in `src/`

## Task Commits

1. **Task 1: The beforeunload hook, gated and closure-safe** - `67dd7d0` (feat)
2. **Task 2: Route-scope the guard and add the Limpar dados action** - `0f788a4` (feat)

**Plan metadata:** `829462a` (docs: complete plan)

## Files Created/Modified

- `src/shared/hooks/useLeaveWarning.ts` - beforeunload attach/detach keyed on hasData
- `src/shared/hooks/useLeaveWarning.test.ts` - listener lifecycle and preventDefault coverage
- `src/routes/estatistica/LeaveWarningGuard.tsx` - invisible guard reading session.hasData
- `src/routes/estatistica/ClearDataButton.tsx` - destructive clear with shadcn Dialog
- `src/routes/estatistica/ClearDataButton.test.tsx` - copy, confirm/cancel, route-scoping tests
- `src/routes/estatistica/EstatisticaPage.tsx` - mounts LeaveWarningGuard only here
- `src/routes/estatistica/demo/TesteDemo.tsx` - ClearDataButton in ResultsPanel actions slot

## Decisions Made

- Used structural route mounting (LeaveWarningGuard in EstatisticaPage only) rather than route-name checks — aligns with D-18 and 01-RESEARCH Structure Rationale
- Rejected React Router `useBlocker` per plan — in-app navigation to other portal tabs must remain unblocked
- `onCleared` in TesteDemo resets `useTabularInput`, loaded/confirmed state, and active step so UI matches cleared session

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI-05 complete; Phase 1 plan 01-12 is the final plan in the redesign shell milestone
- Manual human-check refresh matrix (Cmd/Ctrl+R with/without data, across routes) remains recommended for UAT but automated tests cover hook lifecycle and route scoping

## Self-Check: PASSED

- FOUND: src/shared/hooks/useLeaveWarning.ts
- FOUND: src/shared/hooks/useLeaveWarning.test.ts
- FOUND: src/routes/estatistica/LeaveWarningGuard.tsx
- FOUND: src/routes/estatistica/ClearDataButton.tsx
- FOUND: src/routes/estatistica/ClearDataButton.test.tsx
- FOUND: commit 67dd7d0
- FOUND: commit 0f788a4

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
