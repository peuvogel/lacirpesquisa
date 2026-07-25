# Phase 3: Testes clássicos + GLM novos - Research

**Researched:** 2026-07-25
**Domain:** Six new client-side statistical test modules (χ², ANOVA/Tukey, Kruskal/Dunn, Poisson, NB, Logistic) with JASP-oracle numerics, assumption nudges, and Phase 2 shell reuse
**Confidence:** HIGH (shell integration + parity pattern); MEDIUM (GLM/NB numerics vs JASP); MEDIUM (Tukey/Dunn exact adjustment parity)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Ordem de entrega (ondas didáticas)
- **D-01:** Deliver in **two waves inside Phase 3** (not six isolated milestones): **Wave A — clássicos** (qui-quadrado, ANOVA+Tukey, Kruskal+Dunn), then **Wave B — GLM** (Poisson, Binomial Negativa, Logística). Matches capacitação order and lets ligantes use group/frequency tests while GLM lands.
- **D-02:** Each wave lands complete modules (engine + Configurar + results + charts + tests + registry `available`). Do not leave half-wired sidebar entries.
- **D-03:** Keep one registry entry per test (already defined in `registry.ts`). No merging ANOVA+Kruskal into a single entry — teaching names stay separate; cross-nudge between them when assumptions suggest the other.

#### Nudges de pressupostos (UX-02)
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

#### Entrada de dados / Configurar / tipos de variável
- **D-08:** Reuse the Phase 1–2 paste/upload + `ColumnPreviewTable` role mapping pattern. No new data pipeline.
- **D-09:** **Qui-quadrado primary path:** two categorical columns → engine builds the contingency table (DataSUS-friendly). Optional advanced: paste an already aggregated contingency matrix only if cheap; otherwise skip for economy.
- **D-10:** **ANOVA / Kruskal:** one numeric outcome + one categorical grouping factor (≥3 levels for post-hoc usefulness; still allow 2 with a tip that t-Student may be simpler).
- **D-11:** **GLM (Poisson / NB / Logística):** one outcome + ≥1 predictor via roles. Didactic subset: main effects only (no interactions, no offsets/exposure unless already trivial). Poisson/NB outcome = counts (non-negative integers); Logística outcome = binary (0/1 or two-level factor).
- **D-12:** Configurar shows **α**, research question, “Usar exemplo”, and short didactic cards (same spirit as migrated tests). Validate types before analyze: wrong type → friendly error listing expected roles, do not crash.
- **D-13:** Soft-reset after confirm when the user changes method-critical knobs (mirror Correlação/t-Student): keep paste, clear results that would mix settings.

#### Pós-hoc e tabelas
- **D-14:** Tukey (ANOVA) and Dunn (Kruskal) render as a **compact pairwise table**: contraste, estatística, p ajustado, e IC quando o método fornecer. Default sort by p ajustado.
- **D-15:** If number of groups ≤ 6, also offer a **heatmap preset** of adjusted p (or mean/rank difference) in the chart customizer; if &gt; 6, table-only by default to avoid clutter.
- **D-16:** Omnibus test metrics stay on the metric cards; pairwise is a results section below (not buried only inside a chart).

#### Motor numérico e economia (JASP-first)
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

### Deferred Ideas (OUT OF SCOPE)
- Full Fisher exact module as its own registry test
- GLM interactions, offsets/exposure, multinomial logistic
- Multi-way / repeated-measures ANOVA
- Bayesian contingency / ANOVA
- Auto-router that picks the test for the user (beyond soft nudges) — belongs nearer “Qual teste usar?” / Phase 5 variable typing
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-04 | Qui-quadrado de independência with effect size and expected-cell warning | `statsEngine` χ² + Cramér's V; contingency builder from two categoricals; golden fixtures from JASP `contingencytables.R` behavior; nudge on expected &lt; 5 |
| TEST-05 | One-way ANOVA with Tukey post-hoc | One-way F in `statsEngine`; Tukey via `jstat.tukeyhsd` or studentized-range CDF; pairwise table + optional heatmap (≤6 groups) |
| TEST-06 | Kruskal-Wallis with Dunn post-hoc | Rank-based H + χ² approx; Dunn z with Holm-adjusted p (JASP default family); cross-nudge from ANOVA |
| TEST-07 | Poisson regression with overdispersion check | Custom IRLS GLM (`glmEngine.ts`); Pearson χ²/df or deviance/df; CTA handoff to NB with same column map |
| TEST-08 | Negative Binomial regression | NB IRLS + θ estimation (MASS::glm.nb pattern); dispersion metric on cards; separate registry entry |
| TEST-09 | Logistic regression with OR + CI95% | Binomial IRLS logit; OR = exp(β); Wald CI on log scale; separation/imbalance nudge |
| UX-02 | Assumption-check nudges per active test | Shared `AssumptionNudgeStrip` + per-engine `computeAssumptionNudges()` driven by empirical data |
</phase_requirements>

## Summary

