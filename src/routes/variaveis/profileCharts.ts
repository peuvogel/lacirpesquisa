import type { ChartData, ChartOptions } from 'chart.js';
import type { ChartCanvasType } from '@/shared/charts/ChartCanvas';
import { BASE_OPTS, COLORS, mergeChartOptions } from '@/shared/charts/chartTheme';
import type { DistributionViewModel } from './guidedViewModels';

export interface GuidedProfileChart {
  type: ChartCanvasType;
  data: ChartData;
  options: ChartOptions;
  ariaLabel: string;
}

const rangeNumber = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function binLabel(lower: number, upper: number): string {
  return `${rangeNumber.format(lower)}–${rangeNumber.format(upper)}`;
}

export function buildHistogramChart(distribution: DistributionViewModel, label: string): GuidedProfileChart {
  const bins = distribution.histogram ?? [];
  const labels = bins.map((bin) => binLabel(bin.lower, bin.upper));
  return {
    type: 'bar',
    ariaLabel: `Histograma de ${label}`,
    data: {
      labels,
      datasets: [{
        label: 'Frequência',
        data: bins.map((bin) => bin.count),
        backgroundColor: COLORS.primarySolid,
        borderColor: COLORS.primary,
        borderWidth: 1,
      }],
    },
    options: mergeChartOptions(BASE_OPTS, {
      plugins: {
        title: { display: true, text: `Distribuição de ${label}` },
        tooltip: {
          callbacks: {
            title: (items) => `Faixa: ${items[0]?.label ?? ''}`,
          },
        },
      },
      scales: {
        x: { title: { display: true, text: 'Faixa de valores' }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Frequência' } },
      },
    }),
  };
}

export function buildQqChart(distribution: DistributionViewModel, label: string): GuidedProfileChart {
  const points = distribution.qqPoints ?? [];
  const referenceValues = points.map((point) => point.theoretical);
  const minimum = Math.min(...referenceValues);
  const maximum = Math.max(...referenceValues);

  return {
    type: 'scatter',
    ariaLabel: `Gráfico quantil-quantil de ${label}`,
    data: {
      datasets: [
        {
          label: 'Observado',
          data: points.map((point) => ({ x: point.theoretical, y: point.observed })),
          backgroundColor: COLORS.primarySolid,
          borderColor: COLORS.primary,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Referência normal',
          data: [{ x: minimum, y: minimum }, { x: maximum, y: maximum }],
          borderColor: COLORS.muted,
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          showLine: true,
        },
      ],
    },
    options: mergeChartOptions(BASE_OPTS, {
      plugins: {
        title: { display: true, text: `Gráfico Q–Q de ${label}` },
      },
      scales: {
        x: { title: { display: true, text: 'Quantil esperado' } },
        y: { title: { display: true, text: 'Quantil observado' } },
      },
    }),
  };
}

export function buildCategoryChart(distribution: DistributionViewModel, label: string): GuidedProfileChart {
  const categories = distribution.categories ?? [];
  return {
    type: 'bar',
    ariaLabel: `Frequências de ${label}`,
    data: {
      labels: categories.map((category) => category.label),
      datasets: [{
        label: 'Frequência',
        data: categories.map((category) => category.count),
        backgroundColor: COLORS.primarySolid,
        borderColor: COLORS.primary,
        borderWidth: 1,
      }],
    },
    options: mergeChartOptions(BASE_OPTS, {
      plugins: {
        title: { display: true, text: `Frequências de ${label}` },
      },
      scales: {
        x: { title: { display: true, text: 'Categoria' }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Frequência' } },
      },
    }),
  };
}
