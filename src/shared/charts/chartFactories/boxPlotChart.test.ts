import { describe, expect, it } from 'vitest';
import { buildBoxPlotChartData, summarizeBoxPlot } from './boxPlotChart';

function annotationsOf(options: ReturnType<typeof buildBoxPlotChartData>['options']) {
  return (options.plugins?.annotation as { annotations?: Record<string, Record<string, unknown>> })
    ?.annotations ?? {};
}

describe('summarizeBoxPlot', () => {
  it('uses linear-interpolation quartiles and 1.5×IQR observed whiskers', () => {
    expect(summarizeBoxPlot([1, 2, 3, 4, 100])).toEqual({
      n: 5,
      median: 3,
      q1: 2,
      q3: 4,
      low: 1,
      high: 4,
      outliers: [100],
    });
  });

  it('sorts without mutating the source and keeps duplicate outliers', () => {
    const source = [100, 8, 7, 6, 5, 4, 3, 2, 1, 100];
    const summary = summarizeBoxPlot(source);

    expect(source).toEqual([100, 8, 7, 6, 5, 4, 3, 2, 1, 100]);
    expect(summary.outliers).toEqual([100, 100]);
    expect(summary.low).toBe(1);
    expect(summary.high).toBe(8);
  });
});

describe('buildBoxPlotChartData', () => {
  it('renders the box, median, whiskers, caps and every raw point at their numeric extents', () => {
    const groups = Object.assign(Object.create(null), {
      A: [1, 2, 3, 4, 100],
      B: [10, 11, 12, 13, 14],
    }) as Record<string, number[]>;
    const { data, options } = buildBoxPlotChartData(groups, ['A', 'B'], 'Desfecho');
    const annotations = annotationsOf(options);

    expect(data.datasets.flatMap((dataset) => dataset.data)).toHaveLength(10);
    expect(data.datasets.find((dataset) => dataset.label === 'Outliers (1,5×IQR)')?.data)
      .toEqual([expect.objectContaining({ y: 100 })]);
    expect(annotations.box_0).toMatchObject({ xMin: -0.25, xMax: 0.25, yMin: 2, yMax: 4 });
    expect(annotations.median_0).toMatchObject({ xMin: -0.25, xMax: 0.25, yMin: 3, yMax: 3 });
    expect(annotations.whiskerLow_0).toMatchObject({ xMin: 0, xMax: 0, yMin: 1, yMax: 2 });
    expect(annotations.whiskerHigh_0).toMatchObject({ xMin: 0, xMax: 0, yMin: 4, yMax: 4 });
    expect(annotations.capLow_0).toMatchObject({ xMin: -0.12, xMax: 0.12, yMin: 1, yMax: 1 });
    expect(annotations.capHigh_0).toMatchObject({ xMin: -0.12, xMax: 0.12, yMin: 4, yMax: 4 });
  });
});
