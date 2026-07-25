import type { ChartData, ChartOptions } from 'chart.js';
import type { GlmCoefficient } from '@/shared/stats/glmEngine';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber, fmtSigned } from '@/shared/format';

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

/** Horizontal coefficient/OR forest with 95% CI whiskers — shared by GLM modules. */
export function buildGlmCoefForestChartData(
  input: GlmCoefForestInput,
): { data: ChartData; options: ChartOptions } {
  const scale = input.scale ?? 'beta';
  const terms = input.coefficients
    .filter((coef) => coef.term !== '(Intercept)')
    .map((coef) => coef.term);
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

  const estimates = rows.map((coef) => displayValue(coef.beta, scale));
  const ciLow = rows.map((coef) => displayValue(ci95(coef)[0], scale));
  const ciHigh = rows.map((coef) => displayValue(ci95(coef)[1], scale));

  const data: ChartData = {
    labels: terms,
    datasets: [
      {
        label: scale === 'or' ? 'Odds ratio (IC95%)' : 'Coeficiente (IC95%)',
        data: estimates.map((value, index) => ({ x: value, y: index })),
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primarySolid,
        pointRadius: 7,
        pointHoverRadius: 9,
        showLine: false,
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    indexAxis: 'y',
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
            const index = item.dataIndex;
            const estimate = estimates[index];
            const low = ciLow[index];
            const high = ciHigh[index];
            return `${terms[index]}: ${fmtSigned(estimate, 3)} (IC95%: ${fmtNumber(low, 3)} a ${fmtNumber(high, 3)})`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: scale === 'or' ? 'Odds ratio (escala log)' : 'Coeficiente β',
        },
        grid: { color: 'rgba(15, 23, 42, 0.06)' },
      },
      y: {
        ticks: { autoSkip: false },
      },
    },
  });

  return { data, options };
}
