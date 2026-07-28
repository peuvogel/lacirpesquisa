#!/usr/bin/env node
/**
 * Rewrite catalogAnalysisData.ts pack imports from public/data/catalog/packs/*.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACK_DIR = path.join(ROOT, 'public/data/catalog/packs');
const TARGET = path.join(ROOT, 'src/features/catalog/catalogAnalysisData.ts');

function toAlias(packId) {
  return (
    packId
      .replace(/^sih\./, '')
      .replace(/_uf$/, '')
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (c) => c.toLowerCase()) + 'PackJson'
  );
}

const packs = fs
  .readdirSync(PACK_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort((a, b) => {
    const rank = (id) =>
      id === 'sih.embolia_trombose_uf' ? 0 : id === 'sih.amputacao_mmii_uf' ? 1 : 2;
    return rank(a) - rank(b) || a.localeCompare(b);
  });

const importBlock = [
  "import type { CatalogEntry, PackFile } from './types';",
  "import variablesJson from '../../../public/data/catalog/variables.json';",
  ...packs.map((id) => `import ${toAlias(id)} from '../../../public/data/catalog/packs/${id}.json';`),
].join('\n');

const packsBlock = [
  'const PACKS: Record<string, PackFile> = {',
  ...packs.map((id) => `  '${id}': ${toAlias(id)} as PackFile,`),
  '};',
].join('\n');

let src = fs.readFileSync(TARGET, 'utf8');
// Replace from first type import through PACKS block
src = src.replace(
  /import type \{ CatalogEntry, PackFile \} from '\.\/types';[\s\S]*?const PACKS: Record<string, PackFile> = \{[\s\S]*?\n\};/,
  `${importBlock}\n\n/** Analysis variable shown in Mapas checkboxes / choropleth (catalog or paste overlay). */\nPLACEHOLDER_INTERFACE\n\n/** Stable Phase 4 mock IDs → pack-backed catalog IDs where semantics match (D-18). */\nPLACEHOLDER_ALIASES\n\nconst CATALOG_ENTRIES = variablesJson as CatalogEntry[];\n${packsBlock}`,
);

// Restore interface + aliases from original structure if placeholder used — simpler: rewrite file head only
const headMatch = fs.readFileSync(TARGET, 'utf8');
void headMatch;

// Safer approach: rewrite lines 7..end of PACKS only
src = fs.readFileSync(TARGET, 'utf8');
const before = src.split("import type { CatalogEntry, PackFile } from './types';")[0];
const afterPacks = src.split(/const PACKS: Record<string, PackFile> = \{[\s\S]*?\n\};\n/)[1];
const mid = `import type { CatalogEntry, PackFile } from './types';
import variablesJson from '../../../public/data/catalog/variables.json';
${packs.map((id) => `import ${toAlias(id)} from '../../../public/data/catalog/packs/${id}.json';`).join('\n')}

/** Analysis variable shown in Mapas checkboxes / choropleth (catalog or paste overlay). */
export interface CatalogAnalysisVariable {
  id: string;
  label: string;
  provenance: 'catalog' | 'paste';
  unit?: string;
  sourceSystem?: string;
}

/** Stable Phase 4 mock IDs → pack-backed catalog IDs where semantics match (D-18). */
export const VARIABLE_ID_ALIASES: Readonly<Record<string, string>> = {
  'mock.amputacoes': 'sih.amputacao_mmii.internacoes',
  'mock.internacoes': 'sih.embolia_trombose.internacoes',
  'mock.obitos': 'sih.embolia_trombose.obitos',
  // mock.taxa_mortalidade intentionally NOT aliased (infantil ≠ hospital SIH rates)
};

const CATALOG_ENTRIES = variablesJson as CatalogEntry[];
${packsBlock}
`;

fs.writeFileSync(TARGET, before + mid + afterPacks);
console.log(`syncPackImports: ${packs.length} packs → catalogAnalysisData.ts`);
