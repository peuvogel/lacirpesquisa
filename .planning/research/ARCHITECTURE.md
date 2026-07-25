# Architecture Research

**Domain:** Client-only React rewrite of a modular biostatistics teaching tool (didactic calculator + Brazil maps + DataSUS catalog)
**Researched:** 2026-07-25
**Confidence:** HIGH (existing codebase read directly) / MEDIUM (new modules: maps, catalog, meta-analysis — grounded in current docs, no live prototype yet)

## Existing System (v1.0 baseline — what is being replaced)

Read directly from `index.html`, `assets/js/app.js`, `tests-manifest.json`, and the `tests/*` folders:

- **Shell:** static `index.html` with a sidebar (`#test-nav`) and a `#module-root` mount point. No framework, no bundler-driven routing.
- **Loader (`app.js`):** fetches `tests-manifest.json` at runtime, then for the selected test does a **runtime-validated dynamic `import()`** of `tests/{id}/module.js` (with cache-busting via content hash, HTML/JS content-type sniffing, and stale-load cancellation via an incrementing `loadId` + `AbortController`). Each module exports `renderTestModule(ctx)` and receives a shared `ctx = { root, config, manifest, currentTest, utils, stats, shared }`.
- **Stats engine:** a single `Stats` object in `app.js` — pure functions (`mean`, `sd`, `pearson`, `spearman`, `welchT`, `praisWinsten`, plus the numerical primitives `gammaln`, `betacf`, `ibeta`, `tcdf`, `tInv`, Fisher CI). No dependencies, fully portable.
- **Shared data pipeline:** `utils.parseDelimitedText` (paste → delimiter sniff → header detection → rows) plus a newer, more robust standalone module `assets/js/tabular-data-input.js` (NFC normalization, mojibake repair, quoted-field CSV/TSV splitting, header-token normalization). There are **two generations of the same concern** living side by side — the newer one is the better port target.
- **DataSUS wizard:** `datasus-importer.js` (parses raw TABNET/e-Gestor paste dumps into rows+diagnosis), `datasus-normalizer.js` (classifies columns as categorical/temporal/quantitative/total and suggests which test fits), `datasus-wizard.js` (orchestrates a multi-step UI: paste → map columns → confirm → suggests tests), `CorrelationWizard.js` (a per-test wizard consumer). This is essentially a **working prototype of the "shared data paste/parse pipeline reused across tests"** requirement — don't rebuild it from scratch, port and generalize it.
- **Charts:** `chart-manager.js`, a Chart.js 4 factory (loaded via CDN `+esm` import) with a dark palette and an `initCanvasExportDelegate()` that wires PNG export buttons; SVG→PNG export (`utils.downloadSvgAsPng`) is also hand-rolled for non-Chart.js visuals.
- **Cross-module state:** a single ad hoc global, `window.__LACIR_SHARED__ = { datasus: { lastSession: null } }`, passed through `ctx.shared`. This is the only "state management" that exists today — it is the direct ancestor of the session context/store the rewrite needs.
- **Catalog data (research artifact, no UI yet):** `trabalhos datasus/build/catalogos/*.json` — one JSON per source (`tabnet`, `opendatasus`, `ibge`, `egestor`, `ans`, `atlas`, `ipea`, `covid`) plus a `catalog_index.json` map of source → file path. These are build outputs of Python/Node scrapers in `trabalhos datasus/scripts/` and `tools/` — not yet curated for direct UI consumption.
- **Leftover false start:** root `tailwind.config.js` / `postcss.config.js` reference a **purple** `brand` color and scan `./tests/**/*.js` — this predates the dark+green React decision and should be treated as scaffolding to discard, not a foundation to build on. `package.json` has no React/Vite-React/shadcn deps yet — this is a clean slate for the framework layer.

**Implication:** this is not a from-scratch rewrite of *logic* — it's a re-platforming of an already-correct stats/parsing engine onto a new UI framework, plus three genuinely new modules (Maps, Catalog, Meta-analysis) that have no existing code, only source data.

