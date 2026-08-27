import { describe, expect, it } from 'vitest';
import { applyChartCapabilities } from './chartCapabilities';
import { buildTStudentChartPresets } from '@/features/tests/t-student/tStudentCharts';
import { mannWhitneyChartPresets } from '@/features/tests/mann-whitney/mannWhitneyCharts';
import { buildAnovaChartPresets } from '@/features/tests/anova-tukey/anovaCharts';
import { buildKruskalChartPresets } from '@/features/tests/kruskal-dunn/kruskalCharts';
import { buildQuiQuadradoChartPresets } from '@/features/tests/qui-quadrado/quiQuadradoCharts';
import { buildCorrelacaoChartPresets } from '@/features/tests/correlacao/correlacaoCharts';
import {
  buildPraisResidualPresets,
  buildPraisTrendPresets,
} from '@/features/tests/prais-winsten/praisCharts';
import { buildLogisticaChartPresets } from '@/features/tests/logistica/logisticaCharts';
import { buildPoissonChartPresets } from '@/features/tests/poisson/poissonCharts';
import type { AnovaEngineOutput } from '@/features/tests/anova-tukey/anovaEngine';
import type { KruskalEngineOutput } from '@/features/tests/kruskal-dunn/kruskalEngine';
import type { PraisEngineOutput } from '@/features/tests/prais-winsten/praisEngine';
import type { LogisticaEngineOutput } from '@/features/tests/logistica/logisticaEngine';
import type { PoissonEngineOutput } from '@/features/tests/poisson/poissonEngine';

function annotationsOf(chart: { options?: unknown }) {
  return ((chart.options as {
    plugins?: { annotation?: { annotations?: Record<string, unknown> } };
  })?.plugins?.annotation?.annotations) ?? {};
}

describe('group-comparison preset coverage', () => {
  it('adds boxplots to independent group tests and pairing links only to paired t', () => {
    expect(buildTStudentChartPresets('independent').map((preset) => preset.id)).toContain('boxplot');
    expect(buildTStudentChartPresets('independent').map((preset) => preset.id)).not.toContain('paired');
    expect(buildTStudentChartPresets('paired').map((preset) => preset.id)).toContain('paired');
    expect(mannWhitneyChartPresets.map((preset) => preset.id)).toEqual(['boxplot', 'rank-dot']);
    expect(buildAnovaChartPresets(3).map((preset) => preset.id)).toContain('boxplot');
    expect(buildKruskalChartPresets(3).map((preset) => preset.id)).toContain('boxplot');
  });

  it('makes ANOVA confidence, mean and omnibus-p controls alter real annotations', () => {
    const output = {
      groups: { A: [8, 10, 12], B: [15, 18, 21] },
      groupOrder: ['A', 'B'],
      headers: { outcome: 'Valor', group: 'Grupo' },
      result: {
        f: 8,
        dfBetween: 1,
        dfWithin: 4,
        p: 0.01,
        eta2: 0.5,
        msWithin: 2,
        groupStats: {
          A: { n: 3, mean: 10, sd: 2 },
          B: { n: 3, mean: 18, sd: 3 },
        },
        pairwise: [],
      },
      pairwise: [],
      nudges: [],
    } as unknown as AnovaEngineOutput;
    const preset = buildAnovaChartPresets(2).find((item) => item.id === 'means')!;
    const chart = preset.buildChart(output);
    const hidden = applyChartCapabilities(chart, {
      showConfidenceIntervals: false,
      showMeanValues: false,
      showPValue: false,
    }, preset.capabilities);

    expect(Object.keys(annotationsOf(chart))).toEqual(expect.arrayContaining([
      expect.stringMatching(/^showConfidenceIntervals_/),
      expect.stringMatching(/^showMeanValues_/),
      'showPValue',
    ]));
    expect(Object.keys(annotationsOf(hidden)).some((key) => key.startsWith('show'))).toBe(false);
  });

  it('makes Kruskal IQR, median and omnibus-p controls alter real annotations', () => {
    const output = {
      groups: { A: [1, 2, 3, 4], B: [8, 9, 10, 11] },
      groupOrder: ['A', 'B'],
      headers: { outcome: 'Valor', group: 'Grupo' },
      result: {
        h: 6,
        df: 1,
        p: 0.02,
        groupSummaries: {
          A: { n: 4, median: 2.5, meanRank: 2.5 },
          B: { n: 4, median: 9.5, meanRank: 6.5 },
        },
        pairwise: [],
      },
      pairwise: [],
      nudges: [],
    } as unknown as KruskalEngineOutput;
    const preset = buildKruskalChartPresets(2).find((item) => item.id === 'medians')!;
    const chart = preset.buildChart(output);
    const hidden = applyChartCapabilities(chart, {
      showIqr: false,
      showMeanValues: false,
      showPValue: false,
    }, preset.capabilities);

    expect(Object.keys(annotationsOf(chart))).toContain('showPValue');
    expect(Object.keys(annotationsOf(hidden)).some((key) => key.startsWith('show'))).toBe(false);
  });
});

