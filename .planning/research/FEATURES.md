# Feature Research

**Domain:** Dynamic, database-backed geographic research/exploration surface — Mapas module, v3.0 "dados confiáveis + pesquisa dinâmica via Supabase"
**Researched:** 2026-07-28
**Confidence:** MEDIUM-HIGH (cartographic null-vs-zero convention verified against multiple independent cartography sources + direct inspection of this repo's current rendering code, where a live bug was found; provenance findings verified against a peer-reviewed study of 12 Brazilian public-health dashboards including DATASUS's own; search/selection-at-scale and comparison patterns are MEDIUM confidence, cross-referenced against 2-3 sources each; TabNet's own internal null/zero convention is inferred from this project's own pipeline documentation, not an official DataSUS spec — flagged LOW where stated as such)

**Scope note:** This document supersedes the Mapas-relevant rows of the v2.0-era `FEATURES.md` (dated 2026-07-25, whole-product scope). It is scoped narrowly to what v3.0 *adds* to Mapas — making the choropleth genuinely dynamic over Supabase — per the milestone brief. Estatística, Variáveis, and the already-shipped map mechanics (UF choropleth, drill-down, grouping, presets, territory paste) are **not** re-researched; they are cited only as dependencies/reuse targets.

## Feature Landscape

Rows are tagged with **Category** matching the five areas from the research question: `Loading/Empty`, `Search@Scale`, `Progressive Disclosure`, `Provenance`, `Comparison`.

### Table Stakes (A Research Map Is Broken Without These)

