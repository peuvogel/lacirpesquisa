---
phase: 02-migrar-testes-existentes
plan: 06
subsystem: ui
tags: [react, registry, routing, mapas-handoff, vitest]

requires:
  - phase: 02-03
    provides: TStudentTest module with FlowSteps shell
  - phase: 02-04
    provides: CorrelacaoTest module with engine parity
  - phase: 02-05
    provides: PraisWinstenTest module with series UX
provides:
  - Four available tests in TEST_REGISTRY (demo + 3 migrated)
  - EstatisticaPage static switch mounting all four modules
  - Demonstração vs Disponível badge distinction (D-17)
  - Mapas → Estatística handoff with fallback chain (T-02-07)
affects: [phase-03, phase-04, verify-work]

tech-stack:
  added: []
  patterns:
    - "Single registry flip unlocks sidebar + Qual teste modal together"
    - "Router state handoff validated via isTestAvailable whitelist"
    - "getTestBadgeLabel centralizes demo Demonstração copy"

key-files:
  created:
    - src/routes/estatistica/EstatisticaPage.test.tsx
  modified:
    - src/features/tests/registry.ts
    - src/features/tests/registry.test.ts
    - src/routes/estatistica/EstatisticaPage.tsx
    - src/routes/estatistica/SidebarTestLink.tsx
    - src/routes/estatistica/demo/TesteDemo.tsx
    - src/routes/mapas/IniciarPesquisaModal.tsx
    - src/routes/mapas/IniciarPesquisaModal.test.tsx
    - .planning/phases/02-migrar-testes-existentes/02-VALIDATION.md

key-decisions:
  - "Demo keeps Demonstração badge; migrated tests use teal Disponível (D-17)"
  - "Cold start lands on demo; Mapas handoff uses suggested → t-student → demo"
  - "Handoff opens Configurar when session dataset present via module initialStepFromSession"

patterns-established:
  - "resolveHandoffTestId exported for testable Mapas fallback chain"
  - "EstatisticaHandoffState.activeTestId consumed on mount when hasData"

requirements-completed: [TEST-01, TEST-02, TEST-03]

duration: 8min
completed: 2026-07-25
---

# Phase 02 Plan 06: Registry Flip & Integration Summary

**Phase 2 routing complete — four tests available in sidebar with Mapas handoff landing on Configurar via validated router state**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-25T19:25:00Z
- **Completed:** 2026-07-25T19:33:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Flipped `t-student`, `correlacao`, and `prais-winsten` to `available` in `TEST_REGISTRY` with extended unit tests
- Wired `EstatisticaPage` static switch for all four modules; demo remains default cold-start landing
- Added `Demonstração` badge for demo and `Disponível` for migrated tests in sidebar/modal/Mapas suggestions
- Implemented Mapas handoff: `resolveHandoffTestId` (suggested → t-student → demo) via `isTestAvailable` guard
- Full suite (337 tests), typecheck, and production build green

## Task Commits

Each task was committed atomically:

1. **Task 1: Flip TEST_REGISTRY and extend registry tests** - `8b81e48` (feat)
2. **Task 2: Wire EstatisticaPage, sidebar/modal badges, and demo copy fix** - `5d72272` (feat)
3. **Task 3: Mapas handoff routing, RTL test, and phase integration gate** - `aab6f62` (feat)

**Plan metadata:** `1674df3` (docs: complete plan)

## Files Created/Modified

- `src/features/tests/registry.ts` - Three migrated tests available; `getTestBadgeLabel` helper
- `src/routes/estatistica/EstatisticaPage.tsx` - Static switch + handoff state consumer
- `src/routes/estatistica/SidebarTestLink.tsx` - Demonstração vs Disponível badge variants
- `src/routes/estatistica/demo/TesteDemo.tsx` - Button copy "Usar exemplo"
- `src/routes/mapas/IniciarPesquisaModal.tsx` - `resolveHandoffTestId` + navigate with state
- `src/routes/estatistica/EstatisticaPage.test.tsx` - Sidebar mount + handoff Configurar RTL
- `src/routes/mapas/IniciarPesquisaModal.test.tsx` - Fallback chain RTL tests
- `.planning/phases/02-migrar-testes-existentes/02-VALIDATION.md` - Nyquist task map complete

## Decisions Made

- Demo keeps `Demonstração` badge (muted outline) per D-17; migrated tests use teal `Disponível`
- Mapas handoff skips demo in primary suggestion scan; explicit demo only as final fallback
- Handoff test id validated with `isTestAvailable` before applying (T-02-07 mitigation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed invalid `source` key in correlacaoEngine.test.ts**
- **Found during:** Task 3 (full typecheck gate)
- **Issue:** `deriveCorrelationPairs` call passed unknown `source` property — blocked `tsc --noEmit`
- **Fix:** Removed duplicate `source` key; kept `xSource`/`ySource`
- **Files modified:** `src/features/tests/correlacao/correlacaoEngine.test.ts`
- **Verification:** `npm run typecheck && npm run build` green
- **Committed in:** `aab6f62`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for integration gate; no scope creep.

## Issues Encountered

None beyond the pre-existing typecheck error fixed during Task 3 gate.

## User Setup Required

None - no external service configuration required.

## Manual Verification (for verify-work)

- PNG export after ChartCustomizer on each migrated test
- Qual teste modal: demo labeled Demonstração; three migrated tests Disponíveis

## Next Phase Readiness

- Phase 2 integration complete — all four tests selectable and mountable
- Ready for `/gsd:verify-work` UAT and manual PNG spot-check
- Phase 3 can add new statistical tests by extending registry + EstatisticaPage switch

## Self-Check: PASSED

- FOUND: src/features/tests/registry.ts
- FOUND: src/routes/estatistica/EstatisticaPage.tsx
- FOUND: src/routes/mapas/IniciarPesquisaModal.tsx
- FOUND: .planning/phases/02-migrar-testes-existentes/02-06-SUMMARY.md
- FOUND: 8b81e48, 5d72272, aab6f62

---
*Phase: 02-migrar-testes-existentes*
*Completed: 2026-07-25*
