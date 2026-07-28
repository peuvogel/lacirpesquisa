# Pitfalls Research

**Domain:** Adding a live Supabase/PostgREST research backend + hardened DataSUS TabNet scraping to an existing client-side didactic biostatistics app (Bioestatística LACIR)
**Researched:** 2026-07-28
**Confidence:** HIGH for pitfalls grounded directly in this repo's code/incident history (cited by file path); MEDIUM/LOW flagged individually for general web-scraping, PostgreSQL, and React-async claims verified only via WebSearch

This research is deliberately forensic: most pitfalls below are not generic advice, they are read directly out of `trabalhos datasus/scripts/coleta_sih_multi_disease.py`, `trabalhos datasus/scripts/scrape_upload_sih.py`, `scripts/catalog/validate.mjs`, `scripts/catalog/diseases.json`, `scripts/catalog/columnMap.json`, and `src/features/catalog/catalogAnalysisData.ts` as they exist today — i.e. the same code that produced the four documented v2.0 defects. Each pitfall names the exact mechanism in the current code that allows it, not a hypothetical.

## Critical Pitfalls

### Pitfall 1: A degraded-but-200-OK TabNet response is indistinguishable from a true zero

**What goes wrong:**
`fetch_metric()` in `coleta_sih_multi_disease.py` only raises when `urlopen` itself fails (DNS error, timeout, HTTP error) or when the response has no `<PRE>` tag at all (`parse_prn_table` raises `RuntimeError`). But TabNet can return **HTTP 200 with a `<PRE>` block present** that contains an error/session/maintenance message instead of a data table (e.g. "Nenhum registro encontrado", a session-expired notice, or a truncated table for an unavailable filter combination). In that case `parse_prn_table` succeeds, `table_to_long_uf`/`municipal_long`'s regexes (`^(\d{2})\s+(.+)$`, 6-digit município code) simply fail to match any row, and the function returns `[]` — **no exception, no entry in `errors`**. `scrape_one()` then writes `metadata.json` with `"errors": []` and `"rows": 0`, which is exactly the shape that was previously logged as `OK <disease>: 0 UF rows · 0 muni rows` and treated as a legitimate empty result.

**Why it happens:**
The current error handling is exception-based, not invariant-based. It only catches "the request failed," never "the request succeeded but the payload doesn't look like the thing we asked for." A well-formed-but-wrong `<PRE>` block passes every check in the pipeline today.

**How to avoid:**
- After parsing, assert structural invariants before accepting a result as real: header row must contain year tokens matching the `YEARS` range; for `lista_morb` diseases, at least one matched UF/município row must exist unless the disease id is on an explicit, hand-reviewed `known_empty_diseases.json` allowlist (populated only after a human confirms via the TabNet UI that the code genuinely has zero national hospitalizations for the full 2013–2025 window — this is rare but real for some obscure Lista Morb codes, so the allowlist must exist rather than banning zero outright).
- Any UF/measure/year combination that produces an empty result **and is not on that allowlist** must be written as a distinct status (e.g. `SUSPECT_EMPTY`), not `OK`, and must block `disease_done()` / upload until triaged.
- Reconcile parsed values against the `Total` row/column that TabNet itself returns in the same response. `table_to_long_uf`/`municipal_long` currently discard the `Total` column (`if col == "Total": continue`) and the `Total` row (`row[0].strip().lower() == "total"`) — this is free, first-party ground truth being thrown away. Sum the parsed UF/município values per year and diff against TabNet's own `Total`; log/alert on any mismatch beyond rounding.

**Warning signs:**
`metadata.json` shows `"rows": 0, "errors": []` for a disease that is not on the empty-allowlist; a disease's row count drops to a small fraction of its historical value between runs with no code change; the same TabNet request, re-issued manually in a browser, returns a normal table.

**Phase to address:**
Phase 9 (pipeline confiável + coleta completa).

---

### Pitfall 2: Deleting the raw cache before the upload is confirmed destroys the only audit trail

**What goes wrong:**
In `coleta_sih_multi_disease.py`, `cleanup_raw()` is called from inside `scrape_one()` itself, gated only on `not errors and len(uf_rows) > 0` — i.e. **immediately after a scrape looks successful, before any upload has happened.** `scrape_upload_sih.py.main()` calls `coleta.scrape_one(disease, measures)` with the default `cleanup=True`, so the raw TabNet HTML for a disease is deleted the moment the CSV is written, and only *then* does the script attempt `upload_disease()`. If the Supabase upload subsequently fails (network hiccup, Edge Function down, rotated ingest secret, quota), the raw evidence needed to re-derive or audit that scrape is already gone — the only thing left is the (possibly wrong) CSV. This is precisely the mechanism the historical incident describes ("uploaded 0 rows to Supabase, and then DELETED the raw HTML cache").

**Why it happens:**
"Cleanup" was written as a disk-hygiene step tied to *scrape* success, not to *upload* success. The two are different systems (Python scrape script vs. Edge Function ingest) and nothing currently sequences them as one pipeline with one success criterion.

**How to avoid — the correct ordering, stated explicitly:**
1. Fetch raw response → write to `raw/` immediately (already done).
2. Parse + run the structural-invariant checks from Pitfall 1 → fail loud, never write `metadata.json` as `OK` on failure.
3. Write CSV + metadata, including a content checksum (e.g. sha256 of the sorted row set) and the expected-vs-actual row count.
4. Upload to Supabase; capture the server-reported upserted count per table.
5. **Verify**: `upserted_count == rows_sent` for both `sih_metric_uf` and `sih_metric_muni`, and optionally re-`SELECT count(*)` from Supabase for that `disease_id` to confirm persistence independent of the client's own tally.
6. Only after step 5 passes, write `uploaded.json` **and only then** delete `raw/`.
7. Even after upload, keep raw HTML for a bake-in window (e.g. until the next full audit pass) — it is the only artifact that shows TabNet's *echoed* filter selection, which is exactly the evidence that would let you confirm "did we actually query tabnetCode 178 or 163" after the fact. This is the single most useful artifact for debugging a future taxonomy-class bug, and it is what got thrown away.

**Warning signs:**
`uploaded.json` does not exist for a disease whose `raw/` directory is also already gone (unrecoverable state); `scrape_one`/`upload_disease` cleanup call sites are more than one function away from the verification step; any code path that calls `cleanup_raw()` without first checking a persisted upload-confirmation record.

**Phase to address:**
Phase 9 (pipeline confiável).

---

### Pitfall 3: Static retry loop with no backoff ceiling turns a transient failure into a multi-hour hammering session

**What goes wrong:**
`overnight_watchdog.sh`'s `run_phase()` restarts the underlying Python process on **any** nonzero exit or missing `"ALL DONE"` marker, sleeping a flat 25 seconds between attempts, **forever**, with no attempt cap and no widening backoff. If TabNet degrades (slow responses, intermittent 5xx, session limits) partway through an overnight run, the watchdog will retry indefinitely at a fixed 25s cadence for the rest of the night, which is exactly the kind of pattern that looks like abuse to the origin server and that produced the very DNS failures documented in this project's history.

**Why it happens:**
The watchdog was designed for "resilience" (keep going) without a companion concept of "etiquette" (back off, and eventually stop and page a human). `REQUEST_DELAY_SEC=1.5` / `DISEASE_PAUSE_SEC=2.0` in the Python script are reasonable per-request politeness defaults, but they say nothing about what to do when the *server* signals distress.

