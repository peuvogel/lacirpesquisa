#!/usr/bin/env node
/**
 * catalog:build — normalize coleta CSVs → public/data/catalog/*
 * Offline only: reads allowlisted local corpus files (no TABNET/IBGE network).
 */

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATALOG_OUT_DIR,
  CORPUS_DIR,
  PACK_SOURCES,
  ROOT,
  corpusPath,
} from './paths.mjs';
import { readCsvUtf8Sig } from './parseCsv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_VERSION = '1.0.0';
const PERIOD = '2013–2025';
const GRAIN = 'uf_ano';
const KEYS = ['uf_codigo', 'uf', 'ano'];

/** Columns carried in packs for join but not emitted as separate catalog entries when shared. */
const SHARED_METRIC_KEYS = [
  'medicos_vasculares_sus',
  'populacao',
  'medicos_vasculares_por_100k',
];

const TEXT_SKIP = new Set([
  'lista_morb_cid10',
  'metodo_sih',
  'populacao_fonte',
  'cnes_competencia',
  'procedimento_sih',
  'uf_nome',
]);

function loadJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function yearsFromRows(rows) {
  return [...new Set(rows.map((r) => r.ano).filter((y) => y != null))].sort(
    (a, b) => a - b,
  );
}

function columnYears(rows, columnKey) {
  const available = new Set();
  const nullYears = new Set();
  for (const row of rows) {
    const y = row.ano;
    if (y == null) continue;
    if (row[columnKey] == null) nullYears.add(y);
    else available.add(y);
  }
  // nullYears only when every UF for that year is null (or at least the year has nulls and no values)
  const yearsWithAnyValue = available;
  const yearsFullyNull = [...nullYears]
    .filter((y) => !yearsWithAnyValue.has(y))
    .sort((a, b) => a - b);
  return {
    yearsAvailable: [...yearsWithAnyValue].sort((a, b) => a - b),
    nullYears: yearsFullyNull,
  };
}

function resolveOfficialUrl(metadata, sourceKey, fallback) {
  const sources = metadata.sources || {};
  if (sourceKey && sources[sourceKey]) return sources[sourceKey];
  if (sourceKey === 'sidra_6579' && sources.sidra_6579) return sources.sidra_6579;
  return fallback || Object.values(sources)[0] || 'https://datasus.saude.gov.br/';
}

function methodologyFromMetadata(metadata, extra = '') {
  const notes = Array.isArray(metadata.notes) ? metadata.notes : [];
  const base = notes.join(' ');
  const gap =
    ' População 2023 sem denominador oficial nesta regra: taxas/densidades ficam null (UI: n/d).';
  const needsGap = /2023/.test(base) ? '' : gap;
  return (base + needsGap + (extra ? ` ${extra}` : '')).trim();
}

function buildPack(packId, metricKeys, rows) {
  const packRows = rows.map((row) => {
    /** @type {Record<string, string|number|null>} */
    const out = {
      uf_codigo: row.uf_codigo == null ? null : String(row.uf_codigo),
      uf: row.uf == null ? null : String(row.uf),
      uf_nome: row.uf_nome == null ? null : String(row.uf_nome),
      ano: row.ano,
    };
    for (const key of metricKeys) {
      out[key] = row[key] === undefined ? null : row[key];
    }
    return out;
  });
  return {
    packId,
    grain: GRAIN,
    keys: KEYS,
    metricKeys,
    rows: packRows,
  };
}

function buildLoadableEntries(columnMap, packId, metadata, rows) {
  const packColumns = columnMap[packId] || {};
  const entries = [];
  for (const [columnKey, seed] of Object.entries(packColumns)) {
    const { yearsAvailable, nullYears } = columnYears(rows, columnKey);
    const officialUrl = resolveOfficialUrl(
      metadata,
      seed.sourceKey,
      seed.officialUrl,
    );
    /** @type {Record<string, unknown>} */
    const entry = {
      id: seed.id,
      label: seed.label,
      variableType: seed.variableType,
      domain: seed.domain,
      sourceSystem: seed.sourceSystem,
      sourceName: seed.sourceName,
      tableOrIndicator: seed.tableOrIndicator,
      period: PERIOD,
      officialUrl,
      methodologyNotes: methodologyFromMetadata(metadata),
      loadable: true,
      packId,
      columnKey,
      grain: GRAIN,
    };
    if (seed.unit) entry.unit = seed.unit;
    if (Array.isArray(seed.aliases) && seed.aliases.length) {
      entry.aliases = seed.aliases;
    }
    if (yearsAvailable.length) entry.yearsAvailable = yearsAvailable;
    if (nullYears.length) entry.nullYears = nullYears;
    entries.push(entry);
  }
  return entries;
}

