import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, mergeChartOptions } from '../chartTheme';
import { fmtP } from '@/shared/format';
import type { PairwiseRow } from '@/shared/stats/statsEngine';

function pAdjMatrix(groupOrder: string[], pairwise: PairwiseRow[]): (number | null)[][] {
  const size = groupOrder.length;
  const indexByLabel = new Map(groupOrder.map((label, index) => [label, index]));
  const matrix: (number | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );

  pairwise.forEach((row) => {
    const i = indexByLabel.get(row.groupA);
    const j = indexByLabel.get(row.groupB);
    if (i === undefined || j === undefined) return;
    matrix[i][j] = row.pAdj;
    matrix[j][i] = row.pAdj;
  });

  for (let index = 0; index < size; index += 1) {
    matrix[index][index] = 1;
  }

  return matrix;
}

function cellColor(pAdj: number | null): string {
  if (pAdj === null || !Number.isFinite(pAdj)) return 'rgba(148, 163, 184, 0.35)';
  if (pAdj < 0.001) return 'rgba(15, 118, 110, 0.95)';
  if (pAdj < 0.01) return 'rgba(15, 118, 110, 0.75)';
  if (pAdj < 0.05) return 'rgba(15, 118, 110, 0.5)';
  return 'rgba(148, 163, 184, 0.45)';
}

/** Adjusted-p heatmap for Tukey pairwise comparisons (k ≤ 6). */
export function buildPostHocHeatmapChartData(
  groupOrder: string[],
  pairwise: PairwiseRow[],
): { data: ChartData; options: ChartOptions } {
  const matrix = pAdjMatrix(groupOrder, pairwise);
  const points: Array<{ x: number; y: number; p: number | null }> = [];

  groupOrder.forEach((_, rowIndex) => {
    groupOrder.forEach((__, colIndex) => {
      points.push({ x: colIndex, y: rowIndex, p: matrix[rowIndex][colIndex] });
    });
  });

  const data: ChartData = {
    datasets: [
      {
        label: 'p ajustado',
        data: points.map((point) => ({ x: point.x, y: point.y })),
        pointBackgroundColor: points.map((point) => cellColor(point.p)),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1,
        pointRadius: 22,
        pointHoverRadius: 24,
        showLine: false,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const item = items[0];
            if (!item) return '';
            const raw = item.raw as { x: number; y: number };
            const row = groupOrder[raw.y];
            const col = groupOrder[raw.x];
            return `${row} × ${col}`;
          },
          label: (item) => {
            const p = points[item.dataIndex]?.p;
            const raw = item.raw as { x: number; y: number };
            if (p === null || p === undefined) return 'Sem comparação';
            if (raw.x === raw.y) return 'Mesmo grupo (p = 1,0000)';
            return `p ajustado = ${fmtP(p)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: -0.5,
        max: groupOrder.length - 0.5,
        ticks: {
          stepSize: 1,
          callback: (value) => groupOrder[Number(value)] ?? '',
        },
        title: { display: true, text: 'Grupo (coluna)' },
      },
      y: {
        type: 'linear',
        min: -0.5,
        max: groupOrder.length - 0.5,
        reverse: true,
        ticks: {
          stepSize: 1,
          callback: (value) => groupOrder[Number(value)] ?? '',
        },
        title: { display: true, text: 'Grupo (linha)' },
      },
    },
  });

  return { data, options };
}
