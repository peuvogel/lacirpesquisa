---
phase: 05-variaveis-no-site-scrape-referencias
plan: 01
subsystem: infra
tags: [catalog, datasus, offline-pipeline, csv, node-esm, sih, cnes, sidra]

requires:
  - phase: 04-mapas-como-interface-estatistica
    provides: mock.* Mapas IDs to alias; public/ asset pattern
provides:
  - Versioned public/data/catalog packs (embolia + amputação UF×ano)
  - scripts/catalog build pipeline (paths, parseCsv, columnMap, reference-seed)
  - Repo-relative coleta regenerate path
affects:
  - 05-02 catalog:validate
  - 05-03 CatalogEntry types / loadCatalog
  - 05-05 Mapas catalogAnalysisData swap

tech-stack:
  added: []
  patterns:
    - Offline Node ESM catalog:build with allowlisted corpus paths
    - Atomic temp-dir write then rename into public/data/catalog
    - Empty CSV cells → JSON null (never invent 2023 pop)

key-files:
  created:
    - scripts/catalog/paths.mjs
    - scripts/catalog/parseCsv.mjs
    - scripts/catalog/columnMap.json
    - scripts/catalog/reference-seed.json
    - scripts/catalog/build.mjs
    - scripts/catalog/README.md
    - public/data/catalog/manifest.json
    - public/data/catalog/variables.json
    - public/data/catalog/packs/sih.embolia_trombose_uf.json
    - public/data/catalog/packs/sih.amputacao_mmii_uf.json
  modified:
    - package.json
    - trabalhos datasus/scripts/coleta_embolia_trombose_municipio_uf.py
    - trabalhos datasus/scripts/coleta_vascular_amputacao.py

key-decisions:
  - "Package-first from existing coleta CSVs; regenerate optional after BASE_DIR port"
  - "Shared CNES/pop catalog ids emit once with packId=sih.embolia_trombose_uf; amputação pack still carries join columns"
  - "mock.taxa_mortalidade not aliased (infantil ≠ hospital); mock.amputacoes/internacoes/obitos aliased"
  - "18 curated reference-only rows (complete D-05); lacir_projetos reference-only"

patterns-established:
  - "corpusPath allowlist under trabalhos datasus/outputs/coleta_* + build/catalogos"
  - "Wide PackFile rows keyed by uf_codigo/uf/ano with metricKeys"
  - "npm run catalog:build regenerates committed public/data/catalog/*"

requirements-completed: [CAT-05]

duration: 2min
completed: 2026-07-25
---

# Phase 5 Plan 01: Catalog offline pipeline Summary

**Offline `catalog:build` packages real SIH/CNES/SIDRA UF×ano coletas into committed `public/data/catalog` packs (351 rows each) with 32 provenance-complete entries**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-25T22:38:30Z
- **Completed:** 2026-07-25T22:40:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Scaffolded `scripts/catalog/` (paths allowlist, BOM-aware CSV parse, columnMap, reference-seed, README)
- Ported both `coleta_*.py` `BASE_DIR` to `Path(__file__).resolve().parents[1]` (repo `trabalhos datasus/`)
- Built and committed `manifest.json`, `variables.json`, and both packs from real CSVs (empty → `null`; 2023 rates stay null)
- Added `npm run catalog:build` (and `catalog:validate` script hook for 05-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold catalog scripts, columnMap, reference-seed, and port coleta paths** - `6723f0f` (feat)
2. **Task 2: Implement catalog:build and commit generated assets** - `abb8d4a` (feat)

**Plan metadata:** `1d20140` (docs: complete plan)

## Files Created/Modified

- `scripts/catalog/paths.mjs` — repo root + CORPUS allowlist
- `scripts/catalog/parseCsv.mjs` — utf-8-sig; empty → null
- `scripts/catalog/columnMap.json` — loadable column → CatalogEntry seeds + mock aliases
- `scripts/catalog/reference-seed.json` — 18 reference-only D-05 rows
- `scripts/catalog/build.mjs` — normalize → atomic write
- `scripts/catalog/README.md` — package-first + regenerate notes
- `public/data/catalog/*` — committed generated assets
- `package.json` — `catalog:build` / `catalog:validate` scripts
- `trabalhos datasus/scripts/coleta_*.py` — repo-relative BASE_DIR

## Pack / catalog counts

| Asset | Count |
|-------|------:|
| `sih.embolia_trombose_uf` rows | 351 |
| `sih.amputacao_mmii_uf` rows | 351 |
| Catalog entries (total) | 32 |
| Loadable | 14 |
| Reference-only | 18 |

## Decisions Made

- Package validated coletas first (D-03); no TABNET/IBGE calls in build happy path
- Deduplicate shared CNES/pop entries onto embolia packId; amputação pack retains columns for joins
- Do not alias `mock.taxa_mortalidade`; include e-Gestor APS coverage as reference (`mock.cobertura_aps`)
- Quality-curated reference seed (≤25) over dumping raw TABNET titles

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `catalog:validate` npm script | `package.json` → `scripts/catalog/validate.mjs` | File arrives in plan 05-02; script wired early per README/D-10 |

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Assets ready for `catalog:validate` (05-02) and app `loadCatalog` / Variáveis UI
- Mapas can alias `mock.amputacoes` / `mock.internacoes` / `mock.obitos` to catalog ids
- Regenerate path documented; re-scrape not required for v1

## Self-Check: PASSED

- FOUND: `scripts/catalog/build.mjs`
- FOUND: `public/data/catalog/manifest.json`
- FOUND: `public/data/catalog/packs/sih.embolia_trombose_uf.json`
- FOUND: `public/data/catalog/packs/sih.amputacao_mmii_uf.json`
- FOUND: commits `6723f0f`, `abb8d4a`

---
*Phase: 05-variaveis-no-site-scrape-referencias*
*Completed: 2026-07-25*
