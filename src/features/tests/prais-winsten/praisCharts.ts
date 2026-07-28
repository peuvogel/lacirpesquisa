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

export function buildPraisTrendPresets(): ChartPreset<PraisEngineOutput>[] {
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
                annotations: {
                  showFittedLine: { display: true },
                  showPointLabels: { display: true },
                  logScaleY: { display: false },
                },
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
      annotationKeys: PRAIS_TREND_ANNOTATIONS.map((item) => item.id),
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
            y: 'Resíduos (log10)',
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
        y: 'Resíduo (escala log10)',
      },
      annotationKeys: PRAIS_RESIDUAL_ANNOTATIONS.map((item) => item.id),
    },
  ];
}

export const praisTrendPresets = buildPraisTrendPresets();
export const praisResidualPresets = buildPraisResidualPresets();

export function getDefaultPraisPresetId(tab: 'trend' | 'residual'): string {
  return tab === 'trend' ? 'trend' : 'residual';
}
