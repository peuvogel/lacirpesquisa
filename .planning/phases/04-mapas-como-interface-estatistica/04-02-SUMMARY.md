---
phase: 04-mapas-como-interface-estatistica
plan: 02
subsystem: ui
tags: [choropleth, svg-map, d3-scale, mock-data, mapas, MAP-01]

requires:
  - phase: 04-01
    provides: choroplethScale utilities and geo stack from Wave 0
provides:
  - UF choropleth map with teal sequential scale from mock metrics
  - ChoroplethLegend with PT Baixo/Alto breaks
  - MapGeoPath shared path primitive with selection glow
  - mockAnalysisData with 6 didactic variables keyed by UF sigla/ibgeCode
affects: [04-03, 04-04, 04-05, 04-06, 04-07, 04-08]

tech-stack:
  added: []
  patterns: [MapGeoPath extraction, BrazilMapCanvas choropleth join, mock.internacoes default variable]

key-files:
  created:
    - src/routes/mapas/mockAnalysisData.ts
    - src/routes/mapas/ChoroplethLegend.tsx
    - src/routes/mapas/ChoroplethLegend.test.tsx
    - src/routes/mapas/MapGeoPath.tsx
    - src/routes/mapas/BrazilMapCanvas.tsx
  modified:
    - src/routes/mapas/BrazilMockMap.tsx
    - src/routes/mapas/BrazilMockMap.test.tsx
    - src/routes/mapas/MapasPage.tsx
    - src/geo/choroplethScale.ts
    - src/geo/choroplethScale.test.ts
    - src/index.css

key-decisions:
  - "BrazilMockMap delegates to BrazilMapCanvas with empty choropleth for backward compat until Wave 3"
  - "legendBreaks uses PT endpoint labels Baixo/Alto per UI-SPEC copywriting contract"
  - "Default choropleth variable mock.internacoes until group panel ships in Wave 5"

patterns-established:
  - "Pattern: MapGeoPath — shared SVG path with inline choropleth fill + lacir-map-glow on selection"
  - "Pattern: mockAnalysisData stable IDs (mock.*) for Phase 5 catalog swap"

requirements-completed: [MAP-01]

duration: 25min
completed: 2026-07-25
---

# Phase 4 Plan 02: UF Choropleth + Legend Summary

**Brazil UF choropleth with sequential teal scale, PT legend breaks, and mock didactic metrics live on Mapas route**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-25T22:12:00Z
- **Completed:** 2026-07-25T22:14:17Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Created mockAnalysisData with 6 variables covering all 27 UFs (SP highest for internações)
- ChoroplethLegend card with "Intensidade no mapa" title and Baixo→Alto teal breaks
- Extracted MapGeoPath + BrazilMapCanvas with createChoroplethScale fills and selection glow
- MapasPage renders choropleth map + legend with default mock.internacoes; a11y tests preserved

## Task Commits

1. **Task 1: Mock metrics + choropleth scale tests** - `cf4ed28` (feat)
2. **Task 2: Extract MapGeoPath and BrazilMapCanvas with choropleth fill** - `a07e7f9` (feat)
3. **Task 3: Wire choropleth into MapasPage with default mock variable** - `82848fb` (feat)

**Plan metadata:** `500730b` (docs: complete plan)

## Files Created/Modified

- `src/routes/mapas/mockAnalysisData.ts` — 6 didactic mock variables with UF sigla + ibgeCode crosswalk
- `src/routes/mapas/ChoroplethLegend.tsx` — elevated card legend with PT labels and provenance footnote
- `src/routes/mapas/MapGeoPath.tsx` — shared path primitive preserving BrazilMockMap a11y
- `src/routes/mapas/BrazilMapCanvas.tsx` — UF map with choropleth scale join
- `src/routes/mapas/MapasPage.tsx` — BrazilMapCanvas + ChoroplethLegend wired
- `src/geo/choroplethScale.ts` — PT Baixo/Alto legend bucket labels
- `src/index.css` — `.lacir-map-glow` drop-shadow per UI-SPEC

## Decisions Made

- BrazilMockMap kept as thin deprecated wrapper delegating to BrazilMapCanvas (Wave 3 refactor)
- Choropleth fill preserved on selected UFs; selection adds teal stroke + glow overlay (D-04)
- activeChoroplethVariableId state defaults to mock.internacoes; variable picker deferred to Wave 5

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — 64 mapas tests green, typecheck green.

## User Setup Required

None.

## Next Phase Readiness

- Wave 2 (04-03): territory paste can proceed independently
- Wave 3–5: activeChoroplethVariableId state ready for group panel variable binding
- Wave 4 drill-down: MapGeoPath reusable for sub-UF paths from projectGeoToSvg

## Self-Check: PASSED

- FOUND: src/routes/mapas/ChoroplethLegend.tsx
- FOUND: src/routes/mapas/BrazilMapCanvas.tsx
- FOUND: src/routes/mapas/mockAnalysisData.ts
- FOUND: commit cf4ed28
- FOUND: commit a07e7f9
- FOUND: commit 82848fb

---
*Phase: 04-mapas-como-interface-estatistica*
*Completed: 2026-07-25*
