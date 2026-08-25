# Mapas Independent Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the automatic population-first map flow with explicit, independently configured groups, fail-closed comparison assessment, and test-specific chart choices visible under `npm run dev`.

**Architecture:** Keep `MapAnalysisState` as the persisted source of truth for confirmed groups and hold the unconfirmed territory draft locally in `MapasPage`. A pure comparison-assessment module derives the only differing dimension, dependency structure, issues, and safe candidate tests; the UI renders that result before enabling the existing guided workspace. Chart presets remain owned by each test, while the customizer stops advertising irrelevant universal chart types.

**Tech Stack:** React 19, TypeScript 5.9, Vitest/Testing Library, Chart.js 4, Tailwind 4, Vite 8.

**Spec:** `docs/superpowers/specs/2026-08-20-mapas-grupos-independentes-design.md`

## Global Constraints

- A map click never creates a group automatically.
- Groups own their own territories, disease × measure IDs, and period.
- A territory may belong to multiple groups but may not duplicate inside one group.
- No missing value becomes zero and no unavailable denominator is invented.
- Inferential analysis fails closed when more than one analytical dimension differs.
- `/estatistica` and `/variaveis` keep their current behavior.
- Every production behavior is introduced with a failing test first.

---

### Task 1: Pure Comparison Assessment

**Files:**
- Create: `src/routes/mapas/comparisonAssessment.ts`
- Test: `src/routes/mapas/comparisonAssessment.test.ts`

**Interfaces:**
- Consumes: `MapAnalysisGroup[]`, `parseCatalogId()`, `MEASURES`.
- Produces: `assessGroupComparison(groups): ComparisonAssessment`, `groupCompletionIssues(group): ComparisonIssue[]`.

- [ ] **Step 1: Write the failing table-driven assessment tests**

```ts
it.each([
  ['place', [group('A', ['BA'], '2019', 'embolia', 'taxa_internacao'), group('B', ['RJ'], '2019', 'embolia', 'taxa_internacao')], 'independent_place', true],
  ['period', [group('A', ['BA'], '2019', 'embolia', 'taxa_internacao'), group('B', ['BA'], '2023', 'embolia', 'taxa_internacao')], 'paired_period', true],
  ['confounded', [group('A', ['BA'], '2019', 'embolia', 'taxa_internacao'), group('B', ['RJ'], '2023', 'diabetes', 'taxa_internacao')], 'confounded', false],
])('%s derives the safe design', (_name, groups, designKind, canInfer) => {
  expect(assessGroupComparison(groups)).toMatchObject({ designKind, canInfer });
});
```

- [ ] **Step 2: Run the tests and confirm missing-module failure**

Run: `npx vitest run src/routes/mapas/comparisonAssessment.test.ts`
Expected: FAIL because `comparisonAssessment.ts` does not exist.

- [ ] **Step 3: Implement canonical signatures, overlap relation, issues, and candidate tests**

```ts
export type ComparisonDimension = 'territory' | 'disease' | 'measure' | 'period';
export type ComparisonDesignKind = 'descriptive' | 'independent_place' | 'paired_period' | 'paired_disease' | 'time_series' | 'confounded' | 'unsupported';
export interface ComparisonIssue { code: string; severity: 'block' | 'warning' | 'info'; title: string; message: string; groupIds: string[]; remediation?: string }
export interface ComparisonAssessment { designKind: ComparisonDesignKind; differingDimensions: ComparisonDimension[]; issues: ComparisonIssue[]; canDescribe: boolean; canInfer: boolean; candidateTestIds: string[] }
export function assessGroupComparison(groups: MapAnalysisGroup[]): ComparisonAssessment;
```

- [ ] **Step 4: Run the assessment tests**

Run: `npx vitest run src/routes/mapas/comparisonAssessment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/mapas/comparisonAssessment.ts src/routes/mapas/comparisonAssessment.test.ts
git commit -m "feat(maps): assess group comparability"
```

### Task 2: Explicit Group State and Overlap

**Files:**
- Modify: `src/routes/mapas/mapAnalysisState.ts`
- Modify: `src/routes/mapas/mapAnalysisState.test.ts`

**Interfaces:**
- Consumes: existing `MapAnalysisAction` reducer boundary.
- Produces: `groupsForTerritory(state, territory): MapAnalysisGroup[]`; group creation with blank independent config.

- [ ] **Step 1: Write failing reducer tests**

```ts
it('creates an explicit blank group without inheriting disease or period', () => {
  const next = mapAnalysisReducer(stateWithConfiguredGroup, { type: 'CREATE_GROUP', territories: [ba] });
  expect(next.groups[1]).toMatchObject({ variableIds: [], time: { mode: 'point' } });
});

it('allows Bahia in two groups while deduplicating inside each group', () => {
  const next = mapAnalysisReducer(twoGroups, { type: 'MERGE_TERRITORIES_TO_GROUP', groupId: 'b', territories: [ba, ba] });
  expect(groupsForTerritory(next, ba).map((group) => group.id)).toEqual(['a', 'b']);
  expect(next.groups[1]!.territoryIds).toHaveLength(1);
});
```

