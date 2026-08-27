import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';

export function buildPairedComparisonChartData(
  before: readonly number[],
  after: readonly number[],
  labels: readonly [string, string],
): { data: ChartData; options: ChartOptions } {
  const pairCount = Math.min(before.length, after.length);
  const datasets: ChartData['datasets'] = Array.from({ length: pairCount }, (_, index) => ({
    lacirId: `pair-${index}`,
    label: `Par ${index + 1}`,
    data: [
      { x: 0, y: before[index]! },
      { x: 1, y: after[index]! },
    ],
    borderColor: 'rgba(15, 118, 110, 0.38)',
    backgroundColor: index % 2 === 0 ? COLORS.blueSolid : COLORS.primarySolid,
    borderWidth: 1.5,
    pointRadius: 4.5,
    pointHoverRadius: 7,
    showLine: true,
    tension: 0,
  }));

  return {
    data: { datasets },
    options: mergeChartOptions(BASE_OPTS, {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${fmtNumber(item.parsed.y, 3)}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: -0.15,
          max: 1.15,
          ticks: {
            stepSize: 1,
            callback: (value) => labels[Math.round(Number(value))] ?? '',
          },
          title: { display: true, text: 'Momento / condição' },
        },
        y: { title: { display: true, text: 'Valor observado' }, grace: '8%' },
      },
    } as ChartOptions),
  };
}
