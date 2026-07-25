# Phase 3: Testes clássicos + GLM novos - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 62 (Wave 0 shared + 6 test modules + chart factories + integration)
**Analogs found:** 54 / 62

**Framing note:** Phase 3 ships six greenfield test modules on the Phase 2 shell. Unlike Phase 2 (parity vs v1.0 `tests/*/module.js`), these tests have **no legacy MVP engine** — acceptance is **JASP-oracle numerics at display precision** via committed golden JSON. Clone the **t-Student / Correlação feature-folder shape** per registry id; extend `statsEngine` + new `glmEngine.ts` for numerics; add shared `AssumptionNudgeStrip` for UX-02.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/stats/statsEngine.ts` | utility | transform | `src/shared/stats/statsEngine.ts` (self) | exact (extend) |
| `src/shared/stats/statsEngine.test.ts` | test | batch | `src/features/tests/t-student/tStudentEngine.test.ts` | role-match (golden not legacy) |
| `src/shared/stats/glmEngine.ts` | service | transform | `src/shared/stats/statsEngine.ts` (IRLS surface) | partial |
| `src/shared/stats/glmEngine.test.ts` | test | batch | `src/features/tests/t-student/tStudentEngine.test.ts` | role-match |
| `src/features/tests/shared/AssumptionNudgeStrip.tsx` | component | event-driven | `src/features/tests/shared/SoftResetAlert.tsx` | role-match |
| `src/features/tests/shared/assumptionNudges.ts` | utility | transform | `src/features/tests/t-student/tStudentEngine.ts` (`classifyEffect`) | partial |
| `src/features/tests/qui-quadrado/*` (8 files) | module set | request-response | `src/features/tests/t-student/` | exact (clone) |
| `src/features/tests/anova-tukey/*` (8 files) | module set | request-response | `src/features/tests/t-student/` | exact (clone) |
| `src/features/tests/kruskal-dunn/*` (8 files) | module set | request-response | `src/features/tests/t-student/` | exact (clone) |
| `src/features/tests/poisson/*` (8 files) | module set | request-response | `src/features/tests/correlacao/` | exact (clone) |
| `src/features/tests/binomial-negativa/*` (8 files) | module set | request-response | `src/features/tests/poisson/*` | exact (after B1) |
| `src/features/tests/logistica/*` (8 files) | module set | request-response | `src/features/tests/poisson/*` | exact (after B1) |
| `src/shared/charts/chartFactories/contingencyChart.ts` | utility | transform | `src/shared/charts/chartFactories/tStudentCharts.ts` | role-match |
| `src/shared/charts/chartFactories/anovaChart.ts` | utility | transform | `src/shared/charts/chartFactories/tStudentCharts.ts` | role-match |
| `src/shared/charts/chartFactories/postHocHeatmapChart.ts` | utility | transform | `src/shared/charts/chartFactories/scatterChart.ts` | partial |
| `src/shared/charts/chartFactories/glmCoefForestChart.ts` | utility | transform | `src/shared/charts/chartFactories/tStudentCharts.ts` (range/forest) | partial |
| `src/test/fixtures/jasp/*.golden.json` | config/fixture | batch | `src/test/fixtures/tests/t-student-exemplo.txt` | role-match |
| `src/test/fixtures/tests/*-exemplo.*` | config/fixture | — | `src/test/fixtures/tests/correlacao-exemplo.txt` | exact |
| `scripts/oracle/generate-phase3-fixtures.R` | script (dev-only) | file-I/O | none | no-analog |
| `package.json` (jstat, ml-matrix) | config | — | existing `chart.js` dep pattern | role-match |
| `src/features/tests/registry.ts` | config | — | `src/features/tests/registry.ts` (self) | exact (modify) |
| `src/features/tests/registry.test.ts` | test | — | `src/features/tests/registry.test.ts` (self) | exact (extend) |
| `src/routes/estatistica/EstatisticaPage.tsx` | component (page) | request-response | `src/routes/estatistica/EstatisticaPage.tsx` (self) | exact (extend) |
| `src/routes/estatistica/EstatisticaPage.test.tsx` | test | request-response | `src/routes/estatistica/EstatisticaPage.test.tsx` (self) | exact (extend) |

### Per-module file roles (repeat ×6 under `src/features/tests/<id>/`)

| File pattern | Role | Data Flow | Closest analog file |
|--------------|------|-----------|---------------------|
| `<Name>Test.tsx` | component (feature) | request-response | `TStudentTest.tsx` / `CorrelacaoTest.tsx` |
| `<name>Config.ts` | config | — | `tStudentConfig.ts` / `correlacaoConfig.ts` |
| `<Name>ConfigPanel.tsx` | component | event-driven | `TStudentConfigPanel.tsx` |
| `<name>Engine.ts` | service | transform | `tStudentEngine.ts` / `correlacaoEngine.ts` |
| `<name>Interpretation.ts` | utility | transform | `tStudentInterpretation.ts` |
| `<name>Charts.ts` | utility | transform | `tStudentCharts.ts` / `correlacaoCharts.ts` |
| `<name>Engine.test.ts` | test | batch | `tStudentEngine.test.ts` (golden variant) |
| `<Name>Test.test.tsx` | test | request-response | `TStudentTest.test.tsx` |

## Pattern Assignments

### `src/shared/stats/statsEngine.ts` (utility, transform) — Wave 0 extend

**Analog:** `src/shared/stats/statsEngine.ts` (existing port)

**Port discipline** (lines 1-4, 55-96):
```typescript
/**
 * Full port of the legacy `Stats` object from `assets/js/app.js:240-533`.
 * Formulas are byte-for-byte unchanged — only TypeScript types were added.
 */