## Standard Architecture (target, v2.0)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         App Shell (React + Vite)                     │
│  Header (logo, DATASUS link) · Tabs: Testes | Mapas | Catálogo       │
│                              [ | Meta-análise ]                       │
├──────────────────────────────────────────────────────────────────────┤
│                          Feature Modules (tabs)                      │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────┐│
│ │  Tests         │ │  Maps          │ │  Catalog       │ │Meta-       ││
│ │  (t-test,      │ │  (Brasil→UF→   │ │  (DataSUS/     │ │analysis    ││
│ │  correlação,   │ │  município/    │ │  fontes        │ │(fixed/     ││
│ │  Prais-Winsten,│ │  mesorregião/  │ │  públicas,     │ │random,     ││
│ │  qui²,Poisson, │ │  região saúde) │ │  variáveis,    │ │forest,I²,  ││
│ │  BinNeg,Logit, │ │                │ │  links)        │ │funnel)     ││
│ │  ANOVA,KW)     │ │                │ │                │ │  LAST      ││
│ └───────┬────────┘ └───────┬────────┘ └───────┬────────┘ └─────┬──────┘│
├─────────┴──────────────────┴──────────────────┴────────────────┴──────┤
│                         Shared Services Layer                        │
│ ┌────────────┐ ┌───────────────┐ ┌─────────────┐ ┌─────────────────┐ │
│ │ Data paste/ │ │ Stats engine  │ │ Chart/export │ │ Region resolver │ │
│ │ parse       │ │ (pure fns,    │ │ (Chart.js +  │ │ (UF/nome/sigla/ │ │
│ │ pipeline    │ │ per-test      │ │ SVG→PNG,     │ │ IBGE code ↔     │ │
│ │ (paste→rows │ │ modules)      │ │ same export  │ │ região de saúde)│ │
│ │ →typed cols)│ │               │ │ contract for │ │                 │ │
│ │             │ │               │ │ maps too)    │ │                 │ │
│ └────────────┘ └───────────────┘ └─────────────┘ └─────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│                    Session State (in-memory only)                    │
│  React Context/store: active tab, last pasted dataset per test,      │
│  DataSUS wizard session, selected map region — cleared on refresh    │
├──────────────────────────────────────────────────────────────────────┤
│                     Static Data (bundled, no backend)                │
│  tests registry (TS) · GeoJSON/TopoJSON (UF + município) · região-   │
│  de-saúde crosswalk · curated catálogo DataSUS JSON                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| App Shell | Header/branding, tab navigation, theme tokens | React + Tailwind + shadcn `Tabs`; dark theme with green accent CSS variables |
| Test registry | Declarative list of tests (id, title, subtitle, category, component) | `src/features/tests/registry.ts` — typed array, statically imported (replaces runtime manifest fetch + dynamic `import()`) |
| Test feature module | One React component per test: data input → run stats → render results/chart/interpretation | Function component consuming shared `useTabularInput` + `stats/*` + `Chart` wrapper |
| Stats engine | Pure calculation functions, one file per test family | `src/shared/stats/*.ts`, framework-agnostic, unit-testable in isolation |
| Data paste/parse pipeline | Turn pasted/typed text into typed rows + column roles | `src/shared/data-input/` — hook (`useTabularInput`) + `<DataPasteArea>` component, ported from `tabular-data-input.js` + `datasus-importer.js`/`normalizer.js` |
| Chart/export layer | Render Chart.js or SVG visualizations with a uniform "download PNG/SVG" affordance | `src/shared/charts/` — thin wrapper components + `useChartExport()` hook, ported from `chart-manager.js` / `downloadSvgAsPng` |
| Maps module | Brazil choropleth with UF→município/mesorregião/região-de-saúde drill-down | `src/features/maps/` — `react-simple-maps` (SVG/topojson, no API key) driven by GeoJSON/TopoJSON assets + region resolver |
| Region resolver | Normalize free-text UF names/siglas/município names to canonical IBGE codes; crosswalk município → região de saúde | `src/shared/geo/resolver.ts`, pure functions + a static lookup table |
| Catalog module | Browse/search DataSUS & public-health data sources with descriptions and outbound links | `src/features/catalog/` — reads a single curated `catalog.json` built from `trabalhos datasus/build/catalogos/*` |
| Meta-analysis module | Fixed/random effects, forest plot, I², funnel + basic asymmetry — built **last**, reuses everything above | `src/features/meta-analysis/`, its own stats + a forest/funnel chart type added to the chart layer |
| Session store | Cross-tab ephemeral state (last dataset per test, DataSUS wizard result, selected map region) | React Context + `useReducer`, or a tiny `zustand` store (no persistence middleware) — replaces `window.__LACIR_SHARED__` |

