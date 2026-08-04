---
phase: 08-taxonomia-can-nica-integridade
verified: 2026-08-04T15:04:33Z
status: human_needed
score: 6/6 roadmap success criteria verified, 6/6 requirements (TAX-01..06) satisfied
overrides_applied: 0
human_verification:
  - test: "Abrir Mapas, ir ao seletor de doença, digitar \"avc\": confirmar que aparecem as 4 categorias (177 Hemorragia intracraniana, 178 Infarto cerebral, 179 Acid vascular cerebr não espec hemorrág ou isquêm, 180 Outras doenças cerebrovasculares — escopo ampliado de 3 para 4 no checkpoint humano da 08-07/08-09) como linhas normais selecionáveis, com a tira explicativa acima e o rótulo sempre oficial da Lista Morb. Repetir com \"tvp\", \"ait\" e \"aterosclerose\"."
    expected: "Cada termo resolve às categorias canônicas corretas, apresentadas como linhas normais (nunca uma linha agregada inexistente), com rótulo sempre oficial e nenhum apelido virando chave de dado."
    why_human: "Comportamento de busca ponta-a-ponta no navegador real. Existe uma prova automatizada equivalente em jsdom (src/routes/mapas/MeasureDiseasePicker.test.tsx, 9 casos, todos passando) que renderiza o componente real e digita no input real via userEvent — mas o próprio PLAN 08-09 (Task 2) e o 08-VALIDATION.md declaram explicitamente que o clique-through literal no navegador fica deferido para verificação humana de fim de fase, seguindo o padrão já estabelecido nas Fases 4/5 deste projeto."
---

# Phase 8: Taxonomia canônica + integridade Verification Report

