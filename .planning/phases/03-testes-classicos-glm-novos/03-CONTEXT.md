# Phase 3: Testes clássicos + GLM novos - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the six capacitação tests still marked `em-breve` in `TEST_REGISTRY`: **Qui-quadrado de independência**, **ANOVA de uma via + Tukey**, **Kruskal-Wallis + Dunn**, **Regressão de Poisson**, **Binomial Negativa**, and **Regressão Logística**. Each module mounts in the shared FlowSteps shell (Dados → Configurar → Resultados), returns correct numerics (JASP/textbook oracle), plain-PT interpretation, assumption nudges (UX-02), charts + PNG via the Phase 2 customizer pattern, and flips registry status to `available`.

**Requirements:** TEST-04 … TEST-09, UX-02.

**Out of scope:** Mapas geo analysis (Phase 4), variáveis scrape/catalog (Phase 5), meta-análise (Phase 6), embedding R/JASP runtime or WASM in the browser, Bayesian options, multi-way ANOVA, interactions/hierarchical GLM, Fisher exact as a full registry entry (may be mentioned in chi-square nudge only).

</domain>

<decisions>
## Implementation Decisions

### Ordem de entrega (ondas didáticas)
- **D-01:** Deliver in **two waves inside Phase 3** (not six isolated milestones): **Wave A — clássicos** (qui-quadrado, ANOVA+Tukey, Kruskal+Dunn), then **Wave B — GLM** (Poisson, Binomial Negativa, Logística). Matches capacitação order and lets ligantes use group/frequency tests while GLM lands.
- **D-02:** Each wave lands complete modules (engine + Configurar + results + charts + tests + registry `available`). Do not leave half-wired sidebar entries.
- **D-03:** Keep one registry entry per test (already defined in `registry.ts`). No merging ANOVA+Kruskal into a single entry — teaching names stay separate; cross-nudge between them when assumptions suggest the other.

### Nudges de pressupostos (UX-02)
- **D-04:** Assumption feedback is a **soft nudge strip** above metrics (“Pressupostos”), never a hard block. Always compute and show results; warn when assumptions are shaky and say what that means in plain PT.
- **D-05:** Severity levels: `info` (tip) and `warning` (careful). No red “error” that hides the analysis.
- **D-06:** Per-test nudges (minimum set):
  - **Qui-quadrado:** expected cell counts; warn when any expected &lt; 5 (and note % of cells &lt; 5). Show effect size (Cramér’s V). If 2×2 and sparse cells, suggest interpreting with caution (Fisher mention as tip only).
  - **ANOVA:** hint when group sizes are very unequal or residual/normality looks poor → suggest Kruskal-Wallis; homogeneity tip when SDs differ a lot across groups.
  - **Kruskal:** info that it is the rank alternative when normality fails; still show Dunn pairwise.
  - **Poisson:** overdispersion check (e.g. Pearson χ²/df or residual deviance/df); if clearly &gt; 1, **warning + CTA** to open Binomial Negativa with the same mapped columns.
  - **Binomial Negativa:** info that it relaxes equidispersion; show dispersion parameter in metrics.
  - **Logística:** tip on rare events / separation risk when outcome is extremely imbalanced; report ORs with IC95%.
- **D-07:** Nudges must react to **variable roles and empirical distribution** of the confirmed dataset (not static textbook text only).

### Entrada de dados / Configurar / tipos de variável
- **D-08:** Reuse the Phase 1–2 paste/upload + `ColumnPreviewTable` role mapping pattern. No new data pipeline.
- **D-09:** **Qui-quadrado primary path:** two categorical columns → engine builds the contingency table (DataSUS-friendly). Optional advanced: paste an already aggregated contingency matrix only if cheap; otherwise skip for economy.
- **D-10:** **ANOVA / Kruskal:** one numeric outcome + one categorical grouping factor (≥3 levels for post-hoc usefulness; still allow 2 with a tip that t-Student may be simpler).
- **D-11:** **GLM (Poisson / NB / Logística):** one outcome + ≥1 predictor via roles. Didactic subset: main effects only (no interactions, no offsets/exposure unless already trivial). Poisson/NB outcome = counts (non-negative integers); Logística outcome = binary (0/1 or two-level factor).
- **D-12:** Configurar shows **α**, research question, “Usar exemplo”, and short didactic cards (same spirit as migrated tests). Validate types before analyze: wrong type → friendly error listing expected roles, do not crash.
- **D-13:** Soft-reset after confirm when the user changes method-critical knobs (mirror Correlação/t-Student): keep paste, clear results that would mix settings.

### Pós-hoc e tabelas
- **D-14:** Tukey (ANOVA) and Dunn (Kruskal) render as a **compact pairwise table**: contraste, estatística, p ajustado, e IC quando o método fornecer. Default sort by p ajustado.
- **D-15:** If number of groups ≤ 6, also offer a **heatmap preset** of adjusted p (or mean/rank difference) in the chart customizer; if &gt; 6, table-only by default to avoid clutter.
- **D-16:** Omnibus test metrics stay on the metric cards; pairwise is a results section below (not buried only inside a chart).