## Recommended Project Structure

```
src/
├── app/
│   ├── App.tsx                 # Shell: header, tabs, theme provider
│   ├── routes.tsx              # Optional: react-router for shareable tab URLs (#/testes, #/mapas, ...)
│   └── theme.css                # Dark + green CSS variables (shadcn tokens)
├── features/
│   ├── tests/
│   │   ├── registry.ts          # Declarative list of all tests (id, title, group, Component)
│   │   ├── t-student/
│   │   ├── correlacao/
│   │   ├── prais-winsten/
│   │   ├── qui-quadrado/
│   │   ├── poisson/
│   │   ├── binomial-negativa/
│   │   ├── regressao-logistica/
│   │   ├── anova/
│   │   └── kruskal-wallis/
│   │       └── (each: index.tsx + didactic copy, no local math)
│   ├── maps/
│   │   ├── BrazilMap.tsx        # UF-level choropleth, click-to-drill-down
│   │   ├── StateMap.tsx         # município/mesorregião/região-de-saúde view
│   │   └── legend, tooltip, controls
│   ├── catalog/
│   │   ├── CatalogBrowser.tsx
│   │   └── filters (source, tema, granularidade)
│   └── meta-analysis/           # built LAST
│       ├── effects.ts           # fixed/random effects models
│       ├── ForestPlot.tsx
│       └── FunnelPlot.tsx
├── shared/
│   ├── stats/
│   │   ├── core.ts              # gammaln, betacf, ibeta, tcdf, tInv (ported verbatim)
│   │   ├── descriptive.ts       # mean, sd, variance, rank
│   │   ├── t-test.ts, correlation.ts, prais-winsten.ts
│   │   ├── chi-square.ts, poisson.ts, neg-binomial.ts, logistic.ts, anova.ts, kruskal-wallis.ts
│   │   └── meta-analysis.ts
│   ├── data-input/
│   │   ├── parseTabular.ts      # ported from tabular-data-input.js
│   │   ├── datasusImporter.ts   # ported from datasus-importer.js + normalizer.js
│   │   └── useTabularInput.ts   # hook: paste/upload → normalized rows + column roles
│   ├── charts/
│   │   ├── ChartCanvas.tsx      # Chart.js wrapper (scatter/line/bar), dark palette
│   │   ├── SvgChart.tsx         # for forest/funnel/custom SVG visuals
│   │   └── useChartExport.ts    # PNG/SVG download, ported from chart-manager.js
│   ├── geo/
│   │   ├── resolver.ts          # nome/sigla/código IBGE normalization
│   │   └── regiaoSaudeCrosswalk.ts
│   ├── format.ts                 # fmtNumber, fmtP, fmtSigned (ported verbatim)
│   └── session/
│       └── SessionProvider.tsx   # Context/zustand store, in-memory only
├── data/                          # bundled static assets, no backend
│   ├── geo/brasil-uf.topojson
│   ├── geo/municipios/{uf}.topojson   # loaded lazily per state on drill-down
│   ├── geo/regioes-saude-crosswalk.json
│   └── catalog/catalog.json           # curated, built from trabalhos datasus/build/catalogos/*
└── components/ui/                 # shadcn + cult-ui generated components
```

