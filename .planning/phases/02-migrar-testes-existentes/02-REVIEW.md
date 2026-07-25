---
phase: 02-migrar-testes-existentes
reviewed: 2026-07-25T19:28:00Z
depth: standard
files_reviewed: 55
files_reviewed_list:
  - src/shared/stats/statsEngine.ts
  - src/shared/charts/chartAnnotationSetup.ts
  - src/shared/data-input/legacyAdapters.ts
  - src/shared/data-input/types.ts
  - src/shared/charts/ChartCanvas.tsx
  - src/shared/charts/chartFactories/tStudentCharts.ts
  - src/shared/charts/chartFactories/scatterChart.ts
  - src/shared/charts/chartFactories/timeseriesChart.ts
  - src/shared/charts/chartFactories/residualChart.ts
  - src/shared/charts/chartFactories/index.ts
  - src/shared/charts/useChartCustomizer.ts
  - src/shared/charts/ChartCustomizer.tsx
  - src/shared/charts/ResultsPanelWithCustomizer.tsx
  - src/features/tests/shared/DidacticCards.tsx
  - src/features/tests/shared/AlphaSelector.tsx
  - src/features/tests/shared/ResearchQuestionField.tsx
  - src/features/tests/shared/ModeChoiceCard.tsx
  - src/features/tests/shared/SoftResetAlert.tsx
  - src/features/tests/shared/UseExampleButton.tsx
  - src/components/ui/collapsible.tsx
  - src/components/ui/select.tsx
  - src/components/ui/label.tsx
  - src/components/ui/switch.tsx
  - src/features/tests/t-student/tStudentConfig.ts
  - src/features/tests/t-student/tStudentEngine.ts
  - src/features/tests/t-student/tStudentInterpretation.ts
  - src/features/tests/t-student/tStudentCharts.ts
  - src/features/tests/t-student/TStudentConfigPanel.tsx
  - src/features/tests/t-student/TStudentDatasusKnobs.tsx
  - src/features/tests/t-student/TStudentTest.tsx
  - src/features/tests/t-student/tStudentDatasusUtils.ts
  - src/features/tests/correlacao/correlacaoConfig.ts
  - src/features/tests/correlacao/correlacaoEngine.ts
  - src/features/tests/correlacao/correlacaoEngineHelpers.ts
  - src/features/tests/correlacao/correlacaoInterpretation.ts
  - src/features/tests/correlacao/correlacaoCharts.ts
  - src/features/tests/correlacao/CorrelacaoConfigPanel.tsx
  - src/features/tests/correlacao/CorrelacaoDatasusKnobs.tsx
  - src/features/tests/correlacao/CorrelacaoTest.tsx
  - src/features/tests/correlacao/correlacaoDatasusUtils.ts
  - src/features/tests/prais-winsten/praisEngine.ts
  - src/features/tests/prais-winsten/praisInterpretation.ts
  - src/features/tests/prais-winsten/praisCharts.ts
  - src/features/tests/prais-winsten/SeriesPreviewTable.tsx
  - src/features/tests/prais-winsten/PraisWinstenTest.tsx
  - src/features/tests/prais-winsten/PraisWinstenConfigPanel.tsx
  - src/features/tests/registry.ts
  - src/routes/estatistica/EstatisticaPage.tsx
  - src/routes/estatistica/SidebarTestLink.tsx
  - src/routes/estatistica/InterpretationText.tsx
  - src/routes/estatistica/ColumnPreviewTable.tsx
  - src/routes/estatistica/demo/TesteDemo.tsx
  - src/routes/estatistica/demo/demoStats.ts
  - src/routes/mapas/IniciarPesquisaModal.tsx
  - src/shared/charts/useChartExport.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-25T19:28:00Z
**Depth:** standard
**Files Reviewed:** 55
**Status:** issues_found

## Summary

Phase 2 delivers a solid stats port, XSS-safe plain-text interpretation, registry wiring, and chart customizer infrastructure. Differential parity tests against legacy oracles are well structured. Two integration gaps stand out: **Mapas → Estatística handoff lands on Configurar but migrated tests cannot analyze session-injected data** because `recognizedColumns` stays empty and engines never receive column mapping. **ColumnPreviewTable role selections are discarded** for migrated tests (unlike Teste demo, which re-detects columns at results time). Chart PNG export may briefly capture a stale canvas during the customizer debounce window.

## Critical Issues

### CR-01: Mapas handoff data cannot be analyzed by migrated tests

**File:** `src/features/tests/t-student/TStudentTest.tsx:52-61`, `src/features/tests/t-student/tStudentEngine.ts:149-156` (same pattern in `CorrelacaoTest.tsx`, `PraisWinstenTest.tsx`)

**Issue:** Session handoff from Mapas sets `loadedInput` with headers/rows but `recognizedColumns: {}`. After the user confirms in Configurar, engines call `buildDatasetFromConfirmed` with that empty map. Domain keys (`grupo_a`/`grupo_b`, `variavel_x`/`variavel_y`, `tempo`/`variavel_y`) are never resolved, so vectors stay empty and validation fails ("Cada grupo precisa de pelo menos 2 observações…"). The RTL test in `EstatisticaPage.test.tsx` only asserts the Configurar step opens — not that analysis succeeds. Teste demo avoids this via `pickAnalysisColumns()` at results time; migrated tests do not.

