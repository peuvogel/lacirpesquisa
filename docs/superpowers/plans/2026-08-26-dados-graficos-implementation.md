# Dados e gráficos confiáveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o fluxo completo de dados, validação e gráficos, preservando grupos explícitos e entregando a mesma versão localmente e no GitHub Pages.

**Architecture:** A tabela editável tem identidade e revisão próprias; vínculos de colunas pertencem a cada teste. Os motores recebem somente dados preparados e validados. Primitivas estatísticas e capacidades explícitas de gráficos são compartilhadas, assim como tamanho, fonte e exportação.

**Tech Stack:** React 19, TypeScript, Vite, Vitest/Testing Library, Chart.js, IndexedDB, Supabase/Postgres.

**Spec:** `docs/superpowers/specs/2026-08-26-dados-graficos-design.md`.

## Global Constraints

- Preservar a seleção explícita de grupos em Mapas: estados/territórios pertencem a grupos identificados, com doenças e períodos independentes.
- A entrega deve estar na pasta principal do projeto, disponível por `npm run dev`.
- Manter a sessão em memória por padrão. Oferecer **Lembrar neste dispositivo**, desativado por padrão.
- Não enviar dados colados/importados a um servidor para implementar persistência.
- Não transformar dado ausente em zero. Não truncar dados para caber.
- Arquivo de 10 MiB, texto colado de 5 milhões de caracteres, 10.000 linhas de dados, 128 colunas e 200.000 células.
- Para XLSX: até 32 abas, 2.048 entradas ZIP, 16 MiB descompactados por entrada e 64 MiB no total.
- Altura padrão confortável de 420 px, controle de altura entre 280 e 900 px, largura fluida e ação **Ampliar gráfico** em diálogo acessível.
- Não distribuir arquivos proprietários de SF Pro. Respeitar `prefers-reduced-motion`.
- Não apagar dados do banco, não retirar SELECT público dos agregados e não alterar credenciais do pipeline.
- Usar `apply_patch`. Não reverter alterações alheias. Rodar testes focados no ciclo RED/GREEN; o hook de commit executa `npm run gate`, sem desabilitá-lo.

## Mapa de responsabilidades

- `src/lib/publicAssets.ts`, `features/catalog/loadCatalog.ts`: recursos estáticos locais e contrato de catálogo.
- `shared/data-input/useTabularInput.ts`: ordenação de fontes assíncronas.
- `shared/data-input/importLimits.ts`, `xlsxReader.ts`, `parseTabular.ts`: limites, ZIP/XML e parsing sem validação estatística prematura.
- `shared/data-input/tableDocument.ts`, `analysisTable.ts`, `routes/estatistica/ColumnPreviewTable.tsx`: identidade, revisão, vínculos e edição paginada.
- `shared/session/SessionProvider.tsx`, `sessionStorage.ts`: sessão e persistência opt-in.
- Módulos `features/tests/*`: preparação e validação específicas; nenhuma cópia de gerenciamento genérico da tabela.
- `shared/charts/chartFactories/*`: valores e geometrias estatisticamente corretos; `chartCapabilities.ts`: controles aplicáveis.
- `ChartCanvas.tsx`, `ResultsPanelWithCustomizer.tsx`, `useChartExport.ts`: tamanho, ampliação e exportação.
- `app/theme.css`, componentes recolhíveis: sistema visual e movimento reduzido.

### Task 1: Catálogo estático com base correta, validação e recuperação

**Files:** Create `src/lib/publicAssets.ts`, `src/features/catalog/catalogPayload.ts`; modify `src/app/LogoLockup.tsx`, `src/features/catalog/loadCatalog.ts`, `src/features/catalog/loadCatalog.test.ts`, `src/routes/variaveis/VariaveisPage.tsx` and `src/routes/variaveis/VariaveisPage.test.tsx`. Header asset regressions are in `src/app/Header.test.tsx`.

**Interfaces:** Preserve `loadCatalog(): Promise<LoadedCatalog>`, `getCatalogPack(packId: string): Promise<PackFile>`, `resetCatalogCache(): void`. Extract/re-export `resolvePublicAssetUrl(baseUrl: string, assetPath: string): string` from LogoLockup to `lib/publicAssets.ts`; keep the old export compatible. Validation consumes `unknown`, returns the existing `Manifest`, `CatalogEntry[]`, `PackFile` types or throws a descriptive error.

