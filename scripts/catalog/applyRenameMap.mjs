#!/usr/bin/env node
/**
 * Rename engine driven by rename-map.json (D-12) — the only place old ids are
 * transcribed by hand is that file (D-23); this script never contains an id literal.
 *
 * Modes:
 *   --dry-run (default) — report only, mutates nothing on disk
 *   --apply             — perform the mutations described by the dry-run report
 *   --check             — scan the real files on disk, exit non-zero if any tombstone
 *                          remains in scope (post-apply structural guard, D-23)
 *
 * Scope: src/**\/*.ts, src/**\/*.tsx, scripts/catalog/*.mjs, scripts/catalog/columnMap.json,
 * public/data/catalog/**. Deliberately out of scope: .planning/**, `trabalhos datasus/**`
 * (341 coleta dirs — D-22, Fase 9), docs/**, and scripts/catalog/rename-map.json itself.
 *
 * Usage: node scripts/catalog/applyRenameMap.mjs [--dry-run|--apply|--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';
import { findTombstoneHits } from './tombstones.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RENAME_MAP_PATH = path.join(__dirname, 'rename-map.json');
const renameMap = JSON.parse(fs.readFileSync(RENAME_MAP_PATH, 'utf8'));
/** @type {{ tabnetCode: string, old: string, canonical: string, label: string }[]} */
const RENAMES = renameMap.renames;
const RENAME_BY_OLD = new Map(RENAMES.map((r) => [r.old, r]));
const RENAME_BY_OLD_PACK_ID = new Map(RENAMES.map((r) => [`sih.${r.old}_uf`, r]));

const PACKS_DIR = path.join(ROOT, 'public/data/catalog/packs');
const MANIFEST_PATH = path.join(ROOT, 'public/data/catalog/manifest.json');
const VARIABLES_PATH = path.join(ROOT, 'public/data/catalog/variables.json');
const COLUMN_MAP_PATH = path.join(ROOT, 'scripts/catalog/columnMap.json');
const SRC_DIR = path.join(ROOT, 'src');
const SCRIPTS_CATALOG_DIR = path.join(ROOT, 'scripts/catalog');

/**
 * Code-source files that must never be rewritten even though they match the anchored
 * patterns — their old-id literals are not an "identity" reference, they describe
 * `rename-map.json`'s own immutable historical content (Rule 1 fix, found while
 * building this engine): `renameMap.test.ts` (08-02) asserts, for one of the two
 * verified cycles, that the `old` field of a given rename record equals a specific
 * dead id — against the *committed* rename-map.json, which never changes after the
 * flip, so that assertion stays true forever. Rewriting the literal to the canonical
 * form would make the test assert something false. Same rationale as excluding
 * rename-map.json itself from scope; this is the one place besides that file where an
 * old id is legitimately permanent, not a tombstone to purge.
 *
 * `tombstones.test.ts` (08-04, this plan) has the same problem for a narrower reason:
 * its `assertNotTombstone` cases name `hemorroidas`/`embolia_pulmonar` specifically
 * *as* the two verified cycle ids and assert the thrown message cites their (also
 * hardcoded) canonical target. That is a historical-fact assertion about which two ids
 * are cycles, not a "current living id" reference — rewriting the first argument to its
 * own canonical form would make `assertNotTombstone` stop throwing for it (it would no
 * longer be a tombstone) while the `.toThrow(...)` expectation still fires, flipping the
 * test to red (Rule 1 fix, found while verifying this same plan's Task 3).
 */
const SCOPE_EXCLUDE_RELATIVE_PATHS = new Set([
  'src/features/catalog/renameMap.test.ts',
  'src/features/catalog/tombstones.test.ts',
]);

/** Standard measure columns (mirrors syncColumnMap.mjs's MEASURES — duplicated by hand,
 * not imported, because syncColumnMap.mjs has unconditional top-level disk reads and is
 * not a side-effect-free module; same rationale as validate.mjs's STANDARD_COLUMNS). */
