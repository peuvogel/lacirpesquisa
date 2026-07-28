# Architecture Research: Live Supabase Metrics for Bioestatística LACIR (v3.0)

**Domain:** Didactic biostatistics SPA (React 19 + Vite 8 + TypeScript) converging a client-bundled disease catalog and a Supabase/PostgREST metrics store
**Researched:** 2026-07-28
**Confidence:** HIGH for all "as-is" facts (verified by reading the cited source files) · MEDIUM for the recommended new modules and library choice (verified against current docs/search, not yet implemented) · LOW flagged inline where noted

> Supersedes the 2026-07-25 `ARCHITECTURE.md` (v2.0 client-only rewrite research). That document is obsolete for v3.0's core problem — it predates the Supabase decision entirely.

## 0. As-Is: Why the Map Paints Wrong Data Today

Verified by reading the actual call graph (not assumed):

```
DISEASE PICKER                    CHOROPLETH                        HANDOFF (confirm button)
───────────────                   ──────────                        ─────────────────────────
taxonomy.ts                       MapasPage.tsx useMemo              ReviewAnalysisDialog.tsx
  DISEASES (330, from               choroplethValues                  handleConfirm()
  diseases.lista.json)              ├─ getMetricByUf()                 └─ await
  MEASURES (6)                      └─ getMetricByUfAndYear()              fetchHandoffMetricLookup()
  catalogIdFor(measure, disease)         │                                    │
        │ generates any                 ▼                                    ▼
        │ sih.{disease}.{measure} id  catalogAnalysisData.ts             fetchHandoffMetrics.ts
        │ — validates against ONLY    10 STATIC IMPORTS of pack JSON      Supabase sih_metric_uf /
        │ DISEASES/MEASURES lists,    (Vite build-time bundle)            sih_metric_muni (anon RLS)
        │ NOT against what has data   → 55 loadable variables             → has rows for whatever
        ▼                             → 10 diseases only                    disease_id was actually
  picker lists all 330                 → other 320 diseases: {}             collected (currently:
  (taxonomy has no                     → empty choropleth,                  Internações×330, other
  concept of "collected")               indistinguishable from "loading"    3 measures×~5 diseases)
```

**The bug is not in the picker or in Supabase — it's that two different modules answer "does this disease have data" with two different, disconnected datasets.** `catalogAnalysisData.ts` (10 bundled packs) backs the live choropleth; `fetchHandoffMetrics.ts` (Supabase) backs only the one-time handoff fetch. Converging them is the entire architectural problem this milestone solves.

Confirmed call sites of the four functions that must convert from sync → async (grepped, not guessed):

| Function | Call sites (file:context) |
|---|---|
| `getMetricByUf` / `getMetricByUfAndYear` | `MapasPage.tsx` (`choroplethValues` useMemo), `assembleHandoffTable.ts` (`packMetric`) |
| `getMetricByIbgeCode` | `mockAnalysisData.ts` (deprecated re-export only) |
| `getCatalogTimeSeriesYears` / `getDefaultYearForVariable` | `mapAnalysisState.ts` (`applyCatalogVariableIds`, `PREPARE_PERIOD_COMPARE` — **inside the reducer**), `catalogYearOptions.ts` (`resolveCatalogYearOptions`, used by `GroupConfigPanel`/`SharedPeriodPanel` to populate year `<select>` options) |
| `getCatalogVariableById(...).loadable` | `mapAnalysisState.ts` (`preferredCatalogIdForDisease`, `resolveCatalogHandoffIds`), `MeasureDiseasePicker.tsx` (`FIRST_LOADABLE_MEASURE` — gates which of the 330×6 combos render as selectable) |
| `getCatalogLabel` | `MapasPage.tsx`, `GroupConfigPanel.tsx`, `ReviewAnalysisDialog.tsx`, `suggestResearchForSelection.ts`, `assembleHandoffTable.ts` — pure metadata, not a metric value |

The two calls buried **inside `mapAnalysisReducer`** (`getDefaultYearForVariable` in `APPLY_CATALOG_VARIABLE_IDS`, `getCatalogTimeSeriesYears` in `PREPARE_PERIOD_COMPARE`) are the crux of the sync→async problem: a `useReducer` reducer must be a pure, synchronous function — it cannot `await` Supabase. Section 1 spells out how this is resolved without breaking reducer purity.

---

## 1. The Data Access Layer

### 1.1 Verdict on the static packs

**Keep them, but demote them.** They stop being "the data source" and become:
1. An **offline fallback** for the ~10 already-scraped vascular diseases, used only when Supabase is unconfigured or unreachable (classroom wifi failure) — never for the other 320.
2. **Test fixtures** — synchronous, network-free data for chart/legend/table unit tests that don't need to exercise the fetch/cache layer.

They are explicitly **not** a viable path to "all 330 diseases dynamic": bundling 1.1M município rows (or even the 30k UF rows × 330 diseases × 4 measures) into Vite is the exact problem `docs/SUPABASE-CATALOG.md` was written to avoid. Do not grow the pack set.

