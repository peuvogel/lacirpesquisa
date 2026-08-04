---
phase: 08-taxonomia-can-nica-integridade
plan: 02
subsystem: catalog-pipeline
tags: [catalog, taxonomy, datasus, tabnet, rename-map, html-entities]

# Dependency graph
requires:
  - phase: 08-01
    provides: Versioned Lista Morb snapshot + listaMorbSource.mjs parser, exclusions.json/extra-diseases.json/lista-morb-cid.json as data-with-reason inputs the generator consumes
provides:
  - "sync-lista-morb.mjs rewritten as a pure CLI-plus-export module (buildDiseases/buildRuntimeLista/renderDiseasesJson/renderListaJson/generateFromSnapshot) with no id dictionary, no fetch, and a strict code-only exclusion filter (D-25) — main() not run, repo taxonomy untouched"
  - "src/test/fixtures/taxonomy/diseases.pre-migracao.json — the corrupted pre-migration state frozen byte-for-byte before any regeneration, the only possible proof of TAX-02 after D-24"
  - "scripts/catalog/rename-map.json — the old→canonical id map computed from the diff (D-12), never transcribed: 21 renames, 1 addition (code 330), 0 removals, 21 tombstones, with provenance fields"
  - "scripts/catalog/buildRenameMap.mjs — computeRenameMap/renderRenameMap, aborts on same-side collision, lost category, or duplicate canonical"
  - "src/features/catalog/renameMap.test.ts — recomputation-is-byte-identical test, makes manual edits to rename-map.json fail the suite"
  - "decodeEntities() in listaMorbSource.mjs fixed to decode the full case-sensitive Latin-1 named-entity set actually present in the TabNet snapshot (was silently corrupting ~59 labels), with the committed extract re-derived from the unchanged HTML"
