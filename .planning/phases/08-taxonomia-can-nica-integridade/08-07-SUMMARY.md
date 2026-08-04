---
phase: 08-taxonomia-can-nica-integridade
plan: 07
subsystem: catalog
tags: [taxonomy, catalog, aliases, levenshtein, fuzzy-matching, validation]

# Dependency graph
requires:
  - phase: 08-taxonomia-can-nica-integridade
    provides: canonical taxonomy flip (08-06) — 331 slug-per-code disease ids/labels, invariants A-F wired into catalog:validate
provides:
  - "src/features/catalog/aliases.json — curated 4-entry clinical alias dictionary (avc, tvp, ait, varizes), each entry citing tabnetCode + labelEsperado, clinically reviewed"
  - "invariante E (checkAliases) wired into scripts/catalog/validate.mjs and npm run catalog:validate — fail-closed on tabnetCode/labelEsperado drift"
  - "src/features/catalog/diseaseAliases.ts — pure matching module: foldAccents, labelMatchesQuery (AND-between-tokens, fuzzy floor 6 chars, Levenshtein <=2), resolveAliasTerm, matchDiseases"
  - "clinically-corrected mapping: ait -> tabnetCode 150 (G45, exact ICD-10 category), avc -> 177+178+179+180 (broad cerebrovascular scope, deliberate)"
