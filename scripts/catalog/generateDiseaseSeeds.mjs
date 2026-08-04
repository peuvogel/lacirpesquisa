#!/usr/bin/env node
/**
 * Generate scripts/catalog/sql/<n>.sql from the canonical taxonomy (TAX-06). Replaces
 * the hand-maintained seeds: `renderSeedChunks` applied to the pre-migration fixture
 * must reproduce the five committed `sql/*.sql` files byte-for-byte (proven in
 * tombstones.test.ts) — that fidelity is the only reason it is safe to stop hand-editing
 * the seeds.
 *
 * Usage: node scripts/catalog/generateDiseaseSeeds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';
import { generateFromSnapshot } from './sync-lista-morb.mjs';

const SQL_DIR = path.join(ROOT, 'scripts/catalog/sql');
const CHUNK_SIZE = 80;

/**
 * Double every apostrophe (SQL single-quote escaping) — no current label has one, but
 * the generator must not depend on that staying true.
 * @param {unknown} value
 * @returns {string}
 */
function escapeSqlString(value) {
  return String(value).replaceAll("'", "''");
}

/**
 * Render one `insert into sih_disease ... values (...), (...) on conflict ...;` chunk,
 * matching the committed format exactly: no newline at the end of the string, the last
 * values line has no trailing comma.
 *
 * @param {{ id: string, label: string, filterKind: string, tabnetCode: string, def: string }[]} diseases
 * @returns {string}
 */
function renderSeedChunk(diseases) {
  const lines = ['insert into sih_disease (id,label,filter_kind,tabnet_code,def_path) values'];
  diseases.forEach((d, i) => {
    const row =
      `('${escapeSqlString(d.id)}','${escapeSqlString(d.label)}','${escapeSqlString(d.filterKind)}',` +
      `'${escapeSqlString(d.tabnetCode)}','${escapeSqlString(d.def)}')`;
    const isLast = i === diseases.length - 1;
    lines.push(isLast ? row : `${row},`);
  });
  lines.push(
    'on conflict (id) do update set label=excluded.label, filter_kind=excluded.filter_kind, tabnet_code=excluded.tabnet_code, def_path=excluded.def_path;',
  );
  return lines.join('\n');
}

/**
 * Split `diseases` into `chunkSize`-sized groups (order preserved — the order of
 * `diseases.json`/`generateFromSnapshot()` is the order of the seeds) and render each
 * group into its own `insert` statement string.
 *
 * @param {{ id: string, label: string, filterKind: string, tabnetCode: string, def: string }[]} diseases
 * @param {number} chunkSize
 * @returns {string[]} one string per output file
 */
export function renderSeedChunks(diseases, chunkSize) {
  const chunks = [];
  for (let i = 0; i < diseases.length; i += chunkSize) {
    chunks.push(renderSeedChunk(diseases.slice(i, i + chunkSize)));
  }
  return chunks;
}

function main() {
  const { diseases } = generateFromSnapshot();
  const chunks = renderSeedChunks(diseases, CHUNK_SIZE);

  // Remove the existing set first so shrinking the disease count never leaves an
  // orphaned high-numbered file behind.
  if (fs.existsSync(SQL_DIR)) {
    for (const name of fs.readdirSync(SQL_DIR)) {
      if (name.endsWith('.sql')) fs.unlinkSync(path.join(SQL_DIR, name));
    }
  } else {
    fs.mkdirSync(SQL_DIR, { recursive: true });
  }

  chunks.forEach((chunk, i) => {
    fs.writeFileSync(path.join(SQL_DIR, `${i}.sql`), chunk);
  });

  console.log(`generateDiseaseSeeds: ${diseases.length} diseases -> ${chunks.length} sql/*.sql files`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