- [ ] **Step 2: Run and confirm behavioral failures**

Run: `npx vitest run src/routes/mapas/mapAnalysisState.test.ts`
Expected: FAIL because new groups inherit shared config and `groupsForTerritory` is absent.

- [ ] **Step 3: Implement independent group creation and multi-membership lookup**

```ts
export function groupsForTerritory(state: MapAnalysisState, territory: TerritoryRef): MapAnalysisGroup[] {
  const key = territoryKey(territory);
  return state.groups.filter((group) => group.territoryIds.some((item) => territoryKey(item) === key));
}
```

Keep `territoryOwner()` as a deprecated first-match adapter for untouched callers, but remove it from `MapasPage`.

- [ ] **Step 4: Run reducer and preset tests**

Run: `npx vitest run src/routes/mapas/mapAnalysisState.test.ts src/routes/mapas/groupSelectionPresets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/mapas/mapAnalysisState.ts src/routes/mapas/mapAnalysisState.test.ts
git commit -m "feat(maps): make groups independent and overlapping"
```

### Task 3: Explicit Territory Draft and Group Strip

**Files:**
- Create: `src/routes/mapas/TerritoryDraftBar.tsx`
- Create: `src/routes/mapas/TerritoryDraftBar.test.tsx`
- Modify: `src/routes/mapas/PopulationGroupBar.tsx`
- Modify: `src/routes/mapas/PopulationGroupBar.test.tsx`
- Modify: `src/routes/mapas/GroupChip.tsx`

**Interfaces:**
- Consumes: draft count/list and `MapAnalysisState`.
- Produces: callbacks `onCreateGroup()`, `onStartNewGroup()`, `onEditGroupTerritories(groupId)`.

- [ ] **Step 1: Write failing component tests for the explicit CTA and group status**

```tsx
expect(screen.getByText('Seleção atual')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Criar Grupo 1' })).toBeEnabled();
await user.click(screen.getByRole('button', { name: 'Criar Grupo 1' }));
expect(onCreateGroup).toHaveBeenCalledOnce();
expect(screen.getByRole('button', { name: 'Novo grupo' })).toBeInTheDocument();
```

- [ ] **Step 2: Run and confirm missing-component failures**

Run: `npx vitest run src/routes/mapas/TerritoryDraftBar.test.tsx src/routes/mapas/PopulationGroupBar.test.tsx`
Expected: FAIL because the draft bar and new callbacks do not exist.

- [ ] **Step 3: Implement draft bar, group terminology, status summaries, and keyboard focus**

`PopulationGroupBar` must render `aria-label="Grupos da análise"`, the existing group chips, and **Novo grupo**. It must never dispatch `CREATE_GROUP` itself.

- [ ] **Step 4: Run component tests**

Run: `npx vitest run src/routes/mapas/TerritoryDraftBar.test.tsx src/routes/mapas/PopulationGroupBar.test.tsx src/routes/mapas/GroupBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/mapas/TerritoryDraftBar.tsx src/routes/mapas/TerritoryDraftBar.test.tsx src/routes/mapas/PopulationGroupBar.tsx src/routes/mapas/PopulationGroupBar.test.tsx src/routes/mapas/GroupChip.tsx
git commit -m "feat(maps): add explicit territory draft"
```

### Task 4: Per-Group Disease, Measure, and Period Editor

**Files:**
- Modify: `src/routes/mapas/GroupConfigPanel.tsx`
- Modify: `src/routes/mapas/GroupConfigPanel.test.tsx`
- Modify: `src/routes/mapas/TemporalidadeControl.tsx`
- Modify: `src/routes/mapas/MeasureDiseasePicker.tsx`
- Modify: `src/routes/mapas/MeasureDiseasePicker.test.tsx`

**Interfaces:**
- Consumes: one `MapAnalysisGroup`, reducer dispatch.
- Produces: full group-local editor with disease, measure, time, and summary.

- [ ] **Step 1: Write failing tests proving groups do not update each other**

```tsx
await user.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'TOGGLE_GROUP_VARIABLE', groupId: 'group-a' }));
expect(screen.getByLabelText('Período de Grupo A')).toBeInTheDocument();
expect(screen.getByText(/Lugar: BA/)).toBeInTheDocument();
```

- [ ] **Step 2: Run and confirm missing editor behavior**

Run: `npx vitest run src/routes/mapas/GroupConfigPanel.test.tsx src/routes/mapas/MeasureDiseasePicker.test.tsx`
Expected: FAIL because the current panel only shows measures and assumes shared disease/time.

