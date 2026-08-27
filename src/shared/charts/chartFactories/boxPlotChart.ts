import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { fmtNumber } from '@/shared/format';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';

export interface BoxPlotSummary {
  n: number;
  median: number;
  q1: number;
  q3: number;
  low: number;
  high: number;
  outliers: number[];
}

function quantile(sorted: readonly number[], probability: number): number {
  if (!sorted.length) return Number.NaN;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const fraction = position - lower;
  return sorted[lower]! + ((sorted[upper]! - sorted[lower]!) * fraction);
}

export function summarizeBoxPlot(values: readonly number[]): BoxPlotSummary {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) {
    return {
      n: 0,
      median: Number.NaN,
      q1: Number.NaN,
      q3: Number.NaN,
      low: Number.NaN,
      high: Number.NaN,
      outliers: [],
    };
  }
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - (1.5 * iqr);
  const upperFence = q3 + (1.5 * iqr);
  const inside = sorted.filter((value) => value >= lowerFence && value <= upperFence);
  return {
    n: sorted.length,
    median,
    q1,
    q3,
    low: inside[0] ?? sorted[0]!,
    high: inside[inside.length - 1] ?? sorted[sorted.length - 1]!,
    outliers: sorted.filter((value) => value < lowerFence || value > upperFence),
  };
}

function jitter(groupIndex: number, pointIndex: number, count: number): number {
  if (count <= 1) return groupIndex;
  const centered = pointIndex - ((count - 1) / 2);
  return groupIndex + (centered * Math.min(0.055, 0.28 / count));
}

export function buildBoxPlotChartData(
  groups: Readonly<Record<string, readonly number[]>>,
  groupOrder: readonly string[],
  yTitle = 'Valor observado',
): { data: ChartData; options: ChartOptions } {
  const annotations: Record<string, Record<string, unknown>> = {};
  const regularPoints: Array<{ x: number; y: number; groupIndex: number; groupLabel: string }> = [];
  const outlierPoints: Array<{ x: number; y: number; groupIndex: number; groupLabel: string }> = [];

  groupOrder.forEach((label, groupIndex) => {
    const values = (groups[label] ?? []).filter(Number.isFinite);
    const summary = summarizeBoxPlot(values);
    if (!summary.n) {
      annotations[`unavailable_${groupIndex}`] = {
        type: 'label', xValue: groupIndex, yValue: 0, content: 'Sem dados válidos',
        color: COLORS.warning, backgroundColor: 'rgba(255,255,255,0.9)',
      };
      return;
    }

    annotations[`box_${groupIndex}`] = {
      type: 'box', xMin: groupIndex - 0.25, xMax: groupIndex + 0.25,
      yMin: summary.q1, yMax: summary.q3,
      backgroundColor: COLORS.primaryLight, borderColor: COLORS.primarySolid, borderWidth: 1.5,
    };
    annotations[`median_${groupIndex}`] = {
      type: 'line', xMin: groupIndex - 0.25, xMax: groupIndex + 0.25,
      yMin: summary.median, yMax: summary.median,
      borderColor: COLORS.text, borderWidth: 2.5,
    };
    annotations[`whiskerLow_${groupIndex}`] = {
      type: 'line', xMin: groupIndex, xMax: groupIndex,
      yMin: summary.low, yMax: summary.q1,
      borderColor: COLORS.primarySolid, borderWidth: 1.5,
    };
    annotations[`whiskerHigh_${groupIndex}`] = {
      type: 'line', xMin: groupIndex, xMax: groupIndex,
      yMin: summary.q3, yMax: summary.high,
      borderColor: COLORS.primarySolid, borderWidth: 1.5,
    };
    annotations[`capLow_${groupIndex}`] = {
      type: 'line', xMin: groupIndex - 0.12, xMax: groupIndex + 0.12,
      yMin: summary.low, yMax: summary.low,
      borderColor: COLORS.primarySolid, borderWidth: 1.5,
    };
    annotations[`capHigh_${groupIndex}`] = {
      type: 'line', xMin: groupIndex - 0.12, xMax: groupIndex + 0.12,
      yMin: summary.high, yMax: summary.high,
      borderColor: COLORS.primarySolid, borderWidth: 1.5,
    };

    values.forEach((value, pointIndex) => {
      const point = {
        x: jitter(groupIndex, pointIndex, values.length),
        y: value,
        groupIndex,
        groupLabel: label,
      };
      if (value < summary.low || value > summary.high) outlierPoints.push(point);
      else regularPoints.push(point);
    });
  });

  const data: ChartData = {
    datasets: [
      {
        label: 'Observações',
        data: regularPoints,
        backgroundColor: 'rgba(15, 118, 110, 0.48)',
        borderColor: '#FFFFFF',
        borderWidth: 1,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        showLine: false,
      },
      {
        label: 'Outliers (1,5×IQR)',
        data: outlierPoints,
        backgroundColor: COLORS.danger,
        borderColor: '#FFFFFF',
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointStyle: 'rectRot',
        showLine: false,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: true },
      annotation: {
        annotations: annotations as NonNullable<
          NonNullable<NonNullable<ChartOptions['plugins']>['annotation']>['annotations']
        >,
      },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'scatter'>) => {
            const raw = item.raw as { y: number; groupIndex: number; groupLabel?: string };
            return `${raw.groupLabel ?? groupOrder[raw.groupIndex]}: ${fmtNumber(raw.y, 3)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear', min: -0.5, max: Math.max(groupOrder.length - 0.5, 0.5),
        ticks: {
          stepSize: 1,
          autoSkip: false,
          callback: (raw) => {
            const numeric = Number(raw);
            const index = Math.round(numeric);
            return Number.isFinite(numeric) && Math.abs(numeric - index) <= 1e-8
              ? groupOrder[index] ?? ''
              : '';
          },
        },
        title: { display: true, text: 'Grupo' },
      },
      y: { title: { display: true, text: yTitle }, grace: '10%' },
    },
  } as ChartOptions);

  return { data, options };
}
