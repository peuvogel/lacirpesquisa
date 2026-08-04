---
phase: 08-taxonomia-can-nica-integridade
plan: 09
subsystem: catalog-ui
tags: [taxonomy, catalog, aliases, mapas, variaveis, ui, vitest]

# Dependency graph
requires:
  - phase: 08-taxonomia-can-nica-integridade
    provides: "diseaseAliases.ts matcher (foldAccents/labelMatchesQuery/resolveAliasTerm/matchDiseases) + corrected 4-entry aliases.json (avc→177+178+179+180, ait→150), from 08-07's human checkpoint"
provides:
  - "src/routes/mapas/MeasureDiseasePicker.tsx — diseaseMatches delegates to labelMatchesQuery; matchDiseases computed once per query inside useMemo, unioned with the id/CID pool; D-18 explanatory strip (role=status) between the count paragraph and the disease list"
  - "src/routes/mapas/MeasureDiseasePicker.test.tsx — first test coverage for this component (9 cases), all derived from aliases.json/diseases.lista.json, none hardcoded"
  - "src/features/catalog/diseaseAliases.ts — withDiseaseAliases(entries, diseases, aliases): pure, in-memory CatalogEntry.aliases enrichment keyed by packId→tabnetCode, never written to a generated artifact"
  - "src/routes/variaveis/VariaveisPage.tsx — variablesWithAliases useMemo wraps variables before filterCatalog, using the pre-existing aliases?: string[] extension point"
  - "noTombstoneLiterals.test.ts allowlist extended to 7 paths (was 5 in 08-07): MeasureDiseasePicker.test.tsx and VariaveisPage.test.tsx added, same class of exclusion as diseaseAliases.test.ts (search-query string, never disease id)"
affects: [08-VALIDATION.md manual-verification row]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Alias match computed once per query inside a useMemo (never inside DISEASES.filter) — T-08-09-05 mitigation, same discipline as the rest of the catalog pipeline's O(n) invariants"
    - "D-18 strip is a role=status element strictly above the list, never a row/badge — the D-19 spoofing threat only concerns per-row labels, not contextual copy echoing the search term back to the student"
    - "withDiseaseAliases matches CatalogEntry.packId to DiseaseDef.packId directly (both already carry this field) — never string-slicing an id, avoiding a second hand-maintained mapping"
    - "Pure enrichment stays in-memory (VariaveisPage's own useMemo), never written back to public/data/catalog/variables.json — preserves TAX-06 (generated artifacts stay generated) the same way the Mapas picker's apelido layer stays index-only (D-19)"

key-files:
  created:
    - src/routes/mapas/MeasureDiseasePicker.test.tsx
  modified:
    - src/routes/mapas/MeasureDiseasePicker.tsx
    - src/features/catalog/diseaseAliases.ts
    - src/features/catalog/diseaseAliases.test.ts
    - src/routes/variaveis/VariaveisPage.tsx
    - src/routes/variaveis/VariaveisPage.test.tsx
    - src/test/noTombstoneLiterals.test.ts
    - .planning/phases/08-taxonomia-can-nica-integridade/08-VALIDATION.md

key-decisions:
  - "Variáveis search DOES get the alias layer (the plan's open question, resolved as specified): two of the AVC codes (178/179) and TVP (185) have physical packs and variables.json entries; post-canonization none of their ids/labels contain 'AVC', so searching 'avc' in Variáveis would silently return zero without this layer — the same defect class TAX-05 exists to prevent, on a second screen"
  - "Fuzzy search over the CID field stays deferred (unchanged from 08-CONTEXT's deferred list) — no measured use case, and CID is already matched by normalized prefix/substring in the Mapas picker"
  - "VariableList.tsx receives no changes — confirmed by `git diff --stat` showing zero diff; it does its own grouping/sorting over already-filtered entries and has no search of its own"
  - "D-18 strip is exempted from the 'no avc text outside the search field' test assertion by scoping that assertion to the disease-row list container (ul[role=list]), not the whole component — the strip's own D-18 example copy ('AVC corresponde a...') deliberately echoes the search term back to the student as context, which is a different concern from a per-row alias badge (the actual T-08-09-01/T-08-09-03 threats)"
  - "Test assertions for avc/ait use aliases.json as ground truth via ALIASES lookups, never hardcoded counts — this is what let the plan's stale 3-category/ait→180 assumptions (superseded by 08-07's human checkpoint) get corrected by simply reading the corrected dictionary instead of by editing test literals"

requirements-completed: [TAX-05]

# Metrics
duration: ~20min
completed: 2026-08-04
---

# Phase 08 Plan 09: Alias search plugged into Mapas + Variáveis Summary

