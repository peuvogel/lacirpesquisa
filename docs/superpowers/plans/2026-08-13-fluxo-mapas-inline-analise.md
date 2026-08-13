# Fluxo progressivo de análise dentro de Mapas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter a análise guiada na rota `/mapas`, explicitar a comparação entre grupos territoriais, alinhar os gráficos de distribuição ao sistema Chart.js de Estatística e oferecer Prais–Winsten separadamente por grupo.

**Architecture:** Extrair o contêiner analítico hoje privado de `VariaveisPage` para um componente reutilizável e montá-lo abaixo do mapa somente após a confirmação válida do recorte. O componente continuará consumindo `ResearchDesign` e o repositório Supabase existentes. Gráficos de perfil ganharão factories Chart.js compartilhadas; tendências Prais serão construídas por grupo a partir das células anuais e executadas pelo motor existente, sem comparação de valores-p entre grupos.

**Tech Stack:** React 19, TypeScript, React Router, Chart.js, Vitest, Testing Library, Supabase client/repository existente, motores estatísticos LACIR existentes.

## Global Constraints

- Trabalhar somente em `/Users/pedroalmeida/Desktop/Bioestatística LACIR/.worktrees/guided-variables-technical`.
- Não editar, restaurar ou adicionar `pipeline/sih/src/sih_pipeline/audit.py` do repositório original.
- O fluxo iniciado em Mapas permanece em `/mapas`; `/variaveis` continua como catálogo independente e compatibilidade de sessão.
- Ausência nunca vira zero; zero observado, sem dados e revisão continuam estados distintos.
- Testes de grupo exigem todos os grupos selecionados e analisam cada variável como desfecho separado.
- Prais–Winsten roda separadamente por grupo; nenhuma conclusão compara significância ou valores-p entre grupos.
- Não criar fixtures de produção nem fallback silencioso quando Supabase falhar.
- Atualizar o servidor de demonstração somente depois de testes, build e smoke visual.

---

## File Structure

- Create `src/routes/variaveis/GuidedAnalysisWorkspace.tsx`: estado e orquestração da análise guiada reutilizável.
- Create `src/routes/variaveis/researchCutSummary.ts`: resumo derivado de `ResearchDesign`, compartilhado por Mapas e Variáveis.
- Create `src/routes/variaveis/ResearchCutContext.tsx`: doença, período, base e composição dos grupos antes das checkboxes.
- Create `src/routes/variaveis/profileCharts.ts`: factories Chart.js para histograma, Q–Q e categorias.
- Create `src/routes/variaveis/praisGroupTrends.ts`: séries anuais e resultados Prais separados por grupo.
- Create `src/routes/variaveis/GroupTrendTestSection.tsx`: escolha descritiva de Prais independente da família confirmatória de comparação.
- Modify `src/routes/variaveis/VariaveisPage.tsx`: usar o workspace extraído e preservar o catálogo direto.
- Modify `src/routes/variaveis/GuidedResearchFlow.tsx`: contexto do recorte e testes temporais também em Descrever.
- Modify `src/routes/variaveis/GuidedVariableSelector.tsx`: renderizar `ResearchCutContext` e explicitar grupos como fator.
- Modify `src/routes/variaveis/ProfileDistributionVisual.tsx`: trocar SVG próprio por `ChartCanvas`.
- Modify `src/routes/variaveis/GuidedResultsSection.tsx`: apresentar tendências Prais por grupo antes da conclusão descritiva.
- Modify `src/routes/mapas/MapasPage.tsx`: desbloqueio inline, reset semântico e rolagem.
- Modify `src/routes/mapas/MapPrimaryActionBar.tsx`: cópia e estado do botão inline.
- Modify focused tests alongside each production file.

---

### Task 1: Extrair o workspace analítico reutilizável

**Files:**
- Create: `src/routes/variaveis/GuidedAnalysisWorkspace.tsx`
- Create: `src/routes/variaveis/researchCutSummary.ts`
- Modify: `src/routes/variaveis/VariaveisPage.tsx:261-541`
- Test: `src/routes/variaveis/VariaveisPage.test.tsx`
- Test: `src/routes/variaveis/GuidedAnalysisWorkspace.test.tsx`