affects: [08-03, 08-04, 08-05, 08-06, 08-08, 08-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI-plus-export molde (validate.mjs shape) applied to both sync-lista-morb.mjs and buildRenameMap.mjs — main() behind isDirectRun, pure functions exported for reuse by other scripts and vitest"
    - "Rename/diff maps computed and diffed from committed data, never hand-transcribed from human ground-truth notes — ground truth serves only as a post-hoc sanity check"
    - "Case-sensitive named-HTML-entity lookup table instead of a case-insensitive regex chain, to correctly distinguish word-initial uppercase entities (&Aacute;) from lowercase (&aacute;)"

key-files:
  created:
    - scripts/catalog/buildRenameMap.mjs
    - scripts/catalog/rename-map.json
    - src/test/fixtures/taxonomy/diseases.pre-migracao.json
    - src/features/catalog/renameMap.test.ts
  modified:
    - scripts/catalog/sync-lista-morb.mjs
    - scripts/catalog/listaMorbSource.mjs
    - scripts/catalog/snapshot/lista-morb.extract.json
    - package.json

key-decisions:
  - "computeRenameMap indexes both sides by tabnetCode (never by id, since id is exactly what's being renamed), aborts on same-side tabnetCode collision, on any removed code (would be silent category loss, not a rename), and on duplicate canonical id across renames"
  - "rename-map.json carries explicit provenance fields (version/generatedBy/before/after) so a human reviewing the PR can see where each pair came from without re-running anything"
  - "Rule 1 fix: decodeEntities() only handled 9 of the 18 named HTML entities present in the committed snapshot (missing acirc/ecirc/ocirc/uuml/agrave and every uppercase variant), corrupting ~59 labels with literal &ocirc;/&ecirc;/&acirc;/&uuml;/&agrave; fragments baked into ids. This inflated the diff-computed rename map from the expected 21 to a spurious 76 — caught by cross-checking the automated computation against the ground-truth note's 21-row table before committing. Replaced with a case-sensitive Latin-1 named-entity table (18 accented letters × upper/lower + nbsp/amp/quot/apos/lt/gt) and re-derived scripts/catalog/snapshot/lista-morb.extract.json by re-parsing the already-committed HTML — no network access, sha256/invariante C unchanged since the HTML bytes themselves were never wrong"

patterns-established:
  - "Any generator/diff output that's supposed to match a human ground-truth note is cross-checked against that note as a sanity gate before commit — divergence is investigated as a likely upstream bug, never silently accepted or transcribed over"

requirements-completed: [TAX-01, TAX-02]

# Metrics
duration: ~15min (Task 1, prior session) + ~5min (Tasks 2-3, this continuation session)
completed: 2026-08-03
---

# Phase 8 Plan 2: Gerador puro + rename-map.json computado do diff Summary

**`sync-lista-morb.mjs` reescrito sem `KNOWN_BY_CODE` nem filtro por rótulo, fixture pré-migração congelada, e `rename-map.json` (21 renomeações, 1 adição, 0 remoções) computado do diff — com um bug de decodificação de entidades HTML herdado da 08-01 corrigido no processo, pois inflava o mapa para 76 renomeações espúrias.**

## Performance

- **Duration:** Task 1 ~15min (prior session, ended 2026-08-03T17:58:32-03:00); Tasks 2-3 ~5min (this continuation session, 2026-08-03T21:56–21:59-03:00) after a provider-quota interruption mid-Task-2
- **Tasks:** 3/3 completed
- **Files modified:** 8 (4 created, 4 modified — including the out-of-scope-but-blocking `listaMorbSource.mjs`/`lista-morb.extract.json` fix)

## Accomplishments
- `sync-lista-morb.mjs` no longer has an id dictionary or a label-based filter — the only path skipped is an empty `code` or a `code` present in `exclusions.json`; `generateFromSnapshot()` yields 331 agravos in memory, code 330 included, with no disk writes
- `src/test/fixtures/taxonomy/diseases.pre-migracao.json` freezes the corrupted `diseases.json` byte-for-byte, giving TAX-02 a fixed pre-state to prove against once 08-06 flips the taxonomy
- `rename-map.json` computed from the diff between that fixture and the canonical regeneration matches the ground-truth note exactly: 21 renames, 1 addition (code 330), 0 removals, 21 unique tombstones — including the 21st id (code 180) the original note missed, and both verified cycles (186↔187, 173↔182)
- `renameMap.test.ts` makes recomputation a commit-time invariant: 6 cases, including a byte-identical string comparison against the committed file and a live sanity check (edit one character → suite goes red, revert → clean)
- Discovered and fixed a real Rule 1 bug in 08-01's `decodeEntities()`: it silently left `&acirc;`, `&ecirc;`, `&ocirc;`, `&uuml;`, `&agrave;`, and every uppercase named entity undecoded, which corrupted ~59 labels in the committed extract and would have propagated those literal `&ocirc;`-style fragments into the canonical taxonomy's `id`/`label` fields had it gone unnoticed. Caught because the computed rename map (76 entries) diverged sharply from the ground-truth sanity check (21 entries) — exactly the discipline D-12 exists to enforce
- The repo's shipped taxonomy is still untouched: `scripts/catalog/diseases.json` and `src/features/catalog/diseases.lista.json` do not appear in `git status` after any of this plan's work — the generator's `main()` was never invoked

## Task Commits

1. **Task 1: Reescrever sync-lista-morb.mjs como modulo puro sobre o snapshot** - `e6aebd2` (feat) — committed in a prior session before the quota interruption
2. **Task 2: Congelar a fixture pre-migracao e computar rename-map.json do diff** - `ebf2719` (feat)
3. **Task 3: Teste de recomputacao do mapa (D-12)** - `61d8db5` (test)

_No separate plan-metadata commit — this SUMMARY/STATE/ROADMAP update commit follows below._

## Files Created/Modified
- `scripts/catalog/sync-lista-morb.mjs` - CLI-plus-export module; `KNOWN_BY_CODE`/`SKIP_CODES`/`fetch` removed, exports `buildDiseases`/`buildRuntimeLista`/`renderDiseasesJson`/`renderListaJson`/`generateFromSnapshot`
- `scripts/catalog/buildRenameMap.mjs` - `computeRenameMap`/`renderRenameMap`, indexed by `tabnetCode`, aborts on collision/loss/duplicate-canonical; `main()` writes `rename-map.json`
- `scripts/catalog/rename-map.json` - Committed, computed map: 21 renames, 1 added (code 330), 0 removed, 21 tombstones, with provenance fields
- `src/test/fixtures/taxonomy/diseases.pre-migracao.json` - Byte-for-byte freeze of the pre-regeneration `diseases.json` (330 entries)
- `src/features/catalog/renameMap.test.ts` - 6 vitest cases: byte-identical recomputation, counts/shape, the two verified cycles, tombstone-that-is-also-canonical, throw-on-lost-code, throw-on-collision
- `scripts/catalog/listaMorbSource.mjs` - `decodeEntities()` rewritten from a 9-entity case-insensitive chain to an 18-letter case-sensitive named-entity table (Rule 1 fix, see below)
- `scripts/catalog/snapshot/lista-morb.extract.json` - Re-derived by re-parsing the already-committed HTML with the fixed decoder (no network access); sha256/invariante C unchanged, ~59 labels corrected
- `package.json` - Added `catalog:sync-lista-morb` and `catalog:rename-map` scripts, neither chained into `pretest`/`gate`

## Decisions Made
See `key-decisions` in frontmatter. All architectural decisions were pre-locked by 08-CONTEXT.md (D-09 through D-25); the only decision made during execution was how to fix the entity-decoding bug (Rule 1, see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incomplete HTML entity decoding in `listaMorbSource.mjs` (inherited from 08-01)**
- **Found during:** Task 2, while computing `rename-map.json` — the automated diff produced 76 renames instead of the 21 the ground-truth note documents
- **Issue:** `decodeEntities()` (written in plan 08-01) only handled `aacute/eacute/iacute/oacute/uacute/atilde/otilde/ccedil/nbsp/amp` case-insensitively. The committed TabNet snapshot HTML also contains `&acirc;`, `&ecirc;`, `&ocirc;`, `&uuml;`, `&agrave;`, and 5 uppercase named entities (`&Aacute;`, `&Uacute;`, `&Oacute;`, `&Iacute;` in the select block). Those entities passed through undecoded as literal text, so labels like "Tuberc intest perit&ocirc;nio gl&acirc;ngl mesentéricos" and "Seq&uuml;elas de tuberculose" got slugified with the entity fragment baked into the id (e.g. `tuberc_intest_perit_ocirc_nio_gl_acirc_ngl_mesentericos`), producing a spurious `id` mismatch against the pre-migration fixture for every one of the ~59 affected codes
- **Fix:** Replaced the entity decoder with a case-sensitive lookup table covering all 18 accented Latin-1 letters used in Portuguese (upper + lower) plus `nbsp`/`amp`/`quot`/`apos`/`lt`/`gt`, confirmed exhaustive by scanning the committed HTML byte-for-byte (`LC_ALL=C grep -aoE '&[a-zA-Z]+;'`). Re-derived `scripts/catalog/snapshot/lista-morb.extract.json` by re-parsing the already-committed HTML with the fixed decoder — no network access, HTML bytes untouched, so `checkSnapshotIntegrity()` (invariante C) still returns `[]`
- **Files modified:** `scripts/catalog/listaMorbSource.mjs`, `scripts/catalog/snapshot/lista-morb.extract.json`
- **Verification:** `checkSnapshotIntegrity()` returns `[]`; rerunning `buildRenameMap` now produces exactly the ground-truth-matching 21 renames/1 added/0 removed/21 tombstones; full `npx vitest run` (99 files / 691 tests) and `npm run build` (typecheck + vite build) both green; `diseases.json`/`diseases.lista.json` still absent from `git status`
- **Committed in:** `ebf2719` (Task 2 commit — the fix was necessary to produce a correct `rename-map.json`, so it's bundled with that deliverable rather than split into a separate commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in dependency code, not introduced by this plan but blocking correct completion of Task 2's core deliverable)
**Impact on plan:** Necessary for correctness — without the fix, `rename-map.json` would have shipped with 76 mostly-spurious "renames" instead of the 21 real ones, corrupting every future plan in this phase that consumes the map. No scope creep beyond what was required to make Task 2's acceptance criteria pass; `scripts/catalog/sync-lista-morb.mjs`'s own logic (Task 1, already committed) was not touched.

## Issues Encountered

**Continuation context:** This plan's execution was split across two sessions by a provider quota limit. Task 1 was completed and committed (`e6aebd2`) in the first session. The second session's agent left `scripts/catalog/buildRenameMap.mjs` and `src/test/fixtures/taxonomy/diseases.pre-migracao.json` on disk (uncommitted) plus a `package.json` script entry, but had not yet run the generator or committed anything for Task 2. This continuation agent verified that uncommitted work against the plan's Task 2 `<action>` spec (found it correctly implemented — collision/loss/duplicate-canonical guards, provenance fields, tabnetCode-indexed diff, all present), then ran the generator and discovered the entity-decoding bug above during that verification step, before Task 2 was committed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `scripts/catalog/rename-map.json` is now the single, computed, tested source of truth for the id migration that 08-03 through 08-06 will consume (per plan objective: "esta e a plan que decide quais sao os ids canonicos")
- `generateFromSnapshot()` is available for any downstream plan/script that needs the canonical 331-agravo array in memory without touching disk
- The taxonomy actually shipped in the repo (`diseases.json`/`diseases.lista.json`) is still byte-identical to before this plan — the write/flip is explicitly deferred to 08-06 per D-24
- `npm run gate` is green (99 test files / 691 tests, typecheck clean, build succeeds)
- Downstream plans should be aware that `scripts/catalog/snapshot/lista-morb.extract.json` now decodes ~59 more labels correctly than it did after 08-01 — any plan that hardcodes or references one of those corrected labels should use the corrected (accented) form

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 8 created/referenced files found on disk. All 3 task commits (e6aebd2, ebf2719, 61d8db5) found in git log.