- [ ] Add tests using real catalog JSON fixtures: project base, concurrent consumers, failure then retry, invalid JSON/shapes, hostile pack IDs and reset while a load is pending. The regression must actually assert the emitted URL, not merely a helper constant:

```ts
vi.stubEnv('BASE_URL', '/lacirpesquisa/');
const paths: string[] = [];
vi.stubGlobal('fetch', vi.fn(async (url) => {
  paths.push(String(url));
  const relative = String(url).split('/data/catalog/')[1]!;
  return Response.json(readCatalogJson(relative));
}));
await loadCatalog();
expect(paths[0]).toBe('/lacirpesquisa/data/catalog/manifest.json');
```

- [ ] Run `./node_modules/.bin/vitest run src/features/catalog/loadCatalog.test.ts`; observe project-base/concurrency failures on the unchanged implementation.
- [ ] Resolve catalog paths at call time from `import.meta.env.BASE_URL`; validate pack IDs before constructing paths; keep fetches same-origin/local. Validate manifest refs, variables, pack keys/metricKeys/rows with descriptive messages. Store one in-flight promise, clear it on rejection, and use a cache generation to prevent a reset-invalidated promise from repopulating the cache:

```ts
let generation = 0;
let pending: Promise<LoadedCatalog> | null = null;
// reset increments generation and clears pending/cache.
// A load captures generation and only writes cache/pending if it still matches.
```

Expose **Tentar novamente** on DirectCatalogPage after load failure. Use a reload-attempt state dependency in the existing cancellable effect; disable the action during loading and clear stale loadError when retry starts. Add a real-page test: fetch first returns 503, user clicks retry, next fetch serves real fixtures and variables appear. No full-page reload and no loss of filter/selection state.

- [ ] Run focused catalog, LogoLockup and VariaveisPage tests plus `npm run build`; verify all existing checked-in packs remain accepted. Record commands and results.
- [ ] Commit only task files with `fix(catalog): respect deployment base and recover failed loads`.

### Task 2: Última entrada vence, inclusive limpar e desmontar

**Files:** `src/shared/data-input/useTabularInput.ts`, `useTabularInput.test.ts`.
**Interfaces:** Preserve `UseTabularInputResult`; `setRawText`, `setFile` and `reset` share one monotonic request generation. No downstream API change.

- [ ] Add deferred-file tests for paste→file, file→paste, file→reset and file→unmount. Mock only file IO, not the hook. Assert resulting headers/rows, not just call counts. Example expected sequence:

```ts
act(() => result.current.setRawText('x;y\n1;2'));
await act(async () => result.current.setFile(new File(['x;y\n3;4'], 'novo.csv')));
await act(async () => vi.advanceTimersByTimeAsync(150));
expect(result.current.bodyRows).toEqual([['3', '4']]);
```

- [ ] Run `./node_modules/.bin/vitest run src/shared/data-input/useTabularInput.test.ts`; document RED for cross-source races.
- [ ] Replace two counters with one; cancel the debounce on every source change; invalidate on reset and effect cleanup; guard both success and failure commits against generation mismatch. A source change clears stale result fields while showing parsing, preserving only the current raw text where applicable:

```ts
const requestId = ++requestRef.current;
if (debounceRef.current) clearTimeout(debounceRef.current);
// after asynchronous IO: if (requestId !== requestRef.current) return;
```

- [ ] Run focused hook and TabularInputPanel tests. Include StrictMode remount and exception paths already covered by existing tests.
- [ ] Commit `fix(data): prevent stale imports from replacing newer input`.

### Task 3: Limites antes de alocações e parsing robusto

**Files:** Create `shared/data-input/importLimits.ts`, `xlsxReader.ts`, `importLimits.test.ts`, `xlsxReader.test.ts`; modify `parseTabular.ts`, `parseTabular.test.ts`, `legacyAdapters.ts`, `types.ts` and hook error handling only where a synchronous parser error must be surfaced.
**Interfaces:** Keep public parse exports. Export immutable `IMPORT_LIMITS`; pure boundary validators throw `Error` with Portuguese cause and limit. `readXlsxTables(file: File): Promise<WorkbookTable[]>` isolates ZIP/XML; `readWorkbookTablesFromFile` delegates to it.

