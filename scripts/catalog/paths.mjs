/**
 * Resolve repo-relative paths into the tracked trabalhos datasus corpus.
 * Allowlist: coleta outputs + catalogos (for seed curation reads only).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const CORPUS_DIR = path.join(ROOT, 'trabalhos datasus');

/** Relative segments under CORPUS_DIR that may be read by the pipeline. */
const ALLOWED_PREFIXES = [
  path.normalize('outputs/coleta_embolia_trombose_uf'),
  path.normalize('outputs/coleta_vascular_amputacao'),
  path.normalize('build/catalogos'),
];

/**
 * @param {string} relativePath path relative to CORPUS_DIR (posix or native separators)
 * @returns {string} absolute path inside allowlist
 */
export function corpusPath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error('corpusPath: relativePath required');
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`corpusPath: absolute paths rejected: ${relativePath}`);
  }
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized.includes('..')) {
    throw new Error(`corpusPath: path traversal rejected: ${relativePath}`);
  }
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + path.sep),
  );
  if (!allowed) {
    throw new Error(
      `corpusPath: path outside allowlist (coleta_embolia_trombose_uf | coleta_vascular_amputacao | catalogos): ${relativePath}`,
    );
  }
  const resolved = path.resolve(CORPUS_DIR, normalized);
  if (!resolved.startsWith(CORPUS_DIR + path.sep) && resolved !== CORPUS_DIR) {
    throw new Error(`corpusPath: resolved outside CORPUS_DIR: ${relativePath}`);
  }
  return resolved;
}

export function corpusExists(relativePath) {
  return fs.existsSync(corpusPath(relativePath));
}

export const PACK_SOURCES = {
  'sih.embolia_trombose_uf': {
    sourceDir: 'outputs/coleta_embolia_trombose_uf',
    csv: 'outputs/coleta_embolia_trombose_uf/base_embolia_trombose_arteriais_uf_2013_2025.csv',
    metadata: 'outputs/coleta_embolia_trombose_uf/metadata.json',
  },
  'sih.amputacao_mmii_uf': {
    sourceDir: 'outputs/coleta_vascular_amputacao',
    csv: 'outputs/coleta_vascular_amputacao/base_analise_vascular_amputacao_2013_2025.csv',
    metadata: 'outputs/coleta_vascular_amputacao/metadata.json',
  },
};

export const CATALOG_OUT_DIR = path.join(ROOT, 'public/data/catalog');