### 1.2 Module boundary — new vs. modified

| Module | Status | Responsibility |
|---|---|---|
| `src/features/catalog/taxonomy.ts` | **Modified (metadata only)** | Stays the canonical id/label/measure space (`DISEASES`, `MEASURES`, `catalogIdFor`, `parseCatalogId`). No change needed for the sync→async conversion — it already validates ids against the full 330×6 space, not against the 10-pack set. Regenerated per Section 5. |
| `src/features/catalog/metricsSource.ts` | **New** | Lowest layer. Thin, typed Supabase/PostgREST query functions: `fetchUfRows(diseaseIds, ufCodes, years, signal)`, `fetchMuniRowsForUf(diseaseId, ufCode, years, signal)`, `fetchMuniRowsForCodes(diseaseId, municipioCodes[], years, signal)`, `fetchCollectionStatus(signal)`. Every function accepts an `AbortSignal` and passes it straight to supabase-js's `.abortSignal(signal)` (confirmed supported — see Sources). No caching, no React, no taxonomy knowledge — just typed rows in, rows out. Absorbs the query-building logic currently duplicated between `fetchHandoffMetrics.ts`'s two `supabase.from(...)` blocks. |
| `src/features/catalog/metricsRepository.ts` | **New** | Mid layer. `variableId`-aware (uses `parseSihVariableId`/`resolveVariableId`), converts rows into `Record<territoryKey, number>` the way `catalogAnalysisData.ts` does today, but async and Supabase-backed. Exposes the **same conceptual function names**, now Promise-returning: `getMetricByUf`, `getMetricByUfAndYear`, `getMetricByMunicipio(variableId, ufCode, year)`, `getMetricsForTerritories(variableIds, territories, year)` (replaces `fetchHandoffMetricLookup`'s scatter-gather). On Supabase failure, falls back to the pack module (1.1) **only** if a pack exists for that `variableId`, tagging the result `{ source: 'offline-pack' }` vs `{ source: 'supabase' }` so the UI can render an honest provenance note — never silently substitutes. |
| `src/features/catalog/collectionStatusCache.ts` | **New** | The piece that makes the reducer's synchronous calls survive the conversion (see 1.3). Fetches a tiny ledger table **once**, caches it in a module-level variable (same promise-memoization pattern already used by `loadCatalog.ts`), and exposes **synchronous** accessors once warm: `getKnownYearRange(variableId): number[]`, `isKnownCollected(variableId): boolean`. Backed by a new Supabase table, `sih_collection_status` (see 1.4) — not by scanning packs. |
| `src/features/catalog/localPackFallback.ts` | **Renamed from `catalogAnalysisData.ts`** | Keeps the current synchronous pack-reading code, trimmed to only what 1.1/1.2 need: raw pack lookups, `UF_META`, `IBGE_BY_SIGLA`. Loses its role as the app's primary metric source. Existing unit tests that assert against the 10 vascular packs keep working unchanged, since this module's synchronous contract doesn't change — only its callers do. |
| `src/features/catalog/fetchHandoffMetrics.ts` | **Deleted** | Its two responsibilities (UF batch fetch, município scatter-gather across arbitrary territories) move into `metricsSource.ts`/`metricsRepository.ts` so the map's live choropleth and the handoff assembly share one fetch path and one cache — a handoff no longer re-fetches what the map already loaded (see 2.3). |
| `src/features/catalog/queries/` (new folder) | **New** | The React-facing hook layer (`useMetricQuery`, `useMunicipioMetricQuery`, `useCollectionStatus`) — see Section 2. Thin wrappers around `metricsRepository.ts` + TanStack Query. |
| `src/routes/mapas/mapAnalysisState.ts` | **Modified (imports only)** | Reducer logic is untouched; only its imports of `getCatalogTimeSeriesYears`/`getDefaultYearForVariable` repoint to `collectionStatusCache.ts`'s synchronous accessors. `getCatalogVariableById(...).loadable` calls repoint similarly (see 1.3). |
| `src/routes/mapas/MapasPage.tsx` | **Modified** | `choroplethValues` useMemo is replaced by a `useMetricQuery(...)` call; a new `choroplethStatus` is threaded into `BrazilMapCanvas`. |
| `src/routes/mapas/BrazilMapCanvas.tsx`, `ChoroplethLegend.tsx` | **Modified** | Gain a required `status: 'idle' | 'loading' | 'error' | 'empty' | 'ok'` prop (or equivalent) — see Section 4. |
| `src/routes/mapas/assembleHandoffTable.ts`, `ReviewAnalysisDialog.tsx` | **Modified** | Call `metricsRepository.getMetricsForTerritories(...)` instead of `fetchHandoffMetricLookup`; ideally via `queryClient.ensureQueryData` so an already-warm map query is reused instead of re-fetched. |
| `src/routes/mapas/MeasureDiseasePicker.tsx`, `catalogYearOptions.ts` | **Modified** | `FIRST_LOADABLE_MEASURE` / `resolveCatalogYearOptions` repoint from `getCatalogVariableById(...).loadable` / `getCatalogTimeSeriesYears` (pack-scoped) to `collectionStatusCache.ts` (ledger-scoped, covers all 330 diseases). |

### 1.3 The synchronous → asynchronous conversion, spelled out

This is the crux the question asks not to gloss, so here is the concrete mechanism, not a principle.

**Split the problem in two, because it has two different shapes:**

1. **"What years/territories/measures does this variable actually have collected data for?"** — small (≤330 diseases × 4 measures × 2 grains ≈ 2,640 rows worst case), changes only when the offline pipeline runs (not per-user-action), and is needed **synchronously inside a pure reducer** (`PREPARE_PERIOD_COMPARE`, `applyCatalogVariableIds`) and inside render-time list-filtering (`MeasureDiseasePicker`'s `FIRST_LOADABLE_MEASURE`, computed once).
2. **"What is the actual metric value for this disease×measure×territory×year?"** — large (30k UF rows, 1.1M município rows), must be fetched per-selection, and is **only ever needed at render/paint time**, never inside the reducer.

Category 1 is solved by treating it exactly like `loadCatalog.ts` already treats the static packs: fetch once at app start (or on first Mapas visit), memoize in a module-level variable, and expose a **synchronous** accessor once the promise has resolved. `collectionStatusCache.ts` does this:

```ts
// src/features/catalog/collectionStatusCache.ts (new)
let cache: Map<string, { years: number[]; hasUf: boolean; hasMuni: boolean }> | null = null;
let warming: Promise<void> | null = null;

export function warmCollectionStatus(): Promise<void> {
  if (cache) return Promise.resolve();
  warming ??= fetchCollectionStatusRows().then((rows) => { cache = indexRows(rows); });
  return warming;
}

/** Synchronous by design — reducers and render-time filters call this directly.
 *  Returns [] / false before the cache is warm, identically to today's
 *  "unknown pack → empty result" behavior. No new failure mode, just a
 *  wider window before data appears. */
export function getKnownYearRange(variableId: string): number[] {
  return cache?.get(variableId)?.years ?? [];
}
export function isKnownCollected(variableId: string): boolean {
  return cache?.get(variableId)?.hasUf ?? false;
}
```

A root-level effect (e.g. in `AppShell.tsx` or a `MapasPage.tsx` mount effect) calls `warmCollectionStatus()` once; the reducer keeps calling a synchronous function with the exact same signature it calls today (`getCatalogTimeSeriesYears(id)` → `getKnownYearRange(id)`), so **`mapAnalysisReducer` itself does not change shape, only its data source changes** — this is the one-line-per-call-site propagation the roadmap needs to budget for, not a reducer rewrite.

Category 2 never touches the reducer. It already doesn't — `choroplethValues` in `MapasPage.tsx` is a `useMemo`, not reducer state, and `getMetricByUf`/`getMetricByUfAndYear` are called from render code, not from `mapAnalysisReducer`. The conversion here is local to `MapasPage.tsx`/`assembleHandoffTable.ts`: replace the synchronous `useMemo` with a `useQuery` hook (Section 2), and thread its `status` through to the presentational components. No new architectural mechanism is needed beyond what React Query already provides.

**Net effect:** the reducer's public contract (`MapAnalysisState`, action types) is unchanged. The propagation is: (a) 4-5 call-site import swaps for the small ledger-backed synchronous functions, (b) one `useMemo` → `useQuery` swap in `MapasPage.tsx`, (c) `choroplethStatus` prop threading into 2 presentational components, (d) `assembleHandoffTable`/`ReviewAnalysisDialog` swapping their metric source. This is a bounded, file-enumerable change, not an open-ended rewrite.

### 1.4 A new artifact this design depends on: `sih_collection_status`

Neither `sih_disease` nor any existing table currently answers "has disease X's measure Y been collected at grain Z" (verified — `docs/SUPABASE-CATALOG.md`'s schema has no such table). This is a **new recommendation**, not an existing fact:

```sql
create table if not exists sih_collection_status (
  disease_id text references sih_disease(id),
  measure text not null,                -- internacoes | obitos | valor_total | dias_permanencia
  grain text not null check (grain in ('uf','municipio')),
  status text not null check (status in ('collected','partial','missing')),
  row_count int not null default 0,
  min_year int,
  max_year int,
  updated_at timestamptz not null default now(),
  primary key (disease_id, measure, grain)
);
```

Anon RLS select, same as the other three tables. This is the client-visible face of Phase 9's "ledger por agravo × medida × grão" — the pipeline's internal retry/resume ledger and this table can be the same store or the pipeline can publish a summary into it; either way, **this table must exist and be populated before Phase 10 client code has anything real to read**, which is the concrete dependency stated in Section 6.

---

## 2. Where Async State Lives

**Recommendation: a query cache (TanStack Query / `@tanstack/react-query`), scoped narrowly to `src/features/catalog/queries/`.** Not the reducer, not a bespoke hook holding ad-hoc `useState` triples.

**Why not the reducer:** `mapAnalysisReducer` is a pure `useReducer` reducer (`src/routes/mapas/mapAnalysisState.ts`) — putting `isLoading`/`error`/`data` for metric fetches into `MapAnalysisState` would either force the reducer to become impure (dispatching async thunks) or force every consumer to fan out one loading flag per (disease×measure×year×grain) key by hand. The reducer's job is "what did the user ask for," not "what did the server return."

**Why not a bespoke hook alone:** the codebase already has exactly this problem solved once, by hand, for topojson drill-down in `BrazilMapCanvas.tsx` (an incrementing `loadTokenRef` guarding against stale `.then()` resolution when the user drills UF→UF quickly, plus a `cancelled` boolean closure — see the `loadDrillPathsBrazilCrs`/`loadBrazilUfMunis` effects). That pattern is a legitimate fallback if a new dependency is undesirable, but it does not give you: request de-duplication (map and handoff both wanting the same disease×year would double-fetch), cross-drill-in/out caching without hand-rolled `Map` refs, or declarative `enabled`/`staleTime` semantics. Given the requirement is explicitly "loading/error/empty states per (disease × measure × year × grain)" — a 4-dimensional key space — reinventing this is itself a pitfall (subtle race conditions on drill in/out are exactly the kind of bug a hand-rolled cache produces under time pressure).

**Confirmed compatible:** TanStack Query v5's `queryFn` receives a per-query `AbortSignal` that fires on unmount/key-change; supabase-js's PostgREST builder accepts `.abortSignal(signal)` directly (confirmed via docs — see Sources), so cancellation wiring is: `queryFn: ({ signal }) => supabase.from('sih_metric_uf').select(...).abortSignal(signal)`. One caveat, worth budgeting a small fix for: with `<StrictMode>` (already active in `src/main.tsx`) + React 19, the deliberate dev-mode mount→unmount→remount can abort an in-flight query and surface a benign `AbortError`; queryFn should treat abort as "no error to report," which is standard TanStack Query guidance, not a workaround specific to this app.

**Wiring:**
- `QueryClientProvider` wraps the app in `src/main.tsx`, **outside** `SessionProvider` — the metric cache is server-truth (Supabase), not user session state, and should not be cleared by `clearSession()`.
- `useMetricQuery(variableId, grain, year)` — query key `['sih-metric', variableId, grain, year]`, powers `MapasPage.tsx`'s choropleth.
- `useMunicipioMetricQuery(variableId, ufCode, year)` — query key `['sih-muni-metric', variableId, ufCode, year]`, powers drill-down (Section 3).
- `useCollectionStatus()` — one-shot, `staleTime: Infinity` within a session (the ledger doesn't change mid-class), warms `collectionStatusCache.ts` as a side effect or replaces it outright if the team prefers a single caching mechanism over two (a legitimate simplification: `collectionStatusCache.ts`'s synchronous-accessor requirement could itself be satisfied by `queryClient.getQueryData(['collection-status'])` read synchronously after `warmCollectionStatus()`'s promise resolves, avoiding a second parallel cache — recommended if the team adopts TanStack Query, to avoid two caching mechanisms for one dataset).
- `staleTime` for metric queries should be long (tens of minutes) or `Infinity`: SIH data for a given disease×year does not change mid-class-session, so re-fetching on every drill in/out is pure waste on classroom wifi.

**Interaction with `SessionProvider`:** unchanged in shape. `SessionProvider` continues to hold `mapAnalysis: MapAnalysisState` (the *selection*, not the *data*) and `dataset: SessionDataset` (the *assembled result*, set once at handoff confirm). The query cache is a third, orthogonal store — selection (reducer/session), remote data (query cache), and confirmed dataset (session) — each with a different lifetime and a different owner. Nothing about `SessionProvider.tsx`'s interface needs to change.

---

## 3. Município Drill-Down

Two genuinely different fetch shapes exist here — conflating them would be a mistake:

### 3.1 Live drill choropleth (one UF at a time)

Triggered by `mapView.level === 'municipio'` with `mapView.ufIbge` set (`src/routes/mapas/mapAnalysisState.ts`'s `MapViewState`, driven today by `BrazilMapCanvas.tsx`'s existing drill effect at lines ~380-410, which already fetches topojson for the drilled UF with a `loadTokenRef` cancellation guard). The metric fetch should mirror this exact trigger, scoped to `disease_id + uf_codigo + ano` — matching `sih_metric_muni`'s existing index (`sih_metric_muni_uf_ano on (disease_id, uf_codigo, ano)`, confirmed in `docs/SUPABASE-CATALOG.md`). This bounds each on-demand fetch to one state's municipalities (São Paulo's ~645 is the worst case), never the full ~5,570-row national table — fetching all of Brazil's municípios for a disease×year when the user is looking at one drilled state would be over-fetch that directly hurts classroom-wifi behavior.

**Where it lives:** a `useMunicipioMetricQuery(activeVariableId, ufIbge, year)` call co-located in `MapasPage.tsx` next to `choroplethValues`, gated by `enabled: mapView.level === 'municipio'`. Not inside `BrazilMapCanvas.tsx` — that component should stay presentational, receiving `choroplethValues`/`choroplethStatus` as props exactly as it does today (it already destructures `choroplethValues` at the top of its props and reads `choroplethValues[path.id]` per feature — no shape change needed, just a different key set: 7-digit IBGE município codes instead of UF siglas).

**Cancellation:** handled by TanStack Query's key-based cancellation — when `ufIbge` changes (drill A→B), the previous query is aborted via the `AbortSignal` passed into `queryFn` and into `supabase...abortSignal(signal)`; when the user drills back out (`mapView.level` returns to `'uf'`), the municipio query simply becomes inactive (not garbage-collected immediately — default `gcTime` keeps it warm for a few minutes), so drilling back into the **same** UF within that window is a cache hit, not a refetch. This satisfies "cached across drill in/out cycles" without bespoke code.

**Code-level detail worth flagging for planners:** `sih_metric_muni.municipio_codigo` is TabNet's 6-digit code; the app's territory model (`geo/types.ts`, drill features) uses 7-digit IBGE codes. This conversion (`.padStart(6,'0').slice(0,6)`, dropping the trailing check digit) is **already implemented correctly** in `fetchHandoffMetrics.ts` and `assembleHandoffTable.ts` today — centralize it once in `metricsSource.ts` rather than keeping two copies.

### 3.2 Handoff scatter-gather (municípios across arbitrary UFs)

Groups can contain municípios from different UFs (via paste, meso, or health-macro-region selection — confirmed by `collectGroupMunicipioMembership` in `MapasPage.tsx`, which indexes membership by `t.ibgeCode` with no UF grouping assumption). This is **not** the drilled-UF case — it's `fetchHandoffMetricLookup`'s existing chunked `.in('municipio_codigo', chunk)` scatter-gather (chunks of 80, confirmed in `fetchHandoffMetrics.ts`). Keep this shape, but move it into `metricsSource.ts`/`metricsRepository.ts` as `getMetricsForTerritories(...)`, invoked once at handoff-confirm time via `queryClient.fetchQuery`/`ensureQueryData` (not a bare `await` outside the cache) — so if the user already drilled into some of those UFs during the session, those município rows are already warm and are not re-fetched.

---

## 4. The Offline/Degraded Path

**Never let "no props yet" and "confirmed zero" look the same.** Concretely, `BrazilMapCanvas`/`ChoroplethLegend` should require an explicit status prop (TypeScript-enforced, no default) with four states, driven directly by the query's own status plus the ledger:

| Status | Trigger | UI treatment |
|---|---|---|
| `loading` | `useMetricQuery` is pending (first fetch, or key changed) | Skeleton/pulse over the choropleth shapes; never render `choroplethValues={}` silently — the current code already passes `{}` while the app decides what to show, which today is indistinguishable from "genuinely empty" |
| `error` | Query threw (network failure, RLS/config error) | Distinct visual (e.g. hatch pattern) + inline "Falha ao carregar dados — tentando novamente" with a manual retry action; never fall through to a blank map |
| `not-collected` | `useCollectionStatus`/`collectionStatusCache` says this disease×measure×grain has `status: 'missing'` for the selected filters | "Esse agravo/medida ainda não foi coletado neste grão" — a data-availability message, categorically different from an error or a genuine zero |
| `ok` | Query succeeded, `choroplethValues` populated (possibly with legitimately-zero cells, which are already never coerced from `null` per the existing `coercePackNumber`/omission convention) | Normal choropleth |

**Total absence of Supabase config** (`isSupabaseConfigured()` in `src/lib/supabaseClient.ts`, already returns a static boolean from env vars): surface a persistent, session-wide banner (Mapas page level, not just the choropleth) — "Sem conexão ao Supabase — modo offline, apenas N agravos disponíveis localmente" — and restrict the disease picker's *enabled* state to the diseases with a `localPackFallback.ts` entry, rather than letting the user select any of the 330 and discover the gap only after selecting. This is a render-time filter driven by the same `isSupabaseConfigured()` check the repository already uses to short-circuit `fetchHandoffMetricLookup` today.

**Network failure mid-session** (bad classroom wifi, config present but requests fail): rely on TanStack Query's default retry/backoff, `networkMode` awareness, and expose the `error` status above with a manual retry button — do not add a synthetic health-check ping. The `useCollectionStatus()` fetch that must run at Mapas mount anyway (Section 1.4) doubles as the natural connectivity probe: its failure is the same signal a "are we online" ping would give, without adding a second request type.

**Offline-pack fallback is opt-in per variable, never blanket:** `metricsRepository.ts`'s fallback to `localPackFallback.ts` only fires for the ~10 diseases that have a bundled pack, and the returned value is tagged `source: 'offline-pack'` so any UI surfacing it (choropleth legend caption, handoff sourceLabel) can say so — this preserves the "never render an empty map as if it were real data" guarantee in its stricter form: never render *substitute* data as if it were live either.

---

## 5. Taxonomy as the Single Source of Truth

### 5.1 What's actually driving the drift (verified, not assumed)

Reading `scripts/catalog/sync-lista-morb.mjs` shows the drift's real origin: it fetches TabNet's live `<select name="SLista_Morb__CID-10">` HTML and slugifies each `(code, label)` pair to a canonical id — **except** for codes present in a hand-maintained `KNOWN_BY_CODE` map (21 entries), which overrides the slug with a legacy pack-compatible id (`avc`, `ait`, `embolia_pulmonar`, `varizes_mmii`, …) **without validating that the hardcoded code number still matches the label TabNet actually returns for it**. PROJECT.md's diagnosis (`avc` → code 163 = "Outras doenças do olho e anexos") is exactly this: `KNOWN_BY_CODE[163] = 'avc'` was typed by hand against an assumption about TabNet's ordering that turned out to be wrong for 20 of the 21 entries.

A second, independent drift source, also verified by reading the files: `scripts/catalog/sql/{0,1,2,3,4}.sql` (330 `insert` rows total, confirmed by count) are **not generated by any script** — no `.mjs` file writes to `scripts/catalog/sql/`. They are a hand/one-off transcription of the same 330-disease list, kept in sync with `diseases.json` only by discipline, not by tooling. That means there are currently at least **three** independently-maintained encodings of the same 330 rows (`diseases.json` + `KNOWN_BY_CODE`, the `sql/*.sql` seed files, and whatever state actually landed in the live Supabase `sih_disease` table) with no generation edge connecting the second and third to the first.

### 5.2 Proposed generation DAG

```
                     TabNet live HTML (network, offline-pipeline-only, never at app runtime)
                                          │
                                          ▼
                 scripts/catalog/fetchTabnetListaMorb.mjs   (NEW — pure fetch + parse)
                                          │ writes (checked into git — diffable)
                                          ▼
                 scripts/catalog/tabnet-lista-morb.raw.json   (NEW — [{code, label}], untouched order)
                                          │
                                          ▼
                 scripts/catalog/generateCanonicalTaxonomy.mjs   (NEW — replaces sync-lista-morb.mjs's
                                          │                        id-assignment step)
                                          │  • canonical id = deterministic slug(label) [+code if dup]
                                          │  • legacy aliases come from a reviewed, explicit
                                          │    scripts/catalog/legacy-alias-map.json (id ← code, NOT
                                          │    id ← assumed-code) — every alias is checked against
                                          │    the RAW dump's label for that code before being applied;
                                          │    mismatch = hard fail, not a silent override
                                          ▼
        ┌─────────────────────────┬──────────────────────────┬───────────────────────────────┐
        ▼                         ▼                          ▼                               ▼
scripts/catalog/           src/features/catalog/     scripts/catalog/sql/            Supabase sih_disease
diseases.json               diseases.lista.json       generate-seed.sql (NEW,          (idempotent upsert via
(canonical, source          (runtime taxonomy —        generated, not hand-typed)       a migration script,
of truth for id/            regenerated verbatim                                        service-role only, run
label/tabnetCode)           from diseases.json)                                         once per taxonomy change)
```

### 5.3 Fail-closed validation — where it runs

New script, `scripts/catalog/validateTaxonomy.mjs`, following the exact convention already established by `scripts/catalog/validate.mjs` (which currently fail-closes on `CatalogEntry`/pack mismatches and is wired into `npm run pretest`/CI):

1. Load `diseases.json` (canonical) and re-derive `diseases.lista.json` in-memory; assert byte-for-byte match against the committed file — catches hand-edits or stale regeneration.
2. Load the raw TabNet dump (`tabnet-lista-morb.raw.json`) and assert every `diseases.json` entry's `(tabnetCode, label)` pair matches the raw dump exactly — this is the check that would have caught the current 20-entry corruption, because it verifies the override against the source instead of trusting the override.
3. Query (or load a fixture snapshot of) Supabase `sih_disease` and assert its `(id, tabnet_code, label)` triples match `diseases.json` for all 330 rows — catches drift between the generated artifact and what's actually live.
4. Query `sih_metric_uf`/`sih_metric_muni` distinct `disease_id` values and assert every one exists in `diseases.json` — catches orphaned metric rows referencing a renamed/deleted id (the exact failure mode a naive id-rename migration would produce if it updated `sih_disease` but forgot to cascade to the metric tables).
5. Exit non-zero on any mismatch, exactly like `validate.mjs` does today — wired into the same `pretest`/CI gate so it runs on every commit that touches the taxonomy, not just when someone remembers to run it manually.

### 5.4 The one-off migration vs. the recurring loop

Migrating the 20 already-corrupted ids in the **live** Supabase tables (per PROJECT.md's locked decision to migrate ids rather than re-scrape 1.1M rows) is a separate, one-time script (`scripts/catalog/migrateDiseaseIds.mjs`, service-role only, transactional, with a before/after row-count assertion per disease to prove no data loss) — it runs once during Phase 8 and is then retired. The DAG in 5.2 is the **recurring** loop that prevents the *next* drift, and it is what Phase 8's fail-closed gate protects going forward.

---

## 6. Suggested Build Order — Phases 8-12

(Continuing PROJECT.md's locked build order: Phase 7 = baseline verde, already scoped elsewhere. This section covers 8-12.)

### Phase 8 — Taxonomia canônica + integridade fail-closed
**Must come first.** Two hard dependencies force this:
- The pipeline (Phase 9) keys its ledger and every upserted row on `disease_id`. Running a multi-day, 4-measure × 330-disease overnight scrape *before* the ids are stable means re-keying the entire ledger and re-validating the entire upload after the fact — paying for the corruption twice. Migrate ids first, collect second.
- Phase 8's `validateTaxonomy.mjs` becomes the CI gate every later phase's Supabase-touching code implicitly trusts (`disease_id` joins, ledger keys, client-side `parseCatalogId`). Building Phase 9/10 against an unvalidated taxonomy means discovering the same 20-entry corruption class again mid-collection.

### Phase 9 — Pipeline confiável + coleta completa
**Depends on Phase 8** (stable ids to key the ledger on). Two things Phase 9 must ship that Phase 10 directly depends on, stated explicitly so Phase 10 doesn't invent a competing mechanism:
- The retry/resume ledger from PROJECT.md's requirement, **and** its client-readable summary table `sih_collection_status` (Section 1.4) — this is new scope this research is adding to Phase 9's definition, not something PROJECT.md already specifies at this level of detail, but it is required for Phase 10's honest-degradation design (Section 4) and for the reducer's synchronous year-availability calls (Section 1.3) to have a real backing store instead of each being reinvented ad hoc inside Phase 10.
- **Nuance for the roadmapper:** Phase 10 does not need Phase 9's full collection run to *finish* — only the `sih_collection_status` table's *schema* to exist (even sparsely populated) so Phase 10's client code can be built and tested against a real, if incomplete, ledger. This means Phase 9 and Phase 10 can overlap in wall-clock time (parallel waves) as long as Phase 9 ships the schema early within its own phase; only the *demo-readiness* of "any of 330 diseases shows real data" depends on Phase 9's collection being complete, not the *code* being correct. Sequence the phases 9→10, but do not block Phase 10's start on Phase 9's last scrape row landing.

### Phase 10 — Mapas dinâmicos sobre Supabase
**Depends on Phase 9's ledger schema** (not full completion, per above) and **Phase 8's stable ids** (its queries key on `disease_id`). This phase is where Sections 1-4 of this document land: `metricsSource.ts` → `metricsRepository.ts` → `collectionStatusCache.ts`/query-cache wiring → `MapasPage.tsx`/`BrazilMapCanvas.tsx` status threading → município drill-down → deletion of `fetchHandoffMetrics.ts`. Suggested internal wave order (so a later wave never has to undo an earlier one):
1. `metricsSource.ts` + `metricsRepository.ts` + `collectionStatusCache.ts`, unit-tested against mocked rows (no live network in CI, preserving the existing `getSupabase() → null in test mode` convention) — no UI changes yet.
2. `QueryClientProvider` wiring in `src/main.tsx` + `useMetricQuery`/`useMunicipioMetricQuery` hooks + `MapasPage.tsx` swap of `choroplethValues` from `useMemo` to the new hook + `choroplethStatus` prop threading into `BrazilMapCanvas.tsx`/`ChoroplethLegend.tsx` (Section 4's four-state UI).
3. Repoint the reducer-adjacent synchronous call sites (`mapAnalysisState.ts`, `MeasureDiseasePicker.tsx`'s `FIRST_LOADABLE_MEASURE`, `catalogYearOptions.ts`) to `collectionStatusCache.ts` — this wave is intentionally *after* wave 2 so the ledger-backed accessor already exists and is proven correct before the reducer depends on it.
4. Município drill-down query + cross-UF handoff scatter-gather; delete `fetchHandoffMetrics.ts`; repoint `ReviewAnalysisDialog.tsx`/`assembleHandoffTable.ts`.
5. Gate: exercise a sample of diseases beyond the original 10 (spot-check, not all 330) end-to-end, and verify the four degraded states (Section 4) render correctly with Supabase env unset in a test harness.

### Phase 11 — Fluxo pesquisa → estatística
**Depends on Phase 10 completing** — this phase is literally the consumer of Phase 10's unified data-access layer at the map→table→test boundary (`ReviewAnalysisDialog.tsx`/`assembleHandoffTable.ts`, already modified in Phase 10 wave 4). Building this before Phase 10 would mean assembling handoff tables against the exact split this milestone exists to eliminate. What's left for Phase 11 specifically is provenance threading end-to-end (map selection → assembled table → chosen test → result still shows where the numbers came from) and the "não reinvente proveniência" requirement — a UX/data-shape concern layered on top of, not competing with, Phase 10's fetch mechanics.

### Phase 12 — Varredura de bugs e UAT
**Last, by necessity** — it's a cross-cutting verification pass over the surface every prior phase touched (Estatística, Variáveis, Mapas). Sequencing it earlier means re-running it after 8-11 land regardless.

---

## 7. Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching whole-Brazil município rows per disease×year
**What people do:** query `sih_metric_muni` filtered only by `disease_id` + `ano`, matching the "~5,570 rows" scale mentioned in the milestone brief, then filter client-side to the drilled UF.
**Why it's wrong:** the table's own index is `(disease_id, uf_codigo, ano)` — over-fetching ignores it, wastes classroom wifi, and makes every drill-in feel slow regardless of caching.
**Instead:** always include `uf_codigo` in the drill-down query (Section 3.1); only the handoff scatter-gather (Section 3.2), which genuinely spans arbitrary UFs, should fetch broadly, and even then it's bounded by the user's actual selected territories, not the whole country.

### Anti-Pattern 2: Inferring "not collected" from an empty result set
**What people do:** treat zero rows returned from Supabase as equivalent to "no data" and render the same UI as a genuine zero-case or a still-loading case.
**Why it's wrong:** for 320 of 330 diseases, most measures are (as of the 2026-07-28 diagnosis) simply not collected yet — an empty query result and "haven't scraped this yet" are the same shape over the wire but must not be the same shape in the UI, per the explicit "never render an empty map as if it were real data" constraint.
**Instead:** the `sih_collection_status` ledger (Section 1.4/4) is the only source that can distinguish "not collected" from "collected, confirmed empty for these filters" — never infer collection status from row count alone.

### Anti-Pattern 3: Letting the reducer "wait" for async data
**What people do:** turn `mapAnalysisReducer` into an async-aware reducer (thunks, `dispatch(await fetchX())`) to let it react to Supabase state.
**Why it's wrong:** breaks `useReducer`'s purity contract, makes `REPLACE_STATE`/undo-style operations unreliable, and conflates "what the user selected" with "what the server has" — two different lifetimes that should not share one state container.
**Instead:** the reducer only ever consumes the small, pre-warmed, synchronous ledger cache (Section 1.3); all genuinely async metric data lives in the query cache and is read by components via hooks, never dispatched into the reducer.

### Anti-Pattern 4: Trusting a hand-maintained id override map without validating it against its source
**What people do:** exactly what `scripts/catalog/sync-lista-morb.mjs`'s `KNOWN_BY_CODE` does today — assert `code → legacy-id` by hand and never check it against the label TabNet actually serves for that code.
**Why it's wrong:** this is the literal root cause of the current 20-entry corruption (Section 5.1).
**Instead:** every alias/override must be validated against the raw source dump at generation time (Section 5.2's `legacy-alias-map.json` + fail-closed check), not merely asserted.

---

## Sources

- Direct code inspection (HIGH confidence, cited inline throughout): `src/features/catalog/catalogAnalysisData.ts`, `fetchHandoffMetrics.ts`, `taxonomy.ts`, `loadCatalog.ts`, `sihVariableIds.ts`; `src/routes/mapas/MapasPage.tsx`, `mapAnalysisState.ts`, `BrazilMapCanvas.tsx`, `ReviewAnalysisDialog.tsx`, `assembleHandoffTable.ts`, `MeasureDiseasePicker.tsx`, `catalogYearOptions.ts`; `src/shared/session/SessionProvider.tsx`; `src/lib/supabaseClient.ts`; `scripts/catalog/build.mjs`, `validate.mjs`, `sync-lista-morb.mjs`, `uploadSihToSupabase.mjs`, `sql/*.sql`; `docs/SUPABASE-CATALOG.md`; `.planning/PROJECT.md`, `.planning/ROADMAP.md`.
- [TanStack Query — Query Cancellation (React)](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) — confirms `queryFn` receives a per-query `AbortSignal` (MEDIUM confidence — official docs, not project-specific verification).
- [Supabase JS Docs — `abortSignal`](https://supabase.com/docs/reference/javascript/db-abortsignal) — confirms PostgREST query builder accepts `.abortSignal(signal)` for request cancellation (MEDIUM confidence — official docs).
- React 19 + TanStack Query v5 + StrictMode interaction (double-mount aborting in-flight queries) — noted via community/GitHub discussion, flagged LOW/MEDIUM confidence as a known gotcha to budget a small fix for, not a blocker.
