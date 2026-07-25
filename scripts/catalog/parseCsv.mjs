/**
 * UTF-8-SIG CSV reader for coleta bases (comma-delimited, no quoted commas).
 * Empty cells → null. Never invent numeric values.
 */

import fs from 'node:fs';

/** Metric / numeric columns expected across embolia + amputação bases. */
const KNOWN_NUMERIC_COLUMNS = new Set([
  'ano',
  'medicos_vasculares_sus',
  'populacao',
  'medicos_vasculares_por_100k',
  'internacoes_embolia_trombose_arteriais',
  'obitos_embolia_trombose_arteriais',
  'dias_permanencia_embolia_trombose_arteriais',
  'taxa_mortalidade_pct',
  'media_permanencia_calculada',
  'taxa_internacao_por_100k',
  'internacoes_amputacao_mmii',
  'obitos_amputacao_mmii',
  'taxa_mortalidade_sih_pct',
  'letalidade_calculada_pct',
  'taxa_internacao_amputacao_mmii_por_100k',
]);

/**
 * @param {string} filePath absolute path to CSV
 * @returns {{ headers: string[], rows: Record<string, string|number|null>[] }}
 */
export function readCsvUtf8Sig(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error(`readCsvUtf8Sig: empty file ${filePath}`);
  }
  const headers = lines[0].split(',').map((h) => h.trim());
  if (headers[0] !== 'uf_codigo') {
    throw new Error(
      `readCsvUtf8Sig: expected first header uf_codigo after BOM strip, got ${JSON.stringify(headers[0])}`,
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length === 1 && cells[0] === '') continue;
    /** @type {Record<string, string|number|null>} */
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      const raw = cells[c] === undefined ? '' : cells[c].trim();
      if (raw === '') {
        row[key] = null;
        continue;
      }
      if (KNOWN_NUMERIC_COLUMNS.has(key) || key === 'ano') {
        const n = Number(raw);
        row[key] = Number.isFinite(n) ? n : null;
      } else {
        row[key] = raw;
      }
    }
    rows.push(row);
  }
  return { headers, rows };
}
