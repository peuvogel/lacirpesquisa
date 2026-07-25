---
phase: 01-redesign-base-react-shell
plan: 07
subsystem: ui
tags: [react, registry, sidebar, modal, datasus, vitest, shadcn]

requires:
  - phase: 01-05
    provides: EstatisticaPage skeleton, route shells, session context
  - phase: 01-01
    provides: shadcn Dialog, Badge, Button primitives
provides:
  - Typed TEST_REGISTRY single source of truth for all ten tests
  - Collapsible registry-driven sidebar with Disponível/Em breve gating
  - Qual teste usar? three-step decision-tree modal with full roadmap
  - Portal DATASUS link inside Estatística only (D-03)
affects: [01-10, 01-08, phase-2-test-migration]

tech-stack:
  added: []
  patterns:
    - "One TEST_REGISTRY array imported by Sidebar and QualTesteModal (Pitfall 4 prevention)"
    - "SidebarTestLink shared row component for sidebar + modal roadmap"
    - "Unavailable tests as non-interactive elements with aria-disabled, not disabled buttons"

key-files:
  created:
    - src/features/tests/registry.ts
    - src/features/tests/registry.test.ts
    - src/routes/estatistica/Sidebar.tsx
    - src/routes/estatistica/SidebarTestLink.tsx
    - src/routes/estatistica/Sidebar.test.tsx
    - src/routes/estatistica/PortalDatasusLink.tsx
    - src/routes/estatistica/QualTesteModal.tsx
    - src/routes/estatistica/QualTesteModal.test.tsx
  modified:
    - src/routes/estatistica/EstatisticaPage.tsx

key-decisions:
  - "TEST_REGISTRY drops legacy path/dynamic-import fields; plan 01-10 wires demo via static import keyed on id"
  - "SidebarTestLink is the shared row renderer for sidebar list and modal roadmap so availability cannot drift"
  - "Custom aside width transition for collapse at 980px — no shadcn sidebar block for this small list"
  - "Exactly-one-available registry test forces deliberate update when Phase 2 ships t-student"

patterns-established:
  - "Pattern 1: registry.ts → Sidebar + QualTesteModal (01-RESEARCH.md)"
  - "isTestAvailable(id) gates all navigation; em-breve rows are structurally inert"

requirements-completed: [UI-01, UX-01]

duration: 25min
completed: 2026-07-25
---

# Phase 1 Plan 07: Test Registry, Sidebar & Qual Teste Modal Summary

**Single TEST_REGISTRY drives a collapsible Estatística sidebar, UX-01 decision-tree modal, and in-route Portal DATASUS link — only Teste demo is selectable**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-25T18:00:00Z
- **Completed:** 2026-07-25T18:25:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Created typed `TEST_REGISTRY` with ten entries (demo + nine roadmap tests); `demo` is the sole `available` entry
- Built collapsible 300px sidebar with grouped test list, Qual teste usar? trigger, and 44×44 collapse toggle
- Moved Portal DATASUS ↗ into Estatística header row with `rel="noopener noreferrer"` (T-01-TAB)
- Shipped QualTesteModal: three-step decision tree + full roadmap reusing `SidebarTestLink`
- Wired `EstatisticaPage` with `activeTestId`, modal state, and `#lacir-test-module-mount` for plan 01-10

## Task Commits

1. **Task 1: The test registry as the app's single source of truth** - `7217a37` (feat)
2. **Task 2: Collapsible sidebar and the Estatística page assembly** - `bf026f0` (feat)
3. **Task 3: "Qual teste usar?" decision-tree modal (UX-01)** - `d6be46a` (feat)

**Plan metadata:** `9b24fb5` (docs: complete plan)

## Files Created/Modified

- `src/features/tests/registry.ts` - Single source of truth for test id/title/subtitle/group/status/phase
- `src/features/tests/registry.test.ts` - Strict assertions: unique ids, exactly one available (demo)
- `src/routes/estatistica/SidebarTestLink.tsx` - Shared row with Disponível/Em breve badges
- `src/routes/estatistica/Sidebar.tsx` - Collapsible aside, grouped TEST_REGISTRY list
- `src/routes/estatistica/Sidebar.test.tsx` - Sidebar interaction and gating tests
- `src/routes/estatistica/PortalDatasusLink.tsx` - External TABNET link (Estatística only)
- `src/routes/estatistica/QualTesteModal.tsx` - UX-01 decision-tree modal + roadmap
- `src/routes/estatistica/QualTesteModal.test.tsx` - Modal tree, gating, Escape, demo fallback
- `src/routes/estatistica/EstatisticaPage.tsx` - Two-column layout wiring sidebar, link, modal, mount point

## Decisions Made

- Reused legacy subtitles verbatim for Phase 2 tests (t-student, correlacao, prais-winsten) from `tests-manifest.json`
- Exported `groupTestsByGroup` from Sidebar for modal roadmap grouping (same order as sidebar)
- Modal resets step state on close via `useEffect` when `open` becomes false

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run src/features/tests/registry.test.ts` — PASS (8 tests)
- `npx vitest run src/routes/estatistica/Sidebar.test.tsx` — PASS (6 tests)
- `npx vitest run src/routes/estatistica/QualTesteModal.test.tsx` — PASS (6 tests)
- `npm run test:run` — PASS (188 tests)
- `npm run typecheck` — PASS
- Portal DATASUS `rel="noopener noreferrer"` grep gate — PASS

## Next Phase Readiness

- Plan 01-10 can mount `TesteDemo` into `#lacir-test-module-mount` keyed on `activeTestId`
- Registry contract stable for Phase 2 to flip `t-student` to `available` (must update strict test)
- Sidebar collapse below 980px implemented; manual resize check recommended during UAT

## Self-Check: PASSED

- FOUND: src/features/tests/registry.ts
- FOUND: src/features/tests/registry.test.ts
- FOUND: src/routes/estatistica/Sidebar.tsx
- FOUND: src/routes/estatistica/SidebarTestLink.tsx
- FOUND: src/routes/estatistica/Sidebar.test.tsx
- FOUND: src/routes/estatistica/PortalDatasusLink.tsx
- FOUND: src/routes/estatistica/QualTesteModal.tsx
- FOUND: src/routes/estatistica/QualTesteModal.test.tsx
- FOUND: src/routes/estatistica/EstatisticaPage.tsx
- FOUND: 7217a37
- FOUND: bf026f0
- FOUND: d6be46a

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
