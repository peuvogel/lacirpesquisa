import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber, fmtSigned } from '@/shared/format';
import { buildGroupedRawDotChartData } from './groupedRawDotChart';

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

/** Mean difference + IC95% — forest-style effect estimate on white canvas. */
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
        pointRadius: 7,
        pointHoverRadius: 9,
        pointStyle: 'circle',
        showLine: false,
      },
      {
        label: 'Intervalo de confiança',
        data: [
          { x: low, y: 0 },
          { x: high, y: 0 },
        ],
        borderColor: COLORS.primarySolid,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        showLine: true,
        fill: false,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    indexAxis: 'y',
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          title: () => 'Estimativa de efeito',
          label: (item) => {
            if (item.datasetIndex === 0) return `Diferença: ${fmtSigned(diff, 3)}`;
            return `IC95%: [${fmtNumber(low, 3)}, ${fmtNumber(high, 3)}]`;
          },
        },
      },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line',
            xMin: 0,
            xMax: 0,
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
          text: 'Diferença das médias',
          color: COLORS.label,
          font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
        },
        grid: { color: COLORS.grid, drawTicks: false },
      },
      y: {
        display: false,
        min: -1,
        max: 1,
        grid: { display: false },
      },
    },
  } as ChartOptions);

  return { data, options };
}

/** Raw observations per group; no summary bar hides the underlying distribution. */
export function buildTStudentDistChartData(
  groupA: number[],
  groupB: number[],
  labelA?: string,
  labelB?: string,
): { data: ChartData; options: ChartOptions } {
  const sA = groupStats(groupA);
  const sB = groupStats(groupB);

  const labels = [labelA || 'Grupo A', labelB || 'Grupo B'];
  const raw = buildGroupedRawDotChartData(
    { [labels[0]]: groupA, [labels[1]]: groupB },
    labels,
  );
  const options = mergeChartOptions(raw.options, {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const item = items[0];
            if (!item) return [];
            const s = item.datasetIndex === 0 ? sA : sB;
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
  });

  return { data: raw.data, options };
}

/** Simple means bar chart — customizer preset. */
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
        backgroundColor: [COLORS.blueSolid, COLORS.primarySolid],
        borderWidth: 0,
        borderRadius: 3,
        borderSkipped: false,
        maxBarThickness: 56,
        categoryPercentage: 0.55,
        barPercentage: 0.85,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => `Média: ${fmtNumber(item.parsed.y, 3)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Valor médio',
          color: COLORS.label,
          font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
        },
      },
    },
  });

  return { data, options };
}