### Structure Rationale

- **`features/` vs `shared/`:** mirrors the existing repo's own instinct (`tests/{id}/` folders + shared `app.js` utils) — feature folders own UI/copy, `shared/` owns portable logic with zero React dependency, which keeps `stats/*` unit-testable and reusable by both Tests and Meta-analysis.
- **`shared/stats/core.ts` isolated from per-test files:** the numerical primitives (`gammaln`, `betacf`, `ibeta`, `tcdf`, `tInv`) are used by nearly every new test (chi-square, ANOVA, logistic, meta-analysis all need distribution CDFs) — keeping them in one file prevents six copy-pasted implementations.
- **`shared/data-input/` centralizes the paste pipeline once, not per-test:** today's codebase already has two competing implementations (`utils.parseDelimitedText` in `app.js` vs `tabular-data-input.js`); the rewrite should collapse to one hook (`useTabularInput`) parameterized by expected shape (wide two-column, long categorical, time series), used identically by every test form, the Maps module's "paste values by region" flow, and the DataSUS wizard.
- **`data/geo/` loads per-state, not all at once:** a full Brazil município-level GeoJSON is tens of MB; only fetch/import the state's municipality mesh when the user drills into that UF (dynamic `import()` or `fetch`, code-split by React `lazy`).
- **`data/catalog/catalog.json` is a build artifact, not the raw scraper output:** the `trabalhos datasus/build/catalogos/*.json` files are research/scraping intermediates (some are HTML probes, `.bin` files, etc.); a small one-time (or npm script-driven) transform step should curate them into one typed, UI-ready JSON — don't point the Catalog module at the raw research folder.

## Architectural Patterns

### Pattern 1: Declarative Test Registry (replaces runtime manifest + dynamic import)

