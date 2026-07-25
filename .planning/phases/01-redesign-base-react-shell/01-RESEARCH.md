# Phase 1: Redesign / base React shell - Research

**Researched:** 2026-07-25
**Domain:** React+Vite+TS SPA re-platform (client-only) — portal shell, shared paste/wizard data pipeline, mock geo interaction, in-memory session
**Confidence:** HIGH (scaffold/routing/data-input port), MEDIUM (Mapas mock asset sourcing — no live prototype yet)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Product is a **LACIR site shell**, not a single-purpose bioestat app. Header: **Logo + nome · Estatística · Meta-análise · Variáveis · Mapas**.
- **D-02:** No `v1.0 · Beta` (or similar) badge in the header.
- **D-03:** **Portal DATASUS** link lives **inside Estatística**, not in the global header.
- **D-04:** Landing route = **Estatística**.
- **D-05:** Inside Estatística, tests use a **collapsible left sidebar** (MVP pattern, collapses on small screens).
- **D-06:** All four nav routes get a **real layout shell** in Phase 1. Estatística is interactive (flow + demo). Meta / Variáveis / Mapas use real structure; Mapas specifically uses **faithful mock interaction**. Content backends fill in later phases.
- **D-07:** UI-01 wording shifts from "top tabs Testes|Mapas|Catálogo|Meta" to **header nav items** as in D-01 (Catálogo → **Variáveis**).
- **D-08:** Shared input = textarea + file upload + **ported/expanded DataSUS wizard** (`tabular-data-input`, `datasus-importer`, `datasus-wizard`).
- **D-09:** **Maximum format tolerance** — including raw copy-paste of DataSUS/TABNET tables (`;`, pt-BR decimal comma, tabs, messy dumps).
- **D-10:** UX after paste: **auto-detect as much as possible → column preview → user confirm/adjust → continue**.
- **D-11:** Phase 1 ships a **didactic stub** ("Teste demo") with sample data, simple chart, PNG export, and brief PT interpretation — proves the shell before Phase 2 migration.
- **D-12:** Interpretation slot (UI-06) and PNG export (UI-04) are part of the shared results pattern used by the stub.
- **D-13:** Prominent button in Estatística opens a **modal** with a short decision tree (data type → study design → recommended test).
- **D-14:** Wizard can surface the **full roadmap of tests**; unavailable ones show **"em breve"** and are not navigable; only available modules (demo now; migrated later) are clickable.
- **D-15:** **Balanced** cult-ui: subtle texture/motion on header or area entry; data-work areas stay clean/readable.
- **D-16:** Accent = **clinical teal** (~`#10b981`), not purple leftover from old Tailwind scaffold. Preserve LACIR logo as-is.
- **D-17:** **No persistent "refresh loses work" banner.**
- **D-18:** Use `beforeunload` (or equivalent) **only on Estatística**, and **only if the user has already inputted data**.
- **D-19:** Mapas is **coupled to research/estatística** but Estatística remains usable **standalone** (paste without Mapas).
- **D-20:** Hover UF → side panel lists variables available for that location.
- **D-21:** Click UF → UF stays **selected/locked**; variable list stays for that selection.
- **D-22:** Multi-select UFs → panel shows **intersection first** (vars in all selected UFs); vars missing in some UFs appear **at the end** with alert ("não existe em BA, PE…").
- **D-23:** Multi-select variables from the list.
- **D-24:** **Iniciar pesquisa** → didactic next step: which researches/tests are possible → official collection links per variable → user pastes into a modal → continues toward a test. Phase 1: stub this flow with mock data; Phase 4 wires real catalog/geo.

### Claude's Discretion
- Exact teal token values / WCAG tweaks after sampling logo.
- Which cult-ui components (keep few; header/entry only).
- Demo stub chart type (keep Chart.js consistent with MVP).
- Router choice (e.g. react-router hash/history) as long as header nav matches D-01.

### Deferred Ideas (OUT OF SCOPE)
- Additional LACIR header areas beyond the four (Pesquisa, Extensão, etc.) — future milestone.
- Full Mapas catalog/geo data, real variable availability per UF, real iniciar-pesquisa — **Phase 4** (shell/mock in Phase 1).
- Real test migrations — **Phase 2**; new tests — **Phase 3**; Variáveis catalog data — **Phase 5**; Meta-análise — **Phase 6**.
- Persistent refresh banner — **rejected** by user.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | React LACIR portal shell, dark theme, teal accents, logo+name, header nav Estatística\|Meta-análise\|Variáveis\|Mapas (no badge; DataSUS link inside Estatística) | Standard Stack (Vite/Tailwind v4/shadcn/cult-ui), Architecture Patterns (routing + shell), Code Examples (header nav, theme tokens) |
| UI-02 | Shared flow Dados → Configurar → Resultados | Architecture Patterns (Pattern 2: shared flow component), Code Examples (`useTabularInput` + step shell) |
| UI-03 | Paste TABNET-style data (`;`, pt-BR comma) with friendly validation errors | Don't Hand-Roll (parsing), Code Examples (port of `tabular-data-input.js`/`datasus-importer.js`), Common Pitfalls (decimal-comma ambiguity, header detection) |
| UI-04 | Download active result chart as PNG | Architecture Patterns (Pattern 3: chart/export contract), Code Examples (`useChartExport` port of `chart-manager.js`) |
| UI-05 | `beforeunload` only on Estatística, only if data present; no persistent banner | Code Examples (`useLeaveWarning` hook), Common Pitfalls (SPA route-scoping the listener) |
| UI-06 | Brief PT interpretation under every result | Architecture Patterns (shared Results pattern includes interpretation slot) |
| UX-01 | "Qual teste usar?" guided modal with roadmap + "em breve" | Architecture Patterns (Pattern 1: static test registry drives both sidebar and modal roadmap) |
</phase_requirements>

<architectural_responsibility_map>
## Architectural Responsibility Map

This is a 100%-client, single-tier SPA (no backend, no SSR). All capabilities live in the **Browser/Client** tier; the table below distinguishes *where inside the client* each capability's logic should live, since that boundary is what Phase 1 actually needs to get right.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Header nav / routing | Browser/Client (React Router) | — | Pure client-side routing, no SSR; four routes map 1:1 to header items (D-01/D-07) |
| Data paste/parse (textarea, file, DataSUS wizard) | Browser/Client (shared hook, framework-agnostic core) | — | Must run identically across Estatística's demo, and later every test/Maps paste box — belongs in `shared/`, not per-route |
| Session/handoff state (last dataset, wizard result) | Browser/Client (React Context, in-memory) | — | Explicit constraint: no persistence; dies on refresh; single small cross-route object |
| Chart render + PNG export | Browser/Client (Chart.js canvas) | — | `canvas.toDataURL()` is a browser-only capability; no server round-trip needed |
| Mapas mock (hover/select UF, variable intersection) | Browser/Client (static SVG + local mock JSON) | — | Phase 1 has no data backend; "variables per UF" is a bundled mock fixture, not fetched |
| Leave-page warning | Browser/Client (`beforeunload` event) | — | Native browser API, route-scoped by mounting/unmounting the listener with the Estatística route |
| CDN / Static | Vite build output (static hosting) | — | No CDN-specific logic needed in Phase 1; noted for completeness only |

**Single-tier confirmation:** No API/Backend, Frontend-SSR, or Database/Storage tier exists in this milestone (see `.planning/REQUIREMENTS.md` Out of Scope: "Backend / database / auth — Explicit client-only milestone"). All research below assumes pure client bundle output.
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 1 is a **re-platform**, not a rewrite of logic: the existing vanilla-JS app already has a working, well-tested paste/parse pipeline (`tabular-data-input.js`, `datasus-importer.js`, `datasus-normalizer.js`, `datasus-wizard.js`) and a working Chart.js factory with PNG export (`chart-manager.js`). None of that math or parsing logic needs to change — it needs to move from imperative DOM manipulation (`innerHTML` templates + manual `addEventListener` wiring) into React hooks/components that return the same data shapes. This is the single highest-value insight for planning: **treat the port as "extract pure logic, rewrite only the rendering," not "rebuild from scratch."**

The stack itself is already locked at the milestone level (`.planning/research/STACK.md`, confirmed HIGH confidence): React 19 + Vite 8 + Tailwind v4 + shadcn/ui (Vite preset) + `@cult-ui` registry, React Router for the four header routes, Chart.js kept as-is. All core version numbers were re-verified live against the npm registry during this research pass (see Standard Stack) and match STACK.md exactly — no drift since the milestone research was done the same day.

