#!/usr/bin/env node
/**
 * Merge coleta_sih_multi columns (valor_total, dias_permanencia, …)
 * into legacy embolia / amputação base CSVs for catalog:build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsvUtf8Sig } from './parseCsv.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CORPUS = path.join(ROOT, 'trabalhos datasus');

const JOBS = [
  {
    multiCsv: 'outputs/coleta_sih_multi/embolia_trombose/base_embolia_trombose_uf_2013_2025.csv',
    legacyCsv:
      'outputs/coleta_embolia_trombose_uf/base_embolia_trombose_arteriais_uf_2013_2025.csv',
    columns: {
      valor_total: 'valor_total',
      dias_permanencia: 'dias_permanencia_embolia_trombose_arteriais',
    },
  },
  {
    multiCsv: 'outputs/coleta_sih_multi/amputacao_mmii/base_amputacao_mmii_uf_2013_2025.csv',
    legacyCsv: 'outputs/coleta_vascular_amputacao/base_analise_vascular_amputacao_2013_2025.csv',
    columns: {
      valor_total: 'valor_total',
      dias_permanencia: 'dias_permanencia',
    },
  },
];

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          if (v == null || v === '') return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') ? `"${s.replaceAll('"', '""')}"` : s;
        })
        .join(','),
    );
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

for (const job of JOBS) {
  const multiPath = path.join(CORPUS, job.multiCsv);
  const legacyPath = path.join(CORPUS, job.legacyCsv);
  if (!fs.existsSync(multiPath) || fs.statSync(multiPath).size === 0) {
    console.warn(`skip: missing/empty ${job.multiCsv}`);
    continue;
  }
  if (!fs.existsSync(legacyPath)) {
    console.warn(`skip: missing ${job.legacyCsv}`);
    continue;
  }

  const multi = readCsvUtf8Sig(multiPath);
  const legacy = readCsvUtf8Sig(legacyPath);
  const byKey = new Map(
    multi.rows.map((r) => [`${r.uf_codigo}|${r.ano}`, r]),
  );

  const newHeaders = [...legacy.headers];
  for (const dest of Object.values(job.columns)) {
    if (!newHeaders.includes(dest)) newHeaders.push(dest);
  }

  const merged = legacy.rows.map((row) => {
    const src = byKey.get(`${row.uf_codigo}|${row.ano}`);
    const out = { ...row };
    if (src) {
      for (const [srcCol, destCol] of Object.entries(job.columns)) {
        if (src[srcCol] != null && src[srcCol] !== '') out[destCol] = src[srcCol];
      }
    }
    return out;
  });

  writeCsv(legacyPath, newHeaders, merged);
  console.log(`merged → ${job.legacyCsv} (+${Object.keys(job.columns).join(', ')})`);
}