export const statsEngine = {
  parseNumber(raw: unknown): number | null { /* ... */ },
  mean(arr: number[]): number { /* ... */ },
  sd(arr: number[]): number { return Math.sqrt(statsEngine.variance(arr)); },
  rank(arr: number[]): number[] { /* tie-aware ranks — reuse for Kruskal/Dunn */ },
  // ... gammaln, betacf, ibeta, tcdf, tInv, pearson, spearman ...
};
```

**Phase 3 additions:** `runChiSquareIndependence`, `oneWayAnova`, `kruskalWallis`, `tukeyHsd`, `dunnPostHoc` — wrap `jstat` CDFs/Tukey where cheaper than hand-roll (D-19). Keep existing `rank`, `mean`, `sd`, `parseNumber` for dataset builders.

**Reuse for Kruskal:** `statsEngine.rank` (lines 239-254) is the pooled-rank primitive.

---

### `src/shared/stats/glmEngine.ts` (service, transform) — Wave 0 new

**Analog:** `src/shared/stats/statsEngine.ts` (export shape + NaN guards) + `statsEngine.olsTransformed` (lines 259+) for WLS skeleton

**Export pattern to mirror statsEngine:**
```typescript
export interface GlmFitResult {
  coefficients: Array<{ term: string; beta: number; se: number; z: number; p: number }>;
  deviance: number;
  dfResid: number;
  pearsonChi2: number;
  converged: boolean;
}

