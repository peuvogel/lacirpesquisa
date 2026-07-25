import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';

export interface AxisLabels {
  x?: string;
  y?: string;
}

/** Port of renderTimeseriesChart — observed + fitted Prais line. */
export function buildTimeseriesChartData(
  time: unknown[],
  observed: number[],
  fitted?: number[],
  pointLabels?: string[],
  axisLabels: AxisLabels = {},
): { data: ChartData; options: ChartOptions } {
  const labels = pointLabels ?? time.map(String);

  const datasets: ChartData['datasets'] = [
    {
      label: axisLabels.y || 'Observado',
      data: observed,
      borderColor: COLORS.blue,
      backgroundColor: COLORS.blueLight,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 9,
      fill: true,
      tension: 0.2,
      order: 1,
    },
  ];

  if (fitted) {
    datasets.unshift({
      label: 'Tendência ajustada (Prais-Winsten)',
      data: fitted,
      borderColor: COLORS.primary,
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      borderDash: [8, 5],
      pointRadius: 0,
      fill: false,
      tension: 0,
      order: 0,
    });
  }

  const data: ChartData = { labels, datasets };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (item) => `${item.dataset.label}: ${fmtNumber(item.parsed.y, 2)}`,
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
          text: axisLabels.y || 'Valor',
          color: COLORS.label,
          font: { size: 12 },
        },
      },
    },
  });

  return { data, options };
}