function metricKeysForPack(columnMap, packId, csvHeaders, includeShared) {
  const mapped = Object.keys(columnMap[packId] || {});
  const keys = [];
  if (includeShared) {
    for (const k of SHARED_METRIC_KEYS) {
      if (csvHeaders.includes(k)) keys.push(k);
    }
  }
  for (const k of mapped) {
    if (!keys.includes(k) && csvHeaders.includes(k) && !TEXT_SKIP.has(k)) {
      keys.push(k);
    }
  }
  // Also include shared on amputação for join convenience even if not in columnMap
  if (includeShared === false) {
    for (const k of SHARED_METRIC_KEYS) {
      if (csvHeaders.includes(k) && !keys.includes(k)) keys.push(k);
    }
  }
  return keys;
}

async function atomicWriteCatalog(files) {
  const tmpRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'lacir-catalog-'));
  try {
    await fsPromises.mkdir(path.join(tmpRoot, 'packs'), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      const dest = path.join(tmpRoot, rel);
      await fsPromises.mkdir(path.dirname(dest), { recursive: true });
      await fsPromises.writeFile(dest, content, 'utf8');
    }
    await fsPromises.mkdir(path.join(CATALOG_OUT_DIR, 'packs'), { recursive: true });
    for (const rel of Object.keys(files)) {
      const from = path.join(tmpRoot, rel);
      const to = path.join(CATALOG_OUT_DIR, rel);
      await fsPromises.rename(from, to).catch(async () => {
        // Cross-device rename fallback
        await fsPromises.copyFile(from, to);
        await fsPromises.unlink(from);
      });
    }
  } finally {
    await fsPromises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const columnMap = loadJson(path.join(__dirname, 'columnMap.json'));
  const referenceSeed = loadJson(path.join(__dirname, 'reference-seed.json'));
  if (!Array.isArray(referenceSeed)) {
    throw new Error('reference-seed.json must be an array');
  }

  const packFiles = {};
  const manifestPacks = [];
  /** @type {Record<string, unknown>[]} */
  const variables = [];
  const seenIds = new Set();

  // 1) Embolia first (primary for shared CNES/pop catalog ids)
  {
    const packId = 'sih.embolia_e_trombose_arteriais_uf';
    const src = PACK_SOURCES[packId];
    const csvPath = corpusPath(src.csv);
    const metaPath = corpusPath(src.metadata);
    const metadata = loadJson(metaPath);
    const { headers, rows } = readCsvUtf8Sig(csvPath);
    if (rows.length !== 351) {
      throw new Error(`${packId}: expected 351 rows, got ${rows.length}`);
    }
    const metricKeys = metricKeysForPack(columnMap, packId, headers, true);
    packFiles[packId] = buildPack(packId, metricKeys, rows);
    const years = yearsFromRows(rows);
    manifestPacks.push({
      packId,
      grain: GRAIN,
      sourceDir: path.relative(ROOT, path.join(CORPUS_DIR, src.sourceDir)),
      rowCount: rows.length,
      years,
      keys: KEYS,
    });
    for (const entry of buildLoadableEntries(columnMap, packId, metadata, rows)) {
      if (seenIds.has(entry.id)) {
        throw new Error(`Duplicate catalog id: ${entry.id}`);
      }
      seenIds.add(entry.id);
      variables.push(entry);
    }
  }

  // 2) Amputação — loadables only for amputação-specific columns; shared stay on embolia
  {
    const packId = 'sih.amputacao_mmii_uf';
    const src = PACK_SOURCES[packId];
    const csvPath = corpusPath(src.csv);
    const metaPath = corpusPath(src.metadata);
    const metadata = loadJson(metaPath);
    const { headers, rows } = readCsvUtf8Sig(csvPath);
    if (rows.length !== 351) {
      throw new Error(`${packId}: expected 351 rows, got ${rows.length}`);
    }
    const metricKeys = metricKeysForPack(columnMap, packId, headers, false);
    packFiles[packId] = buildPack(packId, metricKeys, rows);
    const years = yearsFromRows(rows);
    manifestPacks.push({
      packId,
      grain: GRAIN,
      sourceDir: path.relative(ROOT, path.join(CORPUS_DIR, src.sourceDir)),
      rowCount: rows.length,
      years,
      keys: KEYS,
    });
    for (const entry of buildLoadableEntries(columnMap, packId, metadata, rows)) {
      if (seenIds.has(entry.id)) {
        throw new Error(`Duplicate catalog id: ${entry.id}`);
      }
      seenIds.add(entry.id);
      variables.push(entry);
    }
  }

  // 3) Multi-disease packs (optional — skip when scrape CSV not ready yet)
  const multiPackIds = Object.keys(PACK_SOURCES).filter(
    (id) => id !== 'sih.embolia_e_trombose_arteriais_uf' && id !== 'sih.amputacao_mmii_uf',
  );
  for (const packId of multiPackIds) {
    const src = PACK_SOURCES[packId];
    if (!src) continue;
    let csvPath;
    let metaPath;
    try {
      csvPath = corpusPath(src.csv);
      metaPath = corpusPath(src.metadata);
    } catch {
      console.warn(`catalog:build skip ${packId}: path not allowlisted`);
      continue;
    }
    if (!fs.existsSync(csvPath) || !fs.existsSync(metaPath)) {
      console.warn(`catalog:build skip ${packId}: scrape CSV/metadata missing`);
      continue;
    }
    const metadata = loadJson(metaPath);
    const { headers, rows } = readCsvUtf8Sig(csvPath);
    if (rows.length === 0) {
      console.warn(`catalog:build skip ${packId}: empty CSV`);
      continue;
    }
    const metricKeys = metricKeysForPack(columnMap, packId, headers, false);
    packFiles[packId] = buildPack(packId, metricKeys, rows);
    const years = yearsFromRows(rows);
    manifestPacks.push({
      packId,
      grain: GRAIN,
      sourceDir: path.relative(ROOT, path.join(CORPUS_DIR, src.sourceDir)),
      rowCount: rows.length,
      years,
      keys: KEYS,
    });
    for (const entry of buildLoadableEntries(columnMap, packId, metadata, rows)) {
      if (seenIds.has(entry.id)) {
        throw new Error(`Duplicate catalog id: ${entry.id}`);
      }
      seenIds.add(entry.id);
      variables.push(entry);
    }
  }

  // 4) Reference seed
  for (const entry of referenceSeed) {
    if (!entry || typeof entry.id !== 'string') {
      throw new Error('reference-seed entry missing id');
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate catalog id from reference-seed: ${entry.id}`);
    }
    if (entry.loadable !== false) {
      throw new Error(`reference-seed ${entry.id} must have loadable:false`);
    }
    seenIds.add(entry.id);
    variables.push(entry);
  }

  const generatedAt = new Date().toISOString();
  const manifest = {
    version: CATALOG_VERSION,
    generatedAt,
    catalogEntryCount: variables.length,
    packs: manifestPacks,
  };

  const files = {
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'variables.json': `${JSON.stringify(variables, null, 2)}\n`,
  };
  for (const [packId, pack] of Object.entries(packFiles)) {
    files[`packs/${packId}.json`] = `${JSON.stringify(pack, null, 2)}\n`;
  }

  await atomicWriteCatalog(files);

  console.log(
    `catalog:build ok — entries=${variables.length} packs=${manifestPacks.length} out=${path.relative(ROOT, CATALOG_OUT_DIR)}`,
  );
  for (const p of manifestPacks) {
    console.log(`  ${p.packId}: rows=${p.rowCount} years=${p.years[0]}–${p.years[p.years.length - 1]}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
