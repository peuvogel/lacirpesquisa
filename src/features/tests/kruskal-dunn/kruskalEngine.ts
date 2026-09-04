import type { AssumptionNudge } from '@/features/tests/shared/assumptionNudges';
import { fmtNumber, fmtP } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  dunnPostHoc,
  kruskalWallis,
  statsEngine,
  type KruskalWallisResult,
  type PairwiseRow,
} from '@/shared/stats/statsEngine';

export const MAX_GROUPS = 20;
export const MAX_TOTAL_OBS = 10_000;

export interface GroupRankSummary {
  n: number;
  median: number;
  meanRank: number;
}

export interface KruskalBuiltDataset {
  groups: Record<string, number[]>;
  groupOrder: string[];
  headers: { outcome: string; group: string };
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
}

export interface KruskalAnalysisResult extends KruskalWallisResult {
  groupSummaries: Record<string, GroupRankSummary>;
  pairwise: PairwiseRow[];
}

export interface KruskalEngineOutput {
  result: KruskalAnalysisResult;
  groups: Record<string, number[]>;
  groupOrder: string[];
  headers: { outcome: string; group: string };
  pairwise: PairwiseRow[];
  nudges: AssumptionNudge[];
}

function resolveHeaders(
  headers: string[],
  recognizedColumns: Record<string, number>,
): { outcome: string; group: string } {
  const outcomeIndex = recognizedColumns.desfecho;
  const groupIndex = recognizedColumns.grupo;
  return {
    outcome: outcomeIndex !== undefined ? headers[outcomeIndex] || 'desfecho' : 'desfecho',
    group: groupIndex !== undefined ? headers[groupIndex] || 'grupo' : 'grupo',
  };
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function computeGroupSummaries(
  groups: Record<string, number[]>,
  groupOrder: string[],
): Record<string, GroupRankSummary> {
  const pooled: number[] = [];
  const groupIndices: number[] = [];
  groupOrder.forEach((label, groupIndex) => {
    groups[label].forEach((value) => {
      pooled.push(value);
      groupIndices.push(groupIndex);
    });
  });
  const ranks = statsEngine.rank(pooled);

  const summaries: Record<string, GroupRankSummary> = Object.create(null) as Record<string, GroupRankSummary>;
  groupOrder.forEach((label, groupIndex) => {
    const values = groups[label];
    const groupRanks = ranks.filter((_, index) => groupIndices[index] === groupIndex);
    summaries[label] = {
      n: values.length,
      median: median(values),
      meanRank: groupRanks.length ? statsEngine.mean(groupRanks) : NaN,
    };
  });
  return summaries;
}

export function buildDatasetFromConfirmed(input: BuildDatasetInput): KruskalBuiltDataset {
  const { headers, rows, recognizedColumns } = input;
  const indexOutcome = recognizedColumns.desfecho;
  const indexGroup = recognizedColumns.grupo;
  const columnHeaders = resolveHeaders(headers, recognizedColumns);

  if (indexOutcome === undefined || indexGroup === undefined) {
    return { groups: {}, groupOrder: [], headers: columnHeaders };
  }

  const groups: Record<string, number[]> = Object.create(null) as Record<string, number[]>;
  const groupOrder: string[] = [];

  rows.forEach((row) => {
    const rawGroup = (row[indexGroup] ?? '').trim();
    if (!rawGroup) return;
    const value = statsEngine.parseNumber((row[indexOutcome] ?? '').trim());
    if (value === null) return;

    if (!Object.hasOwn(groups, rawGroup)) {
      groups[rawGroup] = [];
      groupOrder.push(rawGroup);
    }
    groups[rawGroup].push(value);
  });

  return { groups, groupOrder, headers: columnHeaders };
}

export function validateDataset(dataset: KruskalBuiltDataset): string[] {
  const errors: string[] = [];
  const labels = dataset.groupOrder;
  const k = labels.length;

  if (k < 2) {
    errors.push('Ao menos dois grupos distintos são necessários para Kruskal-Wallis.');
    return errors;
  }

  if (k > MAX_GROUPS) {
    errors.push(`Limite de ${MAX_GROUPS} grupos excedido. Reduza o número de níveis do fator.`);
    return errors;
  }

  const totalN = labels.reduce((sum, label) => sum + dataset.groups[label].length, 0);
  if (totalN > MAX_TOTAL_OBS) {
    errors.push(
      `Limite de ${MAX_TOTAL_OBS.toLocaleString('pt-BR')} observações excedido. Use uma amostra menor.`,
    );
    return errors;
  }

  const emptyGroups = labels.filter((label) => dataset.groups[label].length === 0);
  if (emptyGroups.length) {
    errors.push(`Grupos sem observações: ${emptyGroups.join(', ')}.`);
  }

  return errors;
}

function sortPairwise(pairwise: PairwiseRow[]): PairwiseRow[] {
  return [...pairwise].sort((a, b) => a.pAdj - b.pAdj);
}

export function runAnalysis(dataset: KruskalBuiltDataset): KruskalAnalysisResult {
  const kruskal = kruskalWallis(dataset.groups);
  const groupSummaries = computeGroupSummaries(dataset.groups, dataset.groupOrder);
  const pairwise = sortPairwise(dunnPostHoc(dataset.groups));
  return { ...kruskal, groupSummaries, pairwise };
}

export function buildMetrics(result: KruskalAnalysisResult, dataset: KruskalBuiltDataset): ResultMetric[] {
  const groupSummary = dataset.groupOrder
    .map((label) => {
      const stats = result.groupSummaries[label];
      return `${label}: n=${stats.n}, mediana=${fmtNumber(stats.median, 2)}, posto médio=${fmtNumber(stats.meanRank, 2)}`;
    })
    .join(' · ');

  return [
    {
      label: 'Estatística H',
      helpKey: 'estatistica-h',
      value: fmtNumber(result.h, 3),
      hint: `gl = ${result.df}`,
    },
    {
      label: 'p-valor',
      helpKey: 'p-valor',
      value: fmtP(result.p),
      hint: 'Teste omnibus Kruskal-Wallis (postos)',
    },
    {
      label: 'Grupos',
      helpKey: 'grupos',
      value: String(dataset.groupOrder.length),
      hint: groupSummary,
    },
  ];
}

export function computeAssumptionNudges(
  _result: KruskalAnalysisResult,
  dataset: KruskalBuiltDataset,
): AssumptionNudge[] {
  const nudges: AssumptionNudge[] = [];
  const k = dataset.groupOrder.length;

  nudges.push({
    severity: 'info',
    message:
      'Kruskal-Wallis compara grupos pelos postos (ranks), alternativa não paramétrica quando a normalidade dentro dos grupos é duvidosa ou os dados são assimétricos.',
  });

  if (k === 2) {
    nudges.push({
      severity: 'info',
      message:
        'Com apenas dois grupos, o teste de Mann-Whitney (Wilcoxon) pode ser mais direto para comparar as distribuições.',
    });
    nudges.push({
      severity: 'info',
      message:
        'Com dois grupos há apenas um contraste par a par, o pós-hoc Dunn equivale a essa única comparação.',
    });
  } else if (k >= 3) {
    nudges.push({
      severity: 'info',
      message:
        'Com três ou mais grupos, consulte a tabela Dunn abaixo para identificar quais pares diferem após o H omnibus.',
    });
  }

  return nudges;
}

export function toEngineOutput(
  dataset: KruskalBuiltDataset,
  result: KruskalAnalysisResult,
): KruskalEngineOutput {
  return {
    result,
    groups: dataset.groups,
    groupOrder: dataset.groupOrder,
    headers: dataset.headers,
    pairwise: result.pairwise,
    nudges: computeAssumptionNudges(result, dataset),
  };
}
