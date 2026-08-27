import { describe, expect, it } from 'vitest';
import { buildGlmCoefForestChartData } from './glmCoefForestChart';

function annotationsOf(options: ReturnType<typeof buildGlmCoefForestChartData>['options']) {
  return (options.plugins?.annotation as { annotations?: Record<string, Record<string, unknown>> })
    ?.annotations ?? {};
}

describe('buildGlmCoefForestChartData', () => {
  it('renders visible beta interval geometry and reference zero', () => {
    const { data, options } = buildGlmCoefForestChartData({
      coefficients: [
        { term: '(Intercept)', beta: 0, se: 0.1, z: 0, p: 1 },
        { term: 'idade', beta: 0.4, se: 0.1, z: 4, p: 0.001 },
      ],
      scale: 'beta',
    });
    const annotations = annotationsOf(options);

    expect(data.datasets[0]?.data).toEqual([{ x: 0.4, y: 0 }]);
    expect(annotations.showConfidenceIntervals_0_line.xMin).toBeCloseTo(0.204, 8);
    expect(annotations.showConfidenceIntervals_0_line.xMax).toBeCloseTo(0.596, 8);
    expect(annotations.showConfidenceIntervals_0_line).toMatchObject({ yMin: 0, yMax: 0 });
    expect(annotations.showReferenceLine).toMatchObject({ xMin: 0, xMax: 0 });
    expect(options.scales?.x).not.toMatchObject({ type: 'logarithmic' });
  });

  it('renders exponentiated CI on a logarithmic scale with reference one', () => {
    const { data, options } = buildGlmCoefForestChartData({
      coefficients: [
        { term: 'exposição', beta: Math.log(2), se: 0.1, z: 6.9, p: 0.001 },
      ],
      scale: 'or',
    });
    const annotations = annotationsOf(options);
    const point = data.datasets[0]?.data[0] as { x: number; y: number };

    expect(point.x).toBeCloseTo(2, 8);
    expect(annotations.showConfidenceIntervals_0_line.xMin).toBeCloseTo(1.644, 3);
    expect(annotations.showConfidenceIntervals_0_line.xMax).toBeCloseTo(2.433, 3);
    expect(annotations.showReferenceLine).toMatchObject({ xMin: 1, xMax: 1 });
    expect(options.scales?.x).toMatchObject({ type: 'logarithmic' });
  });
});