- [ ] Add compact fixtures proving rejection before large allocation: fake oversized File (assert no arrayBuffer call), out-of-bounds ZIP offset, encrypted/ZIP64 archive, invalid cell reference, DTD, too many sheets/columns/cells and a compressed stream exceeding the real-output limit. Test each numeric boundary at the limit and just above, using small injected test profiles only in pure validators. Retain valid plain/deflated XLSX and quoted CSV fixtures.

```ts
const file = new File(['x'], 'grande.xlsx');
Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
await expect(readWorkbookTablesFromFile(file, legacyUtils)).rejects.toThrow(/10.*MiB/);
```

- [ ] Run parser/limit tests and capture RED; never use a real memory-exhaustion payload.
- [ ] Validate size before reading, row/column/cell counts before padding/matrix allocation; decode only required XLSX XML entries; bound stream chunks while decompressing, validate central/local headers and offsets, reject unsupported structures explicitly. Parse delimited text without losing quoted fields. Syntactically valid unmapped tables remain editable rather than being reported as corrupt.

```ts
let produced = 0;
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  produced += value.byteLength;
  if (produced > entryLimit) { await reader.cancel(); throw new Error('Entrada XLSX excede o limite descompactado.'); }
  chunks.push(value);
}
```

- [ ] Run all `src/shared/data-input` tests plus import UI tests, and build; verify legacy DATASUS formats still load.
- [ ] Commit `fix(data): bound text and workbook parsing resources`.

### Task 4: Documento de tabela, edição integral e ações persistentes

**Files:** Create `shared/data-input/tableDocument.ts`, `tableDocument.test.ts`, `analysisTable.ts`, `analysisTable.test.ts`, `useAnalysisTable.ts`; modify `ColumnPreviewTable.tsx` and tests, `TabularInputPanel.tsx` and tests, `FlowSteps.tsx` and tests, `SessionProvider.tsx`, and every existing `features/tests/*/*Test.tsx` / configuration panel that consumes the shared table.

**Interfaces:** Add `TableDocument { id: string; revision: number; columns: {id: string; name: string; type: TabularColumnRole; explicitType: boolean}[]; rows: string[][]; bindings: Record<string, Record<string,string>>; sourceLabel: string }`. `createTableDocument(headers, rows, sourceLabel): TableDocument`; `resolveBindings(document, testId): Record<string,number>`. SessionDataset retains headers/rows/sourceLabel/confirmedAt and can carry `table?: TableDocument` for existing Mapas handoffs; normalize such handoffs once, not on every render. `useAnalysisTable(testId, options)` owns draft/confirmation/invalidation and is adopted by all test modules.

- [ ] Add model/UI regressions: duplicate header IDs remain distinct; edit header/cell does not change column ID or manual type; switch test and back preserves non-default X/Y bindings; delimiters/newlines survive handoff; edit row 51 then confirm includes all rows; replace/example/clear available before first analysis; changing data invalidates prior results. Use real components in SessionProvider:

```ts
await user.selectOptions(screen.getByLabelText('Papel da coluna Região'), 'categorica');
await user.clear(screen.getByLabelText('Linha 1, coluna 1'));
await user.type(screen.getByLabelText('Linha 1, coluna 1'), 'SP');
expect(screen.getByLabelText('Papel da coluna Região')).toHaveValue('categorica');
```

- [ ] Run new model/editor tests on old behavior and capture RED.
- [ ] Implement stable documents, per-test role bindings (separate from type), structural handoffs without semicolon reparsing, 50-row pagination and summary of valid/invalid rows. Replace repeated lifecycle state with shared hook. Add confirm-before-replacing edited data, clear/session-reset integration, and always-reachable source toolbar. Every cell/header/binding edit increments revision and invalidates confirmed results; visual edits do not. Preserve existing study-design controls and engine interfaces by deriving index maps at confirmation.

```ts
const indexById = new Map(document.columns.map((column, index) => [column.id, index]));
const recognized = Object.fromEntries(Object.entries(document.bindings[testId] ?? {})
  .filter(([, id]) => indexById.has(id)).map(([role, id]) => [role, indexById.get(id)!]));
```

