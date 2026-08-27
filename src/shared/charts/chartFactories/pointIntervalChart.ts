import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { fmtNumber } from '@/shared/format';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';

export interface PointInterval {
  label: string;
  estimate: number;
  low: number | null;
  high: number | null;
}

export interface PointIntervalChartInput {
  intervals: readonly PointInterval[];
  orientation?: 'horizontal' | 'vertical';
  scale?: 'linear' | 'logarithmic';
  referenceValue?: number;
  title?: string;
  xTitle?: string;
  yTitle?: string;
  estimateLabel?: string;
  intervalLabel?: string;
  intervalAnnotationPrefix?: string;
}

function isPlottableEstimate(value: number, scale: PointIntervalChartInput['scale']): boolean {
  return Number.isFinite(value) && (scale !== 'logarithmic' || value > 0);
}

function hasPlottableInterval(
  interval: PointInterval,
  scale: PointIntervalChartInput['scale'],
): interval is PointInterval & { low: number; high: number } {
  if (
    interval.low === null
    || interval.high === null
    || !Number.isFinite(interval.low)
    || !Number.isFinite(interval.high)
    || !isPlottableEstimate(interval.estimate, scale)
  ) return false;
  if (scale === 'logarithmic' && (interval.low <= 0 || interval.high <= 0)) return false;
  return interval.low <= interval.estimate && interval.estimate <= interval.high;
}

function categoryTick(labels: readonly string[]) {
  return (raw: string | number) => {
    const numeric = Number(raw);
    const index = Math.round(numeric);
    if (!Number.isFinite(numeric) || Math.abs(numeric - index) > 1e-8) return '';
    return Number.isInteger(index) && index >= 0 && index < labels.length ? labels[index] : '';
  };
}

function logarithmicTick(raw: string | number, index: number, ticks: readonly unknown[]): string {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return '';
  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / (10 ** exponent);
  const major = [1, 2, 5].some((candidate) => Math.abs(mantissa - candidate) < 1e-8);
  if (!major && index !== 0 && index !== ticks.length - 1) return '';
  const decimals = value < 0.01 ? 3 : value < 1 ? 2 : value < 10 ? 1 : 0;
  return fmtNumber(value, decimals);
}