affects: [08-09-mapas-disease-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Curated dictionary chaveado por tabnetCode, nunca por slug/id — sobrevive a renomeação de id sem quebrar (T-08-07-01 mitigation)"
    - "Invariant E: labelEsperado compared byte-for-byte against canonical label per tabnetCode, fails closed"
    - "Pure matching module with zero new deps — hand-written Levenshtein DP, fuzzy floor at 6 chars to eliminate short-acronym false positives"

key-files:
  created:
    - src/features/catalog/aliases.json
    - src/features/catalog/diseaseAliases.ts
    - src/features/catalog/diseaseAliases.test.ts
  modified:
    - scripts/catalog/validate.mjs

key-decisions:
  - "ait remapped from tabnetCode 180 (I65-I69, Outras doenças cerebrovasculares) to tabnetCode 150 (G45, Acid vascular cerebr isquêm transit e síndr correl) — the original mapping was clinically wrong; AIT is G45 in ICD-10, a different chapter than I65-I69, and the canonical catalog already contains the exact category"
  - "avc broadened from 3 categories (177/178/179) to 4 (177/178/179/180) — deliberate scope decision: searching AVC should surface the whole cerebrovascular panorama (including 180, Outras doenças cerebrovasculares), not only the three acute-event forms"
  - "tvp (185) and varizes (186) confirmed correct as originally curated — no change"

requirements-completed: [TAX-05]

# Metrics
duration: ~15min (Task 3 correction + SUMMARY, this session); Task 1 ~10min + Task 2 ~15min in prior sessions
completed: 2026-08-04
---

# Phase 08 Plan 07: Apelidos clínicos — dicionário curado + matching automático Summary

**Dicionário de 4 apelidos clínicos (avc/tvp/ait/varizes) amarrado a tabnetCode+label com invariante E fail-closed, mais matcher puro (fold-accent + AND-tokens + Levenshtein piso-6), e uma revisão clínica humana que corrigiu um mapeamento errado (ait) e ampliou outro deliberadamente (avc) — não uma aprovação em branco.**

## Performance

- **Duration:** ~15 min (this continuation session, Task 3 correction + SUMMARY); Task 1 (~10 min) and Task 2 (~15 min) executed in prior sessions
- **Completed:** 2026-08-04
- **Tasks:** 3 (all complete)
- **Files modified:** 4 (aliases.json, diseaseAliases.ts, diseaseAliases.test.ts, validate.mjs)

## Accomplishments

- Curated `aliases.json` with exactly 4 entries (avc, tvp, ait, varizes), each citing `tabnetCode` + `labelEsperado`, keyed by code (never by id/slug) — deliberately avoiding the shape of the original `KNOWN_BY_CODE` bug
- Invariant E (`checkAliases`) wired into `catalog:validate`: fails closed if any `labelEsperado` diverges from the canonical label, or any `tabnetCode` doesn't exist
- Pure matching module (`diseaseAliases.ts`) with zero new dependencies: hand-written Levenshtein, AND-between-tokens matching, fuzzy floor at 6 characters (measured to eliminate short-acronym false positives — without it, `ait` alone produces 18 spurious matches)
- Human clinical checkpoint (Task 3) caught a real error: `ait` had been provisionally mapped to tabnetCode 180 (I65-I69) per the CONTEXT expectation table, but AIT (ataque isquêmico transitório) is ICD-10 G45 — a different chapter. Corrected to tabnetCode 150, the catalog's exact G45 category
- Same checkpoint made a deliberate scope decision on `avc`: broadened from 3 to 4 categories, adding tabnetCode 180, so the acronym search surfaces the whole cerebrovascular panorama rather than only the three acute-event forms
- 16 tests green in `diseaseAliases.test.ts`, including the corrected assertions for the new `ait`/`avc` mappings and the central TAX-05 proof (without the dictionary, `avc` returns zero)

## Task Commits

1. **Task 1: aliases.json curado e invariante E ligado ao gate** - `73aef9f` (feat)
2. **Task 2: diseaseAliases.ts — função pura de matching com fuzzy medido** - `669d4c4` (feat)
3. **Task 3: Conferência clínica das 4 entradas curadas — correções aplicadas** - `756e345` (fix)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `src/features/catalog/aliases.json` - Curated 4-entry alias dictionary; `ait`→150 (G45) and `avc`→177+178+179+180 corrected in Task 3
- `src/features/catalog/diseaseAliases.ts` - Pure matching module: `foldAccents`, `labelMatchesQuery`, `resolveAliasTerm`, `matchDiseases`
- `src/features/catalog/diseaseAliases.test.ts` - 16-case test battery against the real 331-label corpus, updated in Task 3 for the corrected mappings
- `scripts/catalog/validate.mjs` - Invariant E (`checkAliases`) wired into `main()`

## Decisions Made

- **`ait` → tabnetCode 150, not 180.** The checkpoint's original provisional mapping (180, "Outras doenças cerebrovasculares", I65-I69) followed the CONTEXT's measured expectation table but was clinically wrong. AIT is ICD-10 G45, filed under diseases of the nervous system — never within I65-I69. The canonical catalog already contains the exact category (tabnetCode 150, "Acid vascular cerebr isquêm transit e síndr correl"). The `motivo` field now records this as the decided ground truth, with the superseded provisional-pending-checkpoint language removed.
- **`avc` → 4 categories (177+178+179+180), not 3.** The developer chose the broad cerebrovascular scope deliberately: searching "AVC" should surface the whole cerebrovascular panorama, including "Outras doenças cerebrovasculares" (180), not just the three acute-event forms. The `motivo` field records this as an intentional scope choice so a future reader does not "fix" it back to 3 categories.
- **`tvp` (185) and `varizes` (186) confirmed correct, unchanged.** TVP maps cleanly to I80.2 within the 185 code's I80-I82 range; varizes maps cleanly to 186 (I83). No clinical objection raised for either.

## Deviations from Plan

None beyond the plan's own checkpoint outcome — Task 3's `<action>` explicitly anticipated applying whatever correction the developer indicated and re-running validation/tests, which is exactly what happened. The plan's `<resume-signal>` explicitly allows "describir a correção por entrada" as an alternative to "aprovado"; both corrections were applied as directed, tests updated to match, `catalog:validate` and the full `npm run gate` reverified green before committing.

## Issues Encountered

None. Both corrections were mechanical once decided: edit `aliases.json`'s `categorias`/`motivo` for the two affected entries, update two assertion blocks in `diseaseAliases.test.ts` (avc 3→4 categories, ait 180→150), re-run validation and tests.

## Checkpoint Outcome (Task 3, honest record)

This was not a rubber-stamp. The human review:
1. **Caught a real clinical mis-mapping.** `ait` had been pointed at tabnetCode 180 (I65-I69, "Outras doenças cerebrovasculares") — a mapping that came from the CONTEXT's measured expectation table, not from a clinical read of the CID. AIT is G45, a different ICD-10 chapter entirely. The checkpoint's own `<how-to-verify>` flagged this exact discrepancy as "the point that needs explicit decision," and the decision was to correct it, not accept it.
2. **Made a deliberate scope decision on `avc`.** The checkpoint asked whether code 180 should also be included under `avc`. The developer chose yes — broadening from 3 to 4 categories on purpose, to make the acronym search show the full cerebrovascular panorama rather than only strokes proper.
3. **Confirmed `tvp` and `varizes` as originally curated**, with no changes.

Invariant E only proves that a curated entry's `labelEsperado` matches the canonical label for its `tabnetCode` — it cannot prove that the `tabnetCode` is the clinically correct category for the search term. That gap is exactly what the human checkpoint exists to close, and this run demonstrates why the checkpoint stays mandatory rather than becoming an automatic pass: an unreviewed dictionary would have shipped `ait` pointing at the wrong ICD-10 chapter.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `matchDiseases`/`resolveAliasTerm`/`labelMatchesQuery` are exported, pure, and ready to be plugged into `MeasureDiseasePicker.diseaseMatches` by plan 08-09.
- Plan 08-09 inherits the **corrected** 4-entry dictionary: `avc` now resolves to 4 categories (177/178/179/180), and `ait` resolves to tabnetCode 150 (G45) rather than the superseded 180 mapping. Any 08-09 test fixtures or explanatory-strip copy that assumes the pre-correction shapes (avc=3 categories, ait=180) must be written against these corrected values, not the plan's original provisional table.
- No blockers. `npm run catalog:validate`, `npx vitest run src/features/catalog/diseaseAliases.test.ts`, and the full `npm run gate` (747 tests, 104 files, build clean) all pass at HEAD.

## Self-Check: PASSED

- FOUND: src/features/catalog/aliases.json
- FOUND: src/features/catalog/diseaseAliases.ts
- FOUND: src/features/catalog/diseaseAliases.test.ts
- FOUND: .planning/phases/08-taxonomia-can-nica-integridade/08-07-SUMMARY.md
- FOUND commit: 73aef9f (Task 1)
- FOUND commit: 669d4c4 (Task 2)
- FOUND commit: 756e345 (Task 3 correction)

---
*Phase: 08-taxonomia-can-nica-integridade*
*Completed: 2026-08-04*
