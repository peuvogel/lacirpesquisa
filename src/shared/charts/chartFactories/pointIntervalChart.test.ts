import { describe, expect, it } from 'vitest';
import { buildPointIntervalChartData } from './pointIntervalChart';

function annotationsOf(options: ReturnType<typeof buildPointIntervalChartData>['options']) {
  return (options.plugins?.annotation as { annotations?: Record<string, Record<string, unknown>> })
    ?.annotations ?? {};
}

describe('buildPointIntervalChartData', () => {
  it('draws horizontal interval lines, both caps, estimates and a beta reference at zero', () => {
    const { data, options } = buildPointIntervalChartData({
      intervals: [
        { label: 'idade', estimate: 0.4, low: 0.1, high: 0.7 },
        { label: 'sexo', estimate: -0.2, low: -0.5, high: 0.1 },
      ],
      referenceValue: 0,
      xTitle: 'Coeficiente β',
    });
    const annotations = annotationsOf(options);

    expect(data.datasets[0]?.data).toEqual([{ x: 0.4, y: 0 }, { x: -0.2, y: 1 }]);
    expect(annotations.showConfidenceIntervals_0_line).toMatchObject({ xMin: 0.1, xMax: 0.7, yMin: 0, yMax: 0 });
    expect(annotations.showConfidenceIntervals_0_capLow).toMatchObject({ xMin: 0.1, xMax: 0.1, yMin: -0.16, yMax: 0.16 });
    expect(annotations.showConfidenceIntervals_0_capHigh).toMatchObject({ xMin: 0.7, xMax: 0.7, yMin: -0.16, yMax: 0.16 });
    expect(annotations.showReferenceLine).toMatchObject({ xMin: 0, xMax: 0 });
  });

  it('uses a real logarithmic x scale and reference one for odds ratios', () => {
    const { options } = buildPointIntervalChartData({
      intervals: [{ label: 'exposição', estimate: 2, low: 1.25, high: 3.2 }],
      scale: 'logarithmic',
      referenceValue: 1,
      xTitle: 'Odds ratio',
    });

    expect(options.scales?.x).toMatchObject({ type: 'logarithmic' });
    expect(annotationsOf(options).showReferenceLine).toMatchObject({ xMin: 1, xMax: 1 });
    const xTicks = (options.scales?.x as { ticks?: { callback?: Function } }).ticks;
    const ticks = [{ value: 0.5 }, { value: 0.8 }, { value: 1 }];
    expect(xTicks?.callback?.(0.5, 0, ticks)).not.toBe('');
    expect(xTicks?.callback?.(0.8, 1, ticks)).toBe('');
    expect(xTicks?.callback?.(1, 2, ticks)).not.toBe('');
  });

  it('marks a missing interval explicitly instead of inventing zero width', () => {
    const { data, options } = buildPointIntervalChartData({
      intervals: [{ label: 'estimável', estimate: 1.2, low: null, high: null }],
    });

    expect(data.datasets[0]?.data).toEqual([{ x: 1.2, y: 0 }]);
    expect(annotationsOf(options).showConfidenceIntervals_0_unavailable).toMatchObject({
      type: 'label',
      content: 'IC indisponível',
    });
  });

  it('supports vertical intervals for group means', () => {
    const { data, options } = buildPointIntervalChartData({
      intervals: [{ label: 'A', estimate: 10, low: 8, high: 12 }],
      orientation: 'vertical',
      intervalLabel: 'IC95%',
    });
    const annotations = annotationsOf(options);

    expect(data.datasets[0]?.data).toEqual([{ x: 0, y: 10 }]);
    expect(annotations.showConfidenceIntervals_0_line).toMatchObject({ xMin: 0, xMax: 0, yMin: 8, yMax: 12 });
    expect(annotations.showConfidenceIntervals_0_capLow).toMatchObject({ xMin: -0.16, xMax: 0.16, yMin: 8, yMax: 8 });
    const xTicks = (options.scales?.x as { ticks?: { callback?: Function } }).ticks;
    expect(xTicks?.callback?.(0, 0, [])).toBe('A');
    expect(xTicks?.callback?.(-0.5, 1, [])).toBe('');
  });
});
