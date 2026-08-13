import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import { buildGlmCoefForestChartData } from '@/shared/charts/chartFactories/glmCoefForestChart';
import { mergeChartOptions, COLORS, BASE_OPTS } from '@/shared/charts/chartTheme';
import { fmtNumber } from '@/shared/format';
import {
  CHART_PRESET_LABELS,
  POISSON_ANNOTATIONS,
} from './poissonConfig';
import type { PoissonEngineOutput } from './poissonEngine';

export const POISSON_CHART_ANNOTATIONS = POISSON_ANNOTATIONS;

export function computePoissonFittedValues(output: PoissonEngineOutput): number[] {
  const { dataset, result } = output;
  return dataset.design.matrix.map((row, rowIndex) => {
    const linear = (dataset.design.offset?.[rowIndex] ?? 0) + row.reduce(
      (sum, value, index) => sum + value * (result.coefficients[index]?.beta ?? 0),
      0,
    );
    return Math.exp(linear);
  });
}

export function buildPoissonChartPresets(): ChartPreset<PoissonEngineOutput>[] {
  return [
    {
      id: 'forest',
      label: CHART_PRESET_LABELS.forest,
      visualType: 'range',
      buildChart: (output) => {
        const { data, options } = buildGlmCoefForestChartData({
          coefficients: output.result.coefficients,
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
                    xMin: 0,
                    xMax: 0,
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
      annotationKeys: ['showConfidenceIntervals', 'showCoefficientValues'],
    },
    {
      id: 'predicted',
      label: CHART_PRESET_LABELS.predicted,
      visualType: 'scatter',
      buildChart: (output) => {
        const observed = output.dataset.y;
        const fitted = computePoissonFittedValues(output);
        const maxValue = Math.max(...observed, ...fitted, 1);

        const data = {
          datasets: [
            {
              label: 'Observado vs previsto',
              data: observed.map((y, index) => ({ x: fitted[index], y })),
              backgroundColor: COLORS.primary,
              borderColor: COLORS.primarySolid,
              pointRadius: 6,
              pointHoverRadius: 8,
              showLine: false,
            },
            {
              label: 'y = x',
              data: [
                { x: 0, y: 0 },
                { x: maxValue * 1.05, y: maxValue * 1.05 },
              ],
              borderColor: 'rgba(15, 23, 42, 0.35)',
              borderWidth: 1.5,
              borderDash: [6, 4],
              pointRadius: 0,
              showLine: true,
              fill: false,
            },
          ],
        };

        const options = mergeChartOptions(BASE_OPTS, {
          plugins: {
            title: {
              display: true,
              text: CHART_PRESET_LABELS.predicted,
              color: '#1E293B',
              font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
            },
            tooltip: {
              callbacks: {
                label: (item) => {
                  if (item.datasetIndex !== 0) return 'Referência y = x';
                  const obs = observed[item.dataIndex];
                  const pred = fitted[item.dataIndex];
                  return `Previsto = ${fmtNumber(pred, 2)}, observado = ${obs}`;
                },
              },
            },
          },
          scales: {
            x: { title: { display: true, text: 'Contagem prevista (μ̂)' }, beginAtZero: true },
            y: { title: { display: true, text: 'Contagem observada' }, beginAtZero: true },
          },
        });

        return {
          type: 'scatter',
          data,
          options,
          ariaLabel: CHART_PRESET_LABELS.predicted,
        };
      },
      defaultAxisLabels: { x: 'Previsto', y: 'Observado' },
      annotationKeys: ['showReferenceLine'],
    },
  ];
}

export function getDefaultPoissonChartPreset(): string {
  return 'forest';
}

export const poissonChartPresets = buildPoissonChartPresets();
