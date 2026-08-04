/**
 * Upsert completed coleta_sih_multi CSVs into Supabase sih_metric_uf / sih_metric_muni.
 *
 * Requires env:
 *   SUPABASE_URL=https://hmfbxqemububjyhdckrj.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage:
 *   node scripts/catalog/uploadSihToSupabase.mjs
 *   node scripts/catalog/uploadSihToSupabase.mjs --disease varizes_mmii
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsvUtf8Sig } from './parseCsv.mjs';
import { assertNotTombstone } from './tombstones.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'trabalhos datasus/outputs/coleta_sih_multi');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const only = process.argv.includes('--disease')
  ? process.argv[process.argv.indexOf('--disease') + 1]
  : null;

function rowsFromCsv(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return [];
  const { rows } = readCsvUtf8Sig(filePath);
  return rows;
}

/** Refuse to upsert any row whose disease_id is a tombstone (D-06). */
function assertNoTombstoneRows(rows, contexto) {
  for (const row of rows) {
    assertNotTombstone(row.disease_id, contexto);
  }
}

async function upsert(table, rows, onConflict) {
  if (rows.length === 0) return 0;
  const chunk = 500;
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const body = rows.slice(i, i + chunk);
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${table} upsert failed: ${res.status} ${t}`);
    }
    n += body.length;
  }
  return n;
}

const dirs = fs
  .readdirSync(OUT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((id) => !only || id === only);

for (const diseaseId of dirs) {
  assertNotTombstone(
    diseaseId,
    `nome de diretorio de coleta trabalhos datasus/outputs/coleta_sih_multi/${diseaseId}`,
  );

  const metaPath = path.join(OUT, diseaseId, 'metadata.json');
  const ufPath = path.join(OUT, diseaseId, `base_${diseaseId}_uf_2013_2025.csv`);
  const muniPath = path.join(OUT, diseaseId, `base_${diseaseId}_muni_2013_2025.csv`);
  if (!fs.existsSync(metaPath) || !fs.existsSync(ufPath)) continue;

  const ufRows = rowsFromCsv(ufPath).map((r) => ({
    disease_id: diseaseId,
    uf_codigo: String(r.uf_codigo ?? '').padStart(2, '0'),
    uf: r.uf,
    uf_nome: r.uf_nome ?? null,
    ano: Number(r.ano),
    internacoes: r.internacoes != null ? Number(r.internacoes) : null,
    obitos: r.obitos != null ? Number(r.obitos) : null,
    valor_total: r.valor_total != null ? Number(r.valor_total) : null,
    dias_permanencia: r.dias_permanencia != null ? Number(r.dias_permanencia) : null,
    taxa_mortalidade: r.taxa_mortalidade != null ? Number(r.taxa_mortalidade) : null,
  }));

  const muniRows = rowsFromCsv(muniPath).map((r) => ({
    disease_id: diseaseId,
    municipio_codigo: String(r.municipio_codigo ?? '').padStart(6, '0'),
    municipio_nome: r.municipio_nome ?? null,
    uf_codigo: String(r.uf_codigo ?? '').padStart(2, '0'),
    ano: Number(r.ano),
    internacoes: r.internacoes != null ? Number(r.internacoes) : null,
    obitos: r.obitos != null ? Number(r.obitos) : null,
    valor_total: r.valor_total != null ? Number(r.valor_total) : null,
    dias_permanencia: r.dias_permanencia != null ? Number(r.dias_permanencia) : null,
    taxa_mortalidade: r.taxa_mortalidade != null ? Number(r.taxa_mortalidade) : null,
  }));

  assertNoTombstoneRows(ufRows, 'upsert sih_metric_uf');
  assertNoTombstoneRows(muniRows, 'upsert sih_metric_muni');

  const nu = await upsert('sih_metric_uf', ufRows, 'disease_id,uf_codigo,ano');
  const nm = await upsert('sih_metric_muni', muniRows, 'disease_id,municipio_codigo,ano');
  console.log(`${diseaseId}: uf=${nu} muni=${nm}`);
}

console.log('uploadSihToSupabase: done');