export function fitPoisson(/* design matrix inputs */): GlmFitResult { /* IRLS via ml-matrix */ }
export function fitNegativeBinomial(/* ... */): GlmFitResult & { theta: number } { /* glm.nb-style outer loop */ }
export function fitLogistic(/* ... */): GlmFitResult { /* binomial IRLS; OR = exp(β) */ }
```

**Error/NaN guards:** Mirror `tStudentEngine.ts` — return friendly validation errors upstream; never throw on bad input (D-12).

---

### `src/features/tests/shared/AssumptionNudgeStrip.tsx` (component, event-driven) — Wave 0 new

**Analog:** `src/features/tests/shared/SoftResetAlert.tsx`

**Alert shell pattern** (lines 8-21):
```tsx
export function SoftResetAlert({ className }: SoftResetAlertProps) {
  return (
    <Alert
      role="status"
      aria-live="polite"
      className={cn('border-l-4 border-l-[var(--color-accent)] bg-[var(--color-surface)]', className)}
    >
      <AlertTitle className="text-base font-bold text-foreground">Modo alterado.</AlertTitle>
      <AlertDescription className="text-base text-muted-foreground">{/* ... */}</AlertDescription>
    </Alert>
  );
}
```

**Phase 3 target:** Map `severity: 'info' | 'warning'` → teal left border (info) vs amber/warning border (warning). Optional `cta?: { label; testId }` renders a `Button` that calls `onNavigateTest(testId)` for Poisson→NB and ANOVA→Kruskal handoffs (D-04/D-06). **Never block results** — strip sits above metric cards only.

**Types in `assumptionNudges.ts`:**
```typescript
export type NudgeSeverity = 'info' | 'warning';
export interface AssumptionNudge {
  severity: NudgeSeverity;
  message: string;
  cta?: { label: string; testId: string };
}
```

Each `*Engine.ts` exports `computeAssumptionNudges(output, dataset): AssumptionNudge[]` driven by empirical stats (expected counts, SD ratios, overdispersion ratio).

---

### `*Test.tsx` orchestrator (component, request-response) — all six modules

**Analog:** `src/features/tests/t-student/TStudentTest.tsx` (classical) / `src/features/tests/correlacao/CorrelacaoTest.tsx` (GLM — multi-predictor roles, no mode toggle)

**State shape + FlowSteps wiring** (TStudentTest lines 80-96, 267-317):
```tsx
export function TStudentTest() {
  const { dataset: sessionDataset, setDataset, setDatasusSession } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<TStudentLoadedInput | null>(() => initialLoadedFromSession(sessionDataset));
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [showSoftReset, setShowSoftReset] = useState(false);
  // ...
}
```

**Session publish on confirm** (lines 147-169):
```tsx
function handleConfigureConfirm(confirmed: { headers; rows; recognizedColumns }) {
  setConfirmedDataset({ ...confirmed, sourceLabel, isDatasus, recognizedColumns: confirmed.recognizedColumns });
  setShowSoftReset(false);
  setDataset({ headers: confirmed.headers, rows: confirmed.rows, sourceLabel, confirmedAt: Date.now() });
  setActiveStep('resultados');
}
```

**Results composition — Phase 3 delta** (insert nudge strip + optional pairwise table):
```tsx
return (
  <>
    <AssumptionNudgeStrip nudges={engineOutput.nudges} onNavigateTest={handleCrossTestHandoff} />
    {/* ANOVA/Kruskal only: PairwiseResultsTable rows={engineOutput.pairwise} */}
    <ResultsPanelWithCustomizer
      title="…: resultados"
      metrics={metrics}
      engineOutput={engineOutput}
      presets={chartPresets}
      defaultPresetId={defaultPresetId}
      annotations={CHART_ANNOTATIONS}
      interpretation={interpretation}
      exportFilename="<id>-lacirstat.png"
      actions={<>{/* Poisson: NB CTA button */}<ClearDataButton onCleared={handleClearData} /></>}
    />
  </>
);
```

**Soft-reset on role/method change** (CorrelacaoTest lines 133-144 — mirror for predictor/outcome role edits):
```tsx
function handleMethodChange(nextMethod: CorrelacaoMethod) {
  if (nextMethod === method) return;
  if (confirmedDataset) {
    setConfirmedDataset(null);
    setShowSoftReset(true);
    if (activeStep === 'resultados') setActiveStep('configurar');
  }
  setMethod(nextMethod);
}
```

**Module-specific notes:**
- **Qui-quadrado:** two categorical columns; `TABULAR_OPTIONS` must **omit** `numericKeys` on categoricals (RESEARCH Pitfall 4).
- **ANOVA/Kruskal:** numeric outcome + categorical factor; soft-reset on factor column change.
- **GLM trio:** outcome + ≥1 predictors; Poisson surfaces NB CTA in nudge + `actions`, not auto-switch (D-20).

---

### `*Config.ts` (config)

**Analog:** `src/features/tests/t-student/tStudentConfig.ts`

**TabularInputOptions pattern** (lines 7-26):
```typescript
export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    variavel_x: ['variavel_x', 'variavel x', 'x'],
    variavel_y: ['variavel_y', 'variavel y', 'y'],
  },
  requiredKeys: ['variavel_x', 'variavel_y'],
  numericKeys: ['variavel_x', 'variavel_y'],
  expectedFormatLabel: 'id;variavel_x;variavel_y',
  positionFallback: { keysByIndex: [...], minColumns: 2, requiredKeys: [...], introText: '...', assumptionText: '...' },
};
```

**Phase 3 role keys (per test):**

| Test id | requiredKeys | numericKeys notes |
|---------|--------------|-------------------|
| `qui-quadrado` | `categoria_a`, `categoria_b` | **none** — string coercion only |
| `anova-tukey`, `kruskal-dunn` | `desfecho`, `grupo` | `desfecho` numeric only |
| `poisson`, `binomial-negativa` | `contagem`, + predictors | `contagem` + numeric predictors |
| `logistica` | `desfecho_binario`, + predictors | binary outcome validated in engine |

Export `exampleText`, `didacticCards`, `defaultQuestion`, `MAX_RESEARCH_QUESTION_LENGTH` as typed constants (synthetic capacitação fixtures in `src/test/fixtures/tests/`).

---

### `*ConfigPanel.tsx` (component, event-driven)

**Analog:** `src/features/tests/t-student/TStudentConfigPanel.tsx`

**Layout stack** (lines 61-103):
```tsx
<div className="space-y-4">
  {/* Phase 3: omit ModeChoiceCard unless test has variants */}
  {showSoftReset ? <SoftResetAlert /> : null}
  <div className="grid gap-4 md:grid-cols-2">
    <AlphaSelector value={alpha} onChange={onAlphaChange} />
    <ResearchQuestionField value={researchQuestion} onChange={onResearchQuestionChange} placeholder={defaultQuestion} />
  </div>
  <DidacticCards cards={didacticCards} />
  <ColumnPreviewTable
    headers={loadedInput.headers}
    bodyRows={loadedInput.rows}
    recognizedColumns={loadedInput.recognizedColumns}
    tabularOptions={TABULAR_OPTIONS}
    onConfirm={onConfirm}
  />
