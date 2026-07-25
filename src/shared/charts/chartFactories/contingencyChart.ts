import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';

export interface ContingencyChartInput {
  observed: number[][];
  expected: number[][];
  rowLabels: string[];
  colLabels: string[];
  rowHeader: string;
  colHeader: string;
}

function cellLabels(rowLabels: string[], colLabels: string[]): string[] {
  return rowLabels.flatMap((row) => colLabels.map((col) => `${row} · ${col}`));
}

/** Grouped bars: observed vs expected counts per contingency cell. */
export function buildContingencyChartData(
  input: ContingencyChartInput,
): { data: ChartData; options: ChartOptions } {
  const { observed, expected, rowLabels, colLabels } = input;
  const labels = cellLabels(rowLabels, colLabels);
  const observedFlat = observed.flat();
  const expectedFlat = expected.flat();

  const data: ChartData = {
    labels,
    datasets: [
      {
        label: 'Observado',
        data: observedFlat,
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primarySolid,
        borderWidth: 1,
      },
      {
        label: 'Esperado',
        data: expectedFlat.map((value) => Math.round(value * 100) / 100),
        backgroundColor: 'rgba(100, 116, 139, 0.55)',
        borderColor: 'rgba(71, 85, 105, 0.9)',
        borderWidth: 1,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        callbacks: {
          label: (item) => {
            const value = item.raw as number;
            return `${item.dataset.label}: ${fmtNumber(value, 2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: `${input.rowHeader} × ${input.colHeader}`,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Contagem',
        },
      },
    },
  });

  return { data, options };
}