The one genuinely new decision this phase must make (not covered by milestone research, since Mapas was scoped to Phase 4 there) is **how to build the Mapas mock** cheaply: Phase 1 needs a hoverable/clickable Brazil-by-UF shape with zero real geo data behind it. The right-sized answer is a **static inline SVG of the 27 UF outlines** (sourced once, offline, from IBGE's own official malha endpoint or a permissively-licensed community SVG) wrapped in a small React component — not a mapping library. Pulling in `chartjs-chart-geo`/`topojson-client`/`d3-geo` (the Phase 4 stack) a phase early would add real dependencies and a data-loading pipeline for a screen that has no real data yet; a hand-authored SVG with `data-uf` attributes and React event handlers delivers the exact same hover/click/multi-select interaction D-20–D-24 require, at effectively zero bundle cost, and can be swapped for the Phase 4 real map without changing the interaction contract (same `onHoverUF`/`onSelectUF` handlers, same panel component).

**Primary recommendation:** Scaffold with `npm create vite@latest . -- --template react-ts`, layer Tailwind v4 + shadcn (`-t vite` preset) + `@cult-ui` per STACK.md, add `react-router-dom` for the 4 header routes, port the 4 existing data-input/chart JS modules into `src/shared/` as framework-agnostic functions consumed by 2–3 new hooks (`useTabularInput`, `useDatasusWizard`, `useChartExport`), and build Mapas as a static inline SVG + local mock-data component — no new geo dependency this phase.
</research_summary>

## Standard Stack

### Core

| Library | Version (verified 2026-07-25) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` / `react-dom` | `19.2.8` [VERIFIED: npm registry] | UI runtime | Matches milestone STACK.md; required peer for shadcn/ui and cult-ui components |
| `vite` | `8.1.5` [VERIFIED: npm registry] | Dev server + bundler | Already the project's tool (`vite@^5` today per `package.json`); v8 gives first-class Tailwind v4 plugin support |
| `@vitejs/plugin-react` | `4.5.1` [VERIFIED: npm registry] | Vite ↔ React (Fast Refresh, JSX) | Official plugin, required for any Vite+React app |
| `typescript` | `5.9.x` line (registry `latest` resolves ≥5.9) [ASSUMED — not independently pinned this pass] | Static typing for shared hooks/stats port | CONTEXT.md discretion doesn't forbid TS; `shared/stats/*` and `shared/data-input/*` benefit heavily from typed row/column shapes given the parsing complexity being ported |
| `tailwindcss` | `4.3.3` [VERIFIED: npm registry] | Utility CSS + design tokens (dark theme, teal accents) | CSS-first `@theme` config replaces `tailwind.config.js`; required by current shadcn/cult-ui installers |
| `@tailwindcss/vite` | `4.3.3` [VERIFIED: npm registry] | First-party Tailwind v4 Vite plugin | Removes PostCSS boilerplate; matching major with `tailwindcss` |
| `shadcn` (CLI, `npx shadcn@latest`) | CLI tool, not a runtime dep | Generates `components.json`, copies Radix-based primitives into `src/components/ui` | "Own your components" — the same CLI cult-ui targets; `init -t vite` preset scaffolds Tailwind v4 + path aliases in one step |
| `@cult-ui` registry components | Per-component, via `npx shadcn@latest add @cult-ui/<name>` | Animated/textured accents for header/entry per D-15 | Curated MIT registry accepted into the shadcn directory; installed like any shadcn component, no separate package manager |
| `react-router-dom` | `7.18.1` [VERIFIED: npm registry] | Client-side routing for the 4 header nav routes | CONTEXT.md leaves router choice to discretion but requires header nav to map to real routes (D-01/D-06/D-07); React Router v7's data-router API (`createBrowserRouter`) is the current stable pattern and needs no server |
| `chart.js` | `4.5.1` [VERIFIED: npm registry] (already a dependency) | Charting engine for the demo stub chart + PNG export | Already used and validated in v1.0 (`chart-manager.js`); reusing avoids introducing a second charting stack for one demo chart |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | `0.7.1` [VERIFIED: npm registry] | Variant-based className composition for shadcn-style components | Installed automatically by `shadcn add`; needed for Button/Badge-style components with variants (e.g. "em breve" pill in the qual-teste modal) |
| `clsx` | `2.1.1` [VERIFIED: npm registry] | Conditional className joining | Peer dependency of shadcn components; also useful for sidebar collapsed/expanded state classes |
| `tailwind-merge` | `3.6.0` [VERIFIED: npm registry] | Resolve conflicting Tailwind classes when composing variants | Standard shadcn `cn()` utility pairs `clsx` + `tailwind-merge` |
| `lucide-react` | `0.5xx` current [ASSUMED — icon set, not version-critical] | Icon set for header/sidebar/nav affordances | Default icon library shadcn components are authored against; avoids mixing icon sets |
| `@types/node` (dev) | latest LTS-matching | `path` resolution in `vite.config.ts` for the `@/*` alias | Needed once TypeScript + path aliases are adopted (shadcn's `components.json` expects `@/components`, `@/lib/utils`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static inline SVG for Mapas mock (this phase) | `chartjs-chart-geo` + `topojson-client` (Phase 4 stack, pulled forward) | Would add ~3 new deps and a TopoJSON loading step for a screen with zero real data this phase; defer to Phase 4 when real choropleth data exists |
| React Router v7 data router | Plain `useState('estatistica' \| 'mapas' \| ...)` tab switch (no router) | Simpler, zero new dependency, but loses shareable/bookmarkable URLs per route and the natural place to scope the `beforeunload` listener (route-mount lifecycle) — router is a better fit given D-06 requires "real layout shells" per route |
| Direct Chart.js (ported factory functions) | `react-chartjs-2` (`5.3.1`, confirmed React 19 peer-compatible) | `react-chartjs-2` reduces boilerplate for new charts, but the existing `chart-manager.js` factories are already written as imperative canvas functions — porting them into a thin `useEffect`-based wrapper is a smaller diff than re-authoring every chart as a `react-chartjs-2` component; revisit in Phase 2/3 if chart count grows a lot |
| `beforeunload` native event | A custom "dirty state" confirm dialog on route navigation (React Router's `useBlocker`) | D-18 only asks for the browser's native "leave/close" prompt, not in-app navigation blocking; `useBlocker` would additionally block clicking to Mapas/Variáveis, which is explicitly not requested and would fight D-19 ("Estatística remains usable standalone") |

**Installation:**
```bash
# Scaffold (run once, before any port work)
npm create vite@latest . -- --template react-ts

# Core framework (react-ts template already includes react/react-dom/vite/typescript)
npm install react-router-dom@^7

# Tailwind v4 + Vite plugin
npm install tailwindcss @tailwindcss/vite

# shadcn/ui init (after Tailwind is wired into vite.config.ts + index.css)
npx shadcn@latest init -t vite

# shadcn primitives used by this phase's shell (button, dialog/modal, tabs or nav menu, sheet for collapsible sidebar)
npx shadcn@latest add button dialog navigation-menu sheet badge

# cult-ui accents (register registry in components.json first — see Code Examples)
npx shadcn@latest add @cult-ui/<component-name>

# Existing charting engine — install as a real npm dep (was CDN +esm in v1.0)
npm install chart.js@^4.5

# Icons
npm install lucide-react
```

**Version verification note:** All `[VERIFIED: npm registry]` versions above were fetched live via `npm view <pkg> version` on 2026-07-25 (this research session), not carried over from training data or the milestone STACK.md without re-checking. They matched STACK.md's numbers exactly, confirming no drift in the ~0 days between milestone research and phase research.

## Package Legitimacy Audit

> `slopcheck` could not be installed in this sandboxed research session (package-install permission was denied — see Environment Availability). Per the graceful-degradation protocol, every newly-introduced package below is tagged `[ASSUMED]` rather than `[VERIFIED]`, even though each one's name/version was independently confirmed to exist on the npm registry via `npm view` (registry existence alone does not clear the slopsquat bar). The planner should insert a lightweight `checkpoint:human-verify` (a quick "does `npm install` succeed and does the package do what its README says" sanity check) before or immediately after the first install task — this is a low-risk set (all are top-tier, multi-year, extremely high-download packages already referenced by the milestone-level STACK.md), so a heavyweight manual audit is not warranted, just a non-zero verification step.

| Package | Registry | Age (approx.) | Downloads (approx., well-known) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `react` / `react-dom` | npm | 12+ yrs | 20M+/wk | github.com/facebook/react | not run — [ASSUMED] | Approved (already project-adjacent; core framework) |
| `vite` | npm | 6+ yrs | 15M+/wk | github.com/vitejs/vite | not run — [ASSUMED] | Approved (already the project's build tool) |
| `@vitejs/plugin-react` | npm | 6+ yrs | 5M+/wk | github.com/vitejs/vite-plugin-react | not run — [ASSUMED] | Approved |
| `tailwindcss` / `@tailwindcss/vite` | npm | 8+ yrs (v4 line: ~1 yr) | 10M+/wk | github.com/tailwindlabs/tailwindcss | not run — [ASSUMED] | Approved |
| `react-router-dom` | npm | 10+ yrs | 10M+/wk | github.com/remix-run/react-router | not run — [ASSUMED] | Approved |
| `chart.js` | npm | 10+ yrs | 4M+/wk | github.com/chartjs/Chart.js | not run — [ASSUMED] | Approved (already a project dependency) |
| `class-variance-authority` | npm | 3+ yrs | 2M+/wk | github.com/joe-bell/cva | not run — [ASSUMED] | Approved (standard shadcn dependency) |
| `clsx` | npm | 6+ yrs | 20M+/wk | github.com/lukeed/clsx | not run — [ASSUMED] | Approved |
| `tailwind-merge` | npm | 4+ yrs | 5M+/wk | github.com/dcastil/tailwind-merge | not run — [ASSUMED] | Approved |
| `lucide-react` | npm | 3+ yrs | 3M+/wk | github.com/lucide-icons/lucide | not run — [ASSUMED] | Approved |
| `shadcn` (CLI, not a runtime dep) | npm | actively maintained | high | github.com/shadcn-ui/ui | not run — [ASSUMED] | Approved (dev-time code generator only) |
| `@cult-ui/*` components (registry, not npm) | shadcn registry (cult-ui.com) | registry accepted into shadcn directory ~Oct 2025 per milestone STACK.md | n/a (source-copied, not installed as a dependency) | github.com/nolly-studio/cult-ui (per milestone research) | not applicable (not an npm install) | Approved with note: copied source, review each component's code on add since it's not a version-pinned dependency |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none — all packages are long-established, high-download, well-known libraries; the `[ASSUMED]` tags above reflect tooling unavailability in this sandbox, not any actual legitimacy concern.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Browser (single Vite-built bundle)                │
│                                                                       │
│  URL/route change                                                    │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  App Shell (React Router)                                     │   │
│  │  Header: Logo+nome | Estatística | Meta-análise | Variáveis   │   │
│  │          | Mapas   (D-01, no badge)                            │   │
│  └───────────────────────────┬────────────────────────────────────┘   │
│                               │ renders active route element          │
│         ┌─────────────────────┼─────────────────────┬───────────────┐ │
│         ▼                     ▼                     ▼               ▼ │
│  ┌─────────────┐     ┌──────────────┐      ┌───────────────┐ ┌─────────────┐
│  │ Estatística  │     │ Meta-análise │      │  Variáveis    │ │   Mapas     │
│  │ (interactive)│     │ (shell only) │      │  (shell only) │ │ (mock shell)│
│  │              │     │              │      │               │ │             │
│  │ sidebar:     │     │ "em breve"   │      │ "em breve"    │ │ static SVG  │
│  │  Teste demo  │     │ placeholder  │      │ placeholder   │ │ UF paths →  │
│  │  (+ roadmap) │     │              │      │               │ │ hover/click │
│  └──────┬───────┘     └──────────────┘      └───────────────┘ │ → variable  │
│         │ user pastes data                                    │   panel     │
│         ▼                                                      │ (mock JSON) │
│  ┌─────────────────────────────────────────┐                  └──────┬──────┘
│  │ Shared Data Flow (Dados→Configurar→      │                         │
│  │ Resultados) — UI-02                       │                        │ "Iniciar
│  │                                            │                       │  pesquisa"
│  │  [Dados] textarea/upload/DataSUS wizard ──┼─► useTabularInput()   │  → stub
│  │      │ auto-detect (D-10)                  │      or               │  modal
│  │      ▼                                     │  useDatasusWizard()   │  (D-24)
│  │  [Configurar] column preview/confirm ──────┼─► confirmed rows      │
│  │      │                                     │                       │
│  │      ▼                                     │                       │
│  │  [Resultados] demo stat + chart + PT text ─┼─► ChartCanvas +       │
│  │                                             │   useChartExport()   │
│  │                                             │   (UI-04) + interp   │
│  │                                             │   text slot (UI-06)  │
│  └─────────────────────────────────────────────┘                     │
│         │                                                              │
│         ▼ if data present, on tab close/refresh                        │
│  window.addEventListener('beforeunload', ...) — scoped to this route  │
│  only via useEffect mount/unmount (UI-05, D-18)                        │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  SessionProvider (React Context, in-memory only, no storage)   │    │
│  │  — last DataSUS wizard session, active nav state if needed     │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── main.tsx                       # ReactDOM.createRoot + RouterProvider + SessionProvider
├── app/
│   ├── router.tsx                 # createBrowserRouter: /, /meta-analise, /variaveis, /mapas
│   ├── AppShell.tsx                # <Header/> + <Outlet/>, mounts once
│   ├── Header.tsx                  # Logo+nome + 4 NavLinks (D-01), no version badge (D-02)
│   └── theme.css                   # @import "tailwindcss"; @theme { --color-teal-... } (dark+teal, D-16)
├── routes/
│   ├── estatistica/
│   │   ├── EstatisticaPage.tsx     # sidebar (collapsible, D-05) + active test panel
│   │   ├── Sidebar.tsx             # test registry list + "Qual teste usar?" button (UX-01)
│   │   ├── QualTesteModal.tsx      # decision tree + full roadmap + "em breve" chips (D-13/D-14)
│   │   └── demo/
│   │       ├── TesteDemo.tsx       # the didactic stub test (D-11)
│   │       └── demoData.ts         # sample dataset for the stub
│   ├── meta-analise/MetaAnalisePage.tsx   # real layout shell, "em breve" content (D-06)
│   ├── variaveis/VariaveisPage.tsx        # real layout shell, "em breve" content (D-06)
│   └── mapas/
│       ├── MapasPage.tsx           # panel layout: <BrazilMockMap/> + <VariablePanel/> + iniciar pesquisa
│       ├── BrazilMockMap.tsx       # inline SVG, 27 <path data-uf="SP" ...>, hover/click handlers
│       ├── VariablePanel.tsx       # intersection/partial variable list (D-20–D-23)
│       ├── IniciarPesquisaModal.tsx # stub flow (D-24), mock links + paste-into-modal
│       └── mockVariablesByUF.ts    # static mock: { SP: ['Óbitos', 'Internações', ...], ... }
├── features/tests/
│   └── registry.ts                 # [{ id, title, group, status: 'available'|'em-breve', Component? }]
│                                    # drives BOTH the sidebar list and the qual-teste modal roadmap
├── shared/
│   ├── data-input/
│   │   ├── parseTabular.ts         # ported from tabular-data-input.js (pure functions, unchanged)
│   │   ├── datasusImporter.ts      # ported from datasus-importer.js
│   │   ├── datasusNormalizer.ts    # ported from datasus-normalizer.js
│   │   ├── useTabularInput.ts      # hook: textarea/file → { rows, columns, errors, status }
│   │   └── useDatasusWizard.ts     # hook: wraps createDatasusWizard's *state machine* (not its DOM render)
│   ├── charts/
│   │   ├── chartTheme.ts           # COLORS + BASE_OPTS ported verbatim from chart-manager.js
│   │   ├── ChartCanvas.tsx         # <canvas> + useEffect Chart.js lifecycle (create/destroy on data change)
│   │   └── useChartExport.ts       # canvas.toDataURL() download, ported from exportCanvas()
│   ├── session/
│   │   └── SessionProvider.tsx     # React Context, in-memory only — replaces window.__LACIR_SHARED__
│   ├── hooks/
│   │   └── useLeaveWarning.ts      # beforeunload, mounted only inside EstatisticaPage, gated on "has data"
│   └── format.ts                   # fmtNumber/fmtSigned, ported verbatim from app.js Stats helpers
├── components/ui/                  # shadcn + cult-ui generated components (button, dialog, sheet, badge, ...)
└── lib/
    └── utils.ts                    # cn() = clsx + tailwind-merge (shadcn standard)
```

### Structure Rationale

- **`shared/data-input/*.ts` keeps the ported parsers as pure functions, not components:** `tabular-data-input.js` and `datasus-importer.js`/`datasus-normalizer.js` are already framework-agnostic (no DOM access except `DOMParser`/`DecompressionStream` for XLSX, which still work fine in a Vite/React bundle). Porting them means **copying the exported functions unchanged** into `.ts` files (adding types) and writing **new** thin hooks/components around them — not rewriting the parsing logic itself.
- **`useDatasusWizard` wraps the wizard's *state machine*, not its render function:** `createDatasusWizard` in `datasus-wizard.js` currently owns both state transitions (add source, reparse, confirm) *and* an `innerHTML` template renderer. The port should extract the state/reducer logic (source list, active source, mapping mutations, confirm) into a hook returning `{ sources, activeSource, actions }`, and write new JSX for every step (header-row picker, column-role table, etc.) — the 6-step wizard UI shape (`Passo 1..6`) is worth preserving as-is since it's already a validated UX.
- **`registry.ts` is the single source of truth for both the sidebar and the "qual teste?" modal:** D-14 requires the modal to show the "full roadmap" with "em breve" for unavailable tests — this must be the exact same list the sidebar renders (today `tests-manifest.json`; Phase 1 replaces it with a typed array so `status: 'available' | 'em-breve'` drives both UIs from one place, preventing drift between "what's in the sidebar" and "what the modal roadmap promises."
- **`routes/mapas/mockVariablesByUF.ts` is a hand-authored, small, static fixture — not fetched, not derived from `trabalhos datasus/build/*`:** Phase 1 explicitly stubs Mapas with mock data (D-24, roadmap Phase 1 success criteria #6); pointing it at the real catalog now would pull Phase 5 catalog-curation work forward for no phase-1 benefit. A ~10-entry-per-UF hardcoded object (a handful of plausible DataSUS variable names per state, with a couple of UFs deliberately missing a variable or two) is enough to drive the intersection/partial-alert UI (D-22) faithfully.
- **`useLeaveWarning` lives in `shared/hooks/` but is only ever called from `EstatisticaPage`:** this satisfies D-18's "only on Estatística" constraint through **call-site scoping** (the hook attaches/detaches its `beforeunload` listener in a `useEffect` cleanup tied to that route's mount lifecycle) rather than a global always-mounted listener with an `if (route === 'estatistica')` guard — simpler to reason about and impossible to accidentally leave attached on another route.

### Pattern 1: Static Test Registry Drives Sidebar + "Qual teste?" Roadmap (UX-01, D-14)

**What:** One typed array (`features/tests/registry.ts`) lists every planned test with an `id`, `title`, `group`, and `status` (`'available'` for the Phase 1 demo, `'em-breve'` for everything migrating in Phase 2/3). The Estatística sidebar renders it as a clickable list (only `available` items navigate); the "Qual teste usar?" modal renders the same array as its roadmap section, showing non-navigable "em breve" chips for the rest.
**When to use:** Any place that today reads `tests-manifest.json` — this pattern replaces the old runtime-fetched manifest entirely (per the milestone ARCHITECTURE.md's Anti-Pattern 1: a bundler can statically analyze this array for code-splitting, the old fetch-then-`import()` pattern solved a static-hosting problem that no longer exists).
**Example:**
```typescript
// src/features/tests/registry.ts
export type TestStatus = 'available' | 'em-breve';

export interface TestRegistryEntry {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  status: TestStatus;
}

export const TEST_REGISTRY: TestRegistryEntry[] = [
  { id: 'demo', title: 'Teste demo', subtitle: 'Prova de conceito do fluxo Dados→Configurar→Resultados', group: 'Demonstração', status: 'available' },
  { id: 't-student', title: 't de Student', subtitle: 'Comparação simples entre dois grupos', group: 'Comparação de médias', status: 'em-breve' },
  { id: 'correlacao', title: 'Correlação de Pearson / Spearman', subtitle: 'Relação entre duas variáveis', group: 'Associação', status: 'em-breve' },
  { id: 'prais-winsten', title: 'Prais-Winsten', subtitle: 'Tendência ao longo do tempo', group: 'Séries temporais', status: 'em-breve' },
  // ...remaining Phase 2/3 tests, all 'em-breve' until their migration phase ships
];
```

### Pattern 2: Shared Dados→Configurar→Resultados Step Shell (UI-02)

**What:** A small step-shell component (`<FlowSteps active={step}>`) wraps three named slots — Dados, Configurar, Resultados — and every "test" (the Phase 1 demo today, real tests later) renders its own content into those three slots via props/children, while the *shape* of navigation between steps (next/back, disabled-until-valid) lives in one place.
**When to use:** The demo stub now; every migrated/new test in Phases 2–3 reuses the identical shell, which is exactly why it must be extracted now rather than hardcoded into the demo alone.
**Example:**
```typescript
// src/shared/flow/FlowSteps.tsx
type FlowStep = 'dados' | 'configurar' | 'resultados';

export function FlowSteps({
  active,
  onStepChange,
  canAdvance,
  dados,
  configurar,
  resultados,
}: {
  active: FlowStep;
  onStepChange: (step: FlowStep) => void;
  canAdvance: Record<FlowStep, boolean>;
  dados: React.ReactNode;
  configurar: React.ReactNode;
  resultados: React.ReactNode;
}) {
  const steps: FlowStep[] = ['dados', 'configurar', 'resultados'];
  const content = { dados, configurar, resultados }[active];

  return (
    <div>
      <nav aria-label="Etapas">
        {steps.map((step) => (
          <button
            key={step}
            aria-current={step === active ? 'step' : undefined}
            disabled={step !== active && !canAdvance[step]}
            onClick={() => onStepChange(step)}
          >
            {step}
          </button>
        ))}
      </nav>
      <section>{content}</section>
    </div>
  );
}
```

### Pattern 3: Ported Paste/Parse Pipeline as a Hook (UI-03, D-08–D-10)

**What:** `useTabularInput()` owns raw text/file state, calls the ported `readTabularPasteState`/`readTabularFileState` functions (unchanged from `tabular-data-input.js`), and exposes `{ status: 'idle'|'loaded'|'error', headers, bodyRows, recognizedColumns, errors, setRawText, setFile }`. The auto-detect → preview → confirm flow (D-10) is just three renders of this same state: `idle` (paste box), `loaded` (preview table + confirm button), `error` (friendly message + details list, already produced by the ported `buildTabularRecognitionError`).
**When to use:** The demo stub's Dados step now; every test's Dados step in Phase 2+; also the DataSUS wizard's per-source parsing step (via the more aggressive `readWorkbookTablesFromFile`/`parseDatasusText` path).
**Example:**
```typescript
// src/shared/data-input/useTabularInput.ts
import { useState, useCallback } from 'react';
import { readTabularPasteState, readTabularFileState } from './parseTabular'; // ported, unchanged logic

export function useTabularInput(options: TabularInputOptions) {
  const [state, setState] = useState<TabularLoadState>({ status: 'idle' });

  const setRawText = useCallback((text: string) => {
    setState(text.trim() ? readTabularPasteState(text, statsAdapter, options) : { status: 'idle' });
  }, [options]);

  const setFile = useCallback(async (file: File) => {
    setState(await readTabularFileState(file, utilsAdapter, statsAdapter, options));
  }, [options]);

  return { ...state, setRawText, setFile };
}
```
*Note:* the ported functions expect a `utils`/`stats` object (originally the vanilla app's globals — `readFileText`, `escapeHtml`, `parseNumber`, `mean`, etc.). Phase 1 should extract just the handful of pure helpers the parsers actually call (`normalizeNumericSource`'s fallback, `readFileText`) into a tiny local adapter module rather than porting the entire legacy `Stats`/`utils` surface — most of `Stats` (t-tests, correlation) is out of scope until Phase 2.

### Pattern 4: Uniform Chart + PNG Export Hook (UI-04)

**What:** `ChartCanvas` renders a `<canvas>` and owns the Chart.js instance lifecycle (`new Chart()` on mount/data-change, `.destroy()` on unmount — directly mirroring the existing `registry`/`destroyChart` map in `chart-manager.js`, just keyed by React's component lifecycle instead of a manual `Map`). `useChartExport(canvasRef)` wraps the existing `exportCanvas()` (`canvas.toDataURL('image/png') `+ synthetic `<a download>` click) unchanged — it is already framework-agnostic browser code.
**When to use:** The demo stub's Resultados step chart now; every migrated test's chart in Phase 2+; Mapas' choropleth in Phase 4 (once real SVG/Chart.js output exists there too).
**Example:**
```typescript
// src/shared/charts/useChartExport.ts
export function useChartExport(canvasRef: React.RefObject<HTMLCanvasElement>) {
  return useCallback((filename = 'grafico-lacirstat.png') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png', 1.0);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [canvasRef]);
}
```

### Pattern 5: Route-Scoped `beforeunload` Guard (UI-05, D-17, D-18)

**What:** A hook that attaches `window.addEventListener('beforeunload', handler)` in a `useEffect`, re-evaluating a `hasData` boolean on every render, and removing the listener on cleanup. Because it's called only from `EstatisticaPage`, navigating to Meta-análise/Variáveis/Mapas naturally unmounts it — no persistent banner, no cross-route leakage, exactly D-17/D-18.
**Example:**
```typescript
// src/shared/hooks/useLeaveWarning.ts
export function useLeaveWarning(hasData: boolean) {
  useEffect(() => {
    if (!hasData) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ''; // required for Chrome; message text itself is browser-controlled
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasData]);
}
```
*Source: MDN `beforeunload` event — modern browsers ignore any custom string and show a generic native prompt; `event.preventDefault()` + setting `returnValue` is the current cross-browser-compatible trigger (Chrome requires `returnValue` to be set to a non-empty string or a truthy call to `preventDefault()`).*

### Pattern 6: Mapas Mock as Static SVG + Local Fixture (D-19–D-24)

**What:** `BrazilMockMap.tsx` renders one inline `<svg>` containing 27 `<path>` elements, each carrying a `data-uf="SP"` (or similar) attribute, wired to `onMouseEnter`/`onMouseLeave`/`onClick` handlers that call up to the page's selection state (`hoveredUF`, `selectedUFs: string[]`). `VariablePanel.tsx` reads `mockVariablesByUF.ts` (a hand-authored `Record<string, string[]>`) and computes: (a) single-UF hover → that UF's list; (b) multi-select → intersection first, then vars missing from *some* selected UFs with an alert line naming which UFs lack them (D-22).
**When to use:** Phase 1 only. Phase 4 replaces `mockVariablesByUF.ts` with the real curated catalog and (optionally) the SVG with a data-driven choropleth — but keeps the same `hoveredUF`/`selectedUFs`/`VariablePanel` contract, so this is not throwaway work.
**Sourcing the 27 UF paths (two viable options, in preference order):**
1. **Fetch once from IBGE's official Malhas API** (`https://servicodados.ibge.gov.br/api/v3/malhas/estados?formato=image/svg+xml&resolucao=1` or similar low-resolution query — HIGH confidence, official government source, free/CORS-enabled/no auth per milestone STACK.md's geodata section) and commit the resulting SVG as a static asset. IBGE's SVG output does not embed UF sigla by path — cross-reference the 27 paths (in IBGE numeric-code order) against a small hardcoded `IBGE_UF_CODES` table (27 entries: code → sigla/name) to attach `data-uf` attributes during a one-time manual/scripted post-process.
2. **Use a pre-labeled, MIT-licensed community SVG** such as `LucasBassetti/mapa-brasil-svg` (adaptation of `felipeduardo/mapa-brasil-svg`, MIT, `<path class="estado" name="..." code="...">` per state) — faster to integrate since sigla/name are already embedded, but independently verify the MIT license notice is preserved/attributed since it's third-party design work, not government open data.

**Do not** add `chartjs-chart-geo`/`topojson-client`/`d3-geo` in Phase 1 — no real geo data exists yet to justify the choropleth machinery; a static SVG with CSS `:hover`/`.selected` classes achieves the exact same UX for a mock.

### Anti-Patterns to Avoid

- **Reintroducing the runtime-fetched-manifest + validated dynamic `import()` pattern from `app.js`:** Vite/Rollup needs a static import graph for code-splitting; a `React.lazy(() => import('./demo'))` per registry entry is the bundler-native equivalent and needs a fraction of the code (no content-type sniffing, no cache-busting, no `AbortController` staleness guard — the bundler already solves the problem that complexity existed for).
- **Rewriting the paste/parse math instead of porting it:** `tabular-data-input.js`'s decimal-comma disambiguation (`normalizeNumericSource`) and `datasus-importer.js`'s header-candidate scoring are already tuned against real messy DataSUS/TABNET dumps — re-deriving this logic from scratch in React risks silently regressing D-09's "maximum tolerance" requirement. Copy the functions, add types, write new tests only for the new UI wiring.
- **Making the `beforeunload` listener global with a route-name `if` guard:** harder to verify "only on Estatística" holds after future refactors; scoping via the hook's own mount lifecycle inside `EstatisticaPage` makes the constraint structurally true instead of behaviorally hoped-for.
- **Wiring Mapas to `trabalhos datasus/build/catalogos/*` "since the data is already there":** that folder is scraper output with per-source schema drift (per milestone ARCHITECTURE.md Anti-Pattern 4) — Phase 1 explicitly wants a *mock*, and pointing at real-but-messy data now creates Phase-4-sized cleanup work with zero Phase-1 benefit.
- **Treating the "qual teste?" modal roadmap and the sidebar list as two separately-maintained lists:** D-14 requires them to agree on what's available vs. "em breve"; two lists will drift the first time a test ships. One `registry.ts` array, two renderers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delimiter/decimal-comma/mojibake-tolerant tabular parsing | A new regex-based CSV/TSV parser for React | Ported `tabular-data-input.js` functions (`splitDelimitedLine`, `normalizeNumericSource`, `detectDelimiter`) unchanged | Already handles quoted fields, structural-vs-decimal comma disambiguation, NFC/mojibake normalization — exactly the "maximum tolerance" (D-09) requirement, already battle-tested |
| DataSUS/TABNET header-row detection + column role classification | A simpler "first row is always header" assumption | Ported `datasus-importer.js` (`buildHeaderCandidates`, `profileColumn`, `detectProbableFormat`) | Real DataSUS exports have metadata rows before the header and mixed wide/long shapes; the scoring heuristic already handles this |
| XLSX file reading | A new npm dependency (e.g. `xlsx`/`sheetjs`) for a stub that mostly needs paste + CSV | The existing hand-rolled ZIP/XML XLSX reader in `tabular-data-input.js` (`unzipXlsxEntries`, `readWorkbookSheets`) — zero-dependency, browser-native (`DecompressionStream`) | Already works and ships zero new bytes; only worth replacing if XLSX edge cases surface in later phases |
| Chart.js instance lifecycle management in React | Manually calling `new Chart()`/`.destroy()` in ad hoc places across every test component | One `ChartCanvas` wrapper component with the create/destroy logic in a single `useEffect` | Chart.js instances leak canvas contexts if not destroyed on unmount/re-render; centralizing this once avoids per-test bugs |
| PNG export | `html2canvas` or a new screenshot library | `canvas.toDataURL('image/png')` (already how `chart-manager.js` does it) | Chart.js renders to a real `<canvas>`; no screenshot library is needed for canvas-based charts |
| "Which UF is the mouse over" hit-testing | Manual point-in-polygon math against raw coordinate arrays | Native SVG `<path>` elements + browser hit-testing via `onMouseEnter`/`onClick` on each path | The browser already does hit-testing for SVG shapes; hand-rolling this only makes sense once real polygon math (Phase 4 choropleth) is needed |

**Key insight:** every "hard part" of Phase 1 (parsing messy pasted data, XLSX reading, chart lifecycle, PNG export) already has a working, DataSUS-tuned implementation sitting in `assets/js/*` — the actual Phase 1 engineering risk is entirely in the **port mechanics** (turning imperative DOM-templating code into React components/hooks without changing behavior), not in solving any of these problems again.

## Common Pitfalls

### Pitfall 1: Porting the DataSUS wizard's render function instead of its state machine
**What goes wrong:** A naive port copies `createDatasusWizard`'s `render()` (which builds one giant `innerHTML` string with `data-action` attributes and re-attaches `addEventListener`s after every render) into a `dangerouslySetInnerHTML` React wrapper "to save time."
**Why it happens:** The existing code is a complete, working 6-step wizard UI — it's tempting to wrap it wholesale rather than re-express it in JSX.
**How to avoid:** Extract only `state` (sources, activeSourceId, mapping mutations) and the pure functions it calls (`reparseSource`, `setSourceNormalized`, `buildSession`) into a hook; write new JSX per step (`Passo 1`..`Passo 6`) that mirrors the existing copy/labels but uses React state/props instead of `data-action` delegated listeners. `dangerouslySetInnerHTML` also reintroduces the exact XSS surface the code currently manages manually via `utils.escapeHtml()` everywhere — React's default JSX escaping removes that entire class of bug for free once the port is done properly.
**Warning signs:** Any new file importing `escapeHtml` or building HTML template strings inside a `.tsx` file.

### Pitfall 2: `beforeunload` firing (or not firing) at the wrong time
**What goes wrong:** Either the prompt fires on every route (violates D-18 "only on Estatística"), or it never fires because the "has data" check reads stale state from a stale closure.
**Why it happens:** `beforeunload` handlers are notoriously closure-sensitive — if the effect's dependency array is wrong, the handler added on mount captures the `hasData` value *at mount time*, not the current value.
**How to avoid:** Re-run the effect (via `[hasData]` in the dependency array, as in Pattern 5) so the listener is removed and re-added whenever `hasData` changes, guaranteeing the closure is always current. Also verify manually that navigating away from Estatística to another header route does *not* trigger the prompt (only actual tab-close/refresh should, per the browser's native behavior — SPA route changes don't fire `beforeunload` at all, so this should work by construction, but confirm in manual testing since D-19 requires Mapas to be reachable without losing Estatística data).
**Warning signs:** The leave-prompt appearing when clicking a header nav link (should never happen — only real page unload triggers it), or not appearing after pasting data and closing the tab.

### Pitfall 3: Decimal-comma / semicolon parsing "improved" during the port
**What goes wrong:** Someone touches `normalizeNumericSource` or `detectDelimiter` while adding TypeScript types "for clarity" and subtly changes behavior (e.g. tightening a regex that was deliberately loose to catch messy DataSUS dumps).
**Why it happens:** Adding types to untyped code invites "cleanup" refactors; the existing heuristics look ad hoc (e.g. `structuralCommaCount`'s digit-adjacency check for pt-BR numbers like `1.234,56` vs CSV commas) but encode real-world tuning against actual TABNET output.
**How to avoid:** Port these specific functions with *type annotations added, logic untouched* — treat them as a black box with known-good behavior. If a genuine bug is found, fix it as a standalone, separately-reviewed change with new test cases from real pasted DataSUS text, not bundled into the React port.
**Warning signs:** A diff on `parseTabular.ts` that changes conditionals/regexes inside functions ported from `tabular-data-input.js`, without a corresponding new test case demonstrating the old behavior was wrong.

### Pitfall 4: Sidebar and "qual teste?" modal roadmap drifting apart
**What goes wrong:** The sidebar hardcodes its list of available tests separately from the modal's roadmap section, and the two silently disagree about what's "em breve" after the first Phase 2 test ships.
**Why it happens:** It's easy to build the sidebar first (needed for the demo to be reachable) and the modal second, each with its own inline array "just for now."
**How to avoid:** Build `features/tests/registry.ts` (Pattern 1) *before* either the sidebar or the modal, and make both consume it. Add a lightweight check (even just a code comment or a shared constant import) that both components import from the same registry.
**Warning signs:** Any test `id`/`title`/`status` string literal appearing in more than one component file.

### Pitfall 5: Tailwind v4 config drift from the discarded purple scaffold
**What goes wrong:** The new dark+teal theme accidentally inherits the old `brand: '#8B5CF6'` purple token because `tailwind.config.js` (JS-based, v3-style) is left in place alongside the new v4 CSS-first `@theme` block, and some component still references `bg-brand`.
**Why it happens:** `tailwind.config.js`/`postcss.config.js` currently exist at the repo root (scanning `./tests/**/*.js`, purple `brand` color) from a pre-decision scaffold that predates the dark+teal call (per milestone ARCHITECTURE.md: "leftover false start... should be treated as scaffolding to discard, not a foundation to build on").
**How to avoid:** Delete `tailwind.config.js` and `postcss.config.js` entirely as part of the Vite scaffold task (Tailwind v4 + `@tailwindcss/vite` needs neither); define teal tokens fresh in the new `@theme` CSS block (D-16, `~#10b981`) with no reference to the old `brand` name.
**Warning signs:** Any grep hit for `8B5CF6` or `brand-` classes surviving into the new `src/` tree.

### Pitfall 6: `chart.js` loaded from CDN import map instead of npm
**What goes wrong:** `index.html`'s current `<script type="importmap">` resolves `"chart.js"` to a jsDelivr CDN URL — if this importmap survives into the new Vite `index.html` (or is copy-pasted "just in case"), Vite's own bundling of the npm `chart.js` dependency can conflict with or be shadowed by the importmap's browser-native resolution.
**Why it happens:** The old `index.html` is the port's obvious starting point, and the importmap block is easy to overlook since it "just works" today.
**How to avoid:** Delete the `<script type="importmap">` block entirely; import `chart.js` normally (`import { Chart, ... } from 'chart.js'`) and let Vite bundle it from the `npm install chart.js` dependency, exactly as `package.json` already declares (`"chart.js": "^4.5.1"` is already a real dependency — only `chart-manager.js`'s internal `import ... from 'https://cdn.jsdelivr.net/...'` needs fixing to a bare specifier).
**Warning signs:** Any `import ... from 'https://cdn.jsdelivr.net/...'` surviving in ported `.ts`/`.tsx` files, or an importmap block in the new `index.html`.

## Code Examples

### Vite + Tailwind v4 config (no PostCSS boilerplate)
```typescript
// Source: ui.shadcn.com/docs/installation/vite (confirmed HIGH confidence, official docs, per milestone STACK.md)
// vite.config.ts
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

### Tailwind v4 CSS-first theme with teal accent (D-16)
```css
/* src/app/theme.css */
@import "tailwindcss";

@theme {
  --color-teal-accent: #10b981; /* clinical teal, D-16 — sample against logo before finalizing */
  --color-background: #0f1117;  /* keep dark palette continuity with chart-manager.js COLORS.background */
}
```

### Registering the `@cult-ui` registry in `components.json`
```jsonc
// Source: cult-ui.com/docs/installation + shadcn-ui/ui#8590 (per milestone STACK.md, HIGH confidence)
{
  "registries": {
    "@cult-ui": "https://cult-ui.com/r/{name}.json"
  }
}
```
```bash
npx shadcn@latest add @cult-ui/texture-card   # example accent component, per D-15 "balanced" use
```

### Header nav matching D-01 (no version badge; DataSUS link inside Estatística)
```tsx
// src/app/Header.tsx
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Estatística' },
  { to: '/meta-analise', label: 'Meta-análise' },
  { to: '/variaveis', label: 'Variáveis' },
  { to: '/mapas', label: 'Mapas' },
];

export function Header() {
  return (
    <header className="lacir-header">
      <a href="/" className="lacir-logo">
        <img src="/logo-lacir.png" alt="Logo LACIR" />
        <span>LACIR</span>
      </a>
      <nav aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      {/* No version badge (D-02). Portal DATASUS link lives inside the Estatística route (D-03), not here. */}
    </header>
  );
}
```

### `createBrowserRouter` for the 4 header routes
```tsx
// src/app/router.tsx
// Source: reactrouter.com data router docs (v7 stable API)
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { EstatisticaPage } from '../routes/estatistica/EstatisticaPage';
import { MetaAnalisePage } from '../routes/meta-analise/MetaAnalisePage';
import { VariaveisPage } from '../routes/variaveis/VariaveisPage';
import { MapasPage } from '../routes/mapas/MapasPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <EstatisticaPage /> },        // D-04: landing = Estatística
      { path: '/meta-analise', element: <MetaAnalisePage /> },
      { path: '/variaveis', element: <VariaveisPage /> },
      { path: '/mapas', element: <MapasPage /> },
    ],
  },
]);
```

### Multi-UF intersection + partial-alert logic (D-22)
```typescript
// src/routes/mapas/computeVariableIntersection.ts
export function computeVariableIntersection(
  selectedUFs: string[],
  variablesByUF: Record<string, string[]>
) {
  if (selectedUFs.length === 0) return { intersection: [], partial: [] };
  const lists = selectedUFs.map((uf) => new Set(variablesByUF[uf] ?? []));
  const [first, ...rest] = lists;
  const intersection = [...first].filter((v) => rest.every((set) => set.has(v)));
  const allVars = new Set(lists.flatMap((set) => [...set]));
  const partial = [...allVars]
    .filter((v) => !intersection.includes(v))
    .map((v) => ({
      variable: v,
      missingFrom: selectedUFs.filter((uf) => !(variablesByUF[uf] ?? []).includes(v)),
    }));
  return { intersection, partial }; // D-22: intersection first, partial vars listed with "não existe em ..." alert
}
```

## State of the Art

| Old Approach (v1.0, current repo) | Current Approach (Phase 1 target) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fetch('tests-manifest.json')` + validated dynamic `import()` | Static TS `registry.ts` array + `React.lazy` | This phase | Enables bundler code-splitting, type safety; removes cache-busting/content-sniffing complexity |
| `window.__LACIR_SHARED__` global object | React Context `SessionProvider` (in-memory) | This phase | Typed, scoped, no risk of naming collisions; behavior (in-memory only, cleared on refresh) is unchanged |
| Chart.js imported via CDN `+esm` in `chart-manager.js` and via `<script type="importmap">` in `index.html` | `npm install chart.js`, bare `import` specifiers, Vite-bundled | This phase | Removes runtime CDN dependency (matches project's "offline classroom" posture), consistent with `package.json` already listing it as a real dependency |
| `innerHTML` template strings + `utils.escapeHtml()` for XSS safety | JSX with default React escaping | This phase | Removes an entire manually-managed XSS-prevention surface; must not reintroduce via `dangerouslySetInnerHTML` (Pitfall 1) |
| Tailwind v3 `tailwind.config.js` (JS config, purple `brand`) | Tailwind v4 CSS-first `@theme` (teal tokens) | This phase | Config file deleted entirely, not migrated; new tokens authored fresh per D-16 |
| React Router (not used at all — v1.0 has no router) | React Router v7 `createBrowserRouter` | This phase | New capability — needed because D-06 requires "real layout shells" per header nav item, which a router expresses more naturally than manual state |

**Deprecated/outdated:**
- **Runtime dynamic `import()` with manual cache-busting:** no longer needed once Vite owns the bundle graph — see Anti-Patterns.
- **CDN-loaded Chart.js via `<script type="importmap">`:** superseded by a normal npm dependency + bundler import (Pitfall 6).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `typescript` latest stable resolves to the `5.9.x` line as of 2026-07-25 | Standard Stack | Low — any current TypeScript 5.x version is compatible with Vite's `react-ts` template; exact patch version has no behavioral impact on this phase's plan |
| A2 | `lucide-react`'s current version number (not independently pinned this session) | Standard Stack | Low — icon set choice/version has no functional impact on requirements; any recent version works with React 19 |
| A3 | IBGE's Malhas API SVG output for `/estados` does not embed UF sigla/name attributes by path, requiring a manual code→sigla crosswalk to label paths | Pattern 6 (Mapas mock sourcing) | Medium — if IBGE's SVG *does* embed usable identifying attributes (undocumented in the docs consulted), the crosswalk step described is unnecessary extra work, not a correctness risk; verify by actually fetching the endpoint during Wave 0 before committing to the crosswalk approach |
| A4 | `LucasBassetti/mapa-brasil-svg` (and its upstream `felipeduardo/mapa-brasil-svg`) is genuinely MIT-licensed and still fetchable at the cited GitHub location | Pattern 6 (Mapas mock sourcing, alternative option) | Low-Medium — license/repo could have changed since this research pass; re-verify the LICENSE file directly before using this SVG, or default to the IBGE-sourced option (A3) which has an unambiguous government open-data license |
| A5 | All packages in the Package Legitimacy Audit are legitimate despite `slopcheck` not running (sandboxed research session denied package install) | Package Legitimacy Audit | Low — every package listed is a long-established, extremely high-download, well-known library already referenced by the milestone-level STACK.md; the risk is procedural (audit step skipped) not substantive (no reason to suspect any of these names) |

**If this table is empty:** N/A — see entries above; none are HIGH risk.

## Open Questions

1. **Does IBGE's Malhas API SVG endpoint output paths in a stable, IBGE-numeric-code order that a hardcoded crosswalk can rely on?**
   - What we know: The endpoint exists, is free/CORS-enabled/documented (`servicodados.ibge.gov.br/api/v3/malhas/estados?formato=image/svg+xml`), and is the same source Phase 4 will use for the real TopoJSON.
   - What's unclear: Whether the returned SVG's `<path>` element order (or any embedded `id`/`data-*` attributes) reliably corresponds to a known UF-code ordering without visual inspection.
   - Recommendation: During Wave 0 of implementation, fetch the endpoint once, inspect the raw SVG in a browser/text editor, and decide between the IBGE-sourced + manual crosswalk approach vs. the pre-labeled community SVG (Pattern 6, option 2) based on which requires less manual verification work. This is a ~30-minute spike, not a planning blocker — either option satisfies D-20–D-24 equivalently.

2. **Exact list of shadcn primitives needed for the collapsible sidebar (D-05).**
   - What we know: shadcn ships a `Sheet` component (slide-over panel, commonly used for mobile nav) and does not ship a dedicated "collapsible sidebar" component out of the box; some shadcn example blocks (`sidebar-01` etc.) exist as copy-paste patterns rather than a single `add sidebar` command.
   - What's unclear: Whether shadcn's official `sidebar` block (if available in the current registry as of this research date) fits the MVP's existing collapsible-on-small-screens pattern well enough to adopt directly, or whether a simpler custom `<aside>` + Tailwind `w-0`/`w-64` transition is less code for this phase's scope (a handful of sidebar items, not a complex nested nav).
   - Recommendation: Planner should default to a small custom collapsible `<aside>` (CSS transition + a toggle button, following the existing MVP `.sidebar` pattern already proven in `assets/css/styles.css`) rather than adopting a full shadcn sidebar block, to avoid pulling in a heavier component than D-05 requires; revisit only if the custom version proves awkward for the "em breve" chip styling.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev server, npm installs | ✓ | v25.9.0 | — |
| npm | Package installs | ✓ | 11.12.1 | — |
| Network access to npm registry | `npm install` for all new deps | ✓ (confirmed via live `npm view` calls this session) | — | — |
| Network access to `servicodados.ibge.gov.br` | Fetching the Mapas mock SVG source (Pattern 6, option 1) | Not verified this session (sandboxed network is allowlist-based) | — | Use the community MIT SVG (Pattern 6, option 2) if the IBGE endpoint is unreachable from the dev machine at implementation time |
| `slopcheck` (pip package) | Package Legitimacy Audit automation | ✗ (install blocked by sandbox policy in this research session) | — | Manual audit performed instead (see Package Legitimacy Audit); planner should add a lightweight `checkpoint:human-verify` before first `npm install` batch |
| Existing `chart.js@^4.5.1` in `package.json` | Chart rendering, PNG export | ✓ (already declared) | 4.5.1 | — |

**Missing dependencies with no fallback:** none — every dependency needed for Phase 1 is either already available or has a documented fallback above.

**Missing dependencies with fallback:**
- IBGE Malhas API reachability (fallback: community SVG, Pattern 6 option 2).
- `slopcheck` automation (fallback: manual audit + human-verify checkpoint, already applied above).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently installed — repository has zero test files, zero test config (confirmed: no `*.test.*`/`*.spec.*` files, no `vitest.config.*`/`jest.config.*` found in the repo) |
| Config file | none — see Wave 0 Gaps |
| Quick run command | n/a until Wave 0 installs a framework |
| Full suite command | n/a until Wave 0 installs a framework |

**Recommendation:** Add `vitest` (Vite-native, zero extra config beyond `vite.config.ts`'s existing setup, `jsdom` environment for DOM-touching hooks) as the test runner for this phase, since it is the natural pairing with the Vite/React stack already being adopted and needs no separate bundler config. This is a **new tool for the project**, not previously used — flagging per Environment Availability discipline: `vitest` was not independently version-pinned via `npm view` in this session; the planner/Wave-0 task should confirm current version at install time.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Header renders 4 nav items with correct labels, no version badge | unit (RTL render) | `vitest run src/app/Header.test.tsx` | ❌ Wave 0 |
| UI-02 | `FlowSteps` renders correct slot content per active step and gates navigation via `canAdvance` | unit | `vitest run src/shared/flow/FlowSteps.test.tsx` | ❌ Wave 0 |
| UI-03 | `readTabularPasteState`/`parseDelimitedRows` correctly parse `;`-delimited, pt-BR decimal-comma sample text (ported logic, needs regression coverage in new suite) | unit | `vitest run src/shared/data-input/parseTabular.test.ts` | ❌ Wave 0 |
| UI-04 | `useChartExport` triggers a download with correct filename/dataURL call (mock `canvas.toDataURL`) | unit | `vitest run src/shared/charts/useChartExport.test.ts` | ❌ Wave 0 |
| UI-05 | `useLeaveWarning` attaches/removes `beforeunload` listener based on `hasData`; only mounted inside Estatística route | unit (renderHook) | `vitest run src/shared/hooks/useLeaveWarning.test.ts` | ❌ Wave 0 |
| UI-06 | Demo result renders a non-empty PT interpretation string | unit | `vitest run src/routes/estatistica/demo/TesteDemo.test.tsx` | ❌ Wave 0 |
| UX-01 | Modal renders full registry roadmap; "em breve" entries are non-interactive/non-navigable | unit (RTL render + click) | `vitest run src/routes/estatistica/QualTesteModal.test.tsx` | ❌ Wave 0 |
| (Mapas mock, roadmap success criterion #6) | Selecting 2+ UFs computes correct intersection/partial lists with "não existe em..." UFs named | unit | `vitest run src/routes/mapas/computeVariableIntersection.test.ts` | ❌ Wave 0 |

*Manual-only justification:* Full end-to-end "paste raw DataSUS TABNET dump → auto-detect → preview → confirm" (D-09/D-10) is best covered by a handful of unit tests against `parseTabular.ts`/`datasusImporter.ts` fed with real captured messy TABNET text samples (already implicitly available as the parsers were tuned against real dumps) rather than a browser-automation E2E test in Phase 1 — E2E/browser testing infrastructure does not exist in this repo yet and standing it up is disproportionate to a single phase's scope. PNG export's actual browser download behavior (UI-04) is also best spot-checked manually once (does a real PNG file appear with real chart content) since `canvas.toDataURL` in `jsdom` returns a stub value, not a real image.

### Sampling Rate
- **Per task commit:** `vitest run <changed-area>` (targeted, fast)
- **Per wave merge:** `vitest run` (full suite)
- **Phase gate:** Full suite green + one manual pass through all 6 roadmap success criteria before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install `vitest` + `@testing-library/react` + `jsdom` (or `happy-dom`) — no test framework exists in the repo today.
- [ ] `vitest.config.ts` (or extend `vite.config.ts` with a `test` block) — none exists.
- [ ] `src/test/setup.ts` — RTL `jest-dom` matchers, any global mocks (e.g. `HTMLCanvasElement.prototype.getContext` stub for Chart.js in `jsdom`, since `jsdom` has no real canvas rendering).
- [ ] A fixture file with 2–3 real messy pasted DataSUS/TABNET text samples (captured from actual TabNet exports) to regression-test the ported parser against, since "maximum tolerance" (D-09) is best verified against real messy input, not synthetic clean CSV.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Out of scope — explicit client-only milestone, no accounts (`.planning/REQUIREMENTS.md` Out of Scope) |
| V3 Session Management | No | No server session; in-memory React Context only, cleared on refresh by design |
| V4 Access Control | No | No roles/permissions — single-user local tool |
| V5 Input Validation | Yes | React's default JSX escaping (no `dangerouslySetInnerHTML`) for all rendered pasted/parsed content; the ported parsers already produce plain strings/numbers, never HTML, so no sanitizer library is needed as long as the port avoids reintroducing `innerHTML` (see Pitfall 1) |
| V6 Cryptography | No | No secrets, no crypto operations anywhere in this client-only app |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected/stored XSS via pasted DataSUS text rendered into the UI | Tampering / Information Disclosure | Render all parsed cell values, headers, and error messages as React children/text (default JSX escaping) — never via `dangerouslySetInnerHTML` or manually built `innerHTML` strings, even though the ported vanilla-JS code used manual `utils.escapeHtml()` for this purpose; React makes the entire escaping step automatic and mandatory-by-default, which is strictly safer than porting the manual escaping calls |
| Malicious/malformed XLSX file crashing or hanging the parser | Denial of Service (client-side) | The ported `unzipXlsxEntries`/`readWorkbookSheets` already wrap parsing in `try/catch` at the call site (`readTabularFileState`) and return a friendly error state rather than throwing uncaught — preserve this error-boundary behavior in the port; do not let a parse exception crash the whole Estatística route (wrap the hook's file-processing call site in its own try/catch, since React error boundaries alone won't catch async errors inside event handlers) |
| Third-party `@cult-ui` registry source code (copied, not version-pinned like a normal dependency) containing unexpected behavior | Tampering (supply chain) | Since `shadcn add @cult-ui/<name>` copies source directly into the repo (not an npm dependency resolved by lockfile hash), review each cult-ui component's copied source once at add-time before committing, same as any other pasted/generated code — this is a lighter-weight version of the Package Legitimacy Audit concern, appropriate given cult-ui components are UI-only (no network calls, no data handling) |

<sources>
## Sources

### Primary (HIGH confidence)
- `npm view react/react-dom/vite/@vitejs/plugin-react/tailwindcss/@tailwindcss/vite/react-router-dom/chart.js/class-variance-authority/clsx/tailwind-merge version` — live npm registry queries run in this research session, 2026-07-25 (all versions independently re-confirmed, matching `.planning/research/STACK.md`).
- Direct repository read: `assets/js/tabular-data-input.js`, `assets/js/datasus-importer.js`, `assets/js/datasus-normalizer.js`, `assets/js/datasus-wizard.js`, `assets/js/chart-manager.js`, `package.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `tests-manifest.json` — all read in full during this research pass.
- `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/SUMMARY.md` — milestone-level research (dated same day, HIGH confidence, reused per instructions rather than re-derived).
- `servicodados.ibge.gov.br/api/docs/malhas?versao=3` and `brazilvisible.org` IBGE Geociências writeup — official Malhas API endpoint shape (`/estados`, `formato=image/svg+xml`, `resolucao` param), confirmed via WebSearch synthesis of official docs.
- `npm view react-chartjs-2 version peerDependencies` — confirmed `5.3.1` with React 19 in the peer-dependency range (`^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`), live registry query.

### Secondary (MEDIUM confidence)
- `github.com/LucasBassetti/mapa-brasil-svg` (via WebSearch + GitHub metadata fetch) — MIT-licensed, per-UF `<path>` SVG with sigla/name/code attributes already embedded; repo confirmed to exist with the stated license and file structure was not independently re-verified byte-for-byte in this session (raw file fetch 404'd on the guessed path; repo page itself confirmed reachable).
- MDN `beforeunload` event semantics (Chrome requiring `returnValue`/`preventDefault()`) — general web-platform knowledge, consistent with widely documented cross-browser behavior, not re-fetched from MDN directly this session.

### Tertiary (LOW confidence - needs validation)
- `lucide-react` current exact version — not independently queried this session (deprioritized as non-critical); confirm at implementation time.
- Whether IBGE's Malhas SVG endpoint path order/attributes are directly usable without a manual crosswalk (Open Question 1) — inferred from API docs describing available *parameters*, not from an actual fetched sample of the SVG response body.
</sources>

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every core version independently re-verified against the live npm registry this session, matching milestone research exactly.
- Architecture: HIGH for the data-input/chart/session port patterns (grounded in direct reads of the actual existing source files being ported); MEDIUM for the Mapas mock sourcing specifics (no live SVG fetch performed, sourcing options documented but not hands-on verified).
- Pitfalls: HIGH — every pitfall is grounded either in a direct read of the existing code being ported (Pitfalls 1, 3, 5, 6) or in a well-documented web-platform behavior (Pitfall 2).
- Code examples: HIGH for scaffold/routing/hook patterns (standard, well-documented APIs); MEDIUM for the exact `useDatasusWizard`/`useTabularInput` adapter shape, since the legacy `utils`/`stats` object surface those functions depend on will need a small compatibility shim not yet written.

**Research date:** 2026-07-25
**Valid until:** 2026-08-24 (30 days — core stack (React/Vite/Tailwind/shadcn) is stable; re-verify versions if planning is delayed past this window, especially `cult-ui` registry component names which change faster than the core framework)

---

*Phase: 01-redesign-base-react-shell*
*Research completed: 2026-07-25*
*Ready for planning: yes*
