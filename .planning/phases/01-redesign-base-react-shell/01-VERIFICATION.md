---
phase: 01-redesign-base-react-shell
verified: 2026-07-25T18:10:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `npm run dev`, open the app, confirm landing on Estatística with dark (#0a0f0d) background, teal (#10b981) active nav underline, LACIR logo+wordmark, and header nav Estatística | Meta-análise | Variáveis | Mapas (no version badge). Click all four nav items — each renders its own layout with route-entry fade and no full page reload."
    expected: "Dark+teal portal shell with four working client-side routes; Portal DATASUS link visible only inside Estatística."
    why_human: "Visual judgment of colors, grain texture, fade animation, and SPA navigation feel."
  - test: "Resize browser below ~980px on Estatística and confirm the test sidebar collapses and re-expands via toggle without overlapping main content."
    expected: "Collapsible sidebar matches MVP breakpoint behavior."
    why_human: "Responsive layout and overlap cannot be verified by unit tests alone."
  - test: "Complete Teste demo end-to-end with sample data, a real TABNET paste from DataSUS, and once through Assistente DATASUS. Confirm chart renders, Portuguese interpretation reads naturally, and 'Baixar gráfico (PNG)' saves a real PNG (not blank/0-byte) with dark background and teal series."
    expected: "Full Dados → Configurar → Resultados flow with metric cards, chart, interpretation, and working PNG export."
    why_human: "jsdom canvas stubs cannot verify real pixel output or live paste UX."
  - test: "Paste a real TABNET dump copied straight from DataSUS into the textarea. Confirm columns auto-detect, preview looks correct, and flow advances to Configurar."
    expected: "Auto-detect → preview → confirm with friendly errors on invalid paste."
    why_human: "Unit fixtures cover parser parity; one live messy dump smoke test needed."
  - test: "Import a real multi-source TABNET export and walk all six DataSUS assistant steps (header correction, role mapping, normalized preview)."
    expected: "Six-step wizard behaves like v1.0 assistant."
    why_human: "Interaction feel and multi-source parity require live data."
  - test: "Open /mapas — hover several states (panel follows mouse), click two states with different variable availability (intersection first, 'Não existe em …' alert names correct states), Tab to a state and Enter to select."
    expected: "Hover/lock/multi-select map shell with keyboard operability."
    why_human: "Visual/interaction feel of SVG map and panel updates."
  - test: "On /mapas select two states and a variable, click 'Iniciar pesquisa', follow a collection link, paste a table into the modal, click 'Continuar para Estatística'."
    expected: "Land on Estatística with pasted data on Configurar step (session hydrated from Mapas handoff)."
    why_human: "Cross-route navigation + session hydration requires browser."
  - test: "Leave-prompt matrix: with data on Estatística press Cmd/Ctrl+R (native leave prompt appears; cancel). Navigate to Mapas and refresh (no prompt). Return to Estatística with no data and refresh (no prompt). Use 'Limpar dados' and confirm flow returns to Dados with no prompt on next refresh."
    expected: "beforeunload only on Estatística when hasData; no persistent refresh banner anywhere."
    why_human: "Native browser dialog behavior cannot be automated in jsdom."
  - test: "Open 'Qual teste usar?' modal — walk decision tree, confirm roadmap lists tests with 'Em breve' chips and only Teste demo is navigable."
    expected: "UX-01 modal with full roadmap and em-breve gating."
    why_human: "Modal UX and visual chip states benefit from human review."
---

# Phase 1: Redesign / base React shell Verification Report

**Phase Goal:** Users experience the LACIR portal React shell — header nav, Estatística flow, Mapas mock research launcher, shared paste, export, and conditional leave warning — that later modules mount on.

**Verified:** 2026-07-25T18:10:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User opens the app on Estatística and sees dark + teal accents, LACIR logo+name, and header nav Estatística \| Meta-análise \| Variáveis \| Mapas (no version badge; DataSUS link inside Estatística) | ✓ VERIFIED | `Header.tsx` NAV_ITEMS with NavLink teal active state; `LogoLockup.tsx` logo+wordmark; `theme.css` `--color-bg: #0a0f0d`, `--color-accent: #10b981`; `router.tsx` landing `/` → `EstatisticaPage`; `PortalDatasusLink.tsx` only in `EstatisticaPage.tsx`; `Header.test.tsx` asserts no beta badge |
| 2 | User completes the stub test through Dados → Configurar → Resultados with brief PT interpretation | ✓ VERIFIED | `TesteDemo.tsx` wires `FlowSteps` three slots; `ResultsPanel.tsx` + `InterpretationText.tsx` ("O que isso significa?"); `demoStats.ts` builds PT paragraphs; `TesteDemo.test.tsx` covers end-to-end gating |
| 3 | User pastes messy DataSUS/TABNET-style data and gets auto-detect → preview → confirm (friendly errors when invalid) | ✓ VERIFIED | `TabularInputPanel.tsx` + `ColumnPreviewTable.tsx` + `useTabularInput.ts`; `parseTabular.ts`/`datasusImporter.ts` ported with differential tests; friendly error with "Ver detalhes" expandable list |
| 4 | User downloads the active result chart as a PNG | ✓ VERIFIED | `ResultsPanel.tsx` "Baixar gráfico (PNG)" → `useChartExport.ts` `toDataURL('image/png')` + anchor download; `useChartExport.test.ts` + `ResultsPanel.test.tsx` pass |
| 5 | Leaving/closing Estatística with inputted data triggers a browser leave prompt; no persistent refresh banner | ✓ VERIFIED | `LeaveWarningGuard.tsx` mounted only in `EstatisticaPage`; `useLeaveWarning.ts` gates on `hasData`; no "perde/refresh/banner" copy in `src/`; `useLeaveWarning.test.ts` + `ClearDataButton.test.tsx` verify listener lifecycle |
| 6 | User can open "qual teste?" modal (roadmap with em breve) and use Mapas mock: hover/select UFs, variable panel intersection/partials, stub Iniciar pesquisa | ✓ VERIFIED | `QualTesteModal.tsx` decision tree + TEST_REGISTRY roadmap; `MapasPage.tsx` + `BrazilMockMap.tsx` (keyboard tabIndex/onKeyDown) + `VariablePanel.tsx` intersection/partials + `IniciarPesquisaModal.tsx` stub handoff; related unit tests all pass |

**Score:** 6/6 truths verified (automated/code level)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `vite.config.ts` | React + Tailwind v4 + vitest | ✓ VERIFIED | Build + 248 tests pass |
| `index.html` | SPA entry, no importmap | ✓ VERIFIED | `/src/main.tsx` only; Sora + IBM Plex Mono fonts |
| `src/app/Header.tsx` | 4 NavLinks, logo, no badge | ✓ VERIFIED | 50 lines, wired in AppShell |
| `src/app/router.tsx` | 4 routes under AppShell | ✓ VERIFIED | `/`, `/meta-analise`, `/variaveis`, `/mapas` |
| `src/app/theme.css` | Dark + teal tokens | ✓ VERIFIED | 116+ lines; `theme.contract.test.ts` guards forbidden hexes |
| `src/shared/session/SessionProvider.tsx` | In-memory session | ✓ VERIFIED | Wired in `main.tsx`; tests pass |
| `src/components/PlaceholderShell.tsx` | Em breve for Meta/Variáveis | ✓ VERIFIED | Used by both placeholder pages |
| `src/shared/flow/FlowSteps.tsx` | 3-step shell | ✓ VERIFIED | Step gating tested |
| `src/shared/data-input/*` | Ported parsers + wizard | ✓ VERIFIED | Differential parity tests green |
| `src/shared/charts/*` | Chart.js npm + PNG export | ✓ VERIFIED | No CDN imports |
| `src/routes/estatistica/demo/TesteDemo.tsx` | Stub test module | ✓ VERIFIED | Sample/paste/DATASUS paths |
| `src/routes/mapas/*` | Mock map shell | ✓ VERIFIED | 27 UF paths, intersection logic, modal |
| `public/logo-lacir.png` | Brand mark | ✓ VERIFIED | Present |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `main.tsx` | `router.tsx` | RouterProvider in SessionProvider | ✓ WIRED | Lines 6-12 |
| `Header.tsx` | react-router NavLink | NAV_ITEMS map | ✓ WIRED | NavLink with active teal border |
| `EstatisticaPage.tsx` | `LeaveWarningGuard.tsx` | Mount + hasData | ✓ WIRED | Guard reads session |
| `TesteDemo.tsx` | `FlowSteps.tsx` | dados/configurar/resultados slots | ✓ WIRED | canAdvance gating |
| `ResultsPanel.tsx` | `useChartExport.ts` | canvas ref + button | ✓ WIRED | Export handler on click |
| `QualTesteModal.tsx` | `registry.ts` | TEST_REGISTRY roadmap | ✓ WIRED | Shared with Sidebar |
| `IniciarPesquisaModal.tsx` | `SessionProvider` | setDataset + navigate('/') | ✓ WIRED | Cross-route handoff |
| `BrazilMockMap.tsx` | `MapasPage.tsx` | onHoverUF/onToggleUF | ✓ WIRED | State lifted in page |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `TesteDemo.tsx` | `confirmedDataset` | paste/sample/DATASUS → tabular parsers | Yes — parsed rows drive `summarizeGroups` | ✓ FLOWING |
| `ResultsPanel.tsx` | `metrics`, `chart.data` | `demoStats.summarizeGroups` | Yes — computed from confirmed rows | ✓ FLOWING |
| `VariablePanel.tsx` | `availability` | `computeVariableIntersection` + mock fixture | Yes — derived from MOCK_VARIABLES_BY_UF | ✓ FLOWING |
| `IniciarPesquisaModal.tsx` | session dataset | tabular paste in modal | Yes — setDataset on continue | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npm run test:run` | 248 passed (30 files) | ✓ PASS |
| Production build | `npm run build` | Exit 0, dist bundle produced | ✓ PASS |
| Type safety | `npm run typecheck` | Exit 0 | ✓ PASS |
| Forbidden legacy hex absent | `theme.contract.test.ts` | Passes in suite | ✓ PASS |
| Router landing route | `router.test.tsx` | Estatística at `/` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| UI-01 | 01-01..01-05, 01-07, 01-09 | React portal shell dark+teal, header nav | ✓ SATISFIED | Header, theme, router, placeholders |
| UI-02 | 01-06, 01-08, 01-10 | Shared Dados→Configurar→Resultados flow | ✓ SATISFIED | FlowSteps + TesteDemo + Datasus wizard |
| UI-03 | 01-03, 01-06, 01-08, 01-11 | TABNET paste + friendly validation | ✓ SATISFIED | Parsers + TabularInputPanel |
| UI-04 | 01-04, 01-10 | PNG chart export | ✓ SATISFIED | useChartExport wired in ResultsPanel |
| UI-05 | 01-12 | Conditional beforeunload on Estatística | ✓ SATISFIED | LeaveWarningGuard + useLeaveWarning |
| UI-06 | 01-10 | Plain-PT interpretation slot | ✓ SATISFIED | InterpretationText in ResultsPanel |
| UX-01 | 01-07 | "Qual teste usar?" decision tree modal | ✓ SATISFIED | QualTesteModal + registry |

No orphaned Phase 1 requirements — all UI-01..06 and UX-01 mapped and evidenced.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX debt markers in phase `src/` files | — | None |
| — | — | No CDN Chart.js or importmap | — | None |
| — | — | No persistent refresh-loss banner | — | None |

### Human Verification Required

Nine browser UAT items remain (deferred per `workflow.human_verify_mode = end-of-phase` in plan `<human-check>` blocks). See YAML frontmatter `human_verification` for the full checklist.

**Priority order for UAT:**

1. **Portal shell visual pass** — dark+teal, nav, route fade (SC-1)
2. **Teste demo full flow + PNG download** — three input paths (SC-2, SC-4)
3. **Live TABNET paste smoke** (SC-3)
4. **Mapas interaction + Iniciar pesquisa handoff** (SC-6)
5. **Leave-prompt matrix** (SC-5)
6. **DataSUS six-step wizard with real export** (SC-3 extension)
7. **Sidebar collapse at 980px** (UI-01/D-05)
8. **Qual teste modal walkthrough** (UX-01)

### Gaps Summary

No automated gaps found. All six ROADMAP success criteria are implemented and covered by passing tests (248/248), successful build, and typecheck. Phase goal is **code-complete**; status is `human_needed` because nine visual/browser behaviors documented in `01-VALIDATION.md` require human UAT before treating the phase as fully signed off.

---

_Verified: 2026-07-25T18:10:00Z_  
_Verifier: Claude (gsd-verifier)_
