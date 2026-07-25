---
phase: 02-migrar-testes-existentes
verified: 2026-07-25T19:35:00Z
status: gaps_found
score: 5/6
overrides_applied: 0
gaps:
  - truth: "Mapas → Estatística handoff data can be analyzed by migrated tests (session-injected paste completes Configurar → Resultados)"
    status: failed
    reason: "Session bootstrap sets recognizedColumns: {} in all three migrated test modules; buildDatasetFromConfirmed never resolves domain keys (grupo_a/grupo_b, variavel_x/variavel_y, tempo/variavel_y), so analysis fails validation after confirm."
    artifacts:
      - path: "src/features/tests/t-student/TStudentTest.tsx"
        issue: "initialLoadedFromSession hardcodes recognizedColumns: {} (lines 52–61); results use loadedInput.recognizedColumns (line 205)"
      - path: "src/features/tests/correlacao/CorrelacaoTest.tsx"
        issue: "Same empty recognizedColumns on session bootstrap (lines 49–58, 211)"
      - path: "src/features/tests/prais-winsten/PraisWinstenTest.tsx"
        issue: "Same empty recognizedColumns on session bootstrap (lines 43–52, 124)"
      - path: "src/routes/estatistica/EstatisticaPage.test.tsx"
        issue: "Handoff test only asserts Configurar step opens — not that analysis succeeds"
    missing:
      - "Re-derive recognizedColumns from session headers/rows + test TABULAR_OPTIONS on bootstrap (see 02-REVIEW.md CR-01 fix sketch)"
      - "Or extend ColumnPreviewTable.onConfirm to emit role→domain-key mapping used at results time"
      - "Add RTL/integration test: Mapas handoff dataset → Configurar confirm → Resultados metrics visible"
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
**Verified:** 2026-07-25T19:35:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User runs t de Student in the new shell and gets results matching v1.0 output | ✓ VERIFIED | `tStudentEngine.test.ts` differential parity vs `tests/t-student/module.js` exports; `statsEngine.test.ts` Welch parity; `TStudentTest.test.tsx` exemplo flow reaches Resultados with metrics + interpretation prose |
| 2 | User runs Correlação Pearson/Spearman with results matching v1.0 output | ✓ VERIFIED | `correlacaoEngine.test.ts` Pearson/Spearman parity vs legacy Stats oracle on `correlacao-exemplo.txt`; `CorrelacaoTest.test.tsx` exemplo flow through Resultados |
| 3 | User runs Prais-Winsten with results matching v1.0 output | ✓ VERIFIED | `praisEngine.test.ts` model field parity (α, β, ρ, classification) vs legacy Stats on `prais-exemplo.txt`; `PraisWinstenTest.test.tsx` exemplo flow through Resultados |
| 4 | Each migrated test shows a plain-Portuguese interpretation paragraph | ✓ VERIFIED | All three modules call `build*Interpretation()` and pass `interpretation` to `ResultsPanelWithCustomizer` → `InterpretationText`; RTL tests assert "O que isso significa?" and prose without HTML tags |
| 5 | Each migrated test supports PNG export like other modules | ✓ VERIFIED | `ResultsPanelWithCustomizer.tsx` wires `useChartExport` + "Baixar gráfico (PNG)" button with per-test filenames (`t-student-lacirstat.png`, `correlacao-lacirstat.png`, `prais-winsten-lacirstat.png`); RTL tests assert button presence |
| 6 | Mapas → Estatística handoff completes analysis on migrated tests | ✗ FAILED | CR-01 still valid: `initialLoadedFromSession` sets `recognizedColumns: {}` in `TStudentTest.tsx:59`, `CorrelacaoTest.tsx:56`, `PraisWinstenTest.tsx:50`; `IniciarPesquisaModal.tsx:145–152` populates session without column mapping; engines require domain keys in `buildDatasetFromConfirmed` |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/shared/stats/statsEngine.ts` | Full Stats port from v1.0 | ✓ VERIFIED | 349 lines; exports welchT, pearson, spearman, praisWinsten, tcdf, etc. |
| `src/features/tests/registry.ts` | Three migrated tests `status: 'available'` | ✓ VERIFIED | t-student, correlacao, prais-winsten all `available` (lines 38–60) |
| `src/routes/estatistica/EstatisticaPage.tsx` | Static switch renders all four modules | ✓ VERIFIED | `renderActiveTest` switch cases demo + 3 migrated (lines 18–30) |
| `src/features/tests/t-student/TStudentTest.tsx` | FlowSteps orchestrator + results | ✓ VERIFIED | Full Dados→Configurar→Resultados; wired to engine + customizer |
| `src/features/tests/correlacao/CorrelacaoTest.tsx` | FlowSteps orchestrator + results | ✓ VERIFIED | Pearson/Spearman toggle; scatter charts via customizer |
| `src/features/tests/prais-winsten/PraisWinstenTest.tsx` | FlowSteps orchestrator + dual charts | ✓ VERIFIED | Trend + residual tabs each mount `ResultsPanelWithCustomizer` |
| `src/shared/charts/ResultsPanelWithCustomizer.tsx` | Metrics + chart + interpretation + PNG | ✓ VERIFIED | Substantive component (130 lines); not a stub |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `EstatisticaPage.tsx` | `TStudentTest` / `CorrelacaoTest` / `PraisWinstenTest` | `renderActiveTest` switch on `activeTestId` | ✓ WIRED | Static imports + switch cases verified |
| `Sidebar.tsx` | `TEST_REGISTRY` | `isTestAvailable` gate | ✓ WIRED | Registry is single source; migrated tests show Disponível |
| `TStudentTest.tsx` | `tStudentEngine.ts` | `buildDatasetFromConfirmed` → `runAnalysis` | ✓ WIRED | Paste/example path resolves columns via `useTabularInput` |
| `TStudentTest.tsx` | `ResultsPanelWithCustomizer` | `tStudentCharts` presets + interpretation | ✓ WIRED | Import + JSX at lines 230–240 |
| `IniciarPesquisaModal.tsx` | migrated test engines | session dataset → column mapping → analysis | ✗ NOT_WIRED | Session stores headers/rows only; migrated tests bootstrap with empty `recognizedColumns` |
| `ColumnPreviewTable.tsx` | migrated test engines | role overrides → `recognizedColumns` | ✗ NOT_WIRED | `onConfirm` emits `{ headers, rows }` only (line 84); engines ignore UI role changes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `TStudentTest` (paste path) | `loadedInput.recognizedColumns` | `useTabularInput` parser on paste | Yes — domain keys populated | ✓ FLOWING |
| `TStudentTest` (session path) | `loadedInput.recognizedColumns` | `initialLoadedFromSession` | No — hardcoded `{}` | ✗ DISCONNECTED |
| `CorrelacaoTest` (paste path) | `engineOutput` | `buildDatasetFromConfirmed` + statsEngine | Yes — differential tests confirm | ✓ FLOWING |
| `PraisWinstenTest` (paste path) | `output.model` | `runAnalysis` → statsEngine.praisWinsten | Yes — fixture parity | ✓ FLOWING |
| `ResultsPanelWithCustomizer` | `interpretation` | `build*Interpretation()` at results time | Yes — string arrays from engine output | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 2 engine differential suites | `npm run test:run -- src/features/tests/t-student/tStudentEngine.test.ts src/features/tests/correlacao/correlacaoEngine.test.ts src/features/tests/prais-winsten/praisEngine.test.ts src/shared/stats/statsEngine.test.ts` | 41/41 passed | ✓ PASS |
| Registry + integration tests | `npm run test:run -- src/features/tests/registry.test.ts` | passed | ✓ PASS |
| Full project test suite | `npm run test:run` | 337/337 passed (45 files) | ✓ PASS |
| Production build | `npm run build` | exit 0, dist assets emitted | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `probe-*.sh` declared in Phase 2 plans or conventional probe paths for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| TEST-01 | 02-03 | t de Student with v1.0 parity in new shell | ✓ SATISFIED | Engine differential tests + RTL exemplo flow (paste path) |
| TEST-02 | 02-04 | Correlação Pearson/Spearman with v1.0 parity | ✓ SATISFIED | Engine differential tests + RTL exemplo flow |
| TEST-03 | 02-05 | Prais-Winsten with v1.0 parity | ✓ SATISFIED | Engine differential tests + RTL exemplo flow |
| UI-04 (PNG export) | 02-02 | Download active chart as PNG | ✓ SATISFIED (wiring) | `ResultsPanelWithCustomizer` export button wired; pixel fidelity needs human check |
| UI-06 (interpretation) | 02-03/04/05 | Brief PT interpretation under results | ✓ SATISFIED | All three modules render `InterpretationText` paragraphs |

**Orphaned requirements for Phase 2:** none (TEST-01–03 all claimed and evidenced)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `TStudentTest.tsx` | 59 | `recognizedColumns: {}` on session bootstrap | 🛑 Blocker | Mapas handoff analysis path broken (CR-01) |
| `CorrelacaoTest.tsx` | 56 | `recognizedColumns: {}` on session bootstrap | 🛑 Blocker | Same |
| `PraisWinstenTest.tsx` | 50 | `recognizedColumns: {}` on session bootstrap | 🛑 Blocker | Same |
| `ColumnPreviewTable.tsx` | 84 | Confirm discards role selections | ⚠️ Warning | User column role overrides have no effect (WR-01) |
| `useChartCustomizer.ts` | 177–191 | Debounced options for live chart | ⚠️ Warning | PNG may capture stale chart within 150 ms window (WR-02) |
| `EstatisticaPage.tsx` | 41–49 | Handoff state re-applied on re-render | ⚠️ Warning | May override manual test selection (WR-04) |

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

Phase 2 **achieves v1.0 numeric parity and shell integration for the primary paste/example workflow**. All three tests are registered as Disponível, mounted from `EstatisticaPage`, run through Dados → Configurar → Resultados, render PT interpretation, and expose PNG export. Differential test suites (337/337 green) and production build pass.

**One integration gap blocks full workflow parity:** Mapas "Iniciar pesquisa" handoff (plan 02-06) lands users on Configurar with session data but **cannot complete analysis** because migrated tests bootstrap with empty `recognizedColumns` (02-REVIEW.md **CR-01**, still unfixed). Paste-direct and "Usar exemplo" paths work because `useTabularInput` populates column mapping; session-injected data bypasses that parser.

Secondary warnings (WR-01 column role overrides ignored, WR-02 PNG debounce, WR-04 handoff state persistence) do not block the core phase goal for paste-based usage but should be tracked for polish.

---

_Verified: 2026-07-25T19:35:00Z_  
_Verifier: Claude (gsd-verifier)_
