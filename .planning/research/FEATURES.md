# Feature Research

**Domain:** Educational biostatistics web app (client-only, medical students, LACIR liga)
**Researched:** 2026-07-25
**Confidence:** MEDIUM-HIGH (stack/library claims verified via WebSearch + official docs; UX conventions verified against JASP documentation and student guides; some niche claims — client-side meta-analysis performance limits, IBGE malha payload sizes — are MEDIUM confidence, single/few-source)

## Feature Landscape

Rows are tagged with **Category** matching the milestone grouping: `UI/UX`, `Classic Tests`, `Count/GLM Tests`, `Meta-Analysis`, `Maps`, `DataSUS Catalog`, `Session/State`.

### Table Stakes (Users Expect These)

Features students/instructors assume exist. Missing these = tool feels broken or incomplete relative to the existing v1.0 baseline and to JASP as the behavioral oracle.

| Category | Feature | Why Expected | Complexity | Notes |
|----------|---------|--------------|------------|-------|
| UI/UX | Tabbed test workflow (Dados → Configurar → Resultados) | v1.0 already does paste→run→result; a redesign that removes this flow regresses UX | MEDIUM | Reuse across all test modules as a shared layout primitive (shadcn `Tabs`); each test module plugs in its own config fields |
| UI/UX | Consistent dark+green shell (sidebar nav, LACIR logo/header) | Already established brand in v1.0; explicit constraint in PROJECT.md | LOW | Mostly Tailwind theme tokens + shadcn theming; logo asset already exists |
| UI/UX | Paste/upload data box with delimiter auto-detect (tab, comma, semicolon, whitespace) | Ligantes copy straight from Excel/DataSUS TABNET exports which vary in delimiter and decimal comma vs. dot | MEDIUM | v1.0 likely only supports one format; DataSUS TABNET exports use `;`-CSV with comma decimals (per `GUIA_MAPEAMENTO...md` — PRN/`;`-separated) — must handle pt-BR decimal comma |
| UI/UX | Inline validation + friendly errors (wrong column count, non-numeric where numeric expected, too few observations) | Medical students are not programmers; silent failures or console errors kill trust in a teaching tool | MEDIUM | Must map to didactic language, not raw exceptions |
| UI/UX | One-click downloadable chart (PNG at minimum) per result | Already a v1.0 feature; students paste charts into lab reports/slides | LOW | Keep parity; consider SVG/PNG both if cheap |
| UI/UX | Brief plain-language interpretation under every result ("o que isso significa") | Core differentiator already promised in PROJECT.md Core Value; JASP itself does NOT do this (opportunity) | MEDIUM | Needs a per-test interpretation template driven by p-value/effect-size thresholds |
| Classic Tests | t-Student (independent + paired), with assumption checks surfaced (normality hint, variance) | Already shipped in v1.0; regression risk during rewrite | MEDIUM | Port existing formulas; add Welch vs Student choice like JASP |
| Classic Tests | Pearson/Spearman correlation with scatterplot + fit line | Already shipped in v1.0 | LOW-MEDIUM | Port; Spearman needs rank transform |
| Classic Tests | Prais-Winsten (autocorrelation-corrected trend) for time series | Already shipped; used specifically for DataSUS time trend indicators (health surveillance trend analysis is a named use case) | MEDIUM | Port existing implementation |
| Classic Tests | Chi-square test of independence (contingency table) with expected-count-&gt;5 assumption warning, Cramér's V/Phi effect size | Explicitly "taught in capacitação but missing" per PROJECT.md; JASP surfaces expected-cell warnings and effect size by default — students expect the same guardrails | MEDIUM | JASP convention: report χ²(df) = x, p, Cramér's V (V for &gt;2×2, Phi for 2×2) |
| Classic Tests | One-way ANOVA with omnibus F-test + post-hoc (Tukey) + effect size (η²/ω²) | JASP always pairs ANOVA with post-hoc when the omnibus is significant; teaching context implies "which groups differ" is the real question | MEDIUM-HIGH | Needs post-hoc pairwise table — don't ship ANOVA without it or it's an incomplete/useless answer for students |
| Classic Tests | Kruskal-Wallis (non-parametric ANOVA alternative) with post-hoc (Dunn's test) | Standard JASP pairing: offered as the non-parametric counterpart whenever ANOVA is offered; students are taught "check normality → pick parametric or not" | MEDIUM | Same post-hoc requirement as ANOVA |
| Count/GLM Tests | Poisson regression for count outcomes (with overdispersion check) | Explicitly requested; overdispersion check (deviance/df ratio) is what tells the student whether to switch to Negative Binomial — pairing the two tests is expected pedagogy, not optional | MEDIUM-HIGH | GLM math (IRLS) is more complex than closed-form tests; needs numerical optimization, not analytic formula |
| Count/GLM Tests | Negative Binomial regression (for overdispersed counts) | Explicitly requested; standard escalation from Poisson in epidemiology teaching (DataSUS counts of internações/óbitos are classically overdispersed) | HIGH | Requires estimating a dispersion parameter (θ) via ML; hardest test in the new suite |
| Count/GLM Tests | Logistic regression (binary outcome) with odds ratios + CI, model significance (likelihood ratio test), pseudo-R² | Explicitly requested; JASP reports OR as the headline number, not raw coefficients — students are taught to interpret OR, not log-odds | MEDIUM-HIGH | Needs IRLS/Newton-Raphson; report OR = exp(β) with CI, not just β |
| Meta-Analysis | Fixed-effect + random-effects (DerSimonian-Laird) pooled estimate with forest plot | Explicitly scoped; forest plot is the non-negotiable visual signature of meta-analysis — a meta-analysis feature without one isn't recognizable as meta-analysis | HIGH | DL is the simplest random-effects estimator to implement correctly and is what most teaching tools default to (vs. REML/Paule-Mandel, which are estimator upgrades, not requirements) |
| Meta-Analysis | I² and heterogeneity statistics (Q, τ²) displayed with the pooled result | Table-stakes companion to any random-effects estimate; JASP/metafor always show I² next to the pooled effect | MEDIUM | Formula-level, cheap once effect sizes + variances are computed |
| Meta-Analysis | Funnel plot + basic asymmetry check (visual + simple test, e.g., Egger's regression) | Explicitly scoped ("funnel plot, basic asymmetry") | MEDIUM-HIGH | Egger's test is a simple weighted regression — tractable client-side; full trim-and-fill is not required per scope |
| Maps | Brazil choropleth by UF (state) with a numeric variable → color scale + legend | Explicitly scoped; this is the "headline" map view | MEDIUM | IBGE malhas API serves ready GeoJSON/TopoJSON per UF (`servicodados.ibge.gov.br/api/v3/malhas`) — no need to author custom map data |
| Maps | State name / abbreviation (sigla) recognition when pasting data ("Bahia", "BA", "bahia") | Explicitly scoped; DataSUS/IBGE exports mix full names and siglas inconsistently, and capitalization/accents vary | MEDIUM | Needs a normalization dictionary (26 UFs + DF, accent-insensitive, case-insensitive) — small, well-bounded lookup table |
| Maps | Intra-state drill-down: municipalities view for a selected UF | Explicitly scoped; ligantes do state-level studies (e.g., Bahia) and need municipality granularity | HIGH | IBGE malhas API supports per-UF municipality meshes, but full-resolution municipal GeoJSON for a state can still be several MB — needs low `resolucao` parameter + simplification for browser performance |
| Maps | Municipality name recognition/matching (fuzzy, accent/typo-tolerant) | Same rationale as UF recognition, harder because Brazil has 5,570 municipalities incl. duplicate names across states | HIGH | Needs IBGE municipality code (`codmun`) lookup table + fuzzy match; ambiguous names (same city name, different UF) must be disambiguated by UF column |
| DataSUS Catalog | Searchable panel of official variables classified by type (categorical/numeric/ordinal/count/etc.) | Explicitly scoped; directly reuses the existing `trabalhos datasus/` research artifact (catalogs already extracted) | MEDIUM | Data already exists (`build/catalogos/tabnet_catalog.json`+ guide) — this is primarily a UI/browse/search layer over existing JSON, not new data collection |
| DataSUS Catalog | Clickable official links per variable/source (TABNET, e-Gestor, SIDRA, Atlas, etc.) | Explicitly scoped; matches the "matriz rápida das fontes" table already researched | LOW-MEDIUM | Links and source metadata already documented in the guide; mostly a rendering/filtering task |
| Session/State | Everything survives tab navigation without reload (in-memory state across test tabs) | Client-only constraint; if switching from t-test tab to chi-square tab wipes pasted data, the didactic flow (compare tests on same dataset) breaks | MEDIUM | Needs a shared in-memory store (e.g., Zustand/Context) keyed by dataset, not per-test-page local state |
| Session/State | Explicit, visible warning that refreshing/closing the tab loses all work | Client-only constraint (PROJECT.md: "refresh perde o trabalho") — students must not be surprised mid-class | LOW | Simple `beforeunload` prompt + persistent banner; cheap to build, high trust payoff |

### Differentiators (Competitive Advantage)

Features that set this tool apart from JASP/SPSS/generic calculators for this specific audience (medical students, semester practicals, DataSUS-flavored data).

| Category | Feature | Value Proposition | Complexity | Notes |
|----------|---------|-------------------|------------|-------|
| UI/UX | Didactic auto-interpretation in plain Portuguese for every test (not just p-value, but "o que fazer a seguir") | JASP shows tables/numbers only — it assumes statistical literacy. Automatic, test-specific plain-language guidance is the single biggest gap this tool can fill for undergrads | MEDIUM-HIGH | Needs a decision-tree template per test (e.g., "p<0.05 e Cramér's V=0.3 → associação moderada e significativa; próximo passo: ..."). This is the core teaching value-add and should be prioritized alongside the classic tests, not treated as a nice-to-have |
| UI/UX | "Which test should I use?" guided picker (decision tree by data type/design) | Reduces the #1 friction point for students: choosing the right test before they even reach the calculator | MEDIUM | Could be a simple wizard (categorical/numeric outcome? paired/independent? # of groups?) routing into the right tab |
| Classic/Count/GLM | Assumption-check nudges baked into results (normality flag before t-test/ANOVA, overdispersion flag before Poisson→NegBin) | Turns "the software ran it" into "the software taught me when NOT to trust the number" — directly matches the pedagogical goal | MEDIUM-HIGH | Can be a lightweight heuristic (e.g., Shapiro-Wilk on small n, or just a rule-of-thumb banner) rather than a full diagnostics suite |
| Maps | UF + municipality name/sigla auto-recognition when pasting raw DataSUS exports | No generic tool does DataSUS-specific territory parsing; this directly targets the liga's real workflow (paste from TABNET, plot immediately) | MEDIUM-HIGH | Builds directly on the catalog integration keys already documented (`codmun`, UF, região de saúde) |
| DataSUS Catalog | Cross-linking catalog variables to the relevant test module (e.g., "esta variável é categórica → use qui-quadrado") | Closes the loop between "I found a variable" and "I know what to do with it" — unique bridge no competitor offers | MEDIUM | Requires tagging catalog entries with a suggested-test hint based on variable type classification already planned |
| Meta-Analysis | Guided meta-analysis walkthrough (upload study-level effect sizes → automatic model choice hint fixed vs random based on I²) | JASP's meta-analysis module (via metafor) is powerful but not beginner-guided; a "here's what I² means for your model choice" nudge is a real differentiator for a first exposure to meta-analysis | MEDIUM | Layer of guidance text on top of the already-scoped I²/forest plot outputs |
| Session/State | "Compare tests" mode: run the same pasted dataset through 2+ compatible tests side by side (e.g., Pearson vs Spearman) | Reinforces the "why choose this test" lesson; cheap once shared in-memory state exists | LOW-MEDIUM | Natural extension of the shared dataset store — mostly a UI affordance once state is centralized |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look attractive (often because "JASP has it" or "a real map/stats tool has it") but would blow the didactic-MVP scope, contradict the client-only constraint, or add complexity disproportionate to teaching value.

| Category | Feature | Why Requested | Why Problematic | Alternative |
|----------|---------|---------------|------------------|-------------|
| Meta-Analysis | Full Bayesian meta-analysis / Bayesian everything (JASP has a Bayesian module) | "JASP does it, so we should too" | Explicitly out of scope per PROJECT.md; Bayesian inference needs MCMC or heavier numerics that are hard to justify client-side and are pedagogically advanced for semester practicals | Stick to frequentist fixed/random effects; mention Bayesian as "further reading" at most |
| Meta-Analysis | Full publication-bias suite (trim-and-fill, multiple selection models, PET-PEESE, fail-safe N) | Meta-analysis tools like Meta-Mar/PrognosisMeta showcase these as flagship features | Scope explicitly says "funnel plot + basic asymmetry" — trim-and-fill and selection models are a research-grade rabbit hole with real numerical-stability risk in a browser, disproportionate for an intro exposure | Funnel plot + single asymmetry test (Egger's regression) only, as scoped |
| Maps | Full census-tract (setor censitário) resolution mapping | "More granularity is more powerful" | IBGE census-tract shapefiles are not served by the lightweight malhas API and are large/complex to render performantly in-browser; also not needed for the stated use cases (state + municipality/mesoregion/health-region) | Cap granularity at municípios / mesorregiões / regiões de saúde as scoped |
| Maps | Real-time/animated time-series choropleth (map that animates across years) | Looks impressive in a demo | Adds an entire animation/timeline UI layer and data-shape complexity (multi-period datasets) not requested; risks derailing the "paste → heatmap" simplicity | Ship static single-period heatmap; time trends stay in Prais-Winsten charts, not the map |
| Count/GLM Tests | Full GLM framework (arbitrary link functions, custom families, offsets UI, zero-inflated models) | "Since we're building Poisson/NegBin anyway, why not generalize?" | Zero-inflated/hurdle models and a generic GLM builder are substantially harder to implement correctly and explain didactically; scope explicitly lists 6 named tests, not a GLM framework | Ship the 6 named tests as fixed, well-explained modules; revisit zero-inflated as a future milestone if requested |
| DataSUS Catalog | Automated bulk download/scraping of DataSUS bases from within the app | Feels like a natural extension of "we already mapped the sources" | Explicitly out of scope ("Download massivo automático... deferred"); also legally/operationally risky (rate limits, ToS, stale mirrors) and turns a client-only teaching tool into a scraping service | Panel links out to TABNET/portals; students still do the manual extraction taught in the practicals |
| Session/State | Cloud save / account login / shareable analysis links | "Students want to save their work" | Explicitly out of scope for this milestone (no backend/login); adding even minimal auth changes the whole architecture and constraint set | LocalStorage/IndexedDB-based session persistence within the browser (survives refresh) is a reasonable *in-scope* stretch if desired later, but a full account system is not |
| UI/UX | Pixel-perfect JASP UI clone (replicate JASP's QML panels/menus) | JASP is the "oracle" reference, tempting to imitate the look too | PROJECT.md explicitly says use JASP as a behavior/output oracle, not a UI template; QML-style dense menus are the opposite of "didactic and auto-explanatory" for undergrads | Keep the tabbed, guided, dark+green UX; only mirror JASP's *statistical output conventions* (e.g., reporting χ², F, OR the same way) |
| Classic/GLM Tests | Exhaustive model-fit diagnostics suite (residual plots, leverage/Cook's distance, VIF, multicollinearity panels) for every regression test | "A real stats tool shows diagnostics" | High implementation cost per test, and the target audience (semester practical, first exposure) is better served by 1-2 headline assumption checks than a full diagnostics battery that can overwhelm/confuse | One clear assumption nudge per test (e.g., overdispersion ratio for Poisson, expected-count warning for chi-square) rather than a full diagnostics panel |

## Feature Dependencies

```
[Tabbed UI shell + dark/green theme]
    └──requires──> [Redesign/base React+Vite+Tailwind+shadcn setup]

[Shared in-memory dataset store]
    └──requires──> [Redesign/base setup]
    └──enables──> ["Compare tests" mode]
    └──enables──> [State persists across tabs]

[Chi-square, ANOVA, Kruskal-Wallis]
    └──requires──> [Paste/upload data + validation]
    └──requires──> [Assumption-check UI pattern] (reused across new tests)

[Poisson regression]
    └──requires──> [GLM numerical solver (IRLS/Newton-Raphson)]
    └──enables──> [Negative Binomial] (shares solver + overdispersion diagnostic)

[Negative Binomial]
    └──requires──> [Poisson regression] (introduces dispersion param on top of Poisson infrastructure)

[Logistic regression]
    └──requires──> [GLM numerical solver] (can share code with Poisson/NegBin)

[Meta-analysis: forest plot]
    └──requires──> [Effect-size/variance input UI] (new data-entry shape, not raw paste of two columns)
    └──requires──> [Fixed + random effects pooling (DerSimonian-Laird)]

[Meta-analysis: I²/heterogeneity]
    └──requires──> [Fixed + random effects pooling]

[Meta-analysis: funnel plot + asymmetry]
    └──requires──> [Effect-size/variance input UI]
    └──enhances──> [Forest plot / pooled estimate] (adds bias context)

[Brazil UF heatmap]
    └──requires──> [IBGE malhas GeoJSON/TopoJSON integration]
    └──requires──> [UF name/sigla recognition parser]

[Intra-state maps: municipalities/mesoregions/health regions]
    └──requires──> [Brazil UF heatmap] (drill-down extends the same map component)
    └──requires──> [Municipality name/code recognition] (harder than UF: 5,570 entries, name collisions)

[DataSUS catalog panel]
    └──requires──> [Existing `trabalhos datasus/` catalog JSON] (data already exists, just needs a UI)
    └──enhances──> [Maps] (catalog can point to variables that ARE the map's territorial keys)
    └──enhances──> [New tests] (catalog can suggest which test fits a variable's type)

[Didactic auto-interpretation]
    └──requires──> [Each individual test's core computation] (interpretation logic is per-test, built alongside, not after)

[Cloud save / accounts] ──conflicts──> [Client-only constraint] (explicitly deferred, do not build this milestone)
[Bulk DataSUS scraping] ──conflicts──> [Client-only constraint + explicit Out of Scope]
```

### Dependency Notes

- **New statistical tests require the paste/upload + validation pattern first:** every new test (chi-square through Kruskal-Wallis) reuses the same tabbed data-entry UX from the redesign phase, so the redesign/base phase is a hard prerequisite, matching the build order already decided in PROJECT.md.
- **Poisson → Negative Binomial is a real dependency, not just a naming pair:** Negative Binomial is Poisson plus an estimated dispersion parameter; sharing the IRLS solver and reusing the overdispersion diagnostic from Poisson meaningfully reduces Negative Binomial's cost. Building NegBin before Poisson would be backwards.
- **Logistic regression can share GLM plumbing with Poisson/NegBin:** all three are exponential-family GLMs solvable with the same iteratively-reweighted least squares machinery — worth architecting as one shared "GLM engine" rather than three bespoke implementations, even though they're presented as separate tabs.
- **Meta-analysis needs a different data-entry shape than every other test:** existing tests take raw paired/grouped observations; meta-analysis takes per-study effect sizes + variances (or raw 2×2/means+SDs to derive them). This is a new input UI, which is part of why PROJECT.md correctly orders meta-analysis last — it cannot simply reuse the paste-box built for the classic tests without an adapter.
- **Intra-state maps depend on the UF map, and on a harder recognition problem:** municipality name matching has to disambiguate same-named cities across different states, unlike the 27-item UF lookup which is a trivial dictionary. This is the single highest-complexity item in the Maps category and should be estimated accordingly (HIGH, not MEDIUM).
- **DataSUS catalog panel enhances but does not block other categories:** because the underlying data is already extracted (`trabalhos datasus/GUIA_MAPEAMENTO_DADOS_DISPONIVEIS.md` + `build/catalogos/*.json`), it can be built in parallel with maps or tests rather than strictly after them — the PROJECT.md build order (maps → painel DataSUS) is about UX narrative sequencing, not a hard technical dependency.
- **Didactic interpretation is not a separate late-stage layer:** because JASP itself does not provide plain-language interpretation, this differentiator has to be designed test-by-test as each test ships, not bolted on afterward — treat "escreva a interpretação" as part of each test's definition-of-done, not a follow-up task.

## MVP Definition

### Launch With (v1 of this milestone)

Minimum to deliver the promised v2.0 scope without regressing the existing didactic value.

- [ ] Redesigned dark+green tabbed shell (data entry → config → results) — replaces v1.0 UI, is the container for everything else
- [ ] t-Student, Pearson/Spearman, Prais-Winsten migrated into new shell with parity output — protects existing validated value
- [ ] Chi-square (independence + effect size) — explicitly named as the most-requested missing test from the current capacitação
- [ ] ANOVA + Kruskal-Wallis with post-hoc — incomplete without post-hoc, so both must ship together
- [ ] Poisson + Negative Binomial (paired, sharing solver) — ship together since NegBin depends on Poisson's infrastructure
- [ ] Logistic regression with OR/CI reporting
- [ ] Brazil UF choropleth with name/sigla recognition
- [ ] DataSUS/public-source catalog panel (browse + links) — low cost, data already exists
- [ ] Per-test plain-language interpretation — core differentiator, must not be deferred
- [ ] In-memory shared dataset state across tabs + "your work will be lost on refresh" warning

### Add After Core Validation (within same milestone, later build order)

Per PROJECT.md's own build order — these are still v2.0 scope, just sequenced after the above is solid.

- [ ] Intra-state drill-down maps (municípios, mesorregiões, regiões de saúde) — builds on the UF map component
- [ ] Meta-analysis: fixed/random effects + forest plot + I² + funnel plot + basic asymmetry (Egger's) — correctly last per PROJECT.md, needs its own data-entry adapter

### Future Consideration (v3+, explicitly out of scope now)

- [ ] "Which test should I use?" guided decision-tree wizard — high teaching value but not required to hit v2.0 scope; strong candidate for the very next milestone
- [ ] "Compare tests" side-by-side mode on the same dataset
- [ ] LocalStorage/IndexedDB persistence across browser sessions (still client-only, no backend) — distinct from the explicitly-deferred cloud accounts
- [ ] Bayesian meta-analysis module
- [ ] Full publication-bias suite (trim-and-fill, PET-PEESE, fail-safe N)
- [ ] Census-tract-level maps
- [ ] Bulk DataSUS data collection tooling

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Redesign shell (dark/green, tabs) | HIGH | MEDIUM | P1 |
| Migrate t-test/correlation/Prais-Winsten | HIGH | LOW-MEDIUM | P1 |
| Chi-square | HIGH | MEDIUM | P1 |
| ANOVA + post-hoc | HIGH | MEDIUM-HIGH | P1 |
| Kruskal-Wallis + post-hoc | MEDIUM-HIGH | MEDIUM | P1 |
| Poisson regression | HIGH | MEDIUM-HIGH | P1 |
| Negative Binomial | MEDIUM-HIGH | HIGH | P1 |
| Logistic regression | HIGH | MEDIUM-HIGH | P1 |
| Didactic interpretation per test | HIGH | MEDIUM-HIGH | P1 |
| Shared in-memory state + refresh warning | HIGH | MEDIUM | P1 |
| UF choropleth map | HIGH | MEDIUM | P1 |
| UF name/sigla recognition | HIGH | MEDIUM | P1 |
| DataSUS catalog panel (browse/links) | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Intra-state maps (municípios etc.) | MEDIUM-HIGH | HIGH | P2 |
| Municipality name/code recognition | MEDIUM-HIGH | HIGH | P2 |
| Meta-analysis (fixed/random + forest + I²) | HIGH | HIGH | P2 |
| Funnel plot + Egger's asymmetry | MEDIUM | MEDIUM-HIGH | P2 |
| "Which test?" guided wizard | HIGH | MEDIUM | P3 |
| "Compare tests" mode | MEDIUM | LOW-MEDIUM | P3 |
| LocalStorage session persistence | MEDIUM | LOW-MEDIUM | P3 |
| Bayesian meta-analysis | LOW (for this audience) | HIGH | P3 (anti-feature this milestone) |
| Full publication-bias suite | LOW (for this audience) | HIGH | P3 (anti-feature this milestone) |

**Priority key:**
- P1: Must have for v2.0 launch (matches PROJECT.md Active requirements)
- P2: Should have, correctly sequenced last per PROJECT.md's own build order (maps depth, meta-analysis)
- P3: Nice to have, defer to next milestone or explicit anti-feature

## Competitor Feature Analysis

"Competitors" here are the reference tools students/instructors implicitly compare against: JASP (explicit oracle), generic online calculators (e.g., Social Science Statistics, VassarStats), and R/Shiny meta-analysis apps found in research (Meta-Mar, PrognosisMeta).

| Feature | JASP (oracle) | Generic online calculators | Our Approach |
|---------|----------------|------------------------------|--------------|
| Chi-square/ANOVA/logistic output | Full tables (F, df, p, effect size, post-hoc) but numbers-only, no plain-language guidance | Often just a p-value, no effect size, no post-hoc | Match JASP's statistical completeness (df, effect size, post-hoc where relevant) AND add plain-language interpretation neither JASP nor calculators provide |
| Poisson/NegBin/Logistic (GLM) | Available under Regression/Generalised Linear Model, dense parameter panels | Rarely offered together; usually one-off single-purpose calculators | Ship all three as guided, pre-configured modules (no generic "choose your link function" UI) |
| Meta-analysis | Full frequentist + Bayesian module (via metafor-equivalent), many heterogeneity estimators, full publication-bias suite | Rare; when present (Meta-Mar, PrognosisMeta) it's R-backed or very large (29k LOC) apps aimed at researchers, not students | Scoped-down subset (DL random-effects, forest, I², funnel, Egger's) matching a first classroom exposure, not a research-grade tool |
| Maps | No native Brazil geo/choropleth feature | Not offered by generic stats calculators at all | Unique to this tool for this audience — direct integration with IBGE malhas API + DataSUS territorial keys is a real gap-filler, not a "me-too" feature |
| DataSUS variable catalog | Not applicable (JASP is domain-agnostic) | Not offered | Unique; already backed by existing research artifact, low cost to expose as UI |
| UI complexity | Dense, desktop-software-style menus and options panels | Minimal, single-purpose, no guidance | Tabbed, guided, one clear path per test — explicitly NOT cloning JASP's density (per PROJECT.md: JASP is a calculation oracle, not a UI template) |

## Sources

- PROJECT.md (`.planning/PROJECT.md`) — milestone scope, constraints, decisions (primary source of truth for in/out of scope)
- `tests-manifest.json` — confirms exactly 3 existing test modules and their didactic subtitle style to preserve in new tests
- `trabalhos datasus/GUIA_MAPEAMENTO_DADOS_DISPONIVEIS.md` — DataSUS/public source catalog structure, territorial/time/person keys, source matrix (DATASUS/TABNET, CNES, SIH/SUS, OpenDataSUS, SIDRA/IBGE, e-Gestor, ANS, Atlas Brasil, Atlas da Violência, Painel COVID-19) — HIGH confidence, first-party project artifact
- IBGE API de malhas geográficas — https://servicodados.ibge.gov.br/api/docs/malhas?versao=3 — HIGH confidence, official docs; confirms UF/mesorregião/microrregião/município GeoJSON/TopoJSON endpoints with adjustable `resolucao` for browser performance
- Brazil Visible — IBGE Geociências overview — https://brazilvisible.org/docs/apis/dados-geoespaciais/ibge-geociencias/ — MEDIUM confidence (third-party summary), confirms full-resolution municipal GeoJSON can be tens of MB, motivating low-resolution/TopoJSON choice
- `filipemeneses/geojson-brazil`, `carolinabigonha/br-atlas` (GitHub) — MEDIUM confidence, community precedent for pre-built Brazil TopoJSON at multiple resolutions as an alternative/fallback to live IBGE API calls
- JASP official student guide, "Statistical Analysis in JASP: A Guide for Students" (2025) — https://jasp-stats.org/wp-content/uploads/2025/07/Statistical-Analysis-in-JASP-A-guide-for-students-2025.pdf — HIGH confidence, official JASP resource; source for chi-square (Phi/Cramér's V, expected-count assumption), ANOVA (F, post-hoc, η²/ω²), logistic regression (odds ratio interpretation) conventions
- "Running and Interpreting a Chi-Square Test in JASP" / "...One-Way ANOVA in JASP" (utc.pressbooks.pub step-by-step guides) — MEDIUM-HIGH confidence, cross-verifies JASP output-reporting conventions with concrete worked examples
- OHNLP/Meta.js, mahmood726-cyber/prognostic-meta, mirzafarangi/meta-mar (GitHub) — MEDIUM confidence, precedent that client-side/browser-based meta-analysis (fixed/random effects, I², funnel, Egger's) is implementable in pure JS at teaching scale, with the caveat (from PrognosisMeta's own documentation) that pure client-side computation has memory limits around very large study counts (500+) — not a concern at classroom scale
- jwildfire/forest-plot (GitHub) — LOW-MEDIUM confidence, example of a dedicated JS forest-plot rendering library/pattern (d3-based), useful as an implementation reference rather than a required dependency

---
*Feature research for: Educational biostatistics web app (Bioestatística LACIR v2.0)*
*Researched: 2026-07-25*
