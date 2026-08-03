/**
 * Fail-closed catalog validation (D-05 / D-06 / D-10).
 * Zero new deps — hand checks only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOG_OUT_DIR } from './paths.mjs';
import { checkSnapshotIntegrity } from './listaMorbSource.mjs';

const VARIABLE_TYPES = new Set([
  'categorica',
  'numerica',
  'ordinal',
  'taxa',
  'contagem',
  'texto',
]);

const REQUIRED_STRING_FIELDS = [
  'id',
  'label',
  'variableType',
  'domain',
  'sourceSystem',
  'sourceName',
  'tableOrIndicator',
  'period',
  'officialUrl',
  'methodologyNotes',
];

const OFFICIAL_URL_RE = /^https?:\/\//i;

/** Shared CNES/pop columns that must agree across packs when both present (RESEARCH A2). */
export const DEFAULT_SHARED_METRIC_KEYS = [
  'medicos_vasculares_sus',
  'populacao',
  'medicos_vasculares_por_100k',
];

/**
 * @param {unknown} entry
 * @param {Record<string, { packId?: string, metricKeys?: string[], rows?: unknown[] }>} packsById
 * @returns {string[]}
 */
export function checkEntry(entry, packsById = {}) {
  const errors = [];
  if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
    return ['entry: must be a non-null object'];
  }
  /** @type {Record<string, unknown>} */
  const e = /** @type {Record<string, unknown>} */ (entry);
  const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : '(missing id)';

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = e[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${id}: missing or empty required field "${field}"`);
    }
  }

  if (typeof e.variableType === 'string' && !VARIABLE_TYPES.has(e.variableType)) {
    errors.push(
      `${id}: invalid variableType "${e.variableType}" (expected one of ${[...VARIABLE_TYPES].join('|')})`,
    );
  }

  if (typeof e.loadable !== 'boolean') {
    errors.push(`${id}: loadable must be a boolean`);
  }

  if (typeof e.officialUrl === 'string' && e.officialUrl.trim().length > 0) {
    if (!OFFICIAL_URL_RE.test(e.officialUrl.trim())) {
      errors.push(
        `${id}: officialUrl must be absolute http(s) URL (got "${e.officialUrl}")`,
      );
    }
  }

  if (e.loadable === true) {
    const packId = typeof e.packId === 'string' ? e.packId.trim() : '';
    const columnKey = typeof e.columnKey === 'string' ? e.columnKey.trim() : '';
    if (!packId || !columnKey) {
      errors.push(
        `${id}: loadable:true requires packId and columnKey`,
      );
    } else {
      const pack = packsById[packId];
      if (!pack) {
        errors.push(`${id}: loadable packId "${packId}" not found in packs`);
      } else {
        const metricKeys = Array.isArray(pack.metricKeys) ? pack.metricKeys : [];
        if (!metricKeys.includes(columnKey)) {
          // Also accept presence on first row keys for resilience
          const row0 =
            Array.isArray(pack.rows) && pack.rows[0] && typeof pack.rows[0] === 'object'
              ? /** @type {Record<string, unknown>} */ (pack.rows[0])
              : null;
          const onRow = row0 != null && Object.prototype.hasOwnProperty.call(row0, columnKey);
          if (!onRow) {
            errors.push(
              `${id}: columnKey "${columnKey}" absent from pack "${packId}" metricKeys`,
            );
          }
        }
      }
    }
  }

  return errors;
}

/**
 * @param {{
 *   variables: unknown[],
 *   packsById: Record<string, any>,
 *   sharedMetricKeys?: string[],
 * }} bundle
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function checkCatalog(bundle) {
  const errors = [];
  const warnings = [];
  const variables = Array.isArray(bundle?.variables) ? bundle.variables : null;
  if (!variables) {
    return { ok: false, errors: ['variables: must be an array'], warnings };
  }
  const packsById =
    bundle?.packsById && typeof bundle.packsById === 'object' ? bundle.packsById : {};
  const sharedMetricKeys = Array.isArray(bundle?.sharedMetricKeys)
    ? bundle.sharedMetricKeys
    : DEFAULT_SHARED_METRIC_KEYS;

  const seen = new Map();
  for (let i = 0; i < variables.length; i++) {
    const entry = variables[i];
    const id =
      entry && typeof entry === 'object' && typeof entry.id === 'string'
        ? entry.id
        : `index:${i}`;
    if (seen.has(id)) {
      errors.push(
        `duplicate catalog id "${id}" (indices ${seen.get(id)} and ${i})`,
      );
    } else {
      seen.set(id, i);
    }
    errors.push(...checkEntry(entry, packsById));
  }

  errors.push(...checkSharedMetricsAcrossPacks(packsById, sharedMetricKeys));

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {Record<string, any>} packsById
 * @param {string[]} sharedMetricKeys
 * @returns {string[]}
 */
export function checkSharedMetricsAcrossPacks(packsById, sharedMetricKeys) {
  const errors = [];
  const packIds = Object.keys(packsById);
  if (packIds.length < 2) return errors;

  for (const metricKey of sharedMetricKeys) {
    const holders = packIds.filter((pid) => {
      const pack = packsById[pid];
      const keys = Array.isArray(pack?.metricKeys) ? pack.metricKeys : [];
      return keys.includes(metricKey);
    });
    if (holders.length < 2) continue;

    /** @type {Map<string, { packId: string, value: unknown }>} */
    const baseline = new Map();
    const firstId = holders[0];
    const firstPack = packsById[firstId];
    for (const row of firstPack.rows || []) {
      if (!row || typeof row !== 'object') continue;
      const key = `${String(row.uf_codigo)}|${String(row.ano)}`;
      baseline.set(key, { packId: firstId, value: row[metricKey] });
    }

    for (let h = 1; h < holders.length; h++) {
      const otherId = holders[h];
      const otherPack = packsById[otherId];
      for (const row of otherPack.rows || []) {
        if (!row || typeof row !== 'object') continue;
        const key = `${String(row.uf_codigo)}|${String(row.ano)}`;
        const base = baseline.get(key);
        if (!base) continue;
        if (!sameNumericOrNull(base.value, row[metricKey])) {
          errors.push(
            `shared metric "${metricKey}" diverges at ${key}: ${base.packId}=${JSON.stringify(base.value)} vs ${otherId}=${JSON.stringify(row[metricKey])}`,
          );
          // One sample per metric is enough to fail closed without flooding stderr
          break;
        }
      }
    }
  }

  return errors;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function sameNumericOrNull(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return Object.is(a, b);
  }
  return false;
}

/**
 * @param {string} catalogDir
 */
export function loadCatalogBundle(catalogDir) {
  const variablesPath = path.join(catalogDir, 'variables.json');
  const manifestPath = path.join(catalogDir, 'manifest.json');
  if (!fs.existsSync(variablesPath)) {
    throw new Error(`Missing ${variablesPath}`);
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }

  const variables = JSON.parse(fs.readFileSync(variablesPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const packsById = {};

  const packRefs = Array.isArray(manifest?.packs) ? manifest.packs : [];
  for (const ref of packRefs) {
    const packId = ref?.packId;
    if (typeof packId !== 'string' || !packId) continue;
    const packPath = path.join(catalogDir, 'packs', `${packId}.json`);
    if (!fs.existsSync(packPath)) {
      throw new Error(`Missing pack file for "${packId}": ${packPath}`);
    }
    packsById[packId] = JSON.parse(fs.readFileSync(packPath, 'utf8'));
  }

  // Also load any extra pack JSON files present on disk
  const packsDir = path.join(catalogDir, 'packs');
  if (fs.existsSync(packsDir)) {
    for (const name of fs.readdirSync(packsDir)) {
      if (!name.endsWith('.json')) continue;
      const packId = name.slice(0, -'.json'.length);
      if (packsById[packId]) continue;
      packsById[packId] = JSON.parse(
        fs.readFileSync(path.join(packsDir, name), 'utf8'),
      );
    }
  }

  return { variables, manifest, packsById };
}

/**
 * @param {string} [catalogDir]
 */
export function validateCatalogDir(catalogDir = CATALOG_OUT_DIR) {
  const bundle = loadCatalogBundle(catalogDir);
  const result = checkCatalog({
    variables: bundle.variables,
    packsById: bundle.packsById,
  });

  if (
    bundle.manifest &&
    typeof bundle.manifest.catalogEntryCount === 'number' &&
    Array.isArray(bundle.variables) &&
    bundle.manifest.catalogEntryCount !== bundle.variables.length
  ) {
    result.errors.push(
      `manifest.catalogEntryCount (${bundle.manifest.catalogEntryCount}) !== variables.length (${bundle.variables.length})`,
    );
    result.ok = false;
  }

  return result;
}

function main() {
  try {
    const result = validateCatalogDir(CATALOG_OUT_DIR);
    const snapshotErrors = checkSnapshotIntegrity();
    if (snapshotErrors.length > 0) {
      result.errors.push(...snapshotErrors);
      result.ok = false;
    }
    if (!result.ok) {
      const preview = result.errors.slice(0, 25);
      console.error('catalog:validate FAILED — fail-closed (D-05/D-06)');
      for (const err of preview) {
        console.error(`  - ${err}`);
      }
      if (result.errors.length > preview.length) {
        console.error(`  … and ${result.errors.length - preview.length} more`);
      }
      process.exit(1);
    }
    console.log(
      `catalog:validate OK (${CATALOG_OUT_DIR}) — provenance gate passed`,
    );
    process.exit(0);
  } catch (err) {
    console.error('catalog:validate FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
