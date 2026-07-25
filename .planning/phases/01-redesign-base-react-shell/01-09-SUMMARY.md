---
phase: 01-redesign-base-react-shell
plan: 09
subsystem: ui
tags: [react, mapas, svg, ibge, mock-data, vitest, accessibility]

requires:
  - phase: 01-05
    provides: MapasPage two-panel skeleton and router shell
provides:
  - Interactive 27-UF Brazil mock map with keyboard operability
  - Variable intersection/partial derivation (D-22) with mock fixture
  - VariablePanel + MapasPage assembly publishing mapSelection to session
affects: [01-11, phase-4-mapas]

tech-stack:
  added: []
  patterns:
    - "IBGE Malhas SVG geometry committed as sanitized data (brazilUfPaths.ts), rendered as React paths"
    - "hoveredUF / selectedUFs / selectedVariables state owned by MapasPage"
    - "computeVariableIntersection pure function for intersection-first panel lists"

key-files:
  created:
    - src/routes/mapas/ufCodes.ts
    - src/routes/mapas/brazilUfPaths.ts
    - src/routes/mapas/BrazilMockMap.tsx
    - src/routes/mapas/BrazilMockMap.test.tsx
    - src/routes/mapas/mockVariablesByUF.ts
    - src/routes/mapas/computeVariableIntersection.ts
    - src/routes/mapas/computeVariableIntersection.test.ts
    - src/routes/mapas/VariablePanel.tsx
    - src/routes/mapas/VariablePanel.test.tsx
    - src/routes/mapas/MapLegendHint.tsx
  modified:
    - src/routes/mapas/MapasPage.tsx

key-decisions:
  - "Sourced map geometry from IBGE Malhas API (option a) — path id attributes are two-digit IBGE UF codes, crosswalked via ufCodes.ts"
  - "Cartogram fallback not needed — official IBGE SVG fetched once at dev time and committed offline (T-01-NET)"
  - "Single-UF hover/lock lists all variables as intersection rows (no partial section) for simpler panel UX"

patterns-established:
  - "BrazilMockMap contract: hoveredUF, selectedUFs, onHoverUF, onToggleUF — stable for Phase 4 data swap"
  - "VariablePanel contract: multi-select checkboxes + Iniciar pesquisa stub for plan 01-11"

requirements-completed: [UI-01]

duration: 25min
completed: 2026-07-25
---

# Phase 1 Plan 09: Mapas Mock Summary

**Interactive Brazil-by-UF mock map with intersection-first variable panel, keyboard access, and session mapSelection — zero geo dependencies**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-25T18:02:00Z
- **Completed:** 2026-07-25T18:27:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- 27-UF inline SVG map from sanitized IBGE Malhas geometry with hover, lock, Enter/Space keyboard toggling, and `aria-pressed`
- Mock variable fixture covering all UFs with deliberate gaps (BA/PE/CE/…) exercising `Não existe em …` partial alerts (D-22)
- Mapas page 60/40 layout: map + legend hint + variable panel with multi-select, `limpar seleção`, Escape clear, and `setMapSelection` session publish

## SVG Sourcing

| Item | Detail |
|------|--------|
| **Route used** | Option **(a)** — IBGE Malhas API, fetched once offline |
| **Endpoint** | `https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=image/svg+xml&qualidade=minima&intrarregiao=UF` |
| **Crosswalk** | Each `<path id="…">` is the two-digit IBGE UF code; mapped to sigla via `ufCodes.ts` (Open Question 1 resolved — no positional guessing) |
| **License** | IBGE open government data (Lei de Acesso à Informação / Dados Abertos); no attribution required |
| **Cartogram fallback** | **Not used** |
| **Sanitization** | Scripts, `on*` handlers, `foreignObject`, and external `href` stripped; geometry stored as `{ sigla, d }` data; test guards against regression (T-01-SVG) |

## Task Commits

1. **Task 1: Source 27-UF SVG and build interactive map** - `fd21e8a` (feat)
2. **Task 2: Mock fixture and intersection derivation** - `9180e10` (feat)
3. **Task 3: Variable panel and Mapas page assembly** - `08c16eb` (feat)

**Plan metadata:** `9732d8f` (docs: complete plan)

## Files Created/Modified

- `src/routes/mapas/ufCodes.ts` — 27 UF entries (sigla, name, IBGE code) + `getUfName`
- `src/routes/mapas/brazilUfPaths.ts` — sanitized IBGE path geometry + viewBox/group transform
- `src/routes/mapas/BrazilMockMap.tsx` — interactive SVG map component
- `src/routes/mapas/mockVariablesByUF.ts` — Phase 1 mock catalog with deliberate gaps
- `src/routes/mapas/computeVariableIntersection.ts` — D-22 intersection/partial derivation
- `src/routes/mapas/VariablePanel.tsx` — intersection-first panel with multi-select
- `src/routes/mapas/MapLegendHint.tsx` — hover/click caption until first interaction
- `src/routes/mapas/MapasPage.tsx` — full page state + session publish

## Decisions Made

- Used official IBGE Malhas SVG (not cartogram fallback) because path IDs already encode IBGE UF codes
- `onIniciarPesquisa` remains a no-op placeholder for plan 01-11 modal wiring
- Variable list for single UF (hover or one locked) shows all vars as intersection rows without partial section

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan **01-11** can wire `IniciarPesquisaModal` to `onIniciarPesquisa` and read `session.mapSelection`
- Phase 4 can swap `MOCK_VARIABLES_BY_UF` and optionally replace `brazilUfPaths.ts` while keeping the same component contracts

## Self-Check: PASSED

- FOUND: src/routes/mapas/BrazilMockMap.tsx
- FOUND: src/routes/mapas/computeVariableIntersection.ts
- FOUND: src/routes/mapas/VariablePanel.tsx
- FOUND: src/routes/mapas/MapasPage.tsx
- FOUND: fd21e8a
- FOUND: 9180e10
- FOUND: 08c16eb

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