**Phase Goal:** Substituir a taxonomia de agravos corrompida por uma taxonomia canônica derivada da fonte oficial (Lista Morb CID-10 do TabNet), com invariantes que impeçam a corrupção de voltar, e propagar a renomeação para o banco de produção — sem perder dado nem trocar dono de métrica.
**Verified:** 2026-08-04T15:04:33Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Para os 331 agravos, `id`, `tabnetCode`, `cid` e `label` são mutuamente consistentes com a Lista Morb CID-10 oficial | ✓ VERIFIED | `scripts/catalog/diseases.json` = 331 entries; `src/features/catalog/diseases.lista.json` = 331 entries, 330/330 `lista_morb` rows have non-null `cid` (joined by `tabnetCode` from `lista-morb-cid.json`, 330 keys). `node scripts/catalog/validate.mjs` exits 0 (invariants A/B/C/D/D2/E all green). CID is a pure function of `tabnetCode` by construction (`buildRuntimeLista`), so mutual consistency is structurally guaranteed and re-proven byte-identical every run by invariant B. |
| 2 | A validação falha quando `id ↔ tabnetCode ↔ label` divergem — acusando os 21 registros corrompidos | ✓ VERIFIED | `src/features/catalog/taxonomyInvariants.test.ts` runs `checkSlugConsistency` against the frozen pre-migration fixture (`diseases.pre-migracao.json`) and asserts exactly 21 errors whose ids equal `rename-map.json`'s tombstone set; a dedicated case asserts the literal `avc → 163` bug message. Ran directly: 8/8 relevant test files, 83/83 tests pass. |
| 3 | Depois da migração, `sih_disease` tem 331 linhas, `sih_metric_uf` 30.313 e `sih_metric_muni` 1.099.403, com integridade referencial conferida antes e depois | ✓ VERIFIED | Established fact (orchestrator, independently checked live): production `hmfbxqemububjyhdckrj` — `sih_disease`=331, `sih_metric_uf`=30313, `sih_metric_muni`=1099403; migration `20260804020000` Local=Remote. Corroborated in-repo: `supabase/verify/contagens.sql` embeds these three counts with `RAISE EXCEPTION` on divergence; the D-04 in-transaction aggregate-sum proof (internações/óbitos/valor_total/dias_permanência per agravo) is present in `supabase/migrations/20260804020000_rename_disease_ids.sql`. 08-10-SUMMARY documents both rename cycles' live aggregates matching the 08-08 rehearsal exactly — independent corroboration the rehearsal and production runs are real, not narrated. |
| 4 | A migração é reversível e atravessa os ciclos de renomeação sem violar a chave primária | ✓ VERIFIED | `supabase/rollback/20260804020000_rename_disease_ids_down.sql` exists (258 lines), generated (not hand-written) from the same `rename-map.json` per `generateRenameMigration.mjs` and byte-compared in `renameMigration.test.ts`. 08-REVIEW.md independently traced both cycles in both directions through the SQL and found it correct. 08-08's local rehearsal (up → D-04 → down → verify) reported byte-identical return to the initial state against a full production-volume restore. |
| 5 | O estudante encontra "AVC" e chega aos ids canônicos corretos, sem que o apelido vire chave de dado | ✓ VERIFIED (jsdom proxy) / human check pending | `src/features/catalog/aliases.json` curated dictionary + `src/features/catalog/diseaseAliases.ts` pure matcher, wired into `src/routes/mapas/MeasureDiseasePicker.tsx` (`import { ALIASES, labelMatchesQuery, matchDiseases }`) and `src/routes/variaveis/VariaveisPage.tsx` (`withDiseaseAliases`). Invariant E (`checkAliases`) is wired into `catalog:validate`. D-18 explanatory strip text found at `MeasureDiseasePicker.tsx:299-300`. 83 relevant vitest cases pass, including a component-level proxy (`MeasureDiseasePicker.test.tsx`) that types into the real input via `userEvent`. **Literal browser click-through is explicitly deferred to end-of-phase human verification per the plan's own `<human-check>` block (08-09-PLAN.md Task 2) and 08-VALIDATION.md — see Human Verification section.** |
| 6 | Packs, `variables.json`, seeds SQL e a cópia no bundle são gerados da taxonomia canônica — nenhuma lista mantida à mão em paralelo | ✓ VERIFIED (with tracked follow-up) | Invariant B (`checkRegenerationFromDisk`) proves `diseases.json`/`diseases.lista.json` regenerate byte-identically from the committed snapshot, wired into `catalog:validate`. `scripts/catalog/sql/0.sql..4.sql` (5 files, 331 value lines) regenerated in the same 08-06 commit; TAX-06 was independently re-proven on live data in 08-10 by a full (not sampled) set-comparison between `sih_disease` ids and the 5 SQL seed files (`comm -23`/`comm -13` both empty). **Caveat, not a failure of this truth:** the rename *engine* (`applyRenameMap.mjs`, a one-time-use tool already exercised successfully in the 08-06 flip) has a reproduced latent bug (CR-01, see Known Issues) that would corrupt `columnMap.json` on a hypothetical re-run — it does not affect the artifacts as currently committed, and the corruption class it could produce is still caught by invariant D2's completeness check (`checkColumnMapKeys`) before any such state could pass `catalog:validate`/commit under this phase's own established D-24 workflow. |

**Score:** 6/6 roadmap success criteria verified. All 6 requirements (TAX-01 through TAX-06) satisfied.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| TAX-01 | 08-01, 08-02, 08-03, 08-06 | 331 agravos com id/tabnetCode/cid/label consistentes | ✓ SATISFIED | Truth #1 above |
| TAX-02 | 08-02, 08-03, 08-06 | Validação fail-closed barra `avc→163` | ✓ SATISFIED | Truth #2 above |
| TAX-03 | 08-05, 08-08, 08-10 | Contagens exatas + integridade referencial | ✓ SATISFIED | Truth #3 above |
| TAX-04 | 08-05, 08-08, 08-10 | Migração reversível, ciclos sem violar PK | ✓ SATISFIED | Truth #4 above |
| TAX-05 | 08-07, 08-09 | Apelidos clínicos resolvem a ids canônicos | ✓ SATISFIED (jsdom); browser click-through pending human check | Truth #5 above |
| TAX-06 | 08-01, 08-03, 08-04, 08-06 | Artefatos derivados gerados, não mantidos à mão | ✓ SATISFIED | Truth #6 above |

