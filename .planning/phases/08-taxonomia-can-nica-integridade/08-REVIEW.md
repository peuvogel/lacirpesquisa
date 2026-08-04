---
phase: 08-taxonomia-can-nica-integridade
reviewed: 2026-08-04T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - docs/SUPABASE-CATALOG.md
  - scripts/catalog/applyRenameMap.mjs
  - scripts/catalog/build.mjs
  - scripts/catalog/buildRenameMap.mjs
  - scripts/catalog/exclusions.json
  - scripts/catalog/extra-diseases.json
  - scripts/catalog/generateDiseaseSeeds.mjs
  - scripts/catalog/generateRenameMigration.mjs
  - scripts/catalog/listaMorbSource.mjs
  - scripts/catalog/metricless-diseases.json
  - scripts/catalog/paths.mjs
  - scripts/catalog/sync-lista-morb.mjs
  - scripts/catalog/syncColumnMap.mjs
  - scripts/catalog/syncPackImports.mjs
  - scripts/catalog/tombstones.mjs
  - scripts/catalog/uploadSihToSupabase.mjs
  - scripts/catalog/validate.mjs
  - src/features/catalog/aliases.json
  - src/features/catalog/catalogAnalysisData.ts
  - src/features/catalog/diseaseAliases.test.ts
  - src/features/catalog/diseaseAliases.ts
  - src/features/catalog/renameMap.test.ts
  - src/features/catalog/renameMigration.test.ts
  - src/features/catalog/snapshotIntegrity.test.ts
  - src/features/catalog/taxonomy.ts
  - src/features/catalog/taxonomyInvariants.test.ts
  - src/features/catalog/tombstones.test.ts
  - src/routes/mapas/MeasureDiseasePicker.test.tsx
  - src/routes/mapas/MeasureDiseasePicker.tsx
  - src/routes/mapas/mockAnalysisData.ts
  - src/routes/variaveis/VariaveisPage.test.tsx
  - src/routes/variaveis/VariaveisPage.tsx
  - src/test/noTombstoneLiterals.test.ts
  - supabase/config.toml
  - supabase/migrations/20260804020000_rename_disease_ids.sql
  - supabase/rollback/20260804020000_rename_disease_ids_down.sql
  - supabase/verify/contagens.sql
findings:
  critical: 5
  warning: 16
  info: 15
  total: 36
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-04
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

The phase's core thesis holds: freezing the TabNet source as a sha256-verified snapshot,
deriving the rename map from a diff instead of hand transcription, and proving the migration
in-transaction are all sound designs, and the invariants A/B/C/D/D2/E wired into
`catalog:validate` do pass on the committed tree (verified by running
`node scripts/catalog/validate.mjs`).

The scope note asked specifically whether the cycle reasoning holds for the rename engine.
**It holds for exactly one of the five plan builders.** `renameCodeSourceText`'s combined
single-pass regex is genuinely cycle-safe, and `applyPacksPlan`'s temp-suffix two-pass is
cycle-safe. But `planColumnMap` is a naive keyed rewrite with no cycle exemption and no
collision guard: re-running `--apply` today silently deletes 2 of 331 `columnMap.json` keys
(reproduced below, 331 → 329) while the dry-run reports `sobras: 0` and exits OK.

Two further systemic problems surfaced:

1. **The phase's own post-apply guard is red.** `node scripts/catalog/applyRenameMap.mjs --check`
   exits 1 with 47 leftovers on the committed tree. Nothing in `package.json` runs `--check`,
   so this has been invisible. The root cause is that `applyRenameMap`'s
   `SCOPE_EXCLUDE_RELATIVE_PATHS` (2 paths) and `noTombstoneLiterals.test.ts`'s allowlist
   (7 paths) diverged — despite the latter's comment claiming importing the former
   "garante que os dois allowlists ... nunca divirjam por engano."

2. **Fail-open holes in a pipeline that advertises fail-closed.** `buildDiseases` collision-checks
   snapshot-derived slugs but not `extras` (duplicate id proven reachable); the migration
   generator emits syntactically invalid SQL for empty inputs; `uploadSihToSupabase.mjs`
   currently aborts the entire documented ingest command on its first directory.

None of this threatens the already-applied production migration, whose SQL I traced through
both cycles in both directions and found correct. The damage surface is re-runs, Fase 9
handoff, and future maintenance.

---

## Critical Issues

### CR-01: `planColumnMap` is not cycle-safe — re-running `--apply` silently deletes 2 of 331 columnMap keys

**File:** `scripts/catalog/applyRenameMap.mjs:244-288`

**Issue:** `planColumnMap` looks up every level-1 key's disease id in `RENAME_BY_OLD` with no
`CYCLE_OLD_IDS` exemption and no check that `newKey` is free. For the two verified cycles the
canonical target key already exists in `columnMap.json`, so the rewrite overwrites it and the
source key is pruned. Reproduced against the committed `columnMap.json`:

```
antes: 331 depois: 329
moves: [
  { from: 'sih.hemorroidas_uf',       to: 'sih.veias_varicosas_das_extremidades_inferiores_uf', tabnetCode: '186' },
  { from: 'sih.embolia_pulmonar_uf',  to: 'sih.outras_doencas_vasculares_perifericas_uf',       tabnetCode: '182' }
]
sih.hemorroidas_uf survives? false
sih.embolia_pulmonar_uf survives? false
```

