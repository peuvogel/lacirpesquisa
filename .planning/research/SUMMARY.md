# Project Research Summary

**Project:** Bioestatística LACIR
**Domain:** Client-only educational biostatistics SPA (React rewrite + maps + DataSUS catalog)
**Researched:** 2026-07-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

v2.0 is a **re-platform** of a working vanilla Vite calculator onto React + Tailwind + shadcn/cult-ui, plus three new capability areas (advanced tests/GLM, Brazil choropleths, DataSUS catalog) and meta-analysis last. Experts build tools like this as modular pure-stats engines behind a shared paste→configure→results shell — not as a JASP/SPSS clone.

Recommended approach: keep Chart.js; port existing parsers/`Stats` as shared modules; implement GLM and meta-analysis as small in-repo engines validated against JASP/R; ship pre-simplified TopoJSON (no runtime IBGE, no Mapbox).

Key risks: incorrect GLM/NB numerics, wrong IBGE joins, oversized map assets, and scope creep into mini-JASP. Mitigate with golden-file tests, a territory resolver, build-time map simplification, and hard anti-feature boundaries.

## Key Findings

### Recommended Stack

React 19 + Vite 8 + Tailwind v4 + shadcn/ui + cult-ui registry; keep Chart.js; add `jstat`, `ml-matrix`, `simple-statistics`, `@stdlib` chi²/ANOVA/Kruskal; Chart.js geo + error-bars plugins; `fuse.js` for name matching; `mapshaper` (dev) for TopoJSON.

**Core technologies:**
- **React + Vite + Tailwind v4 + shadcn/cult-ui** — redesign shell, dark+green tokens
- **Chart.js + chartjs-chart-geo / error-bars** — charts, choropleth, forest plots without a second viz stack
- **Custom GLM + meta modules on ml-matrix/jstat** — no mature npm suite for Poisson/Logistic/NB + didactic meta

**What NOT to add:** Next.js/SSR, Mapbox, R/WASM JASP, GPL meta packages (`shukra`), Recharts/D3 as second chart stack, auth/backend libs.

### Expected Features

**Must have (table stakes):**
- Dark+green tabbed shell; paste with `;` + decimal comma; PNG download; refresh-loss warning
- Migrate t-Student, Pearson/Spearman, Prais-Winsten with parity
- Chi-square (+ effect size), ANOVA+Tukey, Kruskal+Dunn
- Poisson + NegBin (paired) + Logistic (OR+CI)
- UF heatmap + name/sigla resolve; intra-state município/meso/região de saúde
- Catalog: searchable classified variables + official links
- Meta last: FE/RE (DL), forest, I², funnel, Egger

**Should have (competitive):**
- Plain-Portuguese interpretation + next-step nudges per test
- Assumption checks (expected counts, overdispersion)
- “Which test?” decision tree
- Catalog → suggested test by variable type

**Defer / anti-features:**
- Bayesian meta, trim-and-fill suite, zero-inflated GLMs, animated maps, bulk DataSUS scrape, login/cloud save, JASP UI clone

### Architecture Approach

App shell with tabs (Testes | Mapas | Catálogo | Meta). Shared services: data paste/parse (port `tabular-data-input` + DataSUS wizard), pure `stats/*`, chart/export, region resolver. In-memory session only. Static registry of test components (drop runtime manifest dynamic import). Curate one `catalog.json` from existing `trabalhos datasus/build/catalogos`.

**Major components:**
1. App shell + theme — tabs, brand, session store
2. Tests feature + stats engine — migrate then extend
3. Maps + geo resolver — bundled TopoJSON
4. Catalog browser — curated JSON + outbound links
5. Meta-analysis — last, reuses charts/stats patterns

### Critical Pitfalls

1. **GLM ≠ JASP** — golden fixtures + shared IRLS; Poisson before NB
2. **Wrong territory joins** — IBGE resolver, UF-scoped município match, match report
3. **Huge GeoJSON / live IBGE** — simplify at build; lazy per-UF meshes
4. **Rewrite regressions** — port parsers/stats first; parity checklist
5. **Mini-JASP creep** — oracle = numbers/conventions, not feature parity

## Implications for Roadmap

### Phase 1: Redesign / base React shell
**Rationale:** Everything mounts here; locks stack and brand.
**Delivers:** React+Vite+TW+shadcn dark/green, tabs, shared paste component, session store, refresh warning.
**Avoids:** Mapbox/auth; purple leftover Tailwind.

### Phase 2: Migrate existing tests
**Rationale:** Protect validated capacitação value.
**Delivers:** t-Student, correlação, Prais-Winsten parity + interpretation + PNG.
**Avoids:** Rewrite regressions.

### Phase 3: Classic + GLM new tests
**Rationale:** Capacitação missing tests; GLM is highest math risk.
**Delivers:** Qui², ANOVA/KW(+post-hoc), Poisson→NB, Logistic; fixtures vs JASP.
**Avoids:** Wrong numerics; scope into full GLM framework.

### Phase 4: Maps Brasil + estados
**Rationale:** Needs shell + data paste; independent of meta.
**Delivers:** UF choropleth, drill-down, resolver, match report, static TopoJSON pipeline.
**Avoids:** Code mismatches; payload jank.

### Phase 5: Painel DataSUS / catálogo
**Rationale:** Data already exists; UX sequencing after maps.
**Delivers:** Search/filter classified variables + links (+ optional suggested test).
**Avoids:** Scraper UI / bulk download.

### Phase 6: Meta-análise (last)
**Rationale:** Different input shape; reuses chart/stats maturity.
**Delivers:** FE/RE DL, forest, I², funnel, Egger + guided copy.
**Avoids:** Bayesian / trim-and-fill creep.

## Open Questions

None blocking requirements — product decisions already locked in PROJECT.md. Spike only: `@tangent.to/ds` vs custom IRLS for logistic/Poisson; região-de-saúde crosswalk license before bundling.

## How This Differs from New Projects

Brownfield: port working `Stats`, tabular parsers, and DataSUS wizard — do not rebuild math from zero. Catalog JSON and JASP tree are research assets, not product UI templates.

---
*Research completed: 2026-07-25*
*Sources: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*Next: `/gsd-new-milestone` requirements scoping → roadmap*
