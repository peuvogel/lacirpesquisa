---
phase: 08-taxonomia-can-nica-integridade
plan: 01
subsystem: catalog-pipeline
tags: [catalog, taxonomy, validation, snapshot, datasus, tabnet]

# Dependency graph
requires:
  - phase: 07-baseline-verde
    provides: green gate (typecheck + vitest + build) as pre-condition for verifying the migration didn't break anything
provides:
  - Versioned HTML snapshot + extract of the TabNet Lista Morb CID-10 source, freeing catalog:validate from network access (D-09)
  - Pure exported parser (parseListaMorbOptions/slugify/decodeEntities/loadSnapshot/checkSnapshotIntegrity) in scripts/catalog/listaMorbSource.mjs
  - Invariante C (snapshot HTML <-> extract parity) wired into catalog:validate, fail-closed
  - exclusions.json, extra-diseases.json, metricless-diseases.json as registered data-with-reason (D-14/D-25) replacing code-embedded exclusion logic
  - lista-morb-cid.json re-keyed by tabnetCode (D-11), including the code-330 CID range
  - REQUIREMENTS.md/ROADMAP.md/PROJECT.md amended to 331 agravos (D-25) and 21 corrupted ids (D-15)
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-08, 08-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed CLI+export pure function (validate.mjs mold) reused for checkSnapshotIntegrity"
    - "Data-with-written-reason instead of code-embedded exclusion/allowlist literals (exclusions.json/extra-diseases.json/metricless-diseases.json)"
    - "Disposable, never-committed conversion scripts for re-keying data files (lista-morb-cid.json), run from scratchpad — never transcribed by hand"

key-files:
  created:
    - scripts/catalog/listaMorbSource.mjs
    - scripts/catalog/snapshot/lista-morb.nibr.html
    - scripts/catalog/snapshot/lista-morb.extract.json
    - scripts/catalog/exclusions.json
    - scripts/catalog/extra-diseases.json
    - scripts/catalog/metricless-diseases.json
    - src/features/catalog/snapshotIntegrity.test.ts
  modified:
    - scripts/catalog/validate.mjs
    - scripts/catalog/lista-morb-cid.json
    - package.json
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md

key-decisions:
  - "HTML snapshot read/written as latin1 (ISO-8859-1) throughout — utf8 would silently corrupt every accented label"
  - "sha256 for invariante C computed over the raw HTML buffer (bytes as written to disk), not the decoded string, so it matches what `sha256sum` on the file would report"
  - "parseListaMorbOptions() applies zero filtering — returns all 334 raw options (including the pseudo-option and codes 330-333) in document order; partitioning/filtering is the generator's job (future plan), not the parser's"
  - "lista-morb-cid.json re-key done by a disposable conversion script run from outside the repo (scratchpad), never left behind, with an explicit multiset-of-values-unchanged assertion before writing"
  - "Code 330's CID range (W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89) sourced from RESEARCH 1.3 / mxcid10lm.htm item 1.103, added as the re-keyed map's only new key"

patterns-established:
  - "snapshot integrity (parse(html) === extract) as a named invariant callable from both CLI (validate.mjs main()) and vitest (snapshotIntegrity.test.ts), same molde as checkEntry/checkCatalog"

requirements-completed: [TAX-01, TAX-06]

# Metrics
duration: ~15min
completed: 2026-08-03
---

# Phase 8 Plan 1: Snapshot da Lista Morb + fontes de entrada como dado Summary

**Versioned HTML+extract snapshot of the TabNet Lista Morb source with a fail-closed parity invariant, plus exclusions/extra-diseases/metricless-diseases as registered data replacing code-embedded literals, and the CID map re-keyed by tabnetCode.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-03T20:37:17Z (per STATE.md session start)
- **Completed:** 2026-08-03T20:48:41-03:00 (last commit)
- **Tasks:** 3/3 completed
- **Files modified:** 13

## Accomplishments
- `catalog:validate` (chained in pretest/test:run/gate) is now network-independent: it reads a committed HTML snapshot + extract instead of fetching TabNet live (D-09)
- Invariante C (D-13) is live and fail-closed — tampering with the extract makes `npm run catalog:validate` exit 1 with a `snapshot:` message (verified live and reverted)
- Four decisions that lived as hardcoded literals in the generator (`KNOWN_BY_CODE`-adjacent logic) are now data-with-written-reason: `exclusions.json` (331/332/333 + the pseudo-option, explicitly NOT 330 per D-25), `extra-diseases.json` (amputacao_mmii as a second source), `metricless-diseases.json` (the deliberate metric-orphan exception for code 330)
- `lista-morb-cid.json` re-keyed from id to tabnetCode (D-11), immune to id renaming, computed (never transcribed) with an aborting collision/missing-id check and a multiset-identity assertion
- REQUIREMENTS.md, ROADMAP.md, PROJECT.md corrected from 330 to 331 agravos (D-25) with "330 com dado coletado" disambiguation everywhere it matters, and PROJECT.md's historical "20 agravos" corrected to 21 (D-15) without rewriting the historical framing
- ROADMAP.md's Phase 8 Notes no longer instructs adding `ON UPDATE CASCADE` (which contradicted the locked D-08 decision) — now documents D-08's rationale instead

