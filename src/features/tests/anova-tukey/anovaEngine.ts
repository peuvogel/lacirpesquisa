import type { AssumptionNudge } from '@/features/tests/shared/assumptionNudges';
import { fmtNumber, fmtP } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  oneWayAnova,
  statsEngine,
  tukeyHsd,
  type OneWayAnovaResult,
  type PairwiseRow,
} from '@/shared/stats/statsEngine';

export const MAX_GROUPS = 20;
export const MAX_TOTAL_OBS = 10_000;

export interface AnovaBuiltDataset {
  groups: Record<string, number[]>;
  groupOrder: string[];
  headers: { outcome: string; group: string };
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
}

export interface AnovaAnalysisResult extends OneWayAnovaResult {
  pairwise: PairwiseRow[];
}

export interface AnovaEngineOutput {
  result: AnovaAnalysisResult;
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

export function buildDatasetFromConfirmed(input: BuildDatasetInput): AnovaBuiltDataset {
  const { headers, rows, recognizedColumns } = input;
  const indexOutcome = recognizedColumns.desfecho;
  const indexGroup = recognizedColumns.grupo;
  const columnHeaders = resolveHeaders(headers, recognizedColumns);

  if (indexOutcome === undefined || indexGroup === undefined) {
    return { groups: {}, groupOrder: [], headers: columnHeaders };
  }

  const groups: Record<string, number[]> = {};
  const groupOrder: string[] = [];

  rows.forEach((row) => {
    const rawGroup = (row[indexGroup] ?? '').trim();
    if (!rawGroup) return;
    const value = statsEngine.parseNumber((row[indexOutcome] ?? '').trim());
    if (value === null) return;

    if (!groups[rawGroup]) {
      groups[rawGroup] = [];
      groupOrder.push(rawGroup);
    }
    groups[rawGroup].push(value);
  });

  return { groups, groupOrder, headers: columnHeaders };
}

export function validateDataset(dataset: AnovaBuiltDataset): string[] {
  const errors: string[] = [];
  const labels = dataset.groupOrder;
  const k = labels.length;

  if (k < 2) {
    errors.push('Ao menos dois grupos distintos são necessários para ANOVA de uma via.');
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

  const smallGroups = labels.filter((label) => dataset.groups[label].length < 2);
  if (smallGroups.length) {
    errors.push(
      `Tukey HSD exige ao menos duas observações por grupo. Revise: ${smallGroups.join(', ')}.`,
    );
  }

  return errors;
}

function sortPairwise(pairwise: PairwiseRow[]): PairwiseRow[] {
  return [...pairwise].sort((a, b) => a.pAdj - b.pAdj);
}

export function runAnalysis(dataset: AnovaBuiltDataset): AnovaAnalysisResult {
  const anova = oneWayAnova(dataset.groups);
  const pairwise = sortPairwise(tukeyHsd(dataset.groups));
  return { ...anova, pairwise };
}

export function buildMetrics(result: AnovaAnalysisResult, dataset: AnovaBuiltDataset): ResultMetric[] {
  const groupSummary = dataset.groupOrder
    .map((label) => {
      const stats = result.groupStats[label];
      return `${label}: n=${stats.n}, média=${fmtNumber(stats.mean, 2)}`;
    })
    .join(' · ');

  return [
    {
      label: 'Estatística F',
      value: fmtNumber(result.f, 3),
      hint: `gl entre = ${result.dfBetween}, gl dentro = ${result.dfWithin}`,
    },
    {
      label: 'Evidência estatística',
      value: fmtP(result.p),
      hint: 'Teste omnibus ANOVA de uma via',
    },
    {
      label: 'Tamanho de efeito (η²)',
      value: fmtNumber(result.eta2, 3),
      hint: 'Proporção da variância explicada pelo fator',
    },
    {
      label: 'Grupos',
      value: String(dataset.groupOrder.length),
      hint: groupSummary,
    },
  ];
}

const KRUSKAL_CTA = {
  label: 'Abrir Kruskal-Wallis + Dunn',
  testId: 'kruskal-dunn',
} as const;

export function computeAssumptionNudges(
  result: AnovaAnalysisResult,
  dataset: AnovaBuiltDataset,
): AssumptionNudge[] {
  const nudges: AssumptionNudge[] = [];
  const labels = dataset.groupOrder;
  const k = labels.length;

  if (k === 2) {
    nudges.push({
      severity: 'info',
      message:
        'Com apenas dois grupos, o teste t de Student pode ser mais direto para comparar as médias.',
    });
  }

  const ns = labels.map((label) => result.groupStats[label].n);
  const minN = Math.min(...ns);
  const maxN = Math.max(...ns);
  if (minN > 0 && maxN / minN > 3) {
    nudges.push({
      severity: 'warning',
      message:
        'Os tamanhos amostrais dos grupos estão bem desiguais. A ANOVA fica sensível a heterogeneidade de variâncias — considere Kruskal-Wallis como alternativa não paramétrica.',
      cta: KRUSKAL_CTA,
    });
  }

  const sds = labels.map((label) => result.groupStats[label].sd);
  const positiveSds = sds.filter((sd) => sd > 0);
  if (positiveSds.length >= 2) {
    const maxSd = Math.max(...positiveSds);
    const minSd = Math.min(...positiveSds);
    if (minSd > 0 && maxSd / minSd > 2) {
      nudges.push({
        severity: 'warning',
        message:
          'Os desvios-padrão diferem bastante entre grupos. Verifique homogeneidade de variâncias; se o padrão persistir, Kruskal-Wallis pode ser mais adequado.',
        cta: KRUSKAL_CTA,
      });
    }
  }

  let skewHint = false;
  labels.forEach((label) => {
    const values = dataset.groups[label];
    if (values.length < 3) return;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = result.groupStats[label].mean;
    const sd = result.groupStats[label].sd;
    if (sd > 0 && Math.abs(mean - median) / sd > 0.75) {
      skewHint = true;
    }
  });
  if (skewHint) {
    nudges.push({
      severity: 'info',
      message:
        'Alguns grupos parecem assimétricos (média e mediana distantes). A ANOVA assume aproximadamente normalidade dentro de cada grupo — interprete com cautela.',
    });
  }

  return nudges;
}

export function toEngineOutput(dataset: AnovaBuiltDataset, result: AnovaAnalysisResult): AnovaEngineOutput {
  return {
    result,
    groups: dataset.groups,
    groupOrder: dataset.groupOrder,
    headers: dataset.headers,
    pairwise: result.pairwise,
    nudges: computeAssumptionNudges(result, dataset),
  };
}
