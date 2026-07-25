# Roadmap: Bioestatística LACIR

## Overview

v2.0 re-platforms the vanilla MVP calculator onto a React + Tailwind + shadcn/cult-ui dark/verde shell, then rebuilds capability in the build order locked in PROJECT.md: base shell first (everything else mounts on it), migrate the three validated tests to protect capacitação value, add the new classic + GLM tests (highest math risk), ship the Brasil/estado map suite, curate the DataSUS variable catalog, and finish with meta-análise last since it reuses chart/stats maturity built along the way. Everything stays 100% client-side — no backend, no login, session lives only in the browser cache.

**Implementation stance (locked):** Do **not** reinvent statistical engines from scratch. Port/adapt formulas and expected outputs from (1) existing v1.0 modules under `tests/` and (2) JASP open-source logic in `jasp-desktop-development/` (R analyses / docs as oracle). Milestone effort concentrates on the didactic React interface, Portuguese interpretation, assumption nudges, charts/export, maps, and catalog UX.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Redesign / base React shell** - React+Vite+Tailwind+shadcn dark/verde shell with tabs, shared paste→configure→results flow, PNG export, refresh warning, and the "qual teste usar?" decision tree
- [ ] **Phase 2: Migrar testes existentes** - t de Student, Pearson/Spearman, and Prais-Winsten ported into the new shell with output parity to v1.0
- [ ] **Phase 3: Testes clássicos + GLM novos** - Qui-quadrado, ANOVA/Tukey, Kruskal-Wallis/Dunn, Poisson, Binomial Negativa, and Regressão Logística, each with assumption-check nudges
- [ ] **Phase 4: Mapas Brasil + estados** - Client-side Brazil/UF choropleth with drill-down into município/mesorregião/região de saúde, offline from bundled geo assets
- [ ] **Phase 5: Painel DataSUS / catálogo** - Searchable catalog of classified public-health variables with official source links and suggested-test hints
- [ ] **Phase 6: Meta-análise** - Fixed/random-effects pooling with forest plot, heterogeneity stats, funnel plot, and Egger's asymmetry check

## Phase Details

### Phase 1: Redesign / base React shell
**Goal**: Users experience the new dark/verde React shell — brand, tabs, shared data-entry flow, export, and safety warning — that every test/map/catalog/meta module will mount on
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UX-01
**Success Criteria** (what must be TRUE):
  1. User opens the app and sees a dark theme with green accents, the LACIR logo, and top-level tabs Testes | Mapas | Catálogo | Meta-análise
  2. User completes any test through a consistent Dados → Configurar → Resultados flow
  3. User pastes TABNET-style data (`;` delimiter, pt-BR decimal comma) and gets a friendly, specific validation error when the paste is malformed
  4. User downloads the active result chart as a PNG
  5. User sees a persistent warning that refreshing or closing the tab loses all work, and reads a brief plain-Portuguese interpretation under a result
  6. User can follow a guided "qual teste usar?" decision tree that routes them to the correct test module
**Plans**: TBD
**UI hint**: yes

### Phase 2: Migrar testes existentes
**Goal**: The three validated v1.0 tests run inside the new shell with no regression in numbers, charts, or workflow
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. User runs t de Student in the new shell and gets results/charts matching v1.0 output
  2. User runs Correlação Pearson/Spearman in the new shell with charts matching v1.0 output
  3. User runs Prais-Winsten in the new shell with results matching v1.0 output
  4. Each migrated test shows an interpretation paragraph and supports PNG export like every other module
**Plans**: TBD

### Phase 3: Testes clássicos + GLM novos
**Goal**: Ligantes can run every statistical test taught in the capacitação that was missing from the MVP, each with correct numerics and assumption guidance
**Depends on**: Phase 2
**Requirements**: TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, UX-02
**Success Criteria** (what must be TRUE):
  1. User runs qui-quadrado de independência and sees an effect size plus a warning when expected cell counts are too low
  2. User runs one-way ANOVA with Tukey post-hoc and Kruskal-Wallis with Dunn post-hoc
  3. User runs Poisson regression with an overdispersion check, and Negative Binomial regression when overdispersion is present
  4. User runs Logistic regression and sees odds ratios with confidence intervals
  5. User sees assumption-check nudges appropriate to whichever test is active (e.g. normality hint, expected counts, overdispersion)
**Plans**: TBD

### Phase 4: Mapas Brasil + estados
**Goal**: Ligantes can visualize DataSUS-style data on Brazil and intra-state choropleths without any backend or live map API
**Depends on**: Phase 3
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05
**Success Criteria** (what must be TRUE):
  1. User plots a Brazil choropleth heatmap by UF with a legend
  2. User pastes territory labels as UF name or sigla and has them correctly recognized
  3. User drills into a selected state to view município, mesorregião, or região de saúde choropleths
  4. User sees a matched/unmatched report when municipality names are resolved within the chosen UF
  5. Maps render fully offline from bundled static geo assets, with no runtime map or IBGE API dependency
**Plans**: TBD
**UI hint**: yes

### Phase 5: Painel DataSUS / catálogo
**Goal**: Ligantes can find and understand which public-health variables to use and where to get them, before or after choosing a test
**Depends on**: Phase 4
**Requirements**: CAT-01, CAT-02, CAT-03
**Success Criteria** (what must be TRUE):
  1. User searches/browses a panel of public-health variables classified by type (categórica, numérica, ordinal, etc.)
  2. User opens official source links (TABNET, e-Gestor, SIDRA, Atlas, etc.) directly from a catalog entry
  3. User sees a suggested statistical test hint based on the variable's classified type
**Plans**: TBD

### Phase 6: Meta-análise
**Goal**: Ligantes can pool study-level effects and evaluate heterogeneity/publication bias using the didactic subset of meta-analysis (no Bayesian/trim-and-fill)
**Depends on**: Phase 5
**Requirements**: META-01, META-02, META-03, META-04
**Success Criteria** (what must be TRUE):
  1. User pools study-level effects using both fixed-effect and random-effects (DerSimonian-Laird) models
  2. User views and downloads a forest plot of study-level and pooled effects
  3. User sees heterogeneity stats I², Q, and τ² alongside the pooled result
  4. User views a funnel plot with a basic asymmetry check (Egger's test)
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Redesign / base React shell | 0/TBD | Not started | - |
| 2. Migrar testes existentes | 0/TBD | Not started | - |
| 3. Testes clássicos + GLM novos | 0/TBD | Not started | - |
| 4. Mapas Brasil + estados | 0/TBD | Not started | - |
| 5. Painel DataSUS / catálogo | 0/TBD | Not started | - |
| 6. Meta-análise | 0/TBD | Not started | - |