describe('test-specific preset capabilities', () => {
  it('offers proportions and standardized residuals for chi-square', () => {
    expect(buildQuiQuadradoChartPresets().map((preset) => preset.id)).toEqual([
      'contingency-default',
      'proportions',
      'residuals',
    ]);
  });

  it('keeps OLS fit controls and presets exclusive to Pearson', () => {
    const pearson = buildCorrelacaoChartPresets('pearson');
    const spearman = buildCorrelacaoChartPresets('spearman');
    expect(pearson.find((preset) => preset.id === 'scatter-with-fit')?.capabilities
      .map((capability) => capability.id)).toContain('showRegressionLine');
    expect(spearman.flatMap((preset) => preset.capabilities.map((capability) => capability.id)))
      .not.toContain('showRegressionLine');
    expect(buildCorrelacaoChartPresets('pearson', false)
      .flatMap((preset) => preset.capabilities.map((capability) => capability.id)))
      .not.toContain('highlightOutliers');
  });

  it('uses real time x spacing and functional Prais fitted, label, log and zero-line controls', () => {
    const output = {
      fitted: [10, 11, 15],
      residuals: [-0.2, 0.1, 0.3],
      model: { scale: 'log' },
      dataset: {
        time: [2019, 2020, 2022.5],
        values: [9, 12, 14],
        orderedRows: [
          { timeLabel: '2019' },
          { timeLabel: '2020' },
          { timeLabel: '2022-07' },
        ],
        timeHeaderLabel: 'Período',
        yHeaderLabel: 'Taxa',
      },
    } as unknown as PraisEngineOutput;
    const trendPreset = buildPraisTrendPresets(true)[0]!;
    const trend = trendPreset.buildChart(output);
    const observed = trend.data.datasets.find((dataset) => dataset.lacirId === 'observed');
    expect(observed?.data).toEqual([
      expect.objectContaining({ x: 2019, y: 9 }),
      expect.objectContaining({ x: 2020, y: 12 }),
      expect.objectContaining({ x: 2022.5, y: 14 }),
    ]);
    expect(Object.keys(annotationsOf(trend))).toContain('showPointLabels_0');

    const changed = applyChartCapabilities(trend, {
      showFittedLine: false,
      showPointLabels: false,
      logScaleY: true,
    }, trendPreset.capabilities);
    expect(changed.data.datasets.find((dataset) => dataset.lacirId === 'fitted')?.hidden).toBe(true);
    expect(changed.options?.scales?.y).toMatchObject({ type: 'logarithmic' });
    expect(Object.keys(annotationsOf(changed)).some((key) => key.startsWith('showPointLabels')))
      .toBe(false);

    const residualPreset = buildPraisResidualPresets()[0]!;
    const residual = residualPreset.buildChart(output);
    const withoutZero = applyChartCapabilities(
      residual,
      { showZeroLine: false },
      residualPreset.capabilities,
    );
    expect(annotationsOf(residual).zeroLine).toBeDefined();
    expect(annotationsOf(withoutZero).zeroLine).toBeUndefined();
    expect(buildPraisTrendPresets(false)[0]!.capabilities.map((capability) => capability.id))
      .not.toContain('logScaleY');
  });

  it('makes GLM interval/value/reference controls target concrete geometry', () => {
    const coefficient = { term: 'dose', beta: 0.4, se: 0.1, z: 4, p: 0.001 };
    const logisticOutput = {
      result: { coefficients: [coefficient], oddsRatios: [], converged: true },
    } as unknown as LogisticaEngineOutput;
    const forestPreset = buildLogisticaChartPresets()[0]!;
    const forest = forestPreset.buildChart(logisticOutput);
    const hidden = applyChartCapabilities(forest, {
      showConfidenceIntervals: false,
      showCoefficientValues: false,
    }, forestPreset.capabilities);
    expect(Object.keys(annotationsOf(forest))).toEqual(expect.arrayContaining([
      expect.stringMatching(/^showConfidenceIntervals_/),
      expect.stringMatching(/^showCoefficientValues_/),
    ]));
    expect(Object.keys(annotationsOf(hidden))).toEqual(['showReferenceLine']);

    const poissonOutput = {
      dataset: {
        y: [1, 2],
        design: { matrix: [[1], [2]], terms: ['dose'] },
      },
      result: { coefficients: [coefficient] },
    } as unknown as PoissonEngineOutput;
    const predictedPreset = buildPoissonChartPresets().find((preset) => preset.id === 'predicted')!;
    const predicted = predictedPreset.buildChart(poissonOutput);
    const withoutReference = applyChartCapabilities(
      predicted,
      { showReferenceLine: false },
      predictedPreset.capabilities,
    );
    expect(withoutReference.data.datasets.find((dataset) => dataset.lacirId === 'reference-line')?.hidden)
      .toBe(true);
  });
});