Agravos 187 (`hemorroidas`) and 173 (`embolia_pulmonar`) — both *live canonical* ids — lose
their columnMap entry entirely, and their measure leaves overwrite the cycle partner's.
`computeLeftovers` does not catch it: it strips the tombstone-shaped keys and then finds
nothing, reporting `sobras: 0` (confirmed in the real dry-run output). `--apply` therefore
proceeds and writes the loss to disk. Invariante D2 would fail *afterwards*, after the file is
already corrupted.

`applyRenameMap.mjs:95` defines `CYCLE_OLD_IDS` for exactly this situation but only consumes it
in `countRealLeftovers`/`computeLeftovers`/`runCheck` — never in a plan builder.
`paths.mjs:95` and `tombstones.mjs:45` both apply the equivalent exemption correctly.

**Fix:**
```js
const CYCLE_OLD_IDS = new Set(RENAMES.filter((r) => RENAME_BY_OLD.has(r.canonical)).map((r) => r.canonical));

function planColumnMap(columnMap) {
  // ...
  for (const [key, leafMap] of Object.entries(columnMap)) {
    const match = key.match(keyRe);
    const diseaseId = match ? match[1] : null;
    // A cycle id reaching this loop is the *canonical* owner of its key, not a tombstone.
    const rename = diseaseId && !CYCLE_OLD_IDS.has(diseaseId) ? RENAME_BY_OLD.get(diseaseId) : undefined;
    if (!rename) { newColumnMap[key] = leafMap; continue; }

    const newKey = `sih.${rename.canonical}_uf`;
    if (Object.prototype.hasOwnProperty.call(newColumnMap, newKey) ||
        Object.prototype.hasOwnProperty.call(columnMap, newKey)) {
      throw new Error(`planColumnMap: colisão — "${key}" quer virar "${newKey}", que já existe`);
    }
    // ...
  }
}
```
Apply the same `CYCLE_OLD_IDS` exemption + collision guard to `planPacks`, `planManifest` and
`planVariables`, which are latently broken the same way (they are quiet today only because
the two cycle agravos have no pack among the 10 committed).

---

### CR-02: `applyRenameMap --check` fails on the committed tree, and `--apply` would corrupt four test files

**File:** `scripts/catalog/applyRenameMap.mjs:62-65`, `scripts/catalog/applyRenameMap.mjs:486-514`, `src/test/noTombstoneLiterals.test.ts:28-92`

**Issue:** The D-23 post-apply structural guard is red right now:

```
$ node scripts/catalog/applyRenameMap.mjs --check ; echo $?
applyRenameMap --check FAILED — 47 tombstone(s) no escopo
  src/features/catalog/diseaseAliases.test.ts: id="avc" forma=bareQuoted offset=3106
  ...
1
```

And the dry-run announces it would rewrite them:

```
codigo-fonte: 4 arquivos alterados
  src/features/catalog/diseaseAliases.test.ts (15 ocorrencias)
  src/routes/mapas/MeasureDiseasePicker.test.tsx (18 ocorrencias)
  src/routes/variaveis/VariaveisPage.test.tsx (2 ocorrencias)
  src/test/noTombstoneLiterals.test.ts (12 ocorrencias)
sobras: 0
applyRenameMap --dry-run OK — nenhum arquivo foi tocado
```

`SCOPE_EXCLUDE_RELATIVE_PATHS` contains only `renameMap.test.ts` and `tombstones.test.ts`.
The invariante-F allowlist contains 7 paths, of which 4 are `.ts`/`.tsx` under `src/` — i.e.
inside `collectCodeSourceFiles()`'s rewrite scope. `noTombstoneLiterals.test.ts:81-92` claims
importing `SCOPE_EXCLUDE_RELATIVE_PATHS` "garante que os dois allowlists ... nunca divirjam por
engano," but the import only flows one way, so the divergence is exactly what happened.

Consequences of a re-run of `--apply`:
- `diseaseAliases.test.ts` — `'aterosclerose'` (the misspelled *search query* that proves D-17)
  becomes `'arteroesclerose'` (the official label), destroying the test's entire point;
  `'avc'`/`'ait'` queries become canonical disease ids, so the TAX-05 alias proofs assert nothing.
- `MeasureDiseasePicker.test.tsx` / `VariaveisPage.test.tsx` — same, on `user.type(input, 'avc')`.
- `noTombstoneLiterals.test.ts:162` — the planted literal `'sih.avc_uf'` is rewritten, so
  invariante F's own "prova de que o teste nao passaria olhando para nada" plants a
  non-tombstone and the test flips red.

**Fix:** Make the two allowlists a single exported constant and have both consumers read it,
then re-run `--check` until green. Also wire `--check` into the gate so this can't drift silently:
```json
"catalog:validate": "node scripts/catalog/validate.mjs && node scripts/catalog/applyRenameMap.mjs --check"
```

---

### CR-03: `buildDiseases` skips collision detection for `extras` — a duplicate disease id silently reaches the DB seed

**File:** `scripts/catalog/sync-lista-morb.mjs:35-73` (specifically the `for (const extra of extras)` loop, lines 62-70)

**Issue:** The snapshot loop maintains a `seen` map and throws a deliberately loud PT-BR error on
slug collision ("decisão humana necessária, nenhum sufixo automático"). The `extras` loop pushes
straight into `out` without consulting `seen`, and without checking `tabnetCode` uniqueness either.
Reproduced:

```
$ buildDiseases({ options: [{ code: '1', label: 'Colera' }], exclusions: {},
                  extras: [{ id: 'colera', ... tabnetCode: '9999' ... }] })
IDs: [ 'colera', 'colera' ]  -> duplicate id slipped through: true
```

Nothing downstream catches it: `checkSlugConsistency` allowlists every extra id;
`checkPartition` uses `Set`s so duplicates are invisible; `checkRegeneration` compares the
generator against itself. The duplicate then reaches
`generateDiseaseSeeds.renderSeedChunk` → `insert into sih_disease ... on conflict (id) do update`,
which collapses the two rows into one, **silently losing one clinical category** — the precise
failure class this phase exists to eliminate. It also produces a duplicate `PACK_SOURCES`
entry (last write wins) and a duplicate `DISEASES` entry in the UI list.

**Fix:**
```js
for (const extra of extras) {
  if (seen.has(extra.id)) {
    const other = seen.get(extra.id);
    throw new Error(
      `buildDiseases: extra "${extra.id}" (tabnetCode ${extra.tabnetCode}) colide com o ` +
      `tabnetCode ${other.code} ("${other.label}") derivado do snapshot — decisão humana necessária`,
    );
  }
  seen.set(extra.id, { code: extra.tabnetCode, label: extra.label });
  out.push({ ... });
}
```
Add the symmetric `tabnetCode` uniqueness check (a `Set` of codes populated by both loops).

---

### CR-04: `uploadSihToSupabase.mjs` aborts the entire documented ingest run, and permanently blocks the two cycle agravos

**File:** `scripts/catalog/uploadSihToSupabase.mjs:77-81`; contrast `scripts/catalog/paths.mjs:88-100`

**Issue:** Two distinct failures from the same missing exemption.

(a) **Present breakage.** The 341 coleta directories still carry pre-migration ids
(`docs/SUPABASE-CATALOG.md:17`, D-22). Verified present on disk: `avc`, `ait`, `hemorroidas`,
`embolia_pulmonar`, `varizes_mmii`, `aterosclerose`. `assertNotTombstone` is called on the
directory name *before* the `existsSync(metaPath)` skip (line 78 vs line 86), throws
uncaught at module top level, and kills the process. Since `readdirSync` is roughly
alphabetical, `ait` aborts the run within the first handful of directories — no per-directory
skip, no `--force`, no `--skip-tombstones`. `docs/SUPABASE-CATALOG.md:120` still ships
`node scripts/catalog/uploadSihToSupabase.mjs` as the working upsert command in the same phase
that broke it.

(b) **Permanent breakage after Fase 9.** Once the dirs are renamed to canonical ids, the
directories for agravo 187 (`hemorroidas`) and 173 (`embolia_pulmonar`) will still be refused,
because `assertNotTombstone` throws unconditionally for the cycle ids by design
(`tombstones.mjs:113-118`, asserted in `tombstones.test.ts:101-108`). `paths.mjs:95` correctly
guards this with `CYCLE_CANONICAL_IDS`; the upload path has no such guard, so 2 of 331 agravos
become permanently un-ingestable and every run dies at the first of them.

**Fix:** Distinguish "not yet migrated" from "hard refusal", and never let one directory kill
the run:
```js
import { assertNotTombstone, CYCLE_CANONICAL_IDS, CANONICAL_BY_OLD } from './tombstones.mjs';

const failures = [];
for (const diseaseId of dirs) {
  // Cycle canonicals are live modern ids — same exemption paths.mjs already applies.
  if (!CYCLE_CANONICAL_IDS.has(diseaseId)) {
    try {
      assertNotTombstone(diseaseId, `diretorio de coleta coleta_sih_multi/${diseaseId}`);
    } catch (err) {
      failures.push(`${diseaseId} -> renomeie para "${CANONICAL_BY_OLD[diseaseId]}" (D-22, Fase 9)`);
      continue;
    }
  }
  // ... upload
}
if (failures.length) {
  console.error(`uploadSihToSupabase: ${failures.length} diretorio(s) ainda com id pre-migracao:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
}
```
Update `docs/SUPABASE-CATALOG.md:113-121` to state that the upsert command is blocked until the
coleta directories are renamed.

---

### CR-05: `syncPackImports.mjs` unconditionally rewrites `catalogAnalysisData.ts` from a hardcoded template, with an unguarded `undefined` concatenation

**File:** `scripts/catalog/syncPackImports.mjs:45-86`

**Issue:** This script runs on every `npm run catalog:rebuild`
(`scripts/catalog/rebuildAfterScrape.mjs:19`). Three defects compound:

1. **Silent revert.** Lines 64-79 hardcode a copy of the `CatalogAnalysisVariable` interface and
   the entire `VARIABLE_ID_ALIASES` map. Whatever is in `catalogAnalysisData.ts:20-35` is
   replaced by this copy on every rebuild. Any future addition to `VARIABLE_ID_ALIASES` in the
   `.ts` file is silently reverted, with no diff warning and no test.

2. **Corruption path.** Line 59 does `src.split(/const PACKS: ...\n\};\n/)[1]`. If that regex
   ever misses (formatting change, Prettier run, a trailing-comma edit), `afterPacks` is
   `undefined` and line 85 writes `before + mid + "undefined"` into the source file. Same for
   line 58: a miss makes `before` the entire file, duplicating everything. There is no
   `if (afterPacks === undefined) throw`, no read-back verification, no backup. Verified that
   the split matches *today* (before=265 chars, after=6346 chars), so this is latent, not active
   — but it is one formatting change away.

3. **Dead half-implementation.** Lines 47-50 build a replacement containing literal
   `PLACEHOLDER_INTERFACE`/`PLACEHOLDER_ALIASES` tokens whose result is discarded three lines
   later by `src = fs.readFileSync(TARGET, 'utf8')`. Lines 52-54 read the file into `headMatch`
   and immediately `void` it. The comment "Safer approach: rewrite lines 7..end of PACKS only"
   documents an abandoned first attempt that was never deleted.

**Fix:** Fail closed before writing, and stop duplicating the source-of-truth block:
```js
const src = fs.readFileSync(TARGET, 'utf8');
const HEAD_MARKER = "import type { CatalogEntry, PackFile } from './types';";
const PACKS_RE = /const PACKS: Record<string, PackFile> = \{[\s\S]*?\n\};\n/;

