import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import {
  buildRankScatterChartData,
  buildScatterChartData,
  buildScatterWithFitChartData,
  buildSpearmanRankDiagnostics,
} from '@/shared/charts/chartFactories/scatterChart';
import { CHART_FONT_FAMILY, mergeChartOptions } from '@/shared/charts/chartTheme';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { statsEngine } from '@/shared/stats/statsEngine';
import {
  CHART_PRESET_LABELS,
  CORRELACAO_ANNOTATIONS,
  type CorrelacaoMethod,
} from './correlacaoConfig';
import type { CorrelacaoEngineOutput } from './correlacaoEngine';

export const CORRELACAO_CHART_ANNOTATIONS = CORRELACAO_ANNOTATIONS;

function scatterDataset(output: CorrelacaoEngineOutput) {
  return {
    x: output.x,
    y: output.y,
    labels: output.labels,
    headers: output.headers,
  };
}

function coefLabel(output: CorrelacaoEngineOutput): string {
  if (output.method === 'spearman') {
    return `ρ = ${fmtSigned(output.spearman.coef, 3)}  ·  p = ${fmtP(output.spearman.p)}`;
  }
  return `r = ${fmtSigned(output.pearson.coef, 3)}  ·  p = ${fmtP(output.pearson.p)}`;
}

function withCoefAnnotation(
  output: CorrelacaoEngineOutput,
  options: ReturnType<typeof buildScatterChartData>['options'],
  xValue: number,
  yValue: number,
  extraLines: string[] = [],
) {
  const content = extraLines.length ? [...extraLines, coefLabel(output)] : coefLabel(output);

  return mergeChartOptions(options, {
    layout: { padding: { top: 36, right: 20, bottom: 10, left: 12 } },
    plugins: {
      annotation: {
        annotations: {
          showEquation: {
            type: 'label',
            xValue,
            yValue,
            content,
            color: '#334155',
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderRadius: 4,
            padding: 6,
            font: { size: 11, family: CHART_FONT_FAMILY },
            yAdjust: 14,
            xAdjust: 0,
            position: 'start',
            clip: false,
            display: true,
          },
        },
      },
    },
    scales: {
      y: { grace: '14%' },
      x: { grace: '6%' },
    },
  } as Parameters<typeof mergeChartOptions>[1]);
}

/** Onde a anotação de coeficiente encosta: meio do eixo x, base do eixo y. */
function coefAnchor(output: CorrelacaoEngineOutput) {
  return {
    midX: (Math.min(...output.x) + Math.max(...output.x)) / 2,
    minY: Math.min(...output.y),
  };
}

/** Só o coeficiente e o p, sem a equação da reta — para o gráfico sem reta. */
function withCoefOnly(
  output: CorrelacaoEngineOutput,
  options: ReturnType<typeof buildScatterChartData>['options'],
) {
  const { midX, minY } = coefAnchor(output);
  return withCoefAnnotation(output, options, midX, minY);
}

function withPearsonEquation(
  output: CorrelacaoEngineOutput,
  options: ReturnType<typeof buildScatterChartData>['options'],
) {
  const { headers } = output;
  const { midX, minY } = coefAnchor(output);
  const extra: string[] = [];

  if (output.method === 'pearson') {
    const { pearson } = output;
    const sign = pearson.slope >= 0 ? '+' : '-';
    extra.push(
      `${headers[1]} = ${fmtNumber(pearson.intercept, 2)} ${sign} ${fmtNumber(Math.abs(pearson.slope), 2)} × ${headers[0]}`,
    );
  }

  return withCoefAnnotation(output, options, midX, minY, extra);
}

