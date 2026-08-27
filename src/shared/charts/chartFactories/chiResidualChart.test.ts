import { describe, expect, it } from 'vitest';
import {
  buildChiResidualChartData,
  standardizedResidual,
} from './chiResidualChart';

describe('standardizedResidual', () => {
  it('matches the adjusted Pearson residual fixture', () => {
    expect(standardizedResidual(30, 25, 0.5, 0.5)).toBe(2);
  });

  it('returns null for zero or non-finite denominators', () => {
    expect(standardizedResidual(0, 0, 0.5, 0.5)).toBeNull();
    expect(standardizedResidual(1, 1, 1, 0.5)).toBeNull();
    expect(standardizedResidual(1, Number.NaN, 0.5, 0.5)).toBeNull();
  });
});

describe('buildChiResidualChartData', () => {
  it('builds a labeled diverging heatmap and retains unavailable cells', () => {
    const { data, options } = buildChiResidualChartData({
      observed: [[30, 0], [20, 0]],
      expected: [[25, 0], [25, 0]],
      rowLabels: ['Exposto', 'Controle'],
      colLabels: ['Caso', 'Sem observações'],
    });

    expect(data.datasets.map((dataset) => dataset.label)).toEqual([
      'Residual positivo',
      'Residual negativo',
      'Residual indisponível',
    ]);
    expect(data.datasets.flatMap((dataset) => dataset.data)).toHaveLength(4);
    expect(options.plugins?.legend).toMatchObject({ display: true });
  });
});