**Fix:**
```typescript
// On session bootstrap, re-derive column mapping from headers/rows + test TABULAR_OPTIONS
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './tStudentConfig';

function recognizedColumnsFromSession(
  headers: string[],
  rows: string[][],
): Record<string, number> {
  const text = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const parsed = readTabularPasteState(text, legacyStats, TABULAR_OPTIONS);
  if (parsed.status !== 'loaded') return {};
  return Object.fromEntries(
    Object.entries(parsed.recognizedColumns).map(([k, col]) => [k, col.index]),
  );
}

// In initialLoadedFromSession:
recognizedColumns: recognizedColumnsFromSession(
  sessionDataset.headers,
  sessionDataset.rows,
),
```

Alternatively, wire `ColumnPreviewTable` confirm to emit role→domain-key mapping (see WR-01).

## Warnings

### WR-01: ColumnPreviewTable role overrides are ignored by migrated test engines

**File:** `src/routes/estatistica/ColumnPreviewTable.tsx:83-85`, `src/features/tests/t-student/TStudentTest.tsx:202-207`

**Issue:** Users can change column roles (numérica/categórica/tempo) in Configurar, but `onConfirm` only passes `{ headers, rows }`. Migrated tests always analyze with `loadedInput.recognizedColumns` from the Dados-step parser, so UI adjustments have no effect. Teste demo re-runs column detection at results via `pickAnalysisColumns()` — migrated tests lack equivalent logic.

**Fix:** Extend `ColumnPreviewTable.onConfirm` to return `{ headers, rows, recognizedColumns }` mapped from selected roles + test-specific `TABULAR_OPTIONS.positionFallback`, or call a shared `pickAnalysisColumnsForTest(testId, headers, rows)` helper at confirm time.

### WR-02: PNG export may capture pre-debounce chart state

**File:** `src/shared/charts/useChartCustomizer.ts:177-191`, `src/shared/charts/ResultsPanelWithCustomizer.tsx:122`

**Issue:** After the first customizer change, `chart.options` uses `debouncedOptions` (stale for up to 150 ms) instead of immediate `mergedOptions`. `ChartCanvas` destroys/recreates only when `options` prop changes, so clicking "Baixar gráfico (PNG)" within the debounce window exports the previous customization.

**Fix:** Call `mergeCustomizerIntoOptions(baseChart.options)` synchronously inside the export handler, or flush debounce (`setDebouncedOptions(mergedOptions)` + `await requestAnimationFrame`) before `canvas.toDataURL`.

### WR-03: statsEngine lacks zero-variance / non-positive guards used by UI engines

**File:** `src/shared/stats/statsEngine.ts:231-233`, `src/shared/stats/statsEngine.ts:305`

**Issue:** `pearson`/`spearman` divide by `Math.sqrt(sx * sy)` with no guard — constant columns yield `NaN`/`Infinity`. `praisWinsten` calls `Math.log10(value)` without filtering non-positive inputs (UI `praisEngine` filters `yValue > 0`, but the raw engine does not). Future callers of `statsEngine` directly could surface bad numerics.

**Fix:** Mirror `runIndependentWelch` guards in `statsEngine.welchT`, return `{ coef: NaN, p: NaN, … }` when `sx === 0 || sy === 0`, and guard `praisWinsten` with `values.every(v => v > 0)` or early NaN return.

### WR-04: Router handoff state persists and can override manual test selection

**File:** `src/routes/estatistica/EstatisticaPage.tsx:41-49`

**Issue:** `useEffect` re-applies `location.state.activeTestId` whenever `hasData` or `location.state` changes, without clearing consumed state. If the user manually switches tests and later triggers a re-render with the same `location.state` (e.g., nested navigation), the handoff id can silently override their selection.

**Fix:** Consume handoff once via a ref flag, or call `navigate('.', { replace: true, state: {} })` after applying `activeTestId`.

## Info

### IN-01: Research question field has no HTML `maxLength`

**File:** `src/features/tests/shared/ResearchQuestionField.tsx:22-29`

**Issue:** Interpretation builders slice to 500 chars at build time, but the textarea accepts unbounded input. Not an XSS vector (plain JSX text rendering), but inconsistent UX.

**Fix:** Add `maxLength={500}` to the textarea.

### IN-02: XSS posture is sound for interpretation and paste paths

**File:** `src/routes/estatistica/InterpretationText.tsx:9-17`, interpretation builders under `src/features/tests/*/`

**Issue:** No findings — interpretation renders as plain JSX text children; no `dangerouslySetInnerHTML`. Chart axis labels pass through `sanitizeAxisLabel` (120-char truncation). User-supplied research questions and column headers are safely escaped by React.

---

_Reviewed: 2026-07-25T19:28:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
