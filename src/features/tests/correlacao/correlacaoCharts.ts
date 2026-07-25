import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import {
  buildRankScatterChartData,
  buildScatterChartData,
  buildScatterWithFitChartData,
} from '@/shared/charts/chartFactories/scatterChart';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import { fmtNumber, fmtSigned } from '@/shared/format';
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

function withEquationAnnotation(output: CorrelacaoEngineOutput, options: ReturnType<typeof buildScatterChartData>['options']) {
  const { pearson, headers } = output;
  const sign = pearson.slope >= 0 ? '+' : '-';
  const equation = `${headers[1]} = ${fmtNumber(pearson.intercept, 2)} ${sign} ${fmtNumber(Math.abs(pearson.slope), 2)} x ${headers[0]}`;
  return mergeChartOptions(options, {
    plugins: {
      annotation: {
        annotations: {
          showEquation: {
            type: 'label',
            xValue: 'center',
            yValue: 'start',
            content: equation,
            font: { size: 11 },
            display: true,
          },
        },
      },
    },
  });
}

export function buildCorrelacaoChartPresets(): ChartPreset<CorrelacaoEngineOutput>[] {
  return [
    {
      id: 'scatter',
      label: CHART_PRESET_LABELS.scatter,
      buildChart: (output) => {
        const { data, options } = buildScatterChartData(
          scatterDataset(output),
          output.pearson,
          output.outlierFlags,
        );
        return {
          type: 'scatter',
          data,
          options: withEquationAnnotation(output, options),
          ariaLabel: CHART_PRESET_LABELS.scatter,
        };
      },
      defaultAxisLabels: { x: 'variavel_x', y: 'variavel_y' },
      annotationKeys: ['showRegressionLine', 'highlightOutliers', 'showEquation'],
    },
    {
      id: 'rank-scatter',
      label: CHART_PRESET_LABELS.rankScatter,
      buildChart: (output) => {
        const { data, options } = buildRankScatterChartData(scatterDataset(output));
        return {
          type: 'scatter',
          data,
          options,
          ariaLabel: CHART_PRESET_LABELS.rankScatter,
        };
      },
      defaultAxisLabels: { x: 'Posto de X', y: 'Posto de Y' },
      annotationKeys: ['highlightOutliers'],
    },
    {
      id: 'scatter-with-fit',
      label: CHART_PRESET_LABELS.scatterWithFit,
      buildChart: (output) => {
        const { data, options } = buildScatterWithFitChartData(
          output.x,
          output.y,
          output.pearson,
          output.labels,
          output.headers,
        );
        return {
          type: 'scatter',
          data,
          options: withEquationAnnotation(output, options),
          ariaLabel: CHART_PRESET_LABELS.scatterWithFit,
        };
      },
      defaultAxisLabels: { x: 'variavel_x', y: 'variavel_y' },
      annotationKeys: ['showRegressionLine', 'highlightOutliers', 'showEquation'],
    },
  ];
}

export function getDefaultCorrelacaoChartPreset(method: CorrelacaoMethod): string {
  return method === 'spearman' ? 'rank-scatter' : 'scatter';
}

export const correlacaoChartPresets = buildCorrelacaoChartPresets();