**How to avoid:**
- Exponential backoff with jitter and a hard ceiling (e.g. cap at 5–10 minutes between retries) instead of a flat 25s sleep.
- A circuit breaker: after N consecutive full-phase failures (e.g. 3), stop the whole run and write a loud, unmissable failure marker (not just append to a log file) rather than looping until morning.
- Detect and honor TabNet-specific soft-failure signals in the response body (session-limit pages, "aguarde"/rate-limit interstitials) as a distinct case from a clean data response, and treat them as reasons to slow down, not retry immediately.
- Keep the existing 1.5s/2.0s pacing as a floor, not a ceiling — this part of the current design is reasonable and verified-general-practice (1–2 req/s is a commonly cited ethical scraping range for unauthenticated government portals); MEDIUM confidence, WebSearch-verified general guidance, not TabNet-specific documentation (none found).

**Warning signs:**
`overnight_scrape_upload.log` shows the same disease/measure failing and retrying more than 3–4 times in a row; the watchdog log shows `RESTART` entries spaced by exactly 25s for hours; TabNet becomes unreachable for the whole institution (a shared risk if the league's IP gets rate-limited or blocked).

**Phase to address:**
Phase 9 (pipeline confiável).

---

### Pitfall 4: The ledger is disease-level, not disease × measure × grain — so it produces false "done" states and wasteful re-scraping

**What goes wrong:**
`disease_done()` gates on the *whole disease* having a non-empty UF CSV, a non-empty município CSV (for `lista_morb`), and an empty `errors` list in `metadata.json`. But `scrape_one()` writes ONE `metadata.json` per disease covering whichever `measures` list was passed in that run. Two concrete failure modes follow directly from this:
1. If a disease's Internações succeeds but Óbitos fails in the same run (this is exactly today's state: Óbitos exists for only 5/330 diseases), the disease's `metadata.json` has `errors: ["Óbitos: ..."]`, so `disease_done()` returns `False` for the *entire disease* — on the next run, `--skip-done` will re-scrape Internações all over again even though it already succeeded, wasting requests and time.
2. Conversely, if a run is invoked with a narrower `--measure` list, a disease can look "done" for the measures it was asked about while other measures were never attempted at all, with no per-measure record distinguishing "not attempted" from "attempted and failed" from "collected."

This directly matches the stated v3.0 requirement for "ledger por agravo × medida × grão" — the current ledger does not have that grain, and the milestone would not be satisfied by anything less.

**Why it happens:**
The ledger evolved as a side effect of `metadata.json` being written per invocation, not as a deliberately designed state machine keyed by the actual unit of work (disease × measure × grain: UF or município).

**How to avoid:**
Design an explicit ledger record per `(disease_id, measure, grain)` tuple with states `not_attempted | in_progress | collected | suspect_empty | failed | uploaded`, persisted independently of which CLI invocation touched it, so that:
- Resuming a run reads the ledger, not just file existence, and only re-attempts tuples not in `collected`/`uploaded`.
- A partial failure (Óbitos fails) never causes re-work on an already-`uploaded` tuple (Internações).
- The ledger is the single source for a coverage report (see Pitfall 11) — `X/330 diseases × Y/4 measures × {uf, muni}` — instead of that number having to be reconstructed by eyeballing `summary.json`.

**Warning signs:**
`--skip-done` reprocesses diseases that already have valid Internações data; `summary.json` shows diseases oscillating between "done" and "not done" across consecutive runs with no underlying data change; no query exists that answers "which of the 330×4 combinations have we actually collected" without scripting an ad-hoc scan.

**Phase to address:**
Phase 9 (pipeline confiável).

---

### Pitfall 5: Positional merge of two independently-authored lists is how the `avc` → code 163 bug happened, and the mechanism is still present

**What goes wrong:**
`scripts/catalog/diseases.json` currently has internally-inconsistent entries for the legacy vascular ids: `{"id": "avc", "label": "Outras doenças do olho e anexos", "tabnetCode": "163"}`. There are no duplicate `tabnetCode` values across the 330 entries (verified by inspection) — every id maps to a *unique* code — but for at least 8 legacy ids (`avc`, `ait`, `doencas_arterias`, `aneurisma_aorta`, `embolia_pulmonar`, `flebites_tromboflebites`, `varizes_mmii`, `outras_doencas_vasculares`) the id's **plain-language meaning does not match the code's official label**. The real "Infarto cerebral" (code 178) and "Acid vascular cerebr não espec..." (code 179) exist in the file — under the ids `doencas_arterias` and `aneurisma_aorta` respectively. This is the signature of a **positional shift**: a hand-maintained legacy list of ~20 ids was merged against an auto-generated, code-ordered 330-entry list, and the legacy ids landed on whatever position the auto-generated list had at that slot, offset by roughly 15 rows from where they should be.

Separately, `scripts/catalog/columnMap.json` has a **hand-curated, didactically-correct** label for `sih.avc_uf` ("AVC / acidente vascular cerebral") that was authored independently of `diseases.json` and never re-validated against it. This is why the user-facing `variables.json` entry `sih.avc.internacoes` shows the correct clinical name while the underlying data — queried using `tabnetCode: "163"` — is actually "Outras doenças do olho e anexos." Two independently-maintained files each look internally coherent; only a cross-check between them (which does not exist) would reveal the mismatch.

**Why it happens:**
Nothing in the pipeline treats `tabnetCode` as the one non-negotiable join key. Ids and labels are treated as if they were reliably co-located by array position across file regenerations, and `syncColumnMap.mjs` only *adds* missing `(packId, column)` entries (`if (!columnMap[packId]) { ...standardColumns... }`) — it never revisits or verifies an entry that already exists. A drift introduced once is permanent and invisible to tooling.

**How to avoid:**
- Regenerate `diseases.json` as a single, fully machine-generated artifact from one canonical, versioned source (the official Lista Morb CID-10 code table), keyed and sorted by `tabnetCode` only. Never hand-edit it after generation; never merge two independently-ordered lists by position again.
- Move curated clinical aliases (the "AVC", "TVP", etc. didactic names the league actually uses) into a **separate** `aliases.json` that stores the alias **and its own `tabnetCode`** explicitly, so it is validated *against* the canonical table by code, never assumed by shared array position or shared id string.
- Add an independent oracle check to `validate.mjs`: for every aliased/curated id, assert `alias.tabnetCode === canonical[tabnetCode].tabnetCode` **and** a coarse CID-10 chapter-range sanity check (e.g., codes describing cerebrovascular disease must fall in the circulatory-system chapter range, not the eye/adnexa chapter range that code 163 actually belongs to). This gives a check that does not simply re-derive from the same file that could be wrong.

**A concrete regression test that would have caught this bug**, written against the *existing* `diseases.json` shape (vitest, run as part of `npm run catalog:validate` or a new `taxonomy.test.ts`):