Phase 3 ships **six greenfield test modules** on the Phase 2 shell. Unlike Phase 2 (parity vs v1.0 `tests/*/module.js`), these tests have **no legacy MVP engine** — acceptance is **JASP-oracle numerics at display precision** plus didactic PT interpretation. The in-repo `jasp-desktop-development/` tree is the **desktop shell only** (QML, CMake, `Modules/modules-settings.json`, `remote-bundles.json`); the R analysis code lives in **separate GitHub module repos** (`jasp-stats/jaspFrequencies`, `jasp-stats/jaspAnova`, `jasp-stats/jaspRegression`) [VERIFIED: GitHub API directory listing, 2026-07-25 session].

Wave 0 must extend the numeric layer before any UI: add χ²/F/normal/tukey distribution helpers, one-way ANOVA + Kruskal/Dunn post-hoc, and a **single internal GLM engine** (Poisson / binomial / NB) validated by **vendored golden JSON fixtures** — generated once offline (R script in `scripts/oracle/`, not shipped to browser). Wave A delivers the three classical capacitação tests; Wave B delivers GLM (Poisson first, then NB + Logistic). Each module clones the **t-Student / Correlação feature-folder shape** and mounts `ResultsPanelWithCustomizer`.

**Primary recommendation:** Wave 0 = `statsEngine` extensions + `glmEngine.ts` + golden fixtures + `AssumptionNudgeStrip`; Wave A1 qui-quadrado → Wave A2 ANOVA + Kruskal (parallel); Wave B1 Poisson → Wave B2 NB + Logística (parallel after Poisson GLM proven); each sub-wave ends with registry flip + `EstatisticaPage` route + engine/RTL tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Paste / role mapping | Browser (`useTabularInput`, `ColumnPreviewTable`) | Per-test `TABULAR_OPTIONS` | Phase 1–2 pattern; no new pipeline (D-08) |
| Contingency / group / GLM dataset build | Browser (per-test `*Engine.ts`) | — | Pure transforms on confirmed rows |
| Omnibus + post-hoc + GLM fit | Browser (`statsEngine.ts`, `glmEngine.ts`) | Golden JSON oracles | 100% client-side (D-17) |
| Assumption nudges (UX-02) | Browser (`AssumptionNudgeStrip` + `computeAssumptionNudges`) | Cross-test registry links | Soft strip above metrics (D-04) |
| Pairwise tables | Browser (results section in `*Test.tsx`) | Chart heatmap preset when k≤6 | D-14–D-16 |
| Interpretation PT | Browser (`*Interpretation.ts`) | Golden conclusion checks | Plain `string[]` into `InterpretationText` |
| Charts + PNG | Browser (`ResultsPanelWithCustomizer`, chart factories) | — | Phase 2 customizer pattern (D-22) |
| JASP oracle generation | **Dev-time only** (`scripts/oracle/*.R`) | Committed fixtures in git | Never embed R/WASM (D-17, D-18) |
| Test routing / NB handoff | Browser (`EstatisticaPage`, session handoff) | `activeTestId` + preserved column roles | Poisson→NB CTA (D-20) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + FlowSteps shell | ^19.2.8 [VERIFIED: package.json] | Dados → Configurar → Resultados | Proven in Phase 2 modules |
| `src/shared/stats/statsEngine.ts` | in-repo | Extend with χ², F, normal CDFs; reuse `rank`, `mean`, `sd`, `ibeta` | D-19: build on existing gamma/beta/t port |
| `src/shared/stats/glmEngine.ts` | in-repo (new) | IRLS for Poisson, binomial, NB; Wald p-values; OR/CI | No legacy MVP; JASP aligns with R `glm` / `MASS::glm.nb` |
| `jstat` | 1.9.6 [ASSUMED: npm registry — slopcheck unavailable] | `chisquare.cdf`, `centralf.cdf`, `normal.cdf`, `tukeyhsd`, distribution inverses | Cheaper than hand-rolling Tukey + F tails; textbook-stable |
| `ml-matrix` | 6.14.0 [ASSUMED: npm registry] | QR/solve for IRLS weighted least squares | Browser-first; required for GLM (D-19 discretion resolved: minimal dep justified) |
| Golden fixtures | in-repo JSON | Numeric oracle for Phase 3 tests | JASP R sources not in repo; offline generation once |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ResultsPanelWithCustomizer` | in-repo | Metrics + charts + PNG | Every test Resultados (D-22) |
| `src/shared/format.ts` | in-repo | `fmtP`, `fmtNumber`, display parity (D-21) | All metrics + interpretation |
| Vitest + RTL | ^4.1.10 [VERIFIED: package.json] | Engine golden tests + FlowSteps smoke | Same harness as Phase 2 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend `statsEngine` + `jstat` + custom GLM | Full `@stdlib/stats-*` suite | Larger transitive graph; D-19 prefers minimal deps; stdlib OK for omnibus only if jstat spike fails |
| Custom IRLS `glmEngine.ts` | `@tangent.to/ds` GLM (0.9.0 on npm) | Young package; no NB family; spike optional in Wave 0 — default custom for NB control |
| Runtime JASP/R oracle | Vendored golden JSON | Required by D-17; classroom offline-safe |
| Aggregated contingency paste | Two-column categorical only | D-09: skip matrix paste unless trivial |

**Installation (Phase 3 additions):**

```bash
npm install jstat@^1.9.6 ml-matrix@^6.14.0
```

**Version verification (2026-07-25 session):**

```bash
npm view jstat version          # 1.9.6
npm view ml-matrix version      # 6.14.0
npm view @stdlib/stats-chi2test version   # 0.2.2 (not recommended as primary — see D-19)
npm view @tangent.to/ds version           # 0.9.0 (spike only)
```

## Package Legitimacy Audit

> slopcheck was unavailable at research time — all packages tagged `[ASSUMED]`; planner must gate each install behind `checkpoint:human-verify`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `jstat` | npm | 10+ yrs | high | github.com/jstat/jstat | not run | Approved with human-verify |
| `ml-matrix` | npm | 8+ yrs | high | github.com/mljs/matrix | not run | Approved with human-verify |
| `@tangent.to/ds` | npm | ~1 yr | low | (spike only) | not run | Optional spike — not default |
| `@stdlib/stats-chi2test` | npm | stdlib monorepo | medium | github.com/stdlib-js | not run | Defer — prefer statsEngine+jstat |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not run)
**Packages flagged as suspicious [SUS]:** none verified

## JASP Oracle Sources & Golden Fixtures Strategy

### What exists in-repo today

| Asset | Location | Contents | Use |
|-------|----------|----------|-----|
| Module ID registry | `jasp-desktop-development/Modules/modules-settings.json` | `jaspFrequencies`, `jaspAnova`, `jaspRegression` | Maps tests → JASP module family [VERIFIED: file read] |
| Remote bundles | `jasp-desktop-development/Modules/remote-bundles.json` | Download URLs for compiled `.JASPModule` binaries | **Not** usable as formula oracle in TS |
| Data Library folders | `jasp-desktop-development/Resources/Data Sets/Data Library/{3. ANOVA,4. Regression,5. Frequencies}` | Example `.csv` / `.jasp` datasets | Input fixtures for offline R script [VERIFIED: directory listing] |
| R analysis guide | `jasp-desktop-development/Docs/development/r-analyses-guide.md` | JASP R analysis structure | Orientation only — not numeric oracle |

**Critical gap:** `jasp-desktop-development/Modules/` contains **no R source** — only install scripts and bundle metadata. Module R code is in separate repos [VERIFIED: GitHub API, 2026-07-25]:

| Test | JASP module | Primary R source (oracle) |
|------|-------------|---------------------------|
| Qui-quadrado | `jaspFrequencies` | `jasp-stats/jaspFrequencies` → `R/contingencytables.R` |
| ANOVA + Tukey | `jaspAnova` | `jasp-stats/jaspAnova` → `R/anovaWrapper.R`, `R/commonAnovaFreq.R` |
| Kruskal + Dunn | `jaspAnova` | Same module — nonparametric section in ANOVA wrappers |
| Poisson / NB / Logistic | `jaspRegression` | `jasp-stats/jaspRegression` → `R/generalizedlinearmodel.R`, `R/commonglm.R`, `R/regressionlogistic.R` |

### Golden fixture pipeline (recommended)

```
┌─────────────────── Wave 0 (dev machine, optional R) ───────────────────┐
│ scripts/oracle/generate-phase3-fixtures.R                               │
│   reads: src/test/fixtures/tests/*-exemplo.csv                          │
│   reads: JASP Data Library CSVs (copied or symlinked)                   │
│   calls: chisq.test, aov+TukeyHSD, kruskal.test+DunnTest, glm, glm.nb  │
│   writes: src/test/fixtures/jasp/{test-id}.golden.json                  │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ committed to git
                                ▼
┌─────────────────── CI / Vitest (no R) ─────────────────────────────────┐
│ *Engine.test.ts: run TS engine → displayParity vs golden JSON           │
│ interpretation tests: conclusion + key stats at fmtP/fmtNumber precision │
└─────────────────────────────────────────────────────────────────────────┘
```

**Fixture shape (per test):**

```json
{
  "source": "jasp-stats/jaspFrequencies contingencytables + R chisq.test defaults",
  "inputFixture": "qui-quadrado-exemplo.csv",
  "displayPrecision": { "p": "fmtP", "effect": 3 },
  "expected": { "chi2": 4.12, "df": 2, "p": 0.127, "cramersV": 0.21, "cellsBelow5": 1, "pctBelow5": 16.7 }
}
```

**Rules:**
1. **Never** ship R/JASP runtime to browser (D-17).
2. **Do** commit 1–2 golden cases per test: capacitação-sized synthetic exemplo + one Data Library case where available.
3. **Default options** match JASP classical defaults: Pearson χ² (no Yates unless 2×2 and toggled — default **off** for independence table to match JASP Contingency Tables default) [CITED: JASP teaching materials — Pearson χ² primary row].
4. Tukey: JASP ANOVA default post-hoc **Tukey** [CITED: JASP ANOVA step guides].
5. Dunn: Holm-adjusted p reported alongside Dunn (JASP Nonparametric table) [CITED: JASP Kruskal-Wallis guides in agent-tools corpus].
6. GLM: R `glm(..., family=poisson/binomial)` and `MASS::glm.nb` — Wald tests for coefficients; logistic OR = exp(β) [CITED: R stats docs pattern; JASP Regression module structure].

**Fallback if R unavailable on dev machine:** Hand-verify against published JASP tutorial worked examples (χ² + Cramér's V tables) [CITED: utc.pressbooks.pub step-by-step JASP guides] — mark fixture `source: "textbook"` and flag MEDIUM confidence until R-regenerated.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────── EstatisticaPage ─────────────────────────────────────┐
│ TEST_REGISTRY (6 entries em-breve → available)                        │
│         │ activeTestId + handoff (Poisson → binomial-negativa)        │
│         ▼                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐   │
│  │QuiQuadrado  │ │ AnovaTukey  │ │ KruskalDunn │ │ Poisson/NB/  │   │
│  │   Test      │ │    Test     │ │    Test     │ │  Logistica   │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬───────┘   │
│         └────────────────┼────────────────┼───────────────┘           │
│                          ▼ FlowSteps                                  │
│   Dados → Configurar (α, roles, cards) → Resultados                   │
│                          │                                            │
│   Resultados: AssumptionNudgeStrip → metrics → pairwise table?        │
│               → ResultsPanelWithCustomizer (charts, PNG, PT text)    │
└──────────────────────────┬────────────────────────────────────────────┘
                           ▼
              statsEngine.ts (χ², ANOVA, Kruskal, ranks)
              glmEngine.ts (Poisson, NB, Logistic IRLS)
                           │
              assert displayParity vs src/test/fixtures/jasp/*.golden.json
```

### Recommended Project Structure

```
src/
├── shared/stats/
│   ├── statsEngine.ts              # extend: chisqTest, oneWayAnova, kruskalWallis, tukeyHsd, dunnPostHoc
│   ├── statsEngine.test.ts         # distribution + classical tests vs golden
│   ├── glmEngine.ts                # NEW: fitPoisson, fitNegativeBinomial, fitLogistic
│   └── glmEngine.test.ts           # vs golden GLM fixtures
├── features/tests/
│   ├── shared/
│   │   ├── AssumptionNudgeStrip.tsx    # NEW: UX-02 strip (info/warning)
│   │   └── assumptionNudges.ts         # shared types + severity helpers
│   ├── qui-quadrado/
│   │   ├── QuiQuadradoTest.tsx
│   │   ├── quiQuadradoConfig.ts
│   │   ├── quiQuadradoEngine.ts
│   │   ├── quiQuadradoInterpretation.ts
│   │   ├── quiQuadradoCharts.ts
│   │   └── quiQuadradoEngine.test.ts
│   ├── anova-tukey/                  # same file set pattern
│   ├── kruskal-dunn/
│   ├── poisson/
│   ├── binomial-negativa/
│   └── logistica/
├── shared/charts/chartFactories/
│   ├── contingencyChart.ts           # observed vs expected bars
│   ├── anovaChart.ts                 # means + CI boxes
│   ├── postHocHeatmapChart.ts        # k≤6 adjusted-p heatmap
│   └── glmCoefForestChart.ts           # OR/coef forest
└── test/fixtures/
    ├── tests/                        # exemplo CSV/TSV paste strings
    └── jasp/                         # *.golden.json oracles
scripts/oracle/
    └── generate-phase3-fixtures.R      # dev-only; not bundled
```

### Pattern 1: Feature module clone map (from t-Student / Correlação)

| Source (Phase 2) | Target (Phase 3) | Notes |
|------------------|------------------|-------|
| `TStudentTest.tsx` / `CorrelacaoTest.tsx` | `*Test.tsx` | FlowSteps orchestrator, session bootstrap, soft-reset, Dados tabs |
| `tStudentConfig.ts` / `correlacaoConfig.ts` | `*Config.ts` | `TABULAR_OPTIONS`, `exampleText`, `didacticCards`, role aliases |
| `TStudentConfigPanel.tsx` | `*ConfigPanel.tsx` | α, research question, validation alert, confirm → Resultados |
| `tStudentEngine.ts` | `*Engine.ts` | `buildDatasetFromConfirmed`, `validate*`, `runAnalysis`, `buildMetrics`, `computeAssumptionNudges` |
| `tStudentInterpretation.ts` | `*Interpretation.ts` | `string[]` paragraphs; uses `fmtP`/`fmtNumber`; alpha-aware |
| `tStudentCharts.ts` | `*Charts.ts` | `ChartPreset[]`, annotations, default preset id |
| `tStudentEngine.test.ts` | `*Engine.test.ts` | Golden JSON parity at display precision |
| `TStudentTest.test.tsx` | `*Test.test.tsx` | RTL: Usar exemplo → Resultados smoke |
| `ResultsPanelWithCustomizer` | same | Pass `actions` for NB handoff CTA on Poisson |
| Registry flip + `EstatisticaPage` switch | per wave | Mirror `02-06-PLAN` integration gate |

**Correlação-specific borrowings:** method toggle pattern → not needed per test (single method each); **soft-reset on role change** mirrors method change in Correlação.

### Pattern 2: TypeScript algorithms (JASP-aligned)

#### Qui-quadrado + Cramér's V

**Input:** two categorical columns → contingency table `O[i,j]`.

**Compute:**
- Expected: `E[i,j] = (row_i × col_j) / N`
- Pearson χ² = Σ (O−E)²/E ; df = (r−1)(c−1)
- p = 1 − F_χ²(df)(χ²) via `jstat.chisquare.cdf` [ASSUMED: jstat API]
- Cramér's V = √(χ² / (N × min(r−1, c−1))) [CITED: standard nominal effect size; JASP "Phi and Cramér's V" option]
- Nudge inputs: count and % of cells with E &lt; 5

#### ANOVA + Tukey

**Input:** numeric outcome + factor (≥2 levels).

**Compute:**
- One-way ANOVA F and η² (or ω² for cards) — SS_between / SS_within [ASSUMED: textbook one-way formulas]
- Tukey HSD pairwise: use `jstat.tukeyhsd(groups)` returning adjusted p [ASSUMED: jstat docs mention tukeyhsd]
- Pairwise table columns: contrast, mean diff (or q), p_adj, CI if available (Tukey SE)

#### Kruskal-Wallis + Dunn

**Compute:**
- Global ranks via `statsEngine.rank` on pooled values
- H statistic → χ² approximation with df = k−1
- Dunn post-hoc: pairwise z on rank sums with tie correction; **Holm-adjusted p** as primary sort key (JASP reports Dunn + Bonferroni + Holm — ship Holm as `p_adj` default) [CITED: JASP Kruskal guides]

#### Poisson / NB / Logistic GLM

**Compute (custom `glmEngine.ts` on `ml-matrix`):**
- Design matrix: intercept + main effects only (D-11); categorical predictors → dummy columns
- IRLS loop: Poisson (log), binomial (logit), NB (log + θ iteration akin to `glm.nb`)
- Outputs: β, SE, Wald z, p, deviance, df_resid
- Poisson overdispersion: Pearson χ²/df = Σ (y−μ)²/V(μ) / df_resid — **warning if &gt; 1.25** (planner discretion; JASP shows dispersion tables)
- Logistic: OR = exp(β); CI = exp(β ± z×SE)
- NB: report θ (dispersion) on metric cards (D-06)

### Pattern 3: Assumption nudge computation (UX-02)

Shared component:

```tsx
// src/features/tests/shared/AssumptionNudgeStrip.tsx
export type NudgeSeverity = 'info' | 'warning';
export interface AssumptionNudge { severity: NudgeSeverity; message: string; cta?: { label: string; testId: string } }
```

| Test | Trigger (empirical) | Severity | Message intent |
|------|---------------------|----------|----------------|
| Qui-quadrado | any E &lt; 5 | warning | % cells low expected; caution; 2×2 → Fisher tip (info only) |
| Qui-quadrado | all E ≥ 5 | info (optional) | Assumption OK — omit if noisy |
| ANOVA | max(n)/min(n) &gt; 3 or SD ratio &gt; 2 | warning | Unequal n or heterogeneity → consider Kruskal |
| ANOVA | Shapiro on residuals skipped; use \|skew\| heuristic or small n | info/warning | Normality uncertain → Kruskal hint |
| ANOVA | k = 2 | info | t-Student may be simpler |
| Kruskal | always | info | Rank-based; use when normality doubtful |
| Kruskal | k = 2 | info | Mann-Whitney equivalent note (optional one line) |
| Poisson | Pearson χ²/df &gt; 1.25 | warning + CTA | Overdispersion → open Binomial Negativa |
| NB | θ finite | info | Relaxes equidispersion |
| Logística | min class proportion &lt; 5% or separation (|β|&gt;10) | warning | Rare events / separation — interpret OR with care |

**Cross-nudge links:** ANOVA → `kruskal-dunn`; Poisson → `binomial-negativa` via `EstatisticaHandoffState` preserving `recognizedColumns`.

### Anti-Patterns to Avoid

- **Embedding JASP modules or R WASM** — violates D-17 and PROJECT.md constraints.
- **Blocking analysis when nudges fire** — D-04/D-05 require results always visible.
- **Auto-switching Poisson → NB** — D-20 requires explicit user navigation.
- **Multi-way ANOVA / interactions** — out of scope.
- **Hand-rolling Tukey or GLM without golden tests** — highest bug risk (.planning/research/PITFALLS.md #1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| χ² / F / normal tail probs | Custom series | `jstat` CDFs + extend `statsEngine` wrappers | Numerical stability |
| Tukey HSD all-pairs | Nested t-tests | `jstat.tukeyhsd` or studentized-range | Family-wise error control |
| GLM IRLS linear algebra | Naive Gauss-Jordan | `ml-matrix` QR/solve | Ill-conditioned weights |
| NB θ estimation ad hoc | Fixed θ guess | Iterative `glm.nb`-style outer loop | JASP/R parity |
| Assumption UI per test | Copy-paste banners | `AssumptionNudgeStrip` + `computeAssumptionNudges()` | UX-02 consistency |
| JASP UI (QML panels) | Clone JASP layout | FlowSteps + metric cards | D-18 scope |

**Key insight:** Phase 3 math risk concentrates in **GLM + post-hoc adjustments** — golden fixtures and display-rounded parity are non-negotiable gates (.planning/research/PITFALLS.md).

## Common Pitfalls

### Pitfall 1: GLM coefficients plausible but wrong vs JASP

**What goes wrong:** Poisson/NB/Logistic β, p, OR disagree with JASP at 2nd decimal.

**Why:** IRLS convergence, NB θ path, Wald vs LR, treatment of categorical dummies.

**How to avoid:** Wave 0 `glmEngine.test.ts` vs R-generated golden; cap iterations; same contrast coding as R `contr.treatment`.

**Warning signs:** OR extreme with balanced data; NB θ stuck at boundary.

### Pitfall 2: Empty JASP module tree assumed to contain R

**What goes wrong:** Planner tasks "read contingencytables.R in jasp-desktop-development" — file absent.

**Why:** Modules distributed as separate repos / binaries only.

**How to avoid:** Wave 0 fixture script + document GitHub paths above; optional git submodule for oracle maintenance only (not runtime).

### Pitfall 3: Tukey/Dunn p_adj mismatch

**What goes wrong:** Pairwise table sort differs from JASP.

**Why:** Different adjustment (Bonferroni vs Tukey vs Holm).

**How to avoid:** Lock Tukey for ANOVA, Holm for Dunn in golden metadata; document in fixture `source`.

### Pitfall 4: Categorical parsing for χ²

**What goes wrong:** Numeric-looking codes treated as numeric; empty levels collapse wrong.

**Why:** `numericKeys` misconfigured in `TABULAR_OPTIONS`.

**How to avoid:** Qui-quadrado `TABULAR_OPTIONS`: **no** numericKeys on categoricals; coerce via string trim + factor levels from data.

### Pitfall 5: Poisson handoff loses column mapping

**What goes wrong:** NB opens without outcome/predictor roles.

**Why:** Session stores paste only, not `recognizedColumns`.

**How to avoid:** Extend handoff state: `{ activeTestId, recognizedColumns, roleSnapshot }` on CTA (mirror Mapas handoff pattern).

### Pitfall 6: Mini-JASP scope creep

**What goes wrong:** Likelihood ratio tests, influence diagnostics, Bayes factors.

**Why:** JASP oracle temptation.

**How to avoid:** Stick to CONTEXT deferred list; Wald + omnibus + didactic charts only.

## Code Examples

### Display-rounded golden parity (Phase 2 pattern)

```typescript
// Source: src/shared/stats/statsEngine.test.ts + D-21
import golden from '@/test/fixtures/jasp/qui-quadrado-exemplo.golden.json';
import { fmtP, fmtNumber } from '@/shared/format';
import { runChiSquareIndependence } from './statsEngine';

it('matches JASP golden at display precision', () => {
  const result = runChiSquareIndependence(golden.input.table);
  expect(fmtP(result.p)).toBe(fmtP(golden.expected.p));
  expect(fmtNumber(result.cramersV, 3)).toBe(fmtNumber(golden.expected.cramersV, 3));
});
```

### Assumption nudge strip usage

```tsx
// Source: Phase 3 pattern (new)
<AssumptionNudgeStrip nudges={engineOutput.nudges} onNavigateTest={handleHandoff} />
<ResultsPanelWithCustomizer
  metrics={metrics}
  engineOutput={engineOutput}
  /* ... */
