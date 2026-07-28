# Stack Research

**Domain:** Hardening an existing DataSUS TabNet scraping pipeline (Python) + serving 1.1M+ Supabase/PostgREST rows to a Vite/React choropleth + safe PK migration on a 1.1M-row Postgres table
**Researched:** 2026-07-28
**Confidence:** HIGH — every "add this" and "don't add this" call below is grounded in either Context7-verified official docs, a currently-installed-tool version check on this machine, or a direct read of the exact code this milestone must harden.

> **Scope note:** this file supersedes the previous `.planning/research/STACK.md` (dated 2026-07-25, v2.0 research) for v3.0 purposes, but does **not** re-litigate it. That file's recommendations (React 19 + Vite 8 + Tailwind 4 + shadcn/ui, Chart.js 4 + `chartjs-chart-geo`/`chartjs-chart-error-bars`, `jstat` + `ml-matrix` + custom IRLS `glm.js`, the geodata/mapshaper pipeline, the meta-analysis module) are **already shipped and validated** per `.planning/PROJECT.md`'s "Estado herdado do v2.0" — do not re-research or second-guess them here. This file covers **only** the four new capabilities v3.0 adds: (a) a resilient/resumable Python scraping pipeline, (b) efficient large-table Supabase/PostgREST querying from the browser, (c) client-side caching for that data, and (c′) a safe primary-key migration on the Supabase tables.

## TL;DR — the four calls that matter

1. **Python scraper: add zero pip packages.** The observed bug ("DNS failure logged as OK · 0 linhas, uploaded, cache deleted") is not a missing-library problem — it's two specific, findable code defects (below). Fix them with ~60 lines of stdlib (`sqlite3` + `urllib` + `time`/`random`), not `tenacity`.
2. **Supabase JS: add zero new packages.** `@supabase/supabase-js` (already installed) already has everything needed — `.range()` and `count: 'exact'|'planned'|'estimated'`. The fix is a pagination *pattern*, applied to a query that already exists in this repo and is already at risk of silently truncating.
3. **Client caching: add `@tanstack/react-query` v5.101.4.** This is the one genuine "yes, add a new dependency" recommendation in this document.
4. **Postgres PK migration: add zero new tools.** Supabase CLI is already on this machine (v2.90.0). Use a native Postgres `ON UPDATE CASCADE` + one transaction. No `pg` npm package, no external migration framework.

---

## Part (a) — Hardening the DataSUS TabNet scraper (Python)

### What's actually broken (read directly from the code, not inferred)

`trabalhos datasus/scripts/coleta_sih_multi_disease.py::scrape_one()`:

```python
print(
    f"OK {disease['id']}: {len(uf_rows)} UF rows · {len(muni_rows)} muni rows → {csv_path}",
    flush=True,
)
if cleanup and not errors and len(uf_rows) > 0:
    cleanup_raw(disease["id"])
```

The `print("OK …")` line does **not** check `errors` before printing "OK." If every measure failed (e.g. DNS resolution failure mid-run), `uf_rows`/`muni_rows` are empty lists, `errors` is non-empty, and the log still says `OK <disease>: 0 UF rows · 0 muni rows` — this is the exact line quoted in `.planning/PROJECT.md`. The `errors`-gated raw-cache cleanup on this line is actually *correct* (it does check `not errors`) — the bug is purely the misleading log line, but it's the one a human (or a "did it work" grep) trusts.

`trabalhos datasus/scripts/scrape_upload_sih.py::main()` (the one `npm run scrape:overnight` actually drives, via `overnight_watchdog.sh`):

```python
uf_rows = load_csv_rows(coleta.OUT_ROOT / did / f"base_{did}_uf_2013_2025.csv")
muni_rows = load_csv_rows(coleta.OUT_ROOT / did / f"base_{did}_muni_2013_2025.csv")
upload_disease(did, uf_rows, muni_rows)     # posts 0 rows silently — post_ingest() returns 0 for an empty list, no error
mark_uploaded(did, {...})                   # marks success unconditionally, even for 0 rows
cleanup_raw(did)                            # deletes the raw cache unconditionally, even for 0 rows
```

