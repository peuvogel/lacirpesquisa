---
phase: 01-redesign-base-react-shell
plan: 03
subsystem: data-input
tags: [typescript, vitest, differential-testing, datasus, tabnet, parser-port]

requires:
  - phase: 01-01
    provides: Vite/React/Tailwind v4 scaffold, vitest+jsdom test harness
provides:
  - "src/shared/data-input/parseTabular.ts — typed port of tabular-data-input.js (delimiter/decimal-comma tolerance, zero-dependency XLSX reader, recognition state builders)"
  - "src/shared/data-input/datasusImporter.ts — typed port of datasus-importer.js (text normalization, delimiter detection, header-candidate scoring, initial mapping)"
  - "src/shared/data-input/datasusNormalizer.ts — typed port of datasus-normalizer.js (column-role normalization, metric/category/time options, test suggestions, Phase 2+ derivation functions)"
  - "src/shared/data-input/legacyAdapters.ts — minimal typed utils/stats surface (readFileText, parseNumber, mean, normalizeImportedText/Label)"
  - "src/shared/data-input/types.ts — TabularLoadState / DatasusSource / DatasusMapping / NormalizedDatasusResult shapes"
  - "src/test/fixtures/tabnet/ — 3 hand-authored real-shaped TABNET fixtures + README"
affects: [01-06-useTabularInput, 01-08-useDatasusWizard, phase-2-statistical-engines]

tech-stack:
  added: []
  patterns:
    - "Differential parity testing: every ported function is asserted `toEqual` against a live `import` of the original assets/js/*.js module over the same fixtures/tables, so any accidental behavior drift fails a test rather than shipping silently"
    - "allowJs + node types in tsconfig.json let vitest/tsc import the legacy .js modules directly for parity comparison without hand-written .d.ts shims"
    - "Legacy adapter isolation: ported parsers only ever call the small legacyUtils/legacyStats surface (readFileText, parseNumber, mean, normalizeImportedText/Label) — no other legacy utils/Stats members were ported in Phase 1"

key-files:
  created:
    - src/shared/data-input/types.ts
    - src/shared/data-input/legacyAdapters.ts
    - src/shared/data-input/legacyAdapters.test.ts
    - src/shared/data-input/parseTabular.ts
    - src/shared/data-input/parseTabular.test.ts
    - src/shared/data-input/datasusImporter.ts
    - src/shared/data-input/datasusNormalizer.ts
    - src/shared/data-input/datasusImporter.test.ts
    - src/test/fixtures/tabnet/README.md
    - src/test/fixtures/tabnet/tabnet-semicolon-metadata.txt
    - src/test/fixtures/tabnet/tabnet-tab-mojibake.txt
    - src/test/fixtures/tabnet/tabnet-comma-ambiguous.txt
  modified:
    - tsconfig.json

key-decisions:
  - "No genuine raw TABNET export existed under `trabalhos datasus/` (all pre-cleaned by the coleta_* scripts), so all three fixtures were hand-authored to match real TABNET/DataSUS export conventions instead of derived from a captured file — documented in src/test/fixtures/tabnet/README.md"
  - "datasus-importer.js's own splitDelimitedLine (tuned for DataSUS row shapes) was kept as a separate, undeduplicated implementation from tabular-data-input.js's splitDelimitedLine (tuned for generic pasted tables) per Pitfall 3 — merging them was explicitly out of scope"
  - "datasusNormalizer.ts's Phase 2+ statistical derivation functions (deriveIndependentTTest, derivePairedTTest, deriveCorrelationPairs, derivePraisSeries) were ported in full and are typed/reachable, but their numerics are NOT exercised by any Phase 1 test — that parity work belongs to Phase 2"
  - "readTabularFileState's try/catch around the XLSX read path (T-01-DoS mitigation) already existed verbatim in the legacy source (assets/js/tabular-data-input.js:695-724) and was preserved as-is, not newly added"

requirements-completed: [UI-03]

duration: ~10min
completed: 2026-07-25
---

# Phase 1 Plan 03: Port Tabular + DataSUS Importer/Normalizer Summary

**Typed, byte-for-byte ports of `tabular-data-input.js`, `datasus-importer.js`, and `datasus-normalizer.js` into `src/shared/data-input/`, proven behavior-identical to the legacy modules via differential parity suites run against three hand-authored messy TABNET fixtures.**

## Performance

- **Duration:** ~10 min (14:21:47 → 14:31:07)
- **Tasks:** 3 completed
- **Files:** 12 created, 1 modified

## Accomplishments

