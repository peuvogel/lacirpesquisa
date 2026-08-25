import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';

const GROUP_COLORS = [
  '#2563eb',
  '#0f766e',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#be123c',
  '#4f46e5',
  '#15803d',
];

function jitter(index: number, length: number): number {
  if (length <= 1) return 0;
  return (index / (length - 1) - 0.5) * 0.48;
}

/** Raw observations by group, with deterministic jitter so repeated values remain visible. */
export function buildGroupedRawDotChartData(
  groups: Record<string, number[]>,
  groupOrder: string[],
  yLabel = 'Valor observado',
): { data: ChartData; options: ChartOptions } {
  const data: ChartData = {
    datasets: groupOrder.map((label, groupIndex) => {
      const values = groups[label] ?? [];
      const color = GROUP_COLORS[groupIndex % GROUP_COLORS.length]!;
      return {
        label,
        data: values.map((value, observationIndex) => ({
          x: groupIndex + jitter(observationIndex, values.length),
          y: value,
        })),
        backgroundColor: `${color}b8`,
        borderColor: color,
        borderWidth: 1,
        pointRadius: 4.5,
        pointHoverRadius: 6.5,
        showLine: false,
      };
    }),
  };

  const options = mergeChartOptions(BASE_OPTS, {
    parsing: false,
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { display: groupOrder.length <= 8, position: 'bottom' },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.dataset.label ?? '',
          label: (item) => {
            const point = item.raw as { y: number };
            return `Valor: ${fmtNumber(point.y, 3)}`;
          },
          afterLabel: (item) => {
            const values = groups[item.dataset.label ?? ''] ?? [];
            return `Observação ${item.dataIndex + 1} de ${values.length}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: -0.6,
        max: Math.max(0.6, groupOrder.length - 0.4),
        grid: { display: false },
        border: { display: false },
        ticks: {
          stepSize: 1,
          callback: (value: string | number) => {
            const index = Math.round(Number(value));
            return Math.abs(Number(value) - index) < 0.01 ? (groupOrder[index] ?? '') : '';
          },
        },
        title: {
          display: true,
          text: 'Grupo',
          color: COLORS.label,
          font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
        },
      },
      y: {
        title: {
          display: true,
          text: yLabel,
          color: COLORS.label,
          font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
        },
      },
    },
  } as ChartOptions);

  return { data, options };
}