</div>
```

**Validation alert** (lines 106-115): reuse `*ValidationAlert` destructive `Alert` for type/role errors — friendly PT list of expected roles (D-12).

---

### `*Engine.ts` (service, transform)

**Analog:** `src/features/tests/t-student/tStudentEngine.ts` + `src/features/tests/correlacao/correlacaoEngine.ts`

**Standard engine surface (copy per module):**
```typescript
export function buildDatasetFromConfirmed(input: BuildDatasetInput): BuiltDataset { /* role → vectors/table */ }
export function validateDataset(dataset: BuiltDataset): string[] { /* friendly errors, min n guards */ }
export function runAnalysis(dataset: BuiltDataset): AnalysisResult { /* calls statsEngine or glmEngine */ }
export function buildMetrics(result: AnalysisResult): ResultMetric[] { /* fmtP, fmtNumber */ }
export function computeAssumptionNudges(result: AnalysisResult, dataset: BuiltDataset): AssumptionNudge[] { /* UX-02 */ }
export function toEngineOutput(dataset, result): EngineOutput { /* bundles for charts + nudges */ }
```

**Dataset builder pattern** (correlacaoEngine lines 71-99):
```typescript
export function buildDatasetFromConfirmed(input: BuildDatasetInput): CorrelacaoBuiltDataset {
  const indexX = recognizedColumns.variavel_x;
  const indexY = recognizedColumns.variavel_y;
  // iterate rows, statsEngine.parseNumber or String trim for categoricals
  rows.forEach((row, rowIndex) => {
    const valueX = statsEngine.parseNumber(rawX);
    if (valueX !== null && valueY !== null) { x.push(valueX); y.push(valueY); }
  });
  return { x, y, labels, headers: columnLabels, method };
}
```

**Metrics cards** (tStudentEngine lines 282-316):
```typescript
export function buildMetrics(result: TStudentResult, labels: [string, string]): ResultMetric[] {
  return [
    { label: '…', value: fmtNumber(result.m1, 2), hint: `n = ${result.n1} · …` },
    { label: 'Evidência estatística', value: fmtP(result.p), hint: `…` },
  ];
}
```

**Pairwise post-hoc (ANOVA/Kruskal only):** return `pairwise: PairwiseRow[]` on `EngineOutput`; sort by `pAdj` ascending (D-14). Columns: contraste, estatística, p ajustado, IC when available.

**GLM engines:** delegate fit to `glmEngine.ts`; add `overdispersionRatio` (Poisson), `theta` (NB), `oddsRatios` with CI (Logistic) on metrics.

---

### `*Interpretation.ts` (utility, transform)

**Analog:** `src/features/tests/t-student/tStudentInterpretation.ts`

**Target output shape** (lines 13-38):
```typescript
export function buildTStudentInterpretation(
  result: TStudentResult,
  alpha: number,
  labels: [string, string],
  question?: string,
): string[] {
  const significant = result.p < alpha;
  const lead = significant
    ? `Observou-se diferença estatisticamente significativa…`
    : `Não se observou diferença estatisticamente significativa…`;
  const bullets = [
    `Pergunta analisada: ${trimmedQuestion || DEFAULT_QUESTION}.`,
    `Resultado principal: … p = ${fmtP(result.p)}.`,
  ];
  return [lead, ...bullets];
}
```

**Phase 3:** Plain PT `string[]` only — no HTML. Include effect size (Cramér's V), post-hoc summary sentence, OR+CI for logistic, overdispersion note for Poisson. Alpha-aware significance from `AlphaSelector` value.

---

### `*Charts.ts` + chart factories (utility, transform)

**Analog:** `src/features/tests/t-student/tStudentCharts.ts` + `src/shared/charts/chartFactories/scatterChart.ts`

**ChartPreset pattern** (tStudentCharts lines 53-64):
```typescript
export function buildTStudentChartPresets(): ChartPreset<TStudentEngineOutput>[] {
  return [
    {
      id: 'diff',
      label: CHART_PRESET_LABELS.diff,
      visualType: 'range',
      buildChart: ({ result }) => {
        const { data, options } = buildTStudentDiffChartData(result, undefined);
        return { type: 'scatter', data, options: mergeChartOptions(options, { /* annotations */ }) };
      },
      annotationKeys: ['showConfidenceIntervals', 'showPValue'],
    },
  ];
}
```

**Factory port discipline** (scatterChart lines 35-41):
```typescript
/** Return { data, options } — ChartCanvas handles lifecycle */
export function buildScatterChartData(
  dataset: ScatterDataset,
  pearson?: PearsonResult | null,
): { data: ChartData; options: ChartOptions } {
  // pure Chart.js config; use BASE_OPTS, COLORS, mergeChartOptions from chartTheme.ts
}
```

**Phase 3 defaults:**
- χ² → `contingencyChart.ts` (observed vs expected grouped bars)
- ANOVA/Kruskal → `anovaChart.ts` (means/box summary)
- k ≤ 6 groups → optional `postHocHeatmapChart.ts` preset
- GLM → `glmCoefForestChart.ts` (OR/coef forest)

Wire via `ResultsPanelWithCustomizer` `presets`, `defaultPresetId`, `annotations` (D-22).

---

### `*Engine.test.ts` (test, batch) — JASP golden parity

**Analog:** `src/features/tests/t-student/tStudentEngine.test.ts` (harness) — **oracle switches from legacy module.js to golden JSON**

**Display-rounded parity helper** (tStudentEngine.test.ts lines 36-38, 46-50):
```typescript
function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

