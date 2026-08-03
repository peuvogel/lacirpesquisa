/**
 * Generate diseases.json + diseases.lista.json from the committed Lista Morb CID-10
 * snapshot (D-09). No network access here — refreshing the snapshot is the exclusive
 * responsibility of `listaMorbSource.mjs --refresh`.
 *
 * Usage: node scripts/catalog/sync-lista-morb.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSnapshot, slugify } from './listaMorbSource.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const EXCLUSIONS_PATH = path.join(ROOT, 'scripts/catalog/exclusions.json');
const EXTRA_DISEASES_PATH = path.join(ROOT, 'scripts/catalog/extra-diseases.json');
const CID_MAP_PATH = path.join(ROOT, 'scripts/catalog/lista-morb-cid.json');
const DISEASES_JSON_PATH = path.join(ROOT, 'scripts/catalog/diseases.json');
const DISEASES_LISTA_JSON_PATH = path.join(ROOT, 'src/features/catalog/diseases.lista.json');

/**
 * Build the canonical `diseases.json` array from the raw snapshot options.
 * Pulls in only what a real Lista Morb category needs — no id dictionary, no
 * regex against the label (D-25). The only path skipped is `code` empty or
 * present in `exclusions`.
 *
 * @param {{
 *   options: { code: string, label: string }[],
 *   exclusions: Record<string, string>,
 *   extras: { id: string, label: string, filterKind: string, tabnetCode: string, def: string, reason?: string }[],
 * }} args
 * @returns {{ id: string, label: string, filterKind: string, tabnetCode: string, def: string }[]}
 */
export function buildDiseases({ options, exclusions, extras }) {
  const out = [];
  const seen = new Map();

  for (const opt of options) {
    const code = String(opt.code).trim();
    const label = String(opt.label).trim();
    if (!code || Object.prototype.hasOwnProperty.call(exclusions, code)) continue;

    const id = slugify(label, code);
    if (seen.has(id)) {
      const other = seen.get(id);
      throw new Error(
        `buildDiseases: colisão de slug "${id}" entre tabnetCode ${other.code} ("${other.label}") e tabnetCode ${code} ("${label}") — decisão humana necessária, nenhum sufixo automático`,
      );
    }
    seen.set(id, { code, label });

    out.push({
      id,
      label,
      filterKind: 'lista_morb',
      tabnetCode: code,
      def: 'sih/cnv/nibr.def',
    });
  }

  for (const extra of extras) {
    out.push({
      id: extra.id,
      label: extra.label,
      filterKind: extra.filterKind,
      tabnetCode: extra.tabnetCode,
      def: extra.def,
    });
  }

  return out;
}

/**
 * Build the minified runtime array (`diseases.lista.json` shape) from the canonical
 * diseases array plus the CID map keyed by `tabnetCode` (D-11).
 *
 * @param {{ id: string, label: string, filterKind: string, tabnetCode: string, def: string }[]} diseases
 * @param {Record<string, string>} cidByCode
 * @returns {{ id: string, label: string, filterKind: string, tabnetCode: string, cid: string | null, packId: string, domain: string }[]}
 */
export function buildRuntimeLista(diseases, cidByCode) {
  return diseases.map((d) => ({
    id: d.id,
    label: d.label,
    filterKind: d.filterKind,
    tabnetCode: d.tabnetCode,
    cid: d.filterKind === 'lista_morb' ? (cidByCode[d.tabnetCode] ?? null) : null,
    packId: `sih.${d.id}_uf`,
    domain: d.filterKind === 'lista_morb' ? 'sih_lista_morb' : 'vascular',
  }));
}

/**
 * @param {ReturnType<typeof buildDiseases>} diseases
 * @returns {string}
 */
export function renderDiseasesJson(diseases) {
  return `${JSON.stringify(diseases, null, 2)}\n`;
}

/**
 * @param {ReturnType<typeof buildRuntimeLista>} runtime
 * @returns {string}
 */
export function renderListaJson(runtime) {
  return `${JSON.stringify(runtime)}\n`;
}

/**
 * Load the committed snapshot + the three data-with-reason input files, build both
 * derived artifacts in memory, and return everything a caller (CLI `main()`,
 * `buildRenameMap.mjs`, vitest) needs — without touching disk beyond the reads.
 *
 * @returns {{
 *   diseases: ReturnType<typeof buildDiseases>,
 *   runtime: ReturnType<typeof buildRuntimeLista>,
 *   diseasesText: string,
 *   listaText: string,
 * }}
 */
export function generateFromSnapshot() {
  const { extract } = loadSnapshot();
  const exclusions = JSON.parse(fs.readFileSync(EXCLUSIONS_PATH, 'utf8'));
  const extras = JSON.parse(fs.readFileSync(EXTRA_DISEASES_PATH, 'utf8'));
  const cidByCode = JSON.parse(fs.readFileSync(CID_MAP_PATH, 'utf8'));

  const diseases = buildDiseases({ options: extract.options, exclusions, extras });
  const runtime = buildRuntimeLista(diseases, cidByCode);

  return {
    diseases,
    runtime,
    diseasesText: renderDiseasesJson(diseases),
    listaText: renderListaJson(runtime),
  };
}

function main() {
  const { diseases, diseasesText, listaText } = generateFromSnapshot();

  fs.writeFileSync(DISEASES_JSON_PATH, diseasesText);
  fs.writeFileSync(DISEASES_LISTA_JSON_PATH, listaText);

  console.log(
    `sync-lista-morb: ${diseases.length} diseases → diseases.json + diseases.lista.json`,
  );
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