- [ ] Run table/session/flow tests and every test-module component test, then build. Verify all examples still produce results and clear invalidates pending imports.
- [ ] Commit `feat(data): add stable editable analysis tables across tests`.

### Task 5: Preparação estatística explícita e erros corrigíveis

**Files:** Add `shared/data-input/analysisIssues.ts`, `groupedSamples.ts` and tests; modify Mann–Whitney config/component/engine/tests, ANOVA/Kruskal grouping and stats summaries, Qui-quadrado engine/tests and affected consumers.
**Interfaces:** `AnalysisIssue { code: string; severity: 'error'|'warning'; message: string; columnId?: string; rowNumbers?: number[]; hint?: string }`; `prepareGroupedSamples(document, testId, format: 'wide'|'long')` returns group names, arrays, invalid-row counts and issues. Public statistical engines still accept their existing numeric data.

- [ ] Add wide+long Mann–Whitney UI tests, including the actual t-example handoff, insufficient/missing/three groups and retained independence confirmation. Add `constructor`, `toString`, `__proto__` grouping cases for ANOVA and Kruskal and numeric categorical codes/high cardinality for chi-square:

```ts
const input = {headers:['desfecho','grupo'], rows:[['1','constructor'],['2','constructor'],['3','B'],['4','B']], recognizedColumns:{desfecho:0,grupo:1}};
expect(buildDatasetFromConfirmed(input).groupOrder).toEqual(['constructor','B']);
```

- [ ] Observe RED in these focused engine/component tests.
- [ ] Offer explicit wide/long selection and live group counts. Validate draft before execution; report found groups and invalid rows. Never drop groups to force two. Use Map/null-prototype dictionaries for arbitrary labels, including downstream summaries; cap chi category sets before matrix allocation. Allow explicitly categorical numeric codes. Render specific issues adjacent to controls and catch unexpected engine exceptions at the result boundary without logging raw data.

```ts
const groups = new Map<string, number[]>();
const values = groups.get(label) ?? [];
values.push(value);
groups.set(label, values);
```

- [ ] Run affected engine, grouped preparation and component tests; run actual t→Mann flow in browser.
- [ ] Commit `fix(stats): validate explicit group formats before analysis`.

### Task 6: Persistência local opt-in com recuperação segura

**Files:** Create `shared/session/sessionStorage.ts`, `sessionStorage.test.ts`, `SessionPersistenceControl.tsx`; modify SessionProvider/tests, LeaveWarningGuard and top-level session UI. Add a dev-only IndexedDB test shim if needed, after checking current official package documentation.
**Interfaces:** `SessionSnapshot { version: 1; savedAt: number; dataset: SessionDataset|null; visualPreferences: Record<string,unknown> }`; storage adapter `read():Promise<SessionSnapshot|null>`, `write(snapshot):Promise<void>`, `clear():Promise<void>`. Provider exposes persistence enabled/status/error and explicit setter. Session identity/revision comes from Task 4.

- [ ] Tests: off means no write; opted-in state restores a non-default mapping; stale async write cannot recreate cleared data; unsupported/corrupt snapshots ignored with error; quota/open failure keeps memory data usable and reports unsaved. Assert user-visible saved state only after the transaction completes.

```ts
await user.click(screen.getByRole('checkbox', {name:'Lembrar neste dispositivo'}));
expect(await screen.findByText('Salvo neste dispositivo')).toBeVisible();
```

- [ ] Run RED provider/storage tests using actual adapter behavior with an IndexedDB shim, not assertions that mocks exist.
- [ ] Implement a versioned database with one session record, strict structural validation and serialized writes guarded by generation. Restore once before displaying editable data; disable/clear cancels queued operations and deletes data. Display privacy copy and status; never persist auth/connection data. Leave warning considers revisions not yet stored.
- [ ] Run session, table navigation and failed-storage UI tests; browser opt-in/reload/clear/reload test through visible UI only.
- [ ] Commit `feat(session): offer private opt-in device persistence`.

### Task 7: Primitivas gráficas estatisticamente corretas

