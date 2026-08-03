/**
 * Pure parser + versioned snapshot for the TabNet SIH Lista Morb CID-10 source (D-09/D-13).
 *
 * `catalog:validate` (chained in pretest/test:run/gate) reads only the committed snapshot
 * under `scripts/catalog/snapshot/` — no network access on that path. The only path that
 * touches the network is the explicit `--refresh` capture below, invoked via
 * `npm run catalog:snapshot`.
 *
 * Usage: node scripts/catalog/listaMorbSource.mjs --refresh
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TABNET_URL = 'http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def';

export const SNAPSHOT_DIR = path.join(ROOT, 'scripts/catalog/snapshot');
export const SNAPSHOT_HTML_PATH = path.join(SNAPSHOT_DIR, 'lista-morb.nibr.html');
export const SNAPSHOT_EXTRACT_PATH = path.join(SNAPSHOT_DIR, 'lista-morb.extract.json');

const MIN_EXPECTED_OPTIONS = 300;

/**
 * @param {string} label
 * @param {string} code
 * @returns {string}
 */
export function slugify(label, code) {
  const s = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .replace(/_+/g, '_');
  return s || `lista_${code}`;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function decodeEntities(text) {
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

/**
 * Parse the `<select name="SLista_Morb__CID-10">` block into `{ code, label }` pairs,
 * in document order, labels decoded and whitespace-collapsed. No filtering applied here —
 * the pseudo-option `TODAS_AS_CATEGORIAS__` and every real code (including 330-333) come
 * through untouched. Filtering/partitioning is the generator's job, not the parser's.
 *
 * @param {string} html
 * @returns {{ code: string, label: string }[]}
 */
export function parseListaMorbOptions(html) {
  const blockMatch = html.match(
    /<select[^>]*name=["']SLista_Morb__CID-10["'][^>]*>([\s\S]*?)<\/select>/i,
  );
  if (!blockMatch) {
    throw new Error('parseListaMorbOptions: SLista_Morb__CID-10 select not found in HTML');
  }
  const opts = [...blockMatch[1].matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)/gi)];
  return opts.map(([, codeRaw, labelRaw]) => ({
    code: String(codeRaw).trim(),
    label: decodeEntities(String(labelRaw)).replace(/\s+/g, ' ').trim(),
  }));
}

/**
 * Read the committed snapshot pair. HTML is read as ISO-8859-1 (`latin1`) — the source
 * declares `charset=iso-8859-1`; reading as utf8 silently corrupts every accented label.
 *
 * @returns {{ html: string, htmlBuffer: Buffer, extract: { source: string, capturedAt: string, sha256: string, options: { code: string, label: string }[] } }}
 */
export function loadSnapshot() {
  const htmlBuffer = fs.readFileSync(SNAPSHOT_HTML_PATH);
  const html = htmlBuffer.toString('latin1');
  const extract = JSON.parse(fs.readFileSync(SNAPSHOT_EXTRACT_PATH, 'utf8'));
  return { html, htmlBuffer, extract };
}

/**
 * Invariante C (D-13): parse(html) === extrato. Recomputes the sha256 of the committed
 * HTML and compares against the extract's recorded sha256, then re-parses the HTML and
 * compares against the extract's options pairwise (same length, order, code, label).
 * Never throws, never exits — always returns an array of PT-BR messages, `"snapshot: ..."`.
 *
 * @returns {string[]}
 */
export function checkSnapshotIntegrity() {
  /** @type {string[]} */
  const errors = [];

  let html, htmlBuffer, extract;
  try {
    ({ html, htmlBuffer, extract } = loadSnapshot());
  } catch (err) {
    return [
      `snapshot: falha ao carregar arquivos do snapshot — ${err instanceof Error ? err.message : err}`,
    ];
  }

  const actualSha256 = crypto.createHash('sha256').update(htmlBuffer).digest('hex');
  if (typeof extract?.sha256 !== 'string' || actualSha256 !== extract.sha256) {
    errors.push(
      `snapshot: sha256 do HTML (${actualSha256}) diverge do extrato (${extract?.sha256 ?? '(ausente)'}) — snapshot adulterado`,
    );
  }

  let reparsed;
  try {
    reparsed = parseListaMorbOptions(html);
  } catch (err) {
    errors.push(
      `snapshot: falha ao re-parsear o HTML commitado — ${err instanceof Error ? err.message : err}`,
    );
    return errors;
  }

  const extractOptions = Array.isArray(extract?.options) ? extract.options : [];
  if (reparsed.length !== extractOptions.length) {
    errors.push(
      `snapshot: numero de opcoes divergente — HTML re-parseado tem ${reparsed.length}, extrato tem ${extractOptions.length}`,
    );
  } else {
    for (let i = 0; i < reparsed.length; i++) {
      const fromHtml = reparsed[i];
      const fromExtract = extractOptions[i];
      const mismatch =
        !fromExtract ||
        fromHtml.code !== fromExtract.code ||
        fromHtml.label !== fromExtract.label;
      if (mismatch) {
        errors.push(
          `snapshot: opcao no indice ${i} diverge — HTML tem code="${fromHtml.code}" label="${fromHtml.label}", extrato tem ${
            fromExtract
              ? `code="${fromExtract.code}" label="${fromExtract.label}"`
              : '(ausente)'
          }`,
        );
      }
    }
  }

  return errors;
}

/**
 * `--refresh` capture: fetches the live TabNet source, validates it, and overwrites the
 * committed snapshot pair. Fail-closed — never writes an empty/partial snapshot (same
 * defect class as PIPE-01). This is the ONLY function in this module that touches the
 * network, and it only runs behind explicit `--refresh` on direct CLI invocation.
 */
async function captureSnapshot() {
  console.log(`listaMorbSource --refresh: fetching ${TABNET_URL} ...`);

  let res;
  try {
    res = await fetch(TABNET_URL);
  } catch (err) {
    console.error(
      `listaMorbSource --refresh FAILED: fetch error — ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
    return;
  }
  if (!res.ok) {
    console.error(`listaMorbSource --refresh FAILED: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
    return;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const html = buffer.toString('latin1');

  let options;
  try {
    options = parseListaMorbOptions(html);
  } catch (err) {
    console.error(
      `listaMorbSource --refresh FAILED: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
    return;
  }

  if (options.length < MIN_EXPECTED_OPTIONS) {
    console.error(
      `listaMorbSource --refresh FAILED: only ${options.length} options parsed (< ${MIN_EXPECTED_OPTIONS}) — refusing to write a partial snapshot`,
    );
    process.exit(1);
    return;
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const extract = {
    source: TABNET_URL,
    capturedAt: new Date().toISOString(),
    sha256,
    options,
  };

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(SNAPSHOT_HTML_PATH, buffer);
  fs.writeFileSync(SNAPSHOT_EXTRACT_PATH, `${JSON.stringify(extract, null, 2)}\n`);

  console.log(
    `listaMorbSource --refresh OK: ${options.length} options captured → ${SNAPSHOT_HTML_PATH}, ${SNAPSHOT_EXTRACT_PATH}`,
  );
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  if (process.argv.includes('--refresh')) {
    await captureSnapshot();
  } else {
    console.log(
      'listaMorbSource: no action taken. Use --refresh to capture a new snapshot from TabNet (network access, never run automatically — D-09).',
    );
  }
}
