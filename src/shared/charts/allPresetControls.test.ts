import { describe, expect, it } from 'vitest';
import type { ChartProps, ChartPreset } from './useChartCustomizer';
import { applyChartCapabilities } from './chartCapabilities';
import { buildTStudentChartPresets } from '@/features/tests/t-student/tStudentCharts';
import type { TStudentEngineOutput } from '@/features/tests/t-student/tStudentEngine';
import { mannWhitneyChartPresets } from '@/features/tests/mann-whitney/mannWhitneyCharts';
import {
  runAnalysis as runMannWhitney,
  toEngineOutput as toMannWhitneyOutput,
  type MannWhitneyBuiltDataset,
} from '@/features/tests/mann-whitney/mannWhitneyEngine';
import { buildAnovaChartPresets } from '@/features/tests/anova-tukey/anovaCharts';
import type { AnovaEngineOutput } from '@/features/tests/anova-tukey/anovaEngine';
import { buildKruskalChartPresets } from '@/features/tests/kruskal-dunn/kruskalCharts';
import type { KruskalEngineOutput } from '@/features/tests/kruskal-dunn/kruskalEngine';
import { buildQuiQuadradoChartPresets } from '@/features/tests/qui-quadrado/quiQuadradoCharts';
import type { QuiQuadradoEngineOutput } from '@/features/tests/qui-quadrado/quiQuadradoEngine';
import { buildCorrelacaoChartPresets } from '@/features/tests/correlacao/correlacaoCharts';
import { toEngineOutput as toCorrelacaoOutput } from '@/features/tests/correlacao/correlacaoEngine';
import {
  buildPraisResidualPresets,
  buildPraisTrendPresets,
} from '@/features/tests/prais-winsten/praisCharts';
import type { PraisEngineOutput } from '@/features/tests/prais-winsten/praisEngine';
import { buildLogisticaChartPresets } from '@/features/tests/logistica/logisticaCharts';
import type { LogisticaEngineOutput } from '@/features/tests/logistica/logisticaEngine';
import { buildPoissonChartPresets } from '@/features/tests/poisson/poissonCharts';
import type { PoissonEngineOutput } from '@/features/tests/poisson/poissonEngine';
import { buildBinomialNegativaChartPresets } from '@/features/tests/binomial-negativa/binomialNegativaCharts';
import type { BinomialNegativaEngineOutput } from '@/features/tests/binomial-negativa/binomialNegativaEngine';

function visualState(chart: ChartProps): string {
  return JSON.stringify({ data: chart.data, options: chart.options }, (_key, value) =>
    typeof value === 'function' ? '[function]' : value);
}

function assertEveryControlChanges<T>(presets: ChartPreset<T>[], output: T) {
  for (const preset of presets) {
    const chart = preset.buildChart(output);
    for (const capability of preset.capabilities) {
      const toggled = applyChartCapabilities(
        chart,
        { [capability.id]: !(capability.defaultEnabled ?? true) },
        [capability],
      );
      expect(
        visualState(toggled),
        `${preset.id}.${capability.id} deve alterar uma propriedade visual declarada`,
      ).not.toBe(visualState(chart));
    }
  }
}

const tOutput = {
  mode: 'independent',
  g1: [1, 2, 3, 4],
  g2: [4, 5, 6, 7],
  labels: ['A', 'B'],
  result: {
    n1: 4, n2: 4, m1: 2.5, m2: 5.5, s1: 1.3, s2: 1.3,
    diff: -3, se: 0.9, t: -3.3, df: 6, p: 0.01, ci: [-5, -1], d: -2,
  },
} as unknown as TStudentEngineOutput;

const anovaOutput = {
  groups: { A: [1, 2, 3], B: [5, 6, 7] },
  groupOrder: ['A', 'B'],
  headers: { outcome: 'Valor', group: 'Grupo' },
  result: {
    f: 10, dfBetween: 1, dfWithin: 4, p: 0.01, eta2: 0.7, msWithin: 1,
    groupStats: { A: { n: 3, mean: 2, sd: 1 }, B: { n: 3, mean: 6, sd: 1 } },
    pairwise: [],
  },
  pairwise: [], nudges: [],
} as unknown as AnovaEngineOutput;