No orphaned requirements found — `.planning/REQUIREMENTS.md` maps only TAX-01..06 to Phase 8, and all six are declared across the 10 plans' `requirements:` frontmatter.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/catalog/snapshot/lista-morb.nibr.html` + `lista-morb.extract.json` | Versioned offline source | ✓ VERIFIED | 8177 + 1343 lines; invariant C wired and green |
| `scripts/catalog/listaMorbSource.mjs` | Pure parser, slugify, snapshot loader | ✓ VERIFIED | Exports confirmed: `parseListaMorbOptions`, `slugify`, `loadSnapshot`, `checkSnapshotIntegrity` |
| `scripts/catalog/exclusions.json` / `extra-diseases.json` / `metricless-diseases.json` | Data-with-reason partitions | ✓ VERIFIED | Present, non-empty, `extra-diseases.json` carries `reason` field for `amputacao_mmii` |
| `scripts/catalog/sync-lista-morb.mjs` | Canonical generator, no `KNOWN_BY_CODE`, no network | ✓ VERIFIED | `grep KNOWN_BY_CODE` — zero hits repo-wide; exports `buildDiseases`/`buildRuntimeLista`/`generateFromSnapshot` confirmed by direct import |
| `scripts/catalog/rename-map.json` | 21 renames, 1 addition, computed not transcribed | ✓ VERIFIED | `renames.length===21`, `tombstones.length===21`, `added.length===1` |
| `src/test/fixtures/taxonomy/diseases.pre-migracao.json` | Frozen corrupted state, ≥2000 lines | ✓ VERIFIED | 2312 lines |
| `scripts/catalog/validate.mjs` | Invariants A/B/C/D/D2/E, fail-closed | ✓ VERIFIED | All six wired into `main()`; `node scripts/catalog/validate.mjs` exits 0 |
| `src/test/noTombstoneLiterals.test.ts` | Invariant F, scans versioned files | ✓ VERIFIED | 4/4 tests pass, scans 464 files, zero real findings |
| `scripts/catalog/tombstones.mjs` / `applyRenameMap.mjs` / `generateDiseaseSeeds.mjs` | Rename engine + seed generator | ✓ VERIFIED (engine has a tracked re-run defect, see Known Issues) | Exports present; engine was used once successfully (commit `92135bb`); `applyRenameMap.mjs --check` currently fails (CR-02, non-blocking, see below) |
| `supabase/config.toml`, `migrations/`, `rollback/`, `verify/contagens.sql` | Scaffold + generated migration/rollback/verify | ✓ VERIFIED | All present; migration/rollback byte-compared to generator in `renameMigration.test.ts` |
| `scripts/catalog/generateRenameMigration.mjs` | Deterministic up/down/verify generator | ✓ VERIFIED | 557 lines, D-04 aggregate-sum proof present in generated SQL |
| `src/features/catalog/aliases.json` / `diseaseAliases.ts` | Curated dictionary + pure matcher | ✓ VERIFIED | Exports confirmed: `foldAccents`, `labelMatchesQuery`, `resolveAliasTerm`, `matchDiseases` |
| `src/routes/mapas/MeasureDiseasePicker.tsx` | Alias search + D-18 strip | ✓ VERIFIED / WIRED | Imports `diseaseAliases`; strip copy found at lines 299-300 |
| `docs/SUPABASE-CATALOG.md` | Real applied schema documented | ✓ VERIFIED | Rewritten to real constraint/index names, `ON DELETE CASCADE` documented, 331 count present |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `validate.mjs` | `listaMorbSource.mjs` | `checkSnapshotIntegrity` in `main()` | ✓ WIRED | Confirmed at line 647 |
| `validate.mjs` | `sync-lista-morb.mjs` | `checkRegenerationFromDisk` in `main()` | ✓ WIRED | Confirmed at line 656 |
| `applyRenameMap.mjs` | `tombstones.mjs` | `tombstonePatterns`/`findTombstoneHits` | ✓ WIRED | Confirmed via import and usage |
| `uploadSihToSupabase.mjs` | `tombstones.mjs` | `assertNotTombstone` on directory name and rows | ✓ WIRED (fires as designed) | Reproduced: throws uncaught on `ait` directory — see CR-04 in Known Issues for the UX nuance |
| `paths.mjs` | `tombstones.mjs` | `assertNotTombstone` on `PACK_SOURCES` | ✓ WIRED | Confirmed per 08-06-SUMMARY, second D-06 entry point |
| `noTombstoneLiterals.test.ts` | `tombstones.mjs` | `findTombstoneHits` | ✓ WIRED | Same function the rename engine uses; 4/4 tests pass |
| `MeasureDiseasePicker.tsx` | `diseaseAliases.ts` | `matchDiseases`/`labelMatchesQuery` in `diseaseMatches` | ✓ WIRED | Confirmed import + usage |
| `VariaveisPage.tsx` | `diseaseAliases.ts` | `withDiseaseAliases` enriching `CatalogEntry.aliases` | ✓ WIRED | Confirmed import + usage |
| `generateRenameMigration.mjs` | `rename-map.json` | reads `renames`/`added` for the two-pass CTEs | ✓ WIRED | SQL generated and byte-compared in test |
| `supabase/migrations/*_rename_disease_ids.sql` | producao `hmfbxqemububjyhdckrj` | `supabase db push` | ✓ WIRED | Established fact — Local=Remote at HEAD |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `catalog:validate` passes fail-closed against committed taxonomy | `node scripts/catalog/validate.mjs` | exit 0, "provenance gate passed" | ✓ PASS |
| Invariant A catches exactly the 21 corrupted ids against the frozen fixture | `npx vitest run src/features/catalog/taxonomyInvariants.test.ts` | 1 file, all cases pass, 21/21 tombstones matched | ✓ PASS |
| Invariant F scans the real tree and stays green | `npx vitest run src/test/noTombstoneLiterals.test.ts` | 4/4 pass, 464 files scanned | ✓ PASS |
| Full phase-08 relevant test surface | `npx vitest run` (8 files: taxonomyInvariants, renameMap, snapshotIntegrity, tombstones, renameMigration, diseaseAliases, MeasureDiseasePicker, VariaveisPage) | 8 files / 83 tests, all pass | ✓ PASS |
| `columnMap.json` on disk has 331 keys matching 331 diseases | `node -e "..."` | 331 = 331 | ✓ PASS |
| `diseases.json` count | `node -e "..."` | 331 | ✓ PASS |
| `diseases.lista.json` count + CID coverage | `node -e "..."` | 331 total, 330/330 lista_morb non-null CID | ✓ PASS |
| **CR-01 reproduction:** re-running `planColumnMap` against the committed `columnMap.json` | `node --input-type=module -e "..."` | 331 keys in → 329 out; `sih.hemorroidas_uf`/`sih.embolia_pulmonar_uf` both dropped | ✗ CONFIRMED LATENT BUG (non-blocking, see Known Issues) |
| **CR-02 reproduction:** post-apply structural guard | `node scripts/catalog/applyRenameMap.mjs --check` | exit 1, 25 leftovers, all in 2 test files as search-query strings (`resolveAliasTerm('avc', ...)`, `user.type(input, 'avc')`), zero in production code or data files | ✗ CONFIRMED, not wired into `gate`/`test:run`/`catalog:validate` (non-blocking, see Known Issues) |
| **CR-03 reproduction:** `buildDiseases` extras collision guard | `node --input-type=module -e "..."` | duplicate `extra.id` reaches output array unguarded | ✗ CONFIRMED LATENT BUG (non-blocking, no current extras collide — only 1 extra exists) |
| **CR-04 reproduction:** upload guard ordering | `SUPABASE_URL=x SUPABASE_SERVICE_ROLE_KEY=y node scripts/catalog/uploadSihToSupabase.mjs --disease ait` | uncaught throw, kills process, exit 1, before any `existsSync` skip | ✗ CONFIRMED — but this is the must-have's literal request ("recusa ruidosamente"); the batch-killing behavior for the other 340 directories is Phase-9-scope UX debt, explicitly flagged as Fase-9 handoff in 08-10-SUMMARY |