```ts
// Independently pinned oracle — sourced by hand from the official Lista Morb
// CID-10 reference table, NOT derived from diseases.json or columnMap.json.
const EXPECTED_ALIASES: Record<string, { tabnetCode: string; labelMustInclude: string[] }> = {
  avc: { tabnetCode: '178', labelMustInclude: ['cerebral', 'vascular'] },
  ait: { tabnetCode: '176', labelMustInclude: ['isquêm', 'transit'] }, // example values —
  varizes_mmii: { tabnetCode: '185', labelMustInclude: ['flebite', 'trombose', 'venosa'] },
  embolia_pulmonar: { tabnetCode: '181', labelMustInclude: ['pulmonar', 'embolia'] },
  // ...remaining curated legacy ids
};

test('curated alias ids resolve to their independently-pinned TabNet code and a semantically consistent label', () => {
  const diseases = JSON.parse(fs.readFileSync('scripts/catalog/diseases.json', 'utf8'));
  const byId = new Map(diseases.map((d: any) => [d.id, d]));

  for (const [id, expected] of Object.entries(EXPECTED_ALIASES)) {
    const entry = byId.get(id);
    expect(entry, `alias "${id}" missing from diseases.json`).toBeDefined();
    expect(entry.tabnetCode).toBe(expected.tabnetCode);
    const labelLower = entry.label.toLowerCase();
    const matches = expected.labelMustInclude.some((kw) => labelLower.includes(kw));
    expect(matches, `"${id}" label "${entry.label}" does not match expected keywords ${expected.labelMustInclude}`).toBe(true);
  }
});
```

This test fails immediately and specifically on today's data (`avc` → code `163`, label "Outras doenças do olho e anexos" contains none of `cerebral`/`vascular`), which is exactly what a pre-migration regression suite needs to prove the fix worked and to prevent recurrence. The key property that makes it effective is that the expected code/label pairs are **hand-sourced from the official reference, not re-derived from the same generation pipeline that produced the bug** — a test that only checks internal self-consistency of `diseases.json` (e.g. "no duplicate tabnetCode") would have passed on the corrupted data, exactly as today's `validate.mjs` does.

**Warning signs:**
Any legacy/curated id whose plain-language meaning and TabNet-official label disagree when read side by side; any script that treats "key already present, skip" as equivalent to "key already verified"; a taxonomy file that has never been diffed against an independently-sourced reference since its creation.

**Phase to address:**
Phase 8 (taxonomia + integridade) — this is the phase's namesake bug.

---

### Pitfall 6: `validate.mjs` checks shape, not meaning — and nothing checks Supabase against the JSON source of truth

**What goes wrong:**
The existing fail-closed validator (`scripts/catalog/validate.mjs`) checks: required fields present, `variableType` in an allowed set, `officialUrl` is an absolute URL, `loadable:true` entries have a resolvable `packId`/`columnKey`, no duplicate catalog ids, and that shared CNES/population metrics agree numerically across packs at the same `(uf_codigo, ano)` key. **None of these checks would fail on the `avc`/163 bug** — every field is present, well-typed, and internally consistent; the bug is a *semantic* mismatch between `id`, `label`, and `tabnetCode`, a class of error this validator has no concept of. Separately, the Supabase `sih_disease` table was seeded from `diseases.json` at some point in time and has independently drifted ever since (it currently carries the same corruption) — there is no automated process that diffs the live table against the current JSON to catch either accidental staleness or a migration script bug that writes the wrong value.

**Why it happens:**
Validation was built to catch structural/referential breakage (missing fields, dangling pack references) because that is what crashes the app. Semantic correctness of curated labels was assumed to be "someone checked it by eye," which is exactly what failed for 20 entries.

**How to avoid — where fail-closed validation belongs (four separate gates, not one):**
1. **Build time** (`scripts/catalog/validate.mjs`, already wired to `pretest`): extend with the id↔label↔tabnetCode semantic cross-checks and CID-10 chapter-range sanity from Pitfall 5.
2. **Pre-migration gate**: before writing any id rename to Supabase, validate the *migration mapping table* itself (old_id → new_id → tabnetCode) against the same independent oracle — a bug in the migration script must not be able to write a new, differently-wrong mapping into production.
3. **Post-migration verification**: query live Supabase `sih_disease` and diff it row-for-row against the canonical JSON that was just migrated (id, label, tabnet_code, def_path all equal) — this is the check that would catch "the migration script itself had a bug" even after the source JSON is fixed.
4. **CI enforcement** (see Pitfall 14): none of the above matters if nothing forces it to run before merge.

**Warning signs:**
`npm run catalog:validate` passes while a known-bad taxonomy is present (true today); no script or scheduled job ever runs a live `SELECT` against `sih_disease` and diffs it against `diseases.json`; the only way to notice a Supabase/JSON divergence today is a human reading both side by side.

**Phase to address:**
Phase 8 (taxonomia + integridade).

---

### Pitfall 7: Renaming primary keys on a 1.1M-row, FK-referenced table risks silent data-merging, not just downtime

