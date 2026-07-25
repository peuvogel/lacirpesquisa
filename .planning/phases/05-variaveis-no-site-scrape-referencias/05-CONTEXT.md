# Phase 5: Variáveis no site (scrape + referências) - Context

**Gathered:** 2026-07-25  
**Status:** Ready for planning  
**Mode:** Auto-decide (user: "decida tudo sozinho") — reuse tracked `trabalhos datasus/` assets; serious TABNET/SIDRA data only, no didactic fakes for loadable packs

<domain>
## Phase Boundary

Deliver an in-app **Variáveis** catalog backed by a **versioned offline pipeline**: browse/search classified public-health variables with **mandatory provenance**, see suggested-test hints, and **load curated datasets** into Estatística/Mapas without leaving the app for TABNET during class.

Out of scope: live runtime TABNET scraping in the browser; continuous CI refresh beyond the versioned bundle; inventing synthetic numbers when real coletas already exist.

</domain>

<decisions>
## Implementation Decisions

### Escopo do catálogo v1 (CAT-01 / CAT-05)
- **D-01:** Treat `trabalhos datasus/` as the **source of truth already tracked** — do not rediscover variables from scratch. Pipeline **ingests and normalizes**:
  1. `build/catalogos/*_catalog.json` + `GUIA_MAPEAMENTO_DADOS_DISPONIVEIS.md` → **reference catalog** (browseable, provenance-complete; may be `loadable: false` until a pack exists)
  2. Existing serious coletas → **loadable analysis packs** (UF × ano):
     - `outputs/coleta_embolia_trombose_uf/` (SIH nibr + CNES RH + SIDRA pop)
     - `outputs/coleta_vascular_amputacao/` (SIH qibr + CNES + SIDRA)
  3. Optional third pack if cleanly extractable from `outputs/lacir_projetos/` without inventing cells — otherwise leave as reference-only.
- **D-02:** **No mock numeric values** in Mapas for variables that exist in loadable packs. Phase 4 `mock.*` IDs are replaced/aliased by catalog variable IDs whose values come from the packaged CSVs (real scraped series 2013–2025). Variables without a pack stay reference-only (or paste path from Phase 4).
- **D-03:** v1 does **not** require re-downloading every TABNET form at execute time if outputs already exist and validate. Pipeline **must** still include a **regenerate path** (port `coleta_*.py` to repo-relative paths + document `npm run catalog:build`) so scrapes are reproducible. Prefer packaging validated outputs first; re-scrape only if validation fails or user later asks refresh.
- **D-04:** Catalog entry count target: **all variables derived from loadable packs** (each metric column = one loadable variable) **plus** a curated reference slice from guia/catalogos (sources: TABNET, OpenDataSUS, IBGE/SIDRA, e-Gestor, ANS, Atlas, IPEA, COVID) — prioritize entries that already have official URLs in the tracked catalogs. Quality > dumping 276 raw TABNET report titles without provenance fields filled.

### Schema de proveniência (CAT-02)
- **D-05:** Every catalog entry **MUST** include (JSON + UI):
  - `id` (stable slug, e.g. `sih.embolia_trombose.internacoes`)
  - `label` (PT-BR)
  - `variableType` — `categorica` | `numerica` | `ordinal` | `taxa` | `contagem` | `texto`
  - `domain` — short theme tag (ex.: `vascular`, `morbidade`, `rh_sus`, `populacao`)
  - `sourceSystem` (ex.: SIH/SUS, CNES, SIDRA/IBGE)
  - `sourceName` (human source label)
  - `tableOrIndicator` (TABNET `.def` / SIDRA table / endpoint)
  - `period` (e.g. `2013–2025`)
  - `officialUrl` (absolute URL)
  - `methodologyNotes` (aggregation rules, filters, known gaps — copy/adapt from coleta `metadata.json` notes)
  - `loadable` boolean + optional `packId` / `columnKey`
- **D-06:** UI never shows a variable without the provenance block. Missing any of D-05 fields = pipeline **fails validation** (do not ship orphans).
- **D-07:** `provenance: 'mock'` is retired for catalog-backed Mapas variables. Remaining paste path stays `provenance: 'paste'`.

### Pipeline / assets (CAT-05)
- **D-08:** Pipeline lives under `scripts/catalog/` (Node and/or Python). Outputs committed (or generated into) `public/data/catalog/`:
  - `manifest.json` — `{ version, generatedAt, packs[], catalogEntryCount }`
  - `variables.json` — full catalog array
  - `packs/<packId>.json` — tidy long or wide tables ready for session/Mapas (UF code, sigla, year, metrics…)
- **D-09:** App loads catalog via static fetch/import of these assets — **zero network calls to DATASUS/IBGE at runtime**.
- **D-10:** Add npm scripts: `catalog:build` (normalize from `trabalhos datasus`), `catalog:validate` (schema + no orphan + pack columns exist). Wire `catalog:validate` into CI or at least `pretest`/`typecheck` gate if cheap.

### UX rota Variáveis (CAT-01 / CAT-03)
- **D-11:** Replace `PlaceholderShell` with a real page: **search** + filters (`sourceSystem`, `variableType`, `domain`, `loadable`) + **scrollable list/table** + **detail panel** (provenance + test hint + actions).
- **D-12:** Visual language: existing LACIR dark/teal shell — **no new card-heavy dashboard**. One composition: list + detail. Match Mapas/Estatística density and typography tokens.
- **D-13:** Suggested test hint (CAT-03): pure function `suggestTestForVariable(entry)` (+ optional pair mode later) mapping `variableType` + domain heuristics → registry `testId` + short PT reason. Show in detail panel; link “Abrir em Estatística” when loadable.

