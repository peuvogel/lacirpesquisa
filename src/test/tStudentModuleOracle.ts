/**
 * Loads safeWelch/safePaired from tests/t-student/module.js via vm slice —
 * avoids chart-manager.js CDN import that breaks Vitest ESM loader.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import type { statsEngine } from '@/shared/stats/statsEngine';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type LegacyStatsLike = typeof statsEngine;

export interface TStudentModuleOracle {
  safeWelch: (g1: number[], g2: number[], stats: LegacyStatsLike) => ReturnType<typeof statsEngine.welchT> & {
    se: number;
  };
  safePaired: (
    g1: number[],
    g2: number[],
    stats: LegacyStatsLike,
  ) => ReturnType<typeof statsEngine.welchT> & {
    testKind: 'paired';
    meanDifference: number;
    sdDifference: number;
    se: number;
    differences: number[];
  };
}

let cached: TStudentModuleOracle | null = null;

export function loadTStudentModuleOracle(): TStudentModuleOracle {
  if (cached) return cached;

  const modulePath = join(__dirname, '../../tests/t-student/module.js');
  const lines = readFileSync(modulePath, 'utf8').split('\n');
  const welchBlock = lines.slice(606, 628).join('\n').replace('export function safeWelch', 'function safeWelch');
  const pairedBlock = lines.slice(1076, 1115).join('\n').replace('export function safePaired', 'function safePaired');
  const wrapped = `${welchBlock}\n${pairedBlock}\n;({ safeWelch, safePaired });`;

  cached = vm.runInNewContext(wrapped, {}, { filename: modulePath }) as TStudentModuleOracle;
  return cached;
}
