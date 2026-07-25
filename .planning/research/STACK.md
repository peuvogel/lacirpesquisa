# Stack Research

**Domain:** Client-side bioestatística/epidemiology teaching tool — React rewrite adding GLM-family hypothesis tests, meta-analysis, and Brazil choropleth maps, 100% browser (no backend)
**Researched:** 2026-07-25
**Confidence:** MEDIUM-HIGH (core framework/UI = HIGH, GLM/meta-analysis libraries = MEDIUM/LOW — see per-item notes)

> Scope note: this file covers only the **additions/changes** needed for v2.0 (React rewrite, new stats tests, maps, DataSUS catalog, dark theme). It does not re-research the validated v1.0 stack (Chart.js survives as the charting engine; t-Student/Pearson/Spearman/Prais-Winsten math is already implemented and is out of scope here).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | ^19.2.8 | UI runtime (replaces vanilla-JS module system) | Current stable line (patched weekly by the React team); required by shadcn/ui's React primitives and by cult-ui's Framer-Motion components. No app-router/RSC needed here — plain client SPA. |
| Vite | ^8.1.5 | Dev server + bundler (already in use) | Already the project's build tool (`vite@^5` today); upgrading keeps HMR speed and gives first-class Tailwind v4 plugin support. No reason to switch to Next.js — this milestone is explicitly client-only/static, and a router-based meta-framework would add SSR concerns the project doesn't need. |
| Tailwind CSS | ^4.3.x | Utility CSS + design tokens (dark theme, green accents) | v4's CSS-first config (`@import "tailwindcss"` + `@theme`) replaces `tailwind.config.js` and is required by current shadcn/ui + cult-ui installers. First-party `@tailwindcss/vite` plugin removes PostCSS boilerplate. |
| shadcn/ui | CLI `shadcn@latest` (init `-t vite`) | Accessible, unstyled-by-default component primitives (Radix-based) copied into the repo | Not an npm dependency — a code generator. Fits "own your components" philosophy, pairs natively with Tailwind v4 tokens, and is the platform the `@cult-ui` registry itself targets. This is also the same CLI referenced by PROJECT.md ("shadcn MCP + registry cult-ui"). |
| cult-ui (`@cult-ui` registry) | Registry-based, versioned per-component | Animated/composable UI accents (backgrounds, texture cards, hero effects) for the redesign | Curated, MIT-licensed, officially listed in the shadcn directory (accepted registry, Oct 2025). Installed per-component via `npx shadcn@latest add @cult-ui/<name>` after registering the registry URL in `components.json` — no separate package manager needed. |
| Chart.js | ^4.5.x (already a dependency) | Base charting engine, extended for forest/funnel plots | Already validated in v1.0 for Pearson/Spearman/t-Student charts. Reusing it (rather than introducing D3/Recharts as a second charting stack) minimizes new surface area and lets forest/funnel plots share theming with existing charts. |