**Nothing here checks `len(uf_rows) > 0` before marking uploaded and deleting the raw cache.** This is the "cache bruto foi apagado" data-loss bug. Also worth noting: `post_tabnet()` (the actual TabNet HTTP call in `coleta_sih_multi_disease.py`) has **zero retry logic** — a single `urllib.request.urlopen()` call, no backoff, nothing. All the retry/backoff that exists today (`post_ingest`'s 4-attempt loop with `time.sleep(2 ** attempt)`) is on the *upload* side only, not the *scrape* side, which is backwards given DNS/connectivity is the failure mode actually observed.

### Recommendation: stdlib only, two new small modules

| Technology | Version | Purpose | Why (specific failure prevented) |
|------------|---------|---------|-----------------------------------|
| Python `sqlite3` (stdlib) | bundled — confirmed present, Python 3.9.6 on this Mac | Durable ledger keyed by `(disease_id, measure, grain)`, 330×4×2 = 2,640 rows | Replaces the current *implicit* "done" logic split across two disconnected signals (`coleta.disease_done()` checking `metadata.json`+CSV existence, `scrape_upload_sih.already_uploaded()` checking a separate `uploaded.json` marker file). Two markers that can desync is exactly how "scraped-but-not-really, marked-uploaded-anyway" bugs like this one happen. One table, one row per unit of work, one status enum — `INSERT … ON CONFLICT(disease_id,measure,grain) DO UPDATE …` is an atomic transaction, so a kill -9 mid-write can't corrupt it the way a half-written `uploaded.json` can. |
| Hand-written retry helper (stdlib `urllib.error`, `time`, `random`) | n/a | Retry+backoff wraps `post_tabnet()` (currently has none) and replaces the ad hoc loop already in `post_ingest()` | Consolidates the ONE retry policy this project actually needs (retry on `urllib.error.URLError` / `TimeoutError` / `ConnectionError` / `http.client.HTTPException`, exponential backoff + jitter, ~5 attempts) into one ~15-line function, reused at both call sites. Prevents the specific DNS-drop-mid-scrape failure mode by giving transient network errors a chance to clear before giving up loudly. |
| macOS `caffeinate` (ships with the OS) | n/a | Wrap the overnight run so the Mac doesn't sleep mid-scrape | A multi-hour unattended run on a laptop (lid closed / display sleep / App Nap) is the most likely real-world cause of a stalled overnight job — `caffeinate -i` (or `-s` on AC power) prevents idle sleep for the life of the wrapped process. Zero install: it's a macOS system binary. |

**Ledger schema** (new file, e.g. `trabalhos datasus/outputs/coleta_sih_multi/ledger.db`):

```sql
CREATE TABLE IF NOT EXISTS ledger (
  disease_id  TEXT NOT NULL,
  measure     TEXT NOT NULL,
  grain       TEXT NOT NULL CHECK (grain IN ('uf','municipio')),
  status      TEXT NOT NULL CHECK (status IN ('pending','scraped','uploaded','failed')) DEFAULT 'pending',
  attempts    INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER,
  last_error  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (disease_id, measure, grain)
);
```

State-machine rules the ledger must enforce (this is the actual fix, not the schema):
- `failed` is set (and printed as `FAIL`, never `OK`) whenever the per-measure `errors` list is non-empty — **regardless of row count**.
- `uploaded` is set — and only then is `cleanup_raw()` allowed to run — **after** comparing the ingest response's `upserted` count against the locally parsed row count. "OK" must mean *verified*, not *no exception happened to be thrown*.
- A `rows == 0` result with an empty `errors` list is still suspicious for a `lista_morb` disease that's supposed to carry município grain (`coleta.disease_done()` already encodes this rule — reuse it, don't re-derive it) — treat as `failed`, not `uploaded`, unless a human has confirmed the zero is real.
- `sqlite3 ledger.db "select status, count(*) from ledger group by status;"` is the entire "how's the overnight run going" dashboard — no new tooling needed, `sqlite3` ships with macOS.