### Carga em análise (CAT-04)
- **D-14:** **Carregar na Estatística:** build `SessionDataset` (`headers`/`rows`/`sourceLabel` including provenance short cite) via `setDataset` and navigate to `/estatistica`. Prefer tidy table: territory × time × selected metrics.
- **D-15:** **Usar no mapa:** navigate to `/mapas` with catalog variable IDs selected; Mapas data provider reads pack values by UF×year (replaces `mockAnalysisData` for those IDs). Keep Phase 4 group/time/paste UX.
- **D-16:** Multi-select load: user can pick 1–N loadable variables from the same pack (or compatible grain UF×ano) before loading; cross-pack join only when keys match (`uf_codigo`,`ano`) — otherwise block with clear PT message.
- **D-17:** Default grain for v1 packs: **UF × ano** (matches Mapas UF layer and existing coletas). Município-level raw HTML leftovers in outputs are **not** primary v1 loadables.

### Integração Mapas (handoff from Phase 4)
- **D-18:** Introduce `catalogAnalysisData` (or evolve mock module) that resolves values from packs; keep stable API used by `GroupConfigPanel` / choropleth. Alias old `mock.amputacoes` / internações-like IDs to real pack columns where semantics match.
- **D-19:** Time series years for catalog vars = intersection of pack years present (not hard-coded 2018–2022 didactic list), clamped to available non-null denominators when showing rates.

### Claude's Discretion
- Exact React component split (table vs virtualized list); whether packs are wide JSON or columnar.
- How much of the 276 TABNET reports become reference entries in v1 (curate with complete provenance; omit incomplete).
- Whether to use Papa Parse vs hand CSV parse in the build script.
- Minor copy for empty states and validation error messages (PT-BR, didactic).

</decisions>

<specifics>
## Specific Ideas

- User: variables are **already tracked** — lean on `trabalhos datasus` coletas, catalogs, and GUIA; do not invent a parallel taxonomy.
- User: **scraping perfeito, dados sérios** — ship real SIH/CNES/SIDRA series from existing outputs; provenance notes from `metadata.json`; no random UF weights.
- Embolia/trombose pack columns of interest: `medicos_vasculares_sus`, `populacao`, `internacoes_embolia_trombose_arteriais`, `obitos_embolia_trombose_arteriais`, `taxa_mortalidade_pct`, `media_permanencia_calculada`, `taxa_internacao_por_100k`, …
- Amputação pack columns: `internacoes_amputacao_mmii`, `obitos_amputacao_mmii`, `taxa_mortalidade_sih_pct`, `taxa_internacao_amputacao_mmii_por_100k`, …
- Official source URLs already recorded in coleta metadata (TABNET `.def` + SIDRA 6579/9514).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/PROJECT.md` — scrape = pipeline; proveniência obrigatória
- `.planning/REQUIREMENTS.md` — CAT-01 … CAT-05
- `.planning/ROADMAP.md` — Phase 5 goal & success criteria
- `.planning/notes/2026-07-25-pivot-scrape-mapa-analise.md` — pivot locked
- `.planning/phases/04-mapas-como-interface-estatistica/04-CONTEXT.md` — hybrid mocks → Phase 5 catalog swap (D-14 there)

### Tracked research / scrape corpus
- `trabalhos datasus/GUIA_MAPEAMENTO_DADOS_DISPONIVEIS.md`
- `trabalhos datasus/build/catalogos/catalog_index.json` (+ per-source `*_catalog.json`)
- `trabalhos datasus/outputs/coleta_embolia_trombose_uf/` (+ `metadata.json`, base CSV)
- `trabalhos datasus/outputs/coleta_vascular_amputacao/` (+ `metadata.json`, base CSV)
- `trabalhos datasus/scripts/coleta_embolia_trombose_municipio_uf.py`
- `trabalhos datasus/scripts/coleta_vascular_amputacao.py`

### App integration
- `src/routes/variaveis/VariaveisPage.tsx` — placeholder to replace
- `src/shared/session/SessionProvider.tsx` — `setDataset` / Mapas state
- `src/routes/mapas/mockAnalysisData.ts` — Phase 4 mock provider to replace/alias
- `src/features/tests/registry.ts` — test IDs for CAT-03 hints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SessionProvider.setDataset` — Estatística load path
- Mapas `GroupConfigPanel` + `assembleHandoffTable` — already expect variable IDs + UF×time values
- `PlaceholderShell` pattern — retire on Variáveis only
- Coleta CSVs already tidy UF×ano with provenance metadata sidecar

### Established Patterns
- Client-only analyses; assets via `public/` or bundled JSON
- PT-BR didactic copy; `n/d` for missing (never em dash in UI)
- TEST_REGISTRY as single source for test identity

### Integration Points
- Router already has `/variaveis`
- Mapas mock IDs explicitly documented as Phase 5 swap targets
- Phase 4 paste path remains for ad-hoc data

</code_context>

<deferred>
## Deferred Ideas

- Continuous/automated CI scrape refresh of all TABNET forms (REQUIREMENTS v2 out-of-scope note)
- Full município-level packs in-app (raw HTML leftovers stay offline tools)
- Live OpenDataSUS API queries from the browser
- Auto-join arbitrary cross-source indicators beyond UF×ano key match

</deferred>

---

*Phase: 05-variaveis-no-site-scrape-referencias*
*Discussed: 2026-07-25*
*Ready for planning: yes*
