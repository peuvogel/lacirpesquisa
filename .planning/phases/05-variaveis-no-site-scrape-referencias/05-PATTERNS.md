# Phase 5: Variáveis no site (scrape + referências) - Pattern Map

**Mapped:** 2026-07-25  
**Files analyzed:** 24 (new/modified + tests + scripts/assets)  
**Analogs found:** 23 / 24

**Framing note:** Phase 5 replaces `/variaveis` `PlaceholderShell` with a catalog UI, adds a versioned offline pipeline (`scripts/catalog/` → `public/data/catalog/`), and swaps Mapas `mock.*` metrics for pack-backed values while keeping paste provenance and Phase 4 group/time UX. Runtime must never call TABNET/IBGE — same offline contract as geo assets (`loadGeoAsset`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/routes/variaveis/VariaveisPage.tsx` | component (page) | request-response | `src/routes/mapas/MapasPage.tsx` (shell) + retire `PlaceholderShell` | exact (page shell) |
| `src/routes/variaveis/VariaveisFilters.tsx` | component | transform | `src/routes/estatistica/QualTesteModal.tsx` (segmented choices) | role-match |
| `src/routes/variaveis/VariaveisCatalogList.tsx` | component | transform | `src/routes/mapas/VariableCheckboxList.tsx` | role-match |
| `src/routes/variaveis/VariaveisDetailPanel.tsx` | component | request-response | `src/routes/mapas/ReviewAnalysisDialog.tsx` (detail + hint + actions) | role-match |
| `src/features/catalog/types.ts` | model | — | `src/features/tests/registry.ts` (`TestRegistryEntry`) + `MockVariable` | role-match |
| `src/features/catalog/loadCatalog.ts` | utility | file-I/O | `src/geo/loadGeoAsset.ts` | exact |
| `src/features/catalog/suggestTestForVariable.ts` | utility | transform | `src/routes/mapas/suggestResearchForSelection.ts` + `QualTesteModal` `resolveRecommendation` | exact |
| `src/features/catalog/buildSessionFromPack.ts` | service | transform | `src/routes/mapas/assembleHandoffTable.ts` + `ReviewAnalysisDialog` `setDataset` | exact |
| `src/routes/mapas/catalogAnalysisData.ts` | config/service | transform | `src/routes/mapas/mockAnalysisData.ts` | exact (evolve/alias) |
| `src/routes/mapas/mockAnalysisData.ts` | config | — | self — alias IDs / retire mock metrics for pack vars | exact (extend) |
| `src/routes/mapas/VariableCheckboxList.tsx` | component | transform | self — consume catalog IDs + new provenance badges | exact (extend) |
| `src/routes/mapas/GroupConfigPanel.tsx` | component | event-driven | self — unchanged API; data source swap underneath | exact (extend) |
| `src/routes/mapas/MapasPage.tsx` | component (page) | event-driven | self — choropleth via catalog provider | exact (extend) |
| `src/routes/mapas/assembleHandoffTable.ts` | service | transform | self — read pack metrics instead of mock | exact (extend) |
| `src/routes/mapas/mapAnalysisState.ts` | hook/store | event-driven | self — provenance `'catalog'` (retire `'mock'`) | exact (extend) |
| `src/routes/mapas/suggestResearchForSelection.ts` | utility | transform | self — label lookup from catalog | exact (extend) |
| `src/shared/session/SessionProvider.tsx` | provider | pub-sub | self — reuse `setDataset` as-is | exact (reuse) |
| `src/app/router.test.tsx` | test | — | self — drop “Em breve” expectation for `/variaveis` | exact (update) |
| `scripts/catalog/build.mjs` (or `.ts`) | script | file-I/O | `scripts/fetch-geo-assets.mjs` + coleta CSV packagers | exact |
| `scripts/catalog/validate.mjs` | script | batch | same family as build; schema gate | role-match |
| `public/data/catalog/manifest.json` | config/fixture | — | geo committed samples under `src/geo/topo/` | role-match |
| `public/data/catalog/variables.json` | config/fixture | — | `trabalhos datasus/build/catalogos/*_catalog.json` shape | partial |
| `public/data/catalog/packs/<packId>.json` | config/fixture | — | coleta `base_analise_*.csv` + `metadata.json` | role-match |
| `package.json` (`catalog:build` / `catalog:validate`) | config | — | existing `scripts` block; geo fetch documented but not wired | partial |

### Test files

| Test File | Role | Closest Analog |
|-----------|------|----------------|
| `src/features/catalog/suggestTestForVariable.test.ts` | test | `src/routes/mapas/suggestResearchForSelection.test.ts` |
| `src/features/catalog/loadCatalog.test.ts` | test | `src/geo/loadGeoAsset.test.ts` |
| `src/features/catalog/buildSessionFromPack.test.ts` | test | `src/routes/mapas/assembleHandoffTable.test.ts` |
| `src/routes/variaveis/VariaveisPage.test.tsx` | test | `src/routes/mapas/MapasPage.test.tsx` + `router.test.tsx` |
| `src/routes/mapas/catalogAnalysisData.test.ts` | test | `src/routes/mapas/ChoroplethLegend.test.tsx` (mock metric asserts) |
| `scripts/catalog` validate unit (optional) | test | vitest pure-function style from `format.test.ts` |

## Pattern Assignments

### `src/routes/variaveis/VariaveisPage.tsx` (component/page, request-response)

**Analog (retire):** `src/components/PlaceholderShell.tsx` + current page  
**Analog (adopt shell):** `src/routes/mapas/MapasPage.tsx`

**Current placeholder to replace** (`VariaveisPage.tsx` lines 1-5):
```typescript
import { PlaceholderShell } from '@/components/PlaceholderShell';

export function VariaveisPage() {
  return <PlaceholderShell title="Variáveis" />;
}
```

**Shell layout pattern** (`PlaceholderShell.tsx` lines 11-24 — keep outer chrome, drop Em breve):
```typescript
export function PlaceholderShell({ title, children }: PlaceholderShellProps) {
  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8">
      <h1 className="font-sans text-display font-bold text-text">{title}</h1>
      {/* …EmptyState Em breve — DO NOT reuse for Variáveis v1 */}
    </div>
  );
}
```

**Target composition** (from Mapas density — `MapasPage.tsx` outer wrapper):
```typescript
// MapasPage return shell (same tokens):
// <div className="mx-auto max-w-[1520px] px-6 py-8">
//   <h1 className="font-sans text-display font-bold text-text">…</h1>
//   <div className="mt-6 flex gap-8"> list | detail </div>
// </div>
```

**Router already wired** (`src/app/router.tsx` lines 9-18) — no new route; only page body changes. Update `router.test.tsx` lines 51-55 (currently expects “Em breve”).

**Keep Meta-análise on PlaceholderShell** (`MetaAnalisePage.tsx`) — do not touch.

---

### Session load: `setDataset` + navigate (CAT-04)

**Analog:** `src/routes/mapas/ReviewAnalysisDialog.tsx` (primary) + `SessionProvider`

**SessionDataset shape** (`SessionProvider.tsx` lines 4-8):
```typescript
export interface SessionDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string; // include short provenance cite for catalog loads
  confirmedAt: number;
}
```

**Handoff pattern** (`ReviewAnalysisDialog.tsx` lines 87-116):
```typescript
async function handleConfirm() {
  setIsConfirming(true);
  try {
    const { headers, rows, sourceLabel } = assembleHandoffTable(groups, {
      pasteData,
      provenance,
    });
    if (headers.length < 2 || rows.length === 0) return;

    setDataset({
      headers,
      rows,
      sourceLabel,
      confirmedAt: Date.now(),
    });

    onOpenChange(false);
    navigate('/', {
      state: {
        activeTestId: effectiveTestId,
        recognizedColumns,
      },
    });
  } finally {
    setIsConfirming(false);
  }
}
```

**For Variáveis “Carregar na Estatística”:** same `setDataset` + `navigate('/estatistica' | '/')` with `state.activeTestId` from `suggestTestForVariable`. Prefer `sourceLabel` like `Catálogo: SIH · embolia/trombose · 2013–2025`.

**Mapas path (D-15):** `navigate('/mapas')` + `setMapAnalysis` / selection of catalog variable IDs — mirror MapasPage session sync (`setMapAnalysis` from `useSession`), not a second dataset until Review handoff.

---

### `src/routes/mapas/catalogAnalysisData.ts` + GroupConfigPanel consumption

**Analog:** `src/routes/mapas/mockAnalysisData.ts` + consumers

**Stable API to preserve** (`mockAnalysisData.ts` lines 81-126):
```typescript
export function getMockVariableById(variableId: string): MockVariable | undefined { /* … */ }
export function getMockMetricByUf(variableId?: string): Record<string, number> { /* … */ }
export function getMockMetricByIbgeCode(variableId: string): Record<string, number> { /* … */ }
export function getMockMetricByUfAndYear(variableId: string, year: number): Record<string, number> { /* … */ }
export function getMockVariableIdsByUf(): Record<string, string[]> { /* … */ }
export const MOCK_TIME_SERIES_YEARS = [2018, 2019, 2020, 2021, 2022] as const; // → pack year intersection
```

**Choropleth consumer** (`MapasPage.tsx` lines 89-95):
```typescript
const activeVariableId = useMemo(() => {
  if (activeGroup?.variableIds[0]) return activeGroup.variableIds[0];
  const firstWithVars = state.groups.find((group) => group.variableIds.length > 0);
  return firstWithVars?.variableIds[0] ?? getDefaultMockVariableId();
}, [activeGroup, state.groups]);