it('matches JASP golden at display precision', () => {
  const golden = readGolden('qui-quadrado-exemplo.golden.json');
  const result = runChiSquareIndependence(buildTableFromFixture(golden.inputFixture));
  expect(fmtP(result.p)).toBe(fmtP(golden.expected.p));
  expect(fmtNumber(result.cramersV, 3)).toBe(fmtNumber(golden.expected.cramersV, 3));
});
```

**Nudge tests:** `-t nudge` cases assert `computeAssumptionNudges` severity/message when expected cells < 5, overdispersion > threshold, etc.

**No legacy import** for Phase 3 tests — only `src/test/fixtures/jasp/*.golden.json`.

---

### `*Test.test.tsx` (test, request-response)

**Analog:** `src/features/tests/t-student/TStudentTest.test.tsx`

**Chart.js mock hoisting** (lines 7-33):
```typescript
const { ChartMock, destroySpy } = vi.hoisted(() => { /* Chart constructor spy */ });
vi.mock('chart.js', () => ({ Chart: ChartMock, BarController: {}, /* ... */ }));
```

**Flow smoke test** (lines 73-96):
```typescript
it('runs exemplo flow through Resultados with interpretation and PNG export', async () => {
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
  await user.click(screen.getByRole('button', { name: 'Configurar' }));
  await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
  expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
});
```

Wrap in `<SessionProvider>`. Assert `AssumptionNudgeStrip` renders when fixture triggers warning.

---

### Pairwise results table (ANOVA/Kruskal — inline in `*Test.tsx`)

**Analog:** `src/routes/estatistica/ColumnPreviewTable.tsx` (table markup + mono styling)

**Table styling reference** (ColumnPreviewTable — mono preview rows, bordered table):
```tsx
<table className="w-full border-collapse font-mono text-sm">
  <thead>{/* contrast | stat | p_adj | CI */}</thead>
  <tbody>{rows.map(row => <tr key={row.contrast}>…</tr>)}</tbody>