### Requirements Coverage — see table above

### Known Issues (non-blocking — tracked follow-up, not phase-08 gaps)

These were raised in `08-REVIEW.md` (commit `58f1ca5`) and independently reproduced during this verification. None falsifies a must-have of any of the 10 plans or a ROADMAP success criterion, for the reasons stated:

1. **CR-01 — `planColumnMap` not cycle-safe.** Reproduced: re-running `applyRenameMap.mjs --apply` today would silently drop 2 of 331 `columnMap.json` keys (the two verified rename cycles). The current committed `columnMap.json` is unaffected (331 keys, correct) because the engine was run exactly once, successfully, in the 08-06 flip — this bug did not exist in the code path exercised then (the target keys did not yet collide with pre-existing entries). It is a real defect in a one-time-use tool, and it *would* eventually be caught by invariant D2's completeness check (`checkColumnMapKeys`, which asserts every `lista_morb` id has a `columnMap` key) before any corrupted state could pass `catalog:validate` — consistent with this phase's own established D-24 discipline (never commit with validate red). Recommend a follow-up plan/task to fix `planColumnMap`/`planPacks`/`planManifest`/`planVariables`'s missing `CYCLE_OLD_IDS` exemption before the engine is ever re-run.

2. **CR-02 — `applyRenameMap.mjs --check` is red, not wired into `gate`.** Reproduced: exit 1, 25 leftovers (not 47 as the review's own count states — independently re-measured at 25, all in `src/features/catalog/diseaseAliases.test.ts` and `src/routes/mapas/MeasureDiseasePicker.test.tsx`, all search-query string literals like `resolveAliasTerm('avc', ALIASES)`, not disease-id assignments). The *actual gate-wired guard* against literal tombstone reintroduction is invariant F (`noTombstoneLiterals.test.ts`), which uses the same `findTombstoneHits` function with a correctly-scoped 7-path allowlist and is green (4/4, part of `npm run test:run`/`gate`). `--check` is a secondary, narrower-allowlist CLI diagnostic for the rename engine's own post-apply self-audit — its current failure is a false positive against historical-fact test assertions, not evidence of any tombstone literal reaching production code. Recommend unifying the two allowlists and wiring `--check` into `catalog:validate` as the review suggests.

3. **CR-03 — `buildDiseases` skips collision detection for `extras`.** Reproduced with a synthetic colliding extra. Not currently triggered: `scripts/catalog/extra-diseases.json` has exactly one entry (`amputacao_mmii`), so no collision exists today. Latent risk for any future addition to `extra-diseases.json`.

4. **CR-04 — `uploadSihToSupabase.mjs` aborts on the first tombstone-named directory.** Reproduced: `--disease ait` throws uncaught immediately (before the `existsSync` skip). This satisfies the plan 08-04 must-have's literal text ("recusa ruidosamente qualquer id-tombstone, inclusive os dois que hoje são id canônico de outra doença") — the guard does fire loudly. The review's deeper critique (killing the *entire* 341-directory batch run on the first hit, rather than skipping-and-continuing per directory) is real and would block the documented `node scripts/catalog/uploadSihToSupabase.mjs` command today, but re-keying the 341 `coleta_sih_multi` directories to canonical ids is explicitly Phase 9 scope (D-22), and 08-10-SUMMARY's own "Handoff to Fase 9" section already registers this exact behavior as expected/intended for the handoff. `docs/SUPABASE-CATALOG.md:120` still lists the bare command without this caveat — minor doc-accuracy gap, recommend a one-line note when Phase 9 starts.

5. **WR-03 — D-04 integrity proof omits `taxa_mortalidade` and doesn't check muni orphaning per-agravo.** Confirmed by SQL inspection: the "antes"/"depois" aggregate snapshots in `supabase/migrations/20260804020000_rename_disease_ids.sql` sum `internacoes`, `obitos`, `valor_total`, `dias_permanencia` but not `taxa_mortalidade`. Since `taxa_mortalidade` is a derived/computed measure (not independently collected — it's obitos/internacoes), and since TAX-03's own live post-migration proof was independently corroborated via full-set comparison (not sampling) and exact aggregate matches for both rename cycles, this gap does not indicate an actual undetected data-integrity problem in the applied migration, but it is a real reduction in the check's stated exhaustiveness. Recommend adding the missing column and the muni-side orphan check.

