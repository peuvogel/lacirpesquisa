import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';
import type { AxisLabels } from './timeseriesChart';

/** Port of renderResidualChart — residual bar chart with zero-line annotation placeholder. */
export function buildResidualBarChartData(
  time: unknown[],
  residuals: number[],
  pointLabels?: string[],
  axisLabels: AxisLabels = {},
): { data: ChartData; options: ChartOptions } {
  const labels = pointLabels ?? time.map(String);
  const colors = residuals.map((r) => (r > 0 ? COLORS.primary : COLORS.danger));

  const data: ChartData = {
    labels,
    datasets: [
      {
        label: 'Resíduo (log10)',
        data: residuals,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 0,
        borderRadius: 2,
        maxBarThickness: 36,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => `Resíduo: ${fmtNumber(item.parsed.y, 4)}`,
        },
      },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line',
            yMin: 0,
            yMax: 0,
            borderColor: 'rgba(100, 116, 139, 0.45)',
            borderWidth: 1,
            borderDash: [4, 4],
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: axisLabels.x || 'Período',
          color: COLORS.label,
          font: { size: 12 },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Resíduo (escala log10)',
          color: COLORS.label,
          font: { size: 12 },
        },
      },
    },
  });

  return { data, options };
}