### Motor numérico e economia (JASP-first)
- **D-17:** **No R/JASP runtime in the browser.** Port formulas into TypeScript (`statsEngine` and/or `src/features/tests/*/…Engine.ts`), client-side only.
- **D-18:** **JASP is the behavioral/numeric oracle**, not a UI to clone. Prefer algorithms and default options aligned with JASP modules: `jaspFrequencies` (Contingency Tables / χ²), `jaspAnova` (ANOVA + Tukey), nonparametric Kruskal/Dunn as in JASP ANOVA/Frequencies family, `jaspRegression` (GLM: Poisson, Negative Binomial, Logistic). Tree note: module R sources may live outside this repo’s checked-in `jasp-desktop-development` shell — researcher must locate/vendor golden outputs or standard references; do not re-derive exotic variants.
- **D-19:** Extend existing `src/shared/stats/statsEngine.ts` primitives (gamma/beta/t already present) rather than adding a heavy stats npm stack, unless research proves a tiny well-known lib is cheaper for IRLS/GLM than a careful port.
- **D-20:** **Binomial Negativa** is always its own available test (TEST-08). Poisson (TEST-07) must surface overdispersion and deep-link/suggest NB with the same column mapping when overdispersed — not auto-switch silently.
- **D-21:** Parity bar matches Phase 2: **display-rounded UI numbers + PT interpretation conclusion**; automated tests vs golden fixtures / differential oracles at display precision.
- **D-22:** Charts reuse `ResultsPanelWithCustomizer` + annotation toggles. Sensible defaults: χ² → mosaic or grouped bars of observed vs expected; ANOVA/Kruskal → means/box or rank summary; GLM → coefficient/OR forest-style or predicted-vs-observed as appropriate. Deep customize allowed; values must stay statistically correct.

### Claude's Discretion
- Exact IRLS / Fisher scoring implementation details and whether a minimal dependency is justified after research.
- Exact wording of assumption nudges (keep short, PT, capacitação tone).
- Whether Fisher exact is linked as a one-line tip only or a tiny 2×2 helper later (default: tip only).
- Default α = 0.05; example datasets per module (synthetic capacitação-sized).
- Exact metric card sets per test (must include the success-criteria fields: effect size / post-hoc / OR+CI / overdispersion indicator).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/PROJECT.md` — JASP as oracle; client-only; didactic PT; suite list includes these six tests
- `.planning/REQUIREMENTS.md` — TEST-04…TEST-09, UX-02
- `.planning/ROADMAP.md` — Phase 3 goal & success criteria
- `.planning/phases/01-redesign-base-react-shell/01-CONTEXT.md` — FlowSteps, registry, results pattern
- `.planning/phases/02-migrar-testes-existentes/02-CONTEXT.md` — shell fit, chart customizer, parity bar, soft-reset

### App integration points
- `src/features/tests/registry.ts` — six `em-breve` entries (`qui-quadrado`, `anova-tukey`, `kruskal-dunn`, `poisson`, `binomial-negativa`, `logistica`)
- `src/shared/stats/statsEngine.ts` — existing numeric primitives to extend
- `src/shared/charts/ResultsPanelWithCustomizer.tsx` — results + charts + PNG
- `src/shared/flow/FlowSteps.tsx` — Dados → Configurar → Resultados
- `src/routes/estatistica/ColumnPreviewTable.tsx` — role mapping UX
- `src/features/tests/t-student/` — template module shape to clone (engine / charts / interpretation / Test.tsx)

### JASP oracle (behavior & formulas — do not reinvent)
- `jasp-desktop-development/Modules/modules-settings.json` — canonical module IDs: `jaspFrequencies`, `jaspAnova`, `jaspRegression`
- `jasp-desktop-development/Docs/development/r-analyses-guide.md` — how JASP R analyses are structured
- `jasp-desktop-development/Resources/Data Sets/Data Library/3. ANOVA` — example domains
- `jasp-desktop-development/Resources/Data Sets/Data Library/4. Regression`
- `jasp-desktop-development/Resources/Data Sets/Data Library/5. Frequencies`
- External module sources when needed for golden values: JASP `jaspFrequencies` (Contingency Tables), `jaspAnova` (ANOVA/Tukey/Kruskal), `jaspRegression` (GLM families) — fetch/vendor reference outputs during research; do not ship R in the app

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FlowSteps`, `useTabularInput`, `ColumnPreviewTable`, `ResultsPanelWithCustomizer`, `InterpretationText`, `UseExampleButton`, `AlphaSelector`, `ResearchQuestionField`
- `statsEngine` CDF/inv helpers suitable for χ²/F/t building blocks
- Phase 2 test modules as copy-shape templates

### Established Patterns
- Feature folder per test under `src/features/tests/<id>/`
- Registry-driven sidebar; status `em-breve` → `available`
- Soft-reset on mode/method change after confirm
- Chart presets + per-chart annotation toggles; publication white canvas

### Integration Points
- Estatística route mounts registry modules
- “Qual teste usar?” modal reads the same registry
- Session handoff / recognized columns pattern from Phase 2 gap-closure

</code_context>

<specifics>
## Specific Ideas

- User asked to **maximize reuse of JASP logic** and to **decide autonomously** for didactic quality.
- Emphasize **variable types + distribution diagnostics** (expected counts, overdispersion, normality/heterogeneity hints) so students learn *when* a test is appropriate, not only how to click Run.
- Prefer **economy**: no new backend, no R-in-browser, minimal new dependencies, clone existing module UX.

</specifics>

<deferred>
## Deferred Ideas

- Full Fisher exact module as its own registry test
- GLM interactions, offsets/exposure, multinomial logistic
- Multi-way / repeated-measures ANOVA
- Bayesian contingency / ANOVA
- Auto-router that picks the test for the user (beyond soft nudges) — belongs nearer “Qual teste usar?” / Phase 5 variable typing

None — discussion stayed within phase scope for the six tests + UX-02.

</deferred>

---

*Phase: 3-Testes clássicos + GLM novos*
*Context gathered: 2026-07-25*