const kruskalOutput = {
  groups: { A: [1, 2, 3], B: [5, 6, 7] },
  groupOrder: ['A', 'B'],
  headers: { outcome: 'Valor', group: 'Grupo' },
  result: {
    h: 4, df: 1, p: 0.03,
    groupSummaries: {
      A: { n: 3, median: 2, meanRank: 2 },
      B: { n: 3, median: 6, meanRank: 5 },
    },
    pairwise: [],
  },
  pairwise: [], nudges: [],
} as unknown as KruskalEngineOutput;

const chiOutput = {
  dataset: {
    table: [[30, 10], [10, 30]],
    rowLabels: ['Exposto', 'Controle'],
    colLabels: ['Caso', 'Não caso'],
    columnHeaders: ['Grupo', 'Desfecho'],
    totalN: 80,
  },
  result: { expected: [[20, 20], [20, 20]], p: 0.001 },
  nudges: [],
} as unknown as QuiQuadradoEngineOutput;

const praisOutput = {
  fitted: [10, 12, 14], residuals: [-0.2, 0.1, 0.3], model: { scale: 'log' },
  dataset: {
    time: [2020, 2021, 2022], values: [9, 13, 15],
    orderedRows: [{ timeLabel: '2020' }, { timeLabel: '2021' }, { timeLabel: '2022' }],
    timeHeaderLabel: 'Ano', yHeaderLabel: 'Taxa',
  },
} as unknown as PraisEngineOutput;

const coefficient = { term: 'dose', beta: 0.4, se: 0.1, z: 4, p: 0.001 };
const logisticOutput = {
  result: { coefficients: [coefficient], oddsRatios: [], converged: true },
} as unknown as LogisticaEngineOutput;
const countOutput = {
  dataset: { y: [1, 2, 4], design: { matrix: [[1], [2], [3]], terms: ['dose'] } },
  result: { coefficients: [coefficient] }, nudges: [],
} as unknown as PoissonEngineOutput;
const negativeBinomialOutput = countOutput as unknown as BinomialNegativaEngineOutput;

describe('all advertised chart controls', () => {
  it('changes a concrete visual property in every currently available test preset', () => {
    const mannDataset: MannWhitneyBuiltDataset = {
      groupA: [1, 2, 3, 4], groupB: [5, 6, 7, 8], labels: ['A', 'B'],
      headers: { outcome: 'Valor', group: 'Grupo' },
    };
    const mannOutput = toMannWhitneyOutput(mannDataset, runMannWhitney(mannDataset));
    const correlationOutput = toCorrelacaoOutput({
      x: [1, 2, 3, 4, 100],
      y: [2, 4, 7, 8, 9],
      labels: ['a', 'b', 'c', 'd', 'e'],
      headers: ['X', 'Y'],
      method: 'pearson',
    }, 'pearson');
    const rankOutput = { ...correlationOutput, method: 'spearman' as const };

    assertEveryControlChanges(buildTStudentChartPresets('independent'), tOutput);
    assertEveryControlChanges(mannWhitneyChartPresets, mannOutput);
    assertEveryControlChanges(buildAnovaChartPresets(2), anovaOutput);
    assertEveryControlChanges(buildKruskalChartPresets(2), kruskalOutput);
    assertEveryControlChanges(buildQuiQuadradoChartPresets(), chiOutput);
    assertEveryControlChanges(buildCorrelacaoChartPresets('pearson'), correlationOutput);
    assertEveryControlChanges(buildCorrelacaoChartPresets('spearman'), rankOutput);
    assertEveryControlChanges(buildPraisTrendPresets(true), praisOutput);
    assertEveryControlChanges(buildPraisResidualPresets(), praisOutput);
    assertEveryControlChanges(buildLogisticaChartPresets(), logisticOutput);
    assertEveryControlChanges(buildPoissonChartPresets(), countOutput);
    assertEveryControlChanges(buildBinomialNegativaChartPresets(), negativeBinomialOutput);
  });
});
