---
phase: 02-migrar-testes-existentes
verified: 2026-07-25T19:45:00Z
status: human_needed
score: 6/6
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "Mapas → Estatística handoff completes analysis on migrated tests (Truth #6)"
    - "CR-01: session bootstrap empty recognizedColumns"
    - "WR-01: ColumnPreviewTable role overrides ignored at analysis time"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Compare chart appearance to v1.0 for each migrated test using exemplo data"
    expected: "Chart type, series, axis labels, and annotation overlays match v1.0 screenshots for t-Student, Correlação scatter, and Prais trend/residual charts"
    why_human: "Differential tests verify numeric parity only; pixel/layout comparison requires visual inspection"
  - test: "PNG export after ChartCustomizer changes (all three tests)"
    expected: "Customize chart (type/theme/axis/annotation) → Baixar gráfico (PNG) → downloaded file shows current customization, not pre-change state"
    why_human: "jsdom cannot exercise canvas.toDataURL reliably; WR-02 debounce window may export stale chart (see 02-REVIEW.md)"
  - test: "Didactic Configurar UX (Usar exemplo, mode/method cards, α selector)"
    expected: "Each test's Configurar step reads naturally in PT and mode/method switches behave as documented (soft reset on change after confirm)"
    why_human: "Teaching UX quality cannot be assessed programmatically"
---

# Phase 2: Migrar testes existentes — Verification Report

**Phase Goal:** The three validated v1.0 tests run inside the new shell with no regression in numbers, charts, or workflow  
**Verified:** 2026-07-25T19:45:00Z  
**Status:** human_needed  
**Re-verification:** Yes — after gap-closure plans 02-07 and 02-08

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User runs t de Student in the new shell and gets results matching v1.0 output | ✓ VERIFIED | `tStudentEngine.test.ts` differential parity vs legacy oracle; `TStudentTest.test.tsx` exemplo flow reaches Resultados with metrics + interpretation |
| 2 | User runs Correlação Pearson/Spearman with results matching v1.0 output | ✓ VERIFIED | `correlacaoEngine.test.ts` Pearson/Spearman parity; `CorrelacaoTest.test.tsx` exemplo flow through Resultados |
| 3 | User runs Prais-Winsten with results matching v1.0 output | ✓ VERIFIED | `praisEngine.test.ts` model field parity vs legacy Stats; `PraisWinstenTest.test.tsx` exemplo flow through Resultados |
| 4 | Each migrated test shows a plain-Portuguese interpretation paragraph | ✓ VERIFIED | All three modules call `build*Interpretation()` and pass `interpretation` to `ResultsPanelWithCustomizer` → `InterpretationText`; RTL tests assert "O que isso significa?" |
| 5 | Each migrated test supports PNG export like other modules | ✓ VERIFIED | `ResultsPanelWithCustomizer.tsx` wires `useChartExport` + "Baixar gráfico (PNG)" button; RTL tests assert button presence |
| 6 | Mapas → Estatística handoff completes analysis on migrated tests | ✓ VERIFIED | `deriveRecognizedColumnsFromTabular` wired in all three session/DATASUS bootstrap paths; `ColumnPreviewTable` confirm emits role-derived mapping; `EstatisticaPage.test.tsx` handoff test clicks Analisar dados → Resultados with `r de Pearson` metric and no validation error |

**Score:** 6/6 truths verified

### Prior Gap Resolution

