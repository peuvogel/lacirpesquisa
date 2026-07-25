# Requirements — Bioestatística LACIR v2.0

**Milestone:** v2.0 Suite estatística + mapas DataSUS  
**Defined:** 2026-07-25  
**Status:** Roadmap mapped — ready for planning

## v2.0 Requirements

### UI / Shell

- [x] **UI-01**: User sees a React LACIR portal shell with dark theme, teal accents, LACIR logo+name, and header nav: Estatística | Meta-análise | Variáveis | Mapas (no version/beta badge; DataSUS link lives inside Estatística)
- [x] **UI-02**: User completes each test via a shared flow: Dados → Configurar → Resultados
- [x] **UI-03**: User can paste TABNET-style data (`;` delimiter, pt-BR decimal comma) and gets friendly validation errors
- [x] **UI-04**: User can download the active result chart as PNG
- [x] **UI-05**: On Estatística only, if the user has already inputted data, the browser prompts before leaving/closing the page (no persistent refresh-loss banner)
- [x] **UI-06**: User reads a brief plain-Portuguese interpretation under every test result

### Testes — migração

- [x] **TEST-01**: User can run t de Student in the new shell with parity to v1.0 outputs
- [x] **TEST-02**: User can run Correlação Pearson/Spearman in the new shell with parity to v1.0 outputs
- [x] **TEST-03**: User can run Prais-Winsten in the new shell with parity to v1.0 outputs

### Testes — novos

- [x] **TEST-04**: User can run qui-quadrado de independência with effect size and expected-cell warning
- [x] **TEST-05**: User can run one-way ANOVA with Tukey post-hoc
- [x] **TEST-06**: User can run Kruskal-Wallis with Dunn post-hoc
- [x] **TEST-07**: User can run Poisson regression with overdispersion check
- [x] **TEST-08**: User can run Negative Binomial regression
- [x] **TEST-09**: User can run Logistic regression reporting odds ratios with confidence intervals

### Mapas (interface de análise estatística)

- [x] **MAP-01**: User can plot a Brazil choropleth heatmap by UF with legend
- [x] **MAP-02**: User can paste territory labels as UF name or sigla and have them recognized
- [x] **MAP-03**: User can drill into a selected state and view município, mesorregião, or região/macrorregião de saúde choropleths
- [x] **MAP-04**: User gets municipality name matching scoped by UF plus a matched/unmatched report
- [x] **MAP-05**: Maps work fully offline from bundled static geo assets (no runtime map/IBGE API dependency)
- [x] **MAP-06**: User can analyze temporality on the map (select period / compare across time) as part of the statistical workflow
- [x] **MAP-07**: User can group UFs into analysis groups, with presets for grandes regiões (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) and custom groups
- [x] **MAP-08**: User can select/group by macrorregiões de saúde (and related health-region geography) for analysis
- [x] **MAP-09**: User can select multiple diseases/agravos within the chosen territory groups and time window, then run statistical tests from that selection
- [x] **MAP-10**: Map analysis UX is didactic and intuitive (clear steps, plain-PT guidance, visible selection summary of territory × time × diseases × groups)

### Variáveis DataSUS (dados no site + referências)

- [ ] **CAT-01**: User can search/browse a panel of public-health variables classified by type (categorical, numeric, ordinal, etc.)
- [ ] **CAT-02**: Every variable shows mandatory provenance/reference (source system, table/indicator, period covered, official citation/URL) — never orphan data
- [ ] **CAT-03**: User sees a suggested statistical test hint based on the variable's classified type
- [ ] **CAT-04**: User can load curated/scraped variable datasets into analysis directly in the app (no need to leave for TABNET during the classroom flow)
- [x] **CAT-05**: Scraped/curated datasets are produced by a versioned offline pipeline (build-time assets), not live runtime scraping during analysis

### Meta-análise

- [ ] **META-01**: User can pool study-level effects with fixed-effect and random-effects (DerSimonian-Laird) models
- [ ] **META-02**: User can view/download a forest plot of study and pooled effects
- [ ] **META-03**: User sees heterogeneity stats I², Q, and τ² with the pooled result
- [ ] **META-04**: User can view a funnel plot and a basic asymmetry check (Egger's test)

### UX diferenciadores

- [x] **UX-01**: User can use a guided “qual teste usar?” decision tree that routes to the right test module
- [x] **UX-02**: User sees assumption-check nudges appropriate to the active test (e.g. normality hint, expected counts, overdispersion)

## Future Requirements

- Login / contas de usuário e salvar projetos na nuvem
- Backend / API persistente de sessão
- Refresh contínuo/automatizado do pipeline de scrape (CI) além do bundle versionado do milestone
- Suite bayesiana / trim-and-fill / GLM genérico / zero-inflated
- Setor censitário / animações avançadas de mapa além da temporalidade didática (MAP-06)

## Out of Scope

| Item | Reason |
|------|--------|
| Backend / database / auth de sessão | Análises client-only; scrape é pipeline de assets |
| Embutir JASP ou runtime R | JASP is numeric/behavior oracle only |
| Mapbox / Google Maps / tile APIs with keys | Offline classroom + no secrets in client |
| Live runtime TABNET scraping during class | ToS/ops/instability; use versioned pipeline + provenance instead |
| Full JASP UI clone | Didactic tabbed UX preferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 1 | Complete |
| UI-02 | Phase 1 | Complete |
| UI-03 | Phase 1 | Complete |
| UI-04 | Phase 1 | Complete |
| UI-05 | Phase 1 | Complete |
| UI-06 | Phase 1 | Complete |
| UX-01 | Phase 1 | Complete |
| TEST-01 | Phase 2 | Complete |
| TEST-02 | Phase 2 | Complete |
| TEST-03 | Phase 2 | Complete |
| TEST-04 | Phase 3 | Complete |
| TEST-05 | Phase 3 | Complete |
| TEST-06 | Phase 3 | Complete |
| TEST-07 | Phase 3 | Complete |
| TEST-08 | Phase 3 | Complete |
| TEST-09 | Phase 3 | Complete |
| UX-02 | Phase 3 | Complete |
| MAP-01 | Phase 4 | Complete |
| MAP-02 | Phase 4 | Complete |
| MAP-03 | Phase 4 | Complete |
| MAP-04 | Phase 4 | Complete |
| MAP-05 | Phase 4 | Complete |
| MAP-06 | Phase 4 | Complete |
| MAP-07 | Phase 4 | Complete |
| MAP-08 | Phase 4 | Complete |
| MAP-09 | Phase 4 | Complete |
| MAP-10 | Phase 4 | Complete |
| CAT-01 | Phase 5 | Pending |
| CAT-02 | Phase 5 | Pending |
| CAT-03 | Phase 5 | Pending |
| CAT-04 | Phase 5 | Pending |
| CAT-05 | Phase 5 | Complete |
| META-01 | Phase 6 | Pending |
| META-02 | Phase 6 | Pending |
| META-03 | Phase 6 | Pending |
| META-04 | Phase 6 | Pending |

**Coverage:** 36/36 requirements mapped ✓  
**Orphaned requirements:** (none)  
**Phantom phase requirements:** (none)

---
*Last updated: 2026-07-25 — pivot: scrape+referências (CAT-02/04/05) + mapa interface estatística (MAP-06..10)*
