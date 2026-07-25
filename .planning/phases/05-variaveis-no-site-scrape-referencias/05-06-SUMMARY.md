---
phase: 05-variaveis-no-site-scrape-referencias
plan: 06
subsystem: ui
tags: [variaveis, mapas, handoff, SessionDataset, catalogVariableIds, CAT-04, D-14, D-15, D-16]

requires:
  - phase: 05-variaveis-no-site-scrape-referencias
    provides: "Variáveis catalog UI + Estatística load (05-04); catalogAnalysisData packs (05-05)"
provides:
  - "Carregar na Estatística with multi-select D-16 gate + ≤12 cap"
  - "Usar no mapa → /mapas catalogVariableIds apply once into active group"
affects:
  - "05-07 scrape/reference polish / classroom UAT"
  - "Mapas group checkbox UX when no UF lock"

tech-stack:
  added: []
  patterns:
    - "navigate state { catalogVariableIds } cleared with replace after APPLY_CATALOG_VARIABLE_IDS"
    - "resolveCatalogHandoffIds ignores unknown/reference-only; aliases via getCatalogVariableById"
    - "assertCompatibleSelection shared preflight for Estatística and Mapas"

key-files:
  created: []
  modified:
    - src/features/catalog/buildSessionDataset.ts
    - src/routes/variaveis/VariableDetailPanel.tsx
    - src/routes/variaveis/VariaveisPage.tsx
    - src/routes/variaveis/VariaveisPage.test.tsx
    - src/routes/mapas/MapasPage.tsx
    - src/routes/mapas/MapasPage.test.tsx
    - src/routes/mapas/mapAnalysisState.ts
    - src/routes/mapas/mapAnalysisState.test.ts
    - src/routes/mapas/VariableCheckboxList.tsx

key-decisions:
  - "Estatística navigate stays on '/' (no /estatistica route) with state.activeTestId"
  - "Mapas handoff creates 'Catálogo' group with default point year when none active"
  - "Empty-UF VariableCheckboxList shows full CATALOG_ANALYSIS_VARIABLES so handoff checks are visible"
  - "MAX_LOADABLE_SELECTION = 12 enforced in assertCompatibleSelection and resolveCatalogHandoffIds"

patterns-established:
  - "Shared handoffError on Variáveis for both load actions"
  - "APPLY_CATALOG_VARIABLE_IDS reducer action for deep-link apply"

requirements-completed: [CAT-04]

duration: 2min
completed: 2026-07-25
---

# Phase 05 Plan 06: Variáveis ↔ Estatística/Mapas Handoff Summary

**CAT-04 classroom load path: multi-select catalog vars → SessionDataset on Estatística, or Mapas group selection via catalogVariableIds, with D-16 UF×ano join gates and no TABNET**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-25T22:50:02Z
- **Completed:** 2026-07-25T22:52:16Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Hardened Estatística handoff: ≤12 cap, clearer PT-BR D-16 errors, multi-select embolia coverage
- Wired **Usar no mapa** with the same compatibility preflight → `navigate('/mapas', { catalogVariableIds })`
- Mapas applies known loadable IDs once (`APPLY_CATALOG_VARIABLE_IDS`), sets catalog/hybrid provenance, prefers UF layer, clears location.state

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Carregar na Estatística + multi-select gate** - `ebba9f4` (feat)
2. **Task 2: Wire Usar no mapa + Mapas apply catalogVariableIds** - `def2de1` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `src/features/catalog/buildSessionDataset.ts` — MAX_LOADABLE_SELECTION + D-16 message polish
- `src/routes/variaveis/VariaveisPage.tsx` — Estatística + Mapas handlers, shared handoffError
- `src/routes/variaveis/VariableDetailPanel.tsx` — enabled Usar no mapa action
- `src/routes/mapas/mapAnalysisState.ts` — resolve/apply catalog handoff IDs
- `src/routes/mapas/MapasPage.tsx` — consume location.state once
- `src/routes/mapas/VariableCheckboxList.tsx` — full catalog list when no UF lock
- Tests: `VariaveisPage.test.tsx`, `MapasPage.test.tsx`, `mapAnalysisState.test.ts`, `buildSessionDataset.test.ts`

## Decisions Made
- Keep Estatística at `/` (router has no `/estatistica`) matching ReviewAnalysisDialog
- Ignore unknown/reference IDs on Mapas apply (T-05-12); cap at 12 (T-05-13)
- When territories are empty, show all loadable catalog checkboxes so handoff selection is visible without forcing a preset first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Empty-UF checkbox list was blank after handoff**
- **Found during:** Task 2 (Usar no mapa)
- **Issue:** `VariableCheckboxList` intersection is empty when no UFs are selected, so applied `variableIds` never appeared as checked boxes
- **Fix:** When `territorySiglas.length === 0`, render `CATALOG_ANALYSIS_VARIABLES` (plus paste overlays)
- **Files modified:** `src/routes/mapas/VariableCheckboxList.tsx`
- **Verification:** `MapasPage.test.tsx` handoff case — checkbox checked for embolia internações
- **Committed in:** `def2de1`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Necessary for D-15 “checkbox list shows selection”; no scope creep

## Issues Encountered
None

## Handoff behaviors verified
- Multi-select two embolia loadables → Estatística `setDataset` with `uf_codigo`/`ano` headers and Catálogo sourceLabel
- Reference-only alone → both load buttons disabled
- Usar no mapa → `/mapas` with `catalogVariableIds`; Mapas applies known loadable IDs, ignores unknown/ref, choropleth metrics resolve via `getMetricByUf`
- Cross-pack join / grain mismatch covered in `buildSessionDataset` unit tests (PT errors)
- No runtime DATASUS/TABNET in load path

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
CAT-04 browse → load Estatística / Usar no mapa is complete for committed packs. Ready for 05-07 (remaining phase polish / scrape pipeline follow-ups per roadmap).

## Self-Check: PASSED
- FOUND: `.planning/phases/05-variaveis-no-site-scrape-referencias/05-06-SUMMARY.md`
- FOUND: commits `ebba9f4`, `def2de1`

---
*Phase: 05-variaveis-no-site-scrape-referencias*
*Completed: 2026-07-25*
