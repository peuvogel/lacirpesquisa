/**
 * Sync full TabNet SIH Lista Morb CID-10 into diseases.json + diseases.lista.json.
 *
 * Usage: node scripts/catalog/sync-lista-morb.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TABNET_URL = 'http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def';

/** Preserve pack-compatible ids for diseases already scraped. */
const KNOWN_BY_CODE = {
  183: 'embolia_trombose',
  185: 'varizes_mmii',
  179: 'aneurisma_aorta',
  163: 'avc',
  164: 'ait',
  178: 'doencas_arterias',
  190: 'outras_doencas_vasculares',
  182: 'embolia_pulmonar',
  184: 'flebites_tromboflebites',
  175: 'hipertensao',
  176: 'angina_pectoris',
  177: 'infarto_agudo',
  180: 'outras_doencas_arteriais',
  181: 'aterosclerose',
  186: 'hemorroidas',
  187: 'outras_doencas_veias',
  188: 'linfedema',
  189: 'hipotensao',
  172: 'febre_reumatica',
  173: 'doencas_reumaticas_cronicas',
  174: 'outras_doencas_coracao',
};

const SKIP_CODES = new Set(['331', '332', '333']);

function slugify(label, code) {
  const s = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .replace(/_+/g, '_');
  return s || `lista_${code}`;
}

function decodeEntities(text) {
  return text
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

const html = await (await fetch(TABNET_URL)).text();
const blockMatch = html.match(
  /<select[^>]*name=["']SLista_Morb__CID-10["'][^>]*>([\s\S]*?)<\/select>/i,
);
if (!blockMatch) throw new Error('SLista_Morb__CID-10 select not found in TabNet HTML');

const opts = [...blockMatch[1].matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)/gi)];
const out = [];
const seen = new Set();

for (const [, codeRaw, labelRaw] of opts) {
  const code = String(codeRaw).trim();
  const label = decodeEntities(labelRaw).replace(/\s+/g, ' ').trim();
  if (!code || SKIP_CODES.has(code) || /^todas/i.test(label) || code.startsWith('TODAS')) continue;
  let id = KNOWN_BY_CODE[code] ?? slugify(label, code);
  if (seen.has(id)) id = `${id}_${code}`;
  seen.add(id);
  out.push({
    id,
    label,
    filterKind: 'lista_morb',
    tabnetCode: code,
    def: 'sih/cnv/nibr.def',
  });
}

out.push({
  id: 'amputacao_mmii',
  label: 'Amputação / desarticulação de membros inferiores',
  filterKind: 'procedimento',
  tabnetCode: '3331',
  def: 'sih/cnv/qibr.def',
});

const diseasesPath = path.join(ROOT, 'scripts/catalog/diseases.json');
fs.writeFileSync(diseasesPath, `${JSON.stringify(out, null, 2)}\n`);

const cidMapPath = path.join(ROOT, 'scripts/catalog/lista-morb-cid.json');
const cidById = fs.existsSync(cidMapPath)
  ? JSON.parse(fs.readFileSync(cidMapPath, 'utf8'))
  : {};

const runtime = out.map((d) => ({
  id: d.id,
  label: d.label,
  filterKind: d.filterKind,
  tabnetCode: d.tabnetCode,
  cid: d.filterKind === 'lista_morb' ? (cidById[d.id] ?? null) : null,
  packId: `sih.${d.id}_uf`,
  domain: d.filterKind === 'lista_morb' ? 'sih_lista_morb' : 'vascular',
}));
fs.writeFileSync(
  path.join(ROOT, 'src/features/catalog/diseases.lista.json'),
  `${JSON.stringify(runtime)}\n`,
);

console.log(`sync-lista-morb: ${out.length} diseases → diseases.json + diseases.lista.json`);
