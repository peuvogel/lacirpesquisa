/**
 * Single source of truth for tombstone (dead) disease ids — anchored patterns and
 * the write-path guard that refuses them (D-06, D-23).
 *
 * TOMBSTONES / CANONICAL_BY_OLD are read from `rename-map.json`, never a literal list
 * here — the only legitimate place old ids are written by hand is that file (D-23).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENAME_MAP_PATH = path.join(__dirname, 'rename-map.json');

const renameMap = JSON.parse(fs.readFileSync(RENAME_MAP_PATH, 'utf8'));

/** Old ids that no longer identify any agravo — permanent tombstones (D-06). */
export const TOMBSTONES = renameMap.tombstones;

/** old id -> canonical id (D-12). Two of the 21 values are themselves the `old` id of
 * a *different* rename (the verified cycles 186/187 and 173/182) — see `assertNotTombstone`. */
export const CANONICAL_BY_OLD = Object.fromEntries(
  renameMap.renames.map((r) => [r.old, r.canonical]),
);

/** old id -> full rename record (tabnetCode/canonical/label), for callers that need more
 * than the canonical id (e.g. the rename engine, error messages). */
export const RENAME_BY_OLD = Object.fromEntries(renameMap.renames.map((r) => [r.old, r]));

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Anchored patterns that represent `oldId` as a disease *identity*, and only those —
 * never a substring match against a legacy CSV column name or corpus directory name
 * (D-22). The three forms:
 *  - `packId`: `sih.<old>_uf` (pack file id)
 *  - `variableIdPrefix`: `sih.<old>.` (catalog variable id prefix, e.g. `sih.<old>.internacoes`)
 *  - `bareQuoted`: the id alone, delimited by matching single or double quotes
 *
 * The rename engine (`applyRenameMap.mjs`) uses these patterns to rewrite, and the
 * structural invariant F uses them to detect — sharing this function is what guarantees
 * rewrite and scan never disagree (T-08-04-03).
 *
 * @param {string} oldId
 * @returns {{ name: 'packId' | 'variableIdPrefix' | 'bareQuoted', regex: RegExp }[]}
 */
export function tombstonePatterns(oldId) {
  const esc = escapeRegExp(oldId);
  return [
    { name: 'packId', regex: new RegExp(`(?<![\\w.])sih\\.${esc}_uf(?!\\w)`, 'g') },
    { name: 'variableIdPrefix', regex: new RegExp(`(?<![\\w.])sih\\.${esc}\\.`, 'g') },
    { name: 'bareQuoted', regex: new RegExp(`(['"])${esc}\\1`, 'g') },
  ];
}

/**
 * Scan `text` for occurrences of any id in `tombstones`, in their anchored forms only.
 *
 * @param {string} text
 * @param {Iterable<string>} [tombstones] defaults to the full `TOMBSTONES` list
 * @returns {{ id: string, form: string, offset: number, matched: string }[]}
 */
export function findTombstoneHits(text, tombstones = TOMBSTONES) {
  const hits = [];
  for (const oldId of tombstones) {
    for (const { name, regex } of tombstonePatterns(oldId)) {
      regex.lastIndex = 0;
      let match = regex.exec(text);
      while (match !== null) {
        hits.push({ id: oldId, form: name, offset: match.index, matched: match[0] });
        if (match[0].length === 0) regex.lastIndex += 1;
        match = regex.exec(text);
      }
    }
  }
  return hits;
}

/**
 * Refuse an id that is a tombstone — throws in PT-BR citing the id, the write-path
 * context, and the canonical id it maps to today (D-06). The only function in this
 * module that throws: it guards a write path, it is not a validation check (those
 * return arrays and never throw, per the `validate.mjs` molde).
 *
 * Both ids that are *simultaneously* a tombstone and the canonical id of a different
 * agravo (the verified cycles `hemorroidas` 186↔187 and `embolia_pulmonar` 173↔182) are
 * refused the same way — the FK alone lets exactly this case through silently and write
 * it under the wrong agravo, which is the reason D-06 exists.
 *
 * @param {string} id
 * @param {string} contexto human-readable write-path context for the error message
 */
export function assertNotTombstone(id, contexto) {
  if (!Object.prototype.hasOwnProperty.call(CANONICAL_BY_OLD, id)) return;
  const canonical = CANONICAL_BY_OLD[id];
  throw new Error(
    `assertNotTombstone: id "${id}" e um id-tombstone (contexto: ${contexto}). ` +
      `O id canonico correspondente hoje e "${canonical}" — gravar sob "${id}" contaminaria o agravo errado (D-06).`,
  );
}
