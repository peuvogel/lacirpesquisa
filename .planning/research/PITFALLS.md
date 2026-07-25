# Pitfalls Research

**Domain:** Educational client-only biostatistics React rewrite (GLM, maps, DataSUS catalog, meta-analysis)
**Researched:** 2026-07-25
**Confidence:** HIGH (grounded in STACK/FEATURES/ARCHITECTURE + known IBGE/DataSUS/JASP traps)

## Critical Pitfalls

### Pitfall 1: GLM math that "runs" but disagrees with JASP/R

**What goes wrong:**
Logistic / Poisson / Negative Binomial produce coefficients and p-values that look plausible but fail oracle checks against JASP/`glm`/`MASS::glm.nb`. Students trust wrong numbers in class.

**Why it happens:**
No mature browser package covers all three families. Hand-rolled IRLS can diverge on link functions, starting values, θ estimation for NB, or Wald vs LR tests.

**How to avoid:**
- Build one internal `glm` module on `ml-matrix` + `jstat`
- Golden-file unit tests against known JASP/R outputs for each family (small fixtures)
- Ship Poisson + overdispersion diagnostic before Negative Binomial
- Report OR = exp(β) for logistic, not raw log-odds

**Warning signs:**
- Results change with tiny data-order changes
- NB θ stuck at extreme values
- No fixture tests in CI

**Phase to address:**
New statistical tests phase (after migrate); spike early in redesign if possible.

---

### Pitfall 2: IBGE codes and territory matching silently wrong

**What goes wrong:**
Heatmaps paint the wrong município/UF because of 6 vs 7 digit `codmun`, accent/case mismatches, or duplicate city names across states. Map looks fine, science is wrong.

**Why it happens:**
DataSUS mixes UF names/siglas; IBGE uses 7-digit codes while many TABNET dumps use 6; municipality names collide across UFs.

**How to avoid:**
- Canonical resolver: normalize NFC, strip accents, uppercase; map sigla↔nome↔código IBGE
- Always require UF context when matching município by name
- Prefer `codmun` when present; document 6→7 digit padding rule
- Bundle static TopoJSON + lookup tables at build time (no runtime IBGE fetch in class)

**Warning signs:**
- "São Paulo" matches SP city when data is from another UF
- Unmatched rows silently dropped without a report

**Phase to address:**
Maps phase; resolver shared module must land with first UF map.

---

### Pitfall 3: GeoJSON payload kills classroom machines

**What goes wrong:**
Full municipal meshes are multi‑MB; browser freezes on lab PCs / flaky wifi when fetching IBGE at runtime.

**Why it happens:**
Temptation to call IBGE Malhas API live for "always fresh" maps; skipping simplification.

**How to avoid:**
- Pre-simplify with `mapshaper` at build time; commit TopoJSON under `src/assets/geo/`
- Separate files: UF / mesorregião / município-por-UF / região-de-saúde
- Cap resolution; never setor censitário this milestone
- Lazy-load state meshes only after UF click

**Warning signs:**
- Initial load >3s on mid-tier laptop
- Network tab shows IBGE calls during demo

**Phase to address:**
Maps phase (asset pipeline in redesign/base if convenient).

---

### Pitfall 4: Rewrite loses didactic flow and existing engines

**What goes wrong:**
React shell ships pretty UI but paste/parse, DataSUS wizard, and Chart.js export regress. Capacitação breaks mid-semester.

**Why it happens:**
Treating v1 as throwaway instead of re-platforming. Ignoring `tabular-data-input.js`, `datasus-*`, and `Stats` already in `app.js`.

**How to avoid:**
- Port parsers/stats as pure modules first; UI second
- Migration phase = parity checklist vs v1 for t-Student / correlação / Prais-Winsten
- Shared tabbed flow: Dados → Configurar → Resultados for every test
- Interpretation PT-BR is part of each test's DoD

**Warning signs:**
- New paste box only accepts comma decimals (breaks TABNET `;` + decimal comma)
- PNG download missing after rewrite

**Phase to address:**
Redesign/base + migrate existing tests.

---

### Pitfall 5: Scope creep into "mini-JASP"

**What goes wrong:**
Bayesian modules, full diagnostics, trim-and-fill, animated maps, bulk DataSUS scrape — milestone never finishes; UI becomes dense and undidactic.

**Why it happens:**
JASP is the oracle; teams copy features instead of outputs/conventions.

**How to avoid:**
- Oracle = numeric outputs & reporting conventions, not QML UI
- Explicit anti-features from FEATURES.md stay out of scope
- Meta-analysis last and capped: DL + forest + I² + funnel + Egger only
- Catalog = browse + link, never scrape

**Warning signs:**
- PRs adding "while we're here" diagnostics panels
- Discussions about MCMC / zero-inflated models