const STANDARD_MEASURES = [
  { col: 'internacoes', idSuffix: 'internacoes', labelPrefix: 'Internações', variableType: 'contagem', unit: 'n' },
  { col: 'obitos', idSuffix: 'obitos', labelPrefix: 'Óbitos', variableType: 'contagem', unit: 'n' },
  { col: 'valor_total', idSuffix: 'custo', labelPrefix: 'Custo (valor total)', variableType: 'numerica', unit: 'R$' },
  {
    col: 'dias_permanencia',
    idSuffix: 'dias_permanencia',
    labelPrefix: 'Dias de permanência',
    variableType: 'contagem',
    unit: 'dias',
  },
  {
    col: 'taxa_mortalidade',
    idSuffix: 'taxa_mortalidade',
    labelPrefix: 'Taxa de mortalidade hospitalar',
    variableType: 'taxa',
    unit: '%',
  },
];
const STANDARD_COLUMN_NAMES = new Set(STANDARD_MEASURES.map((m) => m.col));
const STANDARD_MEASURE_BY_COLUMN = new Map(STANDARD_MEASURES.map((m) => [m.col, m]));

/** Old ids that are *also* the canonical target of a different rename — the two verified
 * cycles (186↔187 hemorroidas, 173↔182 embolia_pulmonar). Their correct post-rename
 * reappearance under the canonical form is not a leftover (D-06/08-PATTERNS). */
const CYCLE_OLD_IDS = new Set(RENAMES.filter((r) => RENAME_BY_OLD.has(r.canonical)).map((r) => r.canonical));

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

/**
 * @param {string} dir
 * @param {(name: string) => boolean} predicate
 * @returns {string[]}
 */