**Files:** Add `shared/charts/chartFactories/boxPlotChart.ts` and tests, `pointIntervalChart.ts` and tests; modify `anovaChart.ts`, `glmCoefForestChart.ts`, corresponding tests and Kruskal chart builder.
**Interfaces:** `BoxPlotSummary {n:number;median:number;q1:number;q3:number;low:number;high:number;outliers:number[]}` from `summarizeBoxPlot(values:readonly number[])`; `PointInterval {label:string;estimate:number;low:number|null;high:number|null}` consumed by shared interval chart builder returning existing `{data,options}`.

- [ ] Add hand-calculated fixtures for quartiles (linear interpolation), IQR whiskers/outliers, mean t-interval, horizontal beta/OR forest limits and missing intervals. Assert actual rendered annotation/dataset extents, not tooltip strings:

```ts
expect(summarizeBoxPlot([1,2,3,4,100])).toEqual({n:5,median:3,q1:2,q3:4,low:1,high:4,outliers:[100]});
```

- [ ] Observe RED for missing whiskers and ANOVA's margin-as-bar.
- [ ] Build actual intervals with line/cap annotations and estimates; OR uses logarithmic x scale and reference 1, beta reference 0. Boxplot boxes span Q1–Q3 with median, whiskers and raw points. Replace Kruskal's synthetic mean CI with median/IQR without labeling it CI. Reuse jStat t quantiles for group mean intervals with n−1 degrees of freedom; unavailable intervals are explicit.
- [ ] Run factories/tests and relevant preset tests; compare a real rendered chart with fixture geometry.
- [ ] Commit `fix(charts): render valid intervals and group distributions`.

### Task 8: Presets coerentes e controles com efeito real

**Files:** Create `shared/charts/chartCapabilities.ts` and tests; modify `chartOverrides.ts`, `useChartCustomizer.ts`, chart configs/presets for all existing statistical modules; add `chartFactories/pairedComparisonChart.ts`, `chiResidualChart.ts`, `chiProportionChart.ts` and their `.test.ts` files.
**Interfaces:** Each preset declares capabilities tied to dataset IDs, annotation IDs, scale properties or label properties. Existing preset IDs stay stable; unsupported controls are absent. Task 7 factories are reused without recalculating inconsistent statistics. Export `standardizedResidual(observed: number, expected: number, rowShare: number, columnShare: number): number | null` from `chiResidualChart.ts`; null means zero/nonfinite denominator.

- [ ] For every advertised toggle, start with a test comparing the affected visual property before/after. Cover broken Prais fitted-line/zero-line/log-scale controls and GLM/ANOVA/Kruskal controls. Test t paired links use actual pairing, Pearson-only fit and chi standardized residual fixtures.

```ts
// Fixture: O=30, E=25, row share=.5, column share=.5.
expect(standardizedResidual(30, 25, .5, .5)).toBe(2);
```

- [ ] Run affected preset/customizer tests and observe RED on nonfunctional options.
- [ ] Wire capabilities once per preset; remove no-op options, retain customization on preset return, add Task 7 boxplots to group tests, paired charts only in paired mode, chi proportions and standardized residual heatmap with legend and zero-denominator handling. Retain ranks as secondary for MW. Respect real time spacing in Prais and do not claim an OLS fit belongs to Spearman.
- [ ] Run preset/customizer plus all test-module examples; record coverage of each currently available test and option.
- [ ] Commit `feat(charts): align presets and controls with each statistical test`.

### Task 9: Redimensionamento, ampliação e exportação sem cortes

**Files:** `ChartCanvas.tsx`/tests, `ResultsPanelWithCustomizer.tsx`/tests, `ChartEditPanel.tsx`, `useChartExport.ts`/tests, chart types/preferences, factories with labels outside safe plot area.
**Interfaces:** Optional height prop defaults to 420; result UI provides bounded control and accessible expand dialog. Store visual preferences by dataset/test/preset in the Task 6 snapshot without serializing callbacks or engine outputs.

- [ ] Tests: default and requested canvas container height, clamping at 280/900, expansion preserves customization, Escape restores focus, export failure restores pixel ratio and reports error. Ensure controls update container sizing rather than CSS-stretching bitmap.

```ts
await user.click(screen.getByRole('button', {name:'Ampliar gráfico'}));
expect(screen.getByRole('dialog')).toBeVisible();
await user.keyboard('{Escape}');
expect(screen.getByRole('button', {name:'Ampliar gráfico'})).toHaveFocus();
```

