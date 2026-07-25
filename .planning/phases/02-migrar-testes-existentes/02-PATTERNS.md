# Phase 2: Migrar testes existentes - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 42 (new/modified Phase 2 files from RESEARCH.md + UI-SPEC.md)
**Analogs found:** 38 / 42

**Framing note:** Phase 2 extends the Phase 1 React shell with three real statistical test modules. Most new files either (a) port pure logic from `tests/*/module.js` or `assets/js/app.js` with differential parity tests, or (b) clone the `TesteDemo.tsx` FlowSteps orchestrator pattern with test-specific engines and Configurar panels. Chart customization (`ChartCustomizer`, `ResultsPanelWithCustomizer`) is the main greenfield surface.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/stats/statsEngine.ts` | utility | transform | `assets/js/app.js:240-533` (`Stats`) | exact |
| `src/shared/stats/statsEngine.test.ts` | test | batch | `src/shared/data-input/parseTabular.test.ts` | exact |
| `src/shared/data-input/datasusNormalizer.derive.test.ts` | test | batch | `src/shared/data-input/parseTabular.test.ts` | exact |
| `src/features/tests/registry.ts` | config | — | `src/features/tests/registry.ts` (self) | exact (modify) |
| `src/features/tests/registry.test.ts` | test | — | `src/features/tests/registry.test.ts` (self) | exact (extend) |
| `src/routes/estatistica/EstatisticaPage.tsx` | component (page) | request-response | `src/routes/estatistica/EstatisticaPage.tsx` (self) | exact (extend) |
| `src/routes/estatistica/SidebarTestLink.tsx` | component | event-driven | `src/routes/estatistica/SidebarTestLink.tsx` (self) | exact (extend demo badge) |
| `src/features/tests/shared/DidacticCards.tsx` | component | transform | `tests/t-student/config.json` + legacy didactic HTML in `module-guided.js` | role-match |
| `src/features/tests/shared/AlphaSelector.tsx` | component | event-driven | `tests/t-student/module-guided.js:1491-1497` (α `<select>`) | role-match |
| `src/features/tests/shared/ResearchQuestionField.tsx` | component | event-driven | `tests/t-student/module-guided.js:1487-1488` (`#t-context`) | role-match |
| `src/features/tests/shared/ModeChoiceCard.tsx` | component | event-driven | `tests/t-student/module-guided.js:1474-1482` (`.tstudent-choice-card`) | role-match |
| `src/features/tests/shared/SoftResetAlert.tsx` | component | event-driven | `src/components/ui/alert.tsx` + UI-SPEC copy | partial |
| `src/features/tests/shared/UseExampleButton.tsx` | component | event-driven | `src/routes/estatistica/demo/TesteDemo.tsx:79-82` | exact |
| `src/features/tests/t-student/TStudentTest.tsx` | component (feature) | request-response | `src/routes/estatistica/demo/TesteDemo.tsx` | exact |
| `src/features/tests/t-student/tStudentConfig.ts` | config | — | `tests/t-student/config.json` + `module-guided.js:24-37` aliases | exact |
| `src/features/tests/t-student/tStudentEngine.ts` | service | transform | `tests/t-student/module.js` (`safeWelch`, `safePaired`, derive helpers) | exact |
| `src/features/tests/t-student/tStudentInterpretation.ts` | utility | transform | `tests/t-student/module.js:833-858` (`buildManualInterpretation`) | exact |
| `src/features/tests/t-student/tStudentCharts.ts` | utility | transform | `assets/js/chart-manager.js` (`renderTStudentDiffChart`, distribution) | role-match |
| `src/features/tests/t-student/tStudentEngine.test.ts` | test | batch | `src/shared/data-input/parseTabular.test.ts` + `tests/t-student/module.js` exports | exact |
| `src/features/tests/t-student/TStudentTest.test.tsx` | test | request-response | `src/routes/estatistica/demo/TesteDemo.test.tsx` | exact |
| `src/features/tests/correlacao/CorrelacaoTest.tsx` | component (feature) | request-response | `src/routes/estatistica/demo/TesteDemo.tsx` | exact |
| `src/features/tests/correlacao/correlacaoConfig.ts` | config | — | `tests/correlacao/config.json` | exact |
| `src/features/tests/correlacao/correlacaoEngine.ts` | service | transform | `tests/correlacao/module.js` (`runAnalysis` + `Stats.pearson/spearman`) | role-match |
| `src/features/tests/correlacao/correlacaoInterpretation.ts` | utility | transform | `tests/correlacao/module.js` interpretation builders | role-match |
| `src/features/tests/correlacao/correlacaoCharts.ts` | utility | transform | `assets/js/chart-manager.js` scatter factories | role-match |
| `src/features/tests/correlacao/correlacaoEngine.test.ts` | test | batch | `src/shared/stats/statsEngine.test.ts` + fixture outputs | role-match |
| `src/features/tests/correlacao/CorrelacaoTest.test.tsx` | test | request-response | `src/routes/estatistica/demo/TesteDemo.test.tsx` | exact |
| `src/features/tests/prais-winsten/PraisWinstenTest.tsx` | component (feature) | request-response | `src/routes/estatistica/demo/TesteDemo.tsx` | exact |
| `src/features/tests/prais-winsten/praisConfig.ts` | config | — | `tests/prais-winsten/config.json` | exact |
| `src/features/tests/prais-winsten/praisEngine.ts` | service | transform | `tests/prais-winsten/module.js` + `Stats.praisWinsten` | role-match |
| `src/features/tests/prais-winsten/praisInterpretation.ts` | utility | transform | `tests/prais-winsten/module.js` interpretation builders | role-match |
| `src/features/tests/prais-winsten/praisCharts.ts` | utility | transform | `assets/js/chart-manager.js` timeseries/residual factories | role-match |
| `src/features/tests/prais-winsten/SeriesPreviewTable.tsx` | component | transform | `src/routes/estatistica/ColumnPreviewTable.tsx` | role-match |
| `src/features/tests/prais-winsten/praisEngine.test.ts` | test | batch | `src/shared/stats/statsEngine.test.ts` + fixture outputs | role-match |
| `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx` | test | request-response | `src/routes/estatistica/demo/TesteDemo.test.tsx` | exact |
| `src/shared/charts/chartFactories/*.ts` | utility | transform | `assets/js/chart-manager.js` `render*` functions | exact |
| `src/shared/charts/chartAnnotationSetup.ts` | config | — | `src/shared/charts/ChartCanvas.tsx:23-35` (controller registration) | role-match |
| `src/shared/charts/ChartCustomizer.tsx` | component | event-driven | none (new D-04 surface) | no-analog |
| `src/shared/charts/ResultsPanelWithCustomizer.tsx` | component | request-response | `src/routes/estatistica/ResultsPanel.tsx` | role-match |
| `src/test/fixtures/tests/*` | config/fixture | — | `src/routes/estatistica/demo/demoData.ts` + `tests/*/config.json` | role-match |
| `package.json` (add `chartjs-plugin-annotation`) | config | — | existing `chart.js` dependency | role-match |

