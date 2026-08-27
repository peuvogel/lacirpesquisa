import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';

export interface ChiProportionChartInput {
  observed: readonly (readonly number[])[];
  rowLabels: readonly string[];
  colLabels: readonly string[];
}

const PROPORTION_COLORS = [
  COLORS.primarySolid,
  COLORS.blueSolid,
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#475569',
];

export function buildChiProportionChartData(
  input: ChiProportionChartInput,
): { data: ChartData; options: ChartOptions } {
  const rowTotals = input.observed.map((row) => row.reduce((sum, value) => sum + value, 0));
  const data: ChartData<'bar', Array<number | null>, string> = {
    labels: [...input.rowLabels],
    datasets: input.colLabels.map((label, col) => ({
      lacirId: `proportion-${col}`,
      label,
      data: input.rowLabels.map((_, row) => {
        const total = rowTotals[row] ?? 0;
        return total > 0 ? ((input.observed[row]?.[col] ?? 0) / total) * 100 : null;
      }),
      backgroundColor: PROPORTION_COLORS[col % PROPORTION_COLORS.length],
      borderColor: '#FFFFFF',
      borderWidth: 1,
    })),
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'bar'>) => {
            const value = item.raw as number | null;
            return value === null
              ? `${item.dataset.label}: sem denominador`
              : `${item.dataset.label}: ${fmtNumber(value, 1)}%`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true, title: { display: true, text: 'Categoria de linha' } },
      y: {
        stacked: true,
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Proporção dentro da linha (%)' },
        ticks: { callback: (value) => `${value}%` },
      },
    },
  } as ChartOptions);

  return { data, options };
}