</table>
```

**Sort:** default `pAdj` ascending (D-14). Section heading **"Comparações par a par"** between nudge strip and `ResultsPanelWithCustomizer` (D-16).

---

### `src/features/tests/registry.ts` + `registry.test.ts` (config + test)

**Analog:** Self — flip `status: 'em-breve'` → `'available'` per wave (Phase 2 pattern)

**Entries to flip** (lines 62-109):
```typescript
{ id: 'qui-quadrado', /* ... */ status: 'em-breve', phase: 3 },
{ id: 'anova-tukey', /* ... */ status: 'em-breve', phase: 3 },
// ... kruskal-dunn, poisson, binomial-negativa, logistica
```

**Test extension** (registry.test.ts lines 23-28):
```typescript
it('marks exactly four entries available: demo plus three Phase 2 tests', () => {
  const available = TEST_REGISTRY.filter((entry) => entry.status === 'available');
  expect(available).toHaveLength(4);
});
// Phase 3 Wave A gate: +3 classical → 7 available
// Phase 3 Wave B gate: +3 GLM → 10 available (all roadmap tests)
```

Flip only after module passes golden + RTL smoke (D-02).

---

### `src/routes/estatistica/EstatisticaPage.tsx` (component, extend)

**Analog:** Self — extend `renderActiveTest` switch (lines 18-30)

**Current switch:**
```tsx
function renderActiveTest(activeTestId: string) {
  switch (activeTestId) {
    case 'demo': return <TesteDemo key={activeTestId} />;
    case 't-student': return <TStudentTest key={activeTestId} />;
    case 'correlacao': return <CorrelacaoTest key={activeTestId} />;
    case 'prais-winsten': return <PraisWinstenTest key={activeTestId} />;
    default: return null;
  }
}
```

**Phase 3 target:** add six cases with static imports keyed on registry `id`.

**Handoff state — extend for Poisson→NB** (lines 14-16, 41-48):
```typescript
export interface EstatisticaHandoffState {
  activeTestId?: string;
  recognizedColumns?: Record<string, number>; // Phase 3: preserve column roles
}

useEffect(() => {
  const handoff = location.state as EstatisticaHandoffState | null;
  if (handoffId && isTestAvailable(handoffId)) setActiveTestId(handoffId);
}, [hasData, location.state]);
```

Poisson CTA: `navigate('/', { state: { activeTestId: 'binomial-negativa', recognizedColumns: roleSnapshot } })` — mirror Mapas handoff (RESEARCH Pitfall 5).

---

### `src/shared/charts/ResultsPanelWithCustomizer.tsx` (component — reuse unchanged)

**Analog:** Self (Phase 2 final)

**Props contract** (lines 34-44):
```tsx
export interface ResultsPanelWithCustomizerProps<T> {
  title: string;
  metrics: ResultMetric[];
  engineOutput: T;
  presets: ChartPreset<T>[];
  defaultPresetId: string;
  annotations?: AnnotationDefinition[];
  interpretation: string[];
  exportFilename?: string;
  actions?: ReactNode;
}
```

**Usage:** Pass `actions` for NB handoff button on Poisson; nudge strip mounts **above** this component in `*Test.tsx`, not inside it.

---

## Shared Patterns

### FlowSteps three-step shell
**Source:** `src/shared/flow/FlowSteps.tsx`
**Apply to:** All six Phase 3 modules
```tsx
<FlowSteps
  active={activeStep}
  onStepChange={setActiveStep}
  canAdvance={{ dados: true, configurar: Boolean(loadedInput), resultados: Boolean(confirmedDataset) }}
  dados={/* TabularInputPanel + Usar exemplo */}
  configurar={/* *ConfigPanel */}
  resultados={/* AssumptionNudgeStrip + pairwise? + ResultsPanelWithCustomizer */}