### Supporting Libraries — New Statistical Tests

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jstat` | ^1.9.6 | Probability distributions (normal, chi-square, F, t, Poisson) for p-values, CIs, and quantiles | Foundational dependency for **every** new test (chi-square, ANOVA, Kruskal-Wallis, GLM Wald/LR tests, meta-analysis CIs). Last published 2022 but the math doesn't go stale — distribution functions are pure, well-tested, and this is the most complete pure-JS distribution library available. |
| `@stdlib/stats-chi2test` | latest (0.x) | Chi-square test of independence on contingency tables (with Yates' correction) | Qui-quadrado feature. Well-scoped, actively maintained as part of the large `stdlib` monorepo; avoids hand-rolling contingency-table math. |
| `@stdlib/stats-anova1` | latest (0.x) | One-way ANOVA (F-test, sum of squares, p-value) | ANOVA feature. |
| `@stdlib/stats-kruskal-test` | latest (0.x) | Kruskal-Wallis rank-sum test (nonparametric one-way ANOVA) | Kruskal-Wallis feature — the nonparametric companion the capacitação also teaches. |
| `ml-matrix` | ^6.13.0 | Matrix ops (QR/Cholesky/SVD, solve, inverse) — linear-algebra backbone | **Required custom-build block** for Poisson regression, Logistic regression, and Negative Binomial regression (see note below — no turnkey JS package covers all three). Actively maintained by Zakodium/mljs, zero heavy transitive deps, browser-first. |
| Custom IRLS GLM module (in-repo, ~150–250 LOC) | n/a | Poisson regression, Logistic (binomial) regression, Negative Binomial regression via Iteratively Reweighted Least Squares | See "GLM implementation note" below. Built on `ml-matrix` for the linear algebra and `jstat` for Wald/LR p-values. Validate outputs against JASP/R (`glm`, `MASS::glm.nb`) as the project's own oracle strategy already prescribes. |

**GLM implementation note (important, MEDIUM/LOW confidence on 3rd-party options):** There is **no mature, actively-maintained npm package that does Poisson + Logistic + Negative Binomial regression together with a stable API**. Candidates evaluated:
- `@tangent.to/ds` — has a unified `GLM` class covering `gaussian`/`binomial`/`poisson` families with a clean `.fit()/.predict()/.summary()` API and is browser-ESM by design (built on `ml-matrix` + `simple-statistics` itself). It does **not** advertise a negative-binomial family. Young package (first seen 2025), small community — treat as **LOW confidence**; worth a hands-on spike for logistic/Poisson only, with a fallback to the custom IRLS module if its output doesn't match the JASP oracle exactly.
- `@stdlib/stats-base-dists-negative-binomial` — only distribution functions (pmf/cdf/quantile), **not** a regression fitter. Still useful inside a custom NB-regression implementation (μ/θ parameterization, dispersion estimation).
- No viable package found for Negative Binomial regression specifically (this mirrors real-world scarcity — even in R, NB regression needs the specialized `MASS::glm.nb`, not the base `glm()`).

**Recommendation:** build one small, well-tested internal `glm.js` module (IRLS for Poisson/binomial families using canonical links; alternating IRLS + moment/ML dispersion estimation for Negative Binomial, à la `MASS::glm.nb`) on top of `ml-matrix`. This gives full control over the "interpretação breve" output the project's UX requires, keeps behavior consistent across all three regressions, and avoids a dependency on an unproven package for core coursework math. Budget real implementation + validation time for this — it is the highest-risk item in the whole stack.

### Supporting Libraries — Meta-Analysis

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Custom meta-analysis module (in-repo, ~150 LOC) | n/a | Fixed-effect (inverse-variance) + random-effects (DerSimonian-Laird) pooling, Cochran's Q, I², Egger's regression test for funnel asymmetry | **Recommended over any npm package** — see rationale below. Formulas are standard, well-documented (Cochrane Handbook / `metafor` source), and short enough to implement and unit-test directly against known R/`metafor` outputs (the project already plans to use JASP as a numerical oracle; `metafor` docs work the same way). |
| `jstat` | ^1.9.6 (already listed above) | Normal quantiles (`jStat.normal(0,1).inv(...)`) for CIs, and Q/chi-square p-value for heterogeneity test | Reused from the stats section — no new dependency. |
| `simple-statistics` | ^7.8.x | Simple linear regression (`ss.linearRegression`) for Egger's asymmetry test, plus general descriptive stats | Egger's test is literally a weighted OLS regression of standardized effect on precision — `simple-statistics` (0 dependencies, tiny, MIT) covers this without pulling in a heavier stats engine. |
| `chartjs-chart-error-bars` | ^4.4.x | Forest-plot rendering: horizontal scatter + per-study confidence-interval bars, sized by weight | Built by the same maintainer as `chartjs-chart-geo` (sgratzl) — same quality bar, same Chart.js 4 major version. Renders each study as a point + CI line; the pooled-effect diamond can be drawn as a second dataset or a small canvas plugin. Keeps forest plots inside the existing Chart.js investment instead of introducing raw D3 for one feature. |

**Why not an npm meta-analysis package:** `shukra` (network meta-analysis toolkit) is **GPL-2.0-licensed** — a copyleft license inappropriate to bundle into a client-side app whose own license/distribution model isn't GPL; it's also Node-oriented (designed for `<10ms` server requests, not audited for browser bundling). Other hits (`metaforge`, `prognostic-meta`, `moneuron/meta`) are **Python** projects or single-purpose research scripts distributed as GitHub ZIPs, not maintained npm packages — unacceptable supply-chain risk for a teaching tool that needs to keep working for years. A from-scratch module avoids all three problems and matches the "meta-análise didática, escopo reduzido" decision already logged in PROJECT.md.

**Funnel plot:** do **not** use `d3-funnel` or `funnel-graph-js` — despite the name, these render marketing/conversion funnels (top-to-bottom shrinking bars), not the statistical funnel plot (effect size vs. standard error scatter) needed here. Render the real funnel plot as a Chart.js `scatter` dataset (effect size on x, SE on inverted y) plus a small custom plugin/dataset for the pseudo-confidence-interval triangle — no dedicated library exists or is needed for this.

### Supporting Libraries — Brazil Maps

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chartjs-chart-geo` | ^4.3.x | Choropleth rendering (`choropleth` chart type) with legends and d3-geo projections, built on Chart.js | **Primary recommendation.** Reuses the existing Chart.js dependency instead of adding a parallel SVG-mapping stack; same author/quality tier as `chartjs-chart-error-bars`. Handles UF-level and municipality-level choropleths identically (just more/smaller features) and ships a `ColorScale`/`ProjectionScale` for the heatmap legend the milestone asks for. Interactivity (click a UF → drill into its municípios) is doable via Chart.js's native `onClick`/`getElementsAtEventForMode`. |
| `topojson-client` | ^3.1.0 | Decode TopoJSON → GeoJSON features in the browser | Peer dependency of `chartjs-chart-geo`'s bundled `ChartGeo.topojson` helper; also usable standalone if a raw d3-geo path is later needed. |
| `d3-geo` | ^3.1.0 | Geographic projections (used internally by `chartjs-chart-geo`'s `projection` scale) | Transitive — don't hand-roll projections. |
| `fuse.js` | ^7.5.0 | Fuzzy/typo-tolerant search for state and município name/sigla recognition | Directly serves the "reconhecimento de nomes/siglas" requirement — e.g. matching pasted DataSUS exports where município names have accent/case/typo variance ("Sao Paulo" vs "São Paulo"). Zero-dependency, ~8.6 kB gzip, works purely client-side against a bundled lookup table. |
| `mapshaper` (CLI, dev-only) | ^0.7.x | Build-time simplification of IBGE municipal/mesoregion meshes into small static TopoJSON bundled with the app | **Dev dependency only — never shipped to the browser bundle.** See geodata sourcing strategy below. |

**Geodata sourcing strategy (client-only, offline-classroom-safe):**
1. **Source of truth:** IBGE's official Malhas API (`https://servicodados.ibge.gov.br/api/v4/malhas/...` or `v3`) — free, CORS-enabled, no auth, returns GeoJSON or TopoJSON at any `intrarregiao` level (`UF`, `mesorregiao`, `microrregiao`, `municipio`) with a `qualidade` (simplification) parameter.
2. **Do not fetch this API at runtime from the deployed app.** Practical sessions may run on flaky venue wifi, and the milestone's whole premise is client-cache-only/offline-friendly. Instead, fetch once at **build/dev time**, then run `mapshaper -simplify` to shrink the mesh (a national municipal-level GeoJSON can be tens of MB raw — Cochrane-grade simplification easily gets a usable web map under 1–2 MB) and commit the resulting static TopoJSON files under `src/assets/geo/`.
3. **Regiões de saúde** are a SUS-specific aggregation not present in IBGE's Malhas API. Two options, in order of preference:
   - Fetch the municipal mesh + the DTB (Divisão Territorial Brasileira) município→região-de-saúde mapping table (IBGE/DATASUS-sourced, republished e.g. by `lansaviniec/shapefile_das_regionais_de_saude_sus` as `DTB.csv`) and **dissolve municípios by região id at build time** with `mapshaper -dissolve`. This sidesteps any uncertainty about a third-party shapefile's redistribution license, since you're deriving the polygons yourself from IBGE's own municipal mesh plus a public lookup table.
   - Alternatively, Fiocruz/Cidacs publishes an official-sourced "Macrorregiões e Regiões de Saúde do Brasil" shapefile dataset (DOI 10.57833/cidacs/b9jhvc, Ministério da Saúde data, updated 2025) — check its license terms before bundling; treat as **LOW confidence** until verified.
4. Ship 4 static TopoJSON files (UF, mesorregião, município, região-de-saúde), each pre-simplified — this is what actually satisfies "100% browser, no backend" without depending on an external API's uptime during a lesson.

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@tailwindcss/vite` | First-party Tailwind v4 Vite plugin | Replaces PostCSS config entirely; add to `vite.config.ts` plugins array alongside `@vitejs/plugin-react`. |
| `shadcn` CLI (`npx shadcn@latest`) | Scaffolds `components.json`, copies Radix-based components into `src/components/ui` | Not a runtime dependency. Configure `registries: { "@cult-ui": "https://cult-ui.com/r/{name}.json" }` in `components.json` once, then `npx shadcn@latest add @cult-ui/<component>` per component. |
| `@types/node` (dev) | Needed for `path` resolution in `vite.config.ts` (`@/*` alias) | Only relevant if the project adopts TypeScript; skip if staying with JS + `jsconfig.json`. |

## Installation

```bash
# Core framework
npm install react@^19 react-dom@^19
npm install -D vite@^8 @vitejs/plugin-react tailwindcss @tailwindcss/vite

# shadcn/ui + cult-ui (after `npx shadcn@latest init -t vite`)
npx shadcn@latest add button card tabs dialog
npx shadcn@latest add @cult-ui/texture-card @cult-ui/texture-button   # example accents

# Existing charting engine (kept)
npm install chart.js

# New statistical tests
npm install jstat simple-statistics ml-matrix
npm install @stdlib/stats-chi2test @stdlib/stats-anova1 @stdlib/stats-kruskal-test
npm install @stdlib/stats-base-dists-negative-binomial   # NB distribution fns for custom glm.js

# Forest/funnel plotting (extends existing Chart.js)
npm install chartjs-chart-error-bars

# Maps
npm install chartjs-chart-geo topojson-client d3-geo fuse.js

# Build-time-only geodata tooling (NOT a runtime dependency)
npm install -D mapshaper
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Custom IRLS `glm.js` (ml-matrix + jstat) | `@tangent.to/ds` `GLM` class | If a quick spike shows its `binomial`/`poisson` output matches the JASP oracle exactly and you're comfortable depending on a <1-year-old, small-community package for two of the three regressions (still need custom code for Negative Binomial either way). |
| `chartjs-chart-geo` (canvas, Chart.js-native) | `react-simple-maps` (SVG, d3-geo) | If deep pan/zoom, per-feature React event handlers, or SVG-level CSS styling become more important than reusing Chart.js — but the maintained upstream (`zcreativelabs/react-simple-maps`) still has no React 19 peer-dep support (open issue as of mid-2026); you'd need the community fork `@vnedyalk0v/react19-simple-maps` (single maintainer, <50 GitHub stars) or force-install with `--legacy-peer-deps`. |
| Custom meta-analysis module | `shukra` | Never, for this project — GPL-2.0 license is incompatible with bundling into a client-distributed teaching app regardless of technical fit. |
| Pre-bundled static TopoJSON (build-time `mapshaper`) | Runtime fetch from IBGE Malhas API | If the deployment target is guaranteed reliable internet (e.g., always-online hosted version for remote/async study) and smaller initial bundle size matters more than offline/flaky-wifi robustness during in-person capacitação sessions. |
| Tailwind v4 (`@import "tailwindcss"`, CSS-first config) | Tailwind v3 (`tailwind.config.js`) | If the deployed environment must support browsers older than Safari 16.4/Chrome 111/Firefox 128 (v4 requires modern CSS `@property`/`color-mix()`) — unlikely for a university lab/classroom setting, but worth confirming lab PC browser versions. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Embedding R, JASP, WebR, or Pyodide/SciPy-in-browser | PROJECT.md explicitly scopes JASP as a **behavioral oracle only** ("não portar a UI QML/R do JASP"); WASM R/Python runtimes are 10s of MB downloads, slow to cold-start, and massive overkill for the didactic-scale datasets this tool targets | Pure-JS implementations (`jstat`, `@stdlib/*`, custom IRLS) validated numerically against JASP/R outputs during development, with no runtime R/Python dependency |
| `shukra` for meta-analysis | GPL-2.0 license (copyleft) | Custom meta-analysis module (formulas are standard and short) |
| `d3-funnel` / `funnel-graph-js` for the funnel plot | These are marketing/conversion funnel charts, not statistical funnel plots — completely different visualization despite the name collision | Chart.js `scatter` dataset (effect size × SE) + custom plugin |
| A generic Node.js backend, database, or auth library (Express, Prisma, NextAuth, etc.) | Out of scope per PROJECT.md ("Backend / API server / banco de dados — deferred"; "Login, contas de usuário... — próximo ciclo") | Keep all state in React component state / `sessionStorage`-free memory only, per the "browser-cache-only, refresh loses data" constraint |
| Full JASP-equivalent Bayesian module, or a general-purpose stats suite (e.g., porting `jamovi`/`pingouin`-style breadth) | Explicitly out of scope ("Suite bayesiana completa ou módulos JASP avançados além do escopo de meta-análise definido") | Implement only the named tests: chi-square, Poisson/NB/Logistic regression, ANOVA, Kruskal-Wallis, and the scoped meta-analysis (fixed/random, forest, I², funnel, basic asymmetry) |
| Runtime-fetching the full-resolution IBGE municipal mesh (`qualidade=4`, no simplification) directly in the deployed app | Tens of MB GeoJSON payload, slow parse, plus a hard runtime dependency on an external government API's uptime during a live class | Pre-simplify with `mapshaper` at build time and bundle static TopoJSON assets (see geodata strategy above) |
| Mixing multiple charting/mapping ecosystems (e.g., Chart.js *and* Recharts *and* raw D3 *and* react-simple-maps all at once) | Each adds its own theming system, bundle weight, and mental model — bad fit for a small teaching-tool codebase maintained by rotating ligantes | Standardize on the Chart.js family (`chart.js`, `chartjs-chart-error-bars`, `chartjs-chart-geo`) for all charts and maps |

## Stack Patterns by Variant

**If the `@tangent.to/ds` GLM spike succeeds for Poisson/Logistic:**
- Use it only for those two families; still hand-write Negative Binomial regression (no package covers it).
- Keep `ml-matrix` and `jstat` as dependencies regardless — they're needed for ANOVA/meta-analysis linear algebra and distribution math either way, so there's no dependency-count savings from adopting `@tangent.to/ds`, only an implementation-time savings.

**If browser support must extend to older devices (pre-Safari 16.4/Chrome 111):**
- Pin Tailwind to `^3.4` (last v3 line) instead of v4, and use the classic PostCSS + `tailwind.config.js` setup. shadcn/ui's `init` CLI still supports v3 projects via its legacy installation path.

**If the deployed environment has reliable, always-on internet (e.g., a hosted version outside the classroom):**
- Fetch IBGE Malha API responses at runtime with a simple in-memory cache instead of bundling static TopoJSON, trading a larger first-load network request for smaller bundle size and always-current municipal boundaries (relevant since municipalities occasionally merge/split).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react@^19` | `react-dom@^19` (must match major) | shadcn/ui and cult-ui components assume matching react/react-dom majors. |
| `react-simple-maps@3.x` | React ^16.8–18.x **only** | Confirmed incompatible peer-dep range with React 19 as of mid-2026 (open upstream issue); this is why `chartjs-chart-geo` is the primary map recommendation instead. |
| `tailwindcss@^4` | `@tailwindcss/vite@^4` (matching major) | v4's Vite plugin and PostCSS plugin are separate packages (`@tailwindcss/vite` vs `@tailwindcss/postcss`) — for a Vite project, use the Vite plugin, not both. |
| `chartjs-chart-geo@^4` / `chartjs-chart-error-bars@^4` | `chart.js@^4` | Both plugins target Chart.js 4.x controllers/scales API; do not mix with a Chart.js 3.x install. |
| `@tangent.to/ds` | `ml-matrix@^6.12+`, `simple-statistics@^7.8+` | If adopted, it already vendors these as dependencies — check for duplicate/conflicting versions if you also install `ml-matrix` directly for the custom `glm.js` module. |
| `mapshaper` (dev-only) | Node.js (any current LTS) | MPL-2.0 licensed; runs only in the build pipeline, never bundled into client JS, so its license has no bearing on the shipped app's license. |

## Sources

- `ui.shadcn.com/docs/installation/vite` — Vite + Tailwind v4 + shadcn/ui setup steps (HIGH confidence, official docs)
- `cult-ui.com/docs/installation` + GitHub issue `shadcn-ui/ui#8590` — `@cult-ui` registry acceptance and `components.json` registry config (HIGH confidence, official docs + first-party GitHub issue)
- `npmjs.com/package/jstat`, `github.com/jstat/jstat` — distribution function coverage (MEDIUM confidence — package unmaintained since 2022 but math is stable/verifiable)
- `npmjs.com/package/@stdlib/stats-chi2test`, `-anova1`, `-kruskal-test`, `-base-dists-negative-binomial` — stdlib modular stats packages (HIGH confidence, official npm/GitHub docs with worked examples)
- `npmjs.com/package/ml-matrix` (registry.npmjs.org, v6.13.0 published Jun 2026) — linear algebra library (HIGH confidence)
- `npmjs.com/package/@tangent.to/ds`, `github.com/tangent-to/ds` — candidate GLM library (LOW confidence — young/small-community package, claims not independently verified)
- `github.com/holub008/shukra` — license (GPL-2.0) and Node-targeted design confirmed directly from repo README (HIGH confidence for the license finding)
- `github.com/mahmood726-cyber/metaforge`, `prognostic-meta`, `github.com/mo-shakiba/meta` — surveyed and rejected as non-npm/Python/single-purpose research code (MEDIUM confidence, GitHub README review)
- `npmjs.com/package/chartjs-chart-error-bars`, `chartjs-chart-geo`, `sgratzl.com` docs — Chart.js ecosystem plugins for forest plots and choropleth maps (HIGH confidence, official docs + working code samples)
- `github.com/zcreativelabs/react-simple-maps/issues/388`, `npmjs.com/package/@vnedyalk0v/react19-simple-maps` — React 19 incompatibility of the mainstream map library and the community fork's characteristics (HIGH confidence for the incompatibility, MEDIUM for fork adoption risk assessment)
- `servicodados.ibge.gov.br/api/docs/malhas?versao=4`, `brazilvisible.org` IBGE Geociências writeup — official Malhas API parameters (formato/resolucao/intrarregiao/qualidade) (HIGH confidence, official API docs)
- `github.com/lansaviniec/shapefile_das_regionais_de_saude_sus`, Fiocruz/Cidacs DOI `10.57833/cidacs/b9jhvc` — regiões de saúde geodata sourcing options (MEDIUM confidence — community/institutional sources, license terms not independently re-verified in this pass)
- `github.com/mbloch/mapshaper` (npm registry, v0.7.46) — build-time simplification tool, MPL-2.0 (HIGH confidence)
- `npmjs.com/package/fuse.js`, `fusejs.io` (v7.5.0) — fuzzy search for name/sigla recognition (HIGH confidence, official docs)
- `npmjs.com/package/vite` (8.1.5), `npmjs.com/package/react` (19.2.8), `npmjs.com/package/tailwindcss` (4.3.3) — current version pins as of research date (HIGH confidence, npm registry direct)

---
*Stack research for: Bioestatística LACIR v2.0 (React rewrite + stats suite + Brazil maps + DataSUS catalog + meta-analysis)*
*Researched: 2026-07-25*
