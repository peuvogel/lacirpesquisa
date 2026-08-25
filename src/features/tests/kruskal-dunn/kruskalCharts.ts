import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import { buildAnovaMeansChartData } from '@/shared/charts/chartFactories/anovaChart';
import { buildPostHocHeatmapChartData } from '@/shared/charts/chartFactories/postHocHeatmapChart';
import { buildGroupedRawDotChartData } from '@/shared/charts/chartFactories/groupedRawDotChart';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import type { OneWayAnovaResult } from '@/shared/stats/statsEngine';
import { statsEngine } from '@/shared/stats/statsEngine';
import { fmtNumber } from '@/shared/format';
import { CHART_PRESET_LABELS, KRUSKAL_ANNOTATIONS } from './kruskalConfig';
import type { KruskalEngineOutput } from './kruskalEngine';

export const KRUSKAL_CHART_ANNOTATIONS = KRUSKAL_ANNOTATIONS;

function toMedianChartInput(output: KruskalEngineOutput): {
  groupOrder: string[];
  result: OneWayAnovaResult;
} {
  const groupStats: OneWayAnovaResult['groupStats'] = {};
  output.groupOrder.forEach((label) => {
    const summary = output.result.groupSummaries[label];
    const values = output.groups[label];
    groupStats[label] = {
      n: summary.n,
      mean: summary.median,
      sd: values.length >= 2 ? statsEngine.sd(values) : 0,
    };
  });

  return {
    groupOrder: output.groupOrder,
    result: {
      f: 0,
      dfBetween: output.result.df,
      dfWithin: 0,
      p: output.result.p,
      eta2: 0,
      msWithin: 0,
      groupStats,
    },
  };
}

export function buildKruskalChartPresets(groupCount: number): ChartPreset<KruskalEngineOutput>[] {
  const presets: ChartPreset<KruskalEngineOutput>[] = [
    {
      id: 'raw-data',
      label: CHART_PRESET_LABELS.rawData,
      visualType: 'dot',
      buildChart: (output) => {
        const { data, options } = buildGroupedRawDotChartData(
          output.groups,
          output.groupOrder,
          output.headers.outcome,
        );
        return {
          type: 'scatter',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 28, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.rawData,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
              },
            },
          }),
          ariaLabel: CHART_PRESET_LABELS.rawData,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Valor observado' },
      annotationKeys: [],
    },
    {
      id: 'medians',
      label: CHART_PRESET_LABELS.medians,
      visualType: 'column',
      buildChart: (output) => {
        const chartInput = toMedianChartInput(output);
        const { data, options } = buildAnovaMeansChartData(chartInput);
        return {
          type: 'bar',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 36, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.medians,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                padding: { bottom: 10 },
              },
              annotation: {
                annotations: Object.fromEntries(
                  output.groupOrder.map((label, index) => [
                    `showMeanValues_${index}`,
                    {
                      type: 'label',
                      xValue: label,
                      yValue: output.result.groupSummaries[label].median,
                      content: fmtNumber(output.result.groupSummaries[label].median, 2),
                      color: '#0F172A',
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      borderRadius: 4,
                      padding: { top: 2, bottom: 2, left: 4, right: 4 },
                      font: { size: 11, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                      yAdjust: -16,
                      clip: false,
                    },
                  ]),
                ),
              },
            },
            scales: {
              y: { beginAtZero: true, grace: '22%' },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.medians,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Mediana do desfecho' },
      annotationKeys: ['showConfidenceIntervals', 'showMeanValues', 'showPValue'],
    },
  ];

  if (groupCount <= 6) {
    presets.push({
      id: 'heatmap',
      label: CHART_PRESET_LABELS.heatmap,
      visualType: 'scatter',
      buildChart: (output) => {
        const { data, options } = buildPostHocHeatmapChartData(output.groupOrder, output.pairwise);
        return {
          type: 'scatter',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 28, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.heatmap,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                padding: { bottom: 10 },
              },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.heatmap,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Grupo' },
      annotationKeys: [],
    });
  }

  return presets;
}

export function getDefaultKruskalChartPreset(): string {
  return 'raw-data';
}

export function buildKruskalChartPresetsForOutput(
  output: KruskalEngineOutput,
): ChartPreset<KruskalEngineOutput>[] {
  return buildKruskalChartPresets(output.groupOrder.length);
}
