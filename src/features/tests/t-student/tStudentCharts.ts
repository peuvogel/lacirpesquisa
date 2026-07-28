import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import {
  buildTStudentDiffChartData,
  buildTStudentDistChartData,
  buildTStudentMeansBarChartData,
} from '@/shared/charts/chartFactories/tStudentCharts';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { CHART_PRESET_LABELS, T_STUDENT_ANNOTATIONS, type TStudentMode } from './tStudentConfig';
import type { TStudentEngineOutput } from './tStudentEngine';

export const T_STUDENT_CHART_ANNOTATIONS = T_STUDENT_ANNOTATIONS;

function meanValueAnnotations(means: number[], labels: string[]) {
  const annotations: Record<string, unknown> = {};
  means.forEach((mean, index) => {
    annotations[`showMeanValues_${index}`] = {
      type: 'label',
      xValue: labels[index],
      yValue: mean,
      content: fmtNumber(mean, 2),
      color: '#0F172A',
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: 4,
      padding: { top: 2, bottom: 2, left: 4, right: 4 },
      font: { size: 11, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
      yAdjust: -16,
      position: 'center',
      clip: false,
    };
  });
  return annotations;
}

function pValueAnnotation(content: string, xValue: string | number, yValue: number) {
  return {
    type: 'label' as const,
    xValue,
    yValue,
    content,
    color: '#334155',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 4,
    padding: { top: 2, bottom: 2, left: 5, right: 5 },
    font: { size: 11, weight: 'normal' as const, family: "'Sora', 'Helvetica Neue', sans-serif" },
    yAdjust: -18,
    xAdjust: 0,
    position: 'center' as const,
    clip: false,
  };
}

export function buildTStudentChartPresets(): ChartPreset<TStudentEngineOutput>[] {
  return [
    {
      id: 'diff',
      label: CHART_PRESET_LABELS.diff,
      visualType: 'range',
      buildChart: ({ result }) => {
        const { data, options } = buildTStudentDiffChartData(result, undefined);
        return {
          type: 'scatter',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 36, right: 28, bottom: 14, left: 14 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.diff,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                padding: { bottom: 10 },
              },
              annotation: {
                annotations: {
                  zeroLine: {
                    type: 'line',
                    xMin: 0,
                    xMax: 0,
                    borderColor: 'rgba(100, 116, 139, 0.45)',
                    borderWidth: 1,
                    borderDash: [4, 4],
                  },
                  showConfidenceIntervals: {
                    type: 'line',
                    xMin: result.ci[0],
                    xMax: result.ci[1],
                    yMin: 0,
                    yMax: 0,
                    borderColor: 'rgba(15, 118, 110, 0.9)',
                    borderWidth: 2.5,
                    display: true,
                  },
                  showMeanValues: {
                    type: 'label',
                    xValue: result.diff,
                    yValue: 0,
                    content: `Δ = ${fmtSigned(result.diff, 3)}`,
                    color: '#0F172A',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    borderRadius: 4,
                    padding: { top: 2, bottom: 2, left: 5, right: 5 },
                    font: { size: 11, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                    yAdjust: -22,
                    clip: false,
                  },
                  showPValue: {
                    type: 'label',
                    xValue: result.diff,
                    yValue: 0,
                    content: `p = ${fmtP(result.p)}`,
                    color: '#334155',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    borderRadius: 4,
                    padding: { top: 2, bottom: 2, left: 5, right: 5 },
                    font: { size: 11, weight: 'normal', family: "'Sora', 'Helvetica Neue', sans-serif" },
                    yAdjust: 22,
                    clip: false,
                  },
                },
              },
            },
            scales: {
              y: { min: -1.35, max: 1.35 },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.diff,
        };
      },
      defaultAxisLabels: { x: 'Diferença das médias', y: '' },
      annotationKeys: ['showConfidenceIntervals', 'showMeanValues', 'showPValue'],
    },
    {
      id: 'distribution',
      label: CHART_PRESET_LABELS.distribution,
      visualType: 'grouped-columns',
      buildChart: ({ g1, g2, labels, result }) => {
        const { data, options } = buildTStudentDistChartData(g1, g2, labels[0], labels[1]);
        const means = [result.m1, result.m2];
        const peak = Math.max(...means, 0);
        return {
          type: 'bar',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 36, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.distribution,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                padding: { bottom: 10 },
              },
              annotation: {
                annotations: {
                  ...meanValueAnnotations(means, [labels[0], labels[1]]),
                  showPValue: pValueAnnotation(
                    `p = ${fmtP(result.p)}`,
                    labels[1],
                    peak,
                  ),
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                grace: '22%',
              },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.distribution,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Valor médio' },
      annotationKeys: ['showMeanValues', 'showPValue'],
    },
    {
      id: 'means-bar',
      label: CHART_PRESET_LABELS.meansBar,
      visualType: 'column',
      buildChart: ({ result, labels }) => {
        const { data, options } = buildTStudentMeansBarChartData(result, labels);
        const means = [result.m1, result.m2];
        const peak = Math.max(...means, 0);
        return {
          type: 'bar',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 36, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.meansBar,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                padding: { bottom: 10 },
              },
              annotation: {
                annotations: {
                  ...meanValueAnnotations(means, [labels[0], labels[1]]),
                  showPValue: pValueAnnotation(
                    `p = ${fmtP(result.p)}`,
                    labels[1],
                    peak,
                  ),
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                grace: '22%',
              },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.meansBar,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Valor médio' },
      annotationKeys: ['showMeanValues', 'showPValue'],
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
