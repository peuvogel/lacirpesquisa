/**
 * Loads the untouched legacy `Stats` object from `assets/js/app.js:240-533`
 * for differential parity tests. `app.js` does not export `Stats`; this
 * harness evaluates only that slice via vm (read-only oracle).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import type { statsEngine } from '@/shared/stats/statsEngine';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type LegacyStatsOracle = typeof statsEngine;

let cached: LegacyStatsOracle | null = null;

export function loadLegacyStatsOracle(): LegacyStatsOracle {
  if (cached) return cached;

  const appPath = join(__dirname, '../../assets/js/app.js');
  const source = readFileSync(appPath, 'utf8');
  const lines = source.split('\n');
  const statsBlock = lines.slice(239, 533).join('\n');
  const wrapped = `${statsBlock}\n;Stats;`;

  cached = vm.runInNewContext(wrapped, {}, { filename: appPath }) as LegacyStatsOracle;
  return cached;
}
