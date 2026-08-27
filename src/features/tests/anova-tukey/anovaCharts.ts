import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import { buildAnovaMeansChartData } from '@/shared/charts/chartFactories/anovaChart';
import { buildPostHocHeatmapChartData } from '@/shared/charts/chartFactories/postHocHeatmapChart';
import { buildGroupedRawDotChartData } from '@/shared/charts/chartFactories/groupedRawDotChart';
import { buildBoxPlotChartData } from '@/shared/charts/chartFactories/boxPlotChart';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import { fmtNumber, fmtP } from '@/shared/format';
import { ANOVA_ANNOTATIONS, CHART_PRESET_LABELS } from './anovaConfig';
import type { AnovaEngineOutput } from './anovaEngine';

export const ANOVA_CHART_ANNOTATIONS = ANOVA_ANNOTATIONS;

export function buildAnovaChartPresets(groupCount: number): ChartPreset<AnovaEngineOutput>[] {
  const presets: ChartPreset<AnovaEngineOutput>[] = [
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
      id: 'means',
      label: CHART_PRESET_LABELS.means,
      visualType: 'range',
      buildChart: (output) => {
        const { data, options } = buildAnovaMeansChartData({
          groupOrder: output.groupOrder,
          result: output.result,
        });
        return {
          type: 'scatter',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 36, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.means,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
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
                        yValue: output.result.groupStats[label].mean,
                        content: fmtNumber(output.result.groupStats[label].mean, 2),
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
                  showPValue: {
                    type: 'label',
                    xValue: output.groupOrder[output.groupOrder.length - 1],
                    yValue: Math.max(...output.groupOrder.map((label) => output.result.groupStats[label].mean)),
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
          ariaLabel: CHART_PRESET_LABELS.means,
        };
      },
      defaultAxisLabels: { x: 'Grupo', y: 'Média do desfecho' },
      capabilities: [
        { id: 'showConfidenceIntervals', kind: 'annotationVisibility', annotationPrefixes: ['showConfidenceIntervals_'] },
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
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
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

export function getDefaultAnovaChartPreset(): string {
  return 'raw-data';
}

export function buildAnovaChartPresetsForOutput(output: AnovaEngineOutput): ChartPreset<AnovaEngineOutput>[] {
  return buildAnovaChartPresets(output.groupOrder.length);
}
