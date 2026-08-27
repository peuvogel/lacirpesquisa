import { describe, expect, it } from 'vitest';
import { buildPairedComparisonChartData } from './pairedComparisonChart';

describe('buildPairedComparisonChartData', () => {
  it('connects values by their actual row pairing', () => {
    const { data } = buildPairedComparisonChartData(
      [10, 40, 20],
      [12, 18, 27],
      ['Antes', 'Depois'],
    );

    expect(data.datasets.map((dataset) => dataset.data)).toEqual([
      [{ x: 0, y: 10 }, { x: 1, y: 12 }],
      [{ x: 0, y: 40 }, { x: 1, y: 18 }],
      [{ x: 0, y: 20 }, { x: 1, y: 27 }],
    ]);
  });

  it('never manufactures links for unmatched trailing values', () => {
    const { data } = buildPairedComparisonChartData([1, 2, 3], [4, 5], ['A', 'B']);
    expect(data.datasets).toHaveLength(2);
  });
});