6. **Minor doc inconsistency (informational only).** `.planning/ROADMAP.md` line 5 (Overview, historical framing of why v3.0 exists) still reads "20 agravos servem dados de outra doença" — the Phase-8-specific section (line 89) and `.planning/PROJECT.md` were correctly emended to 21 per the 08-01 must-have (D-15), but this narrative overview sentence was not. Cosmetic, does not affect any code or data artifact.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `scripts/catalog/applyRenameMap.mjs` | 244-288 | `planColumnMap` missing `CYCLE_OLD_IDS` exemption (CR-01) | ⚠️ Warning | Latent — see Known Issues #1 |
| `scripts/catalog/applyRenameMap.mjs` | 62-65 | `SCOPE_EXCLUDE_RELATIVE_PATHS` narrower than invariant F's allowlist (CR-02) | ⚠️ Warning | `--check` red, not gate-wired — see Known Issues #2 |
| `scripts/catalog/sync-lista-morb.mjs` | 62-70 | `extras` loop has no collision guard (CR-03) | ⚠️ Warning | Latent, no current collision — see Known Issues #3 |
| `scripts/catalog/uploadSihToSupabase.mjs` | 77-81 | `assertNotTombstone` runs before `existsSync` skip, no per-directory continue (CR-04) | ⚠️ Warning | Batch-killing on first legacy dir — see Known Issues #4, Fase 9 handoff |
| `scripts/catalog/syncPackImports.mjs` | 47-54 | Dead `PLACEHOLDER_INTERFACE`/`PLACEHOLDER_ALIASES` block, discarded 3 lines later | ℹ️ Info | No functional impact, confirmed present |
| `supabase/migrations/20260804020000_rename_disease_ids.sql` | 155-166 | D-04 proof omits `taxa_mortalidade` (WR-03) | ⚠️ Warning | See Known Issues #5 |
| `.planning/ROADMAP.md` | 5 | Stale "20 agravos" in Overview narrative | ℹ️ Info | Cosmetic, see Known Issues #6 |

