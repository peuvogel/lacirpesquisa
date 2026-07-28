/**
 * After (partial) mass scrape: build catalog packs + sync TypeScript imports.
 * Safe to re-run; skips missing CSVs.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('node', ['scripts/catalog/syncColumnMap.mjs']);
run('node', ['scripts/catalog/build.mjs']);
run('node', ['scripts/catalog/syncPackImports.mjs']);
run('node', ['scripts/catalog/validate.mjs']);
console.log('rebuildAfterScrape: OK');
