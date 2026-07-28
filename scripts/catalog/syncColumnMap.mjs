/**
 * Ensure columnMap.json has measure entries for every disease in diseases.json.
 * Preserves existing pack/column metadata; fills gaps for mass-scrape packs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const diseases = JSON.parse(fs.readFileSync(path.join(__dirname, 'diseases.json'), 'utf8'));
const columnMapPath = path.join(__dirname, 'columnMap.json');
const columnMap = JSON.parse(fs.readFileSync(columnMapPath, 'utf8'));

const MEASURES = [
  { col: 'internacoes', idSuffix: 'internacoes', labelPrefix: 'Internações', variableType: 'contagem', unit: 'n' },
  { col: 'obitos', idSuffix: 'obitos', labelPrefix: 'Óbitos', variableType: 'contagem', unit: 'n' },
  { col: 'valor_total', idSuffix: 'custo', labelPrefix: 'Custo (valor total)', variableType: 'numerica', unit: 'R$' },
  {
    col: 'dias_permanencia',
    idSuffix: 'dias_permanencia',
    labelPrefix: 'Dias de permanência',
    variableType: 'contagem',
    unit: 'dias',
  },
  {
    col: 'taxa_mortalidade',
    idSuffix: 'taxa_mortalidade',
    labelPrefix: 'Taxa de mortalidade hospitalar',
    variableType: 'taxa',
    unit: '%',
  },
];

function standardColumns(diseaseId, label) {
  const out = {};
  for (const m of MEASURES) {
    out[m.col] = {
      id: `sih.${diseaseId}.${m.idSuffix}`,
      label: `${m.labelPrefix} — ${label}`,
      variableType: m.variableType,
      domain: 'sih_lista_morb',
      unit: m.unit,
      sourceSystem: 'SIH/SUS',
      sourceName: 'Morbidade hospitalar — local de internação',
      tableOrIndicator: 'sih/cnv/nibr.def',
      sourceKey: 'sih_morbidade_local_internacao',
    };
  }
  return out;
}

let added = 0;
for (const disease of diseases) {
  if (disease.id === 'embolia_trombose' || disease.id === 'amputacao_mmii') continue;
  const packId = `sih.${disease.id}_uf`;
  if (!columnMap[packId]) {
    columnMap[packId] = standardColumns(disease.id, disease.label);
    added += 1;
    continue;
  }
  const cols = standardColumns(disease.id, disease.label);
  for (const [key, meta] of Object.entries(cols)) {
    if (!columnMap[packId][key]) {
      columnMap[packId][key] = meta;
      added += 1;
    }
  }
}

fs.writeFileSync(columnMapPath, `${JSON.stringify(columnMap, null, 2)}\n`);
console.log(`syncColumnMap: packs=${Object.keys(columnMap).length} (+${added} column slots)`);
