import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import {
  buildResidualBarChartData,
  buildTimeseriesChartData,
} from '@/shared/charts/chartFactories';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import {
  CHART_PRESET_LABELS,
  PRAIS_RESIDUAL_ANNOTATIONS,
  PRAIS_TREND_ANNOTATIONS,
} from './praisConfig';
import type { PraisEngineOutput } from './praisEngine';

export { PRAIS_TREND_ANNOTATIONS, PRAIS_RESIDUAL_ANNOTATIONS };

export function buildPraisTrendPresets(
  logScaleAvailable = true,
): ChartPreset<PraisEngineOutput>[] {
  return [
    {
      id: 'trend',
      label: CHART_PRESET_LABELS.trend,
      visualType: 'multiple-lines',
      buildChart: (output) => {
        const pointLabels = output.dataset.orderedRows.map((row) => row.timeLabel);
        const { data, options } = buildTimeseriesChartData(
          output.dataset.time,
          output.dataset.values,
          output.fitted,
          pointLabels,
          {
            x: output.dataset.timeHeaderLabel,
            y: output.dataset.yHeaderLabel,
          },
        );

        return {
          type: 'line',
          data,
          options: mergeChartOptions(options, {
            plugins: {
              annotation: {
                annotations: Object.fromEntries(
                  output.dataset.orderedRows.map((row, index) => [
                    `showPointLabels_${index}`,
                    {
                      type: 'label',
                      xValue: output.dataset.time[index],
                      yValue: output.dataset.values[index],
                      content: row.timeLabel,
                      color: '#334155',
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      yAdjust: -15,
                      clip: false,
                    },
                  ]),
                ),
              },
            },
          }),
          ariaLabel: CHART_PRESET_LABELS.trend,
        };
      },
      defaultAxisLabels: {
        x: 'Período',
        y: 'Valor',
      },
      capabilities: [
        { id: 'showFittedLine', kind: 'datasetVisibility', datasetIds: ['fitted'] },
        { id: 'showPointLabels', kind: 'annotationVisibility', annotationPrefixes: ['showPointLabels_'] },
        ...(logScaleAvailable
          ? [{
              id: 'logScaleY',
              kind: 'scaleType' as const,
              axis: 'y' as const,
              enabledType: 'logarithmic' as const,
              disabledType: 'linear' as const,
              defaultEnabled: false,
            }]
          : []),
      ],
    },
  ];
}

export function buildPraisResidualPresets(): ChartPreset<PraisEngineOutput>[] {
  return [
    {
      id: 'residual',
      label: CHART_PRESET_LABELS.residual,
      visualType: 'column',
      buildChart: (output) => {
        const pointLabels = output.dataset.orderedRows.map((row) => row.timeLabel);
        const { data, options } = buildResidualBarChartData(
          output.dataset.time,
          output.residuals,
          pointLabels,
          {
            x: output.dataset.timeHeaderLabel,
            y: output.model.scale === 'log' ? 'Resíduos (log10)' : 'Resíduos (escala original)',
          },
        );

        return {
          type: 'bar',
          data,
          options,
          ariaLabel: CHART_PRESET_LABELS.residual,
        };
      },
      defaultAxisLabels: {
        x: 'Período',
        y: 'Resíduo',
      },
      capabilities: [
        { id: 'showZeroLine', kind: 'annotationVisibility', annotationIds: ['zeroLine'] },
      ],
    },
  ];
}

export const praisTrendPresets = buildPraisTrendPresets(true);
export const praisResidualPresets = buildPraisResidualPresets();

export function getDefaultPraisPresetId(tab: 'trend' | 'residual'): string {
  return tab === 'trend' ? 'trend' : 'residual';
}