**What:** `tests-manifest.json` + `fetch` + validated `import()` becomes a plain TypeScript array of `{ id, title, subtitle, group, Component }`, where `Component` is a statically-imported (or `React.lazy`-wrapped) React component. Vite's bundler needs a static import graph for code-splitting and tree-shaking; the old runtime-fetched-manifest pattern was a workaround for a framework-less environment and is no longer needed.
**When to use:** Any place that today does "load a module by string id" (test list, and later, the meta-analysis sub-test list if it's structured as its own mini-registry).
**Trade-offs:** Loses the "edit `tests-manifest.json`, no rebuild" flexibility of static hosting, but gains type safety, dead-code elimination, and per-test code splitting via `React.lazy(() => import('./features/tests/anova'))` — which is a *better* lazy-loading story than the old one, just declared differently.

**Example:**
```typescript
// src/features/tests/registry.ts
export const TEST_GROUPS = [
  {
    group: 'Comparação de médias',
    tests: [
      { id: 't-student', title: 't de Student', Component: lazy(() => import('./t-student')) },
      { id: 'anova', title: 'ANOVA', Component: lazy(() => import('./anova')) },
      { id: 'kruskal-wallis', title: 'Kruskal-Wallis', Component: lazy(() => import('./kruskal-wallis')) },
    ],
  },
  // ...
] satisfies TestGroup[];
```

### Pattern 2: Shared Paste-to-Typed-Rows Pipeline as a Hook

**What:** One hook, `useTabularInput(shape)`, owns paste/file-drop capture, delimiter sniffing, mojibake repair, header detection, and column-role assignment (numeric/categorical/temporal), returning `{ rawText, rows, columns, setRawText, errors }`. Every test's input form and the DataSUS wizard consume the same hook instead of hand-rolling parsing per test.
**When to use:** Any place accepting pasted/typed tabular data — this is every single test, plus "paste values by region" in Maps, plus the DataSUS wizard's raw TABNET dumps (which need the more aggressive `datasus-importer.js`-style diagnosis on top of the same base parser).
**Trade-offs:** Slightly more upfront abstraction than inlining `parseDelimitedText` per test (as v1.0 did), but eliminates the current duplication between `app.js`'s `parseDelimitedText` and the newer `tabular-data-input.js`, and gives every new test (6 of them) the parsing robustness for free instead of reimplementing it.

**Example:**
```typescript
const { rows, columns, errors } = useTabularInput({ expectedCols: 2, columnHint: 'wide' });
```

### Pattern 3: Uniform Chart/Export Contract Across Chart.js and Custom SVG

**What:** Every visualization component (scatter, bar, forest plot, funnel plot, choropleth map) exposes the same `onExportPng()` / `onExportSvg()` affordance through one hook, `useChartExport(ref)`, regardless of whether the underlying render target is a Chart.js `<canvas>` or a hand-built `<svg>` (react-simple-maps and forest/funnel plots are naturally SVG). This directly reuses the two working export code paths already in `chart-manager.js` and `utils.downloadSvgAsPng`.
**When to use:** Any downloadable chart requirement (explicit product requirement #8) — Tests, Maps, and Meta-analysis all need this identically.
**Trade-offs:** Requires a small adapter per render target (canvas vs svg), but avoids three different "download my chart" implementations; it also means the Maps module (SVG-based) gets PNG export "for free" from the same utility used by the forest/funnel plots, rather than needing its own screenshot solution (e.g., html2canvas).

## Data Flow

### Statistical test flow (Tests tab)

```
[Paste/type data] → useTabularInput() → typed rows + column roles
       ↓
[Choose test-specific options] (pareado/independente, α, etc.)
       ↓
[shared/stats/<test>.ts pure function] → result object (stat, df, p, CI, effect size)
       ↓
[Result cards: number formatting via shared/format.ts] + [Chart via shared/charts]
       ↓
[Downloadable PNG/SVG] (useChartExport)
```

### DataSUS wizard → Maps/Tests handoff flow

```
[Paste raw TABNET/e-Gestor export] → datasusImporter parse → normalizer diagnosis
       ↓
[Column mapping UI] → normalized dataset { categorical, temporal, quantitative, geo? }
       ↓
suggestTestsForSources() → ranked list of applicable tests/maps
       ↓
[Session store: lastDatasusSession] ← written here
       ↓
User clicks suggestion → navigates to Tests tab (prefilled via session store)
                        → or Maps tab (prefilled region+value pairs, if geo column detected)
```

### Maps drill-down flow

```
[Brazil UF-level TopoJSON, bundled] → BrazilMap renders choropleth
       ↓ (click UF)
[fetch/import município TopoJSON for that UF, lazy] → StateMap renders
       ↓ (toggle granularity)
[on-the-fly aggregation via topojson-client merge()] using regiaoSaudeCrosswalk.json
  → mesorregião / região de saúde boundaries derived from município geometries
       ↓
[Paste values by região] → useTabularInput() + resolver.ts (nome/sigla → código IBGE)
       ↓
[Color scale applied] → [PNG/SVG export via useChartExport]
```

### Session state (in-memory only)

```
SessionProvider (Context or zustand, no persistence)
    ↓ read/write
[Tests] ←→ [Maps] ←→ [Catalog] ←→ [Meta-analysis]
(e.g. "dataset pasted in Correlação" available to "Prais-Winsten" if same shape,
 "DataSUS wizard suggestion" available to whichever tab the user navigates to)
    ↓
Refresh clears everything — no localStorage/IndexedDB, matching the "cache do
navegador apenas durante a sessão" constraint (do not confuse with browser
Storage APIs, which persist — this app should use *only* React state/JS heap).
```

## Scaling Considerations

This app has no server and a small, cohort-sized user base (LACIR ligantes, one semester at a time) — "scaling" here means **dataset size and codebase growth**, not concurrent users.

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Current (≤9 tests, no maps/catalog) | Single bundle is fine; no code-splitting required yet |
| Target v2.0 (12+ tests, maps, catalog, meta-analysis) | Route-level/tab-level code splitting via `React.lazy` per feature module; lazy-load per-UF município GeoJSON instead of bundling all 27 states |
| Larger pasted datasets (thousands of rows) | Existing O(n) parsing/stats functions are fine; the only real risk is rendering thousands of map polygons or table rows — use `resolucao`/quality parameter on the IBGE malha source data (pre-simplified, not runtime simplification) and virtualize large result tables if ever needed |

### Scaling Priorities

1. **First bottleneck: initial bundle size once Maps + shadcn + cult-ui + Chart.js are all in one app.** Fix with per-tab lazy loading (`React.lazy(() => import('./features/maps'))`) so the Tests tab (most-used, loads first) doesn't pay for Leaflet/react-simple-maps/topojson code the user hasn't opened yet.
2. **Second bottleneck: município-level GeoJSON payload size.** Fix by using the IBGE Malhas API's pre-simplified TopoJSON (not the "original" malha) and fetching per-state on drill-down, never the full-Brazil município mesh at once.

## Anti-Patterns

### Anti-Pattern 1: Reintroducing runtime-fetched manifest + dynamic `import()` in a bundled React app

**What people do:** Port `tests-manifest.json` + `app.js`'s fetch-then-`import()` loader directly into React "because it already works."
**Why it's wrong:** Vite/Rollup can't tree-shake, type-check, or code-split modules it can't see statically; you also lose all the complexity that pattern existed to manage (content-type sniffing, cache-busting, stale-load cancellation) for zero benefit in a bundled app — that complexity was solving problems (browser module caching on static hosting) that a bundler already solves natively.
**Do this instead:** A static TypeScript registry array with `React.lazy()` per module (Pattern 1 above) gives equivalent or better lazy-loading with a fraction of the code.

### Anti-Pattern 2: Redux (or similar) for what is fundamentally per-tab local state

**What people do:** Reach for Redux/RTK because "it's a big app now" once Maps/Catalog/Meta-analysis are added.
**Why it's wrong:** Almost all state here is scoped to a single feature module (the pasted dataset for one test, the current map drill-down level) and dies on tab switch or refresh by design (explicit constraint: in-memory only, refresh clears). Global state is needed for exactly one thing: the small cross-tab handoff object (DataSUS wizard result → suggested test/map). Redux's ceremony (actions, reducers, middleware) buys nothing here.
**Do this instead:** Local component state (`useState`/`useReducer`) inside each feature module; a single lightweight `SessionProvider` (Context, or a ~20-line `zustand` store if selective re-rendering matters) for the one genuinely cross-cutting piece of state.

### Anti-Pattern 3: Treating "região de saúde" as just another IBGE malha resolution level

**What people do:** Assume the IBGE Malhas API's `intrarregiao` options (UF, mesorregião, microrregião, região intermediária, região imediata, município) include "região de saúde" directly, since it's a common SUS/DataSUS administrative unit.
**Why it's wrong:** IBGE's malha hierarchy is a **statistical/geographic** division; "região de saúde" is a **health-system administrative** division (defined via CIR — Comissões Intergestores Regionais, published by Ministério da Saúde, not IBGE) and does not correspond 1:1 to any IBGE `intrarregiao` value. Requesting it as if it were a malha resolution will silently fail or return the wrong boundaries.
**Do this instead:** Fetch município-level TopoJSON (IBGE has this), maintain a separate município→região-de-saúde crosswalk table (sourced from Ministério da Saúde/DataSUS reference tables), and derive região-de-saúde boundaries client-side by merging municipality geometries with `topojson-client`'s `merge()` function, grouped by the crosswalk.

### Anti-Pattern 4: Pointing the Catalog UI directly at `trabalhos datasus/build/*`

**What people do:** Import the scraper output folder directly into the app because "the data is already there."
**Why it's wrong:** That folder is a research/scraping workspace containing HTML probes, `.bin` files, and inconsistent per-source schemas (`tabnet_catalog.json` vs `ibge_catalog.json` etc. were built independently by different scripts) — shipping it as-is couples the app's build to a messy, non-typed, non-validated intermediate format.
**Do this instead:** Add one small build/curation step (Node script, run once or on-demand, not at app runtime) that reads `catalog_index.json` + each source file and emits a single typed `src/data/catalog/catalog.json` with a consistent schema (`{ source, title, description, granularity, url, tags }[]`) for the Catalog module to consume directly.

## Integration Points

### External Services (all fetched at data-prep/build time or lazily by the client — no backend proxy)

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| IBGE Malhas API (`servicodados.ibge.gov.br/api/v3/malhas/...`) | Pre-fetch TopoJSON per UF (and Brazil outline) once, commit as static assets in `src/data/geo/`; do not call live from the deployed app (avoids CORS/availability risk in a classroom setting) | Use pre-simplified malha (not "original"); `resolucao` param controls whether municípios/mesorregiões are embedded |
| DataSUS/TABNET, e-Gestor, Atlas Brasil, IPEA, ANS, openDATASUS | Catalog module only **links out** — per explicit Out-of-Scope constraint, no automated bulk download at runtime | Curated `catalog.json` (see Anti-Pattern 4) is the only build-time dependency |
| Chart.js 4 | npm dependency (already used, keep for continuity — existing dark palette and export logic ports directly) | Was loaded via CDN `+esm` in v1.0; install as a real npm dependency in the Vite app for offline/reliable builds |
| Map rendering library | `react-simple-maps` (SVG + d3-geo/topojson, no API key, no tile server) — better fit than Leaflet-based `shadcn-map` registry component, which targets marker/tile-layer maps, not statistical choropleths | MEDIUM confidence: verified via `react-simple-maps` docs/GitHub and a `shadcn-map` (Leaflet-based) comparison; choose react-simple-maps specifically because its SVG output reuses the same `downloadSvgAsPng` export utility already proven in this codebase |
| shadcn/ui + cult-ui component registries | CLI-installed components (`npx shadcn add ...`) checked into `src/components/ui/` | Per PROJECT.md decision; use shadcn's own registry-based map component only if a future need for pin/marker-style maps arises — not for the choropleth requirement |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Tests ↔ shared/stats | Direct function calls, no events | Pure functions, no React dependency — same contract as today's `Stats` object |
| Tests/Maps/Catalog ↔ shared/data-input | Hook consumption (`useTabularInput`) | No shared mutable state between tabs unless explicitly handed off via SessionProvider |
| DataSUS wizard ↔ SessionProvider ↔ Tests/Maps | Write-once-read-elsewhere handoff object | Mirrors today's `window.__LACIR_SHARED__.datasus.lastSession`, now typed and scoped to React Context |
| Maps ↔ shared/geo/resolver | Direct function calls (name/sigla → code) | Also consumed by the DataSUS wizard when a pasted dataset has a geographic column |
| Any chart-producing feature ↔ shared/charts | `useChartExport(ref)` hook | Uniform PNG/SVG download button/behavior across Tests, Maps, and Meta-analysis |

## Recommended Build Order (elaborating the milestone's required sequence)

The milestone fixes the macro order: **Redesign/base → migrar testes atuais → novos testes → mapas → painel DataSUS → meta-análise**. Below is why that order is also the dependency-correct order, plus what belongs in each step:

1. **Base (scaffolding + shared services):** Vite + React + TS, Tailwind + shadcn/cult-ui init, dark/green theme tokens, App shell with tab navigation (no router needed initially — tab state is enough; add `react-router` only if shareable URLs per tab become a requirement). Port `shared/stats/core.ts`, `shared/format.ts`, and the data-input pipeline (`useTabularInput`) **before** any test is migrated — every subsequent step depends on these.
2. **Migrate existing 3 tests** (t-Student, correlação, Prais-Winsten) onto the new shared pipeline. This is deliberately first among features because it validates the Test Registry pattern and the shared stats/data-input contracts against known-correct behavior (existing tests have known expected outputs) before scaling to new, unverified statistics.
3. **New tests** (qui-quadrado, Poisson, Binomial Negativa, Regressão Logística, ANOVA, Kruskal-Wallis): pure additions to `shared/stats/` + `features/tests/`, no architectural risk once step 2 proves the pattern — this is the highest-volume implementation work (6 new statistical procedures, each needing JASP-oracle verification per the project's stated approach).
4. **Maps:** independent of the stats engine; can start once the shared data-input/resolver/chart-export utilities exist (from step 1) and doesn't block on steps 2–3. Build UF-level choropleth first, then intra-state drill-down (município → mesorregião → região de saúde, in that order, since município is the only level with directly available geometry and the others are derived/aggregated per Anti-Pattern 3).
5. **Painel DataSUS (catalog):** depends on the curated `catalog.json` build step (Anti-Pattern 4) and benefits from Maps existing (catalog entries can deep-link "ver no mapa" once région/UF are resolvable) — this is why it's sequenced after Maps.
6. **Meta-análise (last):** explicitly deferred because it's the least didactically urgent, needs its own stats (fixed/random effects, I², funnel asymmetry) and its own chart types (forest/funnel plots), but reuses every shared service built in steps 1–5 (data-input for effect-size tables, chart-export for forest/funnel PNG/SVG, and possibly the Catalog module for study/data provenance links). Building it last means the shared chart/export/data-input contracts are already battle-tested across 12 tests and a map module before being stretched to a new plot type.

## Sources

- Direct repository read: `index.html`, `assets/js/app.js`, `assets/js/tabular-data-input.js`, `assets/js/chart-manager.js`, `assets/js/datasus-wizard.js`, `tests/t-student/config.json`, `tests-manifest.json`, `.planning/PROJECT.md`, `trabalhos datasus/build/catalogos/*` (HIGH confidence — primary source).
- [react-simple-maps docs](https://www.react-simple-maps.io/docs/getting-started/) and [GitHub repo](https://github.com/zcreativelabs/react-simple-maps/) — SVG/topojson choropleth pattern, no API key (MEDIUM confidence, official docs).
- [shadcn map (Leaflet-based)](https://shadcn-map.vercel.app/docs) — evaluated and deprioritized for choropleth use case (MEDIUM confidence, official docs).
- [IBGE API de malhas geográficas (v4 docs)](https://servicodados.ibge.gov.br/api/docs/malhas?versao=4) — malha hierarchy (UF, mesorregião, microrregião, região intermediária/imediata, município), simplified vs. original malha, TopoJSON/GeoJSON/SVG formats (HIGH confidence, official government API docs).
- General knowledge: "região de saúde" as a Ministério da Saúde/CIR administrative construct distinct from IBGE malha levels (MEDIUM confidence — consistent with IBGE's documented `intrarregiao` value set, which does not list it, but not independently re-verified against a Ministério da Saúde source in this research pass; flagged as an open item below).

## Gaps to Address (for phase-specific research later)

- **Região de saúde crosswalk source:** confirm the authoritative, freely downloadable município→região-de-saúde table (likely Ministério da Saúde/CNES or a SAGE/e-Gestor export) before the Maps drill-down phase — this research pass identified the *architectural* need (client-side aggregation via crosswalk, not a direct IBGE malha level) but did not locate/validate the specific dataset.
- **Meta-analysis stats correctness:** forest/funnel plot math and I²/asymmetry formulas should be verified against the JASP reference (per project decision) during that phase's planning, not assumed from this architecture pass.
- **Catalog curation script:** the exact transform from `trabalhos datasus/build/catalogos/*.json` to a single `catalog.json` schema needs its own short design pass during the Catalog phase, since each source file was scraped independently and likely has inconsistent field names.

---
*Architecture research for: Bioestatística LACIR v2.0 (React rewrite + Maps + DataSUS catalog + Meta-analysis)*
*Researched: 2026-07-25*