**Interfaces:**
- Consumes: `ResearchDesign`, `useGuidedResearch`, `GuidedResearchFlow`, `GuidedResultsSection`, `useSession().setGuidedAnalysis`.
- Produces: `GuidedAnalysisWorkspace({ design, embedded }: { design: ResearchDesign; embedded?: boolean })` and `buildResearchSummary(design): ResearchCutSummaryViewModel`.
- Also produces: exported `diseaseLabel`, `formatResearchPeriodLabel` and `formatResearchPeriod` helpers from `researchCutSummary.ts`.

- [ ] **Step 1: Write the failing extraction tests**

```tsx
it('renders the guided analysis without a second page header when embedded', () => {
  render(<GuidedAnalysisWorkspace design={guidedDesign} embedded />);
  expect(screen.getByRole('heading', { name: /Nordeste · Embolia/i })).toBeInTheDocument();
  expect(screen.queryByTestId('guided-page-shell')).not.toBeInTheDocument();
});

it('keeps the legacy guided route compatible', () => {
  renderPage('/variaveis', guidedDesign);
  expect(screen.getByRole('heading', { name: /Nordeste · Embolia/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run src/routes/variaveis/GuidedAnalysisWorkspace.test.tsx src/routes/variaveis/VariaveisPage.test.tsx`

Expected: FAIL because `GuidedAnalysisWorkspace.tsx` does not exist.

- [ ] **Step 3: Move the guided orchestration without changing behavior**

```tsx
export interface GuidedAnalysisWorkspaceProps {
  design: ResearchDesign;
  embedded?: boolean;
}

export function GuidedAnalysisWorkspace({ design, embedded = false }: GuidedAnalysisWorkspaceProps) {
  const content = <GuidedResearchFlow key={fingerprintResearchDesign(design)} {...flowProps} />;
  if (embedded) return <div data-testid="guided-analysis-workspace">{content}</div>;
  return <motion.div data-testid="guided-page-shell" className="lacir-page-enter mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">{content}</motion.div>;
}
```

Move `buildResearchSummary`, `diseaseLabel`, `formatResearchPeriodLabel` and `formatResearchPeriod` into `researchCutSummary.ts`. `VariaveisPage` becomes:

```tsx
export function VariaveisPage() {
  const { researchDesign } = useSession();
  return researchDesign
    ? <GuidedAnalysisWorkspace design={researchDesign} />
    : <DirectCatalogPage />;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run src/routes/variaveis/GuidedAnalysisWorkspace.test.tsx src/routes/variaveis/VariaveisPage.test.tsx`

Run: `npm run typecheck`

Expected: all PASS.

- [ ] **Step 5: Commit the extraction**

```bash
git add docs/superpowers/plans/2026-08-13-fluxo-mapas-inline-analise.md src/routes/variaveis/GuidedAnalysisWorkspace.tsx src/routes/variaveis/researchCutSummary.ts src/routes/variaveis/VariaveisPage.tsx src/routes/variaveis/GuidedAnalysisWorkspace.test.tsx src/routes/variaveis/VariaveisPage.test.tsx
git commit -m "refactor(variables): extract guided analysis workspace"
```

---

### Task 2: Desbloquear a análise abaixo do mapa sem navegar

**Files:**
- Modify: `src/routes/mapas/MapasPage.tsx:620-972`
- Modify: `src/routes/mapas/MapPrimaryActionBar.tsx`
- Test: `src/routes/mapas/MapasPage.test.tsx`
- Test: `src/routes/mapas/MapPrimaryActionBar.test.tsx`

**Interfaces:**
- Consumes: `GuidedAnalysisWorkspace`, `fingerprintResearchDesign`, `useSession().setResearchDesign`, `useSession().setDataset`.
- Produces: uma seção `#analise-do-recorte` montada somente para o desenho confirmado.

- [ ] **Step 1: Replace the navigation expectation with a failing inline-flow test**