**What goes wrong:**
`sih_metric_uf` and `sih_metric_muni` reference `sih_disease(id)` via foreign key (per `docs/SUPABASE-CATALOG.md`'s schema), with composite primary keys `(disease_id, uf_codigo, ano)` / `(disease_id, municipio_codigo, ano)`. Migrating disease ids to a canonical scheme means rewriting `disease_id` across up to 330 keys and ~1.1M+ rows. Two distinct risks, not one:
- **Reversibility/downtime risk**: a naive `UPDATE ... SET disease_id = ...` on the referenced table (`sih_disease.id`) will fail against the default `NO ACTION` FK unless children are updated first or the constraint is dropped/deferred; doing this as one giant transaction against the full 1.1M-row child table can hold locks long enough to affect concurrent anon reads (WebSearch-verified pattern: large-scale PK renames cascading through FKs have been reported taking hours; MEDIUM confidence, general PostgreSQL community reports, not benchmarked against this schema).
- **Silent-merge risk, more dangerous than downtime**: if the migration mapping ever (even by a one-line bug) maps two *different* old ids to the *same* new canonical id, and the upload/upsert path uses `on_conflict=(disease_id, uf_codigo, ano)` with `Prefer: resolution=merge-duplicates` (exactly what `uploadSihToSupabase.mjs` already does), the second disease's rows would silently overwrite the first's at every colliding `(uf_codigo, ano)` key — two diseases' hospitalization counts merging into one with no error, no row-count change large enough to obviously look wrong, and a result that looks entirely plausible on a map.

**Why it happens:**
Renaming ~330 string primary keys that are also foreign-key targets, in a live table with a public anon reader, without a maintenance window, is materially different from a normal application migration — there is no user-facing "maintenance mode" to fall back on, and the read path (PostgREST/anon) is a separate transaction per request, so partial-state visibility must be reasoned about explicitly rather than assumed away.

**How to avoid:**
- Do the rename via a `(old_id, new_id, tabnet_code)` mapping table, generated and validated against the independent oracle from Pitfall 5/6 *before* touching any data.
- **Verify uniqueness of the mapping itself first**: assert `new_id` has no duplicates across the mapping table — this single check directly prevents the silent-merge scenario above, and should be a hard pre-condition, not an assumption.
- Verify row counts and content **before and after**, per disease, not just in aggregate: `select disease_id, count(*), <checksum of non-key columns>` grouped by `disease_id` for both `sih_metric_uf` and `sih_metric_muni`, taken before the migration (keyed by old id) and after (keyed by new id via the mapping), and assert count and checksum are unchanged per disease. A pure rename must produce identical checksums; any diff means data moved, not just renamed.
- Batch the update (e.g. 25–50k rows per statement) rather than one giant `UPDATE`, to bound lock duration and WAL growth, and to make progress observable/resumable.
- For the FK itself: prefer dropping and recreating with `NOT VALID` then `VALIDATE CONSTRAINT` (which takes a lighter lock than the initial creation) rather than holding a full-table exclusive lock in the same transaction as the batched data rewrite (WebSearch/skills-reference-verified general PostgreSQL technique in `.agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md`; MEDIUM confidence as applied specifically to this schema — should be validated against this project's actual constraint definitions before executing).
- **Reversibility**: keep the `(old_id, new_id)` mapping table (and, ideally, a full logical snapshot of `sih_disease` + a `disease_id` column audit trail) until a bake-in period has passed and the post-migration verification (Pitfall 6, gate 3) has run clean at least once against a real read from the app.
- **No maintenance window, by construction**: since the app is read-only (anon/RLS SELECT only, per `PROJECT.md`'s constraints) and each PostgREST request is its own transaction, wrapping the id-rename + child-row-rewrite for one disease in a single database transaction means concurrent readers see either the fully-old or fully-new state via normal MVCC snapshot isolation — never a half-migrated mix — as long as the transaction completes in a reasonable time (hence batching per-disease rather than one transaction for all 330 at once).

**Warning signs:**
The mapping table has fewer distinct `new_id` values than `old_id` values (collision); per-disease row counts or checksums differ before/after; anon read queries during the migration window return errors or empty results that weren't happening before; the FK constraint validation step takes an outsized amount of time on the muni table without a batching strategy.

**Phase to address:**
Phase 8 (taxonomia + integridade) — this phase owns "Migrar ids no Supabase... sem perder linhas" per `PROJECT.md`.

---

### Pitfall 8: Null coerced to zero anywhere in the new async chain silently biases every downstream statistic — the epidemiological hazard, stated precisely

**What goes wrong:**
Today's synchronous, client-only path already gets this right: `parse_number()` in the Python scraper maps TabNet's `-`/`...`/`..`/empty cell to `None` (not `0`); `write_csv` serializes `None` as an empty CSV cell; `num_or_none()` in `scrape_upload_sih.py` preserves that as SQL `NULL`; the Supabase numeric columns are nullable; and `catalogAnalysisData.ts`'s `coercePackNumber()`/`metricForYear()` explicitly **omit** a UF key rather than writing zero when the pack cell is null (comment: "never coerce null→0 (T-05-11)"). This discipline is not yet proven for the *new* code this milestone adds — the live Supabase fetch path for the dynamic choropleth (Phase 10) and the mapa→tabela→teste assembly (Phase 11) do not exist yet, and every one of the following is a plausible, easy-to-write regression:
- A client-side aggregation (e.g. computing `taxa_mortalidade` in the browser, or reducing município rows up to UF) that uses `obitos ?? 0` or `Number(value) || 0` "to keep the math simple." Given Óbitos exists for only 5 of 330 diseases today, **any** such shortcut would report a false "0% mortality" for ~98% of the catalog instead of "no data" — the exact scenario the milestone context calls "the worst possible outcome," because a 0% mortality rate is completely plausible-looking and a student has no way to notice it is wrong.
- A choropleth color scale that assigns missing UFs/municípios the same low-end color as a genuinely low real value, rather than a distinct "sem dado" visual treatment (grey/hatch + separate legend entry) — `PROJECT.md`'s own constraint ("nunca pintar um mapa vazio como se fosse dado real") already names this risk; it is not yet operationalized as a testable rule.
- A "complete rectangle" table-builder for the stats handoff that fills missing measure cells with 0 so every downstream test engine (t-test, ANOVA, Poisson, qui-quadrado) receives a dense matrix with no missing values. This is the single most dangerous instance: a null silently becomes a real input to a mean, a rate denominator, or a regression coefficient. Given "Missing not at random" is the norm here (Óbitos is missing *because* it was never collected for a disease, not because the value happens to be zero), this kind of fill systematically **deflates rates and understates variance in a directionally wrong way** — WebSearch-verified as a known epidemiological hazard in small-area/suppressed-count public-health data (bias from ignoring suppression/missingness in CDC WONDER-style datasets is documented as directionally predictable, not random noise).

**Why it happens:**
Null-safe handling is easy to get right once and easy to reintroduce a shortcut for later, especially under time pressure, especially in new code that doesn't reuse the existing `catalogAnalysisData.ts` helpers verbatim (a new async fetch layer is new surface area, not a place where the old discipline is inherited "for free").

**How to avoid:**
- Treat "never coerce null→0" as a repo-wide, testable invariant, not tribal knowledge in one file's comment. Add a lint rule or a small static check (grep for `?? 0`, `|| 0`, `Number(x) || 0` immediately adjacent to any of the known metric column names — `internacoes`, `obitos`, `valor_total`, `dias_permanencia`, `taxa_mortalidade`) that fails CI on new occurrences outside an explicit allowlist.
- Extend the existing "pressupostos" assumption-check UI (already built for GLM tests in v2.0 Phase 3) with an explicit **missing-data check**: before running any test on assembled data, compute the fraction of null cells in the selected measure; require an explicit user choice (listwise deletion with N reported, or abort) rather than a silent default; always report "N linhas excluídas por dado ausente: X de Y (Z%)" in the results alongside the test output. This is a natural extension of the "proveniência obrigatória" principle already validated in v2.0 Phase 5 — implement it as part of that same provenance mechanism, not a bespoke new component.
- Give null a first-class, distinct visual encoding on every choropleth (not shared with the color ramp's minimum), enforced by an explicit design token and a rendering test that asserts a known-null cell does not receive the same fill as a known-low-but-real cell.
- Write an explicit regression test at the Supabase-fetch boundary itself: feed the fetch layer a mocked row set containing at least one `null` metric cell, assert the value that reaches the UI/stats layer is `null`/absent, never `0`.

**Warning signs:**
A "0%" or "0" appears for a measure known to be uncollected for that disease; a choropleth for a disease with 5/330 Óbitos coverage renders all 330 diseases' mortality maps as if data existed; a statistical result's N equals the full row count with no mention of exclusions, for a measure known to have nulls.

**Phase to address:**
Primary: Phase 10 (mapas dinâmicos — this is where the new fetch/aggregation code is written). Secondary: Phase 11 (fluxo pesquisa→estatística — this is where the missing-data assumption check belongs in the test-configuration flow).

---

### Pitfall 9: Partial measure coverage is presented to students as if it were complete

**What goes wrong:**
`variables.json` already offers `sih.avc.taxa_mortalidade` (and the equivalent for all 330 diseases) as a selectable measure in the UI, even though Óbitos — and therefore `taxa_mortalidade` — is collected for only 5 of 330 diseases. A student who picks "Taxa de mortalidade hospitalar" for any of the other 325 diseases gets either an empty result or (per Pitfall 8, if a shortcut is later introduced) a false zero. Nothing in the picker itself communicates "this measure has no data for most diseases" before the student commits to using it.

**Why it happens:**
The catalog's coverage is generated per-pack from whatever CSVs happen to exist; the variable list is built structurally (does an entry exist, is it `loadable: true`) rather than being annotated with *actual* row/coverage counts at generation time.

**How to avoid:**
- Complete the collection (Phase 9's "coleta completa: 4 medidas × 330 agravos × grãos UF e município") — this is the real fix, not a UI workaround, and it is already scoped as a v3.0 requirement.
- Until then (and as a permanent safeguard against future partial-collection states), annotate every catalog entry with an explicit coverage fact (e.g. `coverageDiseaseCount: 5` out of 330 for a given measure) generated from the ledger in Pitfall 4, and surface it in the picker itself — grey out or visibly badge measures with incomplete coverage *before* the student selects them, not after they see a blank or suspicious result.
- Add a build-time check that a measure marked `loadable: true` for a disease actually has a nonzero row count for that disease's pack — i.e. `validate.mjs` should refuse to mark `taxa_mortalidade` loadable for a disease whose Óbitos column is 100% null, rather than trusting the catalog structure alone.

**Warning signs:**
A measure is selectable in the UI for a disease whose underlying pack has zero non-null values for that column; `manifest.json`/`variables.json` report "330 diseases collected" without breaking that down per measure.

**Phase to address:**
Phase 9 (coleta completa) for the underlying fix; Phase 10 (mapas dinâmicos) for the picker-level honesty; both should be verified together.

---

### Pitfall 10: Students assembling their own map→table→test can produce statistically invalid conclusions the product currently has no guardrail against

**What goes wrong:**
The new flow (mapa: território × tempo × agravo × grupo → tabela montada → teste estatístico) hands the student far more analytical freedom than the static v2.0 catalog did, and with it, several classic aggregate-data hazards that a medical-student audience will not recognize on their own:
- **Ecological fallacy / MAUP**: a correlation or test result computed on UF- or município-aggregated rates does not license any individual-level or causal claim, and the apparent strength/significance of a pattern can change simply by switching the aggregation level (UF vs município vs macrorregião) — this is a well-documented statistical hazard (WebSearch-verified: MAUP and ecological fallacy are treated in the GIS/spatial-epidemiology literature as closely related manifestations of Simpson's paradox in spatial data).
- **Unequal denominators**: Internações/Óbitos are raw counts. Comparing São Paulo to Roraima by raw count conflates population size with risk; only the pre-existing 10 vascular packs carry a population denominator (`populacao`, `medicos_vasculares_por_100k`) today — the other 320 diseases have no per-year population join at all, so most of the catalog cannot produce a genuine rate, only a raw count that looks like one on a choropleth.
- **Small counts on rare diseases**: with 330 Lista Morb codes, many will have single-digit national counts in some UF/year cells; running a chi-square, t-test, or ANOVA on such cells violates standard assumptions (minimum expected cell counts, normality) and produces unstable, overconfident p-values.
- **Multiple comparisons across 330 diseases**: nothing stops a class of students from each picking a different disease and reporting whichever one turns up p<0.05 as "the" finding. With 330 independent tests, roughly 16–17 false positives are expected by chance alone at α=0.05 even under a universally true null. This is a hazard specific to this catalog's scale that a generic single-test product wouldn't have.
- **Structural breaks in the time series**: 2020–2021 SIH hospitalization counts are affected system-wide by pandemic-era care disruption; comparing periods that straddle this window (or feeding it into Prais-Winsten without flagging it) risks attributing a pandemic artifact to whatever the student is actually studying.
- **Post-hoc group construction**: since Mapas already supports custom UF groups/presets (v2.0 Phase 4), a group defined *after* seeing which UFs look different on the choropleth is a form of the Texas-sharpshooter fallacy — the comparison is no longer independent of the outcome it's being used to explain.

**Why it happens:**
The existing "pressupostos" nudges (v2.0 Phase 3) check the mechanics of a chosen test (normality, variance homogeneity, etc.) but nothing today addresses these *design-of-the-analysis* hazards, because in v2.0 the catalog was small, curated, and largely pre-vetted (10 vascular packs); at 330 diseases and free-form territory/period assembly, the hazard surface is qualitatively larger.

**How to avoid:**
- Extend the assumption-check UI to include an aggregate-data disclosure that appears whenever the assembled table is UF/município/region-level (not just a mechanical test-assumption check): "Esta análise é ecológica — relações entre agregados não implicam causalidade individual, e o resultado pode mudar com outro nível de agregação."
- Flag raw-count variables distinctly from rate variables in the picker and in results, and warn (or require explicit acknowledgement) before running a between-territory comparison on a raw count without a population denominator.
- Extend assumption checks to flag small expected/observed cell counts specific to rare-disease selections (not just the generic test-assumption checks already built).
- Add a light, didactic (not blocking) note when the assembled dataset includes 2020–2021: "Este período inclui a pandemia de COVID-19, que afetou internações eletivas de forma ampla — considere isso ao interpretar tendências."
- Add a didactic note about multiple comparisons whenever the product's own scale (330 diseases) makes "shop around until something is significant" an easy trap — this is a genuinely novel, catalog-scale-specific risk this product should name explicitly rather than assume students already know.

**Warning signs:**
No UI copy anywhere currently distinguishes ecological/aggregate results from individual-level ones; raw counts and rates share the same picker styling; no message anywhere references 330 diseases or multiple testing; group presets can be created after a variable is already rendered on the map.

**Phase to address:**
Phase 11 (fluxo pesquisa→estatística) — this is precisely the phase that introduces the free-form assembly this pitfall depends on.

---

### Pitfall 11: Migrating a synchronous data path to async reintroduces stale-closure and race-condition bugs the sync version couldn't have

**What goes wrong:**
`catalogAnalysisData.ts` today is entirely synchronous: `getMetricByUf(variableId)` reads directly from statically-imported pack JSON and returns a value in the same tick it's called. Phase 10 replaces this with a live Supabase fetch, which introduces an entire class of bugs the current code is structurally immune to:
- **Stale closure / out-of-order resolution**: a component fetches metrics for `diseaseId=A`, the user switches to `diseaseId=B` before A's fetch resolves, and if the resolution handler doesn't check "is A still the current selection" before calling `setState`, B's already-rendered label ends up paired with A's (now late-arriving) data — this is exactly "rendering a previous disease's data under a new disease's label," named explicitly in the milestone context.
- **True race, not just staleness**: if request A (slow) and request B (fast, issued after A) both resolve, and nothing sequences them, B's correct response can be overwritten by A's late, stale one arriving afterward, even if the naive "still current?" check only compares against the *currently selected* id rather than a monotonic request identity.
- **Cache-key omission**: the "mapas dinâmicos" contract calls for caching drill-down results (`docs/SUPABASE-CATALOG.md`: "cache e estados de carregamento/vazio honestos"). If a cache is keyed by an incomplete tuple (e.g. UF code only, omitting disease id or period), a cache hit can silently serve one disease's/period's data under a different disease's/period's label — the same "plausible wrong number" hazard as Pitfall 8, caused by a caching bug instead of a race.
- **Sync-looking async facade**: the easiest migration mistake is to keep `getMetricByUf`'s signature superficially unchanged (still returning a value "right away") by backing it with a module-level cache/last-known-value, so every call site keeps compiling without being forced to handle loading/error states explicitly — this hides the state machine and reintroduces exactly the staleness/race hazards above, silently, because nothing in the type system forces a review of every call site.

**Why it happens:**
None of these bugs are possible in a purely synchronous, statically-imported data path — they are new failure modes specifically introduced by the sync→async migration this milestone requires, and they are easy to miss because the code "looks like it works" in a quick manual test (single selection, single click) and only shows up under rapid selection changes.

**How to avoid:**
- Model fetch state explicitly, keyed by the identity it was requested for: `{ requestedFor: { diseaseId, ufCode, period }, status, data, error }`, and only render when `state.requestedFor` matches the *current* selection exactly (all dimensions, not just disease id).
- Use a monotonic request counter or `AbortController` per fetch; on resolution, discard the response if it is not the latest issued request for that selection, regardless of arrival order (WebSearch-verified as the standard React pattern for this exact class of bug: "ignore stale response" flag or `AbortController.abort()` in the effect cleanup).
- Force the migration to be visible at every call site: change the exported function *signature* (e.g. from a synchronous getter to a hook returning `{status, data}`) rather than layering async behavior behind an unchanged-looking synchronous-style API. A compile error at every old call site is a feature here, not friction — it is what makes the review "did this call site handle loading/stale-data correctly" actually happen.
- Cache keys must include every dimension the result depends on (`diseaseId`, `ufCode` or `municipioCodigo`, `period`/years, `grain`) — never a subset "because it usually doesn't change."
- Write a regression test that fires two mocked fetches with intentionally reversed resolution order (request A issued first but resolves second, after B) and asserts the final rendered state matches B (the most recently *requested* selection), not whichever response arrived last in wall-clock time.

**Warning signs:**
Rapidly clicking through disease/UF selections shows a flicker where the wrong label/data pair briefly (or persistently) appears; a loading spinner from a previous selection continues after switching away and back; the cache correctly serves one dimension (e.g. UF) but ignores another (e.g. period), returning last year's data under this year's label.

**Phase to address:**
Phase 10 (mapas dinâmicos) primarily; the same discipline must be reused, not re-invented, in Phase 11's mapa→tabela→teste handoff.

---

### Pitfall 12: A red test suite that stays red stops functioning as a regression signal — and nothing currently prevents that

**What goes wrong:**
`FlowSteps`'s default `layout` prop changed from `stepper` to `scroll` (removing the step-navigation buttons), and 24 tests across 9 files — written against the old default, driving the flow by clicking `Configurar`/`Resultados` — now fail. The suite "went red and stayed red," which the milestone context names explicitly as a reason a baseline-verde phase is needed before any other correction can be trusted: with 24 failing tests already present, there is no way to tell a genuinely new regression from pre-existing, accepted breakage. Compounding this, there is **no CI workflow in this repository** (`.github/workflows` exists only inside the vendored `jasp-desktop-development/` reference, not for this project) — `pretest`/`test:run` chaining `catalog:validate` + `vitest run` exists in `package.json`, but nothing forces it to run on push/PR. It is opt-in and easy to skip under time pressure, which is exactly how this state was reached in the first place ("o trabalho pós-Fase-5 foi vibecodado sem commit").

**Why it happens:**
Tests were written against implementation details (a specific navigation affordance, `stepper`-layout buttons) rather than user-observable, role/semantic queries, so a single shared-component default change broke a disproportionate number of tests at once — and with no CI gate, a red suite has no forcing function to get fixed before more work piles on top of it.

**How to avoid:**
- Add a CI workflow (GitHub Actions) that runs `npm run typecheck`, `npm run test:run` (which already chains `catalog:validate` + `vitest run`), and `npm run build` on every push/PR, and treat any failure as a merge-blocking status. This is the single highest-leverage fix here: it is what would have prevented 24 tests and 2 typecheck errors from silently landing on `main` and staying there.
- Rewrite the 24 tests to query by role/visible text (`getByRole`, `getByText`) rather than by clicking a specific navigation implementation; where a component genuinely supports two layouts (`stepper` | `scroll`), either test both explicitly or set the prop explicitly rather than depending on whichever default happens to be current.
- Establish "zero red tests" as a literal policy, enforced by the CI gate above, not an aspiration.

**Warning signs:**
A large fraction of failing tests cluster around one shared/base component's change — that is a signal of over-coupling to an implementation detail, not of many independent regressions; a repository with a `pretest` script but no CI configuration; a test suite that has been red for more than one commit without an open, tracked task to fix it.

**Phase to address:**
Phase 7 (baseline verde) for reaching a clean, honest starting state and adding the CI gate; Phase 12 (varredura de bugs) for the final sweep that confirms the gate holds under the full v3.0 surface.

---

### Pitfall 13: Ingest secrets and validation logic live outside version control

**What goes wrong:**
`trabalhos datasus/scripts/scrape_upload_sih.py` hardcodes `INGEST_SECRET = "lacir-sih-ingest-2026"` directly in a checked-in script — a credential committed to source control (and therefore to git history even if later rotated). Separately, the Supabase Edge Function `sih-ingest` that receives this secret and performs the actual insert/validation is not present anywhere in this repository — its source, its input validation, and its failure behavior are only knowable by reading the deployed function directly, which means the client script's assumptions about what the server accepts/rejects cannot be tested locally or reviewed in a PR.

**Why it happens:**
The Edge Function was authored/deployed directly against the Supabase project without a local source-of-truth being committed, and the shared secret was treated as a low-stakes convenience value rather than a credential.

**How to avoid:**
- Move `INGEST_SECRET` to an environment variable, rotate the currently-hardcoded value on the Supabase side, and add a repository-wide secret scan (e.g. `gitleaks`) to CI.
- Check the Edge Function source into the repo (e.g. `supabase/functions/sih-ingest/index.ts`) with its own unit tests, and deploy it via a scripted/CI step rather than out-of-band — this also closes the gap in Pitfall 6/7 where an ingest-side bug could reject or silently drop rows with no local test to catch it.

**Warning signs:**
`git log -p -- 'trabalhos datasus/scripts/scrape_upload_sih.py'` shows the secret value in history; no directory in the repo corresponds to the deployed Edge Function; the only way to know what `sih-ingest` validates is to read it in the Supabase dashboard.

**Phase to address:**
Phase 9 (pipeline confiável) for the secret rotation and CI scan; Phase 8 for making sure the ingest function's own validation is included in the fail-closed gates that phase establishes.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Deleting raw TabNet HTML right after a scrape "looks" successful | Keeps disk light during a long overnight run | Destroys the only audit trail when an upload later fails, or when a taxonomy-class bug needs to be re-verified against the original response | Never before upload is confirmed (Pitfall 2); acceptable only after a bake-in window post-upload |
| Disease-level ledger instead of disease × measure × grain | Simple to implement, matches today's single `metadata.json` per disease | False "done" states, redundant re-scraping, cannot express "Óbitos incomplete but Internações complete" (Pitfall 4) | Never for this milestone — the requirement explicitly calls for finer grain |
| Additive-only `columnMap.json` sync (`syncColumnMap.mjs` only fills missing keys) | Cheap way to backfill 320 new disease packs without touching the 10 hand-curated ones | Existing (possibly wrong) entries are never re-validated against the canonical taxonomy — this is literally how the `avc` drift became permanent | Only acceptable if paired with the independent-oracle cross-check from Pitfall 5/6; never as the sole mechanism |
| Sync-looking async facade for `catalogAnalysisData.ts` | Old call sites keep compiling without changes | Hides the state machine, reintroduces stale-closure/race bugs invisibly (Pitfall 11) | Never — force the type signature change |
| Filling missing measure cells with 0 for a "complete rectangle" table | Simplifies the stats-engine input contract | Silently biases means/rates/regression coefficients for the ~98% of diseases missing Óbitos (Pitfall 8) | Never; use explicit missing-data handling with reported N |
| Flat-interval retry with no backoff ceiling in the overnight watchdog | Simple bash loop, "just keep trying" | Risk of extended hammering of TabNet during a degraded period, worsening the underlying problem (Pitfall 3) | Only for short, bounded retry windows with a hard cap — never unattended overnight without a circuit breaker |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase anon key vs. service role key | Accidentally prefixing a service-role secret with `VITE_`, which Vite inlines into the client bundle at build time, exposing full DB write access | Keep write credentials unprefixed (`SUPABASE_SERVICE_ROLE_KEY`, not `VITE_SUPABASE_SERVICE_ROLE_KEY`) and add a CI grep-check that fails if any `VITE_.*SERVICE_ROLE` pattern ever appears in the repo |
| Supabase Edge Function (`sih-ingest`) | Business logic and secret validation living only in the deployed function, invisible to code review and untestable locally (Pitfall 13) | Version the function source in-repo with unit tests; deploy via a scripted step, not out-of-band dashboard edits |
| PostgREST chunked bulk upsert | A failure partway through a multi-chunk upload (`post_ingest`'s loop in `scrape_upload_sih.py`) leaves data half-uploaded with only a log line marking where it stopped, and no persisted high-water-mark to resume from precisely | Persist a per-chunk offset in the same ledger used for scrape idempotency (Pitfall 4); verify the final row count with a follow-up `select count(*)`, not just the client's own running tally |
| TabNet `Linha`/filter parameter names (`SLista_Morb__CID-10` vs `SProcedimento`) | A wrong parameter name for a given `def_path` can return an empty or malformed table without an HTTP-level error | Add a fixture-based contract test per `def_path` kind that posts one known-good request and asserts the response contains the expected echoed filter description, before trusting the pipeline across all 330 codes |
| Supabase RLS after a schema/id migration | Dropping/recreating a table for the PK migration without re-applying the anon-select policy, silently breaking reads (or leaving an overly permissive policy from a rollback attempt) | Script RLS policy (re)creation as part of the same migration file/transaction; add an automated post-migration check using the anon key to confirm SELECT works and that a write attempt is rejected |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Client-side re-aggregation of município rows to compute UF/regional figures | Choropleth becomes janky/slow as município coverage grows across more diseases | Keep `sih_metric_uf` as an independently populated, pre-aggregated table (already the model) — never re-derive UF totals from município rows in the browser; use the two tables' agreement as a free cross-check (sum of muni rows per UF/year should reconcile with the UF row) | Once município coverage reaches most/all of the 330 diseases (already ~1.1M rows for Internações alone) |
| Querying `sih_metric_muni` without a `disease_id` (and ideally `uf_codigo`) predicate | Slow, memory-heavy drill-down queries as the table grows past 1.1M rows toward ~4.4M (4 measures × 330 diseases × município) | Always filter by `disease_id` first (and `uf_codigo` for drill-down), matching the existing composite PK/index shape; verify query plans use the index rather than a sequential scan | Immediately once all 4 measures are collected at município grain — this is a near-term certainty, not a hypothetical |
| Reintroducing static pack imports for newly-collected diseases (following the pattern of the 10 legacy `import ...PackJson from ...` lines in `catalogAnalysisData.ts`) | Vite bundle size grows, eventually re-triggering the original memory-exhaustion problem this migration exists to solve | Enforce (lint rule or a small repo-convention check) that the static-import list in `catalogAnalysisData.ts` never grows beyond the already-grandfathered 10 legacy packs; all new/canonical diseases must be fetched from Supabase, never statically bundled | At build time (Vite OOM) once several more of the 330 packs are added the same way |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service-role key exposed via a `VITE_`-prefixed env var | Full read/write access to the entire database leaked to every visitor's browser | Keep ingestion-only credentials unprefixed; CI check that greps the built bundle and source for any service-role pattern |
| Ingest secret hardcoded in a checked-in script (Pitfall 13) | Credential permanently present in git history even after rotation | Move to environment/secret store; rotate; add `gitleaks`-style scanning to CI |
| RLS policy not re-applied after a schema/table migration | Public read access silently breaks, or worse, an overly permissive policy is left in place during a migration rollback | Treat RLS policy definition as part of the versioned migration script, not a manual dashboard step; verify with an automated anon-key smoke test after every schema change |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Offering "Taxa de mortalidade" as selectable for all 330 diseases when only 5 have Óbitos data | Student selects it, gets an empty or (if a `?? 0` shortcut is ever introduced) a false "0% mortality," and may present a wrong conclusion in class | Badge/grey out measures with incomplete coverage in the picker itself, before selection, using coverage facts generated from the ledger (Pitfall 9) |
| Null cells rendered with the same low-end color as a genuinely small real value on a choropleth | Data gap misread as a genuinely low rate — the exact "plausible wrong number" hazard this milestone is most worried about | Distinct visual encoding for "sem dado" (grey/hatch pattern + separate legend entry), never sharing the sequential color ramp's minimum |
| Free-form group/preset comparison with no reminder of the 330-disease multiple-comparisons risk | Encourages an implicit "click through diseases until one looks significant" pattern | Didactic banner in results when no pre-registered hypothesis is indicated, naming the multiple-comparisons risk explicitly given the catalog's scale |

## "Looks Done But Isn't" Checklist

- [ ] **"330 agravos coletados":** Often actually means only Internações is complete — verify via a per-measure coverage report (X/330 for each of the 4 measures × 2 grains), not by counting entries in `diseases.json`.
- [ ] **"Taxonomia canônica migrada":** Verify by diffing the live Supabase `sih_disease` table row-for-row against the canonical JSON — a migration script that "ran without error" can still have written the wrong values (Pitfall 6, Pitfall 7).
- [ ] **"Pipeline confiável":** Verify by deliberately breaking it mid-run (kill network, corrupt a response) and confirming it fails loud, marks the tuple as suspect, and resumes correctly on the next run — not by reading the retry code and assuming it works.
- [ ] **"Mapas dinâmicos":** Verify the choropleth actually issues a live Supabase query at render/selection time for a disease outside the 10 legacy packs — the exact same "looks dynamic, reads static packs" defect already shipped once in v2.0 Phase 4 (`taxonomy.ts` lists 330, `catalogAnalysisData.ts` reads 10).
- [ ] **"Null vs zero handled":** Verify with an explicit fixture containing a known-null cell, tracing it through fetch → cache → aggregation → choropleth render → stats-engine input, confirming it is excluded/flagged at every step, not zeroed at any one of them.
- [ ] **"Baseline verde":** Verify a CI workflow actually exists and blocks merges on red tests/typecheck — a locally-runnable `pretest` script that nobody is forced to run is not a gate.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Taxonomy drift already in production (Pitfall 5) | HIGH | Re-derive canonical id/tabnetCode/label triples from an independently-sourced Lista Morb CID-10 reference (never from the corrupted `diseases.json` itself); migrate Supabase ids via a verified mapping table (Pitfall 7); move curated clinical aliases into a separate, code-keyed layer going forward |
| Incomplete Óbitos/Valor_total/Dias_permanência coverage (Pitfall 9) | MEDIUM | Resume via the measure-scoped ledger (Pitfall 4) so already-collected Internações is never re-scraped; run only the missing 3 measures against the 330 diseases |
| 24 red tests from the `FlowSteps` default change (Pitfall 12) | LOW–MEDIUM | Decide explicitly: either restore `stepper` as the default (if `scroll` wasn't an intentional, reviewed change) or rewrite the 24 tests against the current `scroll` layout using semantic queries — do not leave the decision implicit |
| Deleted raw TabNet HTML from a bad historical run (Pitfall 2) | LOW if the derived CSV still looks structurally sound / HIGH if the CSV is also suspect | If the CSV passes the new structural-invariant checks (Pitfall 1), no re-scrape is needed — only the audit trail is lost; if the CSV is suspect (0 rows, fails invariants), the only recovery is re-scraping that disease × measure from TabNet |
| A migration mapping collision silently merged two diseases' data (Pitfall 7, worst case) | HIGH | Detect via the per-disease checksum comparison before/after (Pitfall 7); if a collision is found post-hoc, restore from the pre-migration snapshot and re-run the migration with a corrected, uniqueness-verified mapping |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|-----------------|
| 1. True zero vs. failed fetch indistinguishable | Phase 9 | Structural-invariant checks reject well-formed-but-wrong `<PRE>` payloads; `Total`-row reconciliation logged; empty results require an explicit allowlist entry |
| 2. Cache deleted before upload confirmed | Phase 9 | `cleanup_raw()` call sites all gated on a persisted upload-confirmation record, never on scrape success alone |
| 3. Unbounded retry storm | Phase 9 | Backoff with ceiling + circuit breaker verified by injecting repeated failures in a test run |
| 4. Coarse ledger causing false "done" / re-scrape | Phase 9 | Ledger keyed by (disease, measure, grain) with a coverage report query proving X/330 × Y/4 × grain |
| 5. Positional taxonomy merge (`avc` → 163) | Phase 8 | The `EXPECTED_ALIASES` regression test (Pitfall 5) passes against the regenerated `diseases.json` |
| 6. Validation checks shape, not semantics; JSON/Supabase drift unchecked | Phase 8 | Four-gate validation (build/pre-migration/post-migration/CI) all present and exercised |
| 7. PK rename risk on 1.1M-row FK table | Phase 8 | Per-disease row-count + checksum parity before/after; mapping-table uniqueness asserted pre-migration |
| 8. Null coerced to zero in new async/aggregation code | Phase 10 (fetch/map), Phase 11 (stats handoff) | Fixture-based test tracing a null cell end-to-end; lint/grep check for `?? 0`/`|| 0` near metric column names |
| 9. Partial coverage presented as complete | Phase 9 (data), Phase 10 (UI) | Picker shows coverage badges; `validate.mjs` refuses `loadable:true` for 100%-null measure/disease pairs |
| 10. Statistical validity hazards at 330-disease scale | Phase 11 | Assumption-check UI extended with ecological/aggregate, denominator, small-count, structural-break, and multiple-comparison disclosures |
| 11. Async migration race conditions / stale closures | Phase 10 | Reversed-resolution-order regression test passes; cache keys include every selection dimension |
| 12. Test suite decay with no CI gate | Phase 7 (baseline + CI gate), Phase 12 (final sweep) | CI workflow exists and blocks merge on red tests/typecheck; zero red tests at phase exit |
| 13. Secrets/logic outside version control | Phase 9 (secret), Phase 8 (ingest validation coverage) | Secret rotated + CI secret-scan passes; Edge Function source present in repo with tests |

## Sources

- Internal (primary evidence, read directly for this research): `trabalhos datasus/scripts/coleta_sih_multi_disease.py`, `trabalhos datasus/scripts/scrape_upload_sih.py`, `trabalhos datasus/scripts/overnight_watchdog.sh`, `scripts/catalog/validate.mjs`, `scripts/catalog/build.mjs`, `scripts/catalog/paths.mjs`, `scripts/catalog/syncColumnMap.mjs`, `scripts/catalog/diseases.json`, `scripts/catalog/columnMap.json`, `scripts/catalog/uploadSihToSupabase.mjs`, `scripts/catalog/sql/0.sql`, `src/features/catalog/catalogAnalysisData.ts`, `src/features/catalog/diseases.lista.json`, `public/data/catalog/variables.json`, `src/lib/supabaseClient.ts`, `src/shared/flow/FlowSteps.tsx`, `docs/SUPABASE-CATALOG.md`, `.planning/PROJECT.md`.
- [Data Suppression and Working with Small Numbers (NC DHHS)](https://www.dph.ncdhhs.gov/media/5708/open) — MEDIUM, corroborates null-vs-zero epidemiological hazard.
- [The Impact of Data Suppression on Local Mortality Rates: The Case of CDC WONDER (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4103252/) — MEDIUM, directional bias from ignoring suppressed/missing counts.
- [Estimating County-Level Mortality Rates Using Highly Censored Data From CDC WONDER (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6583819/) — MEDIUM.
- [Chapter 6: Pitfalls to Avoid — Intro to GIS and Spatial Analysis (MGIMond)](https://mgimond.github.io/Spatial/pitfalls-to-avoid.html) — MEDIUM, MAUP/ecological fallacy in choropleth mapping.
- [Modifiable Areal Unit Problem — ScienceDirect Topics](https://www.sciencedirect.com/topics/earth-and-planetary-sciences/modifiable-areal-unit-problem) — MEDIUM.
- [Ecological Fallacy — ScienceDirect Topics](https://www.sciencedirect.com/topics/computer-science/ecological-fallacy) — MEDIUM.
- [Fixing Race Conditions in React with useEffect (Max Rozen)](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect) — MEDIUM, stale-closure/ignore-flag pattern.
- [Using AbortController to deal with race conditions in React (wanago.io)](https://wanago.io/2022/04/11/abort-controller-race-conditions-react/) — MEDIUM.
- [Migrating Foreign Keys in PostgreSQL (Thomas Skowron)](https://thomas.skowron.eu/blog/migrating-foreign-keys-in-postgresql/) — LOW–MEDIUM, general PK/FK rename patterns and cost caveats; not benchmarked against this specific schema.
- [How to change PRIMARY KEY of an existing PostgreSQL table (gist)](https://gist.github.com/scaryguy/6269293) — LOW, community pattern, use as a starting point only.
- Ethical scraping/rate-limiting general guidance (ScrapingAPI.ai, SparkProxy, Pluralsight, DataCamp — aggregated via WebSearch) — LOW–MEDIUM, no DataSUS/TabNet-specific documentation was found; the 1–2 req/s and backoff/circuit-breaker recommendations are general best practice, not TabNet-specific policy.
- `.agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md`, `lock-short-transactions.md`, `data-upsert.md` — internal, vendored skill reference used to ground the PK-migration and upsert-race guidance; treat as MEDIUM (general PostgreSQL practice, not project-specific verification).

---
*Pitfalls research for: Bioestatística LACIR v3.0 (dados confiáveis + pesquisa dinâmica via Supabase)*
*Researched: 2026-07-28*
