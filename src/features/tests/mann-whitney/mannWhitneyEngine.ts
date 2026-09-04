import jStat from 'jstat';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import { fmtNumber, fmtP } from '@/shared/format';
import { statsEngine } from '@/shared/stats/statsEngine';
import type { AnalysisIssue } from '@/shared/data-input/analysisIssues';
import type { PreparedGroupedSamples } from '@/shared/data-input/groupedSamples';

export const MAX_EXACT_PRODUCT = 200;
export const MAX_TOTAL_OBSERVATIONS = 10_000;
export const MIN_GROUP_OBSERVATIONS = 3;

export type MannWhitneyMethod = 'auto' | 'exact' | 'asymptotic';

export interface MannWhitneyOptions {
  method?: MannWhitneyMethod;
  continuityCorrection?: boolean;
}

export interface RankedValue {
  value: number;
  rank: number;
  group: 'A' | 'B';
  originalIndex: number;
}

export interface MannWhitneyGroupSummary {
  n: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  meanRank: number;
}

export interface MannWhitneyResult {
  u: number;
  u1: number;
  u2: number;
  pValue: number;
  method: 'exact' | 'asymptotic';
  fallbackReason?: 'ties' | 'sample_too_large';
  z?: number;
  rankBiserial: number;
  probabilityOfSuperiority: number;
  tieDiagnostics: {
    hasTies: boolean;
    tieGroupSizes: number[];
    tieCorrection: number;
    continuityCorrectionApplied: boolean;
  };
  groupSummaries: {
    A: MannWhitneyGroupSummary;
    B: MannWhitneyGroupSummary;
  };
  rankedValues: RankedValue[];
}

export interface MannWhitneyBuiltDataset {
  groupA: number[];
  groupB: number[];
  labels: [string, string];
  headers: { outcome: string; group: string };
  groupOrder?: string[];
  issues?: AnalysisIssue[];
  invalidRowNumbers?: number[];
}

export interface MannWhitneyEngineOutput {
  result: MannWhitneyResult;
  groupA: number[];
  groupB: number[];
  labels: [string, string];
  headers: { outcome: string; group: string };
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
}

function quantile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function rankPooled(groupA: readonly number[], groupB: readonly number[]): {
  rankedValues: RankedValue[];
  tieGroupSizes: number[];
} {
  const pooled = [
    ...groupA.map((value, originalIndex) => ({ value, group: 'A' as const, originalIndex })),
    ...groupB.map((value, originalIndex) => ({ value, group: 'B' as const, originalIndex })),
  ];
  const ranks = statsEngine.rank(pooled.map((item) => item.value));
  const counts = new Map<number, number>();
  for (const item of pooled) counts.set(item.value, (counts.get(item.value) ?? 0) + 1);
  const tieGroupSizes = [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, count]) => count)
    .filter((count) => count > 1);
  return {
    rankedValues: pooled.map((item, index) => ({ ...item, rank: ranks[index]! })),
    tieGroupSizes,
  };
}

function exactDistributionCounts(n1: number, n2: number): number[] {
  const table: number[][][] = Array.from({ length: n1 + 1 }, () =>
    Array.from({ length: n2 + 1 }, () => [] as number[]));

  for (let i = 0; i <= n1; i += 1) {
    for (let j = 0; j <= n2; j += 1) {
      if (i === 0 || j === 0) {
        table[i]![j] = [1];
        continue;
      }
      const counts = Array.from({ length: i * j + 1 }, () => 0);
      const removeA = table[i - 1]![j]!;
      const removeB = table[i]![j - 1]!;
      for (let u = 0; u < removeA.length; u += 1) counts[u + j]! += removeA[u]!;
      for (let u = 0; u < removeB.length; u += 1) counts[u]! += removeB[u]!;
      table[i]![j] = counts;
    }
  }
  return table[n1]![n2]!;
}

