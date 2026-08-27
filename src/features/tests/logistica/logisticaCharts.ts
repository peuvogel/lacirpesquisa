import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import { buildGlmCoefForestChartData } from '@/shared/charts/chartFactories/glmCoefForestChart';
import { mergeChartOptions } from '@/shared/charts/chartTheme';
import {
  CHART_PRESET_LABELS,
  LOGISTICA_ANNOTATIONS,
} from './logisticaConfig';
import type { LogisticaEngineOutput } from './logisticaEngine';

export const LOGISTICA_CHART_ANNOTATIONS = LOGISTICA_ANNOTATIONS;

export function buildLogisticaChartPresets(): ChartPreset<LogisticaEngineOutput>[] {
  return [
    {
      id: 'forest',
      label: CHART_PRESET_LABELS.forest,
      visualType: 'range',
      buildChart: (output) => {
        const { data, options } = buildGlmCoefForestChartData({
          coefficients: output.result.coefficients,
          scale: 'or',
          title: CHART_PRESET_LABELS.forest,
        });
        return {
          type: 'scatter',
          data,
          options: mergeChartOptions(options, {
            plugins: {
              annotation: {
                annotations: {
                  showReferenceLine: {
                    type: 'line',
                    xMin: 1,
                    xMax: 1,
                    borderColor: 'rgba(15, 23, 42, 0.35)',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                  },
                },
              },
            },
          } as Parameters<typeof mergeChartOptions>[1]),
          ariaLabel: CHART_PRESET_LABELS.forest,
        };
      },
      capabilities: [
        { id: 'showConfidenceIntervals', kind: 'annotationVisibility', annotationPrefixes: ['showConfidenceIntervals_'] },
        { id: 'showCoefficientValues', kind: 'annotationVisibility', annotationPrefixes: ['showCoefficientValues_'] },
      ],
    },
  ];
}

export function getDefaultLogisticaChartPreset(): string {
  return 'forest';
}

export const logisticaChartPresets = buildLogisticaChartPresets();
