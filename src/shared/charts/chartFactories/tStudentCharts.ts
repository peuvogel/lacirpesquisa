import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber, fmtSigned } from '@/shared/format';

export interface WelchResult {
  diff: number;
  ci: [number, number];
}

export interface GroupStats {
  mean: number;
  std: number;
  q1: number;
  median: number;
  q3: number;
  min: number;
  max: number;
  n: number;
}

function groupStats(arr: number[]): GroupStats {
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1));
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3 = sorted[Math.floor(n * 0.75)];
  return { mean, std, q1, median, q3, min: sorted[0], max: sorted[n - 1], n };
}

/** Port of renderTStudentDiffChart — mean difference + IC95%. */
export function buildTStudentDiffChartData(
  result: WelchResult,
  _labels?: string[],
): { data: ChartData; options: ChartOptions } {
  const diff = result.diff;
  const low = result.ci[0];
  const high = result.ci[1];

  const data: ChartData = {
    datasets: [
      {
        label: 'Diferença entre médias (IC95%)',
        data: [{ x: diff, y: 0 }],
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        pointRadius: 8,
        pointHoverRadius: 10,
        showLine: false,
      },
      {
        label: 'Intervalo de Confiança',
        data: [{ x: low, y: 0 }, { x: high, y: 0 }],
        borderColor: COLORS.primary,
        borderWidth: 2,
        pointRadius: 4,
        showLine: true,
        fill: false,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    indexAxis: 'y',
    plugins: {
      tooltip: {
        callbacks: {
          title: () => 'Estimativa de Efeito',
          label: (item) => {
            if (item.datasetIndex === 0) return `Diferença: ${fmtSigned(diff, 3)}`;
            return `IC95%: [${fmtNumber(low, 3)}, ${fmtNumber(high, 3)}]`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Diferença das Médias', color: COLORS.label },
      },
      y: {
        display: false,
        min: -1,
        max: 1,
      },
    },
  });

  return { data, options };
}

/** Port of renderTStudentDistChart — mean bars per group. */
export function buildTStudentDistChartData(
  groupA: number[],
  groupB: number[],
  labelA?: string,
  labelB?: string,
): { data: ChartData; options: ChartOptions } {
  const sA = groupStats(groupA);
  const sB = groupStats(groupB);

  const data: ChartData = {
    labels: [labelA || 'Grupo A', labelB || 'Grupo B'],
    datasets: [
      {
        label: 'Média',
        data: [sA.mean, sB.mean],
        backgroundColor: [COLORS.blueLight, COLORS.primaryLight],
        borderColor: [COLORS.blue, COLORS.primary],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (item) => {
            const s = item.dataIndex === 0 ? sA : sB;
            return [
              `Média: ${fmtNumber(s.mean, 3)}`,
              `DP: ${fmtNumber(s.std, 3)}`,
              `Mediana: ${fmtNumber(s.median, 3)}`,
              `Q1: ${fmtNumber(s.q1, 3)}  Q3: ${fmtNumber(s.q3, 3)}`,
              `n = ${s.n}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'Valor médio', color: COLORS.label, font: { size: 12 } },
      },
    },
  });

  return { data, options };
}

/** Bar chart of group means — customizer preset. */
export function buildTStudentMeansBarChartData(
  result: { m1: number; m2: number },
  labels: [string, string] = ['Grupo A', 'Grupo B'],
): { data: ChartData; options: ChartOptions } {
  const data: ChartData = {
    labels: [labels[0], labels[1]],
    datasets: [
      {
        label: 'Média',
        data: [result.m1, result.m2],
        backgroundColor: [COLORS.blueLight, COLORS.primaryLight],
        borderColor: [COLORS.blue, COLORS.primary],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (item) => `Média: ${fmtNumber(item.parsed.y, 3)}`,
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'Valor médio', color: COLORS.label, font: { size: 12 } },
      },
    },
  });

  return { data, options };
}