## Pattern Assignments

### `src/shared/stats/statsEngine.ts` (utility, transform)

**Analog:** `assets/js/app.js:240-533` (`Stats` object)

**Port discipline** (from Phase 1 `legacyAdapters.ts` header):
- Port verbatim from legacy; only convert `this.` method calls to direct local calls and add TypeScript types.
- Do not replace formulas with npm libraries (RESEARCH.md Don't Hand-Roll).

**Minimum surface to port before any test engine ships:**
```javascript
// assets/js/app.js:240-533 — full Stats object
const Stats = {
  parseNumber(raw) { /* ... */ },
  mean(arr) { /* ... */ },
  variance(arr) { /* ... */ },
  sd(arr) { return Math.sqrt(this.variance(arr)); },
  // ... gammaln, betacf, ibeta, tcdf, tInv, fisherCI ...
  welchT(a, b) { /* lines 380-398 */ },
  pearson(x, y) { /* lines 400-422 */ },
  rank(arr) { /* lines 424-439 */ },
  spearman(x, y) { return this.pearson(this.rank(x), this.rank(y)); },
  olsTransformed(c, x, y) { /* lines 444-474 */ },
  estimateRho(resid) { /* lines 476-486 */ },
  praisWinsten(years, values) { /* lines 488-531 */ }
};
```

**Export pattern** (extend Phase 1 `legacyAdapters.ts`):
```typescript
// src/shared/data-input/legacyAdapters.ts:126-129 — current partial adapter
export const legacyStats: LegacyStatsAdapter = {
  parseNumber,
  mean,
};
// Phase 2: replace with full statsEngine re-export or expand LegacyStatsAdapter type
```

**Error/NaN guards:** Legacy `safeWelch` in `tests/t-student/module.js:607-628` duplicates Welch with extra zero-denominator guards — test engines should call ported `statsEngine` methods but mirror those guards where the legacy module does (parity oracle is `safeWelch`, not raw `Stats.welchT`).

---

### `src/shared/stats/statsEngine.test.ts` + `src/shared/data-input/datasusNormalizer.derive.test.ts` (test, batch)

**Analog:** `src/shared/data-input/parseTabular.test.ts`

**Differential import pattern** (lines 1-73):
```typescript
/**
 * Differential parity suite: every assertion below runs the ported
 * `parseTabular.ts` and the untouched legacy `tabular-data-input.js` over
 * the exact same input and asserts identical output.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as port from './parseTabular';
// eslint-disable-next-line import/extensions -- differential parity import of the untouched legacy module
import * as legacy from '../../../assets/js/tabular-data-input.js';
import { legacyStats } from './legacyAdapters';

describe('readTabularPasteState differential parity (real TABNET fixtures)', () => {
  fixtureCases.forEach(({ file, options }) => {
    it(`matches legacy output for ${file}`, () => {
      const text = readFixture(file);
      expect(port.readTabularPasteState(text, legacyStats, options)).toEqual(
        legacy.readTabularPasteState(text, legacyStats, options),
      );
    });
  });
});
```

**Display-rounded parity helper** (RESEARCH.md D-08):
```typescript
// src/shared/format.ts:7-31
import { fmtP, fmtNumber, fmtSigned } from '@/shared/format';

export function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}
// Usage: displayParity(result.p, legacyResult.p, fmtP);
```

**derive* parity:** Import untouched `assets/js/datasus-normalizer.js` derive functions alongside TS `datasusNormalizer.ts` exports; use one TABNET fixture per test (D-09).

---

### `src/features/tests/t-student/TStudentTest.tsx` (component, request-response)

**Analog:** `src/routes/estatistica/demo/TesteDemo.tsx`

**State shape + FlowSteps wiring** (lines 31-66, 187-239):
```tsx
interface LoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
}

export function TesteDemo() {
  const { dataset: sessionDataset, setDataset, setDatasusSession } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<LoadedInput | null>(() => initialLoadedFromSession(sessionDataset));
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  // ...
}
```

**Session publish on confirm** (lines 98-113):
```tsx
function handleConfigureConfirm(confirmed: { headers: string[]; rows: string[][] }) {
  const sourceLabel = loadedInput?.sourceLabel ?? 'colado';
  setConfirmedDataset({ headers: confirmed.headers, rows: confirmed.rows, sourceLabel });
  setDataset({ headers: confirmed.headers, rows: confirmed.rows, sourceLabel, confirmedAt: Date.now() });
  setActiveStep('resultados');
}
```

**ResultsPanel mount** (lines 170-182):
```tsx
<ResultsPanel
  title="Resumo descritivo (Teste demo)"
  metrics={metrics}
  chart={{ type: 'bar', data: chartData, options: BASE_OPTS, ariaLabel: '...' }}
  interpretation={interpretation}
  exportFilename="teste-demo-lacirstat.png"
  actions={<ClearDataButton onCleared={handleClearData} />}
/>
```

**Phase 2 deltas for TStudentTest:**
- Replace `demoStats` with `tStudentEngine` output.
- Add mode state (`independent` | `paired`); default `independent` (D-12).
- Configurar: `ModeChoiceCard` grid + `AlphaSelector` + `ResearchQuestionField` + `DidacticCards` + `ColumnPreviewTable` + optional DataSUS knobs.
- Resultados: use `ResultsPanelWithCustomizer` (not plain `ResultsPanel`) with `tStudentCharts` presets.
- Dados: `UseExampleButton` loads from `tStudentConfig.exampleText` (copy **"Usar exemplo"** per UI-SPEC, not demo's lowercase).
- Mode switch (D-13): preserve paste/`loadedInput` text; clear mode-specific config + `confirmedDataset`; navigate to Configurar if on Resultados; show `SoftResetAlert`.

**Correlação / Prais-Winsten:** Same orchestrator skeleton; swap config panel, engine, charts, and interpretation modules.

---

### `src/features/tests/t-student/tStudentEngine.ts` (service, transform)

**Analog:** `tests/t-student/module.js` exported pure functions

**Welch oracle** (lines 607-628):
```javascript
export function safeWelch(g1, g2, stats) {
  const n1 = g1.length;
  const n2 = g2.length;
  const m1 = stats.mean(g1);
  const m2 = stats.mean(g2);
  // ... se, t, df, p, ci, d with zero-denominator guards ...
  return { n1, n2, m1, m2, s1, s2, diff, se, t, df, p, ci, d };
}
```

**Differential test pattern** (RESEARCH.md Pattern 2):
```typescript
// eslint-disable-next-line import/extensions
import * as legacy from '../../../tests/t-student/module.js';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { runIndependentWelch } from './tStudentEngine';

it('matches legacy safeWelch for exemplo fixture', () => {
  const { g1, g2 } = legacy.parseDataset(EXAMPLE_TEXT, legacyStats);
  expect(runIndependentWelch(g1, g2)).toEqual(legacy.safeWelch(g1, g2, legacyStats));
});
```

**DataSUS derive path:** Wrap `deriveIndependentTTest` / `derivePairedTTest` from `src/shared/data-input/datasusNormalizer.ts:593-668` — verify numerically before wiring UI (Pitfall 3).

**Do NOT use legacy `parseDataset` in production** — prefer `useTabularInput` + `tStudentConfig` aliases from `module-guided.js:24-37`; legacy parse is parity oracle only.

---

### `src/features/tests/t-student/tStudentInterpretation.ts` (utility, transform)

**Analog:** `tests/t-student/module.js:833-858` (`buildManualInterpretation`)

**Legacy returns HTML** — port to `string[]` for `InterpretationText` (Pitfall 7):
```javascript
export function buildManualInterpretation(result, alpha, labels, question, utils) {
  const significant = result.p < alpha;
  const paragraph = significant
    ? `Observou-se diferença estatisticamente significativa entre a média de ${labels[0]} e ${labels[1]}...`
    : `Não se observou diferença estatisticamente significativa...`;
  return `${utils.buildInterpretationCard(...)}`; // HTML — DO NOT paste into React
}
```

**Target output shape** (from `demoStats.ts:100-136`):
```typescript
export function buildDemoInterpretation(summaries: GroupSummary[]): string[] {
  const paragraphs: string[] = [/* plain PT prose */];
  paragraphs.push('Este Teste demo descreve os números...');
  return paragraphs;
}
```

**Use display formatters at build time:** `fmtNumber`, `fmtP`, `fmtSigned` from `src/shared/format.ts:7-31`.

---

### `src/features/tests/t-student/tStudentConfig.ts` (config)

**Analog:** `tests/t-student/config.json` + `tests/t-student/module-guided.js:24-47`

**TabularInputOptions from guided aliases** (mirror TesteDemo lines 21-29):
```typescript
const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    unidade: ['unidade', 'uf', 'unidade_analitica'],
    grupo_a: ['grupo_a', 'grupo a', 'grupo1'],
    grupo_b: ['grupo_b', 'grupo b', 'grupo2'],
  },
  requiredKeys: ['grupo_a', 'grupo_b'],
  numericKeys: ['grupo_a', 'grupo_b'],
  expectedFormatLabel: 'unidade;grupo_a;grupo_b;observacao_opcional',
};
```

**Export from config.json:** `defaultQuestion`, `didacticCards`, `exampleText` as typed constants for Usar exemplo + fixtures.

---

### `src/features/tests/correlacao/correlacaoEngine.ts` (service, transform)

**Analog:** `tests/correlacao/module.js` `runAnalysis` call site + `statsEngine.pearson/spearman`

**Legacy Stats call** (RESEARCH.md):
```javascript
// tests/correlacao/module.js runAnalysis (~1771)
const pearson = stats.pearson(dataset.x, dataset.y);
const spearman = stats.spearman(dataset.x, dataset.y);
```

**Oracle gap:** correlacao only exports `renderTestModule` — parity via `statsEngine` + fixture expected outputs, not module exports (Pitfall 2).

**Method soft-reset:** Mirror t-Student D-13 when Pearson ↔ Spearman changes.

---

### `src/features/tests/prais-winsten/praisEngine.ts` (service, transform)

**Analog:** `tests/prais-winsten/module.js` + `Stats.praisWinsten`

**Legacy call site:**
```javascript
// tests/prais-winsten/module.js runAnalysis (~1076)
const model = stats.praisWinsten(dataset.time, dataset.values);
const fitted = dataset.time.map(t => Math.pow(10, model.alpha + model.beta * t));
```

**TABNET derive:** `derivePraisSeries` from `datasusNormalizer.ts:901+` — verify before Configurar wiring.

---

### `src/shared/charts/chartFactories/*.ts` (utility, transform)

**Analog:** `assets/js/chart-manager.js` render functions

**Factory port pattern** — convert imperative `new Chart(canvas, config)` to pure `ChartData` + `ChartOptions` return values consumed by `ChartCanvas`:

**T-Student diff chart source** (lines 525-589):
```javascript
export function renderTStudentDiffChart(canvasId, result, labels, utils) {
  destroyChart(canvasId);
  const chart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Diferença entre médias (IC95%)', data: [{ x: diff, y: 0 }], /* ... */ },
        { label: 'Intervalo de Confiança', data: [{ x: low, y: 0 }, { x: high, y: 0 }], showLine: true }
      ]
    },
    options: { ...BASE_OPTS, /* tooltip callbacks with utils.fmtSigned/fmtNumber */ }
  });
}
```

**React target:**
```typescript
// Return { data, options } — ChartCanvas handles lifecycle (ChartCanvas.tsx:66-80)
export function buildTStudentDiffChartData(result: WelchResult, labels: string[]): { data: ChartData; options: ChartOptions } {
  return { data: { /* ported datasets */ }, options: mergeChartOptions(BASE_OPTS, { /* ported overrides */ }) };
}
```

**Theme:** Use `COLORS`, `BASE_OPTS`, `mergeChartOptions` from `src/shared/charts/chartTheme.ts:11-89`.

**Annotation plugin:** Register once in `chartAnnotationSetup.ts` alongside `ChartCanvas` controller registration pattern (lines 23-35).

---

### `src/shared/charts/ResultsPanelWithCustomizer.tsx` (component, request-response)

**Analog:** `src/routes/estatistica/ResultsPanel.tsx`

**Core layout to preserve** (lines 48-78):
```tsx
<div className="space-y-6">
  <h2 className="text-lg font-bold text-foreground">{title}</h2>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{/* metrics */}</div>
  <ChartCanvas /* ... */ onCanvasReady={handleCanvasReady} />
  <InterpretationText paragraphs={interpretation} />
  <Button variant="secondary" onClick={() => exportChart(exportFilename)}>
    Baixar gráfico (PNG)
  </Button>
</div>
```

**Phase 2 extension:** Wrap chart area in CSS grid — chart 62% / `ChartCustomizer` 38% at `lg+`; collapsible below `lg` (UI-SPEC). Keep single `canvasRef` via `onCanvasReady` for PNG (Pitfall 5). Debounce customizer updates ~150ms before marking canvas stable.

**Demo stays on plain `ResultsPanel`** (D-06) — do not mount customizer in `TesteDemo.tsx`.

---

### `src/features/tests/shared/ModeChoiceCard.tsx` + related shared components

**Analog (choice cards):** `tests/t-student/module-guided.js:1474-1482`
```html
<button type="button" class="tstudent-choice-card is-active" data-manual-analysis="independent">
  <strong>t independente</strong>
  <span>Use apenas Grupo A e Grupo B...</span>
</button>
```

**React target (UI-SPEC):** Custom button cards with `role="radio"` + `aria-checked` inside `role="radiogroup"`. Selected state: 2px teal border + `--color-accent-soft` fill. Min 44px tap height.

**AlphaSelector analog:** `module-guided.js:1491-1497` — shadcn `Select` with options 1%/5%/10%, default 5%.

**DidacticCards analog:** `tests/t-student/config.json` `didacticCards[]` — shadcn `Collapsible`, collapsed by default, heading **"Entenda este teste"**.

**SoftResetAlert analog:** `src/components/ui/alert.tsx` with custom teal left border + `role="status"` + `aria-live="polite"`:
```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
// Copy: "Modo alterado." + body from UI-SPEC Copywriting Contract
```

---

### `src/features/tests/registry.ts` + `registry.test.ts` (config + test)

**Analog:** Self — flip status fields only (Phase 1 Pitfall 4)

**Current entries to change** (lines 39-60):
```typescript
{ id: 't-student', /* ... */ status: 'em-breve', phase: 2 },
{ id: 'correlacao', /* ... */ status: 'em-breve', phase: 2 },
{ id: 'prais-winsten', /* ... */ status: 'em-breve', phase: 2 },
// Phase 2: status: 'available' for all three; demo stays 'available'
```

**Test to extend** (`registry.test.ts:21-25`):
```typescript
it('marks exactly one entry available, and it is demo', () => {
  const available = TEST_REGISTRY.filter((entry) => entry.status === 'available');
  expect(available).toHaveLength(1);
  expect(available[0].id).toBe('demo');
});
// Phase 2: expect 4 available (demo + 3 migrated); demo still present; add demo "Demonstração" badge test via SidebarTestLink
```

---

### `src/routes/estatistica/EstatisticaPage.tsx` (component, extend)

**Analog:** Self — extend demo-only branch (lines 37-39)

**Current:**
```tsx
<div id="lacir-test-module-mount" data-active-test-id={activeTestId}>
  {activeTestId === 'demo' ? <TesteDemo key={activeTestId} /> : null}
</div>
```

**Target (RESEARCH.md Pattern 5):**
```tsx
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

**Default selection stays `demo`** (D-16). Static imports keyed on registry `id` — no dynamic manifest fetch.

---

### `src/features/tests/*/T*Test.test.tsx` (test, request-response)

**Analog:** `src/routes/estatistica/demo/TesteDemo.test.tsx`

**Chart.js mock hoisting** (lines 7-32):
```typescript
const { ChartMock, destroySpy } = vi.hoisted(() => {
  const destroySpy = vi.fn();
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock() {
    return { destroy: destroySpy };
  });
  ChartMock.register = vi.fn();
  return { ChartMock, destroySpy };
});

vi.mock('chart.js', () => ({
  Chart: ChartMock,
  BarController: {},
  // ... all controllers ChartCanvas registers
}));
```

**Flow smoke test** (lines 65-95):
```typescript
it('loads sample data, unlocks Configurar, and reaches Resultados after confirm', async () => {
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
  await user.click(screen.getByRole('button', { name: 'Configurar' }));
  await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
  expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Baixar gráfico (PNG)' })).toBeInTheDocument();
});
```

Wrap in `<SessionProvider>` like TesteDemo.test.tsx:34-39.

---

### `src/features/tests/prais-winsten/SeriesPreviewTable.tsx` (component, transform)

**Analog:** `src/routes/estatistica/ColumnPreviewTable.tsx`

**Preview slice pattern** (lines 76-77, 61-67):
```tsx
const previewRows = bodyRows.slice(0, maxPreviewRows);
// maxPreviewRows = 8; show "… e mais {n} linhas" when truncated (UI-SPEC)
```

**Mono table styling:** IBM Plex Mono 14px per UI-SPEC — match `ColumnPreviewTable` table markup with `font-mono` class.

---

## Shared Patterns

### FlowSteps three-step shell
**Source:** `src/shared/flow/FlowSteps.tsx`
**Apply to:** All migrated test orchestrators (D-01)
```tsx
<FlowSteps
  active={activeStep}
  onStepChange={setActiveStep}
  canAdvance={{ dados: true, configurar: Boolean(loadedInput), resultados: Boolean(confirmedDataset) }}
  dados={/* TabularInputPanel + Usar exemplo */}
  configurar={/* test-specific config panel */}
  resultados={/* ResultsPanel or ResultsPanelWithCustomizer */}
/>
```
Only active step content mounts (lines 31-32) — chart effects must not run on Dados step.

### Session + leave warning
**Source:** `src/shared/session/SessionProvider.tsx` + `TesteDemo.tsx:106-111`
**Apply to:** All test orchestrators — publish `setDataset` on Configurar confirm; `LeaveWarningGuard` unchanged on `EstatisticaPage`.

### Tabular input (single parse path)
**Source:** `src/shared/data-input/useTabularInput.ts` + `parseTabular.ts`
**Apply to:** All tests via per-test `TabularInputOptions` in `*Config.ts` — never duplicate parse logic (RESEARCH.md Anti-Pattern 2).

### Results + interpretation + PNG
**Source:** `src/routes/estatistica/ResultsPanel.tsx` + `InterpretationText.tsx`
**Apply to:** All tests; migrated tests use `ResultsPanelWithCustomizer` wrapper
```tsx
// InterpretationText.tsx:9-18 — plain string paragraphs only
{paragraphs.map((paragraph, index) => (
  <p key={index} className="text-sm leading-relaxed text-foreground">{paragraph}</p>
))}
```

### Chart lifecycle + PNG export
**Source:** `src/shared/charts/ChartCanvas.tsx:66-80` + `useChartExport.ts:11-24`
**Apply to:** All chart surfaces
```typescript
// Destroy-before-recreate on type/data/options change
useEffect(() => {
  chartRef.current?.destroy();
  chartRef.current = new Chart(canvasEl, { type, data, options: mergeChartOptions(BASE_OPTS, options) });
  return () => { chartRef.current?.destroy(); };
}, [canvasEl, type, data, options]);
```

### Registry single source
**Source:** `src/features/tests/registry.ts`
**Apply to:** Sidebar (`Sidebar.tsx:56`), QualTesteModal, EstatisticaPage routing — never duplicate test lists.

### Display formatting (D-08 parity)
**Source:** `src/shared/format.ts:7-31`
**Apply to:** All metric cards, interpretation builders, chart tooltips
```typescript
export function fmtP(value: number): string {
  if (value < 0.001) return '< 0,001';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 4, minimumFractionDigits: 4 });
}
```

### Mode/method soft reset (D-13)
**Apply to:** `TStudentTest`, `CorrelacaoTest`
When mode/method changes after prior confirm:
1. Keep `tabular.rawText` / `loadedInput` paste content
2. Clear mode-specific Configurar state slice
3. Set `confirmedDataset` to `null`
4. If `activeStep === 'resultados'`, navigate to `configurar`
5. Show `SoftResetAlert` until next successful analyze

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/shared/charts/ChartCustomizer.tsx` | component | event-driven | D-04 deep customize is new product surface; no v1.0 or Phase 1 equivalent. Build from UI-SPEC Component Inventory + shadcn `Select`/`Switch`/`Collapsible`. Chart options merge via existing `mergeChartOptions`. |
| `src/features/tests/correlacao/correlacaoEngine.test.ts` (partial) | test | batch | No exported pure functions in `tests/correlacao/module.js` — use Stats-level + fixture snapshot parity instead of direct module import (Pitfall 2). |
| `src/features/tests/prais-winsten/praisEngine.test.ts` (partial) | test | batch | Same export gap as correlacao — Stats + fixture outputs as oracle. |
| `src/features/tests/correlacao/CorrelacaoDatasusKnobs.tsx` | component | event-driven | No React DataSUS derive UI exists; closest legacy is `module-guided.js` DataSUS wizard sections (~2395+). Port knob semantics, new JSX layout per Claude's discretion. |

---

## Metadata

**Analog search scope:** `src/` (Phase 1 React shell), `tests/t-student/`, `tests/correlacao/`, `tests/prais-winsten/`, `assets/js/app.js`, `assets/js/chart-manager.js`, `assets/js/datasus-normalizer.js`, `.planning/phases/01-redesign-base-react-shell/01-PATTERNS.md`
**Files scanned:** ~96 TS/TSX in `src/` + 3 legacy test modules + 2 shared JS assets
**Pattern extraction date:** 2026-07-25