| Gap | Prior Status | Current Status | Fix Evidence |
|-----|-------------|----------------|--------------|
| CR-01: empty `recognizedColumns` on session bootstrap | ✗ FAILED | ✓ CLOSED | `deriveRecognizedColumnsFromTabular` in `recognizedColumnsFromTabular.ts`; wired in `TStudentTest.tsx:61-65`, `CorrelacaoTest.tsx:58-62`, `PraisWinstenTest.tsx:52-56`; zero `recognizedColumns: {}` in bootstrap paths |
| WR-01: ColumnPreview role overrides ignored | ⚠️ WARNING | ✓ CLOSED | `deriveRecognizedColumnsFromRoles` + `ColumnPreviewTable.tsx:94-98` confirm contract; ConfigPanels pass `tabularOptions={TABULAR_OPTIONS}`; engines analyze via `confirmedDataset.recognizedColumns` at results time |
| Truth #6: handoff RTL only reached Configurar | ✗ FAILED | ✓ CLOSED | `EstatisticaPage.test.tsx:126-173` — session handoff → Analisar dados → Resultados with metrics |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/shared/data-input/recognizedColumnsFromTabular.ts` | Session/confirm column mapping helpers | ✓ VERIFIED | 125 lines; exports `deriveRecognizedColumnsFromTabular` and `deriveRecognizedColumnsFromRoles` |
| `src/shared/stats/statsEngine.ts` | Full Stats port from v1.0 | ✓ VERIFIED | Differential tests 27/27 pass |
| `src/features/tests/registry.ts` | Three migrated tests `status: 'available'` | ✓ VERIFIED | t-student, correlacao, prais-winsten all `available` |
| `src/routes/estatistica/EstatisticaPage.tsx` | Static switch renders all four modules | ✓ VERIFIED | `renderActiveTest` switch cases demo + 3 migrated |
| `src/features/tests/t-student/TStudentTest.tsx` | FlowSteps orchestrator + results | ✓ VERIFIED | Session bootstrap + confirm-time mapping wired |
| `src/features/tests/correlacao/CorrelacaoTest.tsx` | FlowSteps orchestrator + results | ✓ VERIFIED | Session bootstrap + confirm-time mapping wired |
| `src/features/tests/prais-winsten/PraisWinstenTest.tsx` | FlowSteps orchestrator + dual charts | ✓ VERIFIED | Session bootstrap + confirm-time mapping wired |
| `src/shared/charts/ResultsPanelWithCustomizer.tsx` | Metrics + chart + interpretation + PNG | ✓ VERIFIED | Substantive component; not a stub |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `EstatisticaPage.tsx` | `TStudentTest` / `CorrelacaoTest` / `PraisWinstenTest` | `renderActiveTest` switch on `activeTestId` | ✓ WIRED | Static imports + switch cases verified |
| `Sidebar.tsx` | `TEST_REGISTRY` | `isTestAvailable` gate | ✓ WIRED | Registry is single source; migrated tests show Disponível |
| `TStudentTest.tsx` | `tStudentEngine.ts` | `buildDatasetFromConfirmed` → `runAnalysis` | ✓ WIRED | Paste/example and session paths both resolve columns |
| `TStudentTest.tsx` | `ResultsPanelWithCustomizer` | `tStudentCharts` presets + interpretation | ✓ WIRED | Import + JSX at results step |
| `IniciarPesquisaModal.tsx` | migrated test engines | session dataset → column mapping → analysis | ✓ WIRED | Session stores headers/rows; tests derive columns on bootstrap; confirm mapping flows to `confirmedDataset.recognizedColumns` |
| `ColumnPreviewTable.tsx` | migrated test engines | role overrides → `recognizedColumns` | ✓ WIRED | `deriveRecognizedColumnsFromRoles(roles, headers, tabularOptions)` on confirm (line 96) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `TStudentTest` (session path) | `loadedInput.recognizedColumns` | `deriveRecognizedColumnsFromTabular` on bootstrap | Yes — domain keys from parser | ✓ FLOWING |
| `TStudentTest` (results path) | `confirmedDataset.recognizedColumns` | `ColumnPreviewTable` confirm via ConfigPanel | Yes — role-derived mapping stored at confirm | ✓ FLOWING |
| `CorrelacaoTest` (session path) | `loadedInput.recognizedColumns` | `deriveRecognizedColumnsFromTabular` | Yes — variavel_x/variavel_y resolved | ✓ FLOWING |
| `CorrelacaoTest` (results path) | `engineOutput` | `buildDatasetFromConfirmed(confirmedDataset.recognizedColumns)` | Yes — handoff test asserts r de Pearson | ✓ FLOWING |
| `PraisWinstenTest` (session path) | `loadedInput.recognizedColumns` | `deriveRecognizedColumnsFromTabular` | Yes — tempo/variavel_y resolved | ✓ FLOWING |
| `ResultsPanelWithCustomizer` | `interpretation` | `build*Interpretation()` at results time | Yes — string arrays from engine output | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 2 engine differential suites | `npm run test:run -- tStudentEngine correlacaoEngine praisEngine statsEngine` | 27/27 passed | ✓ PASS |
| Column mapping unit tests | `npm run test:run -- recognizedColumnsFromTabular.test.ts ColumnPreviewTable.test.tsx` | 16/16 passed | ✓ PASS |
| Handoff integration test | `npm run test:run -- EstatisticaPage.test.tsx` | 4/4 passed (includes Resultados handoff) | ✓ PASS |
| Full project test suite | `npm run test:run` | 349/349 passed (46 files) | ✓ PASS |
| Production build | `npm run build` | exit 0, dist assets emitted | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `probe-*.sh` declared in Phase 2 plans or conventional probe paths for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| TEST-01 | 02-03, 02-07, 02-08 | t de Student with v1.0 parity in new shell | ✓ SATISFIED | Engine differential tests + RTL exemplo flow + session handoff path |
| TEST-02 | 02-04, 02-07, 02-08 | Correlação Pearson/Spearman with v1.0 parity | ✓ SATISFIED | Engine differential tests + RTL exemplo flow + handoff-through-Resultados test |
| TEST-03 | 02-05, 02-07, 02-08 | Prais-Winsten with v1.0 parity | ✓ SATISFIED | Engine differential tests + RTL exemplo flow + session bootstrap mapping |
| UI-04 (PNG export) | 02-02 | Download active chart as PNG | ✓ SATISFIED (wiring) | `ResultsPanelWithCustomizer` export button wired; pixel fidelity needs human check |
| UI-06 (interpretation) | 02-03/04/05 | Brief PT interpretation under results | ✓ SATISFIED | All three modules render `InterpretationText` paragraphs |

