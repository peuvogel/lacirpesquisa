# Fluxo guiado Mapas → Variáveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o fluxo Mapas → Variáveis → resultados inline com disponibilidade real do Supabase, diagnósticos, elegibilidade fail-closed, Mann–Whitney, mapa que separa zero/sem dados e revisão auditável do conjunto analítico.

**Architecture:** O fluxo usa contratos puros em `src/features/research`, um repositório de leitura Supabase/Storage com cache de promessas e consultas agregadas, e os motores estatísticos existentes como única fonte de cálculo. Mapas cria `ResearchDesign`; Variáveis monta `AnalysisCell[]`, perfila os valores, obtém elegibilidade e executa testes sem navegar para Estatística. Estatística continua sendo o laboratório manual e recebe o mesmo Mann–Whitney.

**Tech Stack:** React 19, TypeScript, Vite, Vitest/Testing Library, Supabase JS/PostgREST, Supabase Storage, Chart.js por `src/shared/charts`, Tailwind/shadcn, algoritmos estatísticos TypeScript validados contra R.

## Global Constraints

- Não modificar `pipeline/sih/src/sih_pipeline/audit.py` nem absorver mudanças paralelas do pipeline.
- Leituras do navegador usam somente `VITE_SUPABASE_URL` + chave anônima; nenhuma service role ou escrita remota.
- Suportar 40 ligantes simultâneos: uma consulta agregada por recorte, cache de promessa por fingerprint, nenhum request por checkbox e partição municipal somente sob demanda.
- `0`, ausente, suprimido, não consultado e não aplicável permanecem distintos; valores brutos nunca são reescritos.
- Nenhum fallback para teste t e nenhum teste sugerido apenas pelo rótulo/tipo da variável.
- Variável parcial é selecionável; variável sem valor utilizável é desabilitada.
- Períodos são agregados por perfil: soma, taxa recalculada, média ponderada ou ponto apenas; nunca “último ano” implícito.
- Resultados antigos são invalidados por fingerprint antes de qualquer recálculo.
- Implementação por TDD e commits pequenos; nenhum truncamento silencioso de PostgREST.
- A UI principal usa nomes curtos e detalhes metodológicos fechados por padrão.
- Preservar o sistema de gráficos atual e estendê-lo por factories/presets.

---

## File map

### Domínio e dados

- Create `src/features/research/types.ts`: contratos `ResearchDesign`, `VariableProfile`, `AnalysisCell`, diagnósticos, elegibilidade e cenários.
- Create `src/features/research/researchDesign.ts`: adaptador/validação de Mapas e fingerprint estável.
- Create `src/features/research/variableProfiles.ts`: perfis curtos, componentes derivados e agregação temporal.
- Create `src/features/research/aggregatePeriod.ts`: soma, recomposição de taxas e médias ponderadas.
- Create `src/features/research/supabaseResearchRepository.ts`: leitura UF/ledger/população em lotes, cache/dedupe/abort.
- Create `src/features/research/municipioPartitionIndex.ts`: indexar a partição colunar do Storage sem consultar a tabela municipal legada.
- Create `src/features/research/availability.ts`: estados completo/parcial/sem dados e mensagens concretas.
- Create `src/features/research/zeroPolicy.ts`: recomendação conservadora para zero incompatível.
- Create `src/features/research/scenarios.ts`: cenário recomendado/revisado, máscara analítica e comparação.
- Create `src/features/research/profiling.ts`: descrição, distribuição e normalidade.
- Create `src/features/research/eligibility.ts`: motor fail-closed compartilhado.

### Estatística e gráficos

- Create `src/features/tests/mann-whitney/*`: motor, configuração, interpretação, charts, componente e testes.
- Modify `src/features/tests/registry.ts`, `src/routes/estatistica/EstatisticaPage.tsx`, Sidebar/QualTeste tests: registrar e renderizar Mann–Whitney.
- Modify `src/features/tests/prais-winsten/praisEngine.ts`: preservar zeros e selecionar escala.
- Create `src/shared/charts/chartFactories/distributionCharts.ts`: histograma, Q–Q, pontos/box-ranks.
- Modify `src/shared/charts/chartFactories/index.ts`: exportar novas factories.

### Fluxo e UI

