import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import jStat from 'jstat';
import { fmtNumber, fmtSigned } from '@/shared/format';
import type { OneWayAnovaResult } from '@/shared/stats/statsEngine';
import { mergeChartOptions } from '../chartTheme';
import {
  buildPointIntervalChartData,
  type PointInterval,
} from './pointIntervalChart';

export interface AnovaChartInput {
  groupOrder: string[];
  result: OneWayAnovaResult;
}

export function groupMeanTInterval(
  label: string,
  mean: number,
  sd: number,
  n: number,
): PointInterval {
  if (
    n < 2
    || !Number.isFinite(mean)
    || !Number.isFinite(sd)
    || sd < 0
  ) return { label, estimate: mean, low: null, high: null };
  const critical = jStat.studentt.inv(0.975, n - 1);
  const margin = critical * (sd / Math.sqrt(n));
  if (!Number.isFinite(margin)) return { label, estimate: mean, low: null, high: null };
  return { label, estimate: mean, low: mean - margin, high: mean + margin };
}

/** Group means with two-sided 95% Student-t confidence intervals. */
export function buildAnovaMeansChartData(
  input: AnovaChartInput,
): { data: ChartData; options: ChartOptions } {
  const intervals = input.groupOrder.map((label) => {
    const stats = input.result.groupStats[label];
    return groupMeanTInterval(label, stats.mean, stats.sd, stats.n);
  });
  const chart = buildPointIntervalChartData({
    intervals,
    orientation: 'vertical',
    estimateLabel: 'Média',
    intervalLabel: 'IC95%',
    xTitle: 'Grupo',
    yTitle: 'Desfecho',
  });
  const options = mergeChartOptions(chart.options, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'scatter'>) => {
            const raw = item.raw as { x: number };
            const index = Math.round(raw.x);
            const label = input.groupOrder[index];
            const stats = input.result.groupStats[label];
            const interval = intervals[index];
            if (interval.low === null || interval.high === null) {
              return `Média: ${fmtNumber(stats.mean, 2)} (n=${stats.n}; IC95% indisponível)`;
            }
            return `Média: ${fmtNumber(stats.mean, 2)} (n=${stats.n}; IC95%: ${fmtSigned(interval.low, 2)} a ${fmtSigned(interval.high, 2)})`;
          },
        },
      },
    },
  });
  return { data: chart.data, options };
}