const choroplethValues = useMemo(() => getMockMetricByUf(activeVariableId), [activeVariableId]);
```

**Variable list consumer** (`VariableCheckboxList.tsx` lines 32-60) — swap `getMockVariableById` / `getMockVariableIdsByUf` for catalog-backed helpers; update `ProvenanceBadge` (lines 23-29) so catalog ≠ “Exemplo didático”:
```typescript
function ProvenanceBadge({ variable }: { variable: MockVariable }) {
  const label = variable.provenance === 'paste' ? 'Dados colados por você' : 'Exemplo didático';
  // Phase 5: 'catalog' → e.g. 'Catálogo LACIR' / sourceSystem short label
  return (
    <Badge variant="outline" className="shrink-0 font-sans text-[11px]">
      {label}
    </Badge>
  );
}
```

**Handoff assembly** (`assembleHandoffTable.ts` lines 56-64) — replace metric lookup:
```typescript
function metricValue(variableId: string, sigla: string, time: GroupTimeConfig): number {
  const year = resolveYearFromTime(time);
  if (year !== null) {
    const byYear = getMockMetricByUfAndYear(variableId, year);
    return byYear[sigla] ?? 0;
  }
  const base = getMockMetricByUf(variableId);
  return base[sigla] ?? 0;
}
```

**Provenance type evolution** (`mapAnalysisState.ts` lines 32-37, 64-70):
```typescript
export interface MapAnalysisState {
  // …
  provenance: 'mock' | 'paste' | 'hybrid'; // → add 'catalog'; retire 'mock' for catalog-backed vars (D-07)
}
```

**Alias note (D-18):** map `mock.amputacoes` / internações-like IDs → pack column keys (`internacoes_amputacao_mmii`, etc.) inside catalogAnalysisData so existing tests/selections can migrate.

---

### `src/features/catalog/suggestTestForVariable.ts` (CAT-03)

**Analogs:** `suggestResearchForSelection.ts` + `QualTesteModal.tsx` `resolveRecommendation` + `SuggestedTestCard.tsx`

**Registry gating** (`registry.ts` lines 112-118 + suggest filter lines 72-84):
```typescript
export function isTestAvailable(id: string): boolean {
  return getTestById(id)?.status === 'available';
}