- [ ] Capture RED; then implement dedicated responsive container, expanded view, meaningful plot padding and safe title/p-value placement. Separate customization action from point exploration. Use one column until enough width exists for readable cards. PNG includes essential information and never leaves export-only state active.
- [ ] Run chart/UI/export tests; inspect minimum/default/maximum heights, long labels, negative values, narrow viewport and the original screenshot case in browser.
- [ ] Commit `feat(charts): add readable sizing and accessible expanded views`.

### Task 10: Fonte do sistema e interações consistentes

**Files:** `app/theme.css`, `index.html`, `shared/charts/chartTheme.ts`, all hard-coded chart font declarations, `components/ui/collapsible.tsx`, `ResearchAccordionPanel.tsx`, `DidacticCards.tsx`, associated tests.
**Interfaces:** Export one `CHART_FONT_FAMILY` consistent with CSS system-first stack; use shared reduced-motion-safe collapsible content.

- [ ] Add open/close/keyboard/reduced-motion behavior tests and chart font family inheritance test at rendered chart options. Avoid source-text assertions for CSS.
- [ ] Run RED, implement system font stack and active/focus/hover states, remove unused Sora network font, animate measured content height/opacity on open and close with no nonessential animation under reduced motion.
- [ ] Run UI tests/build; inspect open/close and focus in browser on Mapas and Estatística without changing group logic.
- [ ] Commit `style: unify system typography and accessible interactions`.

### Task 11: Dependências e menor privilégio do banco

**Files:** `package.json`, lockfile, new Supabase migration created using the CLI, regression tests for required public read access/forbidden write privileges. Read current Supabase skill/docs before database work.
**Interfaces:** No client API or data schema change; preserve pipeline credentials and seven public aggregate tables.

- [ ] Record current `npm audit --json`; write a local migration verification that checks resulting read/write privileges on a controlled database, and inspect current linked metadata before applying changes.
- [ ] Update compatible patched dependencies and move shadcn CLI to devDependencies. Re-run audit; do not use `--force`. Create a migration revoking non-SELECT privileges on the seven aggregate tables for anon/authenticated and narrowing their future default grants, preserving SELECT, RLS and pipeline roles. If remote application needs additional authority under tool/skill rules, prepare/review the migration and request only that authority; continue frontend work.

```sql
select has_table_privilege('anon', 'public.sih_disease', 'SELECT') as can_read,
       has_table_privilege('anon', 'public.sih_disease', 'INSERT,UPDATE,DELETE,TRUNCATE') as can_write;
-- Acceptance: can_read = true; can_write = false.
```

- [ ] Run gate, audit, advisors and post-change read-only metadata/read checks; do not test destructive requests on production.
- [ ] Commit `fix(security): patch dependencies and restrict public privileges`.

### Task 12: Verificação integral e publicação

**Files:** Update diagnostic report with evidence per finding; no unrelated refactors. Verify Pages workflow and root branch content.
**Interfaces:** User-facing `npm run dev`, `npm run gate`, Pages URL and existing Supabase API.

- [ ] Run all 13 acceptance items in the spec, recording per-item commands/runtime evidence. Add a regression whenever visual/integration testing reveals another defect; route fixes through the owner task and re-review.
- [ ] Run `npm run gate`, `npm audit --json`, build with `--base /lacirpesquisa/`; exercise preview and dev in browser. Review PNG and original clipping scenario, all examples, persistence/clear and group warnings. Compare final branch against `d04ed08` in whole-branch review.
- [ ] Update the diagnostic report with resolved/unresolved state and evidence; do not call the goal complete while an explicit requirement is missing.
- [ ] Publish to existing GitHub Pages per the user's request after gate/review; verify workflow completion, deployed revision, catalog HTTP success and core browser flows. Preserve all unrelated local processes/worktrees.
- [ ] Ensure root project contains final code, report exact local command and published URL, and only then mark full objective complete.

## Coverage map

Spec 1–2: all tasks, especially 4/12. Spec 3: 2/3/4. Spec 4: 4/6/9. Spec 5: 5. Spec 6: 7/8. Spec 7: 9/10. Spec 8: 1/3/11. Spec 9: regression cycles plus 12. Spec 10: global no-new-services/no-new-tests/no-OHLC scope retained.
