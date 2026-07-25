import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import { buildContingencyChartData } from '@/shared/charts/chartFactories/contingencyChart';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import { fmtNumber, fmtP } from '@/shared/format';
import {
  CHART_PRESET_LABELS,
  QUI_QUADRADO_ANNOTATIONS,
} from './quiQuadradoConfig';
import type { QuiQuadradoEngineOutput } from './quiQuadradoEngine';

export const QUI_QUADRADO_CHART_ANNOTATIONS = QUI_QUADRADO_ANNOTATIONS;

function countAnnotations(
  observed: number[][],
  rowLabels: string[],
  colLabels: string[],
): Record<string, unknown> {
  const annotations: Record<string, unknown> = {};
  let index = 0;
  for (let row = 0; row < rowLabels.length; row += 1) {
    for (let col = 0; col < colLabels.length; col += 1) {
      const label = `${rowLabels[row]} · ${colLabels[col]}`;
      const value = observed[row][col];
      annotations[`showCellCounts_${index}`] = {
        type: 'label',
        xValue: label,
        yValue: value,
        content: String(value),
        color: '#0F172A',
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: 4,
        padding: { top: 2, bottom: 2, left: 4, right: 4 },
        font: { size: 10, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
        yAdjust: -14,
        clip: false,
      };
      index += 1;
    }
  }
  return annotations;
}

export function buildQuiQuadradoChartPresets(): ChartPreset<QuiQuadradoEngineOutput>[] {
  return [
    {
      id: 'contingency-default',
      label: CHART_PRESET_LABELS.contingency,
      visualType: 'grouped-columns',
      buildChart: (output) => {
        const { dataset, result } = output;
        const { data, options } = buildContingencyChartData({
          observed: dataset.table,
          expected: result.expected,
          rowLabels: dataset.rowLabels,
          colLabels: dataset.colLabels,
          rowHeader: dataset.columnHeaders[0],
          colHeader: dataset.columnHeaders[1],
        });

        const peak = Math.max(...dataset.table.flat(), 0);

        return {
          type: 'bar',
          data,
          options: mergeChartOptions(options, {
            layout: { padding: { top: 40, right: 18, bottom: 10, left: 10 } },
            plugins: {
              title: {
                display: true,
                text: CHART_PRESET_LABELS.contingency,
                color: '#1E293B',
                font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
                padding: { bottom: 10 },
              },
              annotation: {
                annotations: {
                  ...countAnnotations(dataset.table, dataset.rowLabels, dataset.colLabels),
                  showPValue: {
                    type: 'label',
                    xValue: `${dataset.rowLabels[0]} · ${dataset.colLabels[0]}`,
                    yValue: peak,
                    content: `p = ${fmtP(result.p)}`,
                    color: '#334155',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    borderRadius: 4,
                    padding: { top: 2, bottom: 2, left: 5, right: 5 },
                    font: {
                      size: 11,
                      weight: 'normal',
                      family: "'Sora', 'Helvetica Neue', sans-serif",
                    },
                    yAdjust: -28,
                    clip: false,
                  },
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
          ariaLabel: CHART_PRESET_LABELS.contingency,
        };
      },
      defaultAxisLabels: { x: 'Células da tabela', y: 'Contagem' },
      annotationKeys: ['showCellCounts', 'showPValue'],
    },
  ];
}

export function getDefaultQuiQuadradoChartPreset(): string {
  return 'contingency-default';
}

export const quiQuadradoChartPresets = buildQuiQuadradoChartPresets();
