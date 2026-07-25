import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ChartData } from 'chart.js';
import {
  useChartCustomizer,
  sanitizeAxisLabel,
  DEBOUNCE_MS,
  type ChartPreset,
} from './useChartCustomizer';

const sampleData: ChartData = {
  labels: ['A', 'B'],
  datasets: [{ data: [1, 2] }],
};

const presets: ChartPreset<{ value: number }>[] = [
  {
    id: 'diff',
    label: 'Diferença de médias',
    buildChart: () => ({
      type: 'scatter',
      data: sampleData,
      options: { scales: { x: { title: { display: true, text: 'X default' } } } },
      ariaLabel: 'Gráfico de diferença',
    }),
    defaultAxisLabels: { x: 'Diferença', y: 'Valor' },
  },
  {
    id: 'dist',
    label: 'Distribuição por grupo',
    buildChart: () => ({
      type: 'bar',
      data: sampleData,
      ariaLabel: 'Gráfico de distribuição',
    }),
    defaultAxisLabels: { x: 'Grupo', y: 'Valor médio' },
  },
];

describe('useChartCustomizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the default preset chart', () => {
    const { result } = renderHook(() =>
      useChartCustomizer({
        presets,
        defaultPresetId: 'diff',
        engineOutput: { value: 1 },
      }),
    );

    expect(result.current.state.chartTypePreset).toBe('diff');
    expect(result.current.chart.type).toBe('scatter');
    expect(result.current.chart.ariaLabel).toBe('Gráfico de diferença');
  });

  it('switches preset and rebuilds chart', () => {
    const { result } = renderHook(() =>
      useChartCustomizer({
        presets,
        defaultPresetId: 'diff',
        engineOutput: { value: 1 },
      }),
    );

    act(() => {
      result.current.setChartTypePreset('dist');
    });

    expect(result.current.state.chartTypePreset).toBe('dist');
    expect(result.current.chart.type).toBe('bar');
    expect(result.current.chart.ariaLabel).toBe('Gráfico de distribuição');
    expect(result.current.state.axisLabels.x).toBe('Grupo');
  });

  it('resetToDefault restores initial preset and axis labels', () => {
    const { result } = renderHook(() =>
      useChartCustomizer({
        presets,
        defaultPresetId: 'diff',
        engineOutput: { value: 1 },
      }),
    );

    act(() => {
      result.current.setChartTypePreset('dist');
      result.current.setAxisLabel('x', 'Custom X');
      result.current.setThemeVariant('neutral');
    });

    act(() => {
      result.current.resetToDefault();
    });

    expect(result.current.state.chartTypePreset).toBe('diff');
    expect(result.current.state.axisLabels.x).toBe('Diferença');
    expect(result.current.state.themeVariant).toBe('lacir');
  });

  it('debounces option merge before emitting debouncedOptions', () => {
    const { result } = renderHook(() =>
      useChartCustomizer({
        presets,
        defaultPresetId: 'diff',
        engineOutput: { value: 1 },
      }),
    );

    act(() => {
      result.current.setAxisLabel('x', 'Novo eixo X');
    });

    expect(result.current.state.axisLabels.x).toBe('Novo eixo X');

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(result.current.debouncedOptions).toBeDefined();
    expect(
      (result.current.debouncedOptions?.scales?.x as { title?: { text?: string } })?.title?.text,
    ).toBe('Novo eixo X');
  });

  it('sanitizeAxisLabel truncates to 120 characters (T-02-01)', () => {
    const long = 'a'.repeat(150);
    expect(sanitizeAxisLabel(long).length).toBe(120);
  });
});