**`matchDiseases`/`labelMatchesQuery` plugged into `MeasureDiseasePicker.diseaseMatches` with a D-18 explanatory strip and 9 new component tests, plus a new pure `withDiseaseAliases` that wires the same curated dictionary into the Variáveis search via the pre-existing `CatalogEntry.aliases` field — no generated artifact touched, no badge on any row, corrected against 08-07's human-checkpoint dictionary (avc=4 categories, ait→150) rather than the plan's stale 3-category assumption.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-04
- **Tasks:** 3/3 complete
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- `diseaseMatches` in `MeasureDiseasePicker.tsx` now delegates label matching to `labelMatchesQuery` (fold-accent + AND-tokens + fuzzy floor 6) instead of a raw `.includes` substring check; `matchDiseases(DISEASES, q, ALIASES)` is computed exactly once per query inside a `useMemo`, never per-disease, and its result is unioned with the id/CID pool without duplicating
- D-18 explanatory strip (`role="status"`) renders between the result-count paragraph and the disease list, plural/singular copy, only when a curated alias fired — verified it does not fire for automatic-rule-only matches (`pneumonia`) or no-match queries
- `MeasureDiseasePicker.test.tsx` created (component had zero tests before this plan) — 9 cases proving: official labels/count read live from `aliases.json` (not hardcoded), the strip text, that a checkbox click delivers the canonical disease id (never the term `avc`), that `"infarto cerebral"` reaches the byte-identical row text as `"avc"` (the direct D-19 proof), that no row contains the text `avc`, the `tvp` singular form, and the `aterosclerose`→`Arteroesclerose` automatic-rule case with no curated entry
- `withDiseaseAliases` added to `diseaseAliases.ts`: pure function matching `CatalogEntry.packId` to `DiseaseDef.packId` (both already carry this field — no id string-slicing), enriching `aliases` with curated terms for entries whose disease's `tabnetCode` is cited by an alias entry, preserving any pre-existing aliases, passing everything else through as the same object reference
- `VariaveisPage.tsx` wires `withDiseaseAliases(variables, DISEASES, ALIASES)` into one `useMemo` immediately before the existing `filterCatalog` call — confirmed via `git diff --stat` that `VariableList.tsx`, `filterCatalog.ts`, and `public/data/catalog/variables.json` all have zero diff; the enrichment is in-memory only
- `npm run catalog:validate` reverified green after Task 3 (invariants B/D2 undisturbed) and `npm run gate` green after every task (105 test files / 762 tests at HEAD, up from 747 at 08-08)

## Task Commits

1. **Task 1: Plugar o matcher em diseaseMatches, de forma aditiva** - `9732ae0` (feat)
2. **Task 2: Tira explicativa do D-18 e cobertura de comportamento** - `bbfc09c` (feat)
3. **Task 3: Decidir e implementar a cobertura de apelido na busca de Variaveis** - `d02f549` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `src/routes/mapas/MeasureDiseasePicker.tsx` - `diseaseMatches` uses `labelMatchesQuery`; `searchResult`/`visibleDiseases` two-`useMemo` split (alias computed once per query); D-18 strip inserted before the `ul`
- `src/routes/mapas/MeasureDiseasePicker.test.tsx` - new, 9 cases, first coverage for this component
- `src/features/catalog/diseaseAliases.ts` - `withDiseaseAliases` + `DiseaseWithPack`/`AliasableCatalogEntry` types added; stale "3 curated codes" docstring corrected to reflect the 08-07 checkpoint's 4-category `avc`
- `src/features/catalog/diseaseAliases.test.ts` - 5 new `withDiseaseAliases` cases
- `src/routes/variaveis/VariaveisPage.tsx` - `variablesWithAliases` useMemo added before `filterCatalog`
- `src/routes/variaveis/VariaveisPage.test.tsx` - 1 new behavior case: `"avc"` returns a non-empty result with the official label, no literal "AVC" text
- `src/test/noTombstoneLiterals.test.ts` - allowlist extended 5→7 paths (deviation, see below)
- `.planning/phases/08-taxonomia-can-nica-integridade/08-VALIDATION.md` - Manual-Only Verifications row updated: 3→4 categories, notes the new automated component-level proxy, keeps the literal browser click-through as end-of-phase `human_needed`

## Decisions Made

See `key-decisions` in frontmatter for the full list. Headline: **the Variáveis-search open question is resolved as "yes, wire the alias layer in"** — two AVC codes and TVP have physical packs, so post-canonization `variables.json` searches for "avc" would otherwise silently return zero, which is exactly the defect class TAX-05 exists to close, on a second screen the picker's fix alone does not reach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Ground truth correction, mandated by orchestrator's inherited_context — not a plan bug] Test assertions written against the corrected 4-category `avc` / `ait`→150, not the plan's literal 3-category / `ait`→180 text**
- **Found during:** Reading the plan's Task 2 `<action>` (which says "exactly 3 lines... Hemorragia intracraniana, Infarto cerebral e Acid vascular cerebr...") against the already-committed, corrected `aliases.json` (08-07's human checkpoint broadened `avc` to 4 categories including code 180, and remapped `ait` from 180 to 150)
- **Issue:** The plan text (and its `must_haves.truths`/`success_criteria`) predates the 08-07 checkpoint correction and still describes the pre-checkpoint 3-category shape
- **Fix:** All test assertions in `MeasureDiseasePicker.test.tsx` derive expected labels/counts by reading `ALIASES`/`DISEASES` at test time (`aliasEntry('avc').categorias`, `diseaseByTabnetCode(...)`) rather than hardcoding "3" or specific labels — so the tests automatically track whatever the dictionary says today. No plan document was edited; the dictionary is the ground truth per explicit orchestrator instruction
- **Files modified:** src/routes/mapas/MeasureDiseasePicker.test.tsx (written this way from the start, not retrofitted)
- **Verification:** `npx vitest run src/routes/mapas/MeasureDiseasePicker.test.tsx` — 9/9 green, asserting 4 categories for `avc`
- **Committed in:** `bbfc09c` (Task 2 commit)

