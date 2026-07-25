# Phase 2: Migrar testes existentes - Research

**Researched:** 2026-07-25
**Domain:** Port three validated v1.0 statistical test modules into the Phase 1 React shell with numeric/interpretation parity and deep Chart.js customization
**Confidence:** HIGH (shell integration + t-student oracle exports); MEDIUM (correlacao/prais-winsten export surface + chart customizer scope)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Shell fit & Configurar
- **D-01:** Each migrated test uses the **shared FlowSteps shell** (Dados → Configurar → Resultados) and reusable results pattern (`ResultsPanel` / interpretation / PNG) — not a 1:1 recreation of legacy page chrome from `tests/*/module.js`.
- **D-02:** **Configurar ships full legacy knobs** that affect the analysis: α (1%/5%/10%), research question text, mode/method toggles, and DataSUS derive options (period, procedures, etc.) as exposed in v1.0.
- **D-03:** Keep **didactic cards** (from each `config.json`) visible in Configurar as collapsible teaching content, and **“Usar exemplo”** on Dados to pre-fill the paste box from legacy example/templates.

#### Charts (migrated tests only)
- **D-04:** Migrated tests get a **deep chart customization** experience in Resultados: multiple professional chart types, axes, annotations, and themes beyond brand defaults — not only “same v1.0 chart kind + teal.”
- **D-05:** Plotted **values** must remain statistically correct; visual layout may diverge from v1.0 SVG/Chart.js layouts.
- **D-06:** **Teste demo stays simple** — basic chart + PNG only. Full chart power is for migrated (and later) real tests, not the demo tour.

#### Parity bar
- **D-07:** “Matches v1.0” means **display-rounded numbers + Portuguese interpretation** (same significance call and key stats). Charts need not twin v1.0 visually.
- **D-08:** Automated numeric checks compare **as shown in the UI** (e.g. p / r / t / ICs at display precision), not raw full-precision floats.
- **D-09:** Fixtures per test: legacy **Usar exemplo / template CSV** plus **one TABNET-style** case where the v1.0 module supports DataSUS. Differential tests against **untouched** `tests/*/module.js` exports.
- **D-10:** Interpretation wording may be **lightly cleaned** for the new shell; must not change the conclusion or omit key numbers. Not byte-identical required.

#### t de Student
- **D-11:** Single `TEST_REGISTRY` entry `t-student` (“t de Student”). **Independiente vs pareado** chosen via Configurar choice cards (legacy guided pattern).
- **D-12:** Default mode = **t independente**.
- **D-13:** Switching mode **keeps pasted data**; clears mode-specific Configurar fields and results so settings do not mix.
- **D-14:** Independent path labeled **“t independente (Welch)”**; always Welch under the hood. No equal-variance Student toggle in Phase 2.

#### Teste demo & landing
- **D-15:** Keep **Teste demo** available under Demonstração after real tests ship (flow tour; no significance claim).
- **D-16:** Estatística **lands on Teste demo** by default.
- **D-17:** In “Qual teste usar?”, demo remains listed and navigable, clearly labeled as **demonstração** (not a real significance test). Real tests flip from `em-breve` → `available`.

### Claude's Discretion
- **Correlação:** Keep one registry entry with Pearson/Spearman method control in Configurar (matches v1.0 title/`TEST_REGISTRY`); mirror t-Student soft-reset behavior when method changes if needed.
- **Prais-Winsten:** Port full legacy knobs/series UX into Configurar within the shared shell; exact layout of series preview is planner/implementer choice.
- Chart library/stack for the deep customize surface (extend Chart.js vs additional lib) — choose for professionalism + maintainability; stay client-side.
- Exact metric-card set and default chart per test — prefer v1.0 defaults as starting presets inside the customizer.
- Whether `derive*` helpers in `datasusNormalizer.ts` become the sole engine path or wrap ported pure functions from `tests/*/module.js` — researcher/planner decide, with differential parity as the gate.

### Deferred Ideas (OUT OF SCOPE)
- Equal-variance (classic) Student toggle — deferred; Phase 2 is Welch-only for independent
- JASP as mandatory second oracle for acceptance — deferred; optional dispute tool only
- Broad edge-case fixture library beyond example + one TABNET case — can grow in Phase 3+
- Removing or hiding Teste demo — rejected for this phase
- New statistical tests (qui-quadrado, ANOVA, GLM, etc.) — **Phase 3**
- Full Mapas catalog/geo — **Phase 4**
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | User can run t de Student in the new shell with parity to v1.0 outputs | `tests/t-student/module.js` exports `safeWelch`, `safePaired`, interpretation builders; `module-guided.js` for mode cards + DataSUS derive; port pattern = TesteDemo + differential parity vs legacy exports |
| TEST-02 | User can run Correlação Pearson/Spearman in the new shell with parity to v1.0 outputs | Numeric core = `Stats.pearson` / `Stats.spearman` in `assets/js/app.js`; dataset builder + interpretation in `tests/correlacao/module.js`; scatter/rank charts in `chart-manager.js` |
| TEST-03 | User can run Prais-Winsten in the new shell with parity to v1.0 outputs | Numeric core = `Stats.praisWinsten` in `assets/js/app.js`; series parsing in `tests/prais-winsten/module.js`; trend/residual charts in `chart-manager.js`; `derivePraisSeries` in `datasusNormalizer.ts` for TABNET path |
</phase_requirements>