function filterAvailableSuggestions(suggestions: ResearchSuggestion[]): ResearchSuggestion[] {
  const seen = new Set<string>();
  const filtered: ResearchSuggestion[] = [];
  for (const suggestion of suggestions) {
    if (seen.has(suggestion.testId)) continue;
    if (suggestion.testId !== 'demo' && !isTestAvailable(suggestion.testId)) continue;
    seen.add(suggestion.testId);
    filtered.push(suggestion);
  }
  return filtered;
}
```

**Type → test heuristic seed** (`QualTesteModal.tsx` lines 14-15, 58-75):
```typescript
type OutcomeType = 'numerico' | 'categorico' | 'contagem' | 'serie-temporal';

function resolveRecommendation(outcome: OutcomeType, design: StudyDesign): Recommendation {
  if (outcome === 'numerico') {
    if (design === 'dois-grupos-independentes') return { primaryId: 't-student' };
    // …
  }
  // contagem → poisson / binomial-negativa; serie-temporal → prais-winsten
}
```

**Map variableType (D-05) → OutcomeType:**
- `contagem` → poisson (+ binomial-negativa note)
- `taxa` / time domain → prais-winsten
- `categorica` → qui-quadrado
- `numerica` / `ordinal` → t-student / correlacao / anova depending on pair mode later
- Always resolve titles via `getTestById`; render with `SuggestedTestCard`

**Return shape** (mirror ResearchSuggestion):
```typescript
export interface VariableTestHint {
  testId: string;
  rationale: string; // PT-BR didactic sentence
}
```

---

### Pipeline / assets / npm scripts (CAT-05)

**Analog (build script):** `scripts/fetch-geo-assets.mjs`  
**Analog (CSV→artifact):** `trabalhos datasus/spreadsheet_work/build_vascular_amputacao_xlsx.mjs`  
**Analog (lazy offline load):** `src/geo/loadGeoAsset.ts`  
**Provenance source:** `trabalhos datasus/outputs/coleta_*/metadata.json`

**Script header + paths pattern** (`fetch-geo-assets.mjs` lines 1-33):
```javascript
#!/usr/bin/env node
/**
 * Build-time … (document sources, CI fixtures, usage)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
```

**Offline load contract** (`loadGeoAsset.ts` lines 1-5, 33-36):
```typescript
/**
 * MAP-05 offline-only contract: all map geometry is served from bundled static JSON
 * via dynamic import(). Runtime fetch to IBGE or external APIs is forbidden …
 */