**Integration points** (concrete file changes):
- New `trabalhos datasus/scripts/net.py` — the retry helper, imported by both `coleta_sih_multi_disease.py` (wrap `post_tabnet`) and `scrape_upload_sih.py` (replace the inline retry loop in `post_ingest`).
- New `trabalhos datasus/scripts/ledger.py` — thin `sqlite3` wrapper (`mark(disease_id, measure, grain, status, **fields)`, `pending()`, `summary()`).
- `coleta_sih_multi_disease.py::scrape_one()` — gate the `OK`/`FAIL` print on `errors`, call `ledger.mark(..., 'scraped', rows_written=len(uf_rows))` per grain.
- `scrape_upload_sih.py::upload_disease()` / main loop — only call `mark_uploaded()`/`cleanup_raw()` after comparing uploaded counts to local counts; call `ledger.mark(..., 'uploaded')` at that point, `'failed'` otherwise.
- `trabalhos datasus/scripts/launch_overnight.py` — change the `Popen` command from `["bash", str(SCRIPT)]` to `["caffeinate", "-i", "bash", str(SCRIPT)]`.
- `trabalhos datasus/scripts/overnight_watchdog.sh` — the current "is this phase done" check (`grep -q "ALL DONE" <(tail -n 5 log)`) is a fragile text-grep. Once the ledger exists, prefer `sqlite3 ledger.db "select count(*) from ledger where status != 'uploaded'"` == 0 as the authoritative completion signal; keep the log grep only as a secondary sanity check.

### Supervision on macOS: keep the current approach, don't add launchd

The existing `launch_overnight.py` (detached `subprocess.Popen(..., start_new_session=True)` + PID file) + `overnight_watchdog.sh` (bash `while true` crash-restart loop) is already the right shape for this job: a manually-triggered, multi-hour, occasional (a few times per semester) batch run. **Do not migrate this to a macOS `launchd` LaunchAgent.** `launchd` earns its complexity for *permanently scheduled* or *always-on* daemons; for an ad hoc "run once when a student kicks it off before bed" job, a plist + `launchctl bootstrap`/`bootout` (whose exact invocation has changed across recent macOS versions) is strictly more moving parts for zero benefit, and harder for a non-infra team to debug than "read the log file." The one real gap — sleep/App Nap killing connectivity mid-run — is solved by `caffeinate`, not by a different supervisor.

---

## Part (b) — Serving 1.1M+ Supabase rows to the browser choropleth

### The concrete row-limit fact (verified, not hand-waved)

PostgREST — and therefore every Supabase project — caps the number of rows a single request can return at **1,000 by default** (`db-max-rows`, called "Max Rows" in Dashboard → Project Settings → API / Data API settings). A plain `.select()` with no `.range()`/`.limit()` does **not** error when there are more matching rows than the cap — it silently returns exactly 1,000 and nothing tells the caller it was truncated unless you asked for `count`. Community reports also note the dashboard "Max Rows" setting has intermittently failed to take effect after being raised — so pagination correctness should not depend on a dashboard toggle at all.

**This repo already has a query at risk of hitting this today.** `src/features/catalog/fetchHandoffMetricLookup.ts` chunks município codes into batches of 80 and queries:

```ts
supabase.from('sih_metric_muni')
  .select('disease_id,municipio_codigo,uf_codigo,ano,internacoes,obitos,valor_total,dias_permanencia,taxa_mortalidade')
  .in('disease_id', diseaseList)
  .in('municipio_codigo', chunk)   // up to 80 codes
  // .in('ano', yearList) — only applied when req.year !== null
```

When a request's `year` is `null` ("all years"), no `ano` filter is applied. 80 municípios × 13 years (2013–2025) × N diseases already exceeds 1,000 rows for `N ≥ 1` disease with a `null` year, and any multi-disease overlay compounds it further. Today this silently returns a partial, effectively-arbitrary subset of município×year values with no error — the UI would show blank cells indistinguishable from "no data" for whatever got truncated. **This is a pre-existing latent bug, not a new-in-v3.0 risk** — it will get worse as município coverage goes from 10 diseases to 330.

