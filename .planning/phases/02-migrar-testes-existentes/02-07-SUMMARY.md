---
phase: 02-migrar-testes-existentes
plan: 07
subsystem: testing
tags: [tabular-parser, session-handoff, recognized-columns, vitest]

requires:
  - phase: 02-migrar-testes-existentes
    provides: Migrated test modules with FlowSteps shell and engine parity
provides:
  - deriveRecognizedColumnsFromTabular shared helper for session/DATASUS bootstrap
  - CR-01 fix — non-empty recognizedColumns on Mapas → Estatística handoff
affects: [02-08, mapas-handoff, buildDatasetFromConfirmed]

tech-stack:
  added: []
  patterns:
    - "Session headers/rows re-serialized to delimited paste text before readTabularPasteState"
    - "Index-only recognizedColumns map matches useTabularInput toIndexMap shape"

key-files:
  created:
    - src/shared/data-input/recognizedColumnsFromTabular.ts
    - src/shared/data-input/recognizedColumnsFromTabular.test.ts
  modified:
    - src/features/tests/t-student/TStudentTest.tsx
    - src/features/tests/correlacao/CorrelacaoTest.tsx
    - src/features/tests/prais-winsten/PraisWinstenTest.tsx

key-decisions:
  - "Delegate column recognition entirely to readTabularPasteState — no hand-rolled alias matching (D-09 parity discipline)"
  - "Serialize session arrays with semicolon delimiter to match paste-path parser expectations"

patterns-established:
  - "deriveRecognizedColumnsFromTabular(headers, rows, TABULAR_OPTIONS) for any bootstrap path that bypasses useTabularInput"

requirements-completed: [TEST-01, TEST-02, TEST-03]

duration: 2 min
completed: 2026-07-25
---

# Phase 2 Plan 07: Session Bootstrap recognizedColumns Summary

**Shared deriveRecognizedColumnsFromTabular helper reuses readTabularPasteState so Mapas session handoff resolves domain column keys before Configurar confirm**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-25T19:38:04Z
- **Completed:** 2026-07-25T19:40:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `deriveRecognizedColumnsFromTabular` — serializes headers/rows to delimited text, delegates to `readTabularPasteState`, returns index-only map
- Unit tests cover t-student, correlacao, prais example fixtures plus position-fallback and unrecognizable-table edge cases
- Wired session bootstrap in all three migrated tests; t-student and correlacao DATASUS paths also derive columns
- Eliminated CR-01 root cause: no `recognizedColumns: {}` remains in session/DATASUS bootstrap paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared deriveRecognizedColumnsFromTabular helper** — `7daa078` (test), `73d59df` (feat)
2. **Task 2: Wire session and DATASUS bootstrap in migrated tests** — `172c8fb` (feat)

**Plan metadata:** `7c5d6ca` (docs)

## Files Created/Modified

- `src/shared/data-input/recognizedColumnsFromTabular.ts` — Shared helper exporting deriveRecognizedColumnsFromTabular
- `src/shared/data-input/recognizedColumnsFromTabular.test.ts` — Five unit tests for all three TABULAR_OPTIONS fixtures
- `src/features/tests/t-student/TStudentTest.tsx` — Session + DATASUS bootstrap derive recognizedColumns
- `src/features/tests/correlacao/CorrelacaoTest.tsx` — Session + DATASUS bootstrap derive recognizedColumns
- `src/features/tests/prais-winsten/PraisWinstenTest.tsx` — Session bootstrap derive recognizedColumns

## Decisions Made

- Delegate column recognition entirely to existing parser — no duplicate alias logic (D-09)
- Semicolon serialization for session arrays matches paste-path delimiter expectations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Verification Results

- `npm run test:run -- recognizedColumnsFromTabular.test.ts` — 5/5 passed
- `npm run test:run -- tStudentEngine correlacaoEngine praisEngine recognizedColumnsFromTabular` — 21/21 passed
- `grep recognizedColumns: {}` in three Test.tsx files — 0 matches in bootstrap paths

## Next Phase Readiness

- CR-01 blocker closed; session handoff resolves domain keys for valid datasets
- Ready for plan 02-08 (confirm-time recognizedColumns overrides on results path)

## Self-Check: PASSED

- FOUND: src/shared/data-input/recognizedColumnsFromTabular.ts
- FOUND: src/shared/data-input/recognizedColumnsFromTabular.test.ts
- FOUND: commit 7daa078
- FOUND: commit 73d59df
- FOUND: commit 172c8fb

---
*Phase: 02-migrar-testes-existentes*
*Completed: 2026-07-25*