/** Dynamic import loaders — no runtime fetch (MAP-05). Vite code-splits each JSON chunk. */
```

**For catalog v1 prefer `public/data/catalog/` + `fetch('/data/catalog/variables.json')` OR dynamic `import` of committed JSON under `src/` — either is fine if zero DATASUS/IBGE network. Geo uses Vite-bundled imports; `public/` is currently only `logo-lacir.png` — new tree is acceptable (D-08).

**package.json scripts today** (lines 5-12) — add:
```json
"catalog:build": "node scripts/catalog/build.mjs",
"catalog:validate": "node scripts/catalog/validate.mjs"
```
Wire `catalog:validate` into `pretest` or CI if cheap (D-10). Geo fetch is documented but **not** in npm scripts — catalog should be explicit.

**Coleta metadata fields to map into D-05** (`metadata.json` excerpt):
```json
{
  "years": [2013, 2014, /* … */ 2025],
  "sources": {
    "sih_morbidade_local_internacao": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def",
    "sidra_6579": "https://sidra.ibge.gov.br/tabela/6579"
  },
  "notes": ["… methodology …"]
}
```

**Manifest shape (D-08):**
```json
{
  "version": "1.0.0",
  "generatedAt": "ISO-8601",
  "packs": [{ "id": "embolia_trombose_uf", "grain": "uf_ano" }],
  "catalogEntryCount": 0
}
```

---

### Vitest patterns for catalog modules

**Pure function / registry** — `suggestResearchForSelection.test.ts` lines 1-46:
```typescript
import { describe, expect, it } from 'vitest';
import { getTestById, isTestAvailable } from '@/features/tests/registry';
import { suggestResearchForSelection } from './suggestResearchForSelection';

describe('suggestResearchForSelection', () => {
  it('returns only demo for an empty selection', () => {
    const result = suggestResearchForSelection({ groups: [] });
    expect(result).toHaveLength(1);
    expect(result[0]?.testId).toBe('demo');
  });
  // assert every testId resolves in registry + is available
});
```

**Offline asset / no fetch** — `loadGeoAsset.test.ts` lines 11-21:
```typescript
it('loads muni-29 fixture via dynamic import without fetch', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const topo = await loadMuniTopo('29');
  expect(topo.type).toBe('Topology');
  expect(fetchSpy).not.toHaveBeenCalled();
});
```

**Page + router** — wrap with `SessionProvider` + `MemoryRouter` / `createMemoryRouter` as in `MapasPage.test.tsx` and `router.test.tsx`.

**Format helpers** — `format.test.ts` lines 4-12 for `n/d` assertions.

---

### PT-BR UI copy / `n/d` formatting

**Analog:** `src/shared/format.ts` + EmptyState didactic copy

**Missing values** (`format.ts` lines 7-14):
```typescript
const MISSING = 'n/d';