- [ ] **Step 3: Implement the complete editor**

Render disease search first, `TemporalidadeControl` with `SET_GROUP_TIME`, then compatible measure pills. Remove `periodScope` copy from the panel and use text “deste grupo”.

- [ ] **Step 4: Run editor tests**

Run: `npx vitest run src/routes/mapas/GroupConfigPanel.test.tsx src/routes/mapas/MeasureDiseasePicker.test.tsx src/routes/mapas/SharedDiseasePanel.test.tsx src/routes/mapas/SharedPeriodPanel.test.tsx`
Expected: PASS, including legacy shared components that remain used outside the new Mapas path.

- [ ] **Step 5: Commit**

```bash
git add src/routes/mapas/GroupConfigPanel.tsx src/routes/mapas/GroupConfigPanel.test.tsx src/routes/mapas/TemporalidadeControl.tsx src/routes/mapas/MeasureDiseasePicker.tsx src/routes/mapas/MeasureDiseasePicker.test.tsx
git commit -m "feat(maps): configure disease and period per group"
```

### Task 5: Map Page Orchestration and Comparison Review

**Files:**
- Create: `src/routes/mapas/GroupComparisonReview.tsx`
- Create: `src/routes/mapas/GroupComparisonReview.test.tsx`
- Modify: `src/routes/mapas/MapasPage.tsx`
- Modify: `src/routes/mapas/MapasPage.test.tsx`
- Modify: `src/routes/mapas/MapasPage.reduced-motion.test.tsx`
- Modify: `src/routes/mapas/MapPrimaryActionBar.tsx`
- Modify: `src/routes/mapas/MapPrimaryActionBar.test.tsx`

**Interfaces:**
- Consumes: `assessGroupComparison`, explicit draft components, active group editor.
- Produces: rendered matrix/issues and safe `researchDesign`/guided-analysis gate.

