import { describe, expect, it } from 'vitest';
import type { DistributionViewModel } from './guidedViewModels';
import { buildCategoryChart, buildHistogramChart, buildQqChart } from './profileCharts';

function axisTitle(chart: { options: { scales?: unknown } }, axis: 'x' | 'y'): string | undefined {
  return (chart.options.scales as Record<string, { title?: { text?: string } }> | undefined)?.[axis]?.title?.text;
}

const distribution: DistributionViewModel = {
  title: 'Histograma e Q–Q',
  description: 'Distribuição observada.',
  histogram: [
    { lower: 5, upper: 6, count: 3 },
    { lower: 6, upper: 7, count: 5 },
  ],
  qqPoints: [
    { theoretical: -1, observed: 5.1 },
    { theoretical: 1, observed: 6.9 },
  ],
  categories: [
    { label: 'Alta', count: 88 },
    { label: 'Óbito', count: 8 },
  ],
};

describe('profileCharts', () => {
  it('labels histogram axes and exposes literal bin ranges to the chart', () => {
    const chart = buildHistogramChart(distribution, 'Taxa de mortalidade');

    expect(chart.type).toBe('bar');
    expect(chart.ariaLabel).toBe('Histograma de Taxa de mortalidade');
    expect(axisTitle(chart, 'x')).toBe('Faixa de valores');
    expect(axisTitle(chart, 'y')).toBe('Frequência');
    expect(chart.data.labels).toEqual(['5,0–6,0', '6,0–7,0']);
    expect(chart.data.datasets[0]?.data).toEqual([3, 5]);
  });

  it('draws observed points and the observed-equals-expected reference in the Q–Q chart', () => {
    const chart = buildQqChart(distribution, 'Taxa de mortalidade');

    expect(chart.type).toBe('scatter');
    expect(chart.ariaLabel).toBe('Gráfico quantil-quantil de Taxa de mortalidade');
    expect(chart.data.datasets).toHaveLength(2);
    expect(chart.data.datasets[0]).toMatchObject({
      label: 'Observado',
      data: [{ x: -1, y: 5.1 }, { x: 1, y: 6.9 }],
    });
    expect(chart.data.datasets[1]).toMatchObject({
      label: 'Referência normal',
      data: [{ x: -1, y: -1 }, { x: 1, y: 1 }],
      borderDash: [6, 4],
    });
  });

  it('renders categorical frequencies as a shared bar chart', () => {
    const chart = buildCategoryChart(distribution, 'Desfecho hospitalar');

    expect(chart.type).toBe('bar');
    expect(chart.ariaLabel).toBe('Frequências de Desfecho hospitalar');
    expect(chart.data.labels).toEqual(['Alta', 'Óbito']);
    expect(chart.data.datasets[0]).toMatchObject({ label: 'Frequência', data: [88, 8] });
    expect(axisTitle(chart, 'x')).toBe('Categoria');
    expect(axisTitle(chart, 'y')).toBe('Frequência');
  });
});
