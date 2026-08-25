import { describe, expect, it } from 'vitest';
import {
  buildTStudentDiffChartData,
  buildTStudentDistChartData,
  buildTStudentMeansBarChartData,
  buildScatterChartData,
  buildRankScatterChartData,
  buildScatterWithFitChartData,
  buildTimeseriesChartData,
  buildResidualBarChartData,
} from './index';

describe('chartFactories', () => {
  it('buildTStudentDiffChartData returns non-empty datasets and merged options', () => {
    const { data, options } = buildTStudentDiffChartData({ diff: 1.5, ci: [0.5, 2.5] });
    expect(data.datasets?.length).toBeGreaterThan(0);
    expect(data.datasets?.[0]?.data?.length).toBeGreaterThan(0);
    expect(options.plugins?.tooltip).toBeDefined();
    expect((options.scales?.x as { title?: unknown })?.title).toBeDefined();
  });

  it('buildTStudentDistChartData preserves every raw observation in a dot plot', () => {
    const { data, options } = buildTStudentDistChartData([1, 2, 3], [4, 5, 6], 'A', 'B');
    expect(data.datasets).toHaveLength(2);
    expect(data.datasets?.flatMap((dataset) => dataset.data)).toHaveLength(6);
    expect(data.datasets?.[0]?.data).toEqual([
      expect.objectContaining({ y: 1 }),
      expect.objectContaining({ y: 2 }),
      expect.objectContaining({ y: 3 }),
    ]);
    expect((options.scales?.x as { ticks?: { callback?: unknown } })?.ticks?.callback).toBeTypeOf(
      'function',
    );
    expect(options.plugins?.tooltip).toBeDefined();
  });

  it('buildTStudentMeansBarChartData returns means bar chart', () => {
    const { data } = buildTStudentMeansBarChartData({ m1: 3, m2: 7 }, ['G1', 'G2']);
    expect(data.labels).toEqual(['G1', 'G2']);
    expect(data.datasets?.[0]?.data).toEqual([3, 7]);
  });

  it('buildScatterChartData returns scatter datasets', () => {
    const { data, options } = buildScatterChartData(
      { x: [1, 2, 3], y: [2, 4, 6], headers: ['X', 'Y'] },
      { intercept: 0, slope: 2 },
    );
    expect(data.datasets?.length).toBeGreaterThanOrEqual(2);
    expect((options.scales?.x as { title?: unknown })?.title).toBeDefined();
  });

  it('buildRankScatterChartData returns rank scatter datasets', () => {
    const { data } = buildRankScatterChartData(
      { x: [10, 20, 30], y: [1, 2, 3], headers: ['A', 'B'] },
    );
    expect(data.datasets?.length).toBeGreaterThan(0);
    expect(data.datasets?.[0]?.data?.length).toBe(3);
  });

  it('buildScatterWithFitChartData delegates to scatter builder', () => {
    const { data } = buildScatterWithFitChartData(
      [1, 2, 3],
      [2, 4, 6],
      { intercept: 0, slope: 2 },
    );
    expect(data.datasets?.length).toBeGreaterThanOrEqual(2);
  });

  it('buildTimeseriesChartData returns observed + fitted line datasets', () => {
    const { data, options } = buildTimeseriesChartData(
      [2010, 2011, 2012],
      [100, 110, 120],
      [101, 109, 121],
    );
    expect(data.datasets?.length).toBe(2);
    expect(data.labels?.length).toBe(3);
    expect(options.plugins?.tooltip).toBeDefined();
  });

  it('buildResidualBarChartData returns bar datasets with zero-line annotation', () => {
    const { data, options } = buildResidualBarChartData(
      [2010, 2011],
      [0.01, -0.02],
    );
    expect(data.datasets?.[0]?.data).toEqual([0.01, -0.02]);
    expect(options.plugins?.annotation).toBeDefined();
  });
});