- Modify `src/shared/session/SessionProvider.tsx`: armazenar `researchDesign` e `guidedAnalysis`.
- Modify `src/routes/mapas/mapAnalysisState.ts`: adaptar doenças/período para `ResearchDesign`.
- Modify `src/routes/mapas/MapasPage.tsx`, `MapPrimaryActionBar.tsx`, `ReviewAnalysisDialog.tsx`: CTA para Variáveis sem teste/handoff tabular.
- Modify `src/geo/choroplethScale.ts`, `src/routes/mapas/BrazilMapCanvas.tsx`, `ChoroplethLegend.tsx`: triestado cartográfico.
- Create `src/routes/variaveis/GuidedResearchFlow.tsx`: orquestração progressiva.
- Create `src/routes/variaveis/ResearchGoalSection.tsx`, `GuidedVariableSelector.tsx`, `DataProfileSection.tsx`, `EligibleTestsSection.tsx`, `GuidedResultsSection.tsx`, `ReviewAnalysisDataDialog.tsx`: seções focadas.
- Modify `src/routes/variaveis/VariaveisPage.tsx`, `VariableDetailPanel.tsx`: ativar fluxo guiado e simplificar modo catálogo direto.

---

### Task 1: Contratos de pesquisa, fingerprint e agregação temporal

**Files:**
- Create: `src/features/research/types.ts`
- Create: `src/features/research/researchDesign.ts`
- Create: `src/features/research/variableProfiles.ts`
- Create: `src/features/research/aggregatePeriod.ts`
- Test: `src/features/research/researchDesign.test.ts`
- Test: `src/features/research/aggregatePeriod.test.ts`

**Interfaces:**
- Produces: `ResearchDesign`, `VariableProfile`, `AnalysisCell`, `GuidedAnalysisState`, `fingerprintResearchDesign(design)`, `validateResearchDesign(design)`, `aggregatePeriod(cells, profile)`.
- Consumes: `TerritoryRef` and `GroupTimeConfig` from the existing Mapas domain only in the adapter; downstream research files depend only on `types.ts`.

- [ ] **Step 1: Write failing contract/fingerprint tests**

```ts
it('produces the same fingerprint for semantically equal group order', () => {
  const a = fixtureDesign({ groups: [baGroup, rjGroup] });
  const b = fixtureDesign({ groups: [rjGroup, baGroup] });
  expect(fingerprintResearchDesign(a)).toBe(fingerprintResearchDesign(b));
});

it('rejects a design without territory, disease or valid period', () => {
  expect(validateResearchDesign(fixtureDesign({ diseaseIds: [] })).ok).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and confirm missing-module failure**

Run: `npx vitest run src/features/research/researchDesign.test.ts`

Expected: FAIL because `researchDesign.ts` and its exports do not exist.

- [ ] **Step 3: Define exact domain contracts**

```ts
export type ResearchGoal = 'describe' | 'compare' | 'describe_and_compare';
export type LocationBasis = 'ocorrencia' | 'residencia';
export type SourceCellStatus =
  | 'observed' | 'collection_zero' | 'missing'
  | 'suppressed' | 'not_applicable' | 'not_queried';
export type AnalyticCellStatus =
  | 'include' | 'exclude_missing'
  | 'exclude_suspected_noncollection' | 'exclude_manual' | 'requires_review';
export type TemporalAggregation = 'sum' | 'recompute_rate' | 'weighted_mean' | 'point_only';
```

Add the full interfaces from the approved design and a stable JSON canonicalizer that sorts groups, territories and disease ids before hashing.

- [ ] **Step 4: Write failing period-aggregation tests**

```ts
it('sums counts but recomputes a rate from components', () => {
  expect(aggregatePeriod(countCells([10, 20]), countProfile).value).toBe(30);
  expect(aggregatePeriod(rateCells({ events: [5, 10], population: [100, 300] }), rateProfile).value)
    .toBeCloseTo(3750);
});

it('never averages annual percentages or substitutes the last year', () => {
  expect(aggregatePeriod(orphanRateCells([10, 20]), rateProfile).status).toBe('not_applicable');
});
```

- [ ] **Step 5: Implement profiles and aggregation minimally**

Define profiles for `internacoes`, `obitos`, `valor_total`, `dias_permanencia`, `taxa_mortalidade`, population-derived rates, calculated mean stay, and death outcome. Require matching components and return structured missing reasons instead of `NaN`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/features/research/researchDesign.test.ts src/features/research/aggregatePeriod.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/research
git commit -m "feat(research): define analysis contracts and period aggregation"
```