const headIdx = src.indexOf(HEAD_MARKER);
const packsMatch = src.match(PACKS_RE);
if (headIdx === -1 || !packsMatch) {
  throw new Error('syncPackImports: âncoras não encontradas em catalogAnalysisData.ts — recusando reescrever');
}
const before = src.slice(0, headIdx);
const afterPacks = src.slice(packsMatch.index + packsMatch[0].length);
// preserve the existing interface + VARIABLE_ID_ALIASES block instead of re-emitting a copy
```
Delete lines 47-54 entirely.

---

## Warnings

### WR-01: `planCodeSource` silently drops files where hits exist but the rewrite is a no-op, under-reporting `--dry-run` leftovers

**File:** `scripts/catalog/applyRenameMap.mjs:291-304`, `scripts/catalog/applyRenameMap.mjs:336-366`

**Issue:** `planCodeSource` `continue`s when `rewritten === original`, so such a file never
enters `codeSourcePlan`. `computeLeftovers` iterates only `plans.codeSourcePlan`, so any file
where `findTombstoneHits` and `COMBINED_RENAME_REGEX` disagree is invisible to both `--dry-run`
and `--apply`'s abort check. The two patterns are near-identical today, but `findTombstoneHits`
scans each pattern independently over the whole text (allowing overlapping hits) while the
combined regex consumes text in one pass — they are not provably equivalent, and the code relies
on them being so.

**Fix:** When `hits.length > 0 && rewritten === original`, record the file as a hard leftover
instead of skipping it:
```js
if (rewritten === original) {
  unrewritable.push({ file: path.relative(ROOT, file), hits });
  continue;
}
```
and abort `--dry-run`/`--apply` if `unrewritable` is non-empty.

---

### WR-02: `--apply` has no atomicity or rollback; a mid-run failure leaves a half-renamed tree

**File:** `scripts/catalog/applyRenameMap.mjs:430-447`, `scripts/catalog/applyRenameMap.mjs:455-463`, `scripts/catalog/applyRenameMap.mjs:465-484`

**Issue:** `applyPacksPlan` runs `execFileSync('git','mv',...)` in two unguarded loops. `git mv`
throws if the destination exists (a real possibility given CR-01's collision class), if the
source is untracked, or if the index is locked. There is no `try/finally`, so a throw mid-loop
leaves `.applyRenameMap.tmp`-suffixed files in the working tree and half the packs renamed.
`writePlans` then writes manifest, variables, columnMap and N source files with four+ separate
non-atomic `writeFileSync` calls. `runApply` has no `try/catch`. Contrast `build.mjs:173-195`,
which at least stages through a temp directory.

**Fix:** Wrap `writePlans` in try/catch and, on failure, reverse the completed `git mv`s
(the plan already carries `fromFile`/`toFile`); or stage every write into a temp tree and
rename in as the last step. At minimum, print the exact recovery command on failure.

---

### WR-03: The D-04 integrity proof omits `taxa_mortalidade`, and check (6) never covers `sih_metric_muni`

**File:** `scripts/catalog/generateRenameMigration.mjs:98-99`, `scripts/catalog/generateRenameMigration.mjs:116-152`; `supabase/migrations/20260804020000_rename_disease_ids.sql:155-166`, `:236-257`

**Issue:** Two gaps in a block whose whole purpose is to be exhaustive:

- The "antes" snapshots sum `internacoes`, `obitos`, `valor_total`, `dias_permanencia` — but not
  `taxa_mortalidade`, one of the five metric columns the schema and `STANDARD_MEASURES` both
  define. The migration's own comment claims the check catches "embaralhamento entre os 21
  agravos"; for a hypothetical rewrite touching only `taxa_mortalidade` it would not.
  Worse, `renameMigration.test.ts:139-156` enumerates exactly those four and asserts they are
  present — locking the gap in so no test can ever notice it.
- Check (6) computes orphans against `sih_metric_uf` only. A disease that lost all its
  `sih_metric_muni` rows (1.1M rows, the larger table) but kept a UF row is not flagged.
  Check (2) covers the muni *total*, so wholesale loss is caught, but per-agravo muni orphaning is not.

**Fix:** Add `sum(taxa_mortalidade)` to the `__antes_uf`/`__antes_muni` snapshots, to the
`aggJoin` subselect and to the `is distinct from` predicate; extend `renameMigration.test.ts`'s
loop to be driven by a shared measure list rather than four hand-written strings. Add a muni
orphan check mirroring (6).

---

### WR-04: The migration generator emits syntactically invalid SQL when its input data files are empty

**File:** `scripts/catalog/generateRenameMigration.mjs:62-66`, `scripts/catalog/generateRenameMigration.mjs:72-74`, `scripts/catalog/generateRenameMigration.mjs:478-524`

**Issue:** No guard on empty inputs. Reproduced with `metricless: {}`:

```sql
where d.id not in (select distinct disease_id from sih_metric_uf)
  and d.id not in ();