| Category | Feature | Why Expected | Complexity | Notes / Dependencies |
|----------|---------|--------------|------------|------------------------|
| Loading/Empty | **Distinct "não coletado" state at the (disease × measure × grain) level** — before touching any per-territory logic, gate the whole choropleth on whether the pipeline ledger says this combination has ever been ingested | This is the exact bug named in the milestone brief: 330 diseases in the picker, 10 with data, and today an unpopulated pick paints an empty map with zero explanation | LOW | Reuses the ledger already scoped in PROJECT.md ("Pipeline de coleta confiável: ledger por agravo × medida × grão"). UI consumer: `MapasPage.tsx` `choroplethValues` memo (currently calls `getMetricByUf`/`getMetricByUfAndYear` from `src/features/catalog/catalogAnalysisData.ts` synchronously against 10 bundled packs) needs a coverage check before attempting a fetch, and `src/components/EmptyState.tsx` (already used for the blank map explore panel) is the right reusable primitive for the resulting banner |
| Loading/Empty | **True zero renders inside the same sequential color ramp as real data — never a separate "missing" color** | Cartographic consensus (Axis Maps' choropleth guide, *storytellingwithdata*, and a widely-cited Splunk community thread literally titled "Choropleth Zero Count Should Always Be Gray" arguing the opposite of confusing zero-with-missing) is unanimous: coloring an area as if its value were known when it is actually absent misleads the reader into believing "no phenomenon" where the truth is "no measurement." For SIH specifically, once a disease×measure×grain is collected, a territory/year with no matching AIH row **is** DataSUS's own true zero (TabNet's SIH extraction never emits an explicit `0` row — absence *is* the zero) | LOW-MEDIUM | Today's bug: `SURFACE_FILL` in `src/routes/mapas/BrazilMapCanvas.tsx` (`'#18181b'`) is the **same literal hex** as `TEAL_STEPS[0]` in `src/geo/choroplethScale.ts` — a UF with no fetched value and a UF at the lowest real bucket are visually identical today. Fix must (a) make "no ledger coverage" and "has coverage but 0 real value" render as genuinely different fills, and (b) make sure a real 0 sits inside the ramp's domain, not excluded from it |
| Loading/Empty | **Legend always shows a distinct swatch for "sem dado coletado," separate from and never confusable with the color ramp's extremes** | Same cartography sources; a legend is meaningless if its darkest "real" bucket and its "no data" bucket share a color | LOW | `src/routes/mapas/ChoroplethLegend.tsx` + `legendBreaks()` in `choroplethScale.ts` need a dedicated "no data" entry independent of `TEAL_STEPS` |
| Loading/Empty | **Loading indicator while a Supabase fetch is in flight, scoped to what's being fetched (not a full-page spinner)** | Data now travels over the network per disease/year/grain instead of being bundled at build time — latency is real for the first time in this app's life | LOW | `MapasPage.tsx`'s `choroplethValues` useMemo is currently 100% synchronous; becoming async needs a loading/error tri-state, not just data. `BrazilMapCanvas.tsx` already has an equivalent pattern for lazy TopoJSON drill geometry (`loadMesoTopo`/`loadMuniTopo` via `src/geo/loadGeoAsset.ts`) — reuse the same lazy-fetch-with-suspense-like affordance for *metrics*, not just *shapes* |
| Loading/Empty | **Honest "sem conexão com os dados" state when Supabase is unreachable or unconfigured** | Already a named PROJECT.md constraint ("Degradação honesta... nunca pintar um mapa vazio como se fosse dado real") | LOW-MEDIUM | `getSupabase()` in `src/lib/supabaseClient.ts` already returns `null` on missing config and is already checked defensively in `fetchHandoffMetrics.ts` (`if (!supabase) return null`) — the live choropleth fetch path needs the same guard, surfaced as UI, not silently swallowed |
| Search@Scale | **Free-text + CID-10 prefix search over all 330 items with live result count** | At 330 categorical options, a flat scrollable list is unusable under classroom time pressure; users need to find "I74" or "embolia" in one or two keystrokes | Already shipped | `src/routes/mapas/MeasureDiseasePicker.tsx` already does this (`diseaseMatches`, `normalizeCidQuery`, "N resultado(s)" counter) — protect, do not regress, when the picker starts driving live data instead of static packs |
| Search@Scale | **Every one of the 330 items is selectable and produces an honest response** (loading, no-data-yet, or real choropleth) — never a dead click | This *is* the milestone's core complaint restated as a UX requirement: the picker already lists all 330 (`src/features/catalog/taxonomy.ts` → `DISEASES`), the map does not yet honor that promise | LOW (once the ledger-gated empty state above exists) | Direct consequence of the Loading/Empty row above; no new selection UI needed, only an honest response to an existing selection |
| Progressive Disclosure | **UF grain loads first and fast; município grain is fetched only on drill-down, never bundled** | 330 diseases × 4 measures × 13 years × ~5,570 municípios is architecturally incompatible with a Vite bundle (already the explicit rationale in `docs/SUPABASE-CATALOG.md`: "Bundling ... exhausts memory") | MEDIUM | Partially built: `fetchHandoffMetricLookup` in `src/features/catalog/fetchHandoffMetrics.ts` already queries `sih_metric_muni` lazily, but only at the review/handoff step — **not** while the user is drilling the live map. `BrazilMapCanvas.tsx`'s `loadDrillPathsBrazilCrs` already lazily fetches município *geometry* on drill; the same lazy pattern must be added for município *metrics*, keyed by disease×UF×year |
| Progressive Disclosure | **A visible "carregando municípios…" state scoped to the drilled UF only** | Prevents the false impression that the whole map is broken while one region's data streams in | LOW-MEDIUM | Same dependency as above; UI container is the existing drill viewport in `BrazilMapCanvas.tsx` |
| Provenance | **Source/table/period/collection-date remains visible for every metric on the choropleth, not only at handoff** | Already a hard v2.0 requirement for the Variáveis catalog (CAT-02, "mandatory provenance"); v3.0 must not regress this once metrics move from a bundled, implicitly-trusted pack to a live, occasionally-partial Supabase table | LOW-MEDIUM | `src/features/catalog/types.ts`'s `CatalogEntry` already models `sourceSystem`, `sourceName`, `tableOrIndicator`, `period`, `officialUrl`, `methodologyNotes` — but disease-level SIH metrics live in `sih_metric_uf`/`sih_metric_muni` (Supabase), which today carry **no** per-row collection timestamp exposed to the UI. This is a genuine new requirement, not a reuse |
| Provenance | **Provenance survives the handoff into Estatística results, not just the review dialog** | Explicit PROJECT.md requirement: "proveniência preservada até o resultado" | MEDIUM | `ReviewAnalysisDialog.tsx`'s `handleConfirm` currently calls `setDataset({ headers, rows, sourceLabel, confirmedAt })` — `sourceLabel` is a single flat string. It must become (or be paired with) a structured provenance descriptor that the results screens can still render after the user has moved off the map entirely |
| Provenance | **"Ver fontes oficiais" links reflect what was actually collected, not a static mock table** | Today's `getCollectionLinks()` (`src/routes/mapas/mockCollectionLinks.ts`) is a hand-authored lookup independent of what the pipeline actually ingested — once data is live from Supabase, a broken/absent link for a populated disease (or vice versa) actively erodes trust | LOW-MEDIUM | Replace/augment `mockCollectionLinks.ts` with data sourced from `sih_disease` (already has `tabnet_code`/`def_path` per `docs/SUPABASE-CATALOG.md`) so the link always matches the actual queried TabNet definition |

### Differentiators (Raise This Above TabNet — and Above Most Brazilian Public-Health Dashboards — For Teaching)

| Category | Feature | Value Proposition | Complexity | Notes / Dependencies |
|----------|---------|--------------------|------------|------------------------|
| Provenance | **A persistent, low-friction "de onde veio esse número?" affordance reachable from anywhere data is shown on the map** (not only a modal at handoff) | A 2022 peer-reviewed study of 12 Brazilian public-health dashboards — including the Ministry of Health's own COVID-19 panel and the SAGE strategic-management dashboards used by real SUS managers — found that **provenance was not an explicit subject in any of them**; Brazil's own official COVID panel showed only "data source, last update, link to source," and SAGE dashboards in places showed *nothing at all*, with interviewed health managers describing the data as "fragmented," "not informing the origin," and "unreliable" as a direct result. This is the "Oh, yeah?" button Tim Berners-Lee proposed in 1997 for exactly this trust problem. LACIR already clears the Brazilian public-sector bar in Variáveis (Phase 5); extending an always-available provenance affordance to the live map is a genuine, citable differentiator, not table stakes elsewhere | MEDIUM | Builds on the `ReviewAnalysisDialog.tsx` "Ver fontes oficiais" `Collapsible` pattern — the differentiator is making an equivalent affordance reachable while exploring the map itself (e.g., from the legend or a territory tooltip), not only at the review gate |
| Comparison | **Period-compare view rendered on the choropleth itself (períodoA × períodoB), not only in the assembled statistics table** | The data model already supports this (`mode: 'compare'` with `periodA`/`periodB` in `GroupTimeConfig`, `src/routes/mapas/mapAnalysisState.ts`; `SharedPeriodPanel.tsx` even ships the exact example "Bahia pré × pós pandemia") but the map itself never shows it — `MapasPage.tsx`'s `choroplethValues` memo only branches on `point`/`range` and silently falls back to a single year for `compare` mode. Wiring a before/after toggle or a two-map side-by-side (small multiples) view is pure UI + fetch work over an already-built data shape | MEDIUM-HIGH | No new state shape required — this is the single highest-leverage differentiator in this list because the hard part (modeling two comparable periods) is already done and unused on the map surface |
| Comparison | **Small multiples for multi-disease / multi-period comparison** (2-4 mini choropleths side by side sharing one legend scale) | Cartography research on epidemiological dashboards found small multiples outperform animated/single-map toggling for comparing propagation across conditions or time — readers can align regions visually across panels, which a single map re-painted on toggle cannot offer | MEDIUM-HIGH | Reuses `BrazilMapCanvas` and `ChoroplethLegend` as repeatable child components (shared scale domain across panels) rather than a new map engine; multi-disease selection already exists (`SharedDiseasePanel`, `TOGGLE_DISEASE_ALL_GROUPS`) but today only feeds `activeGroup.variableIds[0]` to a single map |
| Comparison | **Group-vs-group comparison fed by live data** (Norte × Nordeste, or two custom UF groups, painted with their own colors and each backed by a real fetched value) | Group membership and coloring already paint on the map today (`groupColor`, `GroupBar`/regional presets from Phase 4) — the only new work is that the underlying metric per group becomes a live Supabase aggregate instead of a static pack lookup | LOW-MEDIUM | Directly reuses Phase 4 grouping UI; the differentiator is closing the loop between "grouped territories" and "a live number for that group," which today only resolves correctly for the 10 packed diseases |
| Comparison | **Small-denominator / rate-instability advisory** when a município with very few internações is compared against a much larger one, or when a rate (taxa de mortalidade, taxa de internação) is computed on a tiny base | Didactic correctness: a 1-in-3 "mortality rate" in a tiny município is not comparable to a 400-in-40000 rate in a large one, and a naive choropleth of rates will visually overweight small, volatile municípios exactly the way US public-health agencies warn about (CDC WONDER and state DOH "small numbers" guidance flag instability, though for privacy-suppression reasons that do not apply to already-public SIH aggregates here) | LOW-MEDIUM | Reuses the existing `AssumptionNudgeStrip` pattern already shipped for the statistical tests (`src/features/tests/shared/AssumptionNudgeStrip.tsx`) — same component family, new trigger condition (denominator below a threshold) |
| Search@Scale | **Curated "mais usadas pela LACIR" shortlist pinned above the full 330-item list** | The 10 diseases already fully collected today (embolia/trombose, amputação MMII, AIT, aneurisma de aorta, AVC, doenças de artérias, embolia pulmonar, flebites/tromboflebites, outras doenças vasculares, varizes MMII — LACIR's actual vascular-surgery teaching focus) are a ready-made curated favorites list requiring zero new authoring; pin them as quick-access chips regardless of overall collection status, independent from generic "recently used" | LOW | Already implicitly encoded as `VARIABLE_ID_ALIASES` and `getDefaultCatalogVariableId()`'s embolia_trombose preference in `catalogAnalysisData.ts` — promote from an implicit default to an explicit, visible shortcut row in `MeasureDiseasePicker.tsx` |
| Search@Scale | **Session-scoped "usados recentemente" list** (last N diseases picked, in-memory only) | Speeds up repeat exploration within one class session without requiring accounts (explicitly out of scope this milestone) | LOW | Pure client state, no persistence needed; add alongside the existing `query` state in `MeasureDiseasePicker.tsx` |
| Search@Scale | **Grouping by CID-10 chapter for browsing (not just searching)** | Search only helps when the student already knows the name/code; browsing "o que existe em doenças do aparelho circulatório?" needs a chapter-level grouping the flat 330-item list doesn't offer today | MEDIUM | Requires a new chapter-code field on `DiseaseDef` (`src/features/catalog/taxonomy.ts`) — not currently present. Note: the closely related "apelidos clínicos" (clinical aliases, e.g. "AVC" → infarto cerebral + AVC não especificado) is **already committed scope in the taxonomy phase of this same milestone**, not new scope proposed here — the map's picker only needs to *consume* aliases once the taxonomy phase ships them (treat as an inherited table-stakes dependency, not a fresh differentiator to design) |
| Progressive Disclosure | **In-session cache so re-drilling the same UF/disease/year doesn't refetch** | Classroom exploration is repetitive (students zoom in/out of the same state multiple times); avoiding redundant Supabase round-trips is both a cost and a responsiveness win | MEDIUM | New in-memory cache keyed by disease×UF×year in `MapasPage.tsx`/session state; independent of the existing lazy TopoJSON *shape* cache in `src/geo/loadGeoAsset.ts`, which already caches geometry but not metrics |

### Anti-Features (Commonly Built, Actively Harmful Here)

| Category | Feature | Why Requested | Why Problematic | Alternative |
|----------|---------|----------------|------------------|-------------|
| Loading/Empty | **Coercing an absent/null cell to 0 anywhere in the fetch or render path** | Looks simpler than plumbing a tri-state (loading/no-data/value); a stray `?? 0` is an easy default | Directly recreates the exact ambiguity this milestone exists to fix; the project's own pipeline already learned this lesson the hard way (a DNS failure was logged as "OK · 0 linhas" and the raw cache was deleted before the mistake was caught, per PROJECT.md's diagnosis) | The discipline already exists upstream (`scripts/catalog/parseCsv.mjs`: "Empty cells → null. Never invent numeric values"; `catalogAnalysisData.ts`: "never coerce null→0") — extend the same rule through the new Supabase fetch layer without exception |
| Loading/Empty | **Data suppression for small counts** (à la CDC WONDER's confidentiality rule of suppressing death/case counts under 10) | Looks like responsible practice, borrowed from US public-health data governance | Wrong import for this context: DataSUS SIH is already published aggregate data with no individual re-identification risk, and TabNet itself does not suppress small counts — hiding real, already-official numbers would make LACIR's map diverge from the very source (TabNet) it exists to teach students to read, and would be a confidentiality theatre with no legal basis in Brazil's SIH | Show the real number; use a visible **advisory** (see small-denominator differentiator above), never a hidden/suppressed cell |
| Loading/Empty | **Silently substituting the "nearest populated disease" when the chosen one has no data yet** | Superficially "solves" the empty-map problem without an explanation screen | Actively misleads a teaching audience: a student who selects "Leishmaniose visceral" and unknowingly gets a populated but unrelated disease's numbers back would draw wrong conclusions and never know the substitution happened — the opposite of the didactic honesty this milestone is named for | Always show an explicit, correctly-labeled empty/pending state; never auto-substitute |
| Progressive Disclosure/Runtime | **Live scraping of TabNet at request time to backfill a missing disease "on demand" during class** | Seems to close the "330 in picker, only some collected" gap immediately, without waiting for an offline pipeline run | Explicitly out of scope (PROJECT.md: "Scraping runtime ao vivo do TABNET durante a aula (ToS/instabilidade)... o app lê o Supabase, nunca o TabNet"); reintroduces exactly the fragile, silently-failing collection path the new pipeline (ledger, retry, noisy failure) is being built to replace | Offline pipeline collects ahead of time; the live app is read-only against Supabase, always |
| Search@Scale | **Virtualized infinite-scroll of all 330 items as the primary discovery mechanism, with no search or grouping** | Common generic solution to "long list" performance, cheap to bolt on (react-window et al.) | Solves rendering cost, not findability — a virtualized flat list of 330 categorical Portuguese medical terms is still a needle-in-haystack for a time-pressed student; the actual bottleneck here is search relevance, not DOM node count (330 rows renders fine unvirtualized in practice) | Keep/extend the existing text+CID search (`MeasureDiseasePicker.tsx`) plus lightweight chapter grouping and curated shortcuts; virtualize only if profiling later shows an actual render-cost problem |
| Search@Scale | **Expanding fuzzy/semantic search to the full official CID-10 code space** (tens of thousands of subcodes) rather than TabNet's own ~330-item Lista Morb grouping | Feels like "more complete" coverage of the classification system | Out of scope creep: the milestone caps the map at the 330 Lista Morb categories (the same grouping TabNet itself uses for this exact report), not raw ICD-10; building search machinery for a 100x larger, differently-shaped taxonomy adds real complexity for a classification granularity DataSUS's own SIH report never surfaces | Keep search scoped to `DISEASES` (Lista Morb, 330 entries) exactly as already modeled in `src/features/catalog/taxonomy.ts` |
| Comparison | **Real-time collaborative map** (multiple students' cursors/selections synced live via WebSockets) | Trendy pattern in modern collaborative tools, and Supabase does offer realtime channels, so it is "just sitting there" | No accounts/backend-write exist in this milestone by explicit constraint ("Login, contas de usuário... próximo ciclo"; "App somente-leitura no Supabase"); a realtime multi-cursor layer would require write access and identity this milestone deliberately defers | Single-user-per-browser-session exploration, exactly as today; revisit only alongside accounts in a future milestone |
| Provenance | **A generic W3C-PROV-style provenance graph/diagram** (entities/activities/agents node-link diagram) shown to end users | Academically "correct" full provenance modeling (the PROV-O ontology explicitly recommended in provenance-visualization literature) | Designed for provenance researchers/specialists, not lay users — the same literature that documents the SUS provenance gap explicitly warns that full graph-based provenance visualizations overwhelm lay audiences and require "provenance visualization literacy" most dashboard users don't have | A flat, plain-Portuguese "fonte · tabela · período · coletado em · link oficial" strip (already the Variáveis catalog's pattern) is the right level of exposure for medical students, not a graph |

## Null vs. Zero on the Choropleth — Concrete Recommendation

This is the single most consequential design decision in this research and deserves its own worked-out answer, not just a table row.

**The bug today:** `src/routes/mapas/BrazilMapCanvas.tsx` paints any UF absent from `choroplethValues` with `SURFACE_FILL = '#18181b'`. `src/geo/choroplethScale.ts`'s `TEAL_STEPS[0]` — the color for the *lowest real bucket of actual data* — is the exact same hex value. A município with genuinely 0 internações and a município nobody has fetched data for yet are, today, pixel-identical.

**Why this matters more than usual here:** this is not abstract missing-data hygiene. The milestone's own diagnosis of the current pipeline failure ("falha ruidosa registrou `OK <agravo>: 0 UF rows · 0 muni rows` como sucesso") is the *exact same ambiguity* one layer down the stack — a silent "0" was indistinguishable from a real answer at ingestion time, and the same silent "0" is indistinguishable from a real answer at render time. Both must be fixed with the same discipline: never let an absence look like a value.

**Recommended three-state model, specific to how SIH/TabNet actually behaves:**

1. **Combination not yet collected** (ledger has no row for this disease × measure × grain) → this is a *coarse, whole-combination* state, not a per-territory one. Render the entire choropleth in a muted/disabled treatment (not part of the `TEAL_STEPS` ramp at all — e.g., a flat warm gray or hatch pattern with no gradation) with an explicit banner ("Ainda não coletamos [medida] para [agravo]") and, ideally, a suggestion toward the curated/collected shortlist. This directly matches the exact "330 in picker, 10 populated" scenario named in the brief and requires no per-UF logic — the ledger already knows the answer before any Supabase query is even attempted.
2. **Combination collected, territory/year has a matching row with value 0** → this is DataSUS's own true zero (TabNet's SIH export never emits an explicit `0` cell — the *absence of a row for that combination* is how TabNet itself represents "no AIH matched," which for a measure like internações genuinely means zero). Render it *inside* the same sequential teal ramp as every other real value, at the ramp's low end. Do not gray it out — doing so would be the cartographic error the sources below warn against (treating a known zero as if it were unknown).
3. **Combination collected overall, but ingestion demonstrably failed/is incomplete for one specific grain or territory** (a per-grain ledger failure, e.g. município rows for one UF never uploaded even though UF-level rows succeeded) → this is the genuine "missing" case, and it is rare and ledger-detectable, not something the UI should infer from row-absence alone. Render with the same distinct gray/hatch treatment as case 1, scoped to just the affected territory, with a tooltip naming the gap ("falha de coleta neste município — não é zero real").

**Legend requirement:** the legend (`ChoroplethLegend.tsx`) must always render the "não coletado" swatch as a separate, fixed entry outside the sequential ramp's buckets, so a reader can tell at a glance which grays are "zero on the ramp" (there are none, by design) versus "excluded from the ramp because we don't have it."

This treatment is consistent with, and cites, the general cartographic guidance found across independent sources (Axis Maps' choropleth guide, *storytellingwithdata*, and community consensus exemplified by a Splunk support thread titled "Choropleth Zero Count Should Always Be Gray") while being sharpened to this project's specific data source: because the *coarse* ledger-level gap (not-yet-collected) is overwhelmingly the real-world failure mode here — not per-cell ambiguity within an already-collected series — the fix is cheaper than generic "handle missing data" advice implies: gate at the combination level first, and only then worry about per-territory nuance.

## Search & Selection Reference Points (Outside This Codebase)

- **IHME GBD Compare** (healthdata.org / vizhub.healthdata.org): lets users filter a large, multi-dimensional space (cause, risk, location, age, sex, year) before rendering any of a dozen chart/map types — the pattern of "pick your dimensions explicitly, then render" rather than showing all charts pre-populated is the same shape as LACIR's territory → doença → período → variável flow already built into `SharedDiseasePanel.tsx`/`SharedPeriodPanel.tsx`. MEDIUM confidence (tool requires registration to inspect fully; described from official/secondary sources, not hands-on use).
- **Clinical code pickers (ICD-10 autocomplete tools, e.g. AAPC Codify, Kipu Health's ICD-10 autocomplete)**: consistently pair instant text/code search with recognized clinical abbreviations/lay terms and a visible distinction between valid/complete and incomplete codes (rendered as different font weight/color) — directly analogous to recognizing "AVC" as a lay/clinical alias for the taxonomy's canonical Lista Morb entries, and to visually distinguishing collected vs. not-yet-collected diseases in the picker. MEDIUM confidence.
- **cmdk-style command-palette pattern** (used by Linear, Raycast; shadcn's `Command` component wraps it): grouped, fuzzy-filterable lists where an entire group hides itself once none of its items match, plus a "recently used" section pinned above search results — a reusable interaction pattern for the CID-chapter-grouping and recently-used differentiators above, and compatible with this project's existing shadcn/cult-ui component strategy (PROJECT.md: "Componentes: shadcn MCP + registry cult-ui"). HIGH confidence for the interaction pattern itself (well-documented, widely deployed); MEDIUM for its direct applicability without adaptation to this app's checkbox-multi-select picker shape (cmdk is normally single-select-and-close, whereas `MeasureDiseasePicker` needs persistent multi-select checkboxes).

## Feature Dependencies

```
[Pipeline ledger: disease × measure × grain coverage status]
    └──requires──> [Pipeline confiável phase] (PROJECT.md build order: precedes "mapas dinâmicos")
    └──enables──> [Ledger-gated whole-map empty state] (Loading/Empty table stakes #1)
    └──enables──> [Curated "mais usadas" shortlist] (can flag which of 330 are actually collected)
    └──enables──> [Provenance: collection date per metric]

[Live Supabase metric fetch (UF grain)]
    └──requires──> [sih_metric_uf table populated] (Coleta completa phase, PROJECT.md build order)
    └──requires──> [getSupabase() client guard] (already exists: src/lib/supabaseClient.ts)
    └──replaces──> [catalogAnalysisData.ts sync pack lookup] (getMetricByUf/getMetricByUfAndYear)
    └──enables──> [Async loading state on choropleth] (Loading/Empty table stakes)

[Live Supabase metric fetch (município grain, on drill)]
    └──requires──> [Live Supabase metric fetch (UF grain)] (same client, same tri-state pattern)
    └──requires──> [sih_metric_muni table populated] (Coleta completa phase)
    └──reuses──> [Lazy TopoJSON drill loader] (BrazilMapCanvas.tsx loadDrillPathsBrazilCrs — geometry-only today)
    └──enables──> [Progressive disclosure of grain] (table stakes)
    └──enables──> [In-session município cache] (differentiator)

[Choropleth null-vs-zero fix]
    └──requires──> [Ledger coverage check] (combination-level gate)
    └──requires──> [Distinct "no data" fill separate from TEAL_STEPS] (fixes SURFACE_FILL === TEAL_STEPS[0] bug)
    └──blocks──> [Any credible comparison feature] (comparing two maps that both silently mis-paint gaps compounds the error)

[Period-compare on the map] (differentiator)
    └──requires──> [GroupTimeConfig 'compare' mode] (already built: mapAnalysisState.ts)
    └──requires──> [Live Supabase metric fetch (UF grain)] (needs two live years, not one)
    └──enhances──> [Small multiples] (shares the same "render N choropleths sharing one legend scale" primitive)

[Small multiples (multi-disease / multi-period)] (differentiator)
    └──requires──> [Live Supabase metric fetch] (each panel needs its own live query)
    └──requires──> [Shared legend-scale-across-panels logic] (new: today's scale is computed per single map)

[Provenance surviving handoff] (table stakes)
    └──requires──> [Structured provenance descriptor] (extends session.setDataset beyond flat sourceLabel)
    └──requires──> [Per-row collection metadata from Supabase] (new: sih_metric_uf/muni today carry no exposed timestamp)

[Clinical aliases in disease picker] (inherited table-stakes dependency, not new map-phase scope)
    └──requires──> [Taxonomia canônica phase] (PROJECT.md: "expor apelidos clínicos curados" — earlier in build order)
    └──enhances──> [Search@Scale] (MeasureDiseasePicker.tsx consumes, does not produce, aliases)

[CID-10 chapter grouping] (differentiator)
    └──requires──> [New chapter field on DiseaseDef] (taxonomy.ts — not present today, separate from aliases work)

[Small-denominator advisory] (differentiator)
    └──reuses──> [AssumptionNudgeStrip component] (src/features/tests/shared/AssumptionNudgeStrip.tsx)

[Live TabNet scraping during class] ──conflicts──> [Read-only Supabase constraint + explicit Out of Scope]
[Data suppression of small counts] ──conflicts──> [Didactic honesty goal + SIH's own public/aggregate nature]
[Realtime multi-user collaboration] ──conflicts──> [No accounts/no write access this milestone]
```

### Dependency Notes

- **The ledger is the true root dependency for almost every Loading/Empty and several Provenance features.** Without a disease × measure × grain coverage record, the UI cannot tell "not collected yet" from "collected, real zero" from "collected but this one grain failed" — all three require ledger data, not just a Supabase query result. This confirms the PROJECT.md build order (pipeline confiável → coleta completa → mapas dinâmicos) is not just narrative sequencing but a hard technical dependency: building the dynamic map UI before the ledger exists would force exactly the guessing behavior this research recommends against.
- **Município-grain live fetching is architecturally a twin of a pattern that already exists for geometry, not a new pattern.** `BrazilMapCanvas.tsx` already lazily fetches TopoJSON shapes on drill-down (`loadMesoTopo`/`loadMuniTopo`). The work for v3.0 is adding an equivalent lazy fetch for *metrics*, keyed the same way (disease × UF × year), and ideally sharing the same loading-state UI treatment so drill-down feels like one coherent lazy-load, not two independently-loading subsystems.
- **Comparison features (period-compare, small multiples) are gated behind fixing null-vs-zero first**, not the other way around: comparing two maps or several disease panels multiplies the visual damage of a rendering bug that already conflates "no data" with "lowest real value" in a single map. Sequence the fix before building comparison UI on top of it.
- **Clinical aliases and CID-10 chapter grouping look like one feature but are two independent dependencies.** Aliases are already committed elsewhere in this same milestone (taxonomy canônica phase) and the map picker only needs to consume them; chapter grouping is a genuinely new, not-yet-scoped taxonomy field. Do not bundle them as a single roadmap item — they have different owners and different current states.
- **Provenance-survives-handoff cannot be solved purely in Mapas/`ReviewAnalysisDialog.tsx`.** It requires the Supabase schema itself to expose a collection timestamp per row (or per ingestion batch), which is a pipeline/schema concern (`sih_metric_uf`/`sih_metric_muni` today have no such column per `docs/SUPABASE-CATALOG.md`'s target schema). Flag this as a cross-cutting dependency between the pipeline phase and the "fluxo pesquisa → estatística" phase in PROJECT.md's build order.

## MVP Definition

### Launch With (the "mapas dinâmicos" phase itself)

The minimum that turns today's 10-pack map into an honest 330-disease dynamic surface, per the milestone's own stated goal.

- [ ] Ledger-gated whole-map "não coletado" state for any disease × measure × grain combination without data — closes the exact bug named in the brief
- [ ] Live UF-grain Supabase fetch replacing the 10 bundled packs, with a loading tri-state (loading / no-data / value)
- [ ] Null-vs-zero fix: distinct, non-ramp fill + dedicated legend swatch for "sem dado coletado," never colliding with `TEAL_STEPS`
- [ ] Live município-grain fetch on drill-down (not bundled), reusing the existing lazy-TopoJSON pattern for metrics
- [ ] Loading indicator scoped to the drilled region during município fetch
- [ ] Provenance (source/table/period/collection status) visible per selected metric on the map, and preserved through the handoff into Estatística results

### Add After Core Validation (same milestone, once the above is solid)

- [ ] Period-compare rendered on the choropleth itself (reuses the already-built `compare` time mode)
- [ ] Group-vs-group live comparison (reuses Phase 4 grouping UI with a live metric source)
- [ ] Curated "mais usadas pela LACIR" shortlist pinned in the disease picker
- [ ] Session-scoped recently-used list in the disease picker
- [ ] Small-denominator / rate-instability advisory (reuses `AssumptionNudgeStrip`)
- [ ] In-session cache for repeated município drill-downs

### Future Consideration (explicitly deferred)

- [ ] Small multiples for multi-disease/multi-period side-by-side comparison — valuable but architecturally the most expensive item here (shared legend scale across N panels); revisit once single-map live fetching is solid
- [ ] CID-10 chapter grouping for browsing — needs a new taxonomy field not yet scoped
- [ ] A persistent "Oh, yeah?"-style provenance affordance reachable from every map surface, not only the review dialog — a genuine differentiator, but can follow once basic per-metric provenance display (table stakes) exists
- [ ] Cross-session favorites — would require accounts/localStorage persistence, explicitly out of scope this milestone

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Ledger-gated "não coletado" whole-map state | HIGH | LOW | P1 |
| Live UF-grain fetch replacing bundled packs | HIGH | MEDIUM | P1 |
| Null-vs-zero choropleth fill/legend fix | HIGH | LOW-MEDIUM | P1 |
| Live município-grain fetch on drill | HIGH | MEDIUM | P1 |
| Loading states (map + drill scoped) | HIGH | LOW-MEDIUM | P1 |
| Provenance visible per metric + preserved to results | HIGH | MEDIUM | P1 |
| Period-compare on choropleth | MEDIUM-HIGH | MEDIUM-HIGH | P2 |
| Group-vs-group live comparison | MEDIUM | LOW-MEDIUM | P2 |
| Curated "mais usadas" shortlist | MEDIUM | LOW | P2 |
| Recently-used (session) | LOW-MEDIUM | LOW | P2 |
| Small-denominator advisory | MEDIUM | LOW-MEDIUM | P2 |
| In-session município cache | MEDIUM | MEDIUM | P2 |
| Small multiples comparison | MEDIUM | HIGH | P3 |
| CID-10 chapter grouping | LOW-MEDIUM | MEDIUM | P3 |
| Persistent "Oh, yeah?" provenance affordance | MEDIUM | MEDIUM | P3 |
| Cross-session favorites/accounts | LOW (this milestone) | HIGH | P3 (anti-feature this milestone — needs accounts) |

**Priority key:**
- P1: Must have — directly closes the milestone's named defect ("mapa não dinâmico") and its constraints (degradação honesta, proveniência preservada)
- P2: Should have — clear differentiators reusing already-built data models (compare mode, groups) or already-implied curation (10-pack shortlist)
- P3: Nice to have — real value but higher cost or blocked on out-of-scope prerequisites (accounts, new taxonomy fields)

## Reference Tool / Precedent Analysis

| Concern | DataSUS TabNet (the incumbent LACIR is teaching students to read) | IHME GBD Compare | Brazilian gov. dashboards generally (SAGE, Painel Coronavírus) per Jarske et al. 2022 | LACIR v3.0 approach |
|---------|--------------------------------------------------------------------|-------------------|----------------------------------------------------------------------------------------|----------------------|
| Null vs. zero | Absence of a row *is* TabNet's own zero convention for SIH counts (no explicit "0" cell emitted) — LOW confidence claim, inferred from this project's own scrape/ingest documentation rather than an official DataSUS spec, since no authoritative public TabNet documentation of this convention was found during research | Not directly inspected (requires registration); described in secondary sources as filtering to a valid dimension combination before rendering, which sidesteps the question rather than solving it in-view | Not the focus of the cited study | Ledger-gated combination-level gate + true-zero-inside-the-ramp, per the worked recommendation above |
| Provenance | Query results include a "Notas Técnicas"/"Fonte" footer per TabNet convention (per general TabNet usage documentation), but this lives outside the visualization and is easy to miss | Not assessed (registration-gated) | Data source + last update at best; often nothing (SAGE) | Mandatory, always-visible source/table/period/collection-date per metric, already the Variáveis catalog's bar — must not regress in Mapas |
| Search at scale | TabNet's own "Lista Morb CID-10" *is* the 330-item grouping this app already uses — TabNet's own UI for selecting it is a legacy multi-select list box with no fuzzy search | Multi-dimensional filter panel (cause, risk, location, age, year) selected before rendering | N/A | Existing free-text + CID search (already ahead of TabNet's own picker), extended with curated shortlist + recently-used |
| Comparison | TabNet supports building comparison tables (e.g., two periods as columns) but never renders them as two maps | Renders multiple chart types (including maps) over the same filtered selection, side by side across tools, not natively as map small-multiples | N/A | Reuse already-built `compare` time mode to drive an on-map comparison, a genuine improvement over TabNet's table-only comparison |

## Sources

- Direct inspection of this repository (HIGH confidence, primary evidence): `src/routes/mapas/MapasPage.tsx`, `src/routes/mapas/BrazilMapCanvas.tsx`, `src/routes/mapas/ChoroplethLegend.tsx`, `src/geo/choroplethScale.ts`, `src/routes/mapas/SharedDiseasePanel.tsx`, `src/routes/mapas/MeasureDiseasePicker.tsx`, `src/routes/mapas/ReviewAnalysisDialog.tsx`, `src/routes/mapas/mapAnalysisState.ts`, `src/routes/mapas/SharedPeriodPanel.tsx`, `src/features/catalog/taxonomy.ts`, `src/features/catalog/catalogAnalysisData.ts`, `src/features/catalog/fetchHandoffMetrics.ts`, `src/features/catalog/types.ts`, `scripts/catalog/parseCsv.mjs`, `docs/SUPABASE-CATALOG.md` — the `SURFACE_FILL === TEAL_STEPS[0]` finding and the "compare mode built but unused on the map" finding are both derived directly from reading this code, not inferred
- `.planning/PROJECT.md` — v3.0 milestone scope, constraints ("degradação honesta," "somente-leitura"), and the diagnosed defects (taxonomia corrompida, coleta incompleta, pipeline silencioso, mapa não dinâmico) that this research is scoped against — HIGH confidence, primary source of truth
- Jarske, J. M., de Almeida, J. R., Filgueiras, L. V. L., Velloso, L. M. R., & Santos, T. L. (2022). *Data Provenance Visualization in Brazilian Public Health Dashboards.* Workshop paper (TrExVis 2022), Universidade de São Paulo — peer-reviewed conference research studying 12 international COVID-19 dashboards plus Brazil's SAGE/DEMAS dashboards used by real SUS managers; source for the "provenance was not explicit in any of 12 dashboards," the Brazilian COVID panel's minimal metadata, the SAGE "no annotation at all" example, user-interview quotes ("fragmented," "unreliable"), and the Tim Berners-Lee "Oh, yeah?" button framing — HIGH confidence, directly fetched and read in full
- Axis Maps, *Choropleth Maps* guide — https://www.axismaps.com/guide/choropleth — cartography reference on distinguishing missing data from measured extremes — MEDIUM-HIGH confidence, established cartography education resource
- *storytellingwithdata*, "What is a choropleth map?" — general cartography practice on missing-vs-zero — MEDIUM confidence, practitioner blog, cross-checked against Axis Maps and community consensus
- Splunk Community discussion, "Choropleth Zero Count Should Always Be Gray" — cited as evidence of practitioner consensus on the specific zero-vs-missing distinction in dashboard tooling — MEDIUM confidence, community forum, directionally consistent with formal cartography sources
- CDC WONDER documentation and Washington State DOH "Small Numbers" guidance — small-count suppression/instability conventions in US public-health reporting — MEDIUM confidence, official sources, used here specifically to explain *why the suppression pattern does not transfer* to this project (confidentiality rationale inapplicable to already-public SIH aggregates) rather than as a pattern to adopt
- IHME/GBD *GBD Compare* and *GBD 2023 data and tools guide* (healthdata.org) — multi-dimensional filter-then-visualize pattern — MEDIUM confidence, described from official/secondary documentation, not hands-on (tool is registration-gated)
- cmdk / shadcn `Command` component documentation and community write-ups (uxpatterns.dev "Command Palette Pattern," LogRocket, multiple cmdk tutorials) — grouped fuzzy search + recently-used pattern, and its partial mismatch with this app's persistent multi-select checkbox shape — MEDIUM-HIGH confidence for the pattern, MEDIUM for direct fit
- ICD-10 autocomplete tooling documentation (AAPC Codify, Kipu Health ICD-10 autocomplete service) — clinical alias search + valid/invalid visual distinction conventions — MEDIUM confidence, vendor documentation, used only for the interaction-pattern precedent, not for clinical accuracy claims
- Cartography/epidemiology literature on small multiples vs. animation for propagation visualization (referenced via *Effectiveness of animated choropleth and proportional symbol cartograms for epidemiological dashboards*, Cartography and Geographic Information Science, 2023) — MEDIUM confidence, abstract/secondary-source level, not full-text verified
- Prior milestone research (`.planning/research/FEATURES.md`, v2.0, dated 2026-07-25) — retained only as historical context that this document supersedes for the Mapas-dynamism scope; not re-cited as evidence for v3.0 claims

---
*Feature research for: Bioestatística LACIR v3.0 — dynamic, Supabase-backed Mapas surface*
*Researched: 2026-07-28*
