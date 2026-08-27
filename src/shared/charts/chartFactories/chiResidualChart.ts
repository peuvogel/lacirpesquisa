import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber } from '@/shared/format';

export interface ChiResidualChartInput {
  observed: readonly (readonly number[])[];
  expected: readonly (readonly number[])[];
  rowLabels: readonly string[];
  colLabels: readonly string[];
}

export function standardizedResidual(
  observed: number,
  expected: number,
  rowShare: number,
  columnShare: number,
): number | null {
  const variance = expected * (1 - rowShare) * (1 - columnShare);
  if (!Number.isFinite(observed) || !Number.isFinite(variance) || variance <= 0) return null;
  const residual = (observed - expected) / Math.sqrt(variance);
  return Number.isFinite(residual) ? residual : null;
}

function categoryTick(labels: readonly string[]) {
  return (raw: string | number) => {
    const value = Number(raw);
    const index = Math.round(value);
    return Number.isFinite(value) && Math.abs(value - index) < 1e-8 ? labels[index] ?? '' : '';
  };
}

function residualColor(residual: number): string {
  const alpha = Math.min(0.92, 0.3 + Math.abs(residual) * 0.18);
  return residual >= 0
    ? `rgba(13, 148, 136, ${alpha})`
    : `rgba(220, 38, 38, ${alpha})`;
}

type ResidualPoint = {
  x: number;
  y: number;
  residual: number | null;
  observed: number;
  expected: number;
};

export function buildChiResidualChartData(
  input: ChiResidualChartInput,
): { data: ChartData; options: ChartOptions } {
  const rowTotals = input.observed.map((row) => row.reduce((sum, value) => sum + value, 0));
  const colTotals = input.colLabels.map((_, col) =>
    input.observed.reduce((sum, row) => sum + (row[col] ?? 0), 0));
  const total = rowTotals.reduce((sum, value) => sum + value, 0);
  const buckets = {
    positive: [] as ResidualPoint[],
    negative: [] as ResidualPoint[],
    unavailable: [] as ResidualPoint[],
  };

  input.rowLabels.forEach((_, row) => {
    input.colLabels.forEach((__, col) => {
      const observed = input.observed[row]?.[col] ?? 0;
      const expected = input.expected[row]?.[col] ?? Number.NaN;
      const residual = standardizedResidual(
        observed,
        expected,
        total > 0 ? rowTotals[row]! / total : Number.NaN,
        total > 0 ? colTotals[col]! / total : Number.NaN,
      );
      const point = { x: col, y: row, residual, observed, expected };
      if (residual === null) buckets.unavailable.push(point);
      else if (residual >= 0) buckets.positive.push(point);
      else buckets.negative.push(point);
    });
  });

  const dataset = (
    lacirId: string,
    label: string,
    points: ResidualPoint[],
    fallback: string,
  ) => ({
    lacirId,
    label,
    data: points,
    backgroundColor: points.map((point) =>
      point.residual === null ? fallback : residualColor(point.residual)),
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    pointStyle: 'rect' as const,
    pointRadius: 18,
    pointHoverRadius: 20,
  });

  const data: ChartData = {
    datasets: [
      dataset('positive-residuals', 'Residual positivo', buckets.positive, COLORS.primarySolid),
      dataset('negative-residuals', 'Residual negativo', buckets.negative, COLORS.danger),
      dataset('unavailable-residuals', 'Residual indisponível', buckets.unavailable, '#CBD5E1'),
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'scatter'>) => {
            const point = item.raw as ResidualPoint;
            const residual = point.residual === null ? 'indisponível' : fmtNumber(point.residual, 2);
            return `Observado ${fmtNumber(point.observed, 0)} · esperado ${fmtNumber(point.expected, 2)} · residual ${residual}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear', min: -0.5, max: Math.max(input.colLabels.length - 0.5, 0.5),
        ticks: { stepSize: 1, autoSkip: false, callback: categoryTick(input.colLabels) },
        title: { display: true, text: 'Categoria de coluna' },
        grid: { display: false },
      },
      y: {
        type: 'linear', min: -0.5, max: Math.max(input.rowLabels.length - 0.5, 0.5), reverse: true,
        ticks: { stepSize: 1, autoSkip: false, callback: categoryTick(input.rowLabels) },
        title: { display: true, text: 'Categoria de linha' },
        grid: { display: false },
      },
    },
  } as ChartOptions);

  return { data, options };
}
