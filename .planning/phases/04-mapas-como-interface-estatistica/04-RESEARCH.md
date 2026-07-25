# Phase 4: Mapas como interface estatística - Research

**Researched:** 2026-07-25
**Domain:** Offline Brazilian choropleth maps, group-based territorial analysis UX, session handoff to Estatística
**Confidence:** HIGH (geo sources, bundle strategy, existing codebase patterns), MEDIUM (health macro-region asset sizing, suggestion heuristics extension)

## Summary

Phase 4 evolves the Phase 1 Mapas mock into a didactic single-screen statistical workspace. The codebase already ships a proven **inline SVG UF map** (`BrazilMockMap.tsx` + `brazilUfPaths.ts`, ~50 KB committed paths) with hover/click multi-select, variable intersection logic, and a stub handoff modal. The research confirms that **extending the SVG + d3-geo pattern** — not adopting MapLibre or react-simple-maps — is the right economy/didactic choice for this React 19 + Vite client-only app.

IBGE's official Malhas API v3 provides simplified GeoJSON/TopoJSON/SVG for all required administrative levels. Verified download sizes (2026-07-25): Brazil-by-UF GeoJSON **96 KB**; São Paulo municipalities TopoJSON **133 KB** (vs GeoJSON **302 KB**); all-27-UF municipality TopoJSON total **~1.3 MB** (avg **~50 KB/UF**). This validates D-19's lazy-load strategy: bundle UF layer in the initial chunk; **dynamic-import per-UF TopoJSON** on drill-down; never ship all municipalities upfront.