function exactTwoSidedP(u1: number, n1: number, n2: number): number {
  const counts = exactDistributionCounts(n1, n2);
  const lowerU = Math.min(u1, n1 * n2 - u1);
  const cumulative = counts.slice(0, Math.floor(lowerU) + 1).reduce((sum, count) => sum + count, 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return Math.min(1, 2 * cumulative / total);
}

function summarize(values: readonly number[], ranks: readonly number[]): MannWhitneyGroupSummary {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  return {
    n: values.length,
    median: quantile(values, 0.5),
    q1,
    q3,
    iqr: q3 - q1,
    meanRank: statsEngine.mean([...ranks]),
  };
}

function validateInput(groupA: readonly number[], groupB: readonly number[]): void {
  if (groupA.length === 0 || groupB.length === 0) throw new Error('Mann–Whitney exige dois grupos não vazios.');
  if ([...groupA, ...groupB].some((value) => !Number.isFinite(value))) {
    throw new Error('Mann–Whitney aceita apenas valores numéricos finitos.');
  }
}

export function runMannWhitney(
  groupA: readonly number[],
  groupB: readonly number[],
  options: MannWhitneyOptions = {},
): MannWhitneyResult {
  validateInput(groupA, groupB);
  const n1 = groupA.length;
  const n2 = groupB.length;
  const { rankedValues, tieGroupSizes } = rankPooled(groupA, groupB);
  const rankSumA = rankedValues
    .filter((item) => item.group === 'A')
    .reduce((sum, item) => sum + item.rank, 0);
  const u1 = rankSumA - n1 * (n1 + 1) / 2;
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);
  const hasTies = tieGroupSizes.length > 0;
  const requestedMethod = options.method ?? 'auto';
  const exactSupported = !hasTies && n1 * n2 <= MAX_EXACT_PRODUCT;
  const method = requestedMethod === 'asymptotic' || !exactSupported ? 'asymptotic' : 'exact';
  const fallbackReason = method === 'asymptotic' && requestedMethod !== 'asymptotic'
    ? (hasTies ? 'ties' : 'sample_too_large')
    : undefined;
  const probabilityOfSuperiority = u1 / (n1 * n2);
  const rankBiserial = 2 * probabilityOfSuperiority - 1;
  const totalN = n1 + n2;
  const tieSum = tieGroupSizes.reduce((sum, size) => sum + size ** 3 - size, 0);
  const tieCorrection = totalN > 1 ? 1 - tieSum / (totalN ** 3 - totalN) : 1;
  const continuityCorrection = options.continuityCorrection ?? true;
  let z: number | undefined;
  let pValue: number;
  let continuityCorrectionApplied = false;

  if (method === 'exact') {
    pValue = exactTwoSidedP(u1, n1, n2);
  } else {
    const mean = n1 * n2 / 2;
    const variance = n1 * n2 * (totalN + 1) * tieCorrection / 12;
    if (variance <= 0) {
      z = 0;
      pValue = 1;
    } else {
      const difference = u1 - mean;
      continuityCorrectionApplied = continuityCorrection && difference !== 0;
      const correction = continuityCorrectionApplied ? 0.5 * Math.sign(difference) : 0;
      z = (difference - correction) / Math.sqrt(variance);
      pValue = Math.min(1, 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1)));
    }
  }

  const ranksA = rankedValues.filter((item) => item.group === 'A').map((item) => item.rank);
  const ranksB = rankedValues.filter((item) => item.group === 'B').map((item) => item.rank);
  return {
    u,
    u1,
    u2,
    pValue,
    method,
    ...(fallbackReason ? { fallbackReason } : {}),
    ...(z === undefined ? {} : { z }),
    rankBiserial,
    probabilityOfSuperiority,
    tieDiagnostics: { hasTies, tieGroupSizes, tieCorrection, continuityCorrectionApplied },
    groupSummaries: {
      A: summarize(groupA, ranksA),
      B: summarize(groupB, ranksB),
    },
    rankedValues,
  };
}

function resolveHeaders(headers: string[], recognizedColumns: Record<string, number>) {
  const outcomeIndex = recognizedColumns.desfecho;
  const groupIndex = recognizedColumns.grupo;
  return {
    outcome: outcomeIndex === undefined ? 'desfecho' : headers[outcomeIndex] || 'desfecho',
    group: groupIndex === undefined ? 'grupo' : headers[groupIndex] || 'grupo',
  };
}

export function buildDatasetFromConfirmed(input: BuildDatasetInput): MannWhitneyBuiltDataset {
  const outcomeIndex = input.recognizedColumns.desfecho;
  const groupIndex = input.recognizedColumns.grupo;
  const headers = resolveHeaders(input.headers, input.recognizedColumns);
  if (outcomeIndex === undefined || groupIndex === undefined) {
    return { groupA: [], groupB: [], labels: ['Grupo A', 'Grupo B'], headers, groupOrder: [] };
  }
  const groups = new Map<string, number[]>();
  for (const row of input.rows) {
    const label = (row[groupIndex] ?? '').trim();
    const value = statsEngine.parseNumber(row[outcomeIndex]);
    if (!label || value === null) continue;
    const values = groups.get(label) ?? [];
    values.push(value);
    groups.set(label, values);
  }
  const groupOrder = [...groups.keys()];
  const labels: [string, string] = [groupOrder[0] ?? 'Grupo A', groupOrder[1] ?? 'Grupo B'];
  return {
    groupA: groups.get(labels[0]) ?? [],
    groupB: groups.get(labels[1]) ?? [],
    labels,
    headers,
    groupOrder,
  };
}

