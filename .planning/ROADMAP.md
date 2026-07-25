# Roadmap: Bioestatística LACIR

## Overview

v2.0 re-platforms the vanilla MVP calculator onto a React + Tailwind + shadcn/cult-ui dark/verde shell, then rebuilds capability in the build order locked in PROJECT.md: base shell first, migrate the three validated tests, add classic + GLM tests, ship maps as a **statistical analysis interface** (temporality, regional presets, health macro-regions, multi-disease), deliver **scraped/curated variables in-app with mandatory provenance**, and finish with meta-análise last. Analyses stay client-side (session in browser cache); DataSUS scrape is an offline/versioned data pipeline into bundled assets — never orphan variables without source references.

**Implementation stance (locked):** Do **not** reinvent statistical engines from scratch. Port/adapt formulas and expected outputs from (1) existing v1.0 modules under `tests/` and (2) JASP open-source logic in `jasp-desktop-development/` (R analyses / docs as oracle). Milestone effort concentrates on didactic React UX, Portuguese interpretation, assumption nudges, charts/export, map-as-analysis-UI, and variable pipeline + provenance.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Redesign / base React shell** - React+Vite+Tailwind+shadcn dark/teal LACIR portal (header: Estatística | Meta-análise | Variáveis | Mapas), shared paste→configure→results flow, PNG export, conditional leave warning, "qual teste?" modal, Mapas mock shell (completed 2026-07-25)
- [x] **Phase 2: Migrar testes existentes** - t de Student, Pearson/Spearman, and Prais-Winsten ported into the new shell with output parity to v1.0 (completed 2026-07-25)
- [x] **Phase 3: Testes clássicos + GLM novos** - Qui-quadrado, ANOVA/Tukey, Kruskal-Wallis/Dunn, Poisson, Binomial Negativa, and Regressão Logística, each with assumption-check nudges (completed 2026-07-25)
- [x] **Phase 4: Mapas como interface estatística** - Brazil/UF + drill-down; temporalidade; grupos de UF com presets (N/NE/CO/SE/S); macrorregiões de saúde; multi-doença; fluxo didático território×tempo×grupo → testes (completed 2026-07-25)
- [ ] **Phase 5: Variáveis no site (scrape + referências)** - Pipeline de curadoria/scrape versionado; catálogo classificado; **referência obrigatória** em cada variável; carregar dados no app sem sites externos na aula
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
- [x] 02-07-PLAN.md — Wave 5 (gap): Shared deriveRecognizedColumnsFromTabular + session bootstrap fix (CR-01)
- [x] 02-08-PLAN.md — Wave 6 (gap): ColumnPreview confirm mapping (WR-01) + handoff Resultados integration test

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

**Plans**: 9 plans (5 waves)

Plans:

- [x] 03-01-PLAN.md — Wave 0: statsEngine χ²/ANOVA/Kruskal/Tukey/Dunn + glmEngine + golden fixtures + AssumptionNudgeStrip + jstat/ml-matrix
- [x] 03-02-PLAN.md — Wave A: Qui-quadrado TEST-04 (engine + UI + charts)
- [x] 03-03-PLAN.md — Wave A: ANOVA+Tukey TEST-05 (parallel with 03-04)
- [x] 03-04-PLAN.md — Wave A: Kruskal+Dunn TEST-06 (parallel with 03-03)
- [x] 03-05-PLAN.md — Wave A gate: registry + routes for classical tests; UX-02 integration
- [x] 03-06-PLAN.md — Wave B: Poisson TEST-07 + overdispersion CTA + glmCoefForestChart
- [x] 03-07-PLAN.md — Wave B: Binomial Negativa TEST-08 (parallel with 03-08)
- [x] 03-08-PLAN.md — Wave B: Logística TEST-09 (parallel with 03-07)
- [x] 03-09-PLAN.md — Wave B gate: full verification; all six tests available

### Phase 4: Mapas como interface estatística

