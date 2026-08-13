/**
 * Resolve repo-relative paths into the tracked trabalhos datasus corpus.
 * Allowlist: catalogos (for seed curation reads only) — D-19/09-13 aposentou os diretórios de
 * coleta SIH sob `outputs/` (o corpus multi-doença de 654 CSVs, 424 deles com 0 bytes, e os 2
 * diretórios legados de embolia/amputação) como entrada de build: os 10 packs vivos agora vêm
 * de `generateSihPacks.mjs` (fonte servida, PostgREST), não mais deste corpus.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const CORPUS_DIR = path.join(ROOT, 'trabalhos datasus');

/** Relative segments under CORPUS_DIR that may be read by the pipeline. */
const ALLOWED_PREFIXES = [
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
      `corpusPath: path outside allowlist (catalogos): ${relativePath}`,
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

export const CATALOG_OUT_DIR = path.join(ROOT, 'public/data/catalog');