function listFilesRecursive(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Code-source scope: src/**\/*.ts, src/**\/*.tsx, scripts/catalog/*.mjs (single level),
 * minus SCOPE_EXCLUDE_RELATIVE_PATHS. */
function collectCodeSourceFiles() {
  const files = listFilesRecursive(SRC_DIR, (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
  for (const entry of fs.readdirSync(SCRIPTS_CATALOG_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(path.join(SCRIPTS_CATALOG_DIR, entry.name));
    }
  }
  return files.filter((f) => !SCOPE_EXCLUDE_RELATIVE_PATHS.has(path.relative(ROOT, f))).sort();
}

// ---------------------------------------------------------------------------
// Combined single-pass text substitution (code-source files)
//
// A single combined regex — not a sequential per-rename replace loop — is required
// because two rename pairs are cycles (186↔187, 173↔182): a sequential loop would let
// an earlier rename's freshly-written canonical text be re-matched and corrupted by a
// later rename in the same pass. A single regex.exec pass over the *original* string
// never re-scans text it just wrote, so cycles resolve correctly in one pass.
// ---------------------------------------------------------------------------

/** @param {string} s @returns {string} */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const OLD_IDS_ALTERNATION = RENAMES.map((r) => escapeRegExp(r.old)).join('|');
const COMBINED_RENAME_REGEX = new RegExp(
  `(?<![\\w.])sih\\.(?:${OLD_IDS_ALTERNATION})_uf(?!\\w)` +
    `|(?<![\\w.])sih\\.(?:${OLD_IDS_ALTERNATION})\\.` +
    `|'(?:${OLD_IDS_ALTERNATION})'` +
    `|"(?:${OLD_IDS_ALTERNATION})"`,
  'g',
);

/** @param {string} match @returns {string} */
function renameMatchedText(match) {
  if (match.startsWith('sih.') && match.endsWith('_uf')) {
    const oldId = match.slice(4, -3);
    return `sih.${RENAME_BY_OLD.get(oldId).canonical}_uf`;
  }
  if (match.startsWith('sih.') && match.endsWith('.')) {
    const oldId = match.slice(4, -1);
    return `sih.${RENAME_BY_OLD.get(oldId).canonical}.`;
  }
  const quote = match[0];
  const oldId = match.slice(1, -1);
  return `${quote}${RENAME_BY_OLD.get(oldId).canonical}${quote}`;
}

/** @param {string} text @returns {string} */
function renameCodeSourceText(text) {
  return text.replace(COMBINED_RENAME_REGEX, renameMatchedText);
}

// ---------------------------------------------------------------------------
// Per-artifact plans
// ---------------------------------------------------------------------------

function planPacks() {
  const existing = fs.existsSync(PACKS_DIR) ? new Set(fs.readdirSync(PACKS_DIR)) : new Set();
  const plan = [];
  for (const r of RENAMES) {
    const fromFile = `sih.${r.old}_uf.json`;
    if (existing.has(fromFile)) {
      plan.push({ tabnetCode: r.tabnetCode, old: r.old, canonical: r.canonical, fromFile, toFile: `sih.${r.canonical}_uf.json` });
    }
  }
  return plan;
}

/** @param {{ version: string, generatedAt: string, catalogEntryCount: number, packs: any[] }} manifest */
function planManifest(manifest) {
  const changes = [];
  const newPacks = manifest.packs.map((p) => {
    const rename = RENAME_BY_OLD_PACK_ID.get(p.packId);
    if (!rename) return p;
    const newPackId = `sih.${rename.canonical}_uf`;
    changes.push({ from: p.packId, to: newPackId, sourceDir: p.sourceDir });
    // sourceDir preserved as-is: it names the real (unrenamed) coleta directory (D-22).
    return { ...p, packId: newPackId };
  });
  return { changes, newManifest: { ...manifest, packs: newPacks } };
}

/** @param {any[]} variables */
function planVariables(variables) {
  const changes = [];
  const newVariables = variables.map((entry) => {
    const rename = entry.packId ? RENAME_BY_OLD_PACK_ID.get(entry.packId) : undefined;
    if (!rename) return entry;

    const newPackId = `sih.${rename.canonical}_uf`;
    const idParts = typeof entry.id === 'string' ? entry.id.split('.') : null;
    const newId = idParts && idParts[0] === 'sih' ? ['sih', rename.canonical, ...idParts.slice(2)].join('.') : entry.id;

    let newLabel = entry.label;
    if (STANDARD_COLUMN_NAMES.has(entry.columnKey)) {
      const measure = STANDARD_MEASURE_BY_COLUMN.get(entry.columnKey);
      newLabel = `${measure.labelPrefix} — ${rename.label}`;
    }

    changes.push({
      id: entry.id,
      newId,
      packId: entry.packId,
      newPackId,
      labelChanged: newLabel !== entry.label,
    });

    return { ...entry, id: newId, packId: newPackId, label: newLabel };
  });
  return { changes, newVariables };
}

/** @param {string} id @param {string} canonical @returns {string} */
function rewriteIdPrefix(id, canonical) {
  if (typeof id !== 'string') return id;
  const parts = id.split('.');
  if (parts[0] !== 'sih') return id;
  return ['sih', canonical, ...parts.slice(2)].join('.');
}

/** @param {Record<string, Record<string, { id?: string, label?: string }>>} columnMap */
function planColumnMap(columnMap) {
  const moves = [];
  const prunes = [];
  const newColumnMap = {};
  const keyRe = /^sih\.(.+)_uf$/;

  for (const [key, leafMap] of Object.entries(columnMap)) {
    const match = key.match(keyRe);
    const diseaseId = match ? match[1] : null;
    const rename = diseaseId ? RENAME_BY_OLD.get(diseaseId) : undefined;

    if (!rename) {
      newColumnMap[key] = leafMap;
      continue;
    }

    const newKey = `sih.${rename.canonical}_uf`;
    const newLeafMap = {};
    for (const [col, leaf] of Object.entries(leafMap)) {
      if (STANDARD_COLUMN_NAMES.has(col)) {
        const measure = STANDARD_MEASURE_BY_COLUMN.get(col);
        newLeafMap[col] = {
          id: `sih.${rename.canonical}.${measure.idSuffix}`,
          label: `${measure.labelPrefix} — ${rename.label}`,
          variableType: measure.variableType,
          domain: 'sih_lista_morb',
          unit: measure.unit,
          sourceSystem: 'SIH/SUS',
          sourceName: 'Morbidade hospitalar — local de internação',
          tableOrIndicator: 'sih/cnv/nibr.def',
          sourceKey: 'sih_morbidade_local_internacao',
        };
      } else {
        newLeafMap[col] = { ...leaf, id: rewriteIdPrefix(leaf.id, rename.canonical) };
      }
    }

    newColumnMap[newKey] = newLeafMap;
    moves.push({ from: key, to: newKey, tabnetCode: rename.tabnetCode });
    prunes.push(key);
  }

  return { moves, prunes, newColumnMap };
}

/** @param {string[]} files */
function planCodeSource(files) {
  const changes = [];
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const hits = findTombstoneHits(original);
    if (hits.length === 0) continue;
    const rewritten = renameCodeSourceText(original);
    if (rewritten === original) continue;
    const byForm = {};
    for (const h of hits) byForm[h.form] = (byForm[h.form] ?? 0) + 1;
    changes.push({ file: path.relative(ROOT, file), occurrences: hits.length, byForm, newText: rewritten });
  }
  return changes;
}

/**
 * Leftover-tombstone count after simulating every rewrite in memory. Ids that are
 * simultaneously a tombstone *and* the canonical target of a different rename
 * (the two verified cycles) are excluded: their correct post-rename reappearance is
 * not a leftover — see CYCLE_OLD_IDS.
 * @param {{ id: string }[]} hits
 */
function countRealLeftovers(hits) {
  return hits.filter((h) => !CYCLE_OLD_IDS.has(h.id)).length;
}

// ---------------------------------------------------------------------------
// Report (dry-run) / apply / check
// ---------------------------------------------------------------------------

function buildPlans() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const variables = JSON.parse(fs.readFileSync(VARIABLES_PATH, 'utf8'));
  const columnMap = JSON.parse(fs.readFileSync(COLUMN_MAP_PATH, 'utf8'));
  const codeSourceFiles = collectCodeSourceFiles();

  const packsPlan = planPacks();
  const manifestPlan = planManifest(manifest);
  const variablesPlan = planVariables(variables);
  const columnMapPlan = planColumnMap(columnMap);
  const codeSourcePlan = planCodeSource(codeSourceFiles);

  return { manifest, variables, columnMap, codeSourceFiles, packsPlan, manifestPlan, variablesPlan, columnMapPlan, codeSourcePlan };
}

function computeLeftovers(plans) {
  const leftovers = [];

  for (const change of plans.codeSourcePlan) {
    const hits = findTombstoneHits(change.newText);
    for (const h of hits) {
      if (CYCLE_OLD_IDS.has(h.id)) continue;
      leftovers.push({ file: change.file, ...h });
    }
  }

  const manifestText = JSON.stringify(plans.manifestPlan.newManifest, null, 2);
  for (const h of findTombstoneHits(manifestText)) {
    if (CYCLE_OLD_IDS.has(h.id)) continue;
    leftovers.push({ file: 'public/data/catalog/manifest.json', ...h });
  }

  const variablesText = JSON.stringify(plans.variablesPlan.newVariables, null, 2);
  for (const h of findTombstoneHits(variablesText)) {
    if (CYCLE_OLD_IDS.has(h.id)) continue;
    leftovers.push({ file: 'public/data/catalog/variables.json', ...h });
  }

  const columnMapText = JSON.stringify(plans.columnMapPlan.newColumnMap, null, 2);
  for (const h of findTombstoneHits(columnMapText)) {
    if (CYCLE_OLD_IDS.has(h.id)) continue;
    leftovers.push({ file: 'scripts/catalog/columnMap.json', ...h });
  }

  return leftovers;
}

function printReport(plans, leftovers) {
  console.log('applyRenameMap --dry-run (D-12) — nada e escrito em disco neste modo\n');

  console.log(`packs: ${plans.packsPlan.length} a renomear`);
  for (const p of plans.packsPlan) {
    console.log(`  ${p.fromFile} -> ${p.toFile} (tabnetCode ${p.tabnetCode})`);
  }

  console.log(`\nmanifest.json: ${plans.manifestPlan.changes.length} packId a reescrever (sourceDir preservado, D-22)`);
  for (const c of plans.manifestPlan.changes) {
    console.log(`  ${c.from} -> ${c.to}`);
  }

  console.log(`\nvariables.json: ${plans.variablesPlan.changes.length} entradas a alterar`);
  const labelChanges = plans.variablesPlan.changes.filter((c) => c.labelChanged).length;
  console.log(`  (${labelChanges} com rotulo regenerado — colunas de medida padrao)`);

  console.log(`\ncolumnMap.json: ${plans.columnMapPlan.moves.length} chaves a mover, ${plans.columnMapPlan.prunes.length} a podar`);
  for (const m of plans.columnMapPlan.moves) {
    console.log(`  ${m.from} -> ${m.to}`);
  }

  console.log(`\ncodigo-fonte: ${plans.codeSourcePlan.length} arquivos alterados`);
  let totalOccurrences = 0;
  for (const c of plans.codeSourcePlan) {
    totalOccurrences += c.occurrences;
    console.log(`  ${c.file} (${c.occurrences} ocorrencias)`);
  }
  console.log(`  total de ocorrencias: ${totalOccurrences}`);

  console.log(`\nsobras: ${leftovers.length}`);
  if (leftovers.length > 0) {
    for (const l of leftovers.slice(0, 25)) {
      console.log(`  ${l.file}: id="${l.id}" forma=${l.form} offset=${l.offset} texto="${l.matched}"`);
    }
    if (leftovers.length > 25) console.log(`  … e mais ${leftovers.length - 25}`);
  }
}

function runDryRun() {
  const plans = buildPlans();
  const leftovers = computeLeftovers(plans);
  printReport(plans, leftovers);
  if (leftovers.length > 0) {
    console.error('\napplyRenameMap --dry-run FAILED — sobrou tombstone apos simulacao');
    process.exit(1);
  }
  console.log('\napplyRenameMap --dry-run OK — nenhum arquivo foi tocado');
  process.exit(0);
}

/** Repo-relative path to the packs dir, for `git mv` arguments — `git mv` string-compares
 * its arguments against `git rev-parse --show-toplevel`, which on macOS/APFS can be a
 * different Unicode normalization form (NFD) than the NFC absolute path Node computes
 * from `import.meta.url` when ROOT contains accented characters (e.g. "Bioestatística").
 * Relative paths run with `cwd: ROOT` sidestep that string-normalization mismatch
 * entirely — `fs.*` calls stay on absolute paths since they resolve via the OS, which is
 * normalization-insensitive, not string-comparison-based like git's arg parsing. */
const PACKS_DIR_REL = path.relative(ROOT, PACKS_DIR);

/** Two-pass file rename via a temp suffix, so pack renames never collide even if a
 * canonical target happens to equal another pack's current (not-yet-renamed) name. */
function applyPacksPlan(packsPlan) {
  const tmpSuffix = '.applyRenameMap.tmp';
  for (const p of packsPlan) {
    execFileSync(
      'git',
      ['mv', path.join(PACKS_DIR_REL, p.fromFile), path.join(PACKS_DIR_REL, p.toFile + tmpSuffix)],
      { cwd: ROOT },
    );
  }
  for (const p of packsPlan) {
    const finalRel = path.join(PACKS_DIR_REL, p.toFile);
    execFileSync('git', ['mv', finalRel + tmpSuffix, finalRel], { cwd: ROOT });
    const finalPath = path.join(PACKS_DIR, p.toFile);
    const pack = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
    pack.packId = `sih.${p.canonical}_uf`;
    fs.writeFileSync(finalPath, `${JSON.stringify(pack)}\n`);
  }
}

/** Write every artifact described by `plans` to disk — the actual mutation step of
 * `--apply` (D-24, 08-06). Packs via `applyPacksPlan` (git mv, preserves history);
 * manifest/variables/columnMap as fresh `JSON.stringify(x, null, 2) + '\n'` (house
 * style, matches every other script-written data file in this pipeline); code-source
 * files with their pre-computed `newText`. Order: packs first (so a later step reading
 * PACK_SOURCES/`readdirSync(PACK_DIR)` sees the renamed files), then data, then code. */
function writePlans(plans) {
  applyPacksPlan(plans.packsPlan);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(plans.manifestPlan.newManifest, null, 2)}\n`);
  fs.writeFileSync(VARIABLES_PATH, `${JSON.stringify(plans.variablesPlan.newVariables, null, 2)}\n`);
  fs.writeFileSync(COLUMN_MAP_PATH, `${JSON.stringify(plans.columnMapPlan.newColumnMap, null, 2)}\n`);
  for (const change of plans.codeSourcePlan) {
    fs.writeFileSync(path.join(ROOT, change.file), change.newText);
  }
}

function runApply() {
  const plans = buildPlans();
  const leftovers = computeLeftovers(plans);
  if (leftovers.length > 0) {
    console.error('applyRenameMap --apply ABORTADO — sobrou tombstone apos simulacao (rode --dry-run para detalhes)');
    for (const l of leftovers.slice(0, 25)) {
      console.error(`  ${l.file}: id="${l.id}" forma=${l.form} offset=${l.offset}`);
    }
    process.exit(1);
  }

  writePlans(plans);

  console.log(
    `applyRenameMap --apply OK — ${plans.packsPlan.length} packs, ${plans.manifestPlan.changes.length} manifest packIds, ` +
      `${plans.variablesPlan.changes.length} variables.json entries, ${plans.columnMapPlan.moves.length} columnMap chaves, ` +
      `${plans.codeSourcePlan.length} arquivos de codigo-fonte`,
  );
  process.exit(0);
}

function runCheck() {
  const files = [
    ...collectCodeSourceFiles(),
    MANIFEST_PATH,
    VARIABLES_PATH,
    COLUMN_MAP_PATH,
    ...(fs.existsSync(PACKS_DIR) ? fs.readdirSync(PACKS_DIR).map((f) => path.join(PACKS_DIR, f)) : []),
  ];
  const leftovers = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const h of findTombstoneHits(text)) {
      // Ids that are simultaneously a tombstone and the canonical target of a
      // different rename (the two verified cycles) legitimately reappear post-apply —
      // same CYCLE_OLD_IDS exclusion computeLeftovers() applies during --dry-run.
      if (CYCLE_OLD_IDS.has(h.id)) continue;
      leftovers.push({ file: path.relative(ROOT, file), ...h });
    }
  }
  if (leftovers.length > 0) {
    console.error(`applyRenameMap --check FAILED — ${leftovers.length} tombstone(s) no escopo`);
    for (const l of leftovers.slice(0, 25)) {
      console.error(`  ${l.file}: id="${l.id}" forma=${l.form} offset=${l.offset}`);
    }
    process.exit(1);
  }
  console.log('applyRenameMap --check OK — nenhum tombstone no escopo');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--check') ? 'check' : 'dry-run';
  if (mode === 'apply') runApply();
  else if (mode === 'check') runCheck();
  else runDryRun();
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}

export {
  planPacks,
  planManifest,
  planVariables,
  planColumnMap,
  planCodeSource,
  renameCodeSourceText,
  applyPacksPlan,
  SCOPE_EXCLUDE_RELATIVE_PATHS,
};
