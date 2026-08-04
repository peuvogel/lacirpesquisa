/**
 * Compute the old→canonical id rename map from the diff between the frozen
 * pre-migration fixture and the canonical regeneration (D-12). Never transcribed
 * by hand — the diff is the only source. `main()` writes `rename-map.json`.
 *
 * Usage: node scripts/catalog/buildRenameMap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateFromSnapshot } from './sync-lista-morb.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const FIXTURE_PATH = path.join(ROOT, 'src/test/fixtures/taxonomy/diseases.pre-migracao.json');
const RENAME_MAP_PATH = path.join(ROOT, 'scripts/catalog/rename-map.json');

/**
 * Index a diseases array by `tabnetCode`, aborting on collision.
 *
 * @param {{ id: string, label: string, filterKind: string, tabnetCode: string, def: string }[]} diseases
 * @param {string} sideLabel
 * @returns {Map<string, { id: string, label: string, filterKind: string, tabnetCode: string, def: string }>}
 */
function indexByTabnetCode(diseases, sideLabel) {
  const byCode = new Map();
  for (const d of diseases) {
    if (byCode.has(d.tabnetCode)) {
      throw new Error(
        `computeRenameMap: colisão de tabnetCode "${d.tabnetCode}" no lado "${sideLabel}" — dois registros para o mesmo código`,
      );
    }
    byCode.set(d.tabnetCode, d);
  }
  return byCode;
}

/**
 * Compute the rename map from the diff between `before` (frozen fixture, the
 * corrupted state) and `after` (canonical regeneration), indexed by `tabnetCode`
 * — never by `id`, since the id is exactly what's being renamed.
 *
 * @param {{
 *   before: { id: string, label: string, filterKind: string, tabnetCode: string, def: string }[],
 *   after: { id: string, label: string, filterKind: string, tabnetCode: string, def: string }[],
 * }} args
 * @returns {{
 *   renames: { tabnetCode: string, old: string, canonical: string, label: string }[],
 *   added: { tabnetCode: string, id: string, label: string, filterKind: string, def: string }[],
 *   removed: { tabnetCode: string, id: string, label: string }[],
 *   tombstones: string[],
 * }}
 */
export function computeRenameMap({ before, after }) {
  const beforeByCode = indexByTabnetCode(before, 'before');
  const afterByCode = indexByTabnetCode(after, 'after');

  /** @type {{ tabnetCode: string, old: string, canonical: string, label: string }[]} */
  const renames = [];
  /** @type {{ tabnetCode: string, id: string, label: string, filterKind: string, def: string }[]} */
  const added = [];
  /** @type {{ tabnetCode: string, id: string, label: string }[]} */
  const removed = [];

  const allCodes = new Set([...beforeByCode.keys(), ...afterByCode.keys()]);
  const numericSort = (a, b) => Number(a) - Number(b);

  for (const code of [...allCodes].sort(numericSort)) {
    const beforeEntry = beforeByCode.get(code);
    const afterEntry = afterByCode.get(code);

    if (beforeEntry && afterEntry) {
      if (beforeEntry.id !== afterEntry.id) {
        renames.push({
          tabnetCode: code,
          old: beforeEntry.id,
          canonical: afterEntry.id,
          label: afterEntry.label,
        });
      }
    } else if (!beforeEntry && afterEntry) {
      added.push({
        tabnetCode: code,
        id: afterEntry.id,
        label: afterEntry.label,
        filterKind: afterEntry.filterKind,
        def: afterEntry.def,
      });
    } else if (beforeEntry && !afterEntry) {
      removed.push({ tabnetCode: code, id: beforeEntry.id, label: beforeEntry.label });
    }
  }

  if (removed.length > 0) {
    throw new Error(
      `computeRenameMap: ${removed.length} código(s) perdido(s) na regeneração — perda de categoria, não renomeação: ${removed
        .map((r) => `${r.tabnetCode} (${r.id})`)
        .join(', ')}`,
    );
  }

  const canonicalCounts = new Map();
  for (const r of renames) {
    canonicalCounts.set(r.canonical, (canonicalCounts.get(r.canonical) ?? 0) + 1);
  }
  const duplicateCanonicals = [...canonicalCounts.entries()].filter(([, count]) => count > 1);
  if (duplicateCanonicals.length > 0) {
    throw new Error(
      `computeRenameMap: id canônico duplicado em renames — ${duplicateCanonicals
        .map(([id, count]) => `"${id}" aparece ${count}x`)
        .join(', ')}`,
    );
  }

  const tombstones = renames.map((r) => r.old);

  return { renames, added, removed, tombstones };
}

/**
 * @param {ReturnType<typeof computeRenameMap>} map
 * @returns {string}
 */
export function renderRenameMap(map) {
  const payload = {
    version: 1,
    generatedBy: 'scripts/catalog/buildRenameMap.mjs',
    before: 'src/test/fixtures/taxonomy/diseases.pre-migracao.json — estado corrompido de scripts/catalog/diseases.json congelado antes da regeneração (Fase 8 Plan 2)',
    after: 'scripts/catalog/sync-lista-morb.mjs generateFromSnapshot() — regeneração canônica a partir do snapshot commitado da Lista Morb CID-10',
    renames: map.renames,
    added: map.added,
    removed: map.removed,
    tombstones: map.tombstones,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function main() {
  const before = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const { diseases: after } = generateFromSnapshot();

  const map = computeRenameMap({ before, after });
  const text = renderRenameMap(map);
  fs.writeFileSync(RENAME_MAP_PATH, text);

  console.log(
    `buildRenameMap: ${map.renames.length} renames, ${map.added.length} added, ${map.removed.length} removed, ${map.tombstones.length} tombstones → ${RENAME_MAP_PATH}`,
  );
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
