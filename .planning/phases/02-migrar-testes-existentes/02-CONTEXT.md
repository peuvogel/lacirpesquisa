# Phase 2: Migrar testes existentes - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Port the three validated v1.0 tests — **t de Student**, **Correlação Pearson/Spearman**, and **Prais-Winsten** — into the Phase 1 React shell with no regression in numbers, Portuguese interpretation, or didactic workflow. Each migrated module uses the shared Dados → Configurar → Resultados flow, shows interpretation, and supports PNG export. Charts for migrated tests are a Phase 2 deliverable: diverse, professional, and deeply customizable (not a minimal Chart.js retint).

**Requirements touched:** TEST-01, TEST-02, TEST-03 (parity + interpretation + PNG like every other module).

**Out of scope for this phase:** New statistical tests (Phase 3), Mapas geo/catalog wiring (Phase 4), Variáveis catalog (Phase 5), Meta-análise (Phase 6), login/backend.

</domain>

<decisions>
## Implementation Decisions

### Shell fit & Configurar
- **D-01:** Each migrated test uses the **shared FlowSteps shell** (Dados → Configurar → Resultados) and reusable results pattern (`ResultsPanel` / interpretation / PNG) — not a 1:1 recreation of legacy page chrome from `tests/*/module.js`.
- **D-02:** **Configurar ships full legacy knobs** that affect the analysis: α (1%/5%/10%), research question text, mode/method toggles, and DataSUS derive options (period, procedures, etc.) as exposed in v1.0.
- **D-03:** Keep **didactic cards** (from each `config.json`) visible in Configurar as collapsible teaching content, and **“Usar exemplo”** on Dados to pre-fill the paste box from legacy example/templates.

### Charts (migrated tests only)
- **D-04:** Migrated tests get a **deep chart customization** experience in Resultados: multiple professional chart types, axes, annotations, and themes beyond brand defaults — not only “same v1.0 chart kind + teal.”
- **D-05:** Plotted **values** must remain statistically correct; visual layout may diverge from v1.0 SVG/Chart.js layouts.
- **D-06:** **Teste demo stays simple** — basic chart + PNG only. Full chart power is for migrated (and later) real tests, not the demo tour.

### Parity bar
- **D-07:** “Matches v1.0” means **display-rounded numbers + Portuguese interpretation** (same significance call and key stats). Charts need not twin v1.0 visually.
- **D-08:** Automated numeric checks compare **as shown in the UI** (e.g. p / r / t / ICs at display precision), not raw full-precision floats.
- **D-09:** Fixtures per test: legacy **Usar exemplo / template CSV** plus **one TABNET-style** case where the v1.0 module supports DataSUS. Differential tests against **untouched** `tests/*/module.js` exports.
- **D-10:** Interpretation wording may be **lightly cleaned** for the new shell; must not change the conclusion or omit key numbers. Not byte-identical required.

### t de Student
- **D-11:** Single `TEST_REGISTRY` entry `t-student` (“t de Student”). **Independiente vs pareado** chosen via Configurar choice cards (legacy guided pattern).
- **D-12:** Default mode = **t independente**.
- **D-13:** Switching mode **keeps pasted data**; clears mode-specific Configurar fields and results so settings do not mix.
- **D-14:** Independent path labeled **“t independente (Welch)”**; always Welch under the hood. No equal-variance Student toggle in Phase 2.

### Teste demo & landing
- **D-15:** Keep **Teste demo** available under Demonstração after real tests ship (flow tour; no significance claim).
- **D-16:** Estatística **lands on Teste demo** by default.
- **D-17:** In “Qual teste usar?”, demo remains listed and navigable, clearly labeled as **demonstração** (not a real significance test). Real tests flip from `em-breve` → `available`.