export function fmtNumber(value: unknown, digits = 3): string {
  if (!Number.isFinite(Number(value))) return MISSING;
  return Number(value).toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}
```

**UI rules:**
- Never show em dash (`—`) as missing in UI (input parsers may accept TABNET `—`; display stays `n/d` — see `legacyAdapters.test.ts`).
- Empty states: `EmptyState` with PT-BR `heading` + `body` (`EmptyState.tsx` lines 9-15).
- Cross-pack join block message (D-16): clear PT, e.g. “Essas variáveis não compartilham a mesma chave UF × ano.”
- Provenance panel labels in PT-BR matching D-05 field names (Fonte, Tabela/indicador, Período, URL oficial, Notas metodológicas).

---

### `src/features/catalog/types.ts` (model)

**Analog:** `TestRegistryEntry` + `MockVariable`

```typescript
// registry.ts lines 16-27 — stable id + PT subtitle pattern
export interface TestRegistryEntry {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  status: TestStatus;
  phase: number;
}

// mockAnalysisData.ts lines 4-8 — extend into CatalogVariable (D-05)
export interface MockVariable {
  id: string;
  label: string;
  provenance: 'mock' | 'paste';
  unit?: string;
}
```

Catalog entry **must** include all D-05 fields; validation script fails orphans (D-06).

---

### `src/features/catalog/buildSessionFromPack.ts` (service, transform)

**Analog:** `assembleHandoffTable.ts` tidy/wide assembly + SessionDataset

Prefer tidy or wide UF × ano × selected metrics; enforce same-pack / matching keys (`uf_codigo`, `ano`) before join (D-16). Reuse `MAX_HANDOFF_ROWS`-style guard if assembling large packs.

## Shared Patterns

### Offline-only data
**Source:** `src/geo/loadGeoAsset.ts`  
**Apply to:** `loadCatalog`, pack JSON, Mapas catalog metrics  
Never call DATASUS/IBGE/SIDRA from the browser; pipeline regenerates assets offline.

### Session handoff
**Source:** `SessionProvider` + `ReviewAnalysisDialog`  
**Apply to:** Variáveis → Estatística load; Mapas review remains primary for group analysis  
`setDataset({ headers, rows, sourceLabel, confirmedAt })` then `navigate`.

### Test identity
**Source:** `src/features/tests/registry.ts`  
**Apply to:** `suggestTestForVariable`, SuggestedTestCard, handoff `activeTestId`  
Single `TEST_REGISTRY`; filter with `isTestAvailable`.

### Page chrome
**Source:** `MapasPage` / `PlaceholderShell` outer div  
**Apply to:** `VariaveisPage`  
`mx-auto max-w-[1520px] px-6 py-8` + `text-display` title; list+detail, not card dashboard (D-12).

### Formatting / missing
**Source:** `src/shared/format.ts`  
**Apply to:** catalog detail metrics, pack previews, Mapas values  
`n/d` for non-finite; `pt-BR` locales.

### Provenance badges
**Source:** `VariableCheckboxList` `ProvenanceBadge`  
**Apply to:** catalog list rows + Mapas variable list  
Distinct copy for catalog vs paste; no `'mock'` for pack-backed IDs (D-07).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/catalog/validate.mjs` (schema-only CLI) | script | batch | No dedicated JSON-schema validate script in repo yet — invent from D-05/D-06 + vitest assert style; closest process analog is geo “throw if missing asset” errors |

## Metadata

**Analog search scope:** `src/routes/{variaveis,mapas,estatistica}`, `src/features/tests`, `src/shared/{session,format}`, `src/geo`, `src/components`, `src/app`, `scripts/`, `trabalhos datasus/{outputs,scripts,spreadsheet_work,build}`, `public/`, `package.json`  
**Files scanned:** ~45  
**Pattern extraction date:** 2026-07-25  
**Upstream:** `.planning/phases/05-variaveis-no-site-scrape-referencias/05-CONTEXT.md` (no RESEARCH.md present at map time)