**2. [Rule 3 - Blocking] Invariant F (noTombstoneLiterals.test.ts) rejected the new test files' literal alias-term usage**
- **Found during:** Task 2's pre-commit hook (`npm run gate`), then again at Task 3's pre-commit hook
- **Issue:** `MeasureDiseasePicker.test.tsx` types `'avc'`/`'aterosclerose'` into the real search input and reads them back via `ALIASES.find(...).termos.includes(...)`; `VariaveisPage.test.tsx` types `'avc'` into the real search box. Both `avc` and `aterosclerose` are two of the 21 tombstone ids (D-06/D-23), so invariant F's bare-quoted-literal scan flagged 18 hits in the first file and 2 in the second — a direct, mechanical consequence of writing the exact tests the plan's `<action>` specifies, not a pre-existing issue
- **Fix:** Extended `noTombstoneLiterals.test.ts`'s `ALLOWLIST_RELATIVE_PATHS` from 5 to 7 paths (5→6 after Task 2, 6→7 after Task 3), adding both new test files with the identical documented rationale already established for `diseaseAliases.test.ts` in 08-07: the literal is a *search-query string* typed into a real input, never a disease `id`/identity — the same class of legitimate exclusion, not a new mechanism
- **Files modified:** src/test/noTombstoneLiterals.test.ts
- **Verification:** `npx vitest run src/test/noTombstoneLiterals.test.ts` — 4/4 green after each extension; full `npm run gate` green both times
- **Committed in:** `bbfc09c` (Task 2, 5→6) and `d02f549` (Task 3, 6→7)

---

**Total deviations:** 1 ground-truth correction (mandated, not a bug) + 1 auto-fixed blocking issue (2 occurrences of the same class, both resolved by extending an already-established mechanism). No architectural decisions (Rule 4) were needed — both fixes extend a pattern this same phase already established (05-07's aliases.json/diseaseAliases.test.ts allowlist entries) rather than inventing a new one.

## Manual Verification Status

Per this project's established pattern (Phase 4/5: "automated gate PASS; human [UX] deferred to human_needed"), the literal browser click-through specified in the plan's top-level `<verification>` ("abrir Mapas, digitar avc, confirmar...") was **not** performed by this session — there is no interactive browser available to a sequential autonomous executor, and `human_verify_mode` is configured as `end-of-phase`, not per-plan.

What exists instead, registered in `08-VALIDATION.md`'s Manual-Only Verifications table: `MeasureDiseasePicker.test.tsx` is an automated DOM-level proxy for the exact same assertions (real component render, real `userEvent.type` into the real search input, real checkbox click, real strip text) — but jsdom is not a substitute for a human looking at the rendered app. The row explicitly flags this as still open, with the updated instructions (4 categories, not 3) for whoever performs the end-of-phase sweep.

## Issues Encountered

None beyond the two deviations above, both resolved within the same task's commit before the gate went green.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TAX-05 is now fully wired end-to-end: the matcher and dictionary (08-07) reach both consuming screens (Mapas picker, Variáveis search) via this plan, with zero writes to any generated artifact.
- `npm run gate` is green (105 test files / 762 tests, typecheck clean, build succeeds) at commit `d02f549`.
- Plan 08-10 (the only remaining plan in this phase) can proceed; no blockers left by this plan.
- The end-of-phase human-verify sweep should cover the row updated in `08-VALIDATION.md`: open Mapas, type "avc"/"tvp"/"ait"/"aterosclerose", confirm the rendered categories/strip/labels match what the automated suite already proves at the DOM level.

## Self-Check: PASSED

- FOUND: src/routes/mapas/MeasureDiseasePicker.tsx
- FOUND: src/routes/mapas/MeasureDiseasePicker.test.tsx
- FOUND: src/features/catalog/diseaseAliases.ts
- FOUND: src/features/catalog/diseaseAliases.test.ts
- FOUND: src/routes/variaveis/VariaveisPage.tsx
- FOUND: src/routes/variaveis/VariaveisPage.test.tsx
- FOUND: src/test/noTombstoneLiterals.test.ts
- FOUND: .planning/phases/08-taxonomia-can-nica-integridade/08-VALIDATION.md
- FOUND commit: 9732ae0 (Task 1)
- FOUND commit: bbfc09c (Task 2)
- FOUND commit: d02f549 (Task 3)

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-04*