### Recommendation: pagination pattern, not a new dependency

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` `.range(from, to)` | already installed (2.110.8; latest is 2.110.9, a no-op patch bump — no upgrade needed for this) | Loop-fetch any query whose result size isn't provably ≤1,000 rows | `.range()` is inclusive, zero-indexed pagination built into the client already in `package.json`. A small `selectAll()` helper (loop `.range(i, i+999)` until a page returns `< pageSize` rows) fixes the município-drilldown truncation risk without adding anything. |
| `count: 'exact' \| 'planned' \| 'estimated'` (built into `@supabase/supabase-js`) | already installed | Verify row counts, e.g. for the Part-(c′) migration check | `exact` triggers a real `COUNT(*)` (correct but O(n) — noticeable on a 1.1M-row table if run per-request); `planned` reads the query-planner's `pg_class.reltuples` estimate (instant, imprecise); `estimated` is Supabase's hybrid (uses the fast estimate above a threshold, falls back to exact below it). Use `exact` only for narrow, already-filtered counts (e.g. "rows for disease X" — small); never run `count: 'exact'` unfiltered against `sih_metric_muni` on every page load. |

**New file recommended:** `src/lib/supabasePaginate.ts` — a generic `selectAll<T>(build: (q) => q)` helper used by both `fetchHandoffMetricLookup.ts` (fix the existing latent bug above) and any new dynamic-map fetcher.

### Does the choropleth need an RPC / Postgres function / materialized view? No — for the query you actually described.

"27 UF values per disease×year" is, at most, 27 rows. `sih_metric_uf`'s primary key is `(disease_id, uf_codigo, ano)` — a plain `.select().eq('disease_id', x).eq('ano', y)` is already indexed (leading PK column matches `disease_id`) and returns ≤27 rows well under the 1,000 cap. **A materialized view here would be re-aggregating data that is already stored at exactly the grain needed** — `sih_metric_uf` *is* the pre-aggregated UF grain; there's nothing left to aggregate. It would also add real complexity for no benefit: materialized views have **no built-in Postgres RLS support**, so exposing one to the `anon` role would require either wrapping it in a `security_invoker` function or manually revoking/re-granting access — extra risk for a query this small doesn't need.

An RPC (`create or replace function ...` + `supabase.rpc(...)`) *would* earn its place for one specific future shape not currently in scope: a município drill-down aggregated across **many years at once** for a whole UF (e.g. 853 municípios in Minas Gerais × 13 years = 11,089 raw rows — genuinely over the 1,000 cap even after fixing the pagination bug, and mostly wasted bandwidth if the UI only wants a per-year sum). If/when that access pattern is built, a `SELECT uf_codigo, ano, sum(internacoes) ... GROUP BY` server-side function returns rows-per-year instead of rows-per-município-per-year — genuinely fewer rows over the wire. **Don't build this speculatively** — the milestone's stated shape (choropleth by disease×year, drill-down by disease×UF×year) doesn't need it yet; add it only when a specific query is measured to need >1,000 rows of raw data to compute an aggregate the client currently does in JS.

### Indexes

`sih_metric_uf` PK `(disease_id, uf_codigo, ano)` and `sih_metric_muni` PK `(disease_id, municipio_codigo, ano)` + secondary index `sih_metric_muni_uf_ano (disease_id, uf_codigo, ano)` (documented in `docs/SUPABASE-CATALOG.md`) already match the two access patterns that matter: choropleth (`disease_id, ano`) and drill-down (`disease_id, uf_codigo, ano`). **Verify the secondary index actually exists on the live table** (`docs/SUPABASE-CATALOG.md` documents it as intent, not confirmed-applied) — this is a phase-9/10 verification action item, not a new research gap. No new indexes are needed for the Part-(c′) rename — it only changes column *values*, not the schema, so both indexes remain valid and are updated transparently (and cheaply, since each rename only touches the rows for one `disease_id`, not the whole table) by Postgres as part of the `UPDATE`.

---

## Part (c) — Client-side caching: add `@tanstack/react-query`

This is the one clear "add a new dependency" call in this document.

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | **5.101.4** (latest v5, verified via `npm view` and Context7 `/tanstack/query`) | Parameterized cache + request dedup + honest loading/error/empty state for the *new* Supabase-backed map/metric queries | Wrap the new dynamic-choropleth fetch and the existing `fetchHandoffMetricLookup` call sites. **Not** a replacement for `loadCatalog.ts`. |
| `@tanstack/react-query-devtools` | 5.101.4 (dev only) | Inspect cache state (which disease/year/UF combos are cached, stale, loading, errored) while building the Mapas feature | Dynamically imported so it's excluded from the production bundle; genuinely useful for a team debugging "why didn't the map update" without instrumenting print statements. |

**Why this, specifically, given the constraint "small dependency surface, medical students not infra engineers":**

The milestone requires *"cache e estados de carregamento/vazio honestos"* across a choropleth where the user can rapidly change disease, year, UF drill-down, and multi-disease overlay (already shipped in v2.0 Phase 4). That's a **keyed** async-cache problem: many distinct `(disease, year, uf?)` combinations, each independently loading/cached/stale, with the very real risk of race conditions — user picks disease A, then quickly disease B; A's slower response arrives after B's and silently overwrites the UI with stale data for A. This is a well-known, easy-to-introduce bug class with `useEffect`+`useState`, and it's *exactly* what TanStack Query's `queryKey`-scoped caching and automatic stale-response handling exist to prevent.

The existing hand-rolled cache in `src/features/catalog/loadCatalog.ts` is real, but solves a **different, much simpler** problem: one fixed cache key (there is exactly one manifest, one `variables.json`, and a fixed set of packs), same-origin static files, never invalidated. Extending that same pattern to a parameterized, high-cardinality (330 diseases × ~13 years × 27 UFs), retry-needing, race-condition-prone cache means re-implementing — by hand — the core of what TanStack Query already does correctly: keyed caching, in-flight de-dup, stale-response cancellation, garbage collection of unused entries, and three-state (loading/error/empty-vs-has-data) tracking per key. That's more code, and a subtler bug surface, than installing one ~13kB (gzipped, core) library that is also the single most common companion to `supabase-js` in the wider React ecosystem — meaning both official examples and AI-assisted development (which this team already leans on) are far more aligned with this pattern than with a bespoke cache.

**Integration points:**
- New `src/lib/queryClient.ts` — singleton `QueryClient` with defaults tuned for this domain: `staleTime` generously long (this is static historical DataSUS data within a session — it does not change), `retry: 2`, `refetchOnWindowFocus: false` (this is a teaching tool, not a live dashboard).
- Wrap the app root (wherever `<Header>`/route shell mounts, per `src/app/Header.tsx`) in `<QueryClientProvider client={queryClient}>`.
- New `src/features/mapas/fetchChoroplethMetric.ts` (new file for the new dynamic-map capability) — `fetchUfMetric(diseaseId, year)` — wired via `useQuery({ queryKey: ['sih_metric_uf', diseaseId, year], queryFn })` in whichever component currently reads the static `catalogAnalysisData.ts` packs (the file `.planning/PROJECT.md` names as the "mapa não dinâmico" culprit).
- `src/features/catalog/fetchHandoffMetricLookup.ts` — keep the function as a plain async helper; call it through `useQuery` at the call site (e.g. in `ReviewAnalysisDialog`) instead of ad hoc `useState`/`useEffect`, gaining dedup and cancellation for free.
- **Do not touch `src/features/catalog/loadCatalog.ts`.** It's solving a different (simpler, already-correct) problem.

---

## Part (c′) — Safe primary-key rename on `sih_disease` (330 rows) with FK-referencing children (`sih_metric_uf` 30k rows, `sih_metric_muni` 1.1M rows)

**Terminology check, because this matters for scoping:** this is a **data-value migration** (changing the *value* of ~20 primary key strings, e.g. `avc` → a correct slug), not a DDL "rename column" operation. `ALTER TABLE … RENAME COLUMN` is irrelevant here — don't let a phase plan reach for it.

### The actual constraint that makes this dangerous

`docs/SUPABASE-CATALOG.md`'s schema declares the FKs with no `ON UPDATE`/`ON DELETE` clause:

```sql
disease_id text references sih_disease(id)
```

That defaults to `ON UPDATE NO ACTION` — meaning a bare `UPDATE sih_disease SET id = 'novo_slug' WHERE id = 'avc'` will be **rejected immediately** by the FK constraint the instant it runs, because `sih_metric_uf`/`sih_metric_muni` rows still reference the old value at that point in the transaction (the constraint is not `DEFERRABLE`, so it's checked at statement end, not transaction end).

### Recommended pattern: add `ON UPDATE CASCADE` once, permanently, then rename

```sql
-- 1. One-time schema hardening (find real constraint names first — see below).
BEGIN;