**Orphaned requirements for Phase 2:** none (TEST-01–03 all claimed and evidenced)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `useChartCustomizer.ts` | 177–191 | Debounced options for live chart | ⚠️ Warning | PNG may capture stale chart within 150 ms window (WR-02, deferred) |
| `EstatisticaPage.tsx` | 41–49 | Handoff state re-applied on re-render | ⚠️ Warning | May override manual test selection (WR-04) |
| `statsEngine.ts` | 231–233, 305 | No zero-variance guards in raw engine | ℹ️ Info | UI engines guard; raw engine exposed for future callers (WR-03) |

**Resolved anti-patterns (prior verification):**
- ~~`recognizedColumns: {}` on session bootstrap~~ — fixed by 02-07
- ~~ColumnPreviewTable confirm discards role selections~~ — fixed by 02-08

No unreferenced `TBD`/`FIXME`/`XXX` debt markers in Phase 2 source files.

### Human Verification Required

### 1. Chart visual parity vs v1.0

**Test:** Run each migrated test with "Usar exemplo", confirm in Configurar, compare Resultados charts side-by-side with v1.0 module output.  
**Expected:** Chart types, colors (dark/teal theme), series points/bars, and annotation overlays match v1.0 didactic output.  
**Why human:** Automated tests verify numeric parity and component wiring, not rendered chart pixels.

### 2. PNG export after customization

**Test:** On each migrated test, change chart type/theme/axis label in ChartCustomizer, immediately click "Baixar gráfico (PNG)", open file.  
**Expected:** PNG reflects the customization just applied.  
**Why human:** jsdom lacks canvas.toDataURL; debounce race documented in WR-02.

### 3. Didactic Configurar experience

**Test:** Open each test → Usar exemplo → review mode/method cards, α selector, research question, didactic cards → Resultados.  
**Expected:** Copy reads naturally in PT; mode/method switch after confirm shows soft-reset alert and clears stale results.  
**Why human:** Teaching UX judgment per 02-VALIDATION.md manual-only table.

### Gaps Summary

**All automated must-haves pass (6/6).** Gap-closure plans 02-07 and 02-08 successfully closed CR-01 and WR-01:

- **02-07** added `deriveRecognizedColumnsFromTabular` and wired session/DATASUS bootstrap in all three migrated tests — domain keys now resolve before Configurar confirm.
- **02-08** added `deriveRecognizedColumnsFromRoles`, extended `ColumnPreviewTable` confirm contract, and wired confirm-time mapping through ConfigPanels to engine analysis. The Mapas handoff integration test now proves Configurar → Analisar dados → Resultados with `r de Pearson` visible.

Remaining items are **human-only polish checks** (chart pixels, PNG debounce timing, didactic UX quality) and non-blocking review warnings (WR-02, WR-03, WR-04). No structured gaps remain for `/gsd:plan-phase --gaps`.

---

_Verified: 2026-07-25T19:45:00Z_  
_Verifier: Claude (gsd-verifier)_