```

`not in ()` is a Postgres syntax error. Similarly `renderMetriclessValues([])` produces
`insert into __metricless_esperado (disease_id) values\n;` and `renderMapValues([])` produces
`insert into __rename_map (old_id, canonical_id) values\n;`. Since `renameMigration.test.ts`
compares byte-for-byte against the committed (non-empty) files, an operator who empties
`metricless-diseases.json` gets a generator that reports success and a `.sql` that fails at
`db push` time — against production.

**Fix:**
```js
function renderMetriclessValues(ids) {
  if (ids.length === 0) throw new Error('generateRenameMigration: metricless-diseases.json vazio — SQL seria inválido');
  return ids.map((id) => `  (${sqlString(id)})`).join(',\n');
}
```
Same guard in `renderMapValues`; in `renderVerifySql`, emit the `and d.id not in (...)` clause
conditionally.

---

### WR-05: `renderUpMigration`/`renderDownMigration` silently ignore `added[1..]` and crash opaquely on `added[0] === undefined`

**File:** `scripts/catalog/generateRenameMigration.mjs:237`, `scripts/catalog/generateRenameMigration.mjs:359`

**Issue:** `const novo = added[0];` — if a future snapshot refresh adds two TabNet codes, only the
first is inserted by the up migration while `diseases.json` and the SQL seeds carry both. The
D-04 check (3) (`antes + 1`) would then pass by construction while the taxonomy and the DB
disagree by one row. If `added` is empty, `novo.tabnetCode` throws a bare
`TypeError: Cannot read properties of undefined`. The only thing enforcing "exactly one" is
an assertion in an external test file (`renameMigration.test.ts:108`), not the generator.

**Fix:** Assert in `loadData()`/`renderUpMigration`:
```js
if (added.length !== 1) {
  throw new Error(`generateRenameMigration: esperado exatamente 1 "added", recebi ${added.length} — a migração só sabe inserir um agravo novo`);
}
```
Or generalise both renderers to loop over `added`.

---

### WR-06: `--disease` with a missing value silently degrades to "upload every disease" against production

**File:** `scripts/catalog/uploadSihToSupabase.mjs:29-31`, `scripts/catalog/uploadSihToSupabase.mjs:75`

**Issue:** `process.argv[process.argv.indexOf('--disease') + 1]` is `undefined` when `--disease`
is the last argument. `only` becomes `undefined`, and the filter `(id) => !only || id === only`
then passes every directory. `node scripts/catalog/uploadSihToSupabase.mjs --disease` — a typo
away from the documented single-disease invocation — becomes a full-corpus upsert with the
service-role key.

**Fix:**
```js
const diseaseIdx = process.argv.indexOf('--disease');
let only = null;
if (diseaseIdx !== -1) {
  only = process.argv[diseaseIdx + 1];
  if (!only || only.startsWith('--')) {
    console.error('uploadSihToSupabase: --disease exige um id de agravo');
    process.exit(1);
  }
}
```

---

### WR-07: Upsert fabricates primary-key components from null CSV cells

**File:** `scripts/catalog/uploadSihToSupabase.mjs:90`, `scripts/catalog/uploadSihToSupabase.mjs:103`, `scripts/catalog/uploadSihToSupabase.mjs:105`

**Issue:** `parseCsv.mjs` correctly maps an empty cell to `null` ("Empty cells → null. Never
invent numeric values."). This module then undoes that for the key columns:
`String(null ?? '').padStart(2, '0')` yields `'00'` for `uf_codigo` and `'000000'` for
`municipio_codigo`. Both are `char(2)`/`char(6)` NOT NULL PK components, so the row is accepted
and written under a fabricated key — the merge-duplicates upsert will then keep overwriting that
one phantom row. This contradicts the stated project rule (`catalogAnalysisData.ts:5`,
"never coerce null→0 (T-05-11)").

**Fix:**
```js
function requiredCode(raw, width, field, diseaseId) {
  if (raw == null || String(raw).trim() === '') {
    throw new Error(`uploadSihToSupabase: ${diseaseId}: ${field} ausente — recusando fabricar chave`);
  }
  return String(raw).padStart(width, '0');
}
```

---

### WR-08: Three hand-maintained copies of the measure table, with no test asserting they agree

**File:** `scripts/catalog/applyRenameMap.mjs:70-88`, `scripts/catalog/validate.mjs:22-28`, `scripts/catalog/syncColumnMap.mjs:14-32`

**Issue:** `STANDARD_MEASURES`, `STANDARD_COLUMNS` and `MEASURES` are three literal copies of the
same `{col, idSuffix, labelPrefix, variableType, unit}` table. The comments openly document the
duplication ("duplicated by hand, not imported"), and `grep` confirms no test compares them.
This is the same anti-pattern — a hand-maintained parallel table that silently drifts — that
produced the 21 corrupted ids this entire phase exists to repair. Drift here means the rename
engine writes labels that `checkColumnMapKeys` then rejects, or (worse) both drift the same
wrong way and the invariant validates the error.

**Fix:** Extract the table into a side-effect-free `scripts/catalog/measures.mjs` and import it
in all three places. The stated blocker ("syncColumnMap.mjs has unconditional top-level disk
reads") argues for extracting the *data*, not for triplicating it. If extraction is deferred,
add a test that asserts the three arrays are deep-equal.

---

### WR-09: `atomicWriteCatalog` is not atomic and never prunes stale packs, so removed packs resurrect themselves

**File:** `scripts/catalog/build.mjs:173-195`; consumers `scripts/catalog/validate.mjs:586-597`, `scripts/catalog/syncPackImports.mjs:23-31`

**Issue:** The function stages into a temp dir but then renames files one at a time into
`CATALOG_OUT_DIR` (line 186); a failure mid-loop leaves a mixed old/new catalog. It also never
deletes pack files that are no longer produced. `validate.loadCatalogBundle` then deliberately
loads every leftover `.json` in `packs/` as an "extra pack" (lines 586-597), and
`syncPackImports` readdirs the same directory to regenerate TypeScript imports. Net effect: a
pack that was renamed or dropped keeps validating and keeps being imported into the app — a
tombstone-resurrection path through generated data, in the phase built to close exactly those.

**Fix:** Write to `CATALOG_OUT_DIR.tmp` and rename the *directory* in one operation, or
explicitly prune `packs/*.json` not present in `packFiles` before renaming in. Drop the
"extra pack" fallback in `loadCatalogBundle`, or make it an error rather than a silent load.

---

### WR-10: `catalogAnalysisData.ts`'s pack list can drift from disk with no invariant

**File:** `src/features/catalog/catalogAnalysisData.ts:8-49`

**Issue:** The 10 imports and the `PACKS` map are hand-listed (regenerated only by
`syncPackImports.mjs`, which nothing in `pretest`/`test:run`/`gate` runs). If a pack is added
to `public/data/catalog/packs/` and this file is not regenerated, `metricForYear` finds
`PACKS[entry.packId] === undefined`, returns `{}`, and the choropleth renders empty with no
error. `checkEntry` validates `packId` against the packs loaded *from disk*, not against this
map, so validation stays green.

**Fix:** Add a test asserting `Object.keys(PACKS)` equals the `.json` basenames under
`public/data/catalog/packs/`, or replace the static map with `import.meta.glob`.

---

### WR-11: `syncColumnMap.mjs` can only add, never repair — a label change leaves `columnMap.json` permanently invalid

**File:** `scripts/catalog/syncColumnMap.mjs:52-68`

**Issue:** The loop only fills missing keys (`if (!columnMap[packId][key])`). It never rewrites
an existing leaf. `checkColumnMapKeys` (`validate.mjs:433-448`) compares every standard leaf's
`label` against `${labelPrefix} — ${disease.label}` and fails on mismatch. So if a TabNet label
is corrected on the next snapshot refresh (an expected event — the whole point of `--refresh`),
`catalog:validate` goes red and there is no tool that can fix it: `syncColumnMap` won't rewrite,
and `applyRenameMap` only fires on *id* changes. The only path is hand-editing generated data,
which every other guard in this phase forbids.

**Fix:** Give `syncColumnMap.mjs` a `--rewrite` mode that regenerates standard leaves for
existing keys (preserving non-standard columns), and chain it after a snapshot refresh.

---

### WR-12: `supabase/config.toml` is committed as stock CLI defaults against a linked production project

**File:** `supabase/config.toml:5-11`, `:22-24`, `:71-80`, `:160-184`, `:213`

**Issue:** The file is unmodified `supabase init` output linked to production ref
`hmfbxqemububjyhdckrj`. Unlike `20260804015329_remote_schema.sql`, which the phase deliberately
captured live via `db dump` ("como ele realmente é em produção ... não uma intenção documentada
antecipadamente"), this config documents intent, not reality. `supabase config push` writes
`[api]`, `[auth]` and `[db.network_restrictions]` to the linked remote, and these defaults are
permissive: `enable_signup = true`, `enable_confirmations = false`,
`minimum_password_length = 6`, `password_requirements = ""`, `max_rows = 1000`,
`allowed_cidrs = ["0.0.0.0/0"]`. No secrets are hardcoded (all use `env(...)`), which is correct.

**Fix:** Either capture the remote's real settings the way the schema was captured, or add a
comment at the top of the file stating that it has never been reconciled with the remote and
that `supabase config push` must not be run against `hmfbxqemububjyhdckrj`.

---

### WR-13: `decodeEntities` mishandles astral code points and hex entities, and silently passes unknown entities into disease ids

**File:** `scripts/catalog/listaMorbSource.mjs:79-85`

**Issue:** `String.fromCharCode(Number(n))` truncates to 16 bits, so `&#128512;` yields U+F600
rather than the intended character. `&#x…;` (hex) entities are not matched at all. Unknown named
entities are returned verbatim (`? NAMED_ENTITIES[name] : match`), so a `&hellip;` in a label
survives into `slugify` and becomes part of a disease `id`. On the `--refresh` path this parses
live, unvalidated network content.

**Fix:**
```js
.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
```
and collect unknown named entities into a list that `captureSnapshot` refuses to write.

---

### WR-14: `parseListaMorbOptions` can silently drop categories on `--refresh`, and the 300-option floor is too loose to notice

**File:** `scripts/catalog/listaMorbSource.mjs:96-108`, `scripts/catalog/listaMorbSource.mjs:228-234`

**Issue:** The option regex requires a *quoted* `value=` attribute and captures the label as
`[^<]*`. An unquoted value, or a label containing a nested tag, drops or truncates the option
with no signal. The only guard is `MIN_EXPECTED_OPTIONS = 300` against 334 real options — up to
34 categories (10%) can vanish and `--refresh` still writes the snapshot. Once written, invariante
C compares the new HTML against the new extract (self-consistent), invariante D partitions the
new option list against a `diseases.json` regenerated from that same list, and invariante B
compares the generator against itself. Every invariant stays green while categories are gone.

**Fix:** Raise the floor to the currently-observed count (`334`) and make `--refresh` diff the
new option set against the committed one, refusing to write when any `code` disappears
(the same "perda de categoria, não renomeação" rule `buildRenameMap.mjs:95-101` already enforces
for the diseases array).

---

### WR-15: `validate.mjs`'s fail-closed error path cannot catch import-time failures

**File:** `scripts/catalog/validate.mjs:9`, `scripts/catalog/validate.mjs:643-688`; `scripts/catalog/paths.mjs:88-100`

**Issue:** `main()` wraps everything in `try/catch` to produce the
`catalog:validate FAILED: <message>` line. But `validate.mjs` imports `paths.mjs`, which at module
load reads `diseases.json` and calls `assertNotTombstone` on every id. A tombstone in the
taxonomy — precisely the regression the gate exists to catch — therefore throws *before* `main()`
runs, and the operator gets a raw Node stack trace instead of the D-06 message and the
fail-closed framing. Same for a missing/corrupt `diseases.json` or `rename-map.json`
(`tombstones.mjs:15`).

**Fix:** Convert `paths.mjs`'s top-level assertion loop into an exported
`assertPackSourcesClean()` called from `main()`, or import `paths.mjs` lazily via
`await import('./paths.mjs')` inside the `try`.

---

### WR-16: `runCheck` reads every entry of the packs directory as UTF-8 text without filtering

**File:** `scripts/catalog/applyRenameMap.mjs:486-497`

**Issue:** `fs.readdirSync(PACKS_DIR).map((f) => path.join(PACKS_DIR, f))` returns names, not
`Dirent`s. A subdirectory makes `fs.readFileSync(file, 'utf8')` throw `EISDIR`, and a binary
file yields lossy UTF-8 that the tombstone scan then searches. The guard crashes instead of
reporting.

**Fix:** `fs.readdirSync(PACKS_DIR, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => path.join(PACKS_DIR, e.name))`.

---

## Info

### IN-01: Dead half-implementation left in `syncPackImports.mjs`

**File:** `scripts/catalog/syncPackImports.mjs:47-54`
**Issue:** The `PLACEHOLDER_INTERFACE`/`PLACEHOLDER_ALIASES` replace at lines 47-50 is discarded at
line 57; `const headMatch = fs.readFileSync(TARGET, 'utf8'); void headMatch;` at 53-54 does nothing.
Comments at 52 and 56 narrate an abandoned approach.
**Fix:** Delete lines 47-54 (covered by CR-05's fix).

### IN-02: Unreachable branch and unused parameter in `build.mjs`

**File:** `scripts/catalog/build.mjs:74-79`, `scripts/catalog/build.mjs:81-88`
**Issue:** `if (sourceKey === 'sidra_6579' && sources.sidra_6579)` is unreachable — the preceding
`if (sourceKey && sources[sourceKey])` already returns for that case. `methodologyFromMetadata`'s
`extra` parameter is never supplied by any caller.
**Fix:** Remove both.

### IN-03: `metricKeysForPack`'s `includeShared` flag does not control what its name says

**File:** `scripts/catalog/build.mjs:151-171`
**Issue:** When `includeShared === true` the shared keys are prepended (lines 152-158); when it is
`false` they are appended anyway (lines 164-169). The flag only changes ordering, contradicting
both its name and the comment "Also include shared on amputação ... even if not in columnMap".
**Fix:** Rename to `sharedKeysFirst`, or drop the flag and always append.

### IN-04: Magic number `351` duplicated with no named constant

**File:** `scripts/catalog/build.mjs:218-220`, `scripts/catalog/build.mjs:249-251`
**Issue:** `if (rows.length !== 351) throw` appears twice with no explanation that 351 = 27 UF × 13 years.
**Fix:** `const EXPECTED_UF_ANO_ROWS = 27 * 13; // 351`.

### IN-05: `checkCatalog` returns a `warnings` array that is never populated

**File:** `scripts/catalog/validate.mjs:142-175`
**Issue:** `const warnings = []` is built, threaded through both return paths, and never written to.
`main()` never reads it.
**Fix:** Remove the field or start using it.

### IN-06: Stale JSDoc on `checkRegenerationFromDisk`

**File:** `scripts/catalog/validate.mjs:324-329`
**Issue:** "Ainda nao e chamado de `main()` nesta plan — a plan 08-06 liga (D-24)." It *is* called,
at line 656.
**Fix:** Delete the sentence.

### IN-07: Misleading JSDoc on `committedText`

**File:** `src/features/catalog/renameMigration.test.ts:48-51`
**Issue:** "Strips out only whole-line comments — mirrors the plan's `grep -v \"^--\"`" sits above a
function that only calls `readFileSync`. The comment belongs on `stripComments` (line 41).
**Fix:** Move the doc comment.

### IN-08: `writePlans` ordering comment describes a dependency that does not exist

**File:** `scripts/catalog/applyRenameMap.mjs:449-454`
**Issue:** "Order: packs first (so a later step reading PACK_SOURCES/`readdirSync(PACK_DIR)` sees the
renamed files)" — no later step in `writePlans` or `runApply` reads either.
**Fix:** Delete or correct the rationale.

### IN-09: `assertNoTombstoneRows` is dead code

**File:** `scripts/catalog/uploadSihToSupabase.mjs:39-44`, `scripts/catalog/uploadSihToSupabase.mjs:114-115`
**Issue:** Every row's `disease_id` is set to the loop's `diseaseId` at lines 89 and 102, and that
value was already asserted at line 78. The function can never find anything the directory check
missed.
**Fix:** Remove it, or move the assertion to guard a genuinely untrusted source (e.g. a `disease_id`
column read from the CSV).

### IN-10: Usage comment still cites a dead id

**File:** `scripts/catalog/uploadSihToSupabase.mjs:10`
**Issue:** `node scripts/catalog/uploadSihToSupabase.mjs --disease varizes_mmii` — `varizes_mmii` is
one of the 21 tombstones. It survived the rename because it is unquoted, so the `bareQuoted`
pattern did not match it. Copy-pasting the documented command now throws.
**Fix:** Use the canonical id (`flebite_tromboflebite_embolia_e_trombose_venosa`).

### IN-11: `COMBINING_MARKS_RE` written with raw combining characters instead of an escape range

**File:** `src/features/catalog/diseaseAliases.ts:57`
**Issue:** The regex is `/[<raw U+0300>-<raw U+036F>]/g` rather than `/[̀-ͯ]/g`. The two
other places in this codebase that strip the same range (`listaMorbSource.slugify:33`,
`validate.checkAliases:514`) use the escape form. Raw combining marks are invisible in most editors
and trivially destroyed by a normalizing tool.
**Fix:** `const COMBINING_MARKS_RE = /[̀-ͯ]/g;`

### IN-12: `toAlias` has no collision guard

**File:** `scripts/catalog/syncPackImports.mjs:13-21`
**Issue:** Two disease ids differing only in non-alphanumeric separators would collapse to the same
import identifier, producing a duplicate-binding TypeScript error (or worse, a silently wrong pack
mapping). Verified 331/331 unique today, so this is latent.
**Fix:** Build a `Map` of alias → packId and throw on collision.

### IN-13: `diseaseMatches` compares ids without accent folding, inconsistent with label matching

**File:** `src/routes/mapas/MeasureDiseasePicker.tsx:54-61`
**Issue:** `disease.id.includes(q.toLowerCase())` uses raw lowercasing while `labelMatchesQuery`
uses `foldAccents`. A query with an accent matches the label path but never the id path.
**Fix:** `disease.id.includes(foldAccents(q))`.

### IN-14: `contagens.sql` hardcodes absolute row counts that go stale on the next ingest

**File:** `supabase/verify/contagens.sql:20-32`; `scripts/catalog/generateRenameMigration.mjs:34-38`
**Issue:** `331 / 30313 / 1099403` are absolute counts measured on 2026-08-03. Fase 9 will ingest
more data and every one of the three `raise exception` branches will fire, making the verification
script a false alarm rather than a check. `renameMigration.test.ts:158-172` pins the same three
numbers, so updating them requires touching a test.
**Fix:** Add a comment stating the counts are valid only for the 2026-08-04 migration window, or
regenerate `VERIFY_COUNTS` from a live measurement as part of the verify step.

### IN-15: Invariante-F test writes a temporary `.ts` file into `src/`

**File:** `src/test/noTombstoneLiterals.test.ts:159-170`
**Issue:** The planted-tombstone proof writes `src/test/.tmp-tombstone-plant-<pid>-<ts>.ts` and
removes it in `finally`. A concurrent `tsc -b`/`vitest --watch` (or a crash before `finally`)
leaves it in the tree. `git ls-files` won't see it, but `tsc` will.
**Fix:** Write into `os.tmpdir()` and pass an absolute path — `scanForTombstones` already resolves
its input against `ROOT`, so it needs only a small signature change to accept an absolute path.

---

## Verification Commands Used

```bash
node scripts/catalog/validate.mjs                       # exit 0 — invariants A/B/C/D/D2/E green
node scripts/catalog/applyRenameMap.mjs --check         # exit 1 — 47 leftovers (CR-02)
node scripts/catalog/applyRenameMap.mjs --dry-run       # plans 4 file rewrites, reports "sobras: 0"
# planColumnMap(committed columnMap.json) -> 331 keys in, 329 out (CR-01)
# buildDiseases with a colliding extra -> ['colera','colera'] (CR-03)
# renderVerifySql with metricless {} -> "and d.id not in ();" (WR-04)
```

---

_Reviewed: 2026-08-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
