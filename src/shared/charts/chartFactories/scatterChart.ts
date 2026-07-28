import type { ChartData, ChartOptions } from 'chart.js';
import { statsEngine } from '@/shared/stats/statsEngine';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';

export interface ScatterDataset {
  x: number[];
  y: number[];
  labels?: string[];
  headers?: [string, string];
}

export interface PearsonResult {
  intercept: number;
  slope: number;
}

export interface SpearmanDiagnostics {
  topRankRows?: Array<{ index: number }>;
}

export function buildSpearmanRankDiagnostics(
  x: number[],
  y: number[],
  limit = 4,
): SpearmanDiagnostics {
  const rx = statsEngine.rank(x);
  const ry = statsEngine.rank(y);
  const gaps = rx
    .map((rankX, index) => ({ index, gap: Math.abs(rankX - ry[index]) }))
    .sort((a, b) => b.gap - a.gap);
  return { topRankRows: gaps.slice(0, limit) };
}

/** Pearson (or raw) scatter with optional OLS fit and outlier markers. */
export function buildScatterChartData(
  dataset: ScatterDataset,
  pearson?: PearsonResult | null,
  outlierFlags?: boolean[],
  options?: { includeRegressionLine?: boolean },
): { data: ChartData; options: ChartOptions } {
  const includeRegressionLine = options?.includeRegressionLine !== false && Boolean(pearson);
  const minX = Math.min(...dataset.x);
  const maxX = Math.max(...dataset.x);
  const xPad = (maxX - minX || 1) * 0.1;

  const points = dataset.x.map((x, i) => ({
    x,
    y: dataset.y[i],
    label: dataset.labels?.[i] || `Ponto ${i + 1}`,
    isOutlier: outlierFlags?.[i] || false,
  }));

  const normal = points.filter((p) => !p.isOutlier);
  const outliers = points.filter((p) => p.isOutlier);

  const datasets: ChartData['datasets'] = [];

  if (includeRegressionLine && pearson) {
    const rxMin = minX - xPad;
    const rxMax = maxX + xPad;
    const ryMin = pearson.intercept + pearson.slope * rxMin;
    const ryMax = pearson.intercept + pearson.slope * rxMax;
    datasets.push({
      label: 'Linha de regressão',
      data: [
        { x: rxMin, y: ryMin },
        { x: rxMax, y: ryMax },
      ],
      type: 'line' as const,
      borderColor: COLORS.primary,
      borderWidth: 2.5,
      pointRadius: 0,
      fill: false,
      tension: 0,
      order: 0,
    });
  }

  datasets.push({
    label:
      dataset.headers?.[0] && dataset.headers?.[1]
        ? `${dataset.headers[0]} × ${dataset.headers[1]}`
        : 'Pontos',
    data: normal.map((p) => ({ x: p.x, y: p.y, label: p.label })),
    backgroundColor: COLORS.blueSolid,
    borderColor: COLORS.blue,
    borderWidth: 1,
    pointRadius: 5,
    pointHoverRadius: 7,
    order: 1,
  });

  if (outliers.length) {
    datasets.push({
      label: 'Possíveis outliers',
      data: outliers.map((p) => ({ x: p.x, y: p.y, label: p.label })),
      backgroundColor: COLORS.danger,
      borderColor: COLORS.danger,
      borderWidth: 2,
      pointRadius: 7,
      pointHoverRadius: 10,
      order: 2,
    });
  }

  const data: ChartData = { datasets };

  const chartOptions = mergeChartOptions(BASE_OPTS, {
    layout: { padding: { top: 28, right: 20, bottom: 10, left: 12 } },
    plugins: {
      tooltip: {
        callbacks: {
          title: () => '',
          label: (item) => {
            const raw = item.raw as { x: number; y: number; label?: string };
            if (raw.label) return `${raw.label}  (${fmtNumber(raw.x, 2)}, ${fmtNumber(raw.y, 2)})`;
            return `(${fmtNumber(raw.x, 2)}, ${fmtNumber(raw.y, 2)})`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: dataset.headers?.[0] || 'X',
          color: COLORS.label,
          font: { size: 12 },
        },
        grace: '6%',
      },
      y: {
        title: {
          display: true,
          text: dataset.headers?.[1] || 'Y',
          color: COLORS.label,
          font: { size: 12 },
        },
        grace: '12%',
      },
    },
  });

  return { data, options: chartOptions };
}

/** Spearman rank scatter using tied average ranks (same as the coefficient). */
export function buildRankScatterChartData(
  dataset: ScatterDataset,
  diagnostics?: SpearmanDiagnostics,
): { data: ChartData; options: ChartOptions } {
  const rx = statsEngine.rank(dataset.x);
  const ry = statsEngine.rank(dataset.y);
  const highlighted = new Set((diagnostics?.topRankRows || []).slice(0, 4).map((r) => r.index));

  const points = dataset.x.map((_, i) => ({
    x: rx[i],
    y: ry[i],
    label: dataset.labels?.[i] || `${i + 1}`,
    idx: i,
  }));

  const normal = points.filter((p) => !highlighted.has(p.idx));
  const high = points.filter((p) => highlighted.has(p.idx));

  const datasets: ChartData['datasets'] = [
    {
      label: 'Postos (X → Y)',
      data: normal.map((p) => ({ x: p.x, y: p.y, label: p.label })),
      backgroundColor: COLORS.tealLight,
      borderColor: COLORS.teal,
      borderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 9,
    },
  ];

  if (high.length) {
    datasets.push({
      label: 'Maior diferença de ranks',
      data: high.map((p) => ({ x: p.x, y: p.y, label: p.label })),
      backgroundColor: COLORS.dangerLight,
      borderColor: COLORS.danger,
      borderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 11,
    });
  }

  const data: ChartData = { datasets };
  const xTitle = `Posto de ${dataset.headers?.[0] || 'X'}`;
  const yTitle = `Posto de ${dataset.headers?.[1] || 'Y'}`;

  const chartOptions = mergeChartOptions(BASE_OPTS, {
    layout: { padding: { top: 28, right: 20, bottom: 10, left: 12 } },
    plugins: {
      tooltip: {
        callbacks: {
          title: () => '',
          label: (item) => {
            const r = item.raw as { label?: string; x: number; y: number };
            return `${r.label || ''}  posto X: ${fmtNumber(r.x, 1)}, posto Y: ${fmtNumber(r.y, 1)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: xTitle,
          color: COLORS.label,
          font: { size: 12 },
        },
        grace: '6%',
      },
      y: {
        title: {
          display: true,
          text: yTitle,
          color: COLORS.label,
          font: { size: 12 },
        },
        grace: '12%',
      },
    },
  });

  return { data, options: chartOptions };
}

/** Scatter with forced regression line overlay. */
export function buildScatterWithFitChartData(
  x: number[],
  y: number[],
  regressionLine?: PearsonResult | null,
  labels?: string[],
  headers?: [string, string],
  outlierFlags?: boolean[],
): { data: ChartData; options: ChartOptions } {
  return buildScatterChartData({ x, y, labels, headers }, regressionLine, outlierFlags, {
    includeRegressionLine: true,
  });
}
