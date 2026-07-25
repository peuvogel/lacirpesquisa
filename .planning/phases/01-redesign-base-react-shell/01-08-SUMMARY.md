---
phase: 01-redesign-base-react-shell
plan: 08
subsystem: ui
tags: [react, datasus, wizard, hook, vitest, xss]

requires:
  - phase: 01-03
    provides: parseDatasusText, normalizeDatasusSource, legacyAdapters, types
  - phase: 01-06
    provides: TabularInputPanel paste/file patterns, ColumnPreviewTable mono register
provides:
  - useDatasusWizard hook (ported state machine, onSessionChange session publish)
  - DatasusWizardPanel six-step JSX assistant (self-contained, ready for 01-10 mount)
affects: [01-10-TesteDemo, SessionProvider datasus handoff]

tech-stack:
  added: []
  patterns:
    - "useReducer state machine with deep-cloned legacy mutation helpers"
    - "JSX text children only — zero innerHTML/dangerouslySetInnerHTML on wizard surface"
    - "Status tone maps to shadcn Alert variant (error → destructive)"

key-files:
  created:
    - src/shared/data-input/useDatasusWizard.ts
    - src/shared/data-input/useDatasusWizard.test.ts
    - src/routes/estatistica/datasus/DatasusWizardPanel.tsx
    - src/routes/estatistica/datasus/DatasusSourceCards.tsx
    - src/routes/estatistica/datasus/DatasusMappingTable.tsx
    - src/routes/estatistica/datasus/DatasusNormalizedPreview.tsx
    - src/routes/estatistica/datasus/DatasusWizardPanel.test.tsx
  modified:
    - src/shared/data-input/types.ts

key-decisions:
  - "Step 4 variable types are editable per column (D-08 expanded) rather than read-only mini-cards"
  - "confirmSource refuses when normalized.ok is false (guard beyond disabled button)"
  - "DatasusColumnRole extended with ignore to match legacy DATASUS_COLUMN_ROLES"

patterns-established:
  - "Wizard session published via onSessionChange(buildSession) — no window.__LACIR_SHARED__ writes"

requirements-completed: [UI-02, UI-03]

duration: 25min
completed: 2026-07-25
---

# Phase 1 Plan 08: DataSUS Wizard React Port Summary

**Six-step DataSUS assistant ported from innerHTML state machine to useDatasusWizard + JSX panel, publishing confirmed sessions via onSessionChange with DOM-level XSS inertness**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-25T18:02:00Z
- **Completed:** 2026-07-25T18:27:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Extracted `createDatasusWizard` state slice into `useDatasusWizard` (useReducer + legacy reparse/normalize helpers)
- Rebuilt all six wizard steps in JSX with legacy Portuguese headings and copy (`Passo {n} de 6`)
- Confirmed sources publish `DatasusSession` through `onSessionChange`; panel tests prove script payloads render as inert text

## Task Commits

1. **Task 1: Extract wizard state machine** - `ea3020c` (feat)
2. **Task 2: Rebuild steps 1–3 in JSX** - `979ed63` (feat)
3. **Task 3: Steps 4–6, preview, confirm, tests** - `a128303` (feat)

## Files Created/Modified

- `src/shared/data-input/useDatasusWizard.ts` - Ported state machine hook with full action surface
- `src/shared/data-input/useDatasusWizard.test.ts` - renderHook tests over TABNET fixtures
- `src/routes/estatistica/datasus/DatasusWizardPanel.tsx` - Six-step shell, intake, status Alert
- `src/routes/estatistica/datasus/DatasusSourceCards.tsx` - Selectable source cards with teal active state
- `src/routes/estatistica/datasus/DatasusMappingTable.tsx` - Column role mapping table (step 3)
- `src/routes/estatistica/datasus/DatasusNormalizedPreview.tsx` - Metrics + preview table (step 5)
- `src/routes/estatistica/datasus/DatasusWizardPanel.test.tsx` - Full-flow RTL + T-01-XSS assertion
- `src/shared/data-input/types.ts` - Added `ignore` to `DatasusColumnRole`

## Decisions Made

- Step 4 exposes editable variable-type selects per column (D-08 "expanded" wording) instead of read-only summary cards from legacy v1.0
- `confirmSource` returns early when `normalized.ok` is false, not only relying on button `disabled`
- Paste intake uses legacy default filename `tabela-colada-datasus.tsv` matching v1.0 behavior

## Deviations from Plan

### Deliberate expansion (D-08)

**Step 4 editable variable types** — Legacy v1.0 rendered type summary as read-only mini-cards; React port makes each column's variable type editable via `<select>`, as specified in plan Task 3 action.

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended DatasusColumnRole with `ignore`**
- **Found during:** Task 1 (setColumnRole to Ignorar)
- **Issue:** Type union lacked `ignore` role present in legacy `DATASUS_COLUMN_ROLES`
- **Fix:** Added `'ignore'` to `DatasusColumnRole` in `types.ts`
- **Files modified:** `src/shared/data-input/types.ts`
- **Committed in:** `ea3020c`

---

**Total deviations:** 1 deliberate expansion + 1 auto-fixed type gap
**Impact on plan:** Both aligned with D-08 intent and wizard correctness; no scope creep.

## Issues Encountered

None — full suite (214 tests), typecheck, and build pass clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `DatasusWizardPanel` is self-contained with `onSessionChange` prop — plan 01-10 mounts it as the second Dados tab
- Session handoff to `SessionProvider` wiring deferred to 01-10 per plan mounting note

## Self-Check: PASSED

- FOUND: src/shared/data-input/useDatasusWizard.ts
- FOUND: src/routes/estatistica/datasus/DatasusWizardPanel.tsx
- FOUND: ea3020c, 979ed63, a128303

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