/>
```

### Session + tabular input
**Source:** `src/shared/data-input/useTabularInput.ts` + per-test `TABULAR_OPTIONS`
**Apply to:** All modules — single parse path; `deriveRecognizedColumnsFromTabular` on session restore.

### Display formatting (JASP parity bar)
**Source:** `src/shared/format.ts:7-33`
**Apply to:** All metrics, interpretation, chart tooltips, golden tests
```typescript
export function fmtP(value: number): string {
  if (value < 0.001) return '< 0,001';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 4, minimumFractionDigits: 4 });
}
```

### Assumption nudges (UX-02)
**Source:** new `AssumptionNudgeStrip` + per-engine `computeAssumptionNudges()`
**Apply to:** All six tests — soft strip above metrics; `info`/`warning` only; empirical triggers (D-06/D-07).

### Cross-test handoff
**Source:** `src/routes/estatistica/EstatisticaPage.tsx` + `EstatisticaHandoffState`
**Apply to:** Poisson→`binomial-negativa`, ANOVA→`kruskal-dunn` nudge CTAs — preserve `recognizedColumns`.

### Golden fixture pipeline
**Source:** RESEARCH.md fixture shape
**Apply to:** All `*Engine.test.ts` and `glmEngine.test.ts`
```
scripts/oracle/generate-phase3-fixtures.R  →  src/test/fixtures/jasp/{test-id}.golden.json
Vitest: displayParity vs golden at fmtP/fmtNumber precision (D-21)
```

### Chart lifecycle + PNG
**Source:** `src/shared/charts/ResultsPanelWithCustomizer.tsx` + `useChartExport.ts`
**Apply to:** All modules — multi-chart gallery, per-chart PNG, "Baixar todos".

### Registry single source
**Source:** `src/features/tests/registry.ts`
**Apply to:** Sidebar, QualTesteModal, EstatisticaPage — never duplicate test lists.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/shared/stats/glmEngine.ts` | service | transform | No GLM/IRLS in repo; build new on `ml-matrix`; validate via golden JSON only |
| `scripts/oracle/generate-phase3-fixtures.R` | script | file-I/O | Dev-only R oracle generator; no in-repo precedent — document beside fixtures |
| `src/shared/charts/chartFactories/postHocHeatmapChart.ts` | utility | transform | No heatmap factory yet; use Chart.js matrix/bar grid; follow `scatterChart.ts` pure return pattern |
| `src/shared/charts/chartFactories/contingencyChart.ts` | utility | transform | No mosaic/bar observed-expected chart; closest is `tStudentCharts.ts` grouped bars |
| Pairwise results table component | component | transform | No post-hoc table in app; compose inline in `*Test.tsx` with `ColumnPreviewTable` styling |
| `src/features/tests/shared/AssumptionNudgeStrip.tsx` | component | event-driven | UX-02 is new; borrow `SoftResetAlert` Alert shell only |

---

## Metadata

**Analog search scope:** `src/features/tests/t-student/`, `src/features/tests/correlacao/`, `src/features/tests/shared/`, `src/shared/stats/`, `src/shared/charts/`, `src/routes/estatistica/`, `.planning/phases/02-migrar-testes-existentes/02-PATTERNS.md`
**Files scanned:** ~120 TS/TSX in `src/` + Phase 2 PATTERNS.md + CONTEXT/RESEARCH
**Pattern extraction date:** 2026-07-25
