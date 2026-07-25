# Phase 4: Mapas como interface estatística - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 38 (new/modified + tests)
**Analogs found:** 32 / 38

**Framing note:** Phase 4 evolves the Phase 1 Mapas mock into a didactic single-screen workspace. **Keep** inline SVG UF interaction (`BrazilMockMap`), session handoff (`IniciarPesquisaModal` → `ReviewAnalysisDialog`), variable intersection (`computeVariableIntersection`), and tabular paste (`useTabularInput`). **Add** geo utilities (`d3-geo` + lazy TopoJSON), structured `MapAnalysisState`, group DnD (`@dnd-kit`), and assembled-table handoff. UI regions R1–R5 from `04-UI-SPEC.md` map to new components orchestrated by upgraded `MapasPage`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/fetch-geo-assets.mjs` | script (build-time) | file-I/O | `trabalhos datasus/spreadsheet_work/build_vascular_amputacao_xlsx.mjs` | partial |
| `src/geo/types.ts` | model | — | `src/routes/mapas/ufCodes.ts` | role-match |
| `src/geo/territoryCatalog.ts` | config | transform | `src/routes/mapas/ufCodes.ts` + `mockVariablesByUF.ts` | role-match |
| `src/geo/nameTables/muni-{UF}.json` | config/fixture | — | `src/routes/mapas/mockVariablesByUF.ts` | role-match |
| `src/geo/topo/*.json` | config/fixture | file-I/O | `src/routes/mapas/brazilUfPaths.ts` | role-match |
| `src/geo/projectGeoToSvg.ts` | utility | transform | `src/routes/mapas/BrazilMockMap.tsx` (SVG path render) | partial |
| `src/geo/choroplethScale.ts` | utility | transform | `04-RESEARCH.md` + `src/shared/charts/chartTheme.ts` (teal palette) | partial |
| `src/geo/matchTerritoryLabels.ts` | utility | transform | `src/shared/data-input/parseTabular.ts` | role-match |
| `src/geo/loadGeoAsset.ts` | utility | file-I/O | `04-RESEARCH.md` dynamic import pattern | no-analog (new) |
| `src/routes/mapas/mapAnalysisState.ts` | hook/store | event-driven | `src/shared/data-input/useDatasusWizard.ts` | role-match |
| `src/routes/mapas/MapasPage.tsx` | component (page) | event-driven | `src/routes/mapas/MapasPage.tsx` (self) | exact (extend) |
| `src/routes/mapas/BrazilMapCanvas.tsx` | component | event-driven | `src/routes/mapas/BrazilMockMap.tsx` | exact (extend) |
| `src/routes/mapas/MapGeoPath.tsx` | component | event-driven | `src/routes/mapas/BrazilMockMap.tsx` (`<path>` loop) | exact (extract) |
| `src/routes/mapas/ChoroplethLegend.tsx` | component | transform | `src/routes/mapas/MapLegendHint.tsx` | role-match |
| `src/routes/mapas/MapBreadcrumb.tsx` | component | event-driven | shadcn `Breadcrumb` patterns in app | partial |
| `src/routes/mapas/GroupBar.tsx` | component | event-driven | `src/routes/estatistica/TabularInputPanel.tsx` (drop zone) | partial |
| `src/routes/mapas/GroupChip.tsx` | component | event-driven | `VariablePanel.tsx` UF chips | role-match |
| `src/routes/mapas/SelectionSummaryStrip.tsx` | component | transform | `VariablePanel.tsx` selection chips | role-match |
| `src/routes/mapas/GroupConfigPanel.tsx` | component | event-driven | `src/routes/mapas/VariablePanel.tsx` | exact (extend) |
| `src/routes/mapas/TemporalidadeControl.tsx` | component | event-driven | `QualTesteModal.tsx` segmented choices | partial |
| `src/routes/mapas/TerritoryPastePanel.tsx` | component | transform | `TabularInputPanel.tsx` + paste error Alert | role-match |
| `src/routes/mapas/ReviewAnalysisDialog.tsx` | component | request-response | `IniciarPesquisaModal.tsx` | exact (upgrade) |
| `src/routes/mapas/assembleHandoffTable.ts` | service | transform | `deriveRecognizedColumnsFromTabular` + mock fixtures | partial |
| `src/routes/mapas/suggestResearchForSelection.ts` | utility | transform | `src/routes/mapas/suggestResearchForSelection.ts` (self) | exact (extend) |
| `src/routes/mapas/mockAnalysisData.ts` | config/fixture | — | `mockVariablesByUF.ts` | exact (extend) |
| `src/routes/mapas/computeVariableIntersection.ts` | utility | transform | self | exact (reuse) |
| `src/shared/session/SessionProvider.tsx` | provider | pub-sub | self | exact (extend) |
| `src/routes/estatistica/EstatisticaPage.tsx` | component (page) | request-response | self (handoff consumer) | exact (no change) |
| `src/routes/mapas/IniciarPesquisaModal.tsx` | component | — | migrate patterns → `ReviewAnalysisDialog` | deprecated |
| `src/routes/mapas/BrazilMockMap.tsx` | component | — | absorbed by `BrazilMapCanvas` | exact (extend) |
| `src/routes/mapas/VariablePanel.tsx` | component | — | logic → `GroupConfigPanel` | exact (extend) |

### Test files (extend patterns from existing Mapas tests)

| Test File | Role | Closest Analog |
|-----------|------|----------------|
| `src/geo/matchTerritoryLabels.test.ts` | test | `computeVariableIntersection.test.ts` |
| `src/geo/projectGeoToSvg.test.ts` | test | `BrazilMockMap.test.tsx` |
| `src/geo/territoryCatalog.test.ts` | test | `computeVariableIntersection.test.ts` |
| `src/routes/mapas/mapAnalysisState.test.ts` | test | `SessionProvider.test.tsx` |
| `src/routes/mapas/GroupBar.test.tsx` | test | `VariablePanel.test.tsx` |
| `src/routes/mapas/SelectionSummaryStrip.test.tsx` | test | `VariablePanel.test.tsx` |
| `src/routes/mapas/ReviewAnalysisDialog.test.tsx` | test | `IniciarPesquisaModal.test.tsx` |
| `src/routes/mapas/suggestResearchForSelection.test.ts` | test | self (extend) |
| `src/shared/session/SessionProvider.test.tsx` | test | self (extend for `mapAnalysis`) |

## Pattern Assignments

### `src/routes/mapas/MapasPage.tsx` (component/page, event-driven) — orchestrator upgrade

**Analog:** `src/routes/mapas/MapasPage.tsx`

**Imports + session sync pattern** (lines 1-8, 60-92):
```typescript
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/shared/session/SessionProvider';
import { BrazilMockMap } from './BrazilMockMap';
import { computeVariableIntersection } from './computeVariableIntersection';
import { MOCK_VARIABLES_BY_UF } from './mockVariablesByUF';

// Sync selection to session whenever it changes
useEffect(() => {
  if (selectedUFs.length === 0 && selectedVariables.length === 0) {
    setMapSelection(null);
    return;
  }
  setMapSelection({ ufs: selectedUFs, variables: selectedVariables });
}, [selectedUFs, selectedVariables, setMapSelection]);
```

**Layout shell** (lines 94-124) — upgrade to R1–R5 from UI-SPEC; keep `max-w-[1520px] px-6 py-8`, 58/42 split becomes `flex gap-8` with GroupBar + SummaryStrip above map/panel:
```typescript
return (
  <div className="mx-auto max-w-[1520px] px-6 py-8">
    <h1 className="font-sans text-display font-bold text-text">Mapas</h1>
    {/* R1 GroupBar, R2 SelectionSummaryStrip */}
    <div className="mt-6 flex gap-8">
      <section className="lacir-mapas-map w-[60%]" aria-label="Mapa do Brasil">
        <BrazilMockMap /* → BrazilMapCanvas */ />
      </section>
      <aside className="lacir-mapas-panel w-[40%]" aria-label="Variáveis disponíveis">
        <VariablePanel /* → GroupConfigPanel / ContextPanel modes */ />
      </aside>
    </div>
  </div>
);
```

**Interaction callbacks** (lines 32-58) — preserve toggle/hover/clear; wire to `mapAnalysisState` reducer instead of flat `useState`:
```typescript
const handleToggleUF = useCallback((uf: string) => {
  markInteracted();
  setSelectedUFs((current) =>
    current.includes(uf) ? current.filter((sigla) => sigla !== uf) : [...current, uf],
  );
}, [markInteracted]);
```

**Escape keyboard** (lines 60-69) — extend per UI-SPEC: Escape clears ungrouped selection; Shift+Escape opens clear-all confirm when groups exist.

---

### `src/routes/mapas/mapAnalysisState.ts` (hook/store, event-driven) — new

**Analog:** `src/shared/data-input/useDatasusWizard.ts`

**Reducer + commit pattern** (lines 208-226):
```typescript
export function useDatasusWizard(options: UseDatasusWizardOptions = {}) {
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commit = useCallback(
    (nextState: WizardState) => {
      dispatch({ type: 'REPLACE', state: nextState });
      notify(nextState);
    },
    [notify],
  );
```

**Apply to MapAnalysisState:** typed actions (`CREATE_GROUP`, `RENAME_GROUP`, `SET_GROUP_TIME`, `TOGGLE_VARIABLE`, `SET_MAP_VIEW`, `MERGE_TERRITORIES_TO_GROUP`). Export `useMapAnalysis()` hook returning `{ state, dispatch, derived: { summaryChips, canReview } }`. Sync to `SessionProvider.setMapAnalysis()` on commit (mirror `setMapSelection` effect in MapasPage).

**Typed state shape** — from `04-RESEARCH.md` Pattern 2:
```typescript
export interface MapAnalysisGroup {
  id: string;
  name: string;
  territoryIds: TerritoryRef[];
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

---

### `src/routes/mapas/BrazilMapCanvas.tsx` + `MapGeoPath.tsx` (component, event-driven) — UF map + drill-down

**Analog:** `src/routes/mapas/BrazilMockMap.tsx`

**Inline SVG + a11y contract** (lines 12-71):
```typescript
/**
 * Inline SVG Brazil-by-UF map (D-20–D-23). Browser SVG hit-testing drives
 * hover/click — no point-in-polygon math. Geometry committed as data;
 * rendered as real `<path>` elements, never via dangerouslySetInnerHTML.
 */
export function BrazilMockMap({ hoveredUF, selectedUFs, onHoverUF, onToggleUF }: BrazilMockMapProps) {
  return (
    <svg role="group" aria-label="Mapa do Brasil por unidade federativa" viewBox={BRAZIL_UF_VIEWBOX} className="h-auto w-full">
      <g transform={BRAZIL_UF_GROUP_TRANSFORM}>
        {BRAZIL_UF_PATHS.map(({ sigla, d }) => (
          <path
            key={sigla}
            data-uf={sigla}
            d={d}
            role="button"
            tabIndex={0}
            aria-label={getUfName(sigla)}
            aria-pressed={isSelected}
            style={{ vectorEffect: 'non-scaling-stroke' }}
            className={cn(
              'cursor-pointer fill-surface stroke-border-strong outline-none transition-colors',
              '[stroke-width:1px]',
              isHovered && !isSelected && 'fill-accent-soft',
              isSelected && 'fill-accent-border stroke-accent [stroke-width:2px]',
              'focus-visible:stroke-accent focus-visible:[stroke-width:2px]',
            )}
          />
        ))}
      </g>
    </svg>
  );
}
```

**Phase 4 extensions:** extract single path → `MapGeoPath` with props `{ fill, glowClass, groupBadge, choroplethValue }`. Add `.lacir-map-glow` class per UI-SPEC. Drill-down paths from `projectGeoToSvg()` instead of `BRAZIL_UF_PATHS` when `mapView.level !== 'uf'`. Keep committed UF paths in initial bundle; lazy-load sub-UF topo.

**Geometry data module** — `brazilUfPaths.ts` (lines 1-27): documents IBGE fetch, sanitization (T-01-SVG), `BRAZIL_UF_VIEWBOX`, `BRAZIL_UF_GROUP_TRANSFORM`.

---

### `src/geo/projectGeoToSvg.ts` + `src/geo/choroplethScale.ts` (utility, transform) — new geo stack

**Analog (partial):** `BrazilMockMap.tsx` render loop + `04-RESEARCH.md` code examples

**TopoJSON → SVG paths** — copy from RESEARCH Pattern 1:
```typescript
import { feature } from 'topojson-client';
import { geoPath, geoMercator } from 'd3-geo';

export async function loadMunicipalitiesForUf(ufIbge: string) {
  const topo = (await import(`@/geo/topo/muni-${ufIbge}.json`)).default as Topology;
  const collection = feature(topo, topo.objects[Object.keys(topo.objects)[0]!]);
  return collection.features; // join key: properties.codarea
}
```

**Choropleth scale** — RESEARCH + UI-SPEC teal steps:
```typescript
import { scaleSequential } from 'd3-scale';

const TEAL_STEPS = ['#18181b', '#1a3d34', '#209978', '#2eb896', '#5eead4'];

export function createChoroplethScale(values: number[]) {
  const [min, max] = [Math.min(...values), Math.max(...values)];
  return scaleSequential<string>()
    .domain([min, max])
    .interpolator((t) => TEAL_STEPS[Math.min(4, Math.floor(t * 5))]!);
}
```

**Join keys:** crosswalk via `ufCodes.ts` `ibgeCode` — never join choropleth data by sigla alone against GeoJSON `codarea`.

---

### `src/geo/matchTerritoryLabels.ts` (utility, transform) — MAP-02/04

**Analog:** `src/shared/data-input/parseTabular.ts`

**Normalization** (lines 46-55):
```typescript
export function normalizeHeaderToken(value: unknown): string {
  return normalizeTabularSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}
```

**UF catalog** — `ufCodes.ts` (lines 5-45):
```typescript
export interface UfEntry {
  sigla: string;
  name: string;
  ibgeCode: string;
}
export const UF_LIST: readonly UfEntry[] = [ /* 27 entries */ ];
export function getUfName(sigla: string): string {
  return NAME_BY_SIGLA[sigla] ?? sigla;
}
```

**Match engine:** UF paste matches sigla (2 letters) or `normalizeHeaderToken(name)` against `UF_LIST`. Municipality paste requires active UF scope; lookup from `nameTables/muni-{UF}.json`; return `{ matched[], unmatched[], fuzzy[] }` for TerritoryPastePanel report.

---

### `src/routes/mapas/GroupConfigPanel.tsx` + `VariablePanel.tsx` (component, event-driven)

**Analog:** `src/routes/mapas/VariablePanel.tsx`

**Empty state** (lines 32-40):
```typescript
if (drivingUFs.length === 0) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-border bg-surface p-6">
      <EmptyState
        heading="Explore o mapa do Brasil"
        body="Passe o mouse sobre um estado para ver as variáveis disponíveis ali, ou clique para fixar a seleção e comparar mais de um estado."
      />
    </div>
  );
}
```

**Variable intersection list** (lines 43-117) — reuse `computeVariableIntersection`; extend with provenance `Badge` ("Exemplo didático"):
```typescript
const availability = computeVariableIntersection(drivingUFs, MOCK_VARIABLES_BY_UF);

{availability.intersection.map((variable) => (
  <li key={`intersection-${variable}`} className="flex items-start gap-3 rounded-lg border border-transparent bg-accent-soft px-3 py-2">
    <Checkbox id={`var-${variable}`} checked={selectedVariables.includes(variable)} onCheckedChange={() => onToggleVariable(variable)} />
    <label htmlFor={`var-${variable}`} className="cursor-pointer font-sans text-sm text-text">{variable}</label>
  </li>
))}

{availability.partial.map(({ variable, missingFrom }) => (
  <li key={`partial-${variable}`} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2">
    {/* ... */}
    <span className="text-destructive">Não existe em {missingFrom.join(', ')}</span>
  </li>
))}
```

**GroupConfigPanel adds:** `TemporalidadeControl` above variable list; scope to `activeGroupId` territories only; copy from UI-SPEC ("Quando analisar?" / "O que comparar?").

---

### `src/routes/mapas/GroupBar.tsx` (component, event-driven) — DnD + presets

**Analog (partial):** `TabularInputPanel.tsx` drop zone (lines 45-59) + `VariablePanel.tsx` chips

**Drop zone drag state** from TabularInputPanel:
```typescript
function handleDrop(event: DragEvent<HTMLLabelElement>) {
  event.preventDefault();
  setIsDragOver(false);
  const file = event.dataTransfer.files?.[0];
  if (file) void setFile(file);
}
function handleDragOver(event: DragEvent<HTMLLabelElement>) {
  event.preventDefault();
  setIsDragOver(true);
}
```

**Apply with @dnd-kit:** `DndContext` + `useDroppable` per group slot; `useDraggable` on selected territory chips from map. Always expose **Criar grupo com seleção** button (D-05). Preset pills map to `territoryCatalog.ts` region → UF sigla lists.

**Chip styling** — from VariablePanel (lines 59-66):
```typescript
<span className="rounded-md border border-accent-border bg-accent-soft px-2 py-0.5 font-sans text-xs font-medium text-accent">
  {sigla}
</span>
```

---

### `src/routes/mapas/ReviewAnalysisDialog.tsx` (component, request-response) — replaces IniciarPesquisaModal

**Analog:** `src/routes/mapas/IniciarPesquisaModal.tsx`

**Handoff core** (lines 141-153):
```typescript
function handleContinue() {
  if (tabularInput.status !== 'loaded') return;
  if (tabularInput.headers.length < 2 || tabularInput.bodyRows.length === 0) return;

  setDataset({
    headers: tabularInput.headers,
    rows: tabularInput.bodyRows,
    sourceLabel,
    confirmedAt: Date.now(),
  });
  onOpenChange(false);
  navigate('/', { state: { activeTestId: resolveHandoffTestId(suggestions) } });
}
```

**Phase 4 upgrade:** Primary path calls `assembleHandoffTable(groups, mockData|pasteData)` — no paste required when map config complete. Add `deriveRecognizedColumnsFromTabular` to navigate state:
```typescript
navigate('/', {
  state: {
    activeTestId: selectedTestId,
    recognizedColumns: deriveRecognizedColumnsFromTabular(headers, rows, MAPAS_TABULAR_OPTIONS),
  },
});
```

**Suggestion row UI** (lines 59-115) — reuse `SuggestionRow`; add `TestPickerSelect` (shadcn `Select` over `TEST_REGISTRY` filtered by `isTestAvailable`). Dialog title **Revisar antes de analisar**; CTA **Ir para Estatística**. Collection links collapsed under **Ver fontes oficiais** (secondary).

**resolveHandoffTestId** (lines 22-31) — keep; allow user override before navigate:
```typescript
export function resolveHandoffTestId(suggestions: ResearchSuggestion[]): string {
  const primarySuggested = suggestions.find((s) => s.testId !== 'demo');
  if (primarySuggested && isTestAvailable(primarySuggested.testId)) return primarySuggested.testId;
  if (isTestAvailable('t-student')) return 't-student';
  return 'demo';
}
```

**Tabular options** (lines 34-50) — reuse `MAPAS_TABULAR_OPTIONS` for paste fallback path.

---

### `src/routes/mapas/assembleHandoffTable.ts` (service, transform) — new

**Analog:** `deriveRecognizedColumnsFromTabular` + `mockVariablesByUF.ts` fixture shape

**Output shape:**
```typescript
export function assembleHandoffTable(
  groups: MapAnalysisGroup[],
  dataSource: MockAnalysisData | PasteData,
): { headers: string[]; rows: string[][] } {
  // Wide format: Território;Grupo;Período;Variável1;Variável2…
}
```

**Source label pattern** from IniciarPesquisaModal (lines 136-139):
```typescript
const sourceLabel = `Mapas: ${selectedUFs.join(', ')}`;
// Phase 4: `Mapas: ${groups.length} grupos · ${timeSummary}`
```

---

### `src/routes/mapas/suggestResearchForSelection.ts` (utility, transform) — extend

**Analog:** self + `QualTesteModal.tsx` recommendation matrix

**Heuristic structure** (lines 24-99):
```typescript
export function suggestResearchForSelection(
  selectedUFs: string[],
  selectedVariables: string[],
): ResearchSuggestion[] {
  if (ufCount >= 2 && varCount === 1) {
    if (ufCount === 2) suggestions.push({ testId: 't-student', rationale: `...` });
    else {
      suggestions.push({ testId: 'anova-tukey', rationale: `...` });
      suggestions.push({ testId: 'kruskal-dunn', rationale: `...` });
    }
  }
  // ... correlacao, prais-winsten, poisson ...
}
```

**Extend for:** group count (not just UF count), time compare mode → `prais-winsten`, multi-variable shapes. **Remove stale demo rationale** (line 96: "Único teste disponível hoje"). Use `isTestAvailable` from registry when filtering suggestions.

---

### `src/shared/session/SessionProvider.tsx` (provider, pub-sub) — extend

**Analog:** self

**Current mapSelection** (lines 10-21, 29, 86-91 in MapasPage):
```typescript
export interface SessionState {
  dataset: SessionDataset | null;
  datasusSession: unknown | null;
  mapSelection: { ufs: string[]; variables: string[] } | null;
  hasData: boolean;
}
```

**Extend:** add `mapAnalysis: MapAnalysisState | null` + `setMapAnalysis`. Keep `mapSelection` deprecated alias or derive `{ ufs, variables }` from active groups for backward compat during migration. `clearSession` must reset `mapAnalysis` (test in `SessionProvider.test.tsx` lines 56-73).

**hasData unchanged** — map analysis alone does not set `hasData`; only `setDataset` on handoff confirm (proven Phase 2 pattern).

---

### `src/routes/estatistica/EstatisticaPage.tsx` (component, handoff consumer) — no structural change

**Analog:** self

**Handoff consumption** (lines 98-109):
```typescript
useEffect(() => {
  if (!hasData) return;
  const handoff = location.state as EstatisticaHandoffState | null;
  const handoffId = handoff?.activeTestId;
  if (handoffId && isTestAvailable(handoffId)) {
    setActiveTestId(handoffId);
  }
  if (handoff?.recognizedColumns) {
    setHandoffRecognizedColumns(handoff.recognizedColumns);
  }
}, [hasData, location.state]);
```

ReviewAnalysisDialog must publish both `activeTestId` and `recognizedColumns` when inferable.

---

### `scripts/fetch-geo-assets.mjs` (script, build-time file-I/O) — new

**Analog (partial):** `trabalhos datasus/spreadsheet_work/build_vascular_amputacao_xlsx.mjs`

**Node ESM + fs pattern** (lines 1-10):
```javascript
import fs from "node:fs/promises";

const outDir = "...";
const csvPath = `${outDir}/base_analise_vascular_amputacao_2013_2025.csv`;
const csvText = await fs.readFile(csvPath, "utf8");
```

**Apply:** curl/fetch IBGE Malhas v3 + MS health shapes → `src/geo/topo/` and `src/geo/nameTables/`; document URLs in file header (mirror `brazilUfPaths.ts` provenance comments). Run at build time only — never in production bundle.

---

### Test patterns

**Component test shell** — `IniciarPesquisaModal.test.tsx` (lines 28-50):
```typescript
function renderModal(overrides = {}, onDataset = () => {}) {
  render(
    <MemoryRouter>
      <SessionProvider>
        <SessionObserver onDataset={onDataset} />
        <IniciarPesquisaModal open selectedUFs={['SP', 'BA']} selectedVariables={[...]} {...overrides} />
      </SessionProvider>
    </MemoryRouter>,
  );
}
```

**Map a11y tests** — `BrazilMockMap.test.tsx` (lines 13-76): 27 paths, aria-labels, Enter/Space toggle, aria-pressed, SVG sanitization guard.

**Pure function tests** — `computeVariableIntersection.test.ts`: table-driven cases, mock fixture partial availability.

**Handoff assertion** — `IniciarPesquisaModal.test.tsx` (lines 137-155):
```typescript
expect(latestDataset!.headers).toEqual(['Município', 'Taxa por 100k', 'Situação']);
expect(navigateMock).toHaveBeenCalledWith('/', { state: { activeTestId: 't-student' } });
```

---

## Shared Patterns

### Session handoff Mapas → Estatística
**Source:** `IniciarPesquisaModal.tsx` lines 141-153, `EstatisticaPage.tsx` lines 98-109  
**Apply to:** `ReviewAnalysisDialog`, `assembleHandoffTable`
```typescript
setDataset({ headers, rows, sourceLabel, confirmedAt: Date.now() });
navigate('/', {
  state: {
    activeTestId: resolveHandoffTestId(suggestions),
    recognizedColumns: deriveRecognizedColumnsFromTabular(headers, rows, MAPAS_TABULAR_OPTIONS),
  },
});
```

### Tabular paste (optional hybrid path)
**Source:** `useTabularInput.ts` + `TabularInputPanel.tsx`  
**Apply to:** `TerritoryPastePanel`, review dialog paste fallback  
```typescript
const tabularInput = useTabularInput(MAPAS_TABULAR_OPTIONS);
// status: idle | parsing | loaded | error
<TabularInputPanel {...tabularInput} showPreview={false} />
```

### Variable availability intersection
**Source:** `computeVariableIntersection.ts`  
**Apply to:** `GroupConfigPanel`, choropleth variable picker  
```typescript
export function computeVariableIntersection(
  selectedUFs: string[],
  variablesByUF: Record<string, string[]>,
): VariableAvailability { /* intersection + partial with missingFrom */ }
```

### Inline SVG map interaction (no hand-roll pip)
**Source:** `BrazilMockMap.tsx`  
**Apply to:** `MapGeoPath`, drill-down paths  
- Real `<path>` elements, `role="button"`, `tabIndex={0}`, `aria-pressed`  
- `vectorEffect: 'non-scaling-stroke'`, 2px selected stroke  
- Never `dangerouslySetInnerHTML` (T-01-SVG)

### Empty states (capacitação copy)
**Source:** `EmptyState.tsx` + `VariablePanel.tsx`  
**Apply to:** ContextPanel Mode A, group config empty blocks  
```typescript
<EmptyState heading="Explore o mapa do Brasil" body="..." />
```

### shadcn Dialog / Sheet
**Source:** `IniciarPesquisaModal.tsx`, `components/ui/sheet.tsx`  
**Apply to:** `ReviewAnalysisDialog` (Dialog max-w 640px), tablet ContextPanel (Sheet side="right")

### Test registry integration
**Source:** `features/tests/registry` — `isTestAvailable`, `getTestById`, `getTestBadgeLabel`  
**Apply to:** suggestion rows, test picker, handoff whitelist

### Dark + teal brand (UI-SPEC)
**Source:** `04-UI-SPEC.md` Color section  
**Apply to:** choropleth scale, glow, chips, drop zones — accent `#209978`, never purple heat scales

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/geo/loadGeoAsset.ts` | utility | file-I/O | No dynamic geo import in codebase yet; follow RESEARCH Pattern 1 |
| `src/routes/mapas/GroupBar.tsx` (@dnd-kit) | component | event-driven | No DnD library in repo; RESEARCH recommends `@dnd-kit/core` — use dnd-kit docs + TabularInputPanel drop UX for visual states |
| `src/routes/mapas/TemporalidadeControl.tsx` | component | event-driven | No year/range picker component; use shadcn `Tabs` or `Select` with UI-SPEC copy |
| `src/routes/mapas/MapBreadcrumb.tsx` | component | event-driven | No breadcrumb in mapas; use shadcn pattern or minimal `<nav aria-label="Navegação do mapa">` |
| `src/index.css` (`.lacir-map-glow`) | utility | — | New CSS motion per UI-SPEC; no existing glow classes in repo |

---

## Metadata

**Analog search scope:** `src/routes/mapas/*`, `src/shared/session/*`, `src/shared/data-input/*`, `src/routes/estatistica/EstatisticaPage.tsx`, `TabularInputPanel.tsx`, `QualTesteModal.tsx`, `useDatasusWizard.ts`, `trabalhos datasus/spreadsheet_work/*.mjs`, Phase 3 `03-PATTERNS.md` structure  
**Files scanned:** ~45  
**Pattern extraction date:** 2026-07-25
