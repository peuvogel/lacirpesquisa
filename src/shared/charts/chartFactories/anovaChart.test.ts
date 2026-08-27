import { describe, expect, it } from 'vitest';
import { buildAnovaMeansChartData } from './anovaChart';
import type { OneWayAnovaResult } from '@/shared/stats/statsEngine';

function fixtureResult(): OneWayAnovaResult {
  return {
    f: 3,
    dfBetween: 1,
    dfWithin: 8,
    p: 0.04,
    eta2: 0.2,
    msWithin: 4,
    groupStats: Object.assign(Object.create(null), {
      A: { n: 5, mean: 10, sd: 2 },
      B: { n: 1, mean: 12, sd: Number.NaN },
    }),
  };
}

describe('buildAnovaMeansChartData', () => {
  it('uses a t interval around the estimate instead of plotting a margin as a second bar', () => {
    const { data, options } = buildAnovaMeansChartData({
      groupOrder: ['A', 'B'],
      result: fixtureResult(),
    });
    const annotations = (options.plugins?.annotation as {
      annotations?: Record<string, Record<string, unknown>>;
    })?.annotations ?? {};

    expect(data.datasets).toHaveLength(1);
    expect(data.datasets[0]?.data).toEqual([{ x: 0, y: 10 }, { x: 1, y: 12 }]);
    expect(annotations.showConfidenceIntervals_0_line.yMin).toBeCloseTo(7.5168, 3);
    expect(annotations.showConfidenceIntervals_0_line.yMax).toBeCloseTo(12.4832, 3);
    expect(annotations.showConfidenceIntervals_1_unavailable).toMatchObject({
      content: 'IC95% indisponível',
    });
  });
});