**Goal**: Ligantes use the map as a didactic statistical-analysis surface — select territory, time, disease(s), and groups (regional presets / health macro-regions), then run tests — not merely a research launcher
**Depends on**: Phase 3
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, MAP-09, MAP-10
**Success Criteria** (what must be TRUE):

  1. User plots a Brazil choropleth heatmap by UF with a legend
  2. User pastes territory labels as UF name or sigla and has them correctly recognized
  3. User drills into a selected state to view município, mesorregião, or região/macrorregião de saúde choropleths
  4. User sees a matched/unmatched report when municipality names are resolved within the chosen UF
  5. Maps render fully offline from bundled static geo assets, with no runtime map or IBGE API dependency
  6. User selects a time window / compares periods (temporalidade) as part of the map analysis flow
  7. User groups UFs for analysis using presets (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) and/or custom groups
  8. User can include macrorregiões de saúde in grouping/selection
  9. User selects multiple diseases/agravos within the active territory × time × group context and proceeds to statistical tests
  10. The map flow stays didactic: clear steps, plain-PT guidance, and a visible summary of the current selection

**Plans**: 8 plans in 8 waves

Plans:

- [x] 04-01-PLAN.md — Wave 0: geo fetch script, types, session model, CI fixtures (MAP-05/08 infra)
- [x] 04-02-PLAN.md — Wave 1: UF choropleth + legend (MAP-01)
- [x] 04-03-PLAN.md — Wave 2: territory paste UF matching (MAP-02)
- [x] 04-04-PLAN.md — Wave 3: GroupBar DnD + presets + summary strip (MAP-07/08/10)
- [x] 04-05-PLAN.md — Wave 4: drill-down + lazy topo + muni match (MAP-03/04/05)
- [x] 04-06-PLAN.md — Wave 5: GroupConfigPanel time + variables hybrid data (MAP-06)
- [x] 04-07-PLAN.md — Wave 6: ReviewAnalysisDialog + assemble table + suggest test (MAP-09)
- [x] 04-08-PLAN.md — Wave 7: phase gate verification (MAP-01…10)

**UI hint**: yes

### Phase 5: Variáveis no site (scrape + referências)

**Goal**: Ligantes analyze public-health variables already available in the app (via versioned scrape/curation pipeline), always seeing where each variable comes from — no orphan data, no mandatory external TABNET trip during class
**Depends on**: Phase 4
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05
**Success Criteria** (what must be TRUE):

  1. User searches/browses a panel of public-health variables classified by type (categórica, numérica, ordinal, etc.)
  2. Every catalog entry shows mandatory provenance (sistema/fonte, tabela/indicador, período, URL/citação oficial)
  3. User sees a suggested statistical test hint based on the variable's classified type
  4. User loads curated/scraped datasets into Estatística/Mapas analysis without leaving the app for data collection
  5. Datasets are produced by a versioned offline pipeline (build-time assets), not live runtime scraping

**Plans:** 6/7 plans executed

Plans:

- [x] 05-01-PLAN.md — Offline pipeline: package embolia/amputação packs + reference-seed → public/data/catalog
- [x] 05-02-PLAN.md — CatalogEntry types + fail-closed catalog:validate + npm/pretest gate
- [x] 05-03-PLAN.md — TDD catalog modules: loadCatalog, filter, suggestTest, buildSessionDataset
- [x] 05-04-PLAN.md — Variáveis UI: search/filter/list/detail + provenance + test hint
- [x] 05-05-PLAN.md — Mapas catalogAnalysisData swap; retire mock numerics/provenance for packs
- [x] 05-06-PLAN.md — Load handoff: Carregar na Estatística + Usar no mapa (multi-select D-16)
- [ ] 05-07-PLAN.md — Phase gate: validate + full suite + VERIFICATION + human UAT

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
| 2. Migrar testes existentes | 8/8 | Complete   | 2026-07-25 |
| 3. Testes clássicos + GLM novos | 9/9 | Complete   | 2026-07-25 |
| 4. Mapas como interface estatística | 8/8 | Complete   | 2026-07-25 |
| 5. Variáveis no site (scrape + referências) | 6/7 | In Progress|  |
| 6. Meta-análise | 0/TBD | Not started | - |
