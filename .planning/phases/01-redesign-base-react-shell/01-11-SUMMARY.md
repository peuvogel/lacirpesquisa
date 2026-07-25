---
phase: 01-redesign-base-react-shell
plan: 11
subsystem: ui
tags: [react, mapas, modal, datasus, session-handoff, vitest]

requires:
  - phase: 01-redesign-base-react-shell
    provides: MapasPage selection state, TEST_REGISTRY, TabularInputPanel, SessionProvider
provides:
  - IniciarPesquisaModal stub flow (D-24)
  - suggestResearchForSelection mock rules
  - mockCollectionLinks official portal map
  - Mapas → paste → Estatística session handoff
affects: [01-12, phase-4-catalog, phase-5-datasus-links]

tech-stack:
  added: []
  patterns:
    - "Selection-driven research suggestions always include demo and resolve to TEST_REGISTRY ids"
    - "Modal paste reuses TabularInputPanel + useTabularInput with broad DATASUS-shaped aliases"
    - "Continue publishes session.dataset then navigates to / for TesteDemo hydration"

key-files:
  created:
    - src/routes/mapas/mockCollectionLinks.ts
    - src/routes/mapas/suggestResearchForSelection.ts
    - src/routes/mapas/suggestResearchForSelection.test.ts
    - src/routes/mapas/IniciarPesquisaModal.tsx
    - src/routes/mapas/IniciarPesquisaModal.test.tsx
  modified:
    - src/routes/mapas/MapasPage.tsx

key-decisions:
  - "MAPAS_TABULAR_OPTIONS uses broad territorio/medida aliases so junk paste errors while typical TABNET tables still load"
  - "Continue requires loaded paste with ≥2 columns and ≥1 data row — not loaded status alone"
  - "Stub notice is a non-alert banner so parse-error alerts remain unambiguous"

patterns-established:
  - "Mapas handoff: suggestResearchForSelection → getCollectionLinks → TabularInputPanel → setDataset → navigate('/')"

requirements-completed: [UI-01, UI-03]

duration: 25min
completed: 2026-07-25
---

# Phase 1 Plan 11: Iniciar pesquisa Stub Summary

**Mapas research launcher stub — mock analysis suggestions, official collection links, paste handoff into Estatística via session.dataset**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-25T18:04:00Z
- **Completed:** 2026-07-25T18:29:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `suggestResearchForSelection` maps UF/variable selections to registry-safe test ids with Portuguese rationales; `demo` is always included
- `mockCollectionLinks` maps all mock variables to TABNET, e-Gestor, SIDRA, and Atlas landing pages with collection notes
- `IniciarPesquisaModal` delivers the three-part D-24 flow with a visible Phase 1 stub notice, availability badges matching the sidebar, external links with `noopener noreferrer`, and paste-and-continue into Estatística
- `MapasPage` opens the modal from `Iniciar pesquisa` while preserving map/panel behavior from plan 01-09

## Task Commits

1. **Task 1: Mock research suggestions and official collection links** - `9982d0a` (feat)
2. **Task 2: The Iniciar pesquisa modal and the handoff into Estatística** - `4968491` (feat)

**Plan metadata:** `c8f87ae` (docs: complete plan)

## Files Created/Modified

- `src/routes/mapas/mockCollectionLinks.ts` - Official portal links per mock variable
- `src/routes/mapas/suggestResearchForSelection.ts` - Rule-based analysis suggestions
- `src/routes/mapas/suggestResearchForSelection.test.ts` - Registry guard + rule assertions
- `src/routes/mapas/IniciarPesquisaModal.tsx` - Three-section Dialog with handoff
- `src/routes/mapas/IniciarPesquisaModal.test.tsx` - Modal RTL coverage (stub, links, paste, navigate, Escape)
- `src/routes/mapas/MapasPage.tsx` - Modal state wiring

## Decisions Made

- Broad `MAPAS_TABULAR_OPTIONS` aliases (território + medida) keep friendly junk errors without demo-specific required keys
- Continue is gated on a minimally valid table (≥2 columns, ≥1 row), not parser `loaded` alone
- `showPreview={false}` on `TabularInputPanel` inside the modal — preview/confirm belongs to Estatística Configurar step

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added MAPAS_TABULAR_OPTIONS for friendly parse errors**
- **Found during:** Task 2 (IniciarPesquisaModal.test.tsx junk paste assertion)
- **Issue:** Bare `useTabularInput()` treats single-word paste as a one-column loaded table — no error alert, plan acceptance unmet
- **Fix:** Added broad DATASUS-shaped `requiredKeys` so unrecognizable paste surfaces the same Portuguese error copy as Estatística
- **Files modified:** `src/routes/mapas/IniciarPesquisaModal.tsx`
- **Verification:** `IniciarPesquisaModal.test.tsx` junk paste case passes
- **Committed in:** `4968491`

**2. [Rule 2 - Missing Critical] Tightened continue gate beyond `loaded` status**
- **Found during:** Task 2 (continue enablement review)
- **Issue:** One-column junk paste would enable continue and publish unusable data
- **Fix:** Continue requires `headers.length >= 2` and `bodyRows.length > 0`
- **Files modified:** `src/routes/mapas/IniciarPesquisaModal.tsx`
- **Verification:** Modal tests + full `npm run test:run`
- **Committed in:** `4968491`

**3. [Rule 2 - Missing Critical] Stub notice avoids `role="alert"`**
- **Found during:** Task 2 (error alert test debugging)
- **Issue:** Warning `Alert` competed with parse-error alerts in tests and screen readers
- **Fix:** Replaced stub notice with a styled non-alert banner
- **Files modified:** `src/routes/mapas/IniciarPesquisaModal.tsx`
- **Committed in:** `4968491`

---

**Total deviations:** 3 auto-fixed (3 missing critical)
**Impact on plan:** All required for UI-03 friendly errors, honest handoff gating, and accessible alert semantics. No scope creep.

## Issues Encountered

None blocking — full suite (236 tests), typecheck, and build green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan **01-12** can proceed on remaining Phase 1 items
- Phase 4/5 can swap `suggestResearchForSelection` rules and `mockCollectionLinks` for real catalog data without changing the handoff shape

## Self-Check: PASSED

- FOUND: src/routes/mapas/mockCollectionLinks.ts
- FOUND: src/routes/mapas/suggestResearchForSelection.ts
- FOUND: src/routes/mapas/suggestResearchForSelection.test.ts
- FOUND: src/routes/mapas/IniciarPesquisaModal.tsx
- FOUND: src/routes/mapas/IniciarPesquisaModal.test.tsx
- FOUND: src/routes/mapas/MapasPage.tsx (modal wiring)
- FOUND: 9982d0a
- FOUND: 4968491

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
