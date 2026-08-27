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
  const numericTime = time.map((value, index) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : index;
  });

  const datasets: ChartData['datasets'] = [
    {
      lacirId: 'observed',
      label: axisLabels.y || 'Observado',
      data: observed.map((y, index) => ({ x: numericTime[index], y, pointLabel: labels[index] })),
      borderColor: COLORS.blue,
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: true,
      tension: 0.15,
      order: 1,
    },
  ];

  if (fitted) {
    datasets.unshift({
      lacirId: 'fitted',
      label: 'Tendência ajustada (Prais-Winsten)',
      data: fitted.map((y, index) => ({ x: numericTime[index], y, pointLabel: labels[index] })),
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

  const data: ChartData = { datasets };
  const labelByTime = new Map(numericTime.map((value, index) => [value, labels[index]]));

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
        type: 'linear',
        title: {
          display: true,
          text: axisLabels.x || 'Período',
          color: COLORS.label,
          font: { size: 12 },
        },
        ticks: {
          callback: (value) => labelByTime.get(Number(value)) ?? String(value),
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