```tsx
it('keeps the completed cut on Mapas and reveals the guided analysis below', async () => {
  completeTwoGroupMapCut();
  await user.click(screen.getByRole('button', { name: 'Começar análise' }));
  expect(pathname).toBe('/mapas');
  expect(await screen.findByRole('region', { name: 'Análise do recorte' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '1. Qual é o objetivo?' })).toBeInTheDocument();
  expect(screen.queryByTestId('review-analysis-dialog')).not.toBeInTheDocument();
});

it('invalidates an unlocked analysis when the semantic cut changes', async () => {
  completeTwoGroupMapCut();
  await user.click(screen.getByRole('button', { name: 'Começar análise' }));
  await user.click(screen.getByRole('checkbox', { name: /Infarto cerebral/i }));
  expect(screen.queryByRole('region', { name: 'Análise do recorte' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run Mapas tests and verify RED**

Run: `npm test -- --run src/routes/mapas/MapasPage.test.tsx src/routes/mapas/MapPrimaryActionBar.test.tsx`

Expected: FAIL because the button still opens `ReviewAnalysisDialog` and navigates to `/variaveis`.

- [ ] **Step 3: Implement semantic unlock and safe reset**

```tsx
const analysisRef = useRef<HTMLElement>(null);
const [confirmedDesign, setConfirmedDesign] = useState<ResearchDesign | null>(null);
const currentDesignFingerprint = researchDesign ? fingerprintResearchDesign(researchDesign) : null;
const confirmedFingerprint = confirmedDesign ? fingerprintResearchDesign(confirmedDesign) : null;

useEffect(() => {
  if (confirmedFingerprint && confirmedFingerprint !== currentDesignFingerprint) {
    setConfirmedDesign(null);
    setGuidedAnalysis(null);
  }
}, [confirmedFingerprint, currentDesignFingerprint, setGuidedAnalysis]);

function startAnalysis() {
  if (!researchDesign) return;
  setDataset(null);
  setResearchDesign(researchDesign);
  setConfirmedDesign(researchDesign);
  requestAnimationFrame(() => analysisRef.current?.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  }));
}
```

Render after the map workspace:

```tsx
{confirmedDesign ? (
  <section ref={analysisRef} id="analise-do-recorte" aria-label="Análise do recorte" className="mt-10 scroll-mt-6">
    <GuidedAnalysisWorkspace design={confirmedDesign} embedded />
  </section>
) : null}
```

Remove `ReviewAnalysisDialog` from `MapasPage`. Change the primary button label to `Começar análise`; after unlock, it may read `Recomeçar análise` while remaining bound to the current valid design.

- [ ] **Step 4: Verify Mapas behavior and semantic resets**

Run: `npm test -- --run src/routes/mapas/MapasPage.test.tsx src/routes/mapas/MapPrimaryActionBar.test.tsx src/shared/session/SessionProvider.test.tsx`

Run: `npm run typecheck`

Expected: all PASS; pathname remains `/mapas`.

- [ ] **Step 5: Commit the inline route**

```bash
git add src/routes/mapas/MapasPage.tsx src/routes/mapas/MapasPage.test.tsx src/routes/mapas/MapPrimaryActionBar.tsx src/routes/mapas/MapPrimaryActionBar.test.tsx
git commit -m "feat(maps): reveal guided analysis inline"
```

---

### Task 3: Mostrar o recorte e tornar a comparação entre grupos inequívoca

**Files:**
- Create: `src/routes/variaveis/ResearchCutContext.tsx`
- Modify: `src/routes/variaveis/GuidedVariableSelector.tsx`
- Modify: `src/routes/variaveis/GuidedResearchFlow.tsx`
- Modify: `src/routes/variaveis/ResearchGoalSection.tsx`
- Modify: `src/routes/variaveis/EligibleTestsSection.tsx`
- Test: `src/routes/variaveis/GuidedResearchFlow.test.tsx`

**Interfaces:**
- Consumes: `ResearchDesign`, `diseaseLabel`, `formatResearchPeriodLabel`.
- Produces: `ResearchCutContext({ design }: { design: ResearchDesign })`.

- [ ] **Step 1: Write failing context and copy tests**

```tsx
it('shows disease, period and every group territory before variable checkboxes', async () => {
  await chooseGoal('Comparar');
  const context = screen.getByRole('region', { name: 'Recorte que será analisado' });
  expect(within(context).getByText('Embolia e trombose arteriais')).toBeInTheDocument();
  expect(within(context).getByText('Nordeste')).toBeInTheDocument();
  expect(within(context).getByText('Bahia, Sergipe')).toBeInTheDocument();
  expect(within(context).getByText(/cada variável será comparada entre os grupos/i)).toBeInTheDocument();
});