ALTER TABLE sih_metric_uf
  DROP CONSTRAINT sih_metric_uf_disease_id_fkey,
  ADD  CONSTRAINT sih_metric_uf_disease_id_fkey
    FOREIGN KEY (disease_id) REFERENCES sih_disease(id) ON UPDATE CASCADE;

ALTER TABLE sih_metric_muni
  DROP CONSTRAINT sih_metric_muni_disease_id_fkey,
  ADD  CONSTRAINT sih_metric_muni_disease_id_fkey
    FOREIGN KEY (disease_id) REFERENCES sih_disease(id) ON UPDATE CASCADE;

-- 2. The actual rename — one statement per (or one UPDATE ... FROM a mapping table for all ~20 at once).
--    Postgres cascades this to matching rows in both child tables automatically, using the
--    existing indexed disease_id lookup — it only touches rows for the renamed ids, not all 1.1M.
UPDATE sih_disease SET id = 'infarto_cerebral' WHERE id = 'avc';
-- … repeat for the ~19 other renames, or drive from a VALUES/temp-table mapping in one UPDATE ... FROM.

COMMIT;
```

Why this beats the alternative (`INSERT new row → UPDATE children → DELETE old row`, done manually to dodge the FK check): it's fewer statements, it's the standard idiomatic Postgres answer to "I need to change a referenced key," and — deliberately — it's a **permanent** schema improvement. Taxonomy corrections are an ongoing concern for this project (apelidos, future Lista Morb updates per `PROJECT.md`), so `ON UPDATE CASCADE` being in place going forward removes the need to ever re-derive this dance. Leave `ON DELETE` at its default (`NO ACTION`/restrict) deliberately — you want an accidental `DELETE FROM sih_disease` to fail loudly, not silently cascade-delete 1.1M rows.

**Before running any of this:**
1. Find the real constraint names — don't assume the auto-generated `<table>_<column>_fkey` pattern:
   ```sql
   SELECT conname, conrelid::regclass FROM pg_constraint
   WHERE contype = 'f' AND confrelid = 'sih_disease'::regclass;
   ```
2. Take a cheap safety-net backup (seconds, on a table this size): `CREATE TABLE sih_metric_muni_backup_20260728 AS TABLE sih_metric_muni;` (and the same for `sih_metric_uf`, `sih_disease`).
3. Test the exact script against a local Supabase stack (`supabase start`) before running it against the live project.

**Verification (no new tooling — reuse `@supabase/supabase-js` + service role, the same pattern already used in `scripts/catalog/uploadSihToSupabase.mjs`):** write a small `scripts/catalog/verifyDiseaseIdMigration.mjs` that, for each renamed id, compares `count: 'exact'` row totals before vs. after (`sih_metric_muni` where `disease_id = old_id` pre-migration must equal `sih_metric_muni` where `disease_id = new_id` post-migration), plus a whole-table row-count invariant (`SELECT count(*) FROM sih_metric_muni` must be numerically identical before and after — only values changed, no rows created or destroyed).

**Tooling:** Supabase CLI (`supabase --version` → **2.90.0**, already installed via Homebrew on this machine) is sufficient — `supabase migration new rename_disease_ids_v3` produces a versioned, reviewable `.sql` file under `supabase/migrations/` (this repo doesn't have that directory yet; `scripts/catalog/sql/*.sql` is currently an ad hoc, unversioned, dashboard-pasted pattern — fine for one-off seed inserts, **not** appropriate for a migration this risky). No `pg` npm package, no external migration framework — the CLI already opens the Postgres connection needed for `db push` / `db execute`.

This migration must run with the **service role** (or the Postgres owner role), never the anon key — consistent with the existing constraint that the client is read-only and all writes are offline/service-role only.

---

## Installation

```bash
# JS — the one new dependency
npm install @tanstack/react-query
npm install -D @tanstack/react-query-devtools

# Python — nothing to install. Zero third-party packages exist in this
# project's Python side today (confirmed: `pip list` returns none of
# tenacity/requests/httpx/urllib3 on this machine, Python 3.9.6). Keep it that way.
```

## Alternatives Considered

| Recommended | Alternative | When to use the alternative instead |
|-------------|-------------|--------------------------------------|
| Stdlib retry helper (`urllib`+`time`+`random`) | `tenacity` 9.1.4 (verified current on PyPI) | If retry policies proliferate across many independent third-party HTTP integrations needing composable stop/wait/retry-on strategies. This project has exactly two call sites (TabNet scrape, Edge Function upload) — not enough surface to justify becoming the project's first pip dependency. |
| `sqlite3` ledger (stdlib) | Plain JSONL append-only log | If an audit trail matters more than a queryable "current state," and you're willing to write a replay-to-compute-current-state reader. `sqlite3` gives you both (the table *is* the audit trail via `updated_at`, and it's directly queryable) for about the same amount of code. |
| `@tanstack/react-query` | Hand-rolled keyed `Map` cache (extending the `loadCatalog.ts` pattern) | If the team wants literally zero new JS dependencies and is willing to hand-implement request de-dup, stale-response cancellation, and cache eviction (`gcTime`) themselves. Technically possible; a real increase in bug surface for the exact race-condition class described above. |
| `ON UPDATE CASCADE` + one transaction | Manual `INSERT new → UPDATE children → DELETE old` dance | If you don't control the schema (can't `ALTER` the FK constraints) — not the case here; this project owns the Supabase schema outright. |
| Supabase CLI migration file | Ad hoc SQL pasted into the dashboard SQL editor (current `scripts/catalog/sql/*.sql` pattern) | Fine for small, low-risk, easily-redone seed inserts. Not appropriate for an irreversible, 1.1M-row-touching PK value change — that needs to be reviewable and re-runnable against a local stack first. |

## What NOT to Use

| Avoid | Why | Use instead |
|-------|-----|--------------|
| `tenacity` / `backoff` (pip) | Would be this project's **first** third-party Python dependency — requires a `requirements.txt` + `pip install`/venv onboarding step for a team with no existing Python dev-env habit (confirmed: zero packages installed today). The actual gap — `post_tabnet()` has zero retry — is a ~15-line stdlib function, not a policy engine. | Shared `retry()` helper in a new `trabalhos datasus/scripts/net.py`. |
| `httpx` / `aiohttp` / any concurrent-request approach | The scraper's `REQUEST_DELAY_SEC`/`DISEASE_PAUSE_SEC` throttling exists *on purpose* to avoid hammering TabNet — `PROJECT.md`'s Out-of-Scope section explicitly cites TabNet ToS/instability as the reason live scraping is forbidden at all. Concurrency directly fights that constraint. | Keep sequential `urllib.request` calls; the ledger buys resumability, not throughput. |
| macOS `launchd` LaunchAgent | Plist authoring + `launchctl bootstrap`/`bootout` (semantics changed across recent macOS releases) for a job triggered manually a handful of times per semester — not a permanently-scheduled daemon. More moving parts, harder to debug than a log file, for a team of medical students. | Keep the existing `subprocess.Popen(start_new_session=True)` + bash watchdog; add `caffeinate -i`. |
| Raising the Supabase dashboard "Max Rows" above 1000 | Reported to sometimes not take effect after being changed (propagation bug); also raises the worst-case payload size for *every* anon-key query project-wide, working against the "read-only anon, minimal blast radius" posture already chosen for this app. | `.range()` pagination loop in a small `selectAll()` helper — correctness that doesn't depend on a dashboard toggle. |
| A materialized view for the UF choropleth | `sih_metric_uf` already **is** the pre-aggregated UF grain (that's its entire purpose) — nothing left to aggregate. Materialized views also have no built-in RLS support in Postgres, adding a real security-review item for zero query-shape benefit here. | Plain indexed `.select().eq('disease_id', x).eq('ano', y)` — already ≤27 rows. |
| `pg` (node-postgres) npm package, for running the PK-rename migration | Supabase CLI (already installed, v2.90.0) already opens a Postgres connection for `db push`/SQL execution — a second, npm-installed way to do the same thing for a single one-off script is pure duplication. | `supabase migration new` + `supabase db push`, or the SQL editor, wrapped in `BEGIN`/`COMMIT`. |
| Migrating `src/features/catalog/loadCatalog.ts`'s static-JSON cache onto TanStack Query | Different, already-correct, already-simple problem: one fixed cache key, same-origin static files, never invalidated. Nothing to gain. | Leave it untouched; scope TanStack Query to the *new* parameterized Supabase queries only. |

## Stack Patterns by Variant

**If a `(disease_id, measure, grain)` combo fails after all retry attempts:**
- Ledger row → `status='failed'`, `last_error` populated, `attempts` incremented.
- Runner prints `FAIL`, not `OK`, and moves on to the next combo.
- Because: this is the exact regression this milestone exists to fix.

**If TabNet legitimately returns zero rows for a combo:**
- Only transition to `status='uploaded'` after comparing the ingest response's `upserted` count to the locally parsed row count, **and** confirming the per-measure `errors` list was empty.
- Because: "OK" must mean *verified*, not *"no exception happened to fire this time."*

**If a future map view needs a cross-year or cross-UF-group aggregate not already in `sih_metric_uf`:**
- Add one small `SELECT … GROUP BY` Postgres function, called via `supabase.rpc(...)`.
- Because: only earns its complexity when a query would otherwise pull more raw rows over the wire than needed just to sum client-side — not the case for the default disease×year choropleth today.

## Version Compatibility

| Package A | Compatible with | Notes |
|-----------|------------------|-------|
| `@tanstack/react-query@5.101.4` | `react@19.2.8` (installed) | v5 requires React 18+; no known React 19 issues. |
| `@supabase/supabase-js@2.110.8` (installed) | `@supabase/supabase-js@2.110.9` (latest) | One patch behind; nothing range/count-relevant changed. Upgrade opportunistically, not urgently. |
| Python 3.9.6 (macOS system `python3`, confirmed on this machine) | stdlib `sqlite3` | Needs SQLite ≥3.24 for `ON CONFLICT DO UPDATE` (upsert) — modern macOS bundles a much newer SQLite than that, but confirm with `python3 -c "import sqlite3; print(sqlite3.sqlite_version)"` before relying on it. |
| Supabase CLI 2.90.0 (installed) | Supabase-managed Postgres (15/17) | `ON UPDATE CASCADE` and non-`DEFERRABLE` FK checks are decades-old, stable Postgres behavior — no version risk. |

## Sources

- Context7 `/supabase/postgrest-js` — verified `.range()` pagination semantics and the `count: 'exact' | 'planned' | 'estimated'` `Prefer` header contract (type signature + `Content-Range` parsing code read directly) — **HIGH** confidence.
- Context7 `/tanstack/query` — verified v5 `QueryClientProvider` setup and `staleTime`/`gcTime` API surface — **HIGH** confidence.
- WebSearch, "PostgREST db-max-rows default 1000 Supabase max rows setting dashboard" — confirmed the 1,000-row default and the Dashboard → Settings/Integrations → Data API → Max Rows location, and a community-reported case where raising it didn't take effect — **MEDIUM** confidence (community reports, not an official doc page fetched directly; the 1,000-row default itself is well-corroborated across multiple independent threads).
- `npm view @tanstack/react-query version` / `npm view @supabase/supabase-js version` — **5.101.4** / **2.110.9** — **HIGH** confidence (npm registry, authoritative).
- `pypi.org/pypi/tenacity/json` — **9.1.4** — cited only to make an informed "do not add" call — **HIGH** confidence.
- Direct reading of this repo's own code — `coleta_sih_multi_disease.py`, `scrape_upload_sih.py`, `overnight_watchdog.sh`, `launch_overnight.py`, `scripts/catalog/uploadSihToSupabase.mjs`, `src/features/catalog/fetchHandoffMetricLookup.ts`, `src/features/catalog/loadCatalog.ts`, `src/lib/supabaseClient.ts`, `docs/SUPABASE-CATALOG.md`, `.planning/PROJECT.md` — root-caused both the "OK · 0 linhas" print bug and the unconditional-cleanup-after-upload bug, and found a live latent row-truncation risk in `fetchHandoffMetricLookup.ts` — **HIGH** confidence, primary source.
- `pip list` + `python3 --version` on this machine — confirmed **zero** third-party Python packages currently installed, Python **3.9.6** — **HIGH** confidence.
- `which supabase && supabase --version` — confirmed Supabase CLI **2.90.0** already installed via Homebrew — **HIGH** confidence.

---
*Stack research for: Bioestatística LACIR v3.0 — dados confiáveis + pesquisa dinâmica via Supabase (scraping pipeline, PostgREST querying, client caching, PK migration)*
*Researched: 2026-07-28*