/>
```

### Poisson → NB handoff

```typescript
// Source: EstatisticaPage handoff pattern (Phase 2 Mapas)
function openNegativeBinomialWithSameMapping(columns: Record<string, number>) {
  navigate('/', { state: { activeTestId: 'binomial-negativa', recognizedColumns: columns } });
}
```

## Recommended Plan / Wave Breakdown

| Plan | Wave | Delivers | Depends on | Risks |
|------|------|----------|------------|-------|
| 03-01 | **W0** | `statsEngine` χ²/ANOVA/Kruskal/Tukey/Dunn; `glmEngine`; golden fixtures + R script; `AssumptionNudgeStrip`; `npm install jstat ml-matrix` | Phase 2 complete | GLM spike length; R unavailable → textbook fixtures |
| 03-02 | **A1** | Qui-quadrado module TEST-04 + registry + route | W0 | Categorical parsing edge cases |
| 03-03 | **A2a** | ANOVA+Tukey TEST-05 | W0 | Tukey p_adj parity |
| 03-04 | **A2b** | Kruskal+Dunn TEST-06 (parallel with 03-03) | W0 | Dunn adjustment choice |
| 03-05 | **A gate** | Wave A integration: UX-02 on classical tests; sidebar/modal available | 03-02–04 | Cross-nudge wiring |
| 03-06 | **B1** | Poisson TEST-07 + overdispersion CTA | W0 glm proven | Overdispersion threshold tuning |
| 03-07 | **B2a** | Binomial Negativa TEST-08 | B1 glm patterns | NB θ convergence |
| 03-08 | **B2b** | Logística TEST-09 (parallel with 03-07 after B1) | B1 | Separation on tiny classroom n |
| 03-09 | **B gate** | Full phase verification; all six `available`; Qual teste modal unlock | 03-06–08 | — |

**Parallelization:** A2a/A2b and B2a/B2b can run in parallel after shared engine lands. **Do not** flip registry until module passes golden + RTL smoke (D-02).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 2 legacy `module.js` oracle | JASP golden JSON for new tests | Phase 3 | No v1.0 for these six tests |
| Optional JASP dispute tool | JASP **mandatory** acceptance for Phase 3 | CONTEXT D-18 | Fixture investment required |
| `@stdlib` for all classical tests | `statsEngine` + `jstat` minimal | This research | Honors D-19 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `jstat.tukeyhsd` matches JASP Tukey adjusted p at display precision | ANOVA | Reimplement studentized range from `commonAnovaFreq.R` |
| A2 | Holm-adjusted Dunn is acceptable default vs Bonferroni | Kruskal | Swap adjustment; update golden |
| A3 | Custom IRLS matches R `glm`/`glm.nb` for capacitação-sized n | GLM | Spike `@tangent.to/ds` or widen golden tolerance |
| A4 | Pearson χ² without Yates matches JASP Contingency default | χ² | Add Yates toggle if golden fails on 2×2 |
| A5 | Overdispersion warning threshold 1.25 for Pearson χ²/df | Poisson nudge | Tune with classroom examples |
| A6 | `jstat` + `ml-matrix` postinstall scripts are benign | Package audit | Human-verify checkpoint |

## Open Questions

1. **Exact Yates continuity for 2×2 χ²**
   - What we know: JASP exposes continuity correction as separate row; default independence test is Pearson.
   - What's unclear: Whether capacitação expects Yates ever.
   - Recommendation: Default Pearson; nudge only mentions Fisher for sparse 2×2; add Yates only if golden demands.

2. **Shapiro-Wilk in browser for ANOVA nudge**
   - What we know: D-06 asks normality "hint" not formal test.
   - Recommendation: Use lightweight heuristic (SD ratio, n imbalance, optional skew) — **no** new heavy normality package this phase.

3. **R fixture generator in CI**
   - What we know: CI has no R today.
   - Recommendation: Commit generated JSON; R script documented for manual regen when JASP module updates.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Vite | ✓ | v25.9.0 | — |
| npm | installs | ✓ | 11.12.1 | — |
| Vitest + RTL | tests | ✓ | vitest 4.1.10 | — |
| R + MASS/stats | golden generation (dev) | ✗ (not probed) | — | Textbook/JASP tutorial fixtures + MEDIUM confidence |
| jstat / ml-matrix | Phase 3 engines | ✗ (not installed) | 1.9.6 / 6.14.0 on registry | Block Wave 0 until install |
| JASP desktop | manual dispute | optional | — | GitHub R sources + golden JSON |

**Missing dependencies with no fallback:**
- `jstat`, `ml-matrix` for Phase 3 engines (Wave 0 install task).

**Missing dependencies with fallback:**
- R on dev machine — hand-enter golden from published JASP examples until R script runs.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 + @testing-library/react ^16.3.2 |
| Config file | `vite.config.ts` (`test` block) |
| Quick run command | `npm run test:run -- src/shared/stats/glmEngine.test.ts -x` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-04 | χ², Cramér's V, expected-cell flags | unit/golden | `npm run test:run -- src/features/tests/qui-quadrado/quiQuadradoEngine.test.ts` | ❌ Wave 0 |
| TEST-04 | Expected-cell nudge fires | unit | `npm run test:run -- src/features/tests/qui-quadrado/quiQuadradoEngine.test.ts -t nudge` | ❌ Wave 0 |
| TEST-05 | ANOVA F + Tukey p_adj | unit/golden | `npm run test:run -- src/features/tests/anova-tukey/anovaEngine.test.ts` | ❌ Wave 0 |
| TEST-06 | Kruskal H + Dunn Holm p | unit/golden | `npm run test:run -- src/features/tests/kruskal-dunn/kruskalEngine.test.ts` | ❌ Wave 0 |
| TEST-07 | Poisson coef + overdispersion ratio | unit/golden | `npm run test:run -- src/shared/stats/glmEngine.test.ts -t poisson` | ❌ Wave 0 |
| TEST-08 | NB coef + θ | unit/golden | `npm run test:run -- src/shared/stats/glmEngine.test.ts -t nb` | ❌ Wave 0 |
| TEST-09 | Logistic OR + CI | unit/golden | `npm run test:run -- src/shared/stats/glmEngine.test.ts -t logistic` | ❌ Wave 0 |
| UX-02 | Nudge strip renders warning/info | RTL | `npm run test:run -- src/features/tests/shared/sharedComponents.test.tsx` | ❌ extend |
| TEST-04–09 | FlowSteps smoke per module | RTL | `npm run test:run -- src/features/tests/*/\*Test.test.tsx` | ❌ per module |
| TEST-04–09 | Registry `available` | unit | `npm run test:run -- src/features/tests/registry.test.ts` | ✅ extend |
| D-20 | Poisson CTA handoff preserves roles | RTL/integration | `npm run test:run -- src/routes/estatistica/EstatisticaPage.test.tsx` | ❌ Wave B |

### Sampling Rate

- **Per task commit:** touched `*Engine.test.ts` or `glmEngine.test.ts` quick run
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green + manual PNG spot-check on one chart per test family

### Wave 0 Gaps

- [ ] `src/shared/stats/glmEngine.ts` + tests — Poisson/NB/Logistic
- [ ] `statsEngine.ts` extensions + tests — χ², ANOVA, Kruskal, Tukey, Dunn
- [ ] `src/test/fixtures/jasp/*.golden.json` — six tests minimum 1 fixture each
- [ ] `scripts/oracle/generate-phase3-fixtures.R` — dev regeneration
- [ ] `src/features/tests/shared/AssumptionNudgeStrip.tsx`
- [ ] `jstat`, `ml-matrix` install + human-verify checkpoint
- [ ] Six feature folders + `EstatisticaPage` switch cases
- [ ] Chart factories: contingency, anova, postHocHeatmap, glmForest

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Client-only |
| V3 Session Management | no | In-memory session |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Tabular validation + numeric guards (min n, finite outputs) before run |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via interpretation HTML | Tampering | `string[]` only in `InterpretationText` |
| DoS via huge paste | Denial of service | Existing tabular limits; cap contingency table dimensions (e.g. max 20×20) |
| Supply-chain in new stats deps | Tampering | slopcheck + human-verify on `jstat`/`ml-matrix` |

## Project Constraints (from PROJECT.md)

- **Client-only:** No backend; session in browser memory.
- **JASP as oracle only:** Do not embed JASP UI or R runtime.
- **Didactic PT:** Brief interpretation under every result (UI-06).
- **Stack:** React + Vite + Chart.js; extend rather than replace.
- **Performance:** Capacitação-sized n only — guard table size and GLM iterations.

## Sources

### Primary (HIGH confidence)
- Repository: `src/features/tests/t-student/`, `correlacao/` — module clone template
- Repository: `src/shared/stats/statsEngine.ts` — existing distribution primitives
- Repository: `jasp-desktop-development/Modules/modules-settings.json`, `remote-bundles.json`
- GitHub API: `jasp-stats/jaspFrequencies`, `jaspAnova`, `jaspRegression` R/ directory listings (2026-07-25)
- Repository: `.planning/phases/03-testes-classicos-glm-novos/03-CONTEXT.md` — locked decisions
- Repository: `.planning/research/PITFALLS.md` — GLM golden-file requirement

### Secondary (MEDIUM confidence)
- [JASP Contingency Tables teaching guides](https://utc.pressbooks.pub/step-by-step-JASP-guides/chapter/running-and-interpreting-a-chi-square-test-in-jasp/) — Cramér's V reporting
- [JASP chi-square tutorials](https://analisisdedatospsicologia.com/en/blog/tutorial-chi-cuadrado-jasp) — expected counts & effect size
- npm registry queries 2026-07-25 — `jstat@1.9.6`, `ml-matrix@6.14.0`
- `.planning/research/STACK.md` — GLM implementation note

### Tertiary (LOW confidence — validate in Wave 0)
- `@tangent.to/ds` as Poisson/logistic shortcut — spike only
- Exact Holm vs Bonferroni as JASP primary Dunn column — confirm against one golden run

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — jstat/ml-matrix verified on registry; slopcheck not run; GLM custom
- Architecture: HIGH — Phase 2 patterns directly reusable
- Pitfalls: HIGH — documented in project PITFALLS.md and CONTEXT

**Research date:** 2026-07-25
**Valid until:** 2026-08-25 (GLM spike may revise stack)

## RESEARCH COMPLETE

**Phase:** 3 - Testes clássicos + GLM novos
**Confidence:** MEDIUM-HIGH overall (HIGH shell, MEDIUM numerics)

### Key Findings

- `jasp-desktop-development/` is a **shell only**; R oracles live in **`jasp-stats/jaspFrequencies`**, **`jaspAnova`**, **`jaspRegression`** on GitHub — golden JSON fixtures are the correct acceptance path.
- Extend **`statsEngine` + new `glmEngine.ts`** with minimal deps **`jstat`** (distributions, Tukey) and **`ml-matrix`** (IRLS) — honors D-19 while avoiding a full stdlib stack.
- Clone **t-Student/Correlação folder pattern** per registry id; add shared **`AssumptionNudgeStrip`** for UX-02.
- Deliver **Wave A (classical) then Wave B (GLM)** with Wave 0 shared engines/fixtures first; Poisson before NB; explicit NB handoff (no auto-switch).
- **Validation:** display-rounded parity vs `src/test/fixtures/jasp/*.golden.json` for every TEST-04…09 metric.

### File Created

`.planning/phases/03-testes-classicos-glm-novos/03-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | MEDIUM | Registry versions verified; GLM custom; slopcheck skipped |
| Architecture | HIGH | Phase 2 module pattern proven |
| Pitfalls | HIGH | Project PITFALLS + CONTEXT aligned |

### Open Questions

- Yates correction default for 2×2 χ²
- Exact overdispersion threshold for Poisson warning
- R available for golden generation on dev machines

### Ready for Planning

Research complete. Planner can now create PLAN.md files.
