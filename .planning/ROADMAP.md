# Roadmap: Bioestatística LACIR

## Overview

v2.0 re-platforms the vanilla MVP calculator onto a React + Tailwind + shadcn/cult-ui dark/verde shell, then rebuilds capability in the build order locked in PROJECT.md: base shell first (everything else mounts on it), migrate the three validated tests to protect capacitação value, add the new classic + GLM tests (highest math risk), ship the Brasil/estado map suite, curate the DataSUS variable catalog, and finish with meta-análise last since it reuses chart/stats maturity built along the way. Everything stays 100% client-side — no backend, no login, session lives only in the browser cache.

**Implementation stance (locked):** Do **not** reinvent statistical engines from scratch. Port/adapt formulas and expected outputs from (1) existing v1.0 modules under `tests/` and (2) JASP open-source logic in `jasp-desktop-development/` (R analyses / docs as oracle). Milestone effort concentrates on the didactic React interface, Portuguese interpretation, assumption nudges, charts/export, maps, and catalog UX.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Redesign / base React shell** - React+Vite+Tailwind+shadcn dark/teal LACIR portal (header: Estatística | Meta-análise | Variáveis | Mapas), shared paste→configure→results flow, PNG export, conditional leave warning, "qual teste?" modal, Mapas mock shell (completed 2026-07-25)
- [x] **Phase 2: Migrar testes existentes** - t de Student, Pearson/Spearman, and Prais-Winsten ported into the new shell with output parity to v1.0 (completed 2026-07-25)
- [ ] **Phase 3: Testes clássicos + GLM novos** - Qui-quadrado, ANOVA/Tukey, Kruskal-Wallis/Dunn, Poisson, Binomial Negativa, and Regressão Logística, each with assumption-check nudges
- [ ] **Phase 4: Mapas Brasil + estados** - Client-side Brazil/UF choropleth with drill-down into município/mesorregião/região de saúde, offline from bundled geo assets
- [ ] **Phase 5: Painel DataSUS / catálogo** - Searchable catalog of classified public-health variables with official source links and suggested-test hints
- [ ] **Phase 6: Meta-análise** - Fixed/random-effects pooling with forest plot, heterogeneity stats, funnel plot, and Egger's asymmetry check

## Phase Details

### Phase 1: Redesign / base React shell

**Goal**: Users experience the LACIR portal React shell — header nav, Estatística flow, Mapas mock research launcher, shared paste, export, and conditional leave warning — that later modules mount on
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UX-01
**Success Criteria** (what must be TRUE):

  1. User opens the app on Estatística and sees dark + teal accents, LACIR logo+name, and header nav Estatística | Meta-análise | Variáveis | Mapas (no version badge; DataSUS link inside Estatística)
  2. User completes the stub test through Dados → Configurar → Resultados with brief PT interpretation
  3. User pastes messy DataSUS/TABNET-style data and gets auto-detect → preview → confirm (friendly errors when invalid)
  4. User downloads the active result chart as a PNG
  5. Leaving/closing Estatística with inputted data triggers a browser leave prompt; no persistent refresh banner
  6. User can open "qual teste usar?" modal (roadmap with em breve) and use Mapas mock: hover/select UFs, variable panel intersection/partials, stub Iniciar pesquisa

**Plans**: 12 plans (6 waves)
Plans:

- [x] 01-01-PLAN.md — Wave 1: Vite/React/TS/Tailwind v4 scaffold, dependency install, vitest+RTL harness, shadcn primitives, purple-scaffold purge
- [x] 01-02-PLAN.md — Wave 2: dark+teal token layer, Sora/IBM Plex Mono, two first-party accents, token contract test
- [x] 01-03-PLAN.md — Wave 2: port tabular/DataSUS parsers with TABNET fixtures and differential parity tests
- [x] 01-04-PLAN.md — Wave 2: port chart theme + ChartCanvas lifecycle + PNG export hook + pt-BR formatting
- [x] 01-05-PLAN.md — Wave 3: app shell — header nav, router, placeholder routes, in-memory session
- [x] 01-06-PLAN.md — Wave 3: FlowSteps stepper, useTabularInput, paste/upload panel, confirmable column preview
- [x] 01-07-PLAN.md — Wave 4: test registry, collapsible sidebar, "Qual teste usar?" modal, Portal DATASUS link
- [x] 01-08-PLAN.md — Wave 4: DataSUS assistant — state machine port + six-step JSX panel
- [x] 01-09-PLAN.md — Wave 4: Mapas mock — 27-UF SVG, intersection/partial variable panel
- [x] 01-10-PLAN.md — Wave 5: Teste demo end-to-end + shared results pattern (chart, interpretation, PNG)
- [x] 01-11-PLAN.md — Wave 5: Mapas "Iniciar pesquisa" stub — suggestions, collection links, paste handoff
- [x] 01-12-PLAN.md — Wave 6: conditional leave warning (Estatística + data only) and "Limpar dados"

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

**Plans**: 8 plans (6 waves)
Plans:

- [x] 02-01-PLAN.md — Wave 0: Stats engine port, derive* parity tests, fixtures, chartjs-plugin-annotation install
- [x] 02-02-PLAN.md — Wave 1: Chart factories, ChartCustomizer, ResultsPanelWithCustomizer, shared Configurar components
- [x] 02-03-PLAN.md — Wave 2: t de Student module (TEST-01) — engine, interpretation, FlowSteps UI
- [x] 02-04-PLAN.md — Wave 3: Correlação Pearson/Spearman module (TEST-02)
- [x] 02-05-PLAN.md — Wave 3: Prais-Winsten module (TEST-03) — parallel with 02-04
- [x] 02-06-PLAN.md — Wave 4: Registry flip, EstatisticaPage routing, demo badge, Mapas handoff, integration gate
- [ ] 02-07-PLAN.md — Wave 5 (gap): Shared deriveRecognizedColumnsFromTabular + session bootstrap fix (CR-01)
- [ ] 02-08-PLAN.md — Wave 6 (gap): ColumnPreview confirm mapping (WR-01) + handoff Resultados integration test

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
| 1. Redesign / base React shell | 12/12 | Complete   | 2026-07-25 |
| 2. Migrar testes existentes | 6/8 | Gaps — CR-01 handoff | 2026-07-25 |
| 3. Testes clássicos + GLM novos | 0/TBD | Not started | - |
| 4. Mapas Brasil + estados | 0/TBD | Not started | - |
| 5. Painel DataSUS / catálogo | 0/TBD | Not started | - |
| 6. Meta-análise | 0/TBD | Not started | - |