## Summary

Phase 2 is a **logic port + React wiring** phase, not a statistics reinvention phase. Phase 1 already delivered the shared shell (`FlowSteps`, `TabularInputPanel`, `ResultsPanel`, `ChartCanvas`, `useChartExport`, registry, session) and byte-for-byte data-input ports with differential parity tests. What remains is to mount three real test modules on that shell, flip registry status to `available`, and prove numeric/interpretation parity against the untouched v1.0 engines.

The migration surface is asymmetric across the three tests. **t de Student** is the best-prepared oracle: `tests/t-student/module.js` exports ~20 pure functions (`safeWelch`, `safePaired`, `buildManualInterpretation`, DataSUS derive helpers, etc.) and `module-guided.js` holds the independent/paired UX contract. **Correlação** and **Prais-Winsten** only export `renderTestModule` — their compute paths call the monolithic `Stats` object inside `assets/js/app.js` (not exported) plus large internal dataset/interpretation builders. Phase 2 must therefore **port the full `Stats` engine surface** into `src/shared/stats/` (same discipline as Phase 1's parser ports) and add Wave 0 differential suites that compare TS ports against legacy call sites, while using t-student's existing exports as the primary oracle where available.

Charts are a deliberate upgrade for migrated tests (D-04): extend the existing Chart.js 4.5 stack with a `ChartCustomizer` panel (type presets, axis titles, annotation toggles, theme variants) backed by ported chart factories from `assets/js/chart-manager.js`. Demo stays on the simple `ResultsPanel` path (D-06). Parity gates apply to **plotted values and display-rounded metrics**, not pixel layout (D-05, D-07, D-08).

**Primary recommendation:** Wave 0 ports `Stats` + chart factories + parity fixtures; Wave 1 ships t-Student (richest export oracle); Waves 2–3 ship Correlação and Prais-Winsten; each wave ends with registry flip + EstatisticaPage route mount + differential + RTL smoke tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Paste / TABNET ingest | Browser (shared data-input) | — | Already ported in Phase 1; tests only supply per-test `TabularInputOptions` |
| DataSUS wizard derive (TABNET fixtures) | Browser (`datasusNormalizer.ts` derive*) | Legacy `datasus-normalizer.js` oracle | Derive functions exist in TS but numerically unverified; parity gate before UI wiring |
| Statistical computation (t, r, Prais) | Browser (`src/shared/stats/statsEngine.ts`) | Legacy `assets/js/app.js` Stats + `tests/t-student/module.js` exports | 100% client-side; no backend |
| Interpretation prose (PT) | Browser (per-test `*Interpretation.ts`) | Legacy builders in `tests/*/module.js` | Plain strings into `InterpretationText`; no HTML injection |
| Chart rendering + PNG | Browser (`ChartCanvas` + factories + customizer) | Legacy `chart-manager.js` | Canvas lifecycle already in React; factories port verbatim |
| Test selection / routing | Browser (`EstatisticaPage` + `TEST_REGISTRY`) | — | Static import per test id; no dynamic manifest fetch |
| Session / leave warning | Browser (`SessionProvider`) | — | Unchanged from Phase 1; tests publish `setDataset` on confirm |
| Mapas → Estatística handoff | Browser (router + session) | — | `IniciarPesquisaModal` navigates to `/` with pasted data; cold start still lands on demo (D-16) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.8 [VERIFIED: npm registry] | Test module UI (FlowSteps wiring) | Already scaffolded; Phase 1 pattern |
| Chart.js | 4.5.1 [VERIFIED: npm registry] | Result charts + PNG source canvas | Validated v1.0 engine; `ChartCanvas` already registers controllers |
| `src/shared/stats/statsEngine.ts` | in-repo | Full port of `assets/js/app.js` `Stats` (pearson, spearman, rank, tcdf, praisWinsten, welch helpers) | Phase 1 only ported `parseNumber`/`mean`; Phase 2 tests need the rest — do not add jstat for these three tests |
| Legacy module exports | v1.0 paths | Parity oracle | `tests/t-student/module.js` exports; correlacao/prais internal builders compared via ported Stats + fixture outputs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chartjs-plugin-annotation` | 3.1.0 [ASSUMED: npm registry — slopcheck unavailable] | Reference lines (regression, CI bands, residual zero-line), point labels in deep customize | Migrated tests Resultados only (D-04) |
| `src/shared/format.ts` | in-repo | `fmtNumber`, `fmtP`, `fmtSigned` for display parity (D-08) | All metric cards + interpretation numeric inserts |
| Vitest + RTL | ^4.1.10 / ^16.3.2 [VERIFIED: package.json] | Differential parity + component smoke | Same harness as Phase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend Chart.js + annotation plugin | Recharts / Plotly / D3-only | Second chart stack violates Phase 1 investment; Chart.js already powers v1.0 chart-manager factories |
| Port full `Stats` to TS | Import `assets/js/app.js` at runtime | `app.js` does not export `Stats`; bundling the whole loader module pulls unrelated manifest/bootstrap code into tests |
| `react-chartjs-2` | Current `ChartCanvas` useEffect wrapper | Phase 1 deliberately chose thin wrapper over react-chartjs-2; customizer state maps cleanly to `options` prop updates |
| Re-parse inside each test module | Shared `useTabularInput` + per-test options | Phase 1 established single parse path; duplicating parse logic breaks D-09 parity |

**Installation (Phase 2 additions only):**

```bash
npm install chartjs-plugin-annotation@^3.1.0
```

**Version verification (2026-07-25 session):**

```bash
npm view chart.js version          # 4.5.1
npm view chartjs-plugin-annotation version  # 3.1.0
```

## Package Legitimacy Audit

> slopcheck was unavailable at research time — all packages tagged `[ASSUMED]`; planner must gate install behind `checkpoint:human-verify`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `chart.js` | npm | 10+ yrs | 4M+/wk | github.com/chartjs/Chart.js | not run | Approved (already installed) |
| `chartjs-plugin-annotation` | npm | 8+ yrs | 1M+/wk | github.com/chartjs/chartjs-plugin-annotation | not run [ASSUMED] | Approved with human-verify checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not run)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────── EstatisticaPage ─────────────────────────────────────┐
│ Sidebar / QualTesteModal ──► TEST_REGISTRY (status flip Phase 2)    │
│         │                                                             │
│         ▼ activeTestId                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  TesteDemo   │  │ TStudentTest │  │ Correlacao.. │  ...            │
│  │  (simple)    │  │ PraisWinsten │  │              │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                  │                  │                       │
│         └──────────────────┼──────────────────┘                       │
│                            ▼                                          │
│                     FlowSteps (Dados→Configurar→Resultados)           │
│                            │                                          │
│     Dados ◄── useTabularInput / DatasusWizardPanel / Usar exemplo    │
│     Configurar ◄── didactic cards + α + mode/method + DataSUS knobs  │
│     Resultados ◄── ResultsPanel + ChartCustomizer (migrated only)    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  parseTabular.ts    statsEngine.ts      chartFactories/*
  datasusNormalizer  *Interpretation.ts  ChartCanvas + annotation plugin
         │                   │                   │
         └───────── differential parity vs legacy module.js / app.js Stats
```

### Recommended Project Structure

```
src/
├── features/tests/
│   ├── registry.ts                    # flip t-student, correlacao, prais-winsten → available
│   ├── shared/
│   │   ├── DidacticCards.tsx          # collapsible cards from config.json
│   │   ├── AlphaSelector.tsx          # 1% / 5% / 10%
│   │   └── ResearchQuestionField.tsx
│   ├── t-student/
│   │   ├── TStudentTest.tsx           # FlowSteps orchestrator (mirror TesteDemo)
│   │   ├── tStudentConfig.ts          # TABULAR_OPTIONS, aliases from module-guided
│   │   ├── tStudentEngine.ts          # wraps safeWelch/safePaired + mode switch
│   │   ├── tStudentInterpretation.ts  # port buildManualInterpretation / guided variants
│   │   ├── tStudentCharts.ts          # chart presets + customizer schema
│   │   └── tStudentEngine.test.ts     # differential vs tests/t-student/module.js
│   ├── correlacao/
│   │   ├── CorrelacaoTest.tsx
│   │   ├── correlacaoConfig.ts
│   │   ├── correlacaoEngine.ts        # dataset build + statsEngine.pearson/spearman
│   │   ├── correlacaoInterpretation.ts
│   │   ├── correlacaoCharts.ts
│   │   └── correlacaoEngine.test.ts
│   └── prais-winsten/
│       ├── PraisWinstenTest.tsx
│       ├── praisConfig.ts
│       ├── praisEngine.ts             # parseTemporalValue + statsEngine.praisWinsten
│       ├── praisInterpretation.ts
│       ├── praisCharts.ts
│       └── praisEngine.test.ts
├── shared/
│   ├── stats/
│   │   ├── statsEngine.ts             # full Stats port from app.js
│   │   └── statsEngine.test.ts        # differential vs legacy (via t-student imports + fixtures)
│   └── charts/
│       ├── chartFactories/            # ports of chart-manager render* functions
│       │   ├── scatterChart.ts
│       │   ├── timeseriesChart.ts
│       │   ├── tStudentCharts.ts
│       │   └── residualChart.ts
│       ├── ChartCustomizer.tsx        # deep customize UI (migrated tests only)
│       └── chartAnnotationSetup.ts    # register chartjs-plugin-annotation once
└── routes/estatistica/
    └── EstatisticaPage.tsx            # switch on activeTestId → mount test components
```

### Pattern 1: Test module orchestrator (copy TesteDemo)

**What:** Each migrated test is a self-contained React component owning FlowSteps state (`activeStep`, `loadedInput`, `confirmedDataset`, config knobs). It uses shared input hooks and mounts `ResultsPanel` in Resultados.

**When to use:** All three migrated tests (D-01).

**Example:**

```tsx
// Pattern source: src/routes/estatistica/demo/TesteDemo.tsx
// Planner task: clone structure; replace demoStats with tStudentEngine output
<FlowSteps
  active={activeStep}
  onStepChange={setActiveStep}
  canAdvance={canAdvance}
  dados={/* TabularInputPanel + Usar exemplo + optional Datasus tab */}
  configurar={/* ColumnPreviewTable + didactic cards + mode/method + α + question */}
  resultados={
    <ResultsPanel
      title="..."
      metrics={engineOutput.metrics}
      chart={customizerChartProps}
      interpretation={engineOutput.interpretationParagraphs}
      exportFilename="t-student-lacirstat.png"
      actions={<ClearDataButton onCleared={handleClearData} />}
    />
  }
/>
```

### Pattern 2: Differential parity tests (extend Phase 1)

**What:** Vitest imports untouched legacy JS and asserts TS port returns identical structures for shared fixtures. Use `toEqual` on display-rounded snapshots where D-08 requires UI precision.

**When to use:** Wave 0 for `statsEngine.ts`; each test engine module before UI ship (D-09).

**Example:**

```typescript
// Pattern source: src/shared/data-input/parseTabular.test.ts
import * as legacy from '../../../tests/t-student/module.js';
import { runIndependentWelch } from './tStudentEngine';

it('matches legacy safeWelch for exemplo fixture', () => {
  const { g1, g2 } = legacy.parseDataset(EXAMPLE_TEXT, legacyStats);
  expect(runIndependentWelch(g1, g2)).toEqual(legacy.safeWelch(g1, g2, legacyStats));
});
```

### Pattern 3: Mode/method soft reset (t-Student + Correlação)

**What:** Changing independent↔paired or Pearson↔Spearman keeps `loadedInput` / pasted text but clears mode-specific Configurar selections and nulls `confirmedDataset` + results (D-13).

**When to use:** t-Student mode cards (D-11–D-14); Correlação method toggle (Claude's discretion).

### Pattern 4: ChartCustomizer on migrated tests only

**What:** `ResultsPanel` accepts chart props from a `useChartCustomizer(presets)` hook. Presets encode v1.0 default chart kinds per test; user overrides merge into `ChartOptions` via existing `mergeChartOptions`. Register `chartjs-plugin-annotation` once at module scope (same pattern as `ChartCanvas` controller registration).

**When to use:** t-Student, Correlação, Prais-Winsten Resultados (D-04); **not** TesteDemo (D-06).

**Default presets (starting point — Claude's discretion on exact set):**

| Test | v1.0 default | Additional customize types |
|------|--------------|----------------------------|
| t-Student | Group distribution + mean/CI diff (`renderTStudentDistChart`, `renderTStudentDiffChart`) | Box-style scatter jitter, bar of means, annotation toggles for CI |
| Correlação | Pearson scatter + Spearman rank scatter | Line fit overlay, outlier highlight, axis label edit, grid density |
| Prais-Winsten | Observed + fitted timeseries + residual bar | Line vs scatter points, log axis toggle (if data support), zero-line annotation |

### Pattern 5: Registry + route mount

**What:** Flip `status: 'available'` in `TEST_REGISTRY` for the three ids; extend `EstatisticaPage` static switch (currently demo-only) to render `TStudentTest`, `CorrelacaoTest`, `PraisWinstenTest`. Qual teste modal and Mapas suggestions auto-unlock via existing `isTestAvailable` checks.

**When to use:** Final task of each test wave (D-17).

### Anti-Patterns to Avoid

- **Rebuilding legacy page chrome:** Full-width legacy callout grids, innerHTML metric cards, and `#lacir-test-module-mount` imperative wiring — replace with FlowSteps + ResultsPanel (D-01).
- **Duplicating parse logic:** t-student's `parseDataset` in module.js overlaps tabular parser — prefer `useTabularInput` + test-specific options from `module-guided.js` constants; use legacy `parseDataset` only as parity oracle, not production path.
- **Equal-variance Student toggle:** Explicitly deferred (D-14).
- **Pixel-diff chart parity:** Do not block Phase 2 on matching v1.0 SVG layout (D-05, D-07).
- **Importing all of `app.js`:** Pulls manifest loader; port Stats slice only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| t / Fisher CI / beta CDF | Custom approximations | Port existing `Stats.tcdf`, `Stats.fisherCI`, `Stats.tInv` from `app.js` | Numerical edge cases already tuned in v1.0 |
| Prais-Winsten iteration | New estimator | Port `Stats.praisWinsten` + `olsTransformed` + `estimateRho` verbatim | Validated against capacitação outputs |
| Pearson / Spearman | `@stdlib` or jstat for Phase 2 | Port `Stats.pearson`, `Stats.rank`, `Stats.spearman` | Same formulas v1.0 modules call in `runAnalysis` |
| PNG export | html2canvas | Existing `useChartExport` → `canvas.toDataURL` | Chart.js renders real canvas (Phase 1) |
| XLSX parsing | `xlsx` npm package | Existing `parseTabular` XLSX reader | Zero-dep v1.0 path preserved |
| Chart instance lifecycle | Global Map registry | `ChartCanvas` destroy-on-change | Phase 1 decision; prevents leaks |
| Test sidebar/modal lists | Duplicate arrays | `TEST_REGISTRY` single source | Phase 1 Pitfall 4 |

**Key insight:** Phase 2 risk is integration and port fidelity, not statistical invention — PROJECT.md and ROADMAP lock "reuse JASP/MVP engines."

## Common Pitfalls

### Pitfall 1: Under-scoped Stats port

**What goes wrong:** Engines call `stats.sd`, `stats.tcdf`, `stats.pearson`, etc., but Phase 1 `legacyAdapters.ts` only exposes `parseNumber` and `mean`.

**Why it happens:** Phase 1 intentionally minimized the adapter surface.

**How to avoid:** Wave 0 creates `statsEngine.ts` porting the full `Stats` object from `assets/js/app.js:240-533` with differential tests before any test UI.

**Warning signs:** Runtime `stats.sd is not a function` or silent NaN p-values.

### Pitfall 2: correlacao/prais-winsten lack exported oracles

**What goes wrong:** D-09 says differential vs `tests/*/module.js` exports, but only `renderTestModule` is exported for two of three tests.

**Why it happens:** Legacy modules bundle UI + engine in one file.

**How to avoid:** Primary oracle = ported `statsEngine` vs legacy behavior on shared fixtures; secondary = add **non-behavior-changing** named exports to legacy files only if needed for parity tests (export existing functions without logic edits). Prefer Stats-level parity + copied fixture expected outputs over exporting 2000-line UI modules.

**Warning signs:** No automated numeric gate for TEST-02/TEST-03.

### Pitfall 3: derive* functions trusted without verification

**What goes wrong:** DataSUS TABNET fixtures produce wrong group vectors; UI parity fails despite paste path working.

**Why it happens:** Phase 1 ported `deriveIndependentTTest`, `derivePairedTTest`, `deriveCorrelationPairs`, `derivePraisSeries` as typed but **numerically unverified** (STATE.md).

**How to avoid:** Wave 0 parity suite: TS derive* vs `assets/js/datasus-normalizer.js` on one TABNET fixture per test before wiring Configurar DataSUS knobs.

**Warning signs:** Manual example passes; TABNET case diverges.

### Pitfall 4: Mode switch contaminates Configurar state

**What goes wrong:** Paired t-test runs with independent-group derive selections still set.

**Why it happens:** Shared Configurar state object not partitioned by mode.

**How to avoid:** Implement D-13 soft reset: preserve paste text, reset mode-specific slice + `confirmedDataset` + results.

**Warning signs:** Independent Welch results after switching to pareado without re-confirm.

### Pitfall 5: ChartCustomizer breaks PNG export

**What goes wrong:** User customizes chart but downloaded PNG shows default or blank canvas.

**Why it happens:** Export fires before Chart.js re-render completes; or customizer updates options ref without triggering `ChartCanvas` effect deps.

**How to avoid:** Keep single canvas ref via `ResultsPanel` `onCanvasReady`; debounce customizer updates; reuse Phase 1 `useChartExport` pattern.

**Warning signs:** RTL pass but manual PNG wrong after slider change.

### Pitfall 6: Registry drift vs sidebar/modal

**What goes wrong:** Test marked available in sidebar but modal still shows em breve.

**Why it happens:** Local copy of test list instead of `TEST_REGISTRY`.

**How to avoid:** Single registry edit only (Phase 1 Pitfall 4); extend `registry.test.ts` for three new available entries + demo labeling (D-17).

**Warning signs:** `getTestById('t-student').status` still `em-breve` after ship.

### Pitfall 7: Interpretation HTML vs InterpretationText

**What goes wrong:** Legacy builders return HTML strings with `<p>`, `<ul>` — pasting into React causes markup loss or XSS surface.

**Why it happens:** v1.0 used `innerHTML`.

**How to avoid:** Port interpretation to `string[]` paragraphs + bullet strings; use display formatters (`fmtP`, `fmtNumber`) at build time (D-10 allows light cleanup).

**Warning signs:** Literal `<strong>` visible in UI.

## Code Examples

### Display-rounded parity assertion (D-08)

```typescript
// Source: src/shared/format.ts + D-08
import { fmtP, fmtNumber, fmtSigned } from '@/shared/format';

export function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

// Usage in engine tests:
displayParity(result.p, legacyResult.p, fmtP);
displayParity(result.diff, legacyResult.diff, (v) => fmtSigned(v, 2));
```

### Register annotation plugin (Chart.js 4)

```typescript
// Source: chartjs-plugin-annotation docs — register once alongside ChartCanvas controllers
import { Annotation } from 'chartjs-plugin-annotation';
import { Chart } from 'chart.js';

Chart.register(Annotation);
```

### EstatisticaPage test switch (extend Phase 1 stub)

```tsx
// Source: src/routes/estatistica/EstatisticaPage.tsx — planner replaces demo-only branch
function renderActiveTest(id: string) {
  switch (id) {
    case 'demo': return <TesteDemo key="demo" />;
    case 't-student': return <TStudentTest key="t-student" />;
    case 'correlacao': return <CorrelacaoTest key="correlacao" />;
    case 'prais-winsten': return <PraisWinstenTest key="prais-winsten" />;
    default: return null;
  }
}
```

### Legacy Stats pearson call site (TEST-02 oracle)

```javascript
// Source: tests/correlacao/module.js runAnalysis (~1771)
const pearson = stats.pearson(dataset.x, dataset.y);
const spearman = stats.spearman(dataset.x, dataset.y);
```

### Legacy Prais-Winsten call site (TEST-03 oracle)

```javascript
// Source: tests/prais-winsten/module.js runAnalysis (~1076)
const model = stats.praisWinsten(dataset.time, dataset.values);
const fitted = dataset.time.map(t => Math.pow(10, model.alpha + model.beta * t));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Imperative `renderTestModule(ctx)` per test | React feature components + FlowSteps | Phase 1 shell / Phase 2 migration | Same engines, new mount point |
| Global `window.__LACIR_SHARED__` | `SessionProvider` | Phase 1 | Mapas handoff uses session dataset |
| CDN Chart.js import map | npm `chart.js` + `ChartCanvas` | Phase 1 | Phase 2 adds annotation plugin on same stack |
| Legacy SVG charts (t-student distribution) | Chart.js factories + optional annotation | Phase 2 D-04 | Visual upgrade allowed; values must match |
| `tests-manifest.json` dynamic fetch | Static `TEST_REGISTRY` | Phase 1 | Phase 2 flips status fields only |

**Deprecated/outdated:**
- Equal-variance Student t-test toggle — deferred per CONTEXT
- Byte-identical interpretation strings — relaxed to conclusion parity (D-10)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chartjs-plugin-annotation@3.1.0` is compatible with `chart.js@4.5.1` | Standard Stack | Customizer blocked; fall back to options-only customize |
| A2 | Vitest can import `tests/t-student/module.js` and `assets/js/*.js` as ESM (proven in Phase 1 parseTabular tests) | Pattern 2 | Need vite config `server.fs.allow` or test-only wrapper |
| A3 | Porting full `Stats` verbatim preserves numerics | Don't Hand-Roll | Need JASP oracle dispute path (optional per CONTEXT) |
| A4 | One TABNET fixture per test suffices for D-09 | Parity | Edge derive bugs missed until Phase 3 |
| A5 | `derive*` in TS matches JS normalizer when given same normalized source | Pitfall 3 | DataSUS Configurar path wrong for classroom |

## Open Questions (RESOLVED)

1. **Minimal export additions for correlacao/prais-winsten?** — **RESOLVED**
   - What we know: Only `renderTestModule` exported; D-09 references module.js exports.
   - Resolution: Default to **Stats-level + fixture parity** for numeric and interpretation conclusion checks. Add **non-behavior-changing named exports** to legacy module.js only if Stats+fixture cannot reach conclusion parity for a specific helper. Implemented in `02-04-PLAN.md` Task 1 (correlacao) and `02-05-PLAN.md` Task 1 (prais-winsten) with same optional-export escape hatch.

2. **Mapas handoff default test when real tests available** — **RESOLVED**
   - What we know: Cold start lands on demo (D-16); CONTEXT suggests last selected or t-Student for handoff with data.
   - Resolution: Preserve demo as default cold-start route. When `IniciarPesquisaModal` navigates with session data, land on **Configurar of suggested test if `isTestAvailable(suggestedId)`**, else **`t-student`** if available, else **`demo`**. Implemented in `02-06-PLAN.md` Task 3 with RTL handoff test.

3. **Independent t-Student data shapes** — **RESOLVED**
   - What we know: `module-guided.js` supports wide CSV (unidade;grupo_a;grupo_b) and quick group paste; legacy `module.js` has separate two-column parse.
   - Resolution: Use **guided wide format as primary** (matches config.json description); port `buildManualDatasetFromTabularState` logic into `tStudentEngine.ts`. Legacy `parseDataset` remains oracle-only in differential tests. Implemented in `02-03-PLAN.md` Task 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Vite build | ✓ | v25.9.0 | — |
| npm | package install | ✓ | 11.12.1 | — |
| chart.js | ChartCanvas | ✓ | 4.5.1 (installed) | — |
| chartjs-plugin-annotation | ChartCustomizer | ✗ (not installed) | 3.1.0 on registry | Options-only customize without annotations |
| Vitest + jsdom | Parity + RTL tests | ✓ | vitest 4.1.10 | — |
| Legacy `tests/*.js` imports in Vitest | Differential parity | ✓ (Phase 1 precedent) | — | — |

**Missing dependencies with no fallback:**
- None blocking — `chartjs-plugin-annotation` install is a one-line Wave 0 task.

**Missing dependencies with fallback:**
- `chartjs-plugin-annotation` — deep customize works with scales/legend/tooltip options only (reduced D-04 fidelity).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 + @testing-library/react ^16.3.2 |
| Config file | `vite.config.ts` (`test` block) |
| Quick run command | `npm run test:run -- src/features/tests/t-student/tStudentEngine.test.ts -x` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Welch + paired numerics match legacy | unit/differential | `npm run test:run -- src/features/tests/t-student/tStudentEngine.test.ts` | ❌ Wave 0 |
| TEST-01 | Interpretation conclusion + key stats at display precision | unit | same file, snapshot paragraphs | ❌ Wave 0 |
| TEST-01 | FlowSteps smoke (Usar exemplo → Resultados) | RTL | `npm run test:run -- src/features/tests/t-student/TStudentTest.test.tsx` | ❌ Wave 0 |
| TEST-02 | Pearson/Spearman coef/p match legacy Stats | unit/differential | `npm run test:run -- src/features/tests/correlacao/correlacaoEngine.test.ts` | ❌ Wave 0 |
| TEST-02 | deriveCorrelationPairs TABNET fixture | unit/differential | `npm run test:run -- src/shared/data-input/datasusNormalizer.derive.test.ts` | ❌ Wave 0 |
| TEST-03 | praisWinsten model fields match legacy | unit/differential | `npm run test:run -- src/features/tests/prais-winsten/praisEngine.test.ts` | ❌ Wave 0 |
| TEST-03 | derivePraisSeries TABNET fixture | unit/differential | same normalizer derive test file | ❌ Wave 0 |
| TEST-01–03 | Registry status available + demo label | unit | `npm run test:run -- src/features/tests/registry.test.ts` | ✅ extend |
| UI-04/06 | ResultsPanel PNG + interpretation mount | RTL | per-test `*Test.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** engine differential file for touched test (`npm run test:run -- <engine.test.ts> -x`)
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green + manual spot-check PNG after customizer change

### Wave 0 Gaps

- [ ] `src/shared/stats/statsEngine.ts` + `statsEngine.test.ts` — full Stats port + legacy parity
- [ ] `src/shared/data-input/datasusNormalizer.derive.test.ts` — derive* numeric verification
- [ ] `src/test/fixtures/tests/t-student-exemplo.txt` — from config.json exampleText / templates
- [ ] `src/test/fixtures/tests/correlacao-exemplo.txt` — from config.json examples[0]
- [ ] `src/test/fixtures/tests/prais-exemplo.txt` — from config.json exampleRows
- [ ] One TABNET fixture per test (extend `src/test/fixtures/tabnet/` or test-specific derive inputs)
- [ ] `src/shared/charts/chartFactories/*` — ports of chart-manager render functions
- [ ] `src/shared/charts/ChartCustomizer.tsx` + annotation registration
- [ ] `src/features/tests/{t-student,correlacao,prais-winsten}/*` — feature modules
- [ ] `EstatisticaPage.tsx` — multi-test switch
- [ ] `chartjs-plugin-annotation` install + `checkpoint:human-verify` if slopcheck unavailable

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Client-only; no auth this milestone |
| V3 Session Management | no | In-memory session only |
| V4 Access Control | no | No multi-user |
| V5 Input Validation | yes | Existing tabular validation + numeric guards (min n, finite coef) before run |
| V6 Cryptography | no | No secrets |

### Known Threat Patterns for client-side stats SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via pasted data rendered as HTML | Spoofing/Tampering | `InterpretationText` renders plain strings only; no `dangerouslySetInnerHTML` on user paste |
| XSS via legacy HTML interpretation ports | Tampering | Convert builders to string arrays at port time (Pitfall 7) |
| DoS via huge paste | Denial of service | Existing parse limits from tabular-data-input; keep file size reasonable in wizard |

## Sources

### Primary (HIGH confidence)
- Repository: `tests/t-student/module.js`, `module-guided.js`, `config.json` — exported engine surface and UX constants
- Repository: `tests/correlacao/module.js`, `tests/prais-winsten/module.js` — runAnalysis call sites
- Repository: `assets/js/app.js:240-533` — Stats implementations (pearson, spearman, praisWinsten, tcdf)
- Repository: `assets/js/chart-manager.js` — chart factory functions to port
- Repository: `src/routes/estatistica/demo/TesteDemo.tsx` — FlowSteps reference implementation
- Repository: `src/shared/data-input/parseTabular.test.ts` — differential parity pattern
- Repository: `.planning/phases/01-redesign-base-react-shell/01-PATTERNS.md` — port discipline

### Secondary (MEDIUM confidence)
- [chartjs-plugin-annotation guide](https://www.chartjs.org/chartjs-plugin-annotation/latest/) — annotation plugin registration (compatibility with Chart.js 4 assumed pending install test)
- npm registry queries run 2026-07-25 — `chart.js@4.5.1`, `chartjs-plugin-annotation@3.1.0`

### Tertiary (LOW confidence)
- Full ChartCustomizer UX scope — no existing component; D-04 is new product surface beyond v1.0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Chart.js already integrated; Stats port follows proven Phase 1 parser discipline
- Architecture: HIGH for shell wiring; MEDIUM for ChartCustomizer depth and correlacao/prais export oracle gap
- Pitfalls: HIGH — grounded in concrete codebase asymmetries (Stats partial port, derive* unverified, export surface)

**Research date:** 2026-07-25
**Valid until:** 2026-08-24 (stable engines); 2026-08-01 for chartjs-plugin-annotation compatibility (verify on install)

## RESEARCH COMPLETE

**Phase:** 2 - Migrar testes existentes
**Confidence:** HIGH-MEDIUM

### Key Findings
- Phase 2 is an engine port + React mount problem, not new statistics — reuse v1.0 `Stats` and t-student exports as oracles.
- `legacyAdapters.ts` is insufficient; Wave 0 must port full `Stats` from `assets/js/app.js` with differential tests.
- t-Student has rich exported functions; Correlação/Prais-Winsten rely on internal `Stats` calls — parity strategy must combine Stats port + fixtures, not only module exports.
- `derive*` functions in `datasusNormalizer.ts` are typed but numerically unverified — block DataSUS Configurar until parity passes.
- Deep chart customize (D-04) extends existing Chart.js via ported `chart-manager` factories + `chartjs-plugin-annotation`; demo stays simple.

### File Created
`.planning/phases/02-migrar-testes-existentes/02-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | chart.js installed; port-not-replace aligned with PROJECT.md |
| Architecture | HIGH-MEDIUM | TesteDemo pattern clear; ChartCustomizer is new surface |
| Pitfalls | HIGH | Export asymmetry and derive* gap verified in source |

### Open Questions (RESOLVED)
- correlacao/prais exports → Stats-level + fixture parity; optional non-behavior-changing named exports only if Stats+fixture cannot reach conclusion parity (`02-04`/`02-05` Task 1)
- Mapas handoff → suggested test if available, else `t-student`, else `demo` (`02-06` Task 3)
- t-Student data shapes → guided wide format primary (`02-03` Task 1)

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