- `legacyAdapters.ts` ports the exact minimal legacy surface named in the plan's `<interfaces>` (`readFileText`, `parseNumber`, `mean`, `normalizeImportedText`, `normalizeImportedLabel`) verbatim from `assets/js/app.js`, including the tuned mojibake-repair scoring weights — nothing else from legacy `utils`/`Stats` was ported
- `parseTabular.ts` is a verbatim typed port of all 777 lines of `tabular-data-input.js`, including the zero-dependency XLSX reader (`unzipDeflateRaw`, `findEndOfCentralDirectory`, `readWorkbookTablesFromFile`, etc.) — no `xlsx`/`sheetjs` dependency added, no `dangerouslySetInnerHTML`/`escapeHtml` anywhere in the port
- `datasusImporter.ts` and `datasusNormalizer.ts` are verbatim typed ports of `datasus-importer.js` (534 lines) and `datasus-normalizer.js` (864 lines) respectively, including header-candidate scoring, column-role normalization, and the Phase 2+ statistical derivation functions
- Three hand-authored TABNET fixtures (`tabnet-semicolon-metadata.txt`, `tabnet-tab-mojibake.txt`, `tabnet-comma-ambiguous.txt`) exercise metadata-row header detection, mojibake repair, and comma/decimal-comma ambiguity respectively
- Differential parity suites (`legacyAdapters.test.ts`, `parseTabular.test.ts`, `datasusImporter.test.ts`) import the untouched `assets/js/*.js` modules directly (via `allowJs`) and assert `toEqual` between port and legacy output across all three fixtures plus numeric/delimiter value tables — 12 parity/direct tests in the Task 3 suite alone, all green
- Direct assertions confirm the metadata-fixture's detected `headerRowIndex > 0` (header scoring beats "first row is header") and that `isTotalLikeToken` flags the trailing "Total" row
- `types.ts` contains zero `any` — every dynamic shape is `unknown` narrowed at the call site
- `assets/js/*` left completely untouched (verified via `git status --short assets/js/`) — still the reference for Phase 2

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture real TABNET fixtures and port the legacy adapter surface** - `5543c90` (feat)
2. **Task 2: Port tabular-data-input.js verbatim and prove parity differentially** - `f379e95` (feat)
3. **Task 3: Port the DataSUS importer and normalizer with parity coverage** - `22829d9` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/shared/data-input/types.ts` - `TabularLoadState`, `RecognizedColumn`, `TabularRecognitionError`, `DatasusSource`/`DatasusMapping`, `NormalizedDatasusResult` and related shapes
- `src/shared/data-input/legacyAdapters.ts` - `readFileText`, `parseNumber`, `mean`, `normalizeImportedText`, `normalizeImportedLabel`, `legacyUtils`, `legacyStats`
- `src/shared/data-input/legacyAdapters.test.ts` - `parseNumber` input table (`'1.234,56'`, `'—'`, `''`, `'abc'`, `'12%'`, etc.), mojibake-repair parity against the tab-mojibake fixture
- `src/shared/data-input/parseTabular.ts` - `splitDelimitedLine`, `detectDelimiter`, `normalizeNumericSource`, `parseDelimitedRows`, `matchTabularColumns`, `findBestTabularCandidate`, `readWorkbookTablesFromFile`, `readTabularFileState`, `readTabularPasteState`, and the full XLSX reader chain
- `src/shared/data-input/parseTabular.test.ts` - differential parity vs. `assets/js/tabular-data-input.js` over 3 fixtures + a 15-value numeric/delimiter table, plus direct header-detection and friendly-error-state assertions
- `src/shared/data-input/datasusImporter.ts` - `normalizeDatasusText`, `detectDatasusDelimiter`, `splitDelimitedLine` (DataSUS-specific), `buildHeaderCandidates`, `createInitialDatasusMapping`, `parseDatasusText`, `isTotalLikeToken`, `cleanDatasusCategoryLabel`
- `src/shared/data-input/datasusNormalizer.ts` - `normalizeDatasusSource`, `getMetricOptions`, `getCategoryOptions`, `getTimeOptions`, `filterSourceRecords`, `suggestTestsForSources`, plus Phase 2+ `deriveIndependentTTest`/`derivePairedTTest`/`deriveCorrelationPairs`/`derivePraisSeries`
- `src/shared/data-input/datasusImporter.test.ts` - differential parity vs. both legacy modules over the 3 fixtures for `parseDatasusText`, `buildHeaderCandidates`, `normalizeDatasusSource`, plus direct `headerRowIndex > 0` and `isTotalLikeToken` assertions
- `src/test/fixtures/tabnet/{README.md, tabnet-semicolon-metadata.txt, tabnet-tab-mojibake.txt, tabnet-comma-ambiguous.txt}` - real-shaped TABNET input samples
- `tsconfig.json` - `allowJs: true` and `"node"` added to `types` (enables importing legacy `.js` modules and Node `fs`/`path` in test files under `tsc --noEmit`)

## Decisions Made

- Hand-authored all three TABNET fixtures rather than deriving from `trabalhos datasus/` — no raw/messy export existed there to base them on (documented in `src/test/fixtures/tabnet/README.md`)
- Kept `datasus-importer.js`'s `splitDelimitedLine` and `tabular-data-input.js`'s `splitDelimitedLine` as two separate, undeduplicated implementations — they are tuned against different input shapes and merging them would be exactly the "cleanup" refactor Pitfall 3 forbids
- Ported the normalizer's Phase 2+ statistical derivation functions in full (they live in the same file and Phase 2 will need them) but wrote no Phase 1 tests for their numerics — flagged explicitly for the Phase 2 planner in both the file's header comment and here

## Deviations from Plan

None from the plan itself — all three tasks were executed as written. No legacy bugs were discovered in `assets/js/*` during the port. Five in-flight fixes were needed to satisfy `tsc --strict`, four purely mechanical (type narrowing at the boundary, no behavior change) and one (#5) a self-introduced precedence bug caught and fixed before commit — none altered any ported function's ported behavior:

1. Added `"node"` to `tsconfig.json`'s `types` array to resolve `node:fs`/`__dirname` in test files.
2. Cast a `Uint8Array` to `unknown as BlobPart` in `unzipDeflateRaw`'s `Blob` construction (stricter DOM lib typing than the legacy JS enforced).
3. Annotated the `.map` callback return type as `TabularCandidate | null` in `findBestTabularCandidate` so the subsequent `.filter` type-guard and `.sort` narrowed correctly.
4. Widened the `role` local variable's type to include `'primary-category'` in `createInitialDatasusMapping`.
5. Legacy `datasus-normalizer.js:849` reads `source.mapping.columns.filter(...).length >= 2` with no optional chaining (it assumes `mapping` is always present at that call site). The port's `types.ts` marks `mapping` as possibly `null`/`undefined`, so `source.mapping?.columns...length` was introduced for type-safety — but written unparenthesized as `source.mapping?.columns.filter(...).length ?? 0 >= 2`, JS operator precedence binds `?? 0 >= 2` before the outer `??`, silently comparing `0 >= 2` instead of the intended `(length ?? 0) >= 2`. Added explicit parentheses — `(source.mapping?.columns.filter(...).length ?? 0) >= 2` — so the port's *added* null-safety behaves as intended without changing the ported comparison threshold itself.

**Impact on plan:** All fixes were narrow, boundary-only type annotations required to satisfy `tsc --strict`; zero control-flow, regex, or threshold changes were made to any ported function.

## Issues Encountered

None. All three verification commands specified in the plan's tasks pass:
- `npx vitest run src/shared/data-input/legacyAdapters.test.ts && npm run typecheck` ✓
- `npx vitest run src/shared/data-input/parseTabular.test.ts && npm run typecheck` ✓
- `npx vitest run src/shared/data-input/datasusImporter.test.ts && npm run typecheck && npm run test:run` ✓ (123 tests / 9 files, full suite green)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `readTabularPasteState`/`readTabularFileState` and `parseDatasusText`/`normalizeDatasusSource` are ready for plan 01-06 (`useTabularInput`) and plan 01-08 (`useDatasusWizard`) to consume directly
- The friendly `{ status: 'error', message, details }` shape is available for the UI-03 error state
- Phase 2 planners: the normalizer's `deriveIndependentTTest`/`derivePairedTTest`/`deriveCorrelationPairs`/`derivePraisSeries` exports are present and typed but numerically **unverified** — differential parity tests for these still need to be written against real statistical fixtures before Phase 2 wires them into result screens
- No blockers

## Self-Check: PASSED

All 12 created files verified present on disk. All 3 task commit hashes (`5543c90`, `f379e95`, `22829d9`) verified in `git log --oneline --all`. Full plan-level verification re-run: `npm run test:run` (9 files, 123 tests passed), `npm run typecheck` (clean, zero `any` in `types.ts`), `git diff --stat` confirms only additions under `src/shared/data-input/` and `src/test/fixtures/tabnet/` with `assets/js/*` untouched, no `xlsx`/`sheetjs` in `package.json`.

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
