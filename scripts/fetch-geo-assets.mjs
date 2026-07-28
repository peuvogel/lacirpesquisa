#!/usr/bin/env node
/**
 * Build-time geo asset fetcher (MAP-05).
 *
 * Sources (verified 2026-07-25):
 * - IBGE Malhas API v3: https://servicodados.ibge.gov.br/api/docs/malhas?versao=3
 *   Per-UF municipalities (TopoJSON, qualidade=minima):
 *     GET /api/v3/malhas/estados/{ufIbge}?formato=application/json&qualidade=minima&intrarregiao=municipio
 *   Brazil mesorregiões:
 *     GET /api/v3/malhas/paises/BR?formato=application/json&qualidade=minima&intrarregiao=mesorregiao
 * - IBGE Localidades API v1: https://servicodados.ibge.gov.br/api/docs/localidades?versao=1
 *   Municipality names per UF:
 *     GET /api/v1/localidades/estados/{ufIbge}/municipios
 * - MS/SUS macrorregiões de saúde (MAP-08):
 *   https://dadosabertos.saude.gov.br/dataset/macrorregiao-de-saude
 *   Manual download if portal unreachable; simplify with mapshaper to ≤400 KB target.
 *
 * CI fixtures: muni-29.json + nameTables/muni-BA.json + br-meso.sample.json are committed
 * for offline tests. Full 27-UF set is generated here but may be gitignored except samples.
 *
 * SVG rule (T-01-SVG): strip <script>, on* handlers, foreignObject from any SVG output.
 *
 * Usage: node scripts/fetch-geo-assets.mjs [--uf=29,35] [--all-ufs] [--meso] [--names]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOPO_DIR = path.join(ROOT, 'src/geo/topo');
const NAME_DIR = path.join(ROOT, 'src/geo/nameTables');

/** IBGE UF codes (two-digit) for all 27 federative units. */
const ALL_UF_IBGE = [
  '11', '12', '13', '14', '15', '16', '17',
  '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '31', '32', '33', '35',
  '41', '42', '43',
  '50', '51', '52', '53',
];

const UF_SIGLA_BY_IBGE = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

const IBGE_MALHAS = 'https://servicodados.ibge.gov.br/api/v3/malhas';
const IBGE_LOCALIDADES = 'https://servicodados.ibge.gov.br/api/v1/localidades';

async function ensureDirs() {
  await fs.mkdir(TOPO_DIR, { recursive: true });
  await fs.mkdir(NAME_DIR, { recursive: true });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function fetchMuniTopo(ufIbge) {
  const url = `${IBGE_MALHAS}/estados/${ufIbge}?formato=application/json&qualidade=minima&intrarregiao=municipio`;
  const data = await fetchJson(url);
  const out = path.join(TOPO_DIR, `muni-${ufIbge}.json`);
  await fs.writeFile(out, JSON.stringify(data));
  console.log(`  muni-${ufIbge}.json (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`);
}

async function fetchMeso() {
  const url = `${IBGE_MALHAS}/paises/BR?formato=application/json&qualidade=minima&intrarregiao=mesorregiao`;
  const data = await fetchJson(url);
  await fs.writeFile(path.join(TOPO_DIR, 'br-meso.json'), JSON.stringify(data));
  console.log(`  br-meso.json (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`);
}

async function fetchNameTable(ufIbge) {
  const sigla = UF_SIGLA_BY_IBGE[ufIbge];
  const url = `${IBGE_LOCALIDADES}/estados/${ufIbge}/municipios`;
  const data = await fetchJson(url);
  const table = data.map((m) => {
    const meso = m.microrregiao?.mesorregiao;
    return {
      id: String(m.id),
      nome: m.nome,
      mesoId: meso?.id != null ? String(meso.id) : undefined,
      mesoNome: meso?.nome,
    };
  });
  await fs.writeFile(path.join(NAME_DIR, `muni-${sigla}.json`), JSON.stringify(table));
  console.log(`  muni-${sigla}.json (${table.length} entries)`);
  return table;
}

/** Build mesoCode → municipality IBGE ids (+ labels) from enriched name tables. */
async function writeMesoMembership(allTables) {
  /** @type {Record<string, { label: string, ufSigla: string, municipalityIds: string[] }>} */
  const byMeso = {};
  for (const { sigla, table } of allTables) {
    for (const row of table) {
      if (!row.mesoId) continue;
      if (!byMeso[row.mesoId]) {
        byMeso[row.mesoId] = {
          label: row.mesoNome || `Mesorregião ${row.mesoId}`,
          ufSigla: sigla,
          municipalityIds: [],
        };
      }
      byMeso[row.mesoId].municipalityIds.push(row.id);
    }
  }
  const out = path.join(ROOT, 'src/geo/mesoMembership.json');
  await fs.writeFile(out, `${JSON.stringify(byMeso, null, 2)}\n`);
  console.log(`  mesoMembership.json (${Object.keys(byMeso).length} mesorregiões)`);
}

function parseArgs(argv) {
  const opts = { ufs: [], allUfs: false, meso: false, names: false };
  for (const arg of argv) {
    if (arg === '--all-ufs') opts.allUfs = true;
    else if (arg === '--meso') opts.meso = true;
    else if (arg === '--names') opts.names = true;
    else if (arg.startsWith('--uf=')) opts.ufs.push(...arg.slice(5).split(','));
  }
  if (!opts.allUfs && opts.ufs.length === 0 && !opts.meso && !opts.names) {
    opts.ufs = ['29'];
    opts.meso = true;
    opts.names = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await ensureDirs();

  console.log('Fetching geo assets…');

  const ufList = opts.allUfs ? ALL_UF_IBGE : opts.ufs;
  const nameTables = [];

  for (const ufIbge of ufList) {
    await fetchMuniTopo(ufIbge);
    if (opts.names) {
      const table = await fetchNameTable(ufIbge);
      nameTables.push({ sigla: UF_SIGLA_BY_IBGE[ufIbge], table });
    }
  }

  if (opts.names) {
    // When only refreshing names for a subset, still merge with existing tables for membership.
    if (!opts.allUfs && nameTables.length < ALL_UF_IBGE.length) {
      for (const ufIbge of ALL_UF_IBGE) {
        const sigla = UF_SIGLA_BY_IBGE[ufIbge];
        if (nameTables.some((t) => t.sigla === sigla)) continue;
        try {
          const raw = await fs.readFile(path.join(NAME_DIR, `muni-${sigla}.json`), 'utf8');
          nameTables.push({ sigla, table: JSON.parse(raw) });
        } catch {
          /* missing table — skip */
        }
      }
    }
    await writeMesoMembership(nameTables);
  }

  if (opts.meso) await fetchMeso();

  console.log('\nHealth macro-region shapefile:');
  console.log('  Manual step — download from https://dadosabertos.saude.gov.br/dataset/macrorregiao-de-saude');
  console.log('  Simplify with mapshaper: mapshaper -i input.shp -simplify 10% -o format=topojson output.json');
  console.log('  Target: src/geo/topo/health-macro.json (≤400 KB)');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
