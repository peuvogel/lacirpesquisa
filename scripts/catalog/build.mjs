#!/usr/bin/env node
/**
 * catalog:build — normaliza os 10 packs (já gerados por `generateSihPacks.mjs`, D-19) em
 * `public/data/catalog/{manifest,variables}.json`. Offline: só lê arquivos locais já escritos
 * (packs/*.json, columnMap.json, reference-seed.json) — nunca toca rede nem o corpus legado de
 * 654 CSVs, aposentado por esta fase (09-13). `build.mjs` não escreve mais `packs/*.json`: quem
 * gera o conteúdo dos packs é só `generateSihPacks.mjs`, para não haver dois escritores do mesmo
 * arquivo com formatações potencialmente diferentes.
 */

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOG_OUT_DIR } from './paths.mjs';
import { PACK_IDS } from './generateSihPacks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_VERSION = '1.0.0';
const PERIOD = '2013–2025';
const GRAIN = 'uf_ano';
const KEYS = ['uf_codigo', 'uf', 'ano'];

/** URLs oficiais do TabNet/CNES/SIDRA por `sourceKey` de `columnMap.json` — substitui os antigos
 * `metadata.json` por doença do corpus de 654 CSVs (D-19 aposenta esse corpus como entrada de
 * build). Mesmos endpoints que aqueles arquivos apontavam, centralizados aqui em vez de
 * duplicados em 654 arquivos. */
const SOURCE_URLS = {
  sih: 'http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/qibr.def',
  sih_morbidade_local_internacao: 'http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def',
  cnes: 'http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/prid02br.def',
  sidra_6579: 'https://sidra.ibge.gov.br/tabela/6579',
};

/** Os 2 packs legados carregam colunas de junção CNES/população congeladas (D-19/09-13 —
 * `generateSihPacks.mjs` documenta o porquê); a nota de metodologia continua honesta sobre isso. */
const LEGACY_PACK_IDS = new Set(['sih.embolia_e_trombose_arteriais_uf', 'sih.amputacao_mmii_uf']);

const GENERIC_METHODOLOGY_NOTE =
  'Agregado do microdado SIH-RD (pysus, RD{UF}{AAMM}.dbc, filtrado por IDENT=1) pelo pipeline da ' +
  'Fase 9, reconciliado contra o TabNet (SC-7) e substituído atomicamente ao dado TabNet legado ' +
  '(D-16). Grão UF, local de ocorrência. Ausência de linha para um território com coleta ' +
  'concluída é zero verdadeiro medido, nunca uma falha de coleta silenciosa (D-14).';

const LEGACY_METHODOLOGY_NOTE =
  `${GENERIC_METHODOLOGY_NOTE} Colunas de médicos vasculares SUS (CNES) e população residente ` +
  '(SIDRA) são congeladas da coleta da Fase 5 — fonte alheia ao pipeline SIH-RD desta fase, não ' +
  'recoletada aqui. População 2023 sem denominador oficial nesta regra: taxas/densidades ficam ' +
  'null (UI: n/d).';

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

function resolveOfficialUrl(sourceKey) {
  return SOURCE_URLS[sourceKey] ?? 'https://datasus.saude.gov.br/';
}

function buildLoadableEntries(columnMap, packId, rows) {
  const packColumns = columnMap[packId] || {};
  const methodologyNotes = LEGACY_PACK_IDS.has(packId)
    ? LEGACY_METHODOLOGY_NOTE
    : GENERIC_METHODOLOGY_NOTE;
  const entries = [];
  for (const [columnKey, seed] of Object.entries(packColumns)) {
    const { yearsAvailable, nullYears } = columnYears(rows, columnKey);
    const officialUrl = resolveOfficialUrl(seed.sourceKey);
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
      methodologyNotes,
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

async function atomicWriteCatalog(files) {
  const tmpRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'lacir-catalog-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const dest = path.join(tmpRoot, rel);
      await fsPromises.mkdir(path.dirname(dest), { recursive: true });
      await fsPromises.writeFile(dest, content, 'utf8');
    }
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

  const manifestPacks = [];
  /** @type {Record<string, unknown>[]} */
  const variables = [];
  const seenIds = new Set();
  const derivedAts = new Set();

  for (const packId of PACK_IDS) {
    const packPath = path.join(CATALOG_OUT_DIR, 'packs', `${packId}.json`);
    if (!fs.existsSync(packPath)) {
      throw new Error(
        `catalog:build: pack ausente "${packId}" — rode "npm run catalog:sih-packs" antes de "catalog:build" (D-19).`,
      );
    }
    const pack = loadJson(packPath);
    if (typeof pack.derivedAt === 'string' && pack.derivedAt) derivedAts.add(pack.derivedAt);
    const years = yearsFromRows(pack.rows);
    manifestPacks.push({
      packId,
      grain: GRAIN,
      sourceDir: 'supabase:sih_metric_uf (PostgREST, D-19)',
      rowCount: pack.rows.length,
      years,
      keys: KEYS,
    });
    for (const entry of buildLoadableEntries(columnMap, packId, pack.rows)) {
      if (seenIds.has(entry.id)) {
        throw new Error(`Duplicate catalog id: ${entry.id}`);
      }
      seenIds.add(entry.id);
      variables.push(entry);
    }
  }

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

  // generatedAt vem da proveniência dos próprios packs (derivedAt, DATA-04), nunca de
  // `Date.now()` — um `new Date().toISOString()` aqui tornaria `catalog:build` não-idempotente
  // (rodar duas vezes sobre os MESMOS packs teria que produzir o MESMO manifest.json byte a
  // byte; achado desta task, corrigido antes do commit — Rule 1). Todo pack vem da MESMA corrida
  // de `generateSihPacks.mjs`, então um único `derivedAt` é esperado; mais de um indicaria packs
  // gerados em corridas diferentes, o que já seria uma inconsistência de proveniência real.
  if (derivedAts.size > 1) {
    throw new Error(
      `catalog:build: packs com derivedAt divergente (${[...derivedAts].join(', ')}) — gere todos os 10 na mesma corrida de generateSihPacks.mjs antes de rodar catalog:build.`,
    );
  }
  const generatedAt = derivedAts.size === 1 ? [...derivedAts][0] : new Date(0).toISOString();

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

  await atomicWriteCatalog(files);

  console.log(
    `catalog:build ok — entries=${variables.length} packs=${manifestPacks.length} out=${path.relative(process.cwd(), CATALOG_OUT_DIR)}`,
  );
  for (const p of manifestPacks) {
    console.log(`  ${p.packId}: rows=${p.rowCount} years=${p.years[0]}–${p.years[p.years.length - 1]}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
