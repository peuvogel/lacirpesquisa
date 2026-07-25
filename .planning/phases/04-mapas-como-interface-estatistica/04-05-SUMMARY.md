---
phase: 04-mapas-como-interface-estatistica
plan: 05
subsystem: geo
tags: [topojson, drill-down, choropleth, breadcrumb, municipality-matching, lazy-import]

requires:
  - phase: 04-01
    provides: loadGeoAsset, projectGeoToSvg, matchTerritoryLabels, BA fixtures
  - phase: 04-02
    provides: BrazilMapCanvas UF choropleth
  - phase: 04-03
    provides: TerritoryPastePanel UF paste
provides:
  - MAP-03 drill-down ladder with MapBreadcrumb and lazy sub-UF choropleths
  - MAP-04 municipality paste scoped by active UF with matched/unmatched report
  - MAP-05 lazy dynamic-import geo pipeline for all 27 UFs (BA fixture in CI)
affects: [04-06, 04-07, 04-08]

tech-stack:
  added: []
  patterns:
    - "Lazy TopoJSON via dynamic import per UF/meso/health-macro chunk"
    - "Single in-flight drill load token prevents spam (T-04-05-02)"
    - "matchMunicipalityPaste with looksLikeMunicipalityIntent heuristic"

key-files:
  created:
    - src/routes/mapas/MapBreadcrumb.tsx
    - src/geo/topo/health-macro.sample.json
    - src/routes/mapas/MapBreadcrumb.test.tsx
  modified:
    - src/geo/loadGeoAsset.ts
    - src/geo/projectGeoToSvg.ts
    - src/geo/matchTerritoryLabels.ts
    - src/routes/mapas/BrazilMapCanvas.tsx
    - src/routes/mapas/MapGeoPath.tsx
    - src/routes/mapas/TerritoryPastePanel.tsx
    - src/routes/mapas/MapasPage.tsx
    - src/geo/types.ts

key-decisions:
  - "health-macro.sample.json ships as didactic BA subset with PT note — full MS/SUS asset deferred"
  - "Meso drill filters br-meso by UF IBGE prefix; sample lacks BA mesos so empty state hint shown"
  - "Municipality paste scope uses looksLikeMunicipalityIntent (length>3 or space) to avoid blocking XYZ typos"

patterns-established:
  - "Pattern: MapBreadcrumb SET_MAP_VIEW navigation preserving groups on Brasil return"
  - "Pattern: TerritoryPastePanel async nameTable load when activeUfScope set"

requirements-completed: [MAP-03, MAP-04, MAP-05]

duration: 35min
completed: 2026-07-25
---

# Phase 4 Plan 05: Drill-Down + Municipality Matching Summary

**UF→município/meso/macrorregião drill-down with lazy TopoJSON chunks, breadcrumb navigation, and UF-scoped municipality paste matching offline**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-25T22:18:00Z
- **Completed:** 2026-07-25T22:53:00Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Extended loadGeoAsset with dynamic import map for all 27 UFs; BA muni-29 + health-macro.sample + br-meso.sample in CI
- MapBreadcrumb + BrazilMapCanvas drill ladder: double-click UF → lazy load, level tabs, loading skeleton, error Alert with back link
- matchMunicipalityPaste + TerritoryPastePanel UF scope: Salvador→2927408, unmatched report, scope-required alert
- Build verification: muni-29 (103 KB) and health-macro.sample in separate chunks — not in main index bundle (MAP-05/D-19)

## Task Commits

1. **Task 1: Extend lazy geo loaders and projection tests** - `a306076` (feat)
2. **Task 2: MapBreadcrumb + BrazilMapCanvas drill-down ladder** - `61268bf` (feat)
3. **Task 3: Municipality matching scoped by UF in TerritoryPastePanel** - `7f43bc0` (feat)

**Plan metadata:** `99a67aa` (docs: complete plan)

## Files Created/Modified

- `src/geo/loadGeoAsset.ts` — MAP-05 offline contract; loaders for 27 UFs, meso, health-macro sample
- `src/geo/topo/health-macro.sample.json` — Didactic 2-region BA sample (not production MS/SUS asset)
- `src/routes/mapas/MapBreadcrumb.tsx` — Brasil → UF → level tabs navigation
- `src/routes/mapas/BrazilMapCanvas.tsx` — Drill-down choropleth with lazy load + error handling
- `src/geo/matchTerritoryLabels.ts` — matchMunicipalityPaste with 200-line cap
- `src/routes/mapas/TerritoryPastePanel.tsx` — UF-scoped muni matching with Reconhecidos/Não reconhecidos UI

## Decisions Made

- health-macro.sample.json generated from BA muni geometries as didactic placeholder; UI copy notes sample set
- Kept meso/health-macro as Brazil-wide assets with UF-prefix filter for meso; health-macro sample is BA-only
- parseText without UF scope still uses matchUfPaste; scope alert only when municipality-intent lines detected

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Paste heuristic blocked valid UF+typo pastes**
- **Found during:** Task 3 (TerritoryPastePanel tests)
- **Issue:** Lines with length > 2 without UF scope triggered scope-required, breaking "BA\nXYZ" flow
- **Fix:** Added looksLikeMunicipalityIntent (length>3 or contains space) for scope gating
- **Files modified:** src/geo/matchTerritoryLabels.ts, src/routes/mapas/TerritoryPastePanel.tsx
- **Committed in:** 7f43bc0

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Heuristic refinement only; MAP-04 behavior preserved.

## Known Stubs

| File | Reason |
|------|--------|
| `src/geo/topo/health-macro.sample.json` | Didactic BA sample — malha completa MS/SUS requer `scripts/fetch-geo-assets.mjs` + mapshaper |
| `src/geo/topo/br-meso.sample.json` | 3-region CI sample without BA mesos — meso drill for BA shows empty hint |
| `src/geo/topo/muni-{uf}.json` (non-29) | Only BA committed; other UFs throw until fetch script run locally |

## Bundle Spot-Check (MAP-05)

Production build splits geo into lazy chunks:
- `dist/assets/muni-29-*.js` — 103 KB (not in index)
- `dist/assets/health-macro.sample-*.js` — 66 KB
- `dist/assets/br-meso.sample-*.js` — 7.6 KB
- Main `index-*.js` — 1.24 MB (app code only)

## Issues Encountered

None — 135 mapas/geo tests green, typecheck + build pass.

## User Setup Required

None for CI. For full 27-UF drill offline: `node scripts/fetch-geo-assets.mjs --all-ufs --meso --names`

## Next Phase Readiness

- Wave 5 (04-06): temporalidade + variable intersection can use drilled territory refs
- Wave 6 (04-07): ReviewHandoffDialog can consume mapView + municipality selections
- Run fetch script locally before demoing non-BA UF drill

## Self-Check: PASSED

- FOUND: src/routes/mapas/MapBreadcrumb.tsx
- FOUND: src/geo/topo/health-macro.sample.json
- FOUND: commit a306076
- FOUND: commit 61268bf
- FOUND: commit 7f43bc0

---
*Phase: 04-mapas-como-interface-estatistica*
*Completed: 2026-07-25*