export function buildDatasetFromPrepared(
  prepared: PreparedGroupedSamples,
  headers: { outcome: string; group: string },
): MannWhitneyBuiltDataset {
  const groupOrder = prepared.groups.map((group) => group.label);
  const labels: [string, string] = [groupOrder[0] ?? 'Grupo A', groupOrder[1] ?? 'Grupo B'];
  return {
    groupA: prepared.groups[0]?.values ?? [],
    groupB: prepared.groups[1]?.values ?? [],
    labels,
    headers,
    groupOrder,
    issues: [...prepared.issues],
    invalidRowNumbers: [...prepared.invalidRowNumbers],
  };
}

export function validateDatasetIssues(dataset: MannWhitneyBuiltDataset): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [...(dataset.issues ?? [])];
  const addIssue = (issue: AnalysisIssue) => {
    if (!issues.some((existing) => existing.code === issue.code)) issues.push(issue);
  };
  const groupCount = dataset.groupOrder?.length
    ?? [dataset.groupA, dataset.groupB].filter((group) => group.length > 0).length;
  if (groupCount !== 2) {
    addIssue({
      code: 'group_count',
      severity: 'error',
      message: groupCount === 1
        ? 'Foi encontrado apenas um grupo com dados; Mann–Whitney exige exatamente dois grupos independentes.'
        : `Foram encontrados ${groupCount} grupos; Mann–Whitney exige exatamente dois grupos independentes.`,
      hint: 'Revise o formato e os vínculos das colunas; nenhum grupo será descartado automaticamente.',
    });
  }
  const small = [
    { label: dataset.labels[0], n: dataset.groupA.length },
    { label: dataset.labels[1], n: dataset.groupB.length },
  ].filter((group) => group.n < MIN_GROUP_OBSERVATIONS);
  if (small.length) {
    addIssue({
      code: 'group_too_small',
      severity: 'error',
      message: `Cada grupo precisa de pelo menos ${MIN_GROUP_OBSERVATIONS} observações independentes. Revise: ${small.map((group) => `${group.label} (n=${group.n})`).join(', ')}.`,
    });
  }
  if (dataset.groupA.length + dataset.groupB.length > MAX_TOTAL_OBSERVATIONS) {
    addIssue({
      code: 'too_many_observations',
      severity: 'error',
      message: `Limite de ${MAX_TOTAL_OBSERVATIONS.toLocaleString('pt-BR')} observações excedido.`,
    });
  }
  const values = [...dataset.groupA, ...dataset.groupB];
  if (values.length > 1 && new Set(values).size < 2) {
    addIssue({
      code: 'all_values_tied',
      severity: 'error',
      message: 'Todos os valores válidos estão empatados; não há variação para ordenar os grupos.',
    });
  }
  return issues;
}

export function validateDataset(dataset: MannWhitneyBuiltDataset): string[] {
  return validateDatasetIssues(dataset)
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);
}

export function runAnalysis(dataset: MannWhitneyBuiltDataset, options: MannWhitneyOptions = {}): MannWhitneyResult {
  return runMannWhitney(dataset.groupA, dataset.groupB, options);
}

export function toEngineOutput(dataset: MannWhitneyBuiltDataset, result: MannWhitneyResult): MannWhitneyEngineOutput {
  return { result, groupA: dataset.groupA, groupB: dataset.groupB, labels: dataset.labels, headers: dataset.headers };
}

export function buildMetrics(result: MannWhitneyResult, labels: [string, string]): ResultMetric[] {
  const method = result.method === 'exact' ? 'Exato' : 'Aproximação normal com correção de empates';
  return [
    { label: 'Estatística U', helpKey: 'estatistica-u', value: fmtNumber(result.u, 2), hint: `U1 = ${fmtNumber(result.u1, 2)} · U2 = ${fmtNumber(result.u2, 2)}` },
    { label: 'p-valor', helpKey: 'p-valor', value: fmtP(result.pValue), hint: method },
    { label: 'Efeito por postos', helpKey: 'efeito-postos', value: fmtNumber(result.rankBiserial, 3), hint: `P(${labels[0]} > ${labels[1]}) + 0,5×empates = ${fmtNumber(result.probabilityOfSuperiority * 100, 1)}%` },
  ];
}