No `TBD`/`FIXME`/`XXX` debt markers found in any phase-08 core file (`scripts/catalog/*.mjs`, `src/features/catalog/*.ts`, `src/routes/mapas/MeasureDiseasePicker.tsx`, `src/routes/variaveis/VariaveisPage.tsx`, `src/test/noTombstoneLiterals.test.ts`).

### Human Verification Required

#### 1. AVC/TVP/AIT/aterosclerose search in the live Mapas picker

**Test:** Open Mapas → disease picker → type "avc". Confirm the 4 categories (177 Hemorragia intracraniana, 178 Infarto cerebral, 179 Acid vascular cerebr não espec hemorrág ou isquêm, 180 Outras doenças cerebrovasculares) appear as normal selectable rows, with the D-18 explanatory strip above the list, and that the displayed label is always the official Lista Morb one (D-19). Repeat with "tvp", "ait", and "aterosclerose".
**Expected:** Every term resolves to the correct canonical categories as normal rows (never a synthetic aggregated row), the strip explains the correspondence, no alias literal appears anywhere as a selectable/copyable value, and the checkbox selection stores the canonical id.
**Why human:** This is the literal browser click-through end-to-end test. An automated jsdom proxy exists and passes (`src/routes/mapas/MeasureDiseasePicker.test.tsx`, 9 cases render the real component and type into the real input via `userEvent`), but the phase's own plan (08-09-PLAN.md, Task 2's `<human-check>` block) and `08-VALIDATION.md`'s Manual-Only Verifications table explicitly defer the literal "eyes on the rendered UI in a browser" check to end-of-phase human verification, following the same pattern used in Phases 4 and 5 of this project.

### Gaps Summary

No blocking gaps found. All 6 ROADMAP success criteria and all 6 requirements (TAX-01..06) are verified against the actual codebase and, where applicable, against the live production database (facts independently established by the orchestrator and corroborated in-repo during this verification: exact cross-match between the 08-08 rehearsal's measured aggregates and the 08-10 production run's live-measured aggregates for both rename cycles).

Five code-review findings (CR-01, CR-02, CR-03, CR-04, WR-03) were independently reproduced during this verification and are real, but none falsifies a stated must-have — each is either (a) a latent defect in a one-time-use tool that already ran successfully and would be caught by a wired invariant before any future re-run could reach a commit, (b) explicitly named as Phase 9 scope in the phase's own documentation, or (c) a reduction in an already-corroborated check's exhaustiveness rather than an undetected actual failure. They are listed under Known Issues for tracking and should be considered for a small follow-up plan, but they do not block Phase 8 from being marked complete.

One item requires human verification before the phase can be marked fully `passed`: the literal browser click-through of the alias search in Mapas, which the phase's own plans deliberately deferred to end-of-phase human verification.

---

_Verified: 2026-08-04T15:04:33Z_
_Verifier: Claude (gsd-verifier)_
