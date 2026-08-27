import { describe, expect, it } from 'vitest';
import { buildChiProportionChartData } from './chiProportionChart';

describe('buildChiProportionChartData', () => {
  it('plots within-row percentages as a 100% stacked comparison', () => {
    const { data, options } = buildChiProportionChartData({
      observed: [[30, 10], [10, 30]],
      rowLabels: ['Exposto', 'Controle'],
      colLabels: ['Caso', 'Não caso'],
    });

    expect(data.labels).toEqual(['Exposto', 'Controle']);
    expect(data.datasets[0].data).toEqual([75, 25]);
    expect(data.datasets[1].data).toEqual([25, 75]);
    expect(options.scales?.x).toMatchObject({ stacked: true });
    expect(options.scales?.y).toMatchObject({ stacked: true, max: 100 });
  });

  it('uses null for a row with a zero denominator', () => {
    const { data } = buildChiProportionChartData({
      observed: [[0, 0], [2, 3]],
      rowLabels: ['Sem observações', 'Com observações'],
      colLabels: ['A', 'B'],
    });
    expect(data.datasets.map((dataset) => dataset.data[0])).toEqual([null, null]);
  });
});
