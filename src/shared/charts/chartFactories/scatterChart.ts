import type { ChartData, ChartOptions } from 'chart.js';
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

/** Port of renderScatterChart — Pearson scatter with optional outliers. */
export function buildScatterChartData(
  dataset: ScatterDataset,
  pearson?: PearsonResult,
  outlierFlags?: boolean[],
): { data: ChartData; options: ChartOptions } {
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

  if (pearson) {
    const rxMin = minX - xPad;
    const rxMax = maxX + xPad;
    const ryMin = pearson.intercept + pearson.slope * rxMin;
    const ryMax = pearson.intercept + pearson.slope * rxMax;
    datasets.push({
      label: 'Linha de regressão',
      data: [{ x: rxMin, y: ryMin }, { x: rxMax, y: ryMax }],
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
    backgroundColor: COLORS.blueLight,
    borderColor: COLORS.blue,
    borderWidth: 2,
    pointRadius: 6,
    pointHoverRadius: 9,
    order: 1,
  });

  if (outliers.length) {
    datasets.push({
      label: 'Possíveis outliers',
      data: outliers.map((p) => ({ x: p.x, y: p.y, label: p.label })),
      backgroundColor: COLORS.dangerLight,
      borderColor: COLORS.danger,
      borderWidth: 2,
      pointRadius: 7,
      pointHoverRadius: 10,
      order: 2,
    });
  }

  const data: ChartData = { datasets };

  const options = mergeChartOptions(BASE_OPTS, {
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
      },
      y: {
        title: {
          display: true,
          text: dataset.headers?.[1] || 'Y',
          color: COLORS.label,
          font: { size: 12 },
        },
      },
    },
  });

  return { data, options };
}

/** Port of renderRankScatterChart — Spearman rank scatter. */
export function buildRankScatterChartData(
  dataset: ScatterDataset,
  diagnostics?: SpearmanDiagnostics,
): { data: ChartData; options: ChartOptions } {
  const highlighted = new Set(
    (diagnostics?.topRankRows || []).slice(0, 4).map((r) => r.index),
  );

  const sortedByX = [...dataset.x.map((v, i) => ({
    x: v,
    y: dataset.y[i],
    rx: 0,
    ry: 0,
    label: dataset.labels?.[i] || `${i + 1}`,
    idx: i,
  }))].sort((a, b) => a.x - b.x);
  sortedByX.forEach((p, ri) => { p.rx = ri + 1; });
  const sortedByY = [...sortedByX].sort((a, b) => a.y - b.y);
  sortedByY.forEach((p, ri) => { p.ry = ri + 1; });
  const points = sortedByX;

  const normal = points.filter((p) => !highlighted.has(p.idx));
  const high = points.filter((p) => highlighted.has(p.idx));

  const datasets: ChartData['datasets'] = [
    {
      label: 'Ranks (X → Y)',
      data: normal.map((p) => ({ x: p.rx, y: p.ry, label: p.label })),
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
      data: high.map((p) => ({ x: p.rx, y: p.ry, label: p.label })),
      backgroundColor: COLORS.dangerLight,
      borderColor: COLORS.danger,
      borderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 11,
    });
  }

  const data: ChartData = { datasets };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      tooltip: {
        callbacks: {
          title: () => '',
          label: (item) => {
            const r = item.raw as { label?: string; x: number; y: number };
            return `${r.label || ''}  posto X: ${r.x}, posto Y: ${r.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: `Posto de ${dataset.headers?.[0] || 'X'}`,
          color: COLORS.label,
          font: { size: 12 },
        },
      },
      y: {
        title: {
          display: true,
          text: `Posto de ${dataset.headers?.[1] || 'Y'}`,
          color: COLORS.label,
          font: { size: 12 },
        },
      },
    },
  });

  return { data, options };
}

/** Scatter with regression line overlay — customizer preset. */
export function buildScatterWithFitChartData(
  x: number[],
  y: number[],
  regressionLine?: PearsonResult,
  labels?: string[],
  headers?: [string, string],
): { data: ChartData; options: ChartOptions } {
  return buildScatterChartData(
    { x, y, labels, headers },
    regressionLine,
  );
}