**Phase to address:**
All phases; enforce at requirements + plan gates.

---

### Pitfall 6: Didactic misinterpretation baked into copy

**What goes wrong:**
Auto-interpretation says "p<0.05 proves association" or recommends the wrong follow-up test; students learn bad habits.

**Why it happens:**
Template text written by developers without statistical review; threshold logic too absolute.

**How to avoid:**
- Templates: significant/non-significant + effect-size band + "não prova causalidade"
- Assumption nudges (expected counts, overdispersion) before interpretation
- Language reviewed against capacitação teaching notes
- Never claim "prova" / "confirma hipótese" from a single p-value

**Warning signs:**
- Copy uses "prova", "certeza", "causal"
- No mention of assumptions when they fail

**Phase to address:**
Each test phase as DoD; spot-check in verify.

---

### Pitfall 7: Accidental backend / paid API dependency

**What goes wrong:**
Map tiles, geocoding, or LLM interpretation APIs creep in; classroom offline mode dies; keys leak in frontend.

**Why it happens:**
"API de mapa" misread as needing a server; shadcn map examples use Mapbox.

**How to avoid:**
- Choropleth via bundled TopoJSON + Chart.js geo (or SVG), not Mapbox/Google
- No secrets in client; no auth libs this milestone
- Catalog links are outbound HTTPS only

**Warning signs:**
- `VITE_*_TOKEN` in `.env` for maps
- Network calls to commercial tile servers

**Phase to address:**
Redesign/base (stack lock) + Maps.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep Chart.js + add Recharts/D3 | Faster one-off forest plot | Two theming systems | Never this milestone |
| Runtime IBGE fetch | Smaller repo | Flaky demos | Only if offline asset pipeline blocked |
| Skip post-hoc for ANOVA/KW | Ships faster | Incomplete teaching answer | Never — pair with Tukey/Dunn |
| Persist to localStorage "just in case" | Survives refresh | Contradicts explicit "refresh perde" + privacy | Only if product decision changes |
| Copy purple Tailwind scaffold | Faster CSS | Wrong brand | Delete; start dark+green tokens |

## Integration Pitfalls

| Pitfall | When It Bites | Prevention |
|---------|---------------|------------|
| Per-test local state wipes shared dataset | Switching tabs mid-exercise | Session Context/Zustand without persistence |
| Meta-analysis reuses raw paste UI | Wrong input shape (need effect+SE) | Separate study-level input; build last |
| Catalog dumps raw scraper JSON | Unusable UI | Curate one `catalog.json` with types + links |
| cult-ui / Framer Motion vs dark tokens | Visual noise, purple leftovers | Token-first theme; few cult accents only |
| Dynamic `import()` of test folders | Vite/React structure fight | Static registry of components |

## Performance Pitfalls

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Full Brazil município mesh in one file | Main-thread jank | Per-UF lazy TopoJSON |
| Recomputing GLM on every keystroke | UI lag | Debounce / Run button |
| Huge pasted TABNET tables | Parser freeze | Row cap + progressive preview + clear error |

## UX Pitfalls (didactic)

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Dense results tables like SPSS | Students ignore interpretation | Lead with brief PT interpretation, then stats |
| Hidden refresh-loss | Mid-class data loss panic | Persistent banner + `beforeunload` |
| Test picker absent | Wrong test chosen | Optional decision-tree wizard (differentiator) |
| Silent row drops on map join | Wrong heatmap | Show match report: matched / unmatched counts |

## Research Gaps

| Gap | What We Know | What We Don't | Approach |
|-----|--------------|---------------|----------|
| Exact região-de-saúde dissolve license | Municipal mesh from IBGE OK | Best redistribution of crosswalk | Prefer dissolve-at-build from public DTB; verify before bundling |
| `@tangent.to/ds` GLM quality | Exists for binomial/poisson | Match vs JASP | Spike; fallback custom IRLS |
| Classroom browser floor | Likely modern Chrome | Lab PC age | Assume Tailwind v4; smoke-test Safari |

## Pitfall-to-Phase Map

| Phase (build order) | Pitfalls to prevent |
|---------------------|---------------------|
| Redesign/base | #4, #5, #7 — stack lock, brand tokens, no Mapbox/auth |
| Migrate existing tests | #4, #6 — parity + interpretation DoD |
| New statistical tests | #1, #5, #6 — GLM fixtures, no mini-JASP |
| Maps | #2, #3, #7 — resolver, static TopoJSON |
| DataSUS catalog | #5 — browse/link only, curated JSON |
| Meta-analysis (last) | #5 — DL/forest/I²/funnel/Egger only |

---
*Research completed: 2026-07-25 (inline completion after parallel agent interrupt)*
*Confidence: HIGH*