Health **macrorregiões de saúde** are **not** IBGE administrative units — they come from Ministério da Saúde regionalization (120 macrorregiões, 439 regiões). Official shapefiles exist via [Portal Dados Abertos SUS](https://dadosabertos.saude.gov.br/dataset/macrorregiao-de-saude) and Cidacs/Fiocruz DOI datasets. A community simplified GeoJSON is ~3 MB raw — planner must include a **build-time simplification step** (mapshaper/topojson) targeting **≤400 KB** bundled asset.

For group DnD, **`@dnd-kit/core`** is recommended over raw HTML5 DnD: keyboard sensor + screen-reader announcements align with capacitação accessibility and D-04/D-05 discoverability requirements. Session model extends from flat `{ ufs, variables }` to structured **groups × time × variables × provenance**, with handoff publishing `setDataset` + `activeTestId` + `recognizedColumns` (existing EstatisticaPage pattern).

**Primary recommendation:** Keep inline SVG at UF level; add `d3-geo` + `d3-scale` + `topojson-client` for drill-down projection and choropleth fills; lazy-load per-UF TopoJSON via Vite dynamic imports; use `@dnd-kit/core` for group drag-and-drop; extend session with typed `MapAnalysisState`; reuse `normalizeHeaderToken` for territory matching against offline IBGE name tables.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Fluxo didático — tela única fluida (MAP-10)
- **D-01:** **Single-screen Mapas workspace** (not a rigid multi-step stepper). Exploration stays fluid for lay capacitação audiences.
- **D-02:** Persistent **selection summary** always visible (território × grupos × tempo × agravos/variáveis) in plain PT.
- **D-03:** Progressive disclosure: map first → form groups → per-group panel (time → diseases/variables) → “Revisar e analisar” before leaving Mapas.

#### Criação de grupos (MAP-07 / interação)
- **D-04:** Multi-select UFs (and later other geographies) with **glowing/highlighted borders** when selected and when they can join a group.
- **D-05:** Create a group by **dragging** selected units into a top drop zone (“Grupo 1” / “Criar grupo”) **and** by an explicit primary action (button). Optional context-menu “Criar grupo” as secondary shortcut — not the only path (browser UX / discoverability).
- **D-06:** Groups are **renamable**. Multiple groups allowed; each group keeps its own time + variable configuration.
- **D-07:** Regional **presets** (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) one-click create/fill a group; **macrorregiões de saúde** are first-class selectable geographies for grouping (MAP-08), not only UF presets.
- **D-08:** Map click selection and group membership stay in sync (selecting a preset/group highlights members on the map).

#### Painel por grupo — tempo e variáveis (MAP-06 / MAP-09)
- **D-09:** Opening/creating a group opens a **panel** (side or overlay) scoped to that group.
- **D-10:** **Temporalidade:** user chooses **fixed time point** *or* **period range** (start–end). Comparison of two periods is supported as a didactic mode within the same panel (e.g. período A vs B) when data allows — not a separate product area.
- **D-11:** After time is set, user selects **one or more diseases/agravos/variables** for that group’s analysis.
- **D-12:** Copy and empty states stay capacitação-friendly: short PT hints, no stats jargon without explanation.

#### Dados nesta fase (híbrido com Fase 5) — decisão 2C
- **D-13:** Phase 4 ships **hybrid data**: (1) **bundled didactic mocks** so the map works in class with zero external sites; (2) **optional paste/upload** of TABNET-style tables to drive choropleths and handoff tables.
- **D-14:** Phase 5 curated scrape catalog **enhances** Mapas later; do not block Phase 4 on the full catalog. Mock variable IDs/labels should be designed so Phase 5 can swap/enrich sources without rewriting the group UX.
- **D-15:** Every plotted/selected variable shown in UI carries **provenance when known** (even mocks: label “exemplo didático” / fonte fictícia). Real paste shows user-sourced note. Full mandatory provenance catalog remains Phase 5 (CAT-*).

#### Geo / drill-down offline (MAP-01…05) — decisão 3C
- **D-16:** **Full MAP-03 ladder in Phase 4:** Brazil choropleth by UF with legend → drill into a UF → view **município**, **mesorregião**, and **região/macrorregião de saúde** choropleths.
- **D-17:** **MAP-05:** All geometries from **bundled static assets** (GeoJSON/SVG as appropriate). No runtime map tile server or IBGE API calls.
- **D-18:** **MAP-02 / MAP-04:** Paste territory labels as UF name or sigla; municipality matching **scoped by selected UF** with a **matched/unmatched report**.
- **D-19:** Planner/researcher must address **bundle size** (lazy-load per-UF município assets; do not ship all Brazil municipalities in the initial Mapas chunk). Prefer IBGE-compatible codes for join keys.

#### Handoff → Estatística (MAP-09) — decisão 6C
- **D-20:** “Analisar” opens a **review step** that: (1) shows the selection summary; (2) **suggests a statistical test** from the selection shape (reuse/extend `suggestResearchForSelection` / registry heuristics); (3) lets the user **change the test** before continuing.
- **D-21:** Confirm navigates to Estatística with **assembled tabular dataset** in session + `activeTestId` (+ recognized column roles when inferable) — not only UF list stubs.
- **D-22:** Replace/upgrade the Phase 1 `IniciarPesquisaModal` stub flow to this review+handoff; keep official collection links as secondary help, not the primary path.

### Claude's Discretion
- Exact drag-and-drop library vs HTML5 DnD; glow/highlight CSS motion (keep subtle, brand teal, no purple glow spam).
- Panel layout (drawer vs split) and mobile breakpoints — prefer desktop-first capacitação, usable tablet.
- Choropleth color scales and legend placement — white/publication export later if needed; on-screen dark+teal shell.
- Which mock diseases ship in Wave 1 vs later waves inside Phase 4.
- Precise suggestion rules for test pick (mirror existing UF-count heuristics, extend for groups/time/multi-var).

### Deferred Ideas (OUT OF SCOPE)
- Phase 5: replace/enrich mocks with versioned scraped catalog + mandatory rich provenance (CAT-*)
- Census tracts / advanced animated cartography
- Cloud save of named map projects
- Touch-first redesign beyond tablet-usable desktop layout
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | Brazil choropleth heatmap by UF with legend | Extend `BrazilMockMap` with `d3-scale` sequential teal fill; add `ChoroplethLegend` component; mock metric keyed by UF sigla |
| MAP-02 | Paste territory labels as UF name or sigla, recognized | Reuse `normalizeHeaderToken`; offline `ufCodes.ts` + alias table; paste panel in ContextPanel Mode C |
| MAP-03 | Drill into UF → município, mesorregião, macrorregião de saúde choropleths | IBGE TopoJSON per-UF lazy chunks + Brazil meso bundle; SUS health-macro simplified topo; `d3-geo` projection to SVG paths |
| MAP-04 | Municipality name matching scoped by UF + matched/unmatched report | Offline IBGE localidades JSON per UF (`id`, `nome`); exact + normalized match; report UI per 04-UI-SPEC Mode C |
| MAP-05 | Fully offline bundled static geo assets | Build-time fetch from IBGE Malhas v3 + MS health shapes → `public/geo/` or `src/geo/`; zero runtime API |
| MAP-06 | Temporality (point or range; optional A vs B compare) | Group panel time controls; mock time-series data keyed by group config; Prais-Winsten suggestion when temporal |
| MAP-07 | UF analysis groups + regional presets | `@dnd-kit/core` GroupBar; preset pills from IBGE região siglas; sync with map selection (D-08) |
| MAP-08 | Macrorregiões de saúde selectable/groupable | Bundled health-macro topo + municipality→macro crosswalk CSV; preset chips per 04-UI-SPEC |
| MAP-09 | Multi-disease selection + run statistical tests | Per-group variable picker; `assembleHandoffTable()` from mock/paste; review step with editable test |
| MAP-10 | Didactic single-screen UX with visible summary | 04-UI-SPEC regions R1–R5; SelectionSummaryStrip; progressive disclosure without stepper |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UF map render + multi-select + glow | Browser/Client (SVG React) | — | Existing `BrazilMockMap` pattern; SVG hit-testing, no tile server |
| Drill-down choropleth (muni/meso/health) | Browser/Client (SVG + d3-geo) | — | Project lazy-loaded TopoJSON to paths client-side; offline bundled assets |
| Group DnD + presets | Browser/Client (React + @dnd-kit) | — | Pure UI interaction; no server |
| Territory name matching | Browser/Client (offline lookup tables) | — | IBGE names bundled at build; paste parsed in-browser |
| Mock + paste data driving choropleth | Browser/Client (static fixtures + parseTabular) | — | Hybrid D-13; Phase 5 catalog swaps data source only |
| Session / handoff to Estatística | Browser/Client (SessionProvider + React Router state) | — | Proven Phase 2 pattern: `setDataset` + `navigate('/', { state: { activeTestId } })` |
| Test suggestion heuristics | Browser/Client (pure functions) | — | Extend `suggestResearchForSelection.ts`; registry already has 10 tests |
| Geo asset acquisition | Build-time script (Node) | — | D-17 forbids runtime IBGE calls; one-time fetch → commit assets |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Inline SVG (existing) | — | UF-level map, selection glow, a11y | Phase 1 proven; ~50 KB; zero deps; same interaction contract |
| `d3-geo` | `3.1.1` [VERIFIED: npm registry] | Project TopoJSON/GeoJSON → SVG path `d` strings | Minimal geo math; no React coupling; tree-shakeable |
| `d3-scale` | `4.0.2` [VERIFIED: npm registry] | Sequential choropleth color scale (teal steps) | Standard D3 scale API; pairs with legend breaks |
| `topojson-client` | `3.1.0` [VERIFIED: npm registry] | Decode IBGE TopoJSON → GeoJSON features | IBGE serves TopoJSON natively; ~55% smaller than GeoJSON per UF |
| `@dnd-kit/core` | `6.3.1` [ASSUMED] | Drag selected territories → group drop zones | Keyboard sensor + SR announcements; better than HTML5 DnD for a11y |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/sortable` | `10.0.0` [ASSUMED] | Reorder/rename group tabs | If group bar supports tab reorder |
| `@dnd-kit/utilities` | (peer of core) [ASSUMED] | CSS transform helpers for drag overlay | Bundled with core |
| Existing `parseTabular` / `normalizeHeaderToken` | — | Territory paste + TABNET handoff parsing | MAP-02, MAP-04, D-13 paste path |
| Existing `useTabularInput` | — | Paste/upload panel in review flow | Upgrade of `IniciarPesquisaModal` paste section |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG + d3-geo | `react-simple-maps` `3.0.0` | Peer dep conflicts with React 19; library appears unmaintained (open issues #367/#375) [CITED: github.com/zcreativelabs/react-simple-maps/issues/375] |
| Inline SVG + d3-geo | `@vnedyalk0v/react19-simple-maps` [ASSUMED] | React 19 fork exists but adds abstraction layer over same d3-geo/topojson; project already has working SVG map |
| Inline SVG + d3-geo | `maplibre-gl` `6.0.0` | **~19 MB unpacked** [VERIFIED: npm registry]; tile-oriented; violates offline/no-keys constraint spirit; overkill for didactic choropleth |
| Inline SVG + d3-geo | Keep hand-rolled SVG paths for all 5,570 municipalities | Impossible to maintain; IBGE coordinates are huge raw numbers |
| `@dnd-kit/core` | HTML5 native DnD | No keyboard drag; poor SR support; inconsistent across browsers |
| Runtime IBGE API | Build-time asset commit | Violates D-17/MAP-05; classroom offline requirement |

**Installation (new deps only):**
```bash
npm install d3-geo d3-scale topojson-client @dnd-kit/core @dnd-kit/sortable
npm install -D @types/d3-geo @types/d3-scale @types/topojson-client
```

**Version verification:** Confirmed via `npm view` on 2026-07-25.

## Package Legitimacy Audit

> slopcheck was unavailable at research time (install blocked). All packages below tagged `[ASSUMED]` — planner must gate each install behind `checkpoint:human-verify`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `d3-geo` | npm | 8+ yrs | Very high | github.com/d3/d3 | n/a | Approved pending human verify |
| `d3-scale` | npm | 8+ yrs | Very high | github.com/d3/d3 | n/a | Approved pending human verify |
| `topojson-client` | npm | 8+ yrs | High | github.com/topojson/topojson-client | n/a | Approved pending human verify |
| `@dnd-kit/core` | npm | 4+ yrs | High | github.com/clauderic/dnd-kit | n/a | Approved pending human verify |
| `@dnd-kit/sortable` | npm | 4+ yrs | High | github.com/clauderic/dnd-kit | n/a | Approved pending human verify |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not run)
**Packages flagged as suspicious [SUS]:** none

*Planner: add `checkpoint:human-verify` before first `npm install` of geo/DnD packages.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MapasPage (single screen)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  R1 GroupBar ◄── DnD drop ── selected territory chips from map/paste   │
│       │ presets (N/NE/CO/SE/S) + health-macro pills                      │
├─────────────────────────────────────────────────────────────────────────┤
│  R2 SelectionSummaryStrip ◄── derived from MapAnalysisState              │
├──────────────────────────────┬──────────────────────────────────────────┤
│  R3 MapCanvas                │  R4 ContextPanel                          │
│   ├─ view: BR-UF | UF-drill  │   Mode A: explore hints                   │
│   ├─ ChoroplethLayer (fill)  │   Mode B: group config (time → vars)      │
│   ├─ SelectionLayer (glow)   │   Mode C: paste + match report            │
│   └─ breadcrumb nav          │                                           │
├──────────────────────────────┴──────────────────────────────────────────┤
│  R5 [Revisar e analisar] ──► ReviewDialog ──► SessionProvider handoff    │
└─────────────────────────────────────────────────────────────────────────┘
         ▲                              │
         │ lazy import                  │ setDataset + navigate
         │                              ▼
  src/geo/topo/                   EstatisticaPage
  ├─ br-uf (bundled)              (activeTestId + recognizedColumns)
  ├─ br-meso.json (lazy)
  ├─ muni-{ufIbge}.json (lazy)
  └─ health-macro.json (lazy)
         ▲
         │ build-time fetch (scripts/fetch-geo-assets.mjs)
  IBGE Malhas v3 + MS health shapes
```

### Recommended Project Structure

```
src/
├── geo/
│   ├── types.ts                    # TerritoryId, GeoLevel, join keys
│   ├── territoryCatalog.ts         # UF/região presets, health macro metadata
│   ├── nameTables/                 # Offline IBGE localidades (per UF JSON)
│   │   └── muni-SP.json
│   ├── topo/                       # Lazy-loadable TopoJSON (gitignored or committed)
│   │   ├── br-meso.json
│   │   ├── muni-35.json
│   │   └── health-macro.json
│   ├── projectGeoToSvg.ts          # d3-geo path generator wrapper
│   ├── choroplethScale.ts          # d3-scale sequential teal
│   └── matchTerritoryLabels.ts     # MAP-02/04 matching engine
├── routes/mapas/
│   ├── MapasPage.tsx               # orchestrator (upgrade)
│   ├── mapAnalysisState.ts         # reducer/types for groups×time×vars
│   ├── BrazilMapCanvas.tsx         # replaces BrazilMockMap at UF; drill wrapper
│   ├── ChoroplethLegend.tsx
│   ├── GroupBar.tsx                # DnD + presets
│   ├── SelectionSummaryStrip.tsx
│   ├── GroupConfigPanel.tsx        # time + variables per group
│   ├── TerritoryPastePanel.tsx     # paste + match report
│   ├── ReviewAnalysisDialog.tsx    # replaces IniciarPesquisaModal primary flow
│   ├── assembleHandoffTable.ts     # groups → tabular rows
│   ├── suggestResearchForSelection.ts  # extend heuristics
│   └── mockAnalysisData.ts         # didactic mocks (D-13)
scripts/
└── fetch-geo-assets.mjs            # build-time IBGE + MS download + simplify
```

### Pattern 1: Lazy TopoJSON Loading via Dynamic Import

**What:** Initial Mapas chunk ships only UF SVG (`brazilUfPaths.ts`, ~50 KB). On drill into UF `SP` (IBGE `35`), `import(\`@/geo/topo/muni-35.json\`)` loads ~136 KB TopoJSON; `topojson-client.feature()` extracts municipalities; `d3-geo.geoPath()` renders SVG `<path>` elements.

**When to use:** Every sub-UF geography level (municipality per UF, Brazil meso, health macro).

**Example:**
```typescript
// Source: [CITED: servicodados.ibge.gov.br/api/docs/malhas?versao=3]
// Verified sizes 2026-07-25: SP muni topojson = 135,743 bytes
import { feature } from 'topojson-client';
import { geoPath, geoMercator } from 'd3-geo';
import type { Topology } from 'topojson-specification';

export async function loadMunicipalitiesForUf(ufIbge: string) {
  const topo = (await import(`@/geo/topo/muni-${ufIbge}.json`)).default as Topology;
  const collection = feature(topo, topo.objects[Object.keys(topo.objects)[0]!]);
  return collection.features; // join key: properties.codarea (7-digit IBGE)
}
```

### Pattern 2: Extend Session Without Breaking Phase 2 Handoff

**What:** Replace flat `mapSelection: { ufs, variables }` with typed `mapAnalysis: MapAnalysisState | null`. Handoff still calls `setDataset()` + `navigate('/', { state: { activeTestId, recognizedColumns } })` — proven in `IniciarPesquisaModal.tsx` and consumed by `EstatisticaPage.tsx`.

**When to use:** Any Mapas → Estatística navigation (D-21).

**Example:**
```typescript
// Extends SessionProvider.tsx pattern
export interface MapAnalysisGroup {
  id: string;
  name: string;
  territoryIds: TerritoryRef[];  // { level: 'uf'|'municipio'|'meso'|'health-macro', code: string }
  time: { mode: 'point' | 'range' | 'compare'; start?: string; end?: string; point?: string };
  variableIds: string[];
}

export interface MapAnalysisState {
  groups: MapAnalysisGroup[];
  activeGroupId: string | null;
  mapView: { level: GeoLevel; parentCode?: string };
  provenance: 'mock' | 'paste' | 'hybrid';
}
```

### Pattern 3: Territory Name Matching (Reuse normalizeHeaderToken)

**What:** UF paste: match sigla (2 letters) or normalized full name against `ufCodes.ts`. Municipality paste: require active UF context; build lookup from offline `nameTables/muni-{UF}.json` (sourced from IBGE Localidades API v1 at build time [CITED: servicodados.ibge.gov.br/api/docs/localidades?versao=1]); normalize with existing `normalizeHeaderToken` from `parseTabular.ts`.

**When to use:** MAP-02 (UF paste), MAP-04 (municipality paste scoped by UF).

**Example:**
```typescript
// Reuses src/shared/data-input/parseTabular.ts normalizeHeaderToken
import { normalizeHeaderToken } from '@/shared/data-input/parseTabular';

export function matchMunicipality(name: string, ufSigla: string, catalog: MuniEntry[]) {
  const token = normalizeHeaderToken(name);
  const exact = catalog.find((m) => normalizeHeaderToken(m.nome) === token);
  if (exact) return { status: 'matched' as const, entry: exact };
  // Optional: Levenshtein ≤2 for typos — flag as 'fuzzy' in report
  return { status: 'unmatched' as const, input: name };
}
```

### Pattern 4: Group DnD with @dnd-kit

**What:** Selected territory chips in a `DragOverlay`; drop targets in GroupBar (`useDroppable` per group + "Criar grupo"). Button fallback always visible (D-05). Keyboard sensor enabled by default [CITED: github.com/dnd-kit/docs/guides/accessibility.md].

**When to use:** D-04/D-05 group creation UX.

### Anti-Patterns to Avoid

- **Runtime IBGE fetches in production:** Violates MAP-05/D-17; classroom Wi-Fi unreliable.
- **Bundling all 5,570 municipalities in main chunk:** ~1.3 MB topo total — acceptable on disk but not in initial JS bundle (D-19).
- **react-simple-maps without React 19 override:** npm install fails peer deps [CITED: github.com/zcreativelabs/react-simple-maps/issues/375].
- **MapLibre for static choropleth:** 19 MB library for data already projectable to SVG.
- **Hand-rolling point-in-polygon:** Phase 1 research explicitly rejected this; SVG `<path>` hit-testing works.
- **Replacing entire Mapas UX with modal stepper:** Violates D-01/MAP-10 locked decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GeoJSON → SVG paths | Custom projection math | `d3-geo` `geoPath` + `geoMercator`/`geoIdentity` | Edge cases: antimeridian, topology, fitExtent |
| TopoJSON decoding | Manual arc indexing | `topojson-client` `feature()` | IBGE serves TopoJSON natively |
| Choropleth color interpolation | Manual hex lerping | `d3-scale` `scaleSequential` | Legend breaks, null handling, clamp |
| Drag-and-drop with keyboard a11y | Raw HTML5 DnD only | `@dnd-kit/core` | KeyboardSensor, focus restore, SR live regions |
| Territory diacritics normalization | New normalizer | `normalizeHeaderToken` from `parseTabular.ts` | Already handles NFD strip, pt-BR tokens |
| Municipality/UF name lists | Scrape at runtime | Build-time IBGE Localidades JSON | Offline MAP-05; stable join keys |
| Health macro geometries | Guess from IBGE meso | MS/SUS official shapefile → simplified topo at build | MAP-08 requires SUS regionalization, not IBGE meso |

**Key insight:** Phase 1 deliberately deferred geo libraries until real choropleth data existed. Phase 4 adds the **minimum** geo stack (d3-geo + topojson-client + d3-scale) while **keeping** the inline SVG interaction model that already works.

## Common Pitfalls

### Pitfall 1: Initial Bundle Bloat from Geo Assets

**What goes wrong:** Shipping all municipality TopoJSON in the main Vite chunk inflates first load by ~1.3 MB+, breaking classroom use on slow connections.

**Why it happens:** Vite static-import of JSON bundles into the entry graph.

**How to avoid:** Dynamic `import()` per UF; Vite code-splits each JSON into separate chunk. Keep UF SVG in main bundle (~50 KB). Lazy-load `br-meso.json` (~595 KB) only when user opens mesorregião view.

**Warning signs:** `vite build` initial chunk > 500 KB; Lighthouse "unused JavaScript" flags geo JSON.

### Pitfall 2: Join Key Mismatch (codarea vs id)

**What goes wrong:** Choropleth data keyed by UF sigla doesn't join to GeoJSON `properties.codarea` (IBGE numeric code).

**Why it happens:** IBGE malhas use `codarea` string (e.g. `"3500105"`) [VERIFIED: live API probe 2026-07-25]; UI uses sigla (`SP`).

**How to avoid:** Single `TerritoryRef` type with `{ level, ibgeCode, sigla?, name }`; crosswalk in `ufCodes.ts` (already has `ibgeCode`).

**Warning signs:** Map renders but all regions same color; console join misses.

### Pitfall 3: Health Macro vs IBGE Meso Confusion

**What goes wrong:** Using IBGE mesorregião shapes for "macrorregião de saúde" — different territorial definitions (MAP-08).

**Why it happens:** Similar names; IBGE API doesn't serve SUS health regions.

**How to avoid:** Separate asset `health-macro.json` from MS/SUS source [CITED: dadosabertos.saude.gov.br/dataset/macrorregiao-de-saude]; municipality→health-region crosswalk CSV for grouping.

**Warning signs:** Wrong municipality groupings vs DATASUS tables.

### Pitfall 4: react-simple-maps React 19 Install Failure

**What goes wrong:** `npm install react-simple-maps` fails peer dependency check on React 19.

**Why it happens:** Package declares React ≤18 [CITED: github.com/zcreativelabs/react-simple-maps/issues/367].

**How to avoid:** Don't adopt; use d3-geo directly (recommended) or fork `@vnedyalk0v/react19-simple-maps` [ASSUMED] if wrapper desired.

### Pitfall 5: Handoff Without Assembled Table

**What goes wrong:** Navigate to Estatística with only `activeTestId` but empty/wrong dataset — user lands on Dados step with nothing to analyze.

**Why it happens:** Phase 1 stub allowed paste-only handoff; D-21 requires **assembled table** from map selection.

**How to avoid:** `assembleHandoffTable(groups, mockData|pasteData)` produces `{ headers, rows }` before `setDataset()`; derive `recognizedColumns` via existing `deriveRecognizedColumnsFromTabular`.

### Pitfall 6: Suggestion Engine Stale Demo Fallback

**What goes wrong:** `suggestResearchForSelection` still appends demo rationale saying "Único teste disponível hoje" — false after Phase 3.

**Why it happens:** Stale copy in `suggestResearchForSelection.ts` line 97.

**How to avoid:** Update rationales; extend heuristics for group count, time compare, multi-variable; use `isTestAvailable` from registry.

## Code Examples

### Build-Time Geo Asset Fetch (IBGE Malhas v3)

```bash
# Source: [CITED: servicodados.ibge.gov.br/api/docs/malhas?versao=3]
# UF layer (already committed as brazilUfPaths.ts from SVG endpoint)
curl 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=image/svg+xml&qualidade=minima&intrarregiao=UF'

# Per-UF municipalities (TopoJSON, lazy chunk)
curl 'https://servicodados.ibge.gov.br/api/v3/malhas/estados/35?formato=application/json&qualidade=minima&intrarregiao=municipio' \
  -o src/geo/topo/muni-35.json

# Brazil mesorregiões
curl 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&qualidade=minima&intrarregiao=mesorregiao' \
  -o src/geo/topo/br-meso.json
```

### Choropleth Fill with d3-scale

```typescript
// Source: [VERIFIED: npm registry d3-scale@4.0.2]
import { scaleSequential } from 'd3-scale';

const TEAL_STEPS = ['#18181b', '#1a3d34', '#209978', '#2eb896', '#5eead4'];

export function createChoroplethScale(values: number[]) {
  const [min, max] = [Math.min(...values), Math.max(...values)];
  return scaleSequential<string>()
    .domain([min, max])
    .interpolator((t) => TEAL_STEPS[Math.min(4, Math.floor(t * 5))]!);
}
```

### Dynamic Import Lazy Load

```typescript
// Source: [CITED: vite.dev guide dynamic import]
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  '35': () => import('@/geo/topo/muni-35.json'),
  // ... generated for 27 UFs
};

export async function loadMuniTopo(ufIbge: string) {
  const loader = loaders[ufIbge];
  if (!loader) throw new Error(`Sem malha para UF ${ufIbge}`);
  return loader();
}
```

## Geo Asset Sources & Bundle Size Budget

### Verified IBGE Malhas v3 Sizes (2026-07-25)

| Asset | Format | Size | Load strategy |
|-------|--------|------|---------------|
| Brazil by UF | GeoJSON | 96 KB | Already as SVG paths (~50 KB TS) — keep |
| Brazil mesorregiões | GeoJSON | 595 KB | Lazy on first meso view |
| SP municipalities | GeoJSON | 302 KB | — |
| SP municipalities | **TopoJSON** | **133 KB** | **Preferred** — lazy on UF drill |
| All 27 UF muni (topo, minima) | TopoJSON | **1,364 KB total** | Per-UF lazy chunks (avg 52 KB) |
| Largest UF muni (MG) | TopoJSON | 201 KB | Acceptable single drill load |
| Smallest (DF) | TopoJSON | 571 B | Trivial |

**Budget targets:**
- Initial Mapas route chunk: **≤ 200 KB** gzip (UF SVG + app code; no muni topo)
- Single UF drill chunk: **≤ 250 KB** gzip (worst case MG)
- Health macro topo (after simplification): **≤ 400 KB** target (raw community simplified = 3 MB — must simplify at build)

### Health Macro-Region Source

| Source | Format | Size | Notes |
|--------|--------|------|-------|
| [Portal Dados Abertos SUS](https://dadosabertos.saude.gov.br/dataset/macrorregiao-de-saude) | Official (SHP/API) | TBD | Preferred provenance for MAP-08 |
| [Cidacs/Fiocruz DOI](https://doi.org/10.57833/cidacs/b9jhvc) | Shapefile | — | 120 macrorregiões, 439 regiões; updated 2025 |
| [lansaviniec/shapefile_das_regionais_de_saude_sus](https://github.com/lansaviniec/shapefile_das_regionais_de_saude_sus) | GeoJSON simplified | 3 MB | Needs mapshaper pass before bundling |

### IBGE Localidades (Name Tables — No Geometry)

Build script fetches `https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios` → `{ id, nome }` JSON per UF. Total ~5,570 entries ≈ **~400 KB** JSON — acceptable in main bundle or lazy per UF alongside topo.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 1 flat `{ ufs, variables }` session | Structured `MapAnalysisState` with groups×time | Phase 4 | Enables MAP-06/07/09 |
| Phase 1 stub modal (paste-first) | Review dialog with assembled table + test picker | Phase 4 (D-20–22) | Primary path is map-driven |
| Static fill-only UF map | Choropleth + drill-down ladder | Phase 4 (MAP-01/03) | d3-scale + lazy topo |
| Mock-only variables | Hybrid mock + paste (D-13) | Phase 4 | Phase 5 swaps mock IDs |

**Deprecated/outdated:**
- `IniciarPesquisaModal` as primary flow — upgrade to `ReviewAnalysisDialog` (keep collection links secondary per D-22)
- Demo-only suggestion rationale — update after Phase 3 registry complete

## Recommended Plan / Wave Breakdown

| Wave | Plans (suggested) | Requirements | Rationale |
|------|-------------------|--------------|-----------|
| **0** | Geo fetch script, types, session model, test fixtures | MAP-05 (infra) | Assets + types before UI; Nyquist Wave 0 |
| **1** | UF choropleth + legend + mock metric | MAP-01 | Visible value on existing map; smallest vertical slice |
| **2** | Territory paste UF + name tables | MAP-02 | Independent of groups; reuses parseTabular |
| **3** | GroupBar + DnD + presets + summary strip | MAP-07, MAP-08, MAP-10 | Core didactic UX (D-01–08) |
| **4** | Drill-down ladder + lazy topo + muni matching | MAP-03, MAP-04, MAP-05 | Heaviest geo work isolated |
| **5** | Group config panel (time + variables) + hybrid data | MAP-06, D-13–15 | Needs groups from Wave 3 |
| **6** | Review handoff + assemble table + test suggestion | MAP-09, D-20–22 | Integration with Estatística |
| **7** | Gate: all MAP-* verification + UI-SPEC audit | MAP-01–10 | Phase gate before `/gsd:verify-work` |

**Parallelization:** Waves 1–2 can run parallel after Wave 0. Wave 4 depends on Wave 0 assets. Wave 5 depends on Wave 3. Wave 6 depends on 3+5.

**UI-SPEC alignment:** Layout regions R1–R5 from `04-UI-SPEC.md` map 1:1 to Wave 3–6 components.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/core@6.3.1` works with React 19.2.8 | Standard Stack | Install/runtime failure — fallback to HTML5 DnD + button-only |
| A2 | Health macro simplified topo can reach ≤400 KB | Geo Asset Sources | Slow drill load — defer health macro to Wave 4b |
| A3 | IBGE `codarea` stable as join key across malhas + localidades | Pitfall 2 | Join failures — add explicit crosswalk tests |
| A4 | `qualidade=minima` sufficient for didactic choropleth | Geo Asset Sources | Visual coarseness — acceptable per capacitação; can bump per-UF if needed |
| A5 | 04-UI-SPEC drawer/split choice left to planner | Architecture | Minor layout rework |

## Open Questions

1. **Health macro asset provenance for bundle**
   - What we know: MS open data portal has July 2026 resources [CITED: dadosabertos.saude.gov.br/dataset/macrorregiao-de-saude]; Cidacs DOI 2025 shapefile exists.
   - What's unclear: Exact download URL/format from MS portal API (fetch failed in sandbox).
   - Recommendation: Wave 0 plan includes manual download step + mapshaper simplification; cite MS as provenance in asset metadata.

2. **Mock disease catalog scope for Wave 1**
   - What we know: D-13 hybrid; discretion on which mocks ship first; existing 10 BASE_VARIABLES in `mockVariablesByUF.ts`.
   - Recommendation: Ship 4–6 mocks in Wave 1 (internações, óbitos, taxa, amputações); expand in Wave 5 with time-series mock columns.

3. **Assembled handoff table shape per test**
   - What we know: Tests expect different column roles via `deriveRecognizedColumnsFromTabular`.
   - Recommendation: `assembleHandoffTable` produces wide format: `Território;Grupo;Período;Variável1;Variável2…`; let existing alias matching infer roles.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build, geo fetch script | ✓ | (host) | — |
| npm | Package install | ✓ | (host) | — |
| IBGE Malhas API (build-time only) | Geo asset fetch script | ✓ (network) | v3 | Manual curl commands documented |
| Vitest + RTL | Unit/integration tests | ✓ | vitest 4.1.10 | — |
| ctx7 CLI | Doc lookup | ✗ | — | WebFetch official docs (used) |

**Missing dependencies with no fallback:** none for implementation (IBGE fetch only needed at build time, documented).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (`test` block) |
| Quick run command | `npm test -- --run src/routes/mapas/` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | UF choropleth maps mock values to fill colors + legend breaks | unit | `npm test -- --run src/routes/mapas/ChoroplethLegend.test.tsx -x` | ❌ Wave 0 |
| MAP-02 | UF name/sigla paste resolves correctly | unit | `npm test -- --run src/geo/matchTerritoryLabels.test.ts -x` | ❌ Wave 0 |
| MAP-03 | Drill loads lazy topo for UF and renders path count > 0 | unit | `npm test -- --run src/geo/projectGeoToSvg.test.ts -x` | ❌ Wave 0 |
| MAP-04 | Municipality match scoped by UF; unmatched reported | unit | `npm test -- --run src/geo/matchTerritoryLabels.test.ts -x` | ❌ Wave 0 |
| MAP-05 | No runtime fetch — dynamic imports resolve local JSON | unit | `npm test -- --run src/geo/loadGeoAsset.test.ts -x` | ❌ Wave 0 |
| MAP-06 | Group time config serializes point/range/compare | unit | `npm test -- --run src/routes/mapas/mapAnalysisState.test.ts -x` | ❌ Wave 0 |
| MAP-07 | Preset creates group with correct UF members | unit | `npm test -- --run src/routes/mapas/GroupBar.test.tsx -x` | ❌ Wave 3 |
| MAP-08 | Health macro preset resolves territory IDs | unit | `npm test -- --run src/geo/territoryCatalog.test.ts -x` | ❌ Wave 0 |
| MAP-09 | Review assembles table + resolves handoff testId | integration | `npm test -- --run src/routes/mapas/ReviewAnalysisDialog.test.tsx -x` | ❌ Wave 6 |
| MAP-10 | Selection summary renders plain-PT chips from state | unit | `npm test -- --run src/routes/mapas/SelectionSummaryStrip.test.tsx -x` | ❌ Wave 3 |

**Existing tests (extend, do not replace):**
- `src/routes/mapas/suggestResearchForSelection.test.ts` — extend for groups/time
- `src/routes/mapas/BrazilMockMap.test.tsx` — extend for choropleth fill
- `src/routes/mapas/IniciarPesquisaModal.test.tsx` — migrate patterns to ReviewAnalysisDialog
- `src/shared/session/SessionProvider.test.tsx` — extend for `mapAnalysis` shape

### Sampling Rate

- **Per task commit:** `npm test -- --run src/routes/mapas/ src/geo/`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green + `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/fetch-geo-assets.mjs` — build-time IBGE + MS download
- [ ] `src/geo/matchTerritoryLabels.test.ts` — MAP-02/04
- [ ] `src/geo/projectGeoToSvg.test.ts` — MAP-03/05
- [ ] `src/routes/mapas/mapAnalysisState.test.ts` — MAP-06/07
- [ ] `src/geo/territoryCatalog.test.ts` — MAP-08 presets
- [ ] Session type extension tests in `SessionProvider.test.tsx`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | Client-only in-memory session (no persistence) |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Paste parsing via existing `parseTabular`; geo JSON from trusted build-time sources only; no `dangerouslySetInnerHTML` for maps |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via pasted territory labels | Spoofing/Tampering | React text escaping; no innerHTML in map labels |
| XSS via geo SVG | Tampering | IBGE SVG sanitized in Phase 1 (T-01-SVG); same rule for fetched assets — strip scripts/handlers at build |
| Prototype pollution via JSON geo files | Tampering | Static committed JSON from build script; no user-supplied geo |
| DoS via huge paste file | Denial | Existing tabular row limits; extend to territory paste panel |

## Sources

### Primary (HIGH confidence)
- IBGE Malhas API v3 — https://servicodados.ibge.gov.br/api/docs/malhas?versao=3 — formats, intrarregiao levels, qualidade=minima
- IBGE Localidades API v1 — https://servicodados.ibge.gov.br/api/docs/localidades?versao=1 — municipality names/IDs
- Live size probes — curl downloads 2026-07-25 (UF, SP muni, all-UF muni, meso)
- Codebase — `src/routes/mapas/*`, `SessionProvider.tsx`, `parseTabular.ts`, `04-UI-SPEC.md`
- Phase 1 research — `.planning/phases/01-redesign-base-react-shell/01-RESEARCH.md` — SVG mock decision, don't hand-roll pip

### Secondary (MEDIUM confidence)
- Brazil Visible IBGE guide — https://brazilvisible.org/docs/apis/dados-geoespaciais/ibge-geociencias/ — performance guidance (resolucao 1-2 for web)
- dnd-kit accessibility guide — https://github.com/dnd-kit/docs/blob/master/guides/accessibility.md
- Portal Dados Abertos SUS — https://dadosabertos.saude.gov.br/dataset/macrorregiao-de-saude — health macro official source
- react-simple-maps React 19 issues — https://github.com/zcreativelabs/react-simple-maps/issues/375

### Tertiary (LOW confidence — flag for validation)
- `@vnedyalk0v/react19-simple-maps` fork — community maintained [ASSUMED]
- lansaviniec simplified health regions GeoJSON — 3 MB, needs simplification [ASSUMED size]

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — verified npm versions, live IBGE probes, existing SVG pattern
- Architecture: **HIGH** — extends proven Phase 1/2 patterns; 04-UI-SPEC provides layout contract
- Pitfalls: **MEDIUM** — health macro asset sizing unverified after simplification

**Research date:** 2026-07-25
**Valid until:** 2026-08-25 (IBGE APIs stable; verify health macro download path in Wave 0)

## RESEARCH COMPLETE

**Phase:** 4 - Mapas como interface estatística
**Confidence:** HIGH

### Key Findings
- **Keep inline SVG + add d3-geo/topojson-client** — best economy for React 19 offline choropleth; avoid MapLibre (~19 MB) and react-simple-maps (React 19 peer conflicts).
- **Lazy-load per-UF TopoJSON** (~52 KB avg, 201 KB max MG) — total 1.3 MB on disk but never in initial chunk; validates D-19.
- **Health macrorregiões require separate MS/SUS assets**, not IBGE meso — build-time simplification mandatory (~3 MB raw → target ≤400 KB).
- **@dnd-kit/core recommended** for group DnD with keyboard a11y; reuse `normalizeHeaderToken` for territory matching.
- **7-wave plan**: geo infra → UF choropleth → paste → groups → drill-down → group config → review handoff.

### File Created
`.planning/phases/04-mapas-como-interface-estatistica/04-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | npm verified, IBGE sizes probed live, Phase 1 SVG proven |
| Architecture | HIGH | Extends existing session/handoff/map patterns |
| Pitfalls | MEDIUM | Health macro bundle size needs Wave 0 simplification proof |

### Open Questions
- MS health macro download URL (portal API unavailable in sandbox) — manual fetch in Wave 0
- Exact mock disease count for Wave 1 — planner discretion per D-13

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