export function buildPointIntervalChartData(
  input: PointIntervalChartInput,
): { data: ChartData; options: ChartOptions } {
  const orientation = input.orientation ?? 'horizontal';
  const scale = input.scale ?? 'linear';
  const intervalLabel = input.intervalLabel ?? 'IC';
  const prefix = input.intervalAnnotationPrefix ?? 'showConfidenceIntervals';
  const labels = input.intervals.map((interval) => interval.label);
  const points = input.intervals.flatMap((interval, index) => {
    if (!isPlottableEstimate(interval.estimate, scale)) return [];
    return [orientation === 'horizontal'
      ? { x: interval.estimate, y: index }
      : { x: index, y: interval.estimate }];
  });
  const annotations: Record<string, Record<string, unknown>> = {};

  input.intervals.forEach((interval, index) => {
    if (hasPlottableInterval(interval, scale)) {
      if (orientation === 'horizontal') {
        annotations[`${prefix}_${index}_line`] = {
          type: 'line', xMin: interval.low, xMax: interval.high, yMin: index, yMax: index,
          borderColor: COLORS.primarySolid, borderWidth: 2.5,
        };
        annotations[`${prefix}_${index}_capLow`] = {
          type: 'line', xMin: interval.low, xMax: interval.low, yMin: index - 0.16, yMax: index + 0.16,
          borderColor: COLORS.primarySolid, borderWidth: 2,
        };
        annotations[`${prefix}_${index}_capHigh`] = {
          type: 'line', xMin: interval.high, xMax: interval.high, yMin: index - 0.16, yMax: index + 0.16,
          borderColor: COLORS.primarySolid, borderWidth: 2,
        };
      } else {
        annotations[`${prefix}_${index}_line`] = {
          type: 'line', xMin: index, xMax: index, yMin: interval.low, yMax: interval.high,
          borderColor: COLORS.primarySolid, borderWidth: 2.5,
        };
        annotations[`${prefix}_${index}_capLow`] = {
          type: 'line', xMin: index - 0.16, xMax: index + 0.16, yMin: interval.low, yMax: interval.low,
          borderColor: COLORS.primarySolid, borderWidth: 2,
        };
        annotations[`${prefix}_${index}_capHigh`] = {
          type: 'line', xMin: index - 0.16, xMax: index + 0.16, yMin: interval.high, yMax: interval.high,
          borderColor: COLORS.primarySolid, borderWidth: 2,
        };
      }
      return;
    }

    const estimatePlottable = isPlottableEstimate(interval.estimate, scale);
    const fallback = scale === 'logarithmic' ? (input.referenceValue ?? 1) : 0;
    annotations[`${prefix}_${index}_unavailable`] = {
      type: 'label',
      xValue: orientation === 'horizontal' ? (estimatePlottable ? interval.estimate : fallback) : index,
      yValue: orientation === 'horizontal' ? index : (estimatePlottable ? interval.estimate : fallback),
      content: estimatePlottable ? `${intervalLabel} indisponível` : 'Valor não plotável',
      color: COLORS.warning,
      backgroundColor: 'rgba(255,255,255,0.9)',
      font: { size: 10, weight: 'bold' },
      yAdjust: -14,
      clip: false,
    };
  });

  if (input.referenceValue !== undefined && Number.isFinite(input.referenceValue)) {
    annotations.showReferenceLine = orientation === 'horizontal'
      ? {
          type: 'line', xMin: input.referenceValue, xMax: input.referenceValue,
          borderColor: 'rgba(15, 23, 42, 0.35)', borderWidth: 1.5, borderDash: [4, 4],
        }
      : {
          type: 'line', yMin: input.referenceValue, yMax: input.referenceValue,
          borderColor: 'rgba(15, 23, 42, 0.35)', borderWidth: 1.5, borderDash: [4, 4],
        };
  }

  const data: ChartData = {
    datasets: [{
      lacirId: 'interval-estimates',
      label: input.estimateLabel ?? 'Estimativa',
      data: points,
      backgroundColor: COLORS.primary,
      borderColor: '#FFFFFF',
      borderWidth: 1.5,
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: false,
    }],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: false },
      title: input.title ? {
        display: true,
        text: input.title,
        color: COLORS.text,
        font: { size: 13, weight: 'bold' },
      } : undefined,
      annotation: {
        annotations: annotations as NonNullable<
          NonNullable<NonNullable<ChartOptions['plugins']>['annotation']>['annotations']
        >,
      },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'scatter'>) => {
            const raw = item.raw as { x: number; y: number };
            const index = orientation === 'horizontal' ? Math.round(raw.y) : Math.round(raw.x);
            const interval = input.intervals[index];
            if (!interval) return '';
            if (!hasPlottableInterval(interval, scale)) {
              return `${interval.label}: ${fmtNumber(interval.estimate, 3)} (${intervalLabel} indisponível)`;
            }
            return `${interval.label}: ${fmtNumber(interval.estimate, 3)} (${intervalLabel}: ${fmtNumber(interval.low, 3)} a ${fmtNumber(interval.high, 3)})`;
          },
        },
      },
    },
    scales: orientation === 'horizontal'
      ? {
          x: {
            type: scale,
            title: { display: Boolean(input.xTitle), text: input.xTitle },
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ...(scale === 'logarithmic' ? { ticks: { callback: logarithmicTick } } : {}),
          },
          y: {
            type: 'linear', min: -0.5, max: Math.max(input.intervals.length - 0.5, 0.5), reverse: true,
            ticks: { stepSize: 1, autoSkip: false, callback: categoryTick(labels) },
            title: { display: Boolean(input.yTitle), text: input.yTitle },
          },
        }
      : {
          x: {
            type: 'linear', min: -0.5, max: Math.max(input.intervals.length - 0.5, 0.5),
            ticks: { stepSize: 1, autoSkip: false, callback: categoryTick(labels) },
            title: { display: Boolean(input.xTitle), text: input.xTitle },
          },
          y: {
            type: scale,
            title: { display: Boolean(input.yTitle), text: input.yTitle },
            grace: '12%',
          },
        },
  } as ChartOptions);

  return { data, options };
}
