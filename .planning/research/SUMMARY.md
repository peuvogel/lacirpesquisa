# Project Research Summary

**Project:** Bioestatística LACIR
**Domain:** Didactic biostatistics SPA moving from bundled data packs to a live Supabase research backend
**Researched:** 2026-07-28 (v3.0 milestone)
**Confidence:** HIGH for as-is diagnosis (every claim code-verified or verified by live query); MEDIUM-HIGH for forward-looking design proposals

**Scope note:** Supersedes the 2026-07-25 v2.0 summary. The already-shipped v2.0 stack (React/Vite/Tailwind/shadcn, Chart.js, GLM engines, map rendering) is not re-researched.

## Executive Summary

v3.0 is **corrective before it is additive**. The v2.0 milestone shipped its five phases, but the uncommitted work that followed left the product *incorrect* rather than merely incomplete: 20 agravos serve another disease's data under a convincing clinical label, the map promises 330 agravos and delivers 10, a município query silently returns 1,000 of 6,481 rows with HTTP 200, and the choropleth paints "no data", "true zero" and "lowest bucket" in the same hex.

The unifying theme across all four research dimensions is one failure mode, repeated at four layers of the stack: **an absence that looks like a value.** A DNS failure logged as `OK · 0 linhas`. A null coerced to 0 in a scale domain. A truncated result set returned as success. A validator that gates presence and calls it correctness. Every phase of this milestone is, in some form, about making absence visible.

## Key Findings

### Recommended Stack Additions

Deliberately minimal — the project values a small dependency surface and the maintainers are medical students.

| Need | Recommendation | Why |
|------|----------------|-----|
| Scraper resilience | **stdlib only** (`sqlite3` ledger + ~15-line backoff helper) | Python here has *zero* third-party packages (3.9.6). The bug was never a missing library: `scrape_one()` prints `OK` without consulting its own `errors` list, and cleanup runs unconditionally. A dependency would not have prevented it |
| Client query cache | **`@tanstack/react-query` v5** — the one genuine new dependency | Adopted for *correctness*, not convenience: parameterized map queries are race-prone, and keyed caching with `AbortSignal` is what stops disease A's response painting under disease B's label |
| UF choropleth aggregation | **No RPC, no materialized view** | `sih_metric_uf` already stores that exact grain; 27 rows via an indexed `.eq()` is sufficient |
| Pagination | **A `selectAll()` helper using `.range()`** | Do not raise the PostgREST dashboard cap — reported unreliable, and it leaves truncation silent at whatever the new limit is |

### Feature Landscape

Table stakes for the dynamic map: an honest response for every one of the 330 selections (loading / not-collected / real data — never a dead click); live UF fetch replacing the bundled packs; a distinct non-ramp fill and dedicated legend entry for "sem dado"; on-demand município fetch with scoped loading; provenance visible during exploration and surviving into the test result.

Highest-leverage deferred differentiator: **period-compare rendered on the choropleth**. The data model is already built (`mode: 'compare'` with `periodA`/`periodB` in `mapAnalysisState.ts`) and simply unused by the map — but it is gated behind the null-vs-zero fix, since comparing two maps multiplies the damage of a mis-paint.

Named anti-features: coercing null to 0 anywhere; suppressing small counts (confidentiality theatre — SIH is already public aggregate data, and hiding it would make the product diverge from the source it teaches students to read); silently substituting the "nearest populated disease"; live TabNet scraping at request time.

### Architecture Direction

The root cause is precise: `taxonomy.ts` validates ids against the full 330×6 space while `catalogAnalysisData.ts` holds values for 10 diseases via static Vite imports. **The picker and the choropleth read different-sized universes.**

The sync→async conversion is bounded, not a rewrite — only two impure calls sit inside `mapAnalysisReducer` itself; `choroplethValues` is already a `useMemo`.

One genuinely new Supabase artifact is required: a client-readable **`sih_collection_status`** ledger, which solves three problems at once — the reducer's need for synchronous year availability, the not-collected / loading / error / confirmed-zero distinction, and the picker's "which of 330 are selectable" gate.

Taxonomy drift has two unlinked sources, both verified: a hand-typed `KNOWN_BY_CODE` override in `sync-lista-morb.mjs`, and `sql/*.sql` seeds that no script generates from `diseases.json`.

### Watch Out For

The full forensic list is in `PITFALLS.md` (13 pitfalls, each naming the exact mechanism in current code). The ones that most shape the roadmap:

- **Absence rendered as value**, at four layers — pitfalls 1, 6, 7, 8, 9
- **PK rename cycles**: `hemorroidas` → `veias_varicosas…` while `outras_doencas_veias` → `hemorroidas`; plus no `ON UPDATE CASCADE` on the FKs, so a bare `UPDATE` fails outright. Highest blast radius in the milestone — rehearse off the live table
- **A validator that passes on corrupt data**, giving false confidence proportional to how thorough it looks
- **A red suite that stays red** stops being a regression signal — which is why baseline-green is Phase 7, not an afterthought
- **A hardcoded ingest secret** (`lacir-sih-ingest-2026`) now in git history; contained (no remote) but requires rotation

## Implications for Roadmap

1. **Phase 8 (taxonomia) must precede Phase 9 (pipeline)** — the ledger keys on `disease_id`, so migrate ids *before* the multi-day scrape, never after.
2. **Phase 9 need only ship the `sih_collection_status` schema, not full collection, before Phase 10 starts.** This is the concrete decoupling that prevents Phase 10 from rewriting Phase 9's work while the long scrape runs.
3. **The null-vs-zero fix precedes every comparison feature.**
4. **Phase 11 is a pure consumer** of Phase 10's unified repository, not a parallel data-fetch effort.
5. Fix the existing `fetchHandoffMetrics.ts` truncation *inside* the new fetcher work — same gap, same code path, not a separate task.

## Open Questions

- Whether `sih_collection_status` is a table or a view over the pipeline's retry ledger — Phase 9 implementation detail, not an architectural blocker.
- Whether the documented `sih_metric_muni_uf_ano` index actually exists on the live table (documented as intent, not confirmed applied) — verify in Phase 9/10.
- Exact auto-generated FK constraint names — must be queried from `pg_constraint` live before writing migration SQL, never guessed.
- Whether TabNet truly never emits an explicit `0` cell (row-absence *is* the zero) is inferred from this project's own pipeline behavior, not an official DataSUS spec — worth one empirical check before locking the null-vs-zero logic to that assumption.

---
*Research synthesis for: Bioestatística LACIR v3.0*
*Sources: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md + direct verification against the live Supabase project and working tree*