- [ ] **Step 1: Write the failing integration tests**

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
expect(screen.queryByRole('tab', { name: /Grupo 1/ })).not.toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 1' }));
expect(screen.getByRole('tab', { name: /Grupo 1/ })).toBeInTheDocument();
expect(screen.getByText(/Somente o período mudou/)).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Começar análise' })).toBeDisabled();
```

Add a second test where compatible place groups enable the action and a confounded selection remains descriptive-only.

- [ ] **Step 2: Run and confirm current automatic-flow failures**

Run: `npx vitest run src/routes/mapas/MapasPage.test.tsx src/routes/mapas/GroupComparisonReview.test.tsx`
Expected: FAIL because Bahia currently creates `População selecionada` immediately.

- [ ] **Step 3: Rewire `MapasPage` around local draft selection**

```ts
const [draft, setDraft] = useState<TerritoryRef[]>([]);
const createGroupFromDraft = () => {
  if (draft.length === 0) return;
  dispatch({ type: 'CREATE_GROUP', name: `Grupo ${state.groups.length + 1}`, territories: draft });
  setDraft([]);
};
```

Remove `MapQuestionBuilder` from the route. Render `GroupConfigPanel` for the active group and `GroupComparisonReview` when at least one group exists. Use the assessment to set `goal` (`describe` when blocked, `describe_and_compare` when inferential) and to block **Começar análise**.

- [ ] **Step 4: Run route tests**

Run: `npx vitest run src/routes/mapas/MapasPage.test.tsx src/routes/mapas/MapasPage.reduced-motion.test.tsx src/routes/mapas/GroupComparisonReview.test.tsx src/routes/mapas/MapPrimaryActionBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/mapas/GroupComparisonReview.tsx src/routes/mapas/GroupComparisonReview.test.tsx src/routes/mapas/MapasPage.tsx src/routes/mapas/MapasPage.test.tsx src/routes/mapas/MapasPage.reduced-motion.test.tsx src/routes/mapas/MapPrimaryActionBar.tsx src/routes/mapas/MapPrimaryActionBar.test.tsx
git commit -m "feat(maps): restore group-first analysis flow"
```

### Task 6: Multi-Group Map Membership

**Files:**
- Modify: `src/routes/mapas/BrazilMockMap.tsx`
- Modify: `src/routes/mapas/BrazilMapCanvas.tsx`
- Modify: `src/routes/mapas/BrazilMockMap.test.tsx`

**Interfaces:**
- Consumes: `Record<string, GroupMembership[]>` for UF and municipality membership.
- Produces: active fill plus multi-color SVG outlines and accessible group list.

- [ ] **Step 1: Write a failing overlap rendering test**

```tsx
render(<BrazilMockMap groupMembership={{ BA: [membership(0, 'Grupo 1'), membership(1, 'Grupo 2')] }} />);
expect(screen.getByRole('button', { name: 'Bahia' })).toHaveAccessibleDescription(/Grupo 1.*Grupo 2/);
expect(screen.getByRole('button', { name: 'Bahia' })).toHaveAttribute('data-group-count', '2');
```

- [ ] **Step 2: Run and confirm the old single-owner contract fails**

Run: `npx vitest run src/routes/mapas/BrazilMockMap.test.tsx`
Expected: FAIL on the array membership contract.

- [ ] **Step 3: Implement array membership and concentric outline layers**

Keep the first membership fill for contrast and render one no-fill outline path per membership, increasing stroke width/order. The title/description joins all group names.

- [ ] **Step 4: Run map tests**

Run: `npx vitest run src/routes/mapas/BrazilMockMap.test.tsx src/routes/mapas/ChoroplethLegend.test.tsx src/routes/mapas/MapasPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/mapas/BrazilMockMap.tsx src/routes/mapas/BrazilMapCanvas.tsx src/routes/mapas/BrazilMockMap.test.tsx
git commit -m "feat(maps): render overlapping group membership"
```

### Task 7: Test-Specific Chart Choices and Raw-Data Defaults

**Files:**
- Modify: `src/shared/charts/ChartCustomizer.tsx`
- Modify: `src/shared/charts/ChartCanvas.test.tsx`
- Modify: `src/shared/charts/chartFactories/tStudentCharts.ts`
- Modify: `src/shared/charts/chartFactories/anovaChart.ts`
- Modify: `src/features/tests/t-student/tStudentCharts.ts`
- Modify: `src/features/tests/anova-tukey/anovaCharts.ts`
- Modify: `src/features/tests/kruskal-dunn/kruskalCharts.ts`
- Modify: `src/shared/charts/chartFactories/chartFactories.test.ts`

**Interfaces:**
- Consumes: each test's existing `ChartPreset[]`.
- Produces: customizer containing only those presets; group-comparison defaults with raw points.

- [ ] **Step 1: Write failing picker and raw-point tests**

```tsx
expect(screen.queryByLabelText('Pizza')).not.toBeInTheDocument();
expect(screen.getByLabelText('Diferença com IC95%')).toBeInTheDocument();
```

```ts
const chart = buildTStudentRawPointsChartData([1, 2], [3, 4], 'A', 'B');
expect(chart.data.datasets.flatMap((dataset) => dataset.data)).toHaveLength(4);
```

- [ ] **Step 2: Run and confirm generic-disabled and missing-raw-chart failures**

Run: `npx vitest run src/shared/charts/ChartCanvas.test.tsx src/shared/charts/chartFactories/chartFactories.test.ts`
Expected: FAIL because disabled universal types are rendered and raw-point factories are absent.

- [ ] **Step 3: Remove unavailable universal thumbnails and add raw-data presets**

`ChartCustomizer` renders only `presets`. Add jittered scatter presets for t/ANOVA/Kruskal, retain effect/heatmap/residual presets, and make raw data the default for group tests.

- [ ] **Step 4: Run chart and test-feature suites**

Run: `npx vitest run src/shared/charts src/features/tests/t-student src/features/tests/anova-tukey src/features/tests/kruskal-dunn src/features/tests/qui-quadrado src/features/tests/correlacao src/features/tests/prais-winsten src/features/tests/poisson src/features/tests/binomial-negativa src/features/tests/logistica`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/charts src/features/tests/t-student/tStudentCharts.ts src/features/tests/anova-tukey/anovaCharts.ts src/features/tests/kruskal-dunn/kruskalCharts.ts
git commit -m "feat(charts): tailor visuals to statistical tests"
```

### Task 8: Full Verification and Local Dev Smoke

**Files:**
- Modify only files required by failures traced to this feature.

**Interfaces:**
- Produces: a clean feature branch whose `/mapas` route is visible via `npm run dev`.

- [ ] **Step 1: Run the full automated gate**

Run: `npm run gate`
Expected: catalog validation PASS, Python suite PASS, 0 Vitest failures, Vite build exit 0.

- [ ] **Step 2: Start the local app**

Run: `npm run dev -- --host 127.0.0.1`
Expected: Vite prints a localhost URL and `/mapas` loads.

- [ ] **Step 3: Browser smoke at desktop and tablet widths**

Verify: clicking Bahia shows **Seleção atual**; clicking **Criar Grupo 1** creates the group; **Novo grupo** permits Bahia again; each group retains its own controls; comparison issues match the configuration; no console error occurs.

- [ ] **Step 4: Re-run focused route tests after visual QA**

Run: `npx vitest run src/routes/mapas src/shared/charts`
Expected: PASS.

- [ ] **Step 5: Confirm the worktree contains only intentional feature changes**

Run: `git status --short && git diff --check`
Expected: no unstaged QA artifacts and no whitespace errors.