it('labels group tests as comparisons of the map groups', async () => {
  await chooseGoalAndVariable('Comparar', 'Taxa de mortalidade');
  expect(screen.getByText(/Nordeste × Sudeste/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the flow test and verify RED**

Run: `npm test -- --run src/routes/variaveis/GuidedResearchFlow.test.tsx`

Expected: FAIL because `GuidedVariableSelector` does not receive `design` or render group composition.

- [ ] **Step 3: Implement the context from `ResearchDesign`**

```tsx
export function ResearchCutContext({ design }: { design: ResearchDesign }) {
  return (
    <section aria-label="Recorte que será analisado" className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <dl className="grid gap-3 md:grid-cols-3">
        <CutFact label="Doença" value={design.diseaseIds.map(diseaseLabel).join(', ')} />
        <CutFact label="Período" value={formatResearchPeriod(design)} />
        <CutFact label="Base" value={design.locationBasis === 'ocorrencia' ? 'Ocorrência' : 'Residência'} />
      </dl>
      <ul>{design.groups.map((group) => <li key={group.id}><strong>{group.name}</strong><span>{group.territories.map((territory) => territory.label).join(', ')}</span></li>)}</ul>
      <p>Cada variável marcada será analisada como um desfecho separado e comparada entre estes grupos.</p>
    </section>
  );
}
```

Pass `design` from `GuidedResearchFlow` into `GuidedVariableSelector`. For group-comparison eligibility, display `design.groups.map(group => group.name).join(' × ')` above the test list. Keep role selectors only for correlation/regression; they do not redefine the map groups.

- [ ] **Step 4: Run flow and accessibility tests**

Run: `npm test -- --run src/routes/variaveis/GuidedResearchFlow.test.tsx src/routes/variaveis/VariaveisPage.test.tsx`

Run: `npm run typecheck`

Expected: all PASS.

- [ ] **Step 5: Commit explicit group context**

```bash
git add src/routes/variaveis/ResearchCutContext.tsx src/routes/variaveis/GuidedVariableSelector.tsx src/routes/variaveis/GuidedResearchFlow.tsx src/routes/variaveis/ResearchGoalSection.tsx src/routes/variaveis/EligibleTestsSection.tsx src/routes/variaveis/GuidedResearchFlow.test.tsx
git commit -m "feat(variables): clarify territorial group comparisons"
```

---

### Task 4: Substituir o histograma e Q–Q simplificados pelo sistema Chart.js

**Files:**
- Create: `src/routes/variaveis/profileCharts.ts`
- Create: `src/routes/variaveis/profileCharts.test.ts`
- Modify: `src/routes/variaveis/ProfileDistributionVisual.tsx`
- Modify: `src/routes/variaveis/DataProfileSection.tsx`
- Test: `src/routes/variaveis/GuidedResearchFlow.test.tsx`

**Interfaces:**
- Consumes: `DistributionViewModel`, `ChartCanvas`, `ChartData`, `ChartOptions`, `BASE_OPTS`, `mergeChartOptions`, `COLORS`.
- Produces: `buildHistogramChart`, `buildQqChart`, `buildCategoryChart`, each returning `{ type, data, options, ariaLabel }` compatible with `ChartCanvas`.

- [ ] **Step 1: Write failing chart-factory tests**

```ts
it('labels histogram axes and exposes bin ranges in tooltips', () => {
  const chart = buildHistogramChart(distribution, 'Taxa de mortalidade');
  expect(chart.type).toBe('bar');
  expect(chart.options.scales?.x?.title?.text).toBe('Faixa de valores');
  expect(chart.options.scales?.y?.title?.text).toBe('Frequência');
  expect(chart.data.labels).toEqual(['5,0–6,0', '6,0–7,0']);
});

it('draws the observed-equals-expected reference in the Q–Q chart', () => {
  const chart = buildQqChart(distribution, 'Taxa de mortalidade');
  expect(chart.type).toBe('scatter');
  expect(chart.data.datasets.some((dataset) => dataset.label === 'Referência normal')).toBe(true);
});
```

- [ ] **Step 2: Run chart tests and verify RED**

Run: `npm test -- --run src/routes/variaveis/profileCharts.test.ts src/routes/variaveis/GuidedResearchFlow.test.tsx`

Expected: FAIL because `profileCharts.ts` does not exist and the UI still renders inline SVG.

- [ ] **Step 3: Implement shared Chart.js factories and renderer**

```ts
export function buildHistogramChart(distribution: DistributionViewModel, label: string): GuidedProfileChart {
  const bins = distribution.histogram ?? [];
  return {
    type: 'bar',
    ariaLabel: `Histograma de ${label}`,
    data: {
      labels: bins.map((bin) => `${format(bin.lower)}–${format(bin.upper)}`),
      datasets: [{ label: 'Frequência', data: bins.map((bin) => bin.count), backgroundColor: COLORS.primarySolid }],
    },
    options: mergeChartOptions(BASE_OPTS, {
      plugins: { title: { display: true, text: `Distribuição de ${label}` } },
      scales: {
        x: { title: { display: true, text: 'Faixa de valores' }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Frequência' } },
      },
    }),
  };
}
```

Build Q–Q as scatter points plus a two-point dashed line dataset named `Referência normal`. Replace every `<svg>` in `ProfileDistributionVisual` with `ChartCanvas`; add the didactic captions `Barras mostram quantas unidades caem em cada faixa` and `Pontos próximos da linha sugerem compatibilidade com normalidade`. Use the category bar chart for categorical profiles.

- [ ] **Step 4: Verify chart rendering and no remaining custom SVG**

Run: `npm test -- --run src/routes/variaveis/profileCharts.test.ts src/routes/variaveis/GuidedResearchFlow.test.tsx src/shared/charts/ChartCanvas.test.tsx`

Run: `rg -n "<svg|Histograma da distribuição" src/routes/variaveis/ProfileDistributionVisual.tsx` — expected no matches.

Run: `npm run typecheck`

Expected: all tests PASS.

- [ ] **Step 5: Commit the chart alignment**

```bash
git add src/routes/variaveis/profileCharts.ts src/routes/variaveis/profileCharts.test.ts src/routes/variaveis/ProfileDistributionVisual.tsx src/routes/variaveis/DataProfileSection.tsx src/routes/variaveis/GuidedResearchFlow.test.tsx
git commit -m "feat(variables): align profile charts with statistics"
```

---

### Task 5: Oferecer Prais–Winsten separado por grupo em Descrever

**Files:**
- Create: `src/routes/variaveis/praisGroupTrends.ts`
- Create: `src/routes/variaveis/praisGroupTrends.test.ts`
- Create: `src/routes/variaveis/GroupTrendTestSection.tsx`
- Modify: `src/routes/variaveis/GuidedAnalysisWorkspace.tsx`
- Modify: `src/routes/variaveis/GuidedResearchFlow.tsx`
- Modify: `src/routes/variaveis/guidedViewModels.ts`
- Modify: `src/routes/variaveis/GuidedResultsSection.tsx`
- Test: `src/routes/variaveis/GuidedResearchFlow.test.tsx`
- Test: `src/routes/variaveis/GuidedResultsSection.test.tsx`

**Interfaces:**
- Consumes: `GuidedResearchData.sourceCells`, `ResearchDesign`, `VariableProfile`, `aggregatePeriod`, `praisEngine`, `praisTrendPresets`, `buildPraisInterpretation`.
- Produces:

```ts
export interface PraisGroupTrendResult {
  groupId: string;
  groupLabel: string;
  outcomeVariableId: string;
  metrics: ResultMetric[];
  chart: ResultsPanelProps['chart'];
  interpretation: string[];
  pValue: number;
  effectDirection: 'positive' | 'negative' | 'null';
}

export interface PraisGroupTrendRun {
  results: PraisGroupTrendResult[];
  skippedGroups: Array<{ groupId: string; groupLabel: string; reason: string }>;
}

export function runPraisByGroup(input: {
  design: ResearchDesign;
  sourceCells: AnalysisCell[];
  profile: VariableProfile;
  alpha?: number;
}): PraisGroupTrendRun;
```

`GuidedResearchSelection` gains `trendTestIds: string[]`. This is deliberately separate from `testIds` and `primaryTestId`: Prais describes each group, while the principal confirmatory test compares groups.

- [ ] **Step 1: Write failing per-group series tests**

```ts
it('builds and runs one regular annual series per selected group', () => {
  const run = runPraisByGroup({ design: twoGroupRangeDesign, sourceCells, profile: countProfile });
  expect(run.results.map((result) => result.groupId)).toEqual(['nordeste', 'sudeste']);
  expect(run.results.every((result) => result.metrics.length > 0)).toBe(true);
});

it('recomputes a rate from group-year components instead of averaging territorial rates', () => {
  const series = buildPraisGroupSeries(twoGroupRangeDesign, sourceCells, mortalityRateProfile);
  expect(series[0]?.rows[0]?.value).toBeCloseTo((3 / 30) * 100);
});

it('keeps an invalid group visible without blocking a valid group', () => {
  const run = runPraisByGroup({ design: mixedCoverageDesign, sourceCells, profile: countProfile });
  expect(run.results).toHaveLength(1);
  expect(run.skippedGroups).toEqual([{ groupId: 'sudeste', groupLabel: 'Sudeste', reason: expect.stringContaining('8 pontos') }]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/routes/variaveis/praisGroupTrends.test.ts src/routes/variaveis/GuidedResearchFlow.test.tsx src/routes/variaveis/GuidedResultsSection.test.tsx`

Expected: FAIL because the group trend module and describe-test path do not exist.

- [ ] **Step 3: Build statistically valid group-year series**

For each group and expected year, select source cells for that group/year and re-key their `territoryId` to the group ID before aggregation. This makes the selected group the analytic unit while allowing the existing `aggregatePeriod` rules to sum counts and recompute rates from paired components.

```ts
const collapsedToGroup = groupYearCells.map((cell) => ({ ...cell, territoryId: group.id }));
const aggregated = aggregatePeriod(collapsedToGroup, profile);
if (aggregated.value !== null) rows.push({ year, value: aggregated.value });
```

Pass each series to `buildPraisDataset`, `validateSeries` and `runAnalysis`. Build metrics, the first `praisTrendPresets` chart and interpretation separately. Prefix every interpretation with:

```ts
`Tendência estimada somente para ${group.name}; este resultado não testa diferença em relação aos demais grupos.`
```

Never combine p-values and never apply Holm across Prais groups.

- [ ] **Step 4: Expose Prais as a separate descriptive trend choice and render group results**

`GuidedResearchFlow` renders `GroupTrendTestSection` for `describe` and `describe_and_compare` after profiles and reviews are ready. The checkbox `Calcular Prais–Winsten por grupo` updates `trendTestIds` and never participates in `primaryTestId` or in the Holm family. The regular `EligibleTestsSection` remains the confirmatory comparison family for `compare` and `describe_and_compare`.

```tsx
{goal !== 'compare' && hasAllProfiles && reviewsResolved ? (
  <GroupTrendTestSection
    available={praisAvailable}
    reason={praisReason}
    selected={trendTestIds.includes('prais-winsten')}
    onSelectedChange={(selected) => changeTrendTests(selected ? ['prais-winsten'] : [])}
  />
) : null}
```

`GuidedAnalysisWorkspace` calls `runPraisByGroup` whenever `trendTestIds` contains `prais-winsten` and reviews are resolved, independently of the principal comparison test. `GuidedResultsSection` receives `praisGroupRun` and renders one `ResultsPanel` per group, followed by skipped groups and the explicit non-comparison note. This permits Prais plus Mann–Whitney in `Descrever e comparar` without treating either as a sensitivity analysis of the other.

```tsx
{praisGroupRun.results.map((result) => (
  <article key={`${result.groupId}:${result.outcomeVariableId}`}>
    <ResultsPanel
      title={`Prais–Winsten · ${result.groupLabel}`}
      metrics={result.metrics}
      chart={result.chart}
      interpretation={result.interpretation}
      exportFilename={`prais-${result.groupId}-${result.outcomeVariableId}.png`}
    />
  </article>
))}
```

- [ ] **Step 5: Verify describe, compare and combined goals**

Run: `npm test -- --run src/routes/variaveis/praisGroupTrends.test.ts src/routes/variaveis/GuidedResearchFlow.test.tsx src/routes/variaveis/GuidedResultsSection.test.tsx src/routes/variaveis/runGuidedTests.test.ts`

Run: `npm run typecheck`

Expected: Prais appears for `describe` and `describe_and_compare`, group tests still compare territorial groups, and no text compares Prais p-values.

- [ ] **Step 6: Commit group trends**

```bash
git add src/routes/variaveis/praisGroupTrends.ts src/routes/variaveis/praisGroupTrends.test.ts src/routes/variaveis/GroupTrendTestSection.tsx src/routes/variaveis/GuidedAnalysisWorkspace.tsx src/routes/variaveis/GuidedResearchFlow.tsx src/routes/variaveis/guidedViewModels.ts src/routes/variaveis/GuidedResultsSection.tsx src/routes/variaveis/GuidedResearchFlow.test.tsx src/routes/variaveis/GuidedResultsSection.test.tsx
git commit -m "feat(variables): describe Prais trends by map group"
```

---

### Task 6: Verificação integral e atualização da demonstração

**Files:**
- Modify only if a failing verification exposes an in-scope defect.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: verified build and live demonstration at the existing complete link.

- [ ] **Step 1: Run focused suites**

Run: `npm test -- --run src/routes/mapas src/routes/variaveis src/features/research src/shared/charts`

Expected: all PASS.

- [ ] **Step 2: Run static and repository gates**

Run: `npm run typecheck`

Run: `git diff --check 6e2a858`

Run: `npm run catalog:validate`

Expected: all PASS.

- [ ] **Step 3: Run the complete gate**

Run: `npm run gate`

Expected: pipeline, Vitest and production build PASS. The existing Vite chunk-size warning may remain; no new error is accepted.

- [ ] **Step 4: Run the development server on the complete-demo port**

Stop only the server process owned by the technical worktree, never the Claude process or the stable `5175` server. Start `npm run dev -- --host 127.0.0.1 --port 5176`; if Vite selects the already-established `5178`, report the actual URL.

- [ ] **Step 5: Perform the real browser smoke**

In one browser tab:

1. Open `/mapas`.
2. Form Nordeste and Sudeste groups.
3. Select Embolia e trombose arteriais and 2013–2025.
4. Click `Começar análise`.
5. Confirm the URL remains `/mapas` and the viewport moves below the map.
6. Confirm disease and every state appear in “Variáveis do recorte”.
7. Choose `Descrever e comparar`, Taxa de mortalidade and Média de permanência.
8. Confirm Chart.js histogram and Q–Q charts have readable axes/tooltips.
9. Run Mann–Whitney and confirm both outcomes compare Nordeste × Sudeste.
10. Select Prais–Winsten in the descriptive path and confirm one result per eligible group without cross-group significance language.
11. Check browser console errors and warnings; expected: none.

- [ ] **Step 6: Final status check and commit any verification-only correction**

Run: `git status --short --branch`

Expected: clean branch. If a correction was required, stage only the files in this plan and commit with `fix(variables): complete inline map analysis flow`.
