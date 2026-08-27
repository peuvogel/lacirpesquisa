import type { ChartData, ChartOptions } from 'chart.js';
import type { GlmCoefficient } from '@/shared/stats/glmEngine';
import { BASE_OPTS, mergeChartOptions } from '../chartTheme';
import { fmtNumber, fmtSigned } from '@/shared/format';
import { buildPointIntervalChartData, type PointInterval } from './pointIntervalChart';

export interface GlmCoefForestInput {
  coefficients: GlmCoefficient[];
  /** When set, plot exp(beta) instead of beta (logistic OR forest). */
  scale?: 'beta' | 'or';
  title?: string;
}

function ci95(coef: GlmCoefficient): [number, number] {
  const delta = 1.96 * coef.se;
  return [coef.beta - delta, coef.beta + delta];
}

function displayValue(beta: number, scale: 'beta' | 'or'): number {
  return scale === 'or' ? Math.exp(beta) : beta;
}

function coefficientInterval(coef: GlmCoefficient, scale: 'beta' | 'or'): PointInterval {
  const estimate = displayValue(coef.beta, scale);
  if (!Number.isFinite(coef.beta) || !Number.isFinite(coef.se) || coef.se < 0) {
    return { label: coef.term, estimate, low: null, high: null };
  }
  const [rawLow, rawHigh] = ci95(coef);
  const low = displayValue(rawLow, scale);
  const high = displayValue(rawHigh, scale);
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return { label: coef.term, estimate, low: null, high: null };
  }
  return { label: coef.term, estimate, low, high };
}

/** Horizontal coefficient/OR forest with 95% CI whiskers — shared by GLM modules. */
export function buildGlmCoefForestChartData(
  input: GlmCoefForestInput,
): { data: ChartData; options: ChartOptions } {
  const scale = input.scale ?? 'beta';
  const rows = input.coefficients.filter((coef) => coef.term !== '(Intercept)');

  if (!rows.length) {
    return {
      data: { labels: ['—'], datasets: [] },
      options: mergeChartOptions(BASE_OPTS, {
        indexAxis: 'y',
        plugins: { title: { display: true, text: input.title ?? 'Coeficientes' } },
      }),
    };
  }

  const intervals = rows.map((coef) => coefficientInterval(coef, scale));
  const chart = buildPointIntervalChartData({
    intervals,
    scale: scale === 'or' ? 'logarithmic' : 'linear',
    referenceValue: scale === 'or' ? 1 : 0,
    estimateLabel: scale === 'or' ? 'Odds ratio' : 'Coeficiente',
    intervalLabel: 'IC95%',
    xTitle: scale === 'or' ? 'Odds ratio (escala log)' : 'Coeficiente β',
    title: input.title ?? (scale === 'or' ? 'Odds ratios' : 'Coeficientes'),
  });
  const options = mergeChartOptions(chart.options, {
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: input.title ?? (scale === 'or' ? 'Odds ratios' : 'Coeficientes'),
        color: '#1E293B',
        font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
        padding: { bottom: 10 },
      },
      tooltip: {
        callbacks: {
          label: (item) => {
            const raw = item.raw as { y: number };
            const index = Math.round(raw.y);
            const interval = intervals[index];
            if (interval.low === null || interval.high === null) {
              return `${interval.label}: ${fmtSigned(interval.estimate, 3)} (IC95% indisponível)`;
            }
            return `${interval.label}: ${fmtSigned(interval.estimate, 3)} (IC95%: ${fmtNumber(interval.low, 3)} a ${fmtNumber(interval.high, 3)})`;
          },
        },
      },
    },
  });

  return { data: chart.data, options };
}