### Task 2: Repositório Supabase/Storage preparado para 40 clientes

**Files:**
- Create: `src/features/research/supabaseResearchRepository.ts`
- Create: `src/features/research/municipioPartitionIndex.ts`
- Test: `src/features/research/supabaseResearchRepository.test.ts`
- Test: `src/features/research/municipioPartitionIndex.test.ts`
- Modify: `src/features/catalog/loadMunicipioPartition.ts`
- Modify: `src/features/catalog/loadMunicipioPartition.test.ts`

**Interfaces:**
- Consumes: `ResearchDesign`, `VariableProfile`.
- Produces: `loadResearchCells(design, profiles, { signal? }): Promise<ResearchDataSnapshot>`, `clearResearchRepositoryCache()`, `indexMunicipioPartition(partition)`.

- [ ] **Step 1: Write failing batching/dedupe tests with an injected client**

```ts
it('deduplicates two concurrent identical research loads', async () => {
  const repo = createResearchRepository({ supabase: fakeClient });
  const [a, b] = await Promise.all([repo.load(design, profiles), repo.load(design, profiles)]);
  expect(a).toBe(b);
  expect(fakeClient.callsFor('sih_metric_uf')).toBe(1);
  expect(fakeClient.callsFor('sih_collection_status')).toBe(1);
});

it('does not issue a request per selected variable', async () => {
  await repo.load(design, fiveProfiles);
  expect(fakeClient.totalRequests).toBeLessThanOrEqual(3);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/features/research/supabaseResearchRepository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement one batched UF load**

Query `sih_metric_uf` once for all selected disease ids, territory codes, years and one `local`; select explicit columns and order by the complete key. Query `sih_collection_status` once for the same disease/measure/year/grain/local set. Query `sih_population_total_uf` once only when a profile needs exposure. Reject responses that reach the configured page size without exhausting pagination; paginate with a stable total order rather than accepting PostgREST's default limit.

- [ ] **Step 4: Add promise cache and bounded TTL**

Use `Map<string, { expiresAt: number; promise: Promise<ResearchDataSnapshot> }>` keyed by design/profile fingerprint. Cache only successful requests for five minutes; remove rejected/aborted promises. Do not put medical aggregate datasets in `localStorage`; memory cache is sufficient for a class session and avoids stale versions.

- [ ] **Step 5: Correct the municipal Storage path and index format**

Change the URL to `/storage/v1/object/public/sih-municipio/v1/{UF}.json.gz`, matching `partitions.py`. Update the fixture URL assertion. `indexMunicipioPartition` validates schema/parallel-array lengths once and builds maps keyed by `disease|municipio|ano|local`; it never scans the full array once per checkbox.

- [ ] **Step 6: Implement municipal loading on demand**

Load only the unique UF partitions containing selected municipalities. Reuse the existing promise cache in `loadMunicipioPartition`. Fetch municipal population in one PostgREST request for selected codes/years only. A failed partition creates `not_queried` cells and a recoverable error, never zero.

- [ ] **Step 7: Run repository and existing partition tests**

Run: `npx vitest run src/features/research/supabaseResearchRepository.test.ts src/features/research/municipioPartitionIndex.test.ts src/features/catalog/loadMunicipioPartition.test.ts`

Expected: PASS with one fetch for concurrent same-UF loads and no request-per-variable behavior.

- [ ] **Step 8: Commit**

```bash
git add src/features/research/supabaseResearchRepository.ts src/features/research/municipioPartitionIndex.ts src/features/research/*.test.ts src/features/catalog/loadMunicipioPartition.ts src/features/catalog/loadMunicipioPartition.test.ts
git commit -m "feat(research): load batched Supabase analysis data"
```

### Task 3: Disponibilidade, zero incompatível e cenários

**Files:**
- Create: `src/features/research/availability.ts`
- Create: `src/features/research/zeroPolicy.ts`
- Create: `src/features/research/scenarios.ts`
- Test: `src/features/research/availability.test.ts`
- Test: `src/features/research/zeroPolicy.test.ts`
- Test: `src/features/research/scenarios.test.ts`

**Interfaces:**
- Consumes: `ResearchDataSnapshot`, `AnalysisCell[]`, `VariableProfile`.
- Produces: `summarizeAvailability(cells)`, `recommendZeroPolicy(input)`, `createRecommendedScenario(cells)`, `reviseScenario(base, decisions)`.

- [ ] **Step 1: Write failing availability tests**

```ts
it.each([
  ['complete', [observed(10), collectionZero()]],
  ['partial', [observed(10), missing('BA', 2025)]],
  ['none', [missing('BA', 2025), notQueried('SE', 2025)]],
])('classifies %s coverage', (expected, cells) => {
  expect(summarizeAvailability(cells).state).toBe(expected);
});
```

Assert that the partial reason names exact states/years and that `none` disables selection.

- [ ] **Step 2: Write failing zero-policy tests**

Cover: an abrupt state zero among 10,000–21,000 values becomes analytically excluded; the raw `collection_zero` stays unchanged; municipal, rare and group `<10` become `requires_review`; missing history never autoexcludes.

- [ ] **Step 3: Implement fail-closed policies**

Keep thresholds in one exported `ZERO_POLICY_CONFIG` (`minimumComparable=5`, `positiveShare=0.8`, `minimumExpected=20`, `smallIndependentGroup=10`, `unstableRateEvents=16`). Use robust medians for territory history and exposure-normalized peers. Emit stable `reasonCode`s and a short Portuguese explanation.

- [ ] **Step 4: Write scenario immutability/recalculation tests**

```ts
it('keeps recommended raw cells and creates a researcher-reviewed scenario', () => {
  const revised = reviseScenario(recommended, [includeOriginal('BA', 2025)]);
  expect(revised.kind).toBe('researcher_reviewed');
  expect(recommended.cells[0]?.analyticStatus).toBe('exclude_suspected_noncollection');
  expect(revised.cells[0]?.rawValue).toBe(0);
});
```

- [ ] **Step 5: Implement scenarios and fingerprints**

Require a justification for excluding a positive observed value. Mark a revision created after results as exploratory. Return a scenario comparison containing changed `n`, effect direction and `interpretationChanged` hooks for Task 10.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run src/features/research/availability.test.ts src/features/research/zeroPolicy.test.ts src/features/research/scenarios.test.ts`

```bash
git add src/features/research
git commit -m "feat(research): classify coverage and review zero anomalies"
```

### Task 4: Perfil dos dados e elegibilidade fail-closed

**Files:**
- Create: `src/features/research/profiling.ts`
- Create: `src/features/research/eligibility.ts`
- Test: `src/features/research/profiling.test.ts`
- Test: `src/features/research/eligibility.test.ts`
- Modify: `src/features/catalog/suggestTestForVariable.ts`
- Modify: `src/features/catalog/suggestTestForVariable.test.ts`
- Modify: `src/routes/mapas/suggestResearchForSelection.ts`
- Modify: `src/routes/mapas/suggestResearchForSelection.test.ts`

**Interfaces:**
- Consumes: `ResearchDesign`, `AnalysisScenario`, `VariableProfile[]`.
- Produces: `profileVariable(cells, profile)`, `evaluateTests(input): EligibilityDecision[]`.

- [ ] **Step 1: Write profiling tests**

Test descriptive summaries, complete pairs, zero share, Q–Q points, Shapiro supported/insufficient states, and within-group rather than pooled normality.

- [ ] **Step 2: Implement deterministic profiling**

Provide mean, median, sample SD, IQR, min/max, skewness, outlier flags, histogram bins, theoretical normal quantiles and Shapiro–Wilk for `3 ≤ n ≤ 5000`. Classify `approximately_normal`, `non_normal`, `insufficient` or `not_applicable`; do not decide from Shapiro alone.

- [ ] **Step 3: Write eligibility matrix tests before implementation**

Assert no default t for empty/text data; one observation per group blocks t/ANOVA/Mann–Whitney/Kruskal; two independent numeric groups offer Welch and Mann–Whitney when defensible; repeated state-years block iid comparisons/correlation; count without exposure blocks Poisson; aggregated catalog blocks logistic; Prais requires one regular series and at least eight points; chi-square requires observed counts and valid expected cells.

- [ ] **Step 4: Implement the pure eligibility engine**

Return one decision per registered test with `eligible`, `eligible_with_caveat` or `ineligible`, reason codes, role assignments and diagnostics used. Require explicit outcome/predictor roles for directional models. Apply complete-pair and complete-model rules without globally deleting unrelated cells.

- [ ] **Step 5: Remove unsafe suggestion fallbacks**

Make both legacy suggestion modules thin adapters that return `[]`/ineligible context when actual design/data are absent. Delete the tests that expect empty/text → t and count label → Poisson; replace them with fail-closed expectations.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npx vitest run src/features/research/profiling.test.ts src/features/research/eligibility.test.ts src/features/catalog/suggestTestForVariable.test.ts src/routes/mapas/suggestResearchForSelection.test.ts && npm run typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/features/research src/features/catalog/suggestTestForVariable* src/routes/mapas/suggestResearchForSelection*
git commit -m "feat(stats): add fail-closed test eligibility"
```

### Task 5: Mann–Whitney de primeira classe

**Files:**
- Create: `src/features/tests/mann-whitney/mannWhitneyEngine.ts`
- Create: `src/features/tests/mann-whitney/mannWhitneyEngine.test.ts`
- Create: `src/features/tests/mann-whitney/mannWhitneyConfig.ts`
- Create: `src/features/tests/mann-whitney/mannWhitneyInterpretation.ts`
- Create: `src/features/tests/mann-whitney/mannWhitneyCharts.ts`
- Create: `src/features/tests/mann-whitney/MannWhitneyConfigPanel.tsx`
- Create: `src/features/tests/mann-whitney/MannWhitneyTest.tsx`
- Create: `src/features/tests/mann-whitney/MannWhitneyTest.test.tsx`
- Create: `tests/fixtures/golden/mann-whitney-exemplo.golden.json`
- Modify: `scripts/oracle/generate-phase3-fixtures.R`
- Modify: `src/features/tests/registry.ts`
- Modify: `src/features/tests/registry.test.ts`
- Modify: `src/routes/estatistica/EstatisticaPage.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.test.tsx`
- Modify: `src/routes/estatistica/SidebarTestLink.tsx`
- Modify: `src/routes/estatistica/QualTesteModal.test.tsx`

**Interfaces:**
- Produces: `runMannWhitney(groupA, groupB, options): MannWhitneyResult` with `u`, `u1`, `u2`, `pValue`, `method`, `rankBiserial`, `probabilityOfSuperiority`, tie diagnostics and group summaries.

- [ ] **Step 1: Add external golden fixtures**

Extend the R oracle with independent `wilcox.test(x, y, paired=FALSE, exact=...)` cases: no ties/small exact, ties/asymptotic and shifted groups. Record group values, W/U conversion and p-values in JSON.

- [ ] **Step 2: Write failing engine tests against the golden values**

Assert average ranks for ties, exact method only when supported, asymptotic variance tie correction, two-sided p, rank-biserial sign and probability of superiority.

- [ ] **Step 3: Implement the engine**

Rank the pooled values with midranks; calculate `U1 = R1 - n1(n1+1)/2`, `U2=n1*n2-U1`; use exact dynamic-programming distribution without ties for small products, otherwise normal approximation with tie/continuity correction. Never describe the result automatically as a median test.

- [ ] **Step 4: Register the test and make exhaustive rendering compile**

Add id `mann-whitney`, group `Comparações`, status `available`, its icon, sidebar/modal item and `case` in `EstatisticaPage`.

- [ ] **Step 5: Build the manual module using existing input/results patterns**

Reuse the t-test two-group column mapping and `ResultsPanelWithCustomizer`. Show U, exact/asymptotic method, p, rank-biserial/probability effect, group medians/IQR and a rank/dot plot.

- [ ] **Step 6: Run all Mann/registry/UI tests**

Run: `npx vitest run src/features/tests/mann-whitney src/features/tests/registry.test.ts src/routes/estatistica/EstatisticaPage.test.tsx src/routes/estatistica/QualTesteModal.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add scripts/oracle/generate-phase3-fixtures.R tests/fixtures/golden/mann-whitney-exemplo.golden.json src/features/tests/mann-whitney src/features/tests/registry* src/routes/estatistica src/shared/charts
git commit -m "feat(stats): add Mann-Whitney analysis"
```

### Task 6: Corrigir Prais e endurecer modelos de contagem

**Files:**
- Modify: `src/features/tests/prais-winsten/praisEngine.ts`
- Modify: `src/features/tests/prais-winsten/praisEngine.test.ts`
- Modify: `src/features/tests/prais-winsten/praisInterpretation.ts`
- Modify: `src/features/tests/poisson/poissonEngine.ts`
- Modify: `src/features/tests/poisson/poissonEngine.test.ts`
- Modify: `src/features/tests/binomial-negativa/binomialNegativaEngine.ts`
- Modify: `src/features/tests/binomial-negativa/binomialNegativaEngine.test.ts`

**Interfaces:**
- Produces: Prais result with `scale: 'log' | 'original'`; Poisson/NB configurations with optional required `exposure` and model offset.

- [ ] **Step 1: Write Prais zero regression tests**

Assert `0` remains in ordered rows, a positive-only series uses log/APC, a series containing confirmed zero uses original scale/absolute change, and missing gaps fail rather than connect.

- [ ] **Step 2: Implement zero-preserving Prais behavior**

Change the row guard from `yValue > 0` to `yValue >= 0`. Choose scale after dataset assembly. Do not add a pseudocount. Update labels and interpretation by scale.

- [ ] **Step 3: Write Poisson/NB exposure tests**

Use a golden fixture where equal rates with different populations produce an incidence-rate ratio near one only when `log(exposure)` is an offset. Assert exposure `<=0` or absent in territorial comparison fails validation.

- [ ] **Step 4: Add offset to IRLS/log-likelihood paths**

Thread `offset: log(exposure)` through linear predictors for Poisson and NB, keep backward compatibility for explicit manual frequency models, and expose an eligibility diagnostic for overdispersion/excess zeros.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run src/features/tests/prais-winsten src/features/tests/poisson src/features/tests/binomial-negativa`

```bash
git add src/features/tests/prais-winsten src/features/tests/poisson src/features/tests/binomial-negativa
git commit -m "fix(stats): preserve zeros and model count exposure"
```

### Task 7: Mapa com valor, zero e sem dados

**Files:**
- Modify: `src/geo/choroplethScale.ts`
- Modify: `src/geo/choroplethScale.test.ts`
- Modify: `src/routes/mapas/BrazilMapCanvas.tsx`
- Modify: `src/routes/mapas/BrazilMockMap.test.tsx`
- Modify: `src/routes/mapas/ChoroplethLegend.tsx`
- Modify: `src/routes/mapas/ChoroplethLegend.test.tsx`

**Interfaces:**
- Consumes: `MapMetricCell = { value: number | null; displayStatus: 'value' | 'zero' | 'missing' | 'review' }`.
- Produces: a scale built only from positive finite values and explicit legend entries for `0`, `Sem dados` and `Revisar` when present.

- [ ] **Step 1: Write failing scale and legend tests**

Assert `[null, 0, 5, 10]` uses domain `[5,10]`; missing fill differs from every ramp color and zero fill; legend labels zero and sem dados separately.

- [ ] **Step 2: Implement typed map cells**

Remove `metric !== undefined`/implicit coercion. Resolve fill by status before calling the scale. Add an SVG hatch pattern for missing/review and accessible tooltip copy containing raw zero when analytically excluded.

- [ ] **Step 3: Run map tests and commit**

Run: `npx vitest run src/geo/choroplethScale.test.ts src/routes/mapas/BrazilMockMap.test.tsx src/routes/mapas/ChoroplethLegend.test.tsx`

```bash
git add src/geo/choroplethScale* src/routes/mapas/BrazilMapCanvas.tsx src/routes/mapas/BrazilMockMap.test.tsx src/routes/mapas/ChoroplethLegend*
git commit -m "fix(maps): distinguish zero from missing data"
```

### Task 8: Handoff Mapas → Variáveis e sessão

**Files:**
- Modify: `src/shared/session/SessionProvider.tsx`
- Modify: `src/shared/session/SessionProvider.test.tsx`
- Modify: `src/routes/mapas/mapAnalysisState.ts`
- Modify: `src/routes/mapas/mapAnalysisState.test.ts`
- Modify: `src/routes/mapas/MapasPage.tsx`
- Modify: `src/routes/mapas/MapasPage.test.tsx`
- Modify: `src/routes/mapas/MapPrimaryActionBar.tsx`
- Modify: `src/routes/mapas/ReviewAnalysisDialog.tsx`
- Modify: `src/routes/mapas/ReviewAnalysisDialog.test.tsx`

**Interfaces:**
- Consumes: `createResearchDesignFromMapState(state)`.
- Produces: session `researchDesign`, `setResearchDesign`, `guidedAnalysis`, `setGuidedAnalysis`; navigation to `/variaveis` without `activeTestId` or preassembled dataset.

- [ ] **Step 1: Write session and adapter tests**

Assert diseases are unique and independent from measures; groups/territories/local/period are preserved; clearing session clears guided state; changing design fingerprint discards incompatible guided results.

- [ ] **Step 2: Write the Mapas handoff integration test**

Select/create a group, disease and period; click **Continuar para Variáveis**; assert `/variaveis`, populated `researchDesign`, no dataset and no test id.

- [ ] **Step 3: Implement the new handoff**

Keep the existing disease picker storage temporarily behind the adapter, but remove per-group measure selection from the visible flow. Change completion to territories+disease+period. Replace test suggestion/review UI with a concise recorte review and CTA.

- [ ] **Step 4: Update copy and direct-route behavior**

Blocked hint says “Complete grupos, doença e período”. Opening `/variaveis` directly still shows the simplified catalog mode; a guided session activates the progressive flow.

- [ ] **Step 5: Run Mapas/session tests and commit**

Run: `npx vitest run src/shared/session/SessionProvider.test.tsx src/routes/mapas`

```bash
git add src/shared/session src/routes/mapas
git commit -m "feat(maps): hand research design to variables"
```

### Task 9: Fluxo progressivo de Variáveis e disponibilidade real

**Files:**
- Create: `src/routes/variaveis/GuidedResearchFlow.tsx`
- Create: `src/routes/variaveis/ResearchGoalSection.tsx`
- Create: `src/routes/variaveis/GuidedVariableSelector.tsx`
- Create: `src/routes/variaveis/DataProfileSection.tsx`
- Create: `src/routes/variaveis/EligibleTestsSection.tsx`
- Create: `src/routes/variaveis/useGuidedResearch.ts`
- Test: `src/routes/variaveis/GuidedResearchFlow.test.tsx`
- Modify: `src/routes/variaveis/VariaveisPage.tsx`
- Modify: `src/routes/variaveis/VariableDetailPanel.tsx`
- Modify: `src/routes/variaveis/VariaveisPage.test.tsx`

**Interfaces:**
- Consumes: repository, availability, profiling, eligibility and session contracts from Tasks 1–4/8.
- Produces: selected goal/variables, current scenario, diagnostics and eligible test ids in `GuidedAnalysisState`.

- [ ] **Step 1: Write progressive-flow tests with a fake repository**

Assert only goal is open first; variables open after goal; data profile after checkbox; tests after required review; results remain absent until tests are selected. Assert **Descrever e comparar** produces both paths.

- [ ] **Step 2: Write variable-grid coverage tests**

Assert columns `Contagens`, `Taxas e percentuais`, `Numéricas`, `Categóricas e ordinais`; complete enabled; partial muted but enabled with exact reason; none muted and disabled. Assert checkbox toggles never call the repository again for the same snapshot.

- [ ] **Step 3: Implement orchestration hook**

Load one snapshot per research fingerprint with `AbortController`; derive profiles/availability in memory; reset downstream state synchronously when goal or variables change; ignore stale promises by fingerprint.

- [ ] **Step 4: Implement concise components**

Use short label, type and one coverage line. Move source/provenance to a closed `Collapsible`. Direct catalog mode removes the always-open provenance wall and unsafe “teste sugerido” card.

- [ ] **Step 5: Implement Conheça seus dados**

Show expected/available/used/missing counts, summaries, normality label and distribution presets. Counts show zero share/dispersion instead of normality; categoricals show frequencies.

- [ ] **Step 6: Implement eligible test selection**

Show all tests grouped by status and reasons. Allow multiple eligible tests, require one primary before results, identify additional tests as sensitivity, and request outcome/predictor roles for directional models.

- [ ] **Step 7: Run Variáveis tests and commit**

Run: `npx vitest run src/routes/variaveis src/features/research && npm run typecheck`

```bash
git add src/routes/variaveis src/features/research src/shared/charts
git commit -m "feat(variables): add guided variable selection and diagnostics"
```

### Task 10: Resultados inline, revisão e análise de sensibilidade

**Files:**
- Create: `src/routes/variaveis/GuidedResultsSection.tsx`
- Create: `src/routes/variaveis/ReviewAnalysisDataDialog.tsx`
- Create: `src/routes/variaveis/runGuidedTests.ts`
- Test: `src/routes/variaveis/GuidedResultsSection.test.tsx`
- Test: `src/routes/variaveis/ReviewAnalysisDataDialog.test.tsx`
- Test: `src/routes/variaveis/runGuidedTests.test.ts`
- Create: `src/shared/charts/chartFactories/distributionCharts.ts`
- Test: `src/shared/charts/chartFactories/distributionCharts.test.ts`
- Modify: `src/shared/charts/chartFactories/index.ts`

**Interfaces:**
- Consumes: `AnalysisScenario`, profiles, selected primary/sensitivity tests and existing test engines.
- Produces: `GuidedTestResult[]`, conclusion copy, map cells and revised-scenario comparison.

- [ ] **Step 1: Write engine-adapter tests**

Verify correct available-case/complete-pair/complete-model rows, Holm adjustment across confirmatory variables, no engine call for ineligible test and outputs tagged by scenario fingerprint.

- [ ] **Step 2: Implement typed adapters, not duplicated math**

Map research cells to existing t/ANOVA/Kruskal/correlation/Prais/chi-square/Poisson/NB/Mann engines. For death proportion, build `obitos` and `internacoes-obitos` only after coverage/ordering validation. Reject aggregated logistic input.

- [ ] **Step 3: Build distribution/chart factories**

Generate histogram, Q–Q, group dot/rank chart and map inputs; feed them into `ResultsPanelWithCustomizer`. Reuse existing scatter, time series, residual, forest and post-hoc heatmap factories.

- [ ] **Step 4: Write result copy tests**

Assert effect/CI precede p, coverage appears, ecological limitation appears for territory results, excluded zero reason is one sentence, and no “significativo = importante/causal” wording exists.

- [ ] **Step 5: Implement the review dialog**

Rows show territory/period, raw value, classification, used status and reason. Missing-without-value cannot be included. Actions use original/treat missing/restore recommendation. Positive observed exclusion requires text justification.

- [ ] **Step 6: Recalculate atomically and compare scenarios**

Clear displayed results before applying a new scenario; recompute profiles, eligibility, engines, charts, map and conclusion. Keep recommended results and mark post-result revisions exploratory. Explain whether direction/magnitude/interpretation changed.

- [ ] **Step 7: Run result/UI tests and commit**

Run: `npx vitest run src/routes/variaveis src/shared/charts/chartFactories`

```bash
git add src/routes/variaveis src/shared/charts
git commit -m "feat(variables): run and review analyses inline"
```

### Task 11: Concorrência, integração e gate final

**Files:**
- Create: `src/features/research/concurrency.test.ts`
- Modify: `src/routes/variaveis/GuidedResearchFlow.test.tsx`
- Modify: `src/routes/mapas/MapasPage.test.tsx`
- Modify: relevant existing test expectations uncovered by the new fail-closed rules.

**Interfaces:**
- Consumes all prior tasks.
- Produces a verified end-to-end release candidate; no new production API.

- [ ] **Step 1: Add a 40-client repository simulation**

Instantiate 40 independent research loads against a deterministic fake Supabase transport. Assert every client makes at most the bounded UF/ledger/population request count, no client makes requests per checkbox, response rows are complete across pagination and no promise remains cached after failure.

- [ ] **Step 2: Add end-to-end component flow**

Test Mapas group+disease+period → Variáveis goal+checkboxes → distribution → two eligible tests → inline result → revise zero → recalculated scenario. Include partial coverage and a zero/no-data map legend.

- [ ] **Step 3: Run focused suites with no pipeline dependency**

Run: `npx vitest run src/features/research src/features/tests/mann-whitney src/routes/mapas src/routes/variaveis src/features/catalog src/shared/charts`

Expected: PASS.

- [ ] **Step 4: Run static gates**

Run: `npm run catalog:validate && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 5: Run the repository gate and attribute parallel failures**

Run: `npm run test:run`

Expected: PASS after the owner of the parallel `audit.py` change updates its two signature tests. If those exact unrelated tests still fail, record their names/output, prove all feature/static gates pass, and do not edit/stage the pipeline file.

- [ ] **Step 6: Browser smoke test against configured Supabase**

Run `npm run dev`, open the local site, perform one UF analysis and one municipal analysis, inspect the Network panel: no service key, no DATASUS request, bounded batched PostgREST calls, one Storage partition fetch per UF, cached repeated selection, zero and sem dados distinct.

- [ ] **Step 7: Commit final integration fixes**

```bash
git add src
git commit -m "test(research): verify guided analysis under class load"
```

- [ ] **Step 8: Request code review and finish branch**

Use `superpowers:requesting-code-review`, address findings with `superpowers:receiving-code-review`, rerun verification, then use `superpowers:finishing-a-development-branch` to offer integration options.
