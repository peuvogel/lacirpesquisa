# Requirements — Bioestatística LACIR v2.0

**Milestone:** v2.0 Suite estatística + mapas DataSUS  
**Defined:** 2026-07-25  
**Status:** Roadmap mapped — ready for planning

## v2.0 Requirements

### UI / Shell

- [x] **UI-01**: User sees a React LACIR portal shell with dark theme, teal accents, LACIR logo+name, and header nav: Estatística | Meta-análise | Variáveis | Mapas (no version/beta badge; DataSUS link lives inside Estatística)
- [ ] **UI-02**: User completes each test via a shared flow: Dados → Configurar → Resultados
- [x] **UI-03**: User can paste TABNET-style data (`;` delimiter, pt-BR decimal comma) and gets friendly validation errors
- [x] **UI-04**: User can download the active result chart as PNG
- [ ] **UI-05**: On Estatística only, if the user has already inputted data, the browser prompts before leaving/closing the page (no persistent refresh-loss banner)
- [ ] **UI-06**: User reads a brief plain-Portuguese interpretation under every test result

### Testes — migração

- [ ] **TEST-01**: User can run t de Student in the new shell with parity to v1.0 outputs
- [ ] **TEST-02**: User can run Correlação Pearson/Spearman in the new shell with parity to v1.0 outputs
- [ ] **TEST-03**: User can run Prais-Winsten in the new shell with parity to v1.0 outputs

### Testes — novos

- [ ] **TEST-04**: User can run qui-quadrado de independência with effect size and expected-cell warning
- [ ] **TEST-05**: User can run one-way ANOVA with Tukey post-hoc
- [ ] **TEST-06**: User can run Kruskal-Wallis with Dunn post-hoc
- [ ] **TEST-07**: User can run Poisson regression with overdispersion check
- [ ] **TEST-08**: User can run Negative Binomial regression
- [ ] **TEST-09**: User can run Logistic regression reporting odds ratios with confidence intervals

### Mapas

- [ ] **MAP-01**: User can plot a Brazil choropleth heatmap by UF with legend
- [ ] **MAP-02**: User can paste territory labels as UF name or sigla and have them recognized
- [ ] **MAP-03**: User can drill into a selected state and view município, mesorregião, or região de saúde choropleths
- [ ] **MAP-04**: User gets municipality name matching scoped by UF plus a matched/unmatched report
- [ ] **MAP-05**: Maps work fully offline from bundled static geo assets (no runtime map/IBGE API dependency)

### Catálogo DataSUS

- [ ] **CAT-01**: User can search/browse a panel of public-health variables classified by type (categorical, numeric, ordinal, etc.)
- [ ] **CAT-02**: User can open official source links (TABNET, e-Gestor, SIDRA, Atlas, etc.) from each catalog entry
- [ ] **CAT-03**: User sees a suggested statistical test hint based on the variable's classified type

### Meta-análise

- [ ] **META-01**: User can pool study-level effects with fixed-effect and random-effects (DerSimonian-Laird) models
- [ ] **META-02**: User can view/download a forest plot of study and pooled effects
- [ ] **META-03**: User sees heterogeneity stats I², Q, and τ² with the pooled result
- [ ] **META-04**: User can view a funnel plot and a basic asymmetry check (Egger's test)

### UX diferenciadores

- [ ] **UX-01**: User can use a guided “qual teste usar?” decision tree that routes to the right test module
- [ ] **UX-02**: User sees assumption-check nudges appropriate to the active test (e.g. normality hint, expected counts, overdispersion)

## Future Requirements

- Login / contas de usuário e salvar projetos na nuvem
- Backend / API persistente
- Download massivo automático de bases DataSUS
- Suite bayesiana / trim-and-fill / GLM genérico / zero-inflated
- Mapas animados por tempo / setor censitário

## Out of Scope

| Item | Reason |
|------|--------|
| Backend / database / auth | Explicit client-only milestone |
| Embutir JASP ou runtime R | JASP is numeric/behavior oracle only |
| Mapbox / Google Maps / tile APIs with keys | Offline classroom + no secrets in client |
| Bulk DataSUS scraping inside the app | Capacitação teaches manual TABNET extraction; ToS/ops risk |
| Full JASP UI clone | Didactic tabbed UX preferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 1 | Complete |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Complete |
| UI-04 | Phase 1 | Complete |
| UI-05 | Phase 1 | Pending |
| UI-06 | Phase 1 | Pending |
| UX-01 | Phase 1 | Pending |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 3 | Pending |
| TEST-05 | Phase 3 | Pending |
| TEST-06 | Phase 3 | Pending |
| TEST-07 | Phase 3 | Pending |
| TEST-08 | Phase 3 | Pending |
| TEST-09 | Phase 3 | Pending |
| UX-02 | Phase 3 | Pending |
| MAP-01 | Phase 4 | Pending |
| MAP-02 | Phase 4 | Pending |
| MAP-03 | Phase 4 | Pending |
| MAP-04 | Phase 4 | Pending |
| MAP-05 | Phase 4 | Pending |
| CAT-01 | Phase 5 | Pending |
| CAT-02 | Phase 5 | Pending |
| CAT-03 | Phase 5 | Pending |
| META-01 | Phase 6 | Pending |
| META-02 | Phase 6 | Pending |
| META-03 | Phase 6 | Pending |
| META-04 | Phase 6 | Pending |

**Coverage:** 29/29 requirements mapped ✓  
**Orphaned requirements:** (none)  
**Phantom phase requirements:** (none)

---
*Last updated: 2026-07-25 — requirements defined for v2.0*