### Claude's Discretion
- **Correlação:** Keep one registry entry with Pearson/Spearman method control in Configurar (matches v1.0 title/`TEST_REGISTRY`); mirror t-Student soft-reset behavior when method changes if needed.
- **Prais-Winsten:** Port full legacy knobs/series UX into Configurar within the shared shell; exact layout of series preview is planner/implementer choice.
- Chart library/stack for the deep customize surface (extend Chart.js vs additional lib) — choose for professionalism + maintainability; stay client-side.
- Exact metric-card set and default chart per test — prefer v1.0 defaults as starting presets inside the customizer.
- Whether `derive*` helpers in `datasusNormalizer.ts` become the sole engine path or wrap ported pure functions from `tests/*/module.js` — researcher/planner decide, with differential parity as the gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/PROJECT.md` — milestone goals; “reuse JASP/MVP engines, don’t reinvent”
- `.planning/REQUIREMENTS.md` — TEST-01, TEST-02, TEST-03
- `.planning/ROADMAP.md` — Phase 2 goal & success criteria
- `.planning/phases/01-redesign-base-react-shell/01-CONTEXT.md` — shell IA, FlowSteps, registry, results pattern
- `.planning/phases/01-redesign-base-react-shell/01-UI-SPEC.md` — visual/copy contracts (dark + teal, interpretation slot, PNG CTA)

### Legacy engines & modules (parity oracle)
- `tests-manifest.json` — registry titles/subtitles for the three tests
- `tests/t-student/module.js` — Welch/`safeWelch`, parse, interpretation builders, charts
- `tests/t-student/module-guided.js` — mode choice cards, guided UX
- `tests/t-student/config.json` — didactic cards, `exampleText`, default question
- `tests/t-student/templates/` — exemplo/vazio CSVs
- `tests/correlacao/module.js` — Pearson/Spearman engine + UI
- `tests/correlacao/config.json` + `tests/correlacao/templates/`
- `tests/prais-winsten/module.js` — Prais-Winsten engine + interpretation + series charts
- `tests/prais-winsten/config.json`
- `assets/js/app.js` — shared Stats helpers used by legacy modules
- `assets/js/chart-manager.js` — Chart.js + PNG patterns (Phase 1 already ported theme/canvas)

### Phase 1 React shell (integration)
- `src/features/tests/registry.ts` — flip `em-breve` → `available` for the three ids; keep demo
- `src/routes/estatistica/demo/TesteDemo.tsx` — reference FlowSteps wiring
- `src/shared/flow/FlowSteps.tsx` — three-step shell
- `src/shared/data-input/*` — paste/parsers; `deriveIndependentTTest` / `derivePairedTTest` / `deriveCorrelationPairs` / `derivePraisSeries` (ported, numerically unverified in Phase 1)
- `src/shared/charts/*` — `ChartCanvas`, `chartTheme`, `useChartExport` (extend for deep customize)

### Secondary oracle (do not embed UI)
- `jasp-desktop-development/` — optional dispute resolution for formulas; not required for Phase 2 acceptance (D-07)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FlowSteps + TabularInputPanel + ResultsPanel + InterpretationText** — mount each migrated test like Teste demo
- **TEST_REGISTRY** — single source for sidebar + Qual teste modal; Phase 2 only changes status (+ demo labeling)
- **datasusNormalizer derive\*** — already typed; need numeric verification against `tests/*/module.js`
- **Legacy templates/exampleText** — feed “Usar exemplo” and parity fixtures

### Established Patterns
- Differential parity tests (Phase 1 parsers) — repeat for stats: import legacy module exports vs new TS
- In-memory session only; leave warning already scoped to Estatística + hasData
- No dynamic `tests-manifest` fetch — static imports keyed by registry `id`

### Integration Points
- Estatística sidebar selection → route/module render per test id
- Qual teste usar? roadmap chips unlock when status = available
- Mapas → Estatística handoff should land on a real test’s Configurar when data is present (planner: which default test if not demo — prefer last selected or t-Student; demo remains cold start default only)

</code_context>

<specifics>
## Specific Ideas

- User wants charts that are **diverse, highly customizable, and professional** — explicitly chose deep customize in Phase 2 over a fixed per-test suite or “teal retint only.”
- Demo must not pretend to be a significance test; keep the Phase 1 honesty disclaimer pattern.

</specifics>

<deferred>
## Deferred Ideas

- Equal-variance (classic) Student toggle — deferred; Phase 2 is Welch-only for independent
- JASP as mandatory second oracle for acceptance — deferred; optional dispute tool only
- Broad edge-case fixture library beyond example + one TABNET case — can grow in Phase 3+
- Removing or hiding Teste demo — rejected for this phase
- New statistical tests (qui-quadrado, ANOVA, GLM, etc.) — **Phase 3**
- Full Mapas catalog/geo — **Phase 4**

</deferred>

---

*Phase: 2-Migrar testes existentes*
*Context gathered: 2026-07-25*