export function buildCorrelacaoChartPresets(
  method: CorrelacaoMethod = 'pearson',
  hasOutliers = true,
): ChartPreset<CorrelacaoEngineOutput>[] {
  const scatter: ChartPreset<CorrelacaoEngineOutput> = {
    id: 'scatter',
    label: CHART_PRESET_LABELS.scatter,
    visualType: 'scatter',
    buildChart: (output) => {
      // Nuvem pura: reta e equação são justamente o que distingue o preset
      // "Dispersão + linha de ajuste". Desenhá-las aqui fazia, no Pearson, os
      // dois tipos de gráfico saírem idênticos.
      const { data, options } = buildScatterChartData(
        scatterDataset(output),
        null,
        output.outlierFlags,
        { includeRegressionLine: false },
      );
      return {
        type: 'scatter',
        data,
        options: withCoefOnly(output, options),
        ariaLabel: CHART_PRESET_LABELS.scatter,
      };
    },
    defaultAxisLabels: { x: '', y: '' },
    capabilities: [
      ...(hasOutliers
        ? [{
            id: 'highlightOutliers',
            kind: 'datasetVisibility' as const,
            datasetIds: ['outlier-points'],
            disabledBehavior: 'merge' as const,
            mergeIntoDatasetId: 'observed-points',
          }]
        : []),
      { id: 'showEquation', kind: 'annotationVisibility', annotationIds: ['showEquation'] },
    ],
  };

  const rankScatter: ChartPreset<CorrelacaoEngineOutput> = {
    id: 'rank-scatter',
    label: CHART_PRESET_LABELS.rankScatter,
    visualType: 'dot',
    buildChart: (output) => {
      const diagnostics = buildSpearmanRankDiagnostics(output.x, output.y);
      const { data, options } = buildRankScatterChartData(scatterDataset(output), diagnostics);
      const ranksX = statsEngine.rank(output.x);
      const ranksY = statsEngine.rank(output.y);
      const midX = (Math.min(...ranksX) + Math.max(...ranksX)) / 2;
      const minY = Math.min(...ranksY);
      return {
        type: 'scatter',
        data,
        options: withCoefAnnotation(output, options, midX, minY),
        ariaLabel: CHART_PRESET_LABELS.rankScatter,
      };
    },
    defaultAxisLabels: { x: '', y: '' },
    capabilities: [
      {
        id: 'highlightOutliers',
        kind: 'datasetVisibility',
        datasetIds: ['rank-gap-points'],
        disabledBehavior: 'merge',
        mergeIntoDatasetId: 'rank-points',
      },
      { id: 'showEquation', kind: 'annotationVisibility', annotationIds: ['showEquation'] },
    ],
  };

  const scatterWithFit: ChartPreset<CorrelacaoEngineOutput> = {
    id: 'scatter-with-fit',
    label: CHART_PRESET_LABELS.scatterWithFit,
    visualType: 'lines',
    buildChart: (output) => {
      // OLS fit is only meaningful for Pearson; Spearman uses rank-scatter instead.
      const fit = output.pearson;
      const { data, options } = buildScatterWithFitChartData(
        output.x,
        output.y,
        fit,
        output.labels,
        output.headers,
        output.outlierFlags,
      );
      return {
        type: 'scatter',
        data,
        options: withPearsonEquation(output, options),
        ariaLabel: CHART_PRESET_LABELS.scatterWithFit,
      };
    },
    defaultAxisLabels: { x: '', y: '' },
    capabilities: [
      { id: 'showRegressionLine', kind: 'datasetVisibility', datasetIds: ['regression-fit'] },
      ...(hasOutliers
        ? [{
            id: 'highlightOutliers',
            kind: 'datasetVisibility' as const,
            datasetIds: ['outlier-points'],
            disabledBehavior: 'merge' as const,
            mergeIntoDatasetId: 'observed-points',
          }]
        : []),
      { id: 'showEquation', kind: 'annotationVisibility', annotationIds: ['showEquation'] },
    ],
  };

  if (method === 'spearman') {
    return [rankScatter, scatter];
  }
  return [scatter, scatterWithFit];
}

export function getDefaultCorrelacaoChartPreset(method: CorrelacaoMethod): string {
  return method === 'spearman' ? 'rank-scatter' : 'scatter';
}

/** @deprecated Prefer buildCorrelacaoChartPresets(method) for method-aware galleries. */
export const correlacaoChartPresets = buildCorrelacaoChartPresets('pearson');