## Task Commits

1. **Task 1: Snapshot versionado da Lista Morb + parser puro + invariante C** - `676efdc` (feat)
2. **Task 2: Exclusoes, agravo extra, mapa CID re-chaveado e registro de agravo sem metrica** - `5ad6799` (feat)
3. **Task 3: Emenda 330 para 331 nos documentos de projeto (D-25) + correcao 20->21 (D-15)** - `80dedd7` (docs)

_No plan-metadata commit separate from Task 3 — Task 3 IS the docs commit; this SUMMARY/STATE/ROADMAP update commit follows below._

## Files Created/Modified
- `scripts/catalog/listaMorbSource.mjs` - Pure parser module: slugify/decodeEntities/parseListaMorbOptions/loadSnapshot/checkSnapshotIntegrity, plus the `--refresh` network capture behind isDirectRun
- `scripts/catalog/snapshot/lista-morb.nibr.html` - Committed raw HTML snapshot (ISO-8859-1), captured live from TabNet this session
- `scripts/catalog/snapshot/lista-morb.extract.json` - Committed code->label extract (334 options), sha256-bound to the HTML
- `scripts/catalog/validate.mjs` - Wired `checkSnapshotIntegrity()` into `main()`, fail-closed on tamper
- `scripts/catalog/exclusions.json` - 4-key partition data (TODAS_AS_CATEGORIAS__, 331, 332, 333) with PT-BR reasons; code 330 deliberately absent
- `scripts/catalog/extra-diseases.json` - amputacao_mmii as a second entry source with a `reason` field (allowlist for invariante A)
- `scripts/catalog/metricless-diseases.json` - Single-key registry of the deliberate metric-orphan exception (code 330), delta-of-growth form per corrected D-25
- `scripts/catalog/lista-morb-cid.json` - Re-keyed from id to tabnetCode (330 numeric keys, including 330's new CID range)
- `src/features/catalog/snapshotIntegrity.test.ts` - 3 vitest cases covering invariante C, entity decoding, and the committed extract's shape
- `package.json` - Added `catalog:snapshot` script, deliberately not chained into pretest/gate
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md` - Amended counts per D-25/D-15

## Decisions Made
See `key-decisions` in frontmatter. All decisions were pre-locked by 08-CONTEXT.md (D-09 through D-25) — this plan is their first concrete implementation, no new architectural decisions were made during execution.

## Deviations from Plan

None — plan executed exactly as written. One correction made during Task 1 authoring: the `slugify()` regex literal was initially transcribed from 08-PATTERNS.md's markdown rendering, which displayed the `̀-ͯ` escape sequence as literal combining-mark characters. Caught before commit by byte-comparing against the actual `sync-lista-morb.mjs` source (`xxd` diff) and corrected to the exact escaped form — same regex semantics either way, but fixed for source-code hygiene before the file was ever staged. Not logged as a Rule 1-3 deviation since it was caught pre-commit during initial authoring, not a discovered bug in already-committed code.

## Issues Encountered
None. Live network fetch to TabNet succeeded on the first attempt (`curl` pre-check confirmed connectivity); `--refresh` capture ran cleanly with no retries needed.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The snapshot + the four data files (`exclusions.json`, `extra-diseases.json`, `metricless-diseases.json`, `lista-morb-cid.json`) are ready as inputs for 08-02, which rewrites `sync-lista-morb.mjs` to consume them (removing `KNOWN_BY_CODE` and the fragile label-based `/^todas/i` filter) — this plan deliberately left `sync-lista-morb.mjs` and `diseases.json`/`diseases.lista.json` untouched, per the plan's stated scope boundary ("nao muda nenhum id ainda")
- No disease id changed in this plan; `diseases.json`/`diseases.lista.json` are byte-identical to before (confirmed via diff against pre-plan HEAD)
- `npm run gate` is green (98 test files / 685 tests, typecheck clean, build succeeds)

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-03*
