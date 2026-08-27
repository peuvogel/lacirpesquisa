import { describe, expect, it } from 'vitest';
import type { ChartProps } from './useChartCustomizer';
import {
  applyChartCapabilities,
  capabilityDefaults,
  type ChartCapability,
} from './chartCapabilities';

const capabilities: ChartCapability[] = [
  {
    id: 'showFit',
    kind: 'datasetVisibility',
    datasetIds: ['fit'],
  },
  {
    id: 'showLabels',
    kind: 'annotationVisibility',
    annotationIds: ['coefficientLabel'],
    annotationPrefixes: ['pointLabel_'],
  },
  {
    id: 'logY',
    kind: 'scaleType',
    axis: 'y',
    enabledType: 'logarithmic',
    disabledType: 'linear',
    defaultEnabled: false,
  },
];

const chart: ChartProps = {
  type: 'scatter',
  ariaLabel: 'Exemplo',
  data: {
    datasets: [
      { label: 'Observado', data: [1, 2], lacirId: 'observed' },
      { label: 'Ajuste', data: [1, 2], lacirId: 'fit' },
    ],
  },
  options: {
    scales: { y: { type: 'linear' } },
    plugins: {
      annotation: {
        annotations: {
          coefficientLabel: { type: 'label' },
          pointLabel_0: { type: 'label' },
          zeroLine: { type: 'line' },
        },
      },
    },
  },
};

describe('chartCapabilities', () => {
  it('changes only the declared datasets, annotations and scale property', () => {
    const next = applyChartCapabilities(
      chart,
      { showFit: false, showLabels: false, logY: true },
      capabilities,
    );

    expect(next.data.datasets.find((dataset) => dataset.lacirId === 'fit')?.hidden).toBe(true);
    expect(next.data.datasets.find((dataset) => dataset.lacirId === 'observed')?.hidden).not.toBe(true);
    const annotations = (
      next.options?.plugins?.annotation as { annotations?: Record<string, unknown> }
    )?.annotations;
    expect(annotations).toEqual({ zeroLine: { type: 'line' } });
    expect(next.options?.scales?.y).toMatchObject({ type: 'logarithmic' });
  });

  it('honors declared defaults instead of enabling every control globally', () => {
    expect(capabilityDefaults(capabilities)).toEqual({
      showFit: true,
      showLabels: true,
      logY: false,
    });
    const next = applyChartCapabilities(chart, {}, capabilities);
    expect(next.options?.scales?.y).toMatchObject({ type: 'linear' });
  });

  it('merges highlighted points into their declared base dataset when disabled', () => {
    const next = applyChartCapabilities(
      {
        ...chart,
        data: {
          datasets: [
            { data: [{ x: 1, y: 1 }], lacirId: 'points' },
            { data: [{ x: 9, y: 9 }], lacirId: 'outliers' },
          ],
        },
      },
      { highlight: false },
      [{
        id: 'highlight',
        kind: 'datasetVisibility',
        datasetIds: ['outliers'],
        disabledBehavior: 'merge',
        mergeIntoDatasetId: 'points',
      }],
    );

    expect(next.data.datasets).toHaveLength(1);
    expect(next.data.datasets[0].data).toEqual([{ x: 1, y: 1 }, { x: 9, y: 9 }]);
  });
});
