import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import {
  buildTStudentDiffChartData,
  buildTStudentDistChartData,
  buildTStudentMeansBarChartData,
} from '@/shared/charts/chartFactories/tStudentCharts';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import { CHART_PRESET_LABELS, T_STUDENT_ANNOTATIONS, type TStudentMode } from './tStudentConfig';
import type { TStudentEngineOutput } from './tStudentEngine';

export const T_STUDENT_CHART_ANNOTATIONS = T_STUDENT_ANNOTATIONS;

export function buildTStudentChartPresets(): ChartPreset<TStudentEngineOutput>[] {
  return [
    {
      id: 'diff',
      label: CHART_PRESET_LABELS.diff,
      buildChart: ({ result }) => {
        const { data, options } = buildTStudentDiffChartData(result, undefined);
        return {
          type: 'scatter',
          data,
          options: mergeChartOptions(options, {
            plugins: {
              annotation: {
                annotations: {
                  ciLine: {
                    type: 'line',
                    xMin: result.ci[0],
                    xMax: result.ci[1],
                    yMin: 0,
                    yMax: 0,
                    borderColor: 'rgba(45, 212, 191, 0.9)',
                    borderWidth: 2,
                    display: true,
                  },
                  diffPoint: {
                    type: 'point',
                    xValue: result.diff,
                    yValue: 0,
                    backgroundColor: 'rgba(45, 212, 191, 1)',
                    radius: 8,
                    display: true,
                  },
                },
              },
            },
          }),
          ariaLabel: CHART_PRESET_LABELS.diff,
        };
      },
      defaultAxisLabels: { x: 'Diferença das médias', y: '' },
      annotationKeys: ['showConfidenceIntervals', 'showMeanValues'],
    },
    {
      id: 'distribution',
      label: CHART_PRESET_LABELS.distribution,
      buildChart: ({ g1, g2, labels }) => {
        const { data, options } = buildTStudentDistChartData(g1, g2, labels[0], labels[1]);
        return {
          type: 'bar',
          data,
          options,
          ariaLabel: CHART_PRESET_LABELS.distribution,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Valor médio' },
      annotationKeys: ['showMeanValues'],
    },
    {
      id: 'means-bar',
      label: CHART_PRESET_LABELS.meansBar,
      buildChart: ({ result, labels }) => {
        const { data, options } = buildTStudentMeansBarChartData(result, labels);
        return {
          type: 'bar',
          data,
          options,
          ariaLabel: CHART_PRESET_LABELS.meansBar,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Valor médio' },
      annotationKeys: ['showMeanValues'],
    },
  ];
}

export function getDefaultTStudentChartPreset(
  _mode: TStudentMode,
  _result: TStudentEngineOutput['result'],
  _labels: [string, string],
): string {
  return 'diff';
}

export const tStudentChartPresets = buildTStudentChartPresets();
