/**
 * Loads interpretation helpers from tests/correlacao/module.js via vm slice —
 * avoids chart-manager.js CDN import that breaks Vitest ESM loader.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CorrelacaoModuleOracle {
  classifyDirection: (coef: number) => string;
  classifyStrength: (coef: number) => string;
  compareMessage: (
    pearson: { coef: number },
    spearman: { coef: number },
  ) => string;
  formatPValue: (p: number, utils: { fmtP: (v: number) => string }) => string;
  formatCi: (
    ci: number[],
    utils: { fmtNumber: (v: number, d: number) => string },
    digits?: number,
  ) => string;
  buildPearsonInterpretationHtml: (
    dataset: { headers: string[] },
    pearson: { coef: number; p: number; ci: number[] },
    spearman: { coef: number },
    diagnostics: { adequacyTone: string; curvatureGain: number; mae: number },
    outlierLabels: string[],
    utils: Record<string, (...args: never[]) => unknown>,
    alpha: string | number,
    context: string,
  ) => string;
  buildSpearmanInterpretationHtml: (
    dataset: { headers: string[] },
    pearson: { coef: number },
    spearman: { coef: number; p: number; ci: number[] },
    diagnostics: { monotonicConsistency: number },
    rankSummary: { xTies: { groups: number }; yTies: { groups: number } },
    utils: Record<string, (...args: never[]) => unknown>,
    alpha: string | number,
    context: string,
  ) => string;
}

let cached: CorrelacaoModuleOracle | null = null;

export function loadCorrelacaoModuleOracle(): CorrelacaoModuleOracle {
  if (cached) return cached;

  const modulePath = join(__dirname, '../../tests/correlacao/module.js');
  const lines = readFileSync(modulePath, 'utf8').split('\n');
  const classifyBlock = lines.slice(87, 101).join('\n');
  const compareBlock = lines.slice(249, 267).join('\n');
  const formatBlock = lines.slice(628, 637).join('\n');
  const pearsonInterpBlock = lines.slice(1108, 1135).join('\n');
  const spearmanInterpBlock = lines.slice(1136, 1163).join('\n');
  const wrapped = `${classifyBlock}\n${compareBlock}\n${formatBlock}\n${pearsonInterpBlock}\n${spearmanInterpBlock}\n;({ classifyDirection, classifyStrength, compareMessage, formatPValue, formatCi, buildPearsonInterpretationHtml, buildSpearmanInterpretationHtml });`;

  cached = vm.runInNewContext(wrapped, {}, { filename: modulePath }) as CorrelacaoModuleOracle;
  return cached;
}
