---
phase: 02-migrar-testes-existentes
plan: 08
subsystem: testing
tags: [column-preview, recognized-columns, session-handoff, vitest, integration-test]

requires:
  - phase: 02-migrar-testes-existentes
    provides: deriveRecognizedColumnsFromTabular session bootstrap (02-07)
provides:
  - deriveRecognizedColumnsFromRoles for confirm-time role→domain mapping
  - ColumnPreviewTable confirm payload with recognizedColumns
  - Migrated tests analyze using confirmed mapping (WR-01 closed)
  - EstatisticaPage handoff integration test through Resultados (Truth #6)
affects: [verification, mapas-handoff, TesteDemo]

tech-stack:
  added: []
  patterns:
    - "ColumnPreviewTable tabularOptions triggers deriveRecognizedColumnsFromRoles on confirm"
    - "ConfirmedDataset.recognizedColumns flows to buildDatasetFromConfirmed at results time"

key-files:
  created: []
  modified:
    - src/shared/data-input/recognizedColumnsFromTabular.ts
    - src/shared/data-input/recognizedColumnsFromTabular.test.ts
    - src/routes/estatistica/ColumnPreviewTable.tsx
    - src/routes/estatistica/ColumnPreviewTable.test.tsx
    - src/features/tests/t-student/TStudentConfigPanel.tsx
    - src/features/tests/t-student/TStudentTest.tsx
    - src/features/tests/correlacao/CorrelacaoConfigPanel.tsx
    - src/features/tests/correlacao/CorrelacaoTest.tsx
    - src/features/tests/prais-winsten/PraisWinstenConfigPanel.tsx
    - src/features/tests/prais-winsten/PraisWinstenTest.tsx
    - src/routes/estatistica/EstatisticaPage.test.tsx

key-decisions:
  - "Role-based mapping layers on header alias match, then numeric/tempo/categorica assignment, then position fallback"
  - "Without tabularOptions, ColumnPreviewTable passthrough recognizedColumns prop for backward compat (TesteDemo)"
  - "Results path uses confirmedDataset.recognizedColumns — not loadedInput — so Configurar overrides reach engines"

patterns-established:
  - "deriveRecognizedColumnsFromRoles(roles, headers, TABULAR_OPTIONS) at ColumnPreview confirm"
  - "ConfigPanels pass tabularOptions={TABULAR_OPTIONS} to ColumnPreviewTable"

requirements-completed: [TEST-01, TEST-02, TEST-03]

duration: 4 min
completed: 2026-07-25
---

# Phase 2 Plan 08: WR-01 ColumnPreview + Handoff Integration Summary

**Confirm-time role→domain recognizedColumns wired through migrated tests; Mapas handoff RTL proves correlacao reaches Resultados with r de Pearson**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-25T19:39:00Z
- **Completed:** 2026-07-25T19:43:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `deriveRecognizedColumnsFromRoles` — maps user column roles to domain keys with header alias base, role overrides, and position fallback
- Extended `ColumnPreviewTable` confirm contract to emit `recognizedColumns` when `tabularOptions` is provided
- Wired all three migrated tests to store and analyze using confirm-time mapping (WR-01 closed)
- Added EstatisticaPage integration test: Mapas session → Configurar → Analisar dados → Resultados with metrics (Truth #6)

## Task Commits

Each task was committed atomically:

1. **Task 1: Role-based column mapping + ColumnPreview confirm contract** — `85c8602` (feat)
2. **Task 2: Wire confirm mapping through migrated tests** — `e4ac91d` (feat)
3. **Task 3: Mapas handoff integration test through Resultados** — `d570a55` (test)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/shared/data-input/recognizedColumnsFromTabular.ts` — Added deriveRecognizedColumnsFromRoles and TabularColumnRole type
- `src/shared/data-input/recognizedColumnsFromTabular.test.ts` — Four role-mapping unit tests
- `src/routes/estatistica/ColumnPreviewTable.tsx` — tabularOptions prop; confirm emits recognizedColumns
- `src/routes/estatistica/ColumnPreviewTable.test.tsx` — RTL tests for role-aware confirm and ignorar override
- `src/features/tests/*/TStudentConfigPanel.tsx` (and correlacao/prais) — Pass tabularOptions; extended onConfirm type
- `src/features/tests/*/TStudentTest.tsx` (and correlacao/prais) — ConfirmedDataset.recognizedColumns at analysis time
- `src/routes/estatistica/EstatisticaPage.test.tsx` — Handoff-through-Resultados integration test with chart.js mock

## Decisions Made

- Role mapping layers on existing header alias match rather than duplicating parser logic
- Backward compatible passthrough when tabularOptions absent (TesteDemo unchanged per D-06)
- Analysis uses confirm-time mapping, not bootstrap loadedInput mapping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Verification Results

- `npm run test:run -- recognizedColumnsFromTabular.test.ts ColumnPreviewTable.test.tsx` — 16/16 passed
- `npm run test:run -- TStudentTest CorrelacaoTest PraisWinstenTest` — 9/9 passed
- `npm run test:run -- EstatisticaPage.test.tsx` — 4/4 passed
- `npm run test:run` — 349/349 passed (full suite green)

## Next Phase Readiness

- WR-01 closed; Configurar role overrides flow to engines
- Truth #6 closed; automated handoff integration test locks Mapas → Estatística path
- WR-02 (PNG debounce) remains deferred per plan scope

## Self-Check: PASSED

- FOUND: src/shared/data-input/recognizedColumnsFromTabular.ts (deriveRecognizedColumnsFromRoles)
- FOUND: src/routes/estatistica/EstatisticaPage.test.tsx (session handoff test)
- FOUND: commit 85c8602
- FOUND: commit e4ac91d
- FOUND: commit d570a55

---
*Phase: 02-migrar-testes-existentes*
*Completed: 2026-07-25*
