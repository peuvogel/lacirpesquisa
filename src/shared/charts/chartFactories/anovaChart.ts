import type { ChartData, ChartOptions } from 'chart.js';
import { BASE_OPTS, COLORS, mergeChartOptions } from '../chartTheme';
import { fmtNumber, fmtSigned } from '@/shared/format';
import type { OneWayAnovaResult } from '@/shared/stats/statsEngine';

export interface AnovaChartInput {
  groupOrder: string[];
  result: OneWayAnovaResult;
}

function groupCi(mean: number, sd: number, n: number): [number, number] {
  if (n < 2 || !Number.isFinite(sd)) return [mean, mean];
  const se = sd / Math.sqrt(n);
  const margin = 1.96 * se;
  return [mean - margin, mean + margin];
}

/** Group means with approximate 95% CI error bars. */
export function buildAnovaMeansChartData(
  input: AnovaChartInput,
): { data: ChartData; options: ChartOptions } {
  const { groupOrder, result } = input;
  const means = groupOrder.map((label) => result.groupStats[label].mean);
  const errors = groupOrder.map((label) => {
    const stats = result.groupStats[label];
    const [low, high] = groupCi(stats.mean, stats.sd, stats.n);
    return { low, high, margin: high - stats.mean };
  });

  const data: ChartData = {
    labels: groupOrder,
    datasets: [
      {
        label: 'Média',
        data: means,
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primarySolid,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'IC95% (aprox.)',
        data: errors.map((entry) => entry.margin),
        backgroundColor: 'rgba(15, 118, 110, 0.15)',
        borderColor: COLORS.primarySolid,
        borderWidth: 1.5,
        type: 'bar',
      },
    ],
  };

  const options = mergeChartOptions(BASE_OPTS, {
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (item) => {
            const label = groupOrder[item.dataIndex];
            const stats = result.groupStats[label];
            const [low, high] = groupCi(stats.mean, stats.sd, stats.n);
            if (item.datasetIndex === 0) {
              return `Média: ${fmtNumber(stats.mean, 2)} (n=${stats.n})`;
            }
            return `IC95%: ${fmtSigned(low, 2)} a ${fmtSigned(high, 2)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        grace: '12%',
        title: { display: true, text: 'Desfecho' },
      },
      x: {
        title: { display: true, text: 'Grupo' },
      },
    },
  });

  return { data, options };
}
