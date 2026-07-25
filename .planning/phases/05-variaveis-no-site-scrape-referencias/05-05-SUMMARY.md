---
phase: 05-variaveis-no-site-scrape-referencias
plan: 05
subsystem: mapas-catalog
tags: [catalogAnalysisData, packs, choropleth, provenance, D-02, D-07, D-18, D-19]

requires:
  - phase: 05-variaveis-no-site-scrape-referencias
    provides: committed public/data/catalog packs + variables.json (05-03)
provides:
  - "Mapas metric facade over real UF×ano packs"
  - "mock.* aliases for amputações / embolia internações / óbitos"
  - "provenance catalog|paste|hybrid (mock retired for pack vars)"
affects:
  - 05-06 Variáveis → Mapas navigate handoff
  - Mapas choropleth / handoff / year pickers

tech-stack:
  added: []
  patterns:
    - "Sync-import committed pack JSON into catalogAnalysisData (no runtime TABNET)"
    - "Alias map for Phase 4 mock IDs; omit null cells (never null→0)"
    - "Year options from yearsAvailable − nullYears; default year = latest non-null"

key-files:
  created:
    - src/features/catalog/catalogAnalysisData.ts
    - src/features/catalog/catalogAnalysisData.test.ts
  modified:
    - src/routes/mapas/mockAnalysisData.ts
    - src/routes/mapas/MapasPage.tsx
    - src/routes/mapas/VariableCheckboxList.tsx
    - src/routes/mapas/mapAnalysisState.ts
    - src/routes/mapas/assembleHandoffTable.ts
    - src/routes/mapas/GroupConfigPanel.tsx
    - src/routes/mapas/TemporalidadeControl.tsx

key-decisions:
  - "Default Mapas variable = sih.embolia_trombose.internacoes (legacy mock.internacoes slot)"
  - "Aliased mock.amputacoes / mock.internacoes / mock.obitos only; did not alias mock.taxa_mortalidade"
  - "cobertura_aps / procedimentos stay out of checkbox list until packs exist (paste path kept)"
  - "mockAnalysisData.ts is thin re-export only — no UF_WEIGHT builders"

patterns-established:
  - "Mapas consumers import @/features/catalog/catalogAnalysisData (facade), not VariaveisPage"
  - "ProvenanceBadge: Catálogo LACIR · {sourceSystem} vs Dados colados por você"

requirements-completed: [CAT-02, CAT-04]

duration: 4min
completed: 2026-07-25
---

# Phase 5 Plan 05: Mapas catalog swap Summary

**Mapas choropleth/handoff now read real SIH/CNES/SIDRA pack UF×ano values via `catalogAnalysisData`, with three stable mock ID aliases and provenance `catalog` (mock retired).**

## Performance

- **Duration:** ~4 min wall-clock (executor wave)
- **Started:** 2026-07-25T22:45:45Z
- **Completed:** 2026-07-25T22:49:30Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- Pack-backed metric API (`getMetricByUf` / `getMetricByUfAndYear` / `getCatalogTimeSeriesYears`) with SP 2019 embolia internações = **5660** (not mock weight ~898000)
- Mapas consumers + provenance badges/year pickers updated; paste/hybrid path preserved
- `mock.taxa_mortalidade` (infantil) left unaliased — no false SIH hospital rate mapping

## Mock IDs aliased

| Phase 4 mock id | Catalog target | Notes |
|-----------------|----------------|-------|
| `mock.amputacoes` | `sih.amputacao_mmii.internacoes` | Alias + pack values |
| `mock.internacoes` | `sih.embolia_trombose.internacoes` | Alias + pack values |
| `mock.obitos` | `sih.embolia_trombose.obitos` | Alias + pack values |
| `mock.taxa_mortalidade` | — | **Not aliased** (infantil ≠ hospital rates) |
| `mock.cobertura_aps` | — | Reference/paste only (no pack) |
| `mock.procedimentos` | — | Reference/paste only (no pack) |

## Task Commits

1. **Task 1 RED:** `bce1662` — `test(05-05): add failing tests for catalogAnalysisData pack metrics`
2. **Task 1 GREEN:** `c42c635` — `feat(05-05): catalogAnalysisData pack metrics and aliases`
3. **Task 2:** `a4356f2` — `feat(05-05): swap Mapas mocks for catalog packs`

**Plan metadata:** `16df55e` (docs: complete Mapas catalog swap plan)

## Files Created/Modified

- `src/features/catalog/catalogAnalysisData.ts` — facade + aliases + year helpers
- `src/features/catalog/catalogAnalysisData.test.ts` — pack SP asserts, nullYears, safe unknowns
- `src/routes/mapas/mockAnalysisData.ts` — deprecated thin re-exports
- Mapas consumers/tests — catalog provenance, labels, year options, handoff medida aliases

## Decisions Made

- Sync-import packs under `public/data/catalog` so Mapas stays sync (no `loadCatalog` race with choropleth)
- Default year = latest non-null for active variable; TemporalidadeControl options filtered by pack years
- Handoff missing cells → `n/d` (T-05-11: no null→0)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Handoff aliases + collection links for new catalog labels**
- **Found during:** Task 2
- **Issue:** Recognized-column handoff and “Ver fontes” links keyed on old mock labels
- **Fix:** Extended `MAPAS_TABULAR_OPTIONS.medida` and `MOCK_COLLECTION_LINKS` for embolia/amputação labels
- **Files modified:** `mapHandoffShared.ts`, `mockCollectionLinks.ts`
- **Committed in:** `a4356f2`

**2. [Rule 3 - Blocking] Remove Mapas `ufCodes` import from catalog facade**
- **Found during:** Task 1→2
- **Issue:** `catalogAnalysisData` imported `@/routes/mapas/ufCodes`, risking layering conflicts with parallel 05-04
- **Fix:** Derive UF sigla/IBGE from pack rows only
- **Files modified:** `catalogAnalysisData.ts`
- **Committed in:** `a4356f2`

**Total deviations:** 2 auto-fixed (Rule 2 ×1, Rule 3 ×1)
**Impact on plan:** Correctness + isolation from Variáveis UI; no scope creep

## Issues Encountered

None blocking.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-06 can navigate `/mapas` with `catalogVariableIds` — metric resolution already pack-backed
- Paste UX unchanged; reference-only vars (APS/procedimentos) remain paste until future packs

## TDD Gate Compliance

- RED commit `bce1662` then GREEN `c42c635` present for Task 1 (`type: execute` with `tdd="true"` on Task 1)

## Self-Check: PASSED

- FOUND: `src/features/catalog/catalogAnalysisData.ts`
- FOUND: `src/features/catalog/catalogAnalysisData.test.ts`
- FOUND: `bce1662`, `c42c635`, `a4356f2`

---
*Phase: 05-variaveis-no-site-scrape-referencias*
*Completed: 2026-07-25*
