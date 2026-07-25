---
phase: 03-testes-classicos-glm-novos
verified: 2026-07-25T21:43:00Z
status: human_needed
score: 5/5
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Export PNG after chart customize (one chart per Phase 3 family)"
    expected: "Baixar PNG produces a valid, readable image with customized title/annotations"
    why_human: "jsdom cannot render canvas/toDataURL; automated tests only assert button presence"
  - test: "Read assumption nudge copy in browser for sparse χ² and overdispersed Poisson"
    expected: "Pressupostos strip shows plain-PT warnings that read naturally for capacitação students"
    why_human: "Teaching tone and readability cannot be judged from grep or unit tests"
---

# Phase 3: Testes clássicos + GLM novos — Verification Report

**Phase Goal:** Ligantes can run every statistical test taught in the capacitação that was missing from the MVP, each with correct numerics and assumption guidance  
**Verified:** 2026-07-25T21:43:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|-------------------------------------|--------|----------|
| 1 | User runs qui-quadrado de independência and sees an effect size plus a warning when expected cell counts are too low | ✓ VERIFIED | `quiQuadradoEngine.ts` computes Cramér's V (`cramersV`), `cellsBelow5`, `pctBelow5`; `computeAssumptionNudges` warns when expected < 5; metrics + `AssumptionNudgeStrip` wired in `QuiQuadradoTest.tsx`; golden parity in `quiQuadradoEngine.test.ts` |
| 2 | User runs one-way ANOVA with Tukey post-hoc and Kruskal-Wallis with Dunn post-hoc | ✓ VERIFIED | `statsEngine.oneWayAnova` + `tukeyHsd`, `kruskalWallis` + `dunnPostHoc`; `AnovaTukeyTest.tsx` / `KruskalDunnTest.tsx` render pairwise tables sorted by p ajustado; golden fixtures pass |
| 3 | User runs Poisson regression with an overdispersion check, and Negative Binomial regression when overdispersion is present | ✓ VERIFIED | `poissonEngine.ts` computes `overdispersionRatio`, warning nudge + CTA to `binomial-negativa`; `binomialNegativaEngine.ts` fits NB with θ on metrics; `EstatisticaPage.test.tsx` integration test preserves `recognizedColumns` on Poisson→NB handoff |
| 4 | User runs Logistic regression and sees odds ratios with confidence intervals | ✓ VERIFIED | `logisticaEngine.ts` `buildMetrics` shows OR with IC95% hint; `fitLogistic` returns `oddsRatios` with `ci95`; golden parity in `logisticaEngine.test.ts` |
| 5 | User sees assumption-check nudges appropriate to whichever test is active | ✓ VERIFIED | All six Phase 3 modules import `AssumptionNudgeStrip` with empirical `computeAssumptionNudges` per test (expected counts, heterogeneity→Kruskal, rank info, overdispersion→NB, equidispersion θ, rare events/separation) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/features/tests/registry.ts` | Six Phase 3 tests `available` | ✓ VERIFIED | All six entries `status: 'available'`; zero `em-breve`; `registry.test.ts` expects 10 available |
| `src/routes/estatistica/EstatisticaPage.tsx` | Static switch mounts all six modules | ✓ VERIFIED | Cases for `qui-quadrado`, `anova-tukey`, `kruskal-dunn`, `poisson`, `binomial-negativa`, `logistica`; handoff props wired |
| `src/shared/stats/statsEngine.ts` | Classical test primitives | ✓ VERIFIED | Exports `runChiSquareIndependence`, `oneWayAnova`, `kruskalWallis`, `tukeyHsd`, `dunnPostHoc`; tested in `statsEngine.classical.test.ts` |
| `src/shared/stats/glmEngine.ts` | IRLS GLM Poisson/NB/Logistic | ✓ VERIFIED | Exports `fitPoisson`, `fitNegativeBinomial`, `fitLogistic`; golden parity in `glmEngine.test.ts` |
| `src/features/tests/shared/AssumptionNudgeStrip.tsx` | UX-02 soft nudge strip | ✓ VERIFIED | Renders info/warning alerts with optional CTA; used by all six test modules |
| `src/test/fixtures/jasp/*.golden.json` | Six golden fixtures | ✓ VERIFIED | One fixture per test family present |
| `src/shared/charts/chartFactories/contingencyChart.ts` | χ² observed vs expected chart | ✓ VERIFIED | Exists; used by qui-quadrado charts |
| `src/shared/charts/chartFactories/postHocHeatmapChart.ts` | Post-hoc heatmap k≤6 | ✓ VERIFIED | Exists; referenced by ANOVA/Kruskal chart modules |
| `src/shared/charts/chartFactories/glmCoefForestChart.ts` | GLM coefficient/OR forest | ✓ VERIFIED | Exists; used by Poisson/NB/Logistic |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `quiQuadradoEngine.ts` | `statsEngine.runChiSquareIndependence` | built contingency table | ✓ WIRED | `runAnalysis` calls engine primitive |
| `QuiQuadradoTest.tsx` | `AssumptionNudgeStrip` | `engineOutput.nudges` | ✓ WIRED | Rendered in Resultados step |
| `anovaEngine.ts` | `statsEngine.oneWayAnova\|tukeyHsd` | grouped numeric outcome | ✓ WIRED | Pairwise returned in `AnovaAnalysisResult` |
| `AnovaTukeyTest.tsx` | `kruskal-dunn` | nudge CTA `onNavigateTest` | ✓ WIRED | `EstatisticaPage.test.tsx` handoff test passes |
| `kruskalEngine.ts` | `statsEngine.kruskalWallis\|dunnPostHoc` | grouped numeric outcome | ✓ WIRED | Holm-adjusted Dunn in pairwise table |
| `poissonEngine.ts` | `glmEngine.fitPoisson` | count outcome + predictors | ✓ WIRED | Overdispersion ratio computed post-fit |
| `PoissonTest.tsx` | `binomial-negativa` | CTA + `onNavigateTest(recognizedColumns)` | ✓ WIRED | Integration test confirms column preservation |
| `binomialNegativaEngine.ts` | `glmEngine.fitNegativeBinomial` | same design matrix | ✓ WIRED | θ metric + equidispersion info nudge |
| `logisticaEngine.ts` | `glmEngine.fitLogistic` | binary outcome + predictors | ✓ WIRED | OR + IC95% on metric cards |
| `registry.ts` | `Sidebar` / `QualTesteModal` | `TEST_REGISTRY` single source | ✓ WIRED | Sidebar + modal tests click all six Phase 3 entries |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `QuiQuadradoTest.tsx` | `engineOutput` | paste → `buildDatasetFromConfirmed` → `runAnalysis` | ✓ | ✓ FLOWING |
| `AnovaTukeyTest.tsx` | `engineOutput.pairwise` | grouped paste → ANOVA → Tukey | ✓ | ✓ FLOWING |
| `KruskalDunnTest.tsx` | `engineOutput.pairwise` | grouped paste → Kruskal → Dunn | ✓ | ✓ FLOWING |
| `PoissonTest.tsx` | `engineOutput.nudges` | count paste → Poisson fit → overdispersion ratio | ✓ | ✓ FLOWING |
| `BinomialNegativaTest.tsx` | `handoffRecognizedColumns` | Poisson CTA → `EstatisticaHandoffState` | ✓ | ✓ FLOWING |
| `LogisticaTest.tsx` | OR metrics | binary paste → logistic fit → `oddsRatios` | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 3 engine + RTL tests | `npm test -- --run src/features/tests/{qui-quadrado,anova-tukey,kruskal-dunn,poisson,binomial-negativa,logistica} src/shared/stats/*.test.ts` | 121 passed | ✓ PASS |
| Full suite regression | `npm test -- --run` | 472 passed | ✓ PASS |
| Registry 10 available, zero em-breve | `registry.test.ts` | assertions green | ✓ PASS |
| Poisson→NB handoff | `EstatisticaPage.test.tsx` | preserves `recognizedColumns` | ✓ PASS |
| ANOVA→Kruskal handoff | `EstatisticaPage.test.tsx` | preserves `recognizedColumns` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared in Phase 3 plans.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| TEST-04 | 03-02, 03-05, 03-09 | Qui-quadrado with effect size + expected-cell warning | ✓ SATISFIED | Engine + RTL + golden |
| TEST-05 | 03-03, 03-05 | ANOVA + Tukey post-hoc | ✓ SATISFIED | Pairwise table + golden |
| TEST-06 | 03-04, 03-05 | Kruskal-Wallis + Dunn post-hoc | ✓ SATISFIED | Pairwise table + golden |
| TEST-07 | 03-06, 03-09 | Poisson + overdispersion check | ✓ SATISFIED | Ratio metric + warning nudge + CTA |
| TEST-08 | 03-07, 03-09 | Negative Binomial regression | ✓ SATISFIED | `fitNegativeBinomial` + θ metric |
| TEST-09 | 03-08, 03-09 | Logistic OR with CI | ✓ SATISFIED | OR + IC95% on metrics |
| UX-02 | 03-01, 03-05, 03-09 | Assumption nudges per active test | ✓ SATISFIED | `AssumptionNudgeStrip` on all six modules |

No orphaned Phase 3 requirements found in REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX/stub markers in Phase 3 test modules | — | None |

Canvas `toDataURL` warnings during test runs are expected jsdom limitations, not implementation stubs.

### Human Verification Required

### 1. Chart PNG export after customize

**Test:** Open each Phase 3 test family, customize one chart (title/annotation), click Baixar PNG, open the downloaded file.  
**Expected:** PNG is a valid, readable publication-quality image reflecting customizations.  
**Why human:** Automated tests cannot verify canvas rendering or file contents in jsdom.

### 2. Assumption nudge didactic quality

**Test:** Run qui-quadrado with sparse expected counts and Poisson with overdispersed example data; read the Pressupostos strip aloud.  
**Expected:** Warnings are plain Portuguese, capacitação-appropriate, and non-blocking.  
**Why human:** Teaching tone and readability require human judgment.

### Gaps Summary

No automated gaps found. All five ROADMAP success criteria are verified in code with golden parity and integration tests. Two UX polish items (PNG visual quality, nudge copy tone) require human confirmation before treating Phase 3 as fully UAT-complete.

---

_Verified: 2026-07-25T21:43:00Z_  
_Verifier: Claude (gsd-verifier)_
