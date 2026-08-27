import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import { buildPointIntervalChartData } from '@/shared/charts/chartFactories/pointIntervalChart';
import { buildBoxPlotChartData, summarizeBoxPlot } from '@/shared/charts/chartFactories/boxPlotChart';
import { buildPostHocHeatmapChartData } from '@/shared/charts/chartFactories/postHocHeatmapChart';
import { buildGroupedRawDotChartData } from '@/shared/charts/chartFactories/groupedRawDotChart';
import { CHART_FONT_FAMILY, mergeChartOptions } from '@/shared/charts/chartTheme';
import { fmtNumber, fmtP } from '@/shared/format';
import { CHART_PRESET_LABELS, KRUSKAL_ANNOTATIONS } from './kruskalConfig';
import type { KruskalEngineOutput } from './kruskalEngine';

export const KRUSKAL_CHART_ANNOTATIONS = KRUSKAL_ANNOTATIONS;

export function buildKruskalMedianIqrChartData(output: KruskalEngineOutput) {
  return buildPointIntervalChartData({
    intervals: output.groupOrder.map((label) => {
      const summary = summarizeBoxPlot(output.groups[label] ?? []);
      return {
        label,
        estimate: summary.median,
        low: summary.n ? summary.q1 : null,
        high: summary.n ? summary.q3 : null,
      };
    }),
    orientation: 'vertical',
    estimateLabel: 'Mediana',
    intervalLabel: 'IQR',
    intervalAnnotationPrefix: 'showIqr',
    xTitle: 'Grupo',
    yTitle: output.headers.outcome,
  });
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
                font: { size: 13, weight: 'bold', family: CHART_FONT_FAMILY },
              },
            },
          }),
          ariaLabel: CHART_PRESET_LABELS.rawData,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Valor observado' },
      capabilities: [],
    },
    {
      id: 'boxplot',
      label: 'Boxplot por grupo',
      visualType: 'box-plot',
      buildChart: (output) => ({
        type: 'scatter',
        ...buildBoxPlotChartData(output.groups, output.groupOrder, output.headers.outcome),
        ariaLabel: 'Boxplot por grupo',
      }),
      defaultAxisLabels: { x: 'Grupo', y: 'Valor observado' },
      capabilities: [],
    },
    {
      id: 'medians',
      label: CHART_PRESET_LABELS.medians,
      visualType: 'range',
      buildChart: (output) => {
        const { data, options } = buildKruskalMedianIqrChartData(output);
        return {
          type: 'scatter',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 36, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.medians,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: CHART_FONT_FAMILY },
                padding: { bottom: 10 },
              },
              annotation: {
                annotations: {
                  ...Object.fromEntries(
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
                        font: { size: 11, weight: 'bold', family: CHART_FONT_FAMILY },
                        yAdjust: -16,
                        clip: false,
                      },
                    ]),
                  ),
                  showPValue: {
                    type: 'label',
                    xValue: output.groupOrder[output.groupOrder.length - 1],
                    yValue: Math.max(...output.groupOrder.map((label) => output.result.groupSummaries[label].median)),
                    content: `p omnibus = ${fmtP(output.result.p)}`,
                    color: '#334155',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    yAdjust: -32,
                    clip: false,
                  },
                },
              },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.medians,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Mediana do desfecho' },
      capabilities: [
        { id: 'showIqr', kind: 'annotationVisibility', annotationPrefixes: ['showIqr_'] },
        { id: 'showMeanValues', kind: 'annotationVisibility', annotationPrefixes: ['showMeanValues_'] },
        { id: 'showPValue', kind: 'annotationVisibility', annotationIds: ['showPValue'] },
      ],
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
                font: { size: 13, weight: 'bold', family: CHART_FONT_FAMILY },
                padding: { bottom: 10 },
              },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.heatmap,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Grupo' },
      capabilities: [],
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
