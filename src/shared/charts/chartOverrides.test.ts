import { describe, expect, it } from 'vitest';
import { applyChartOverrides, extractEditableFields, wrapChartTitle } from './chartOverrides';
import type { ChartProps } from './useChartCustomizer';

const sampleBar: ChartProps = {
  type: 'bar',
  ariaLabel: 'Médias',
  data: {
    labels: ['Grupo A', 'Grupo B'],
    datasets: [
      {
        label: 'Média',
        data: [1, 2],
        backgroundColor: ['#2563EB', '#0D9488'],
        maxBarThickness: 56,
        categoryPercentage: 0.55,
      },
    ],
  },
  options: {
    scales: {
      x: { title: { display: true, text: 'Grupo' } },
      y: { title: { display: true, text: 'Valor' } },
    },
  },
};

describe('chartOverrides', () => {
  it('renames categories and colors when applying overrides', () => {
    const next = applyChartOverrides(sampleBar, {
      title: 'Comparação',
      categoryLabels: ['Controle', 'Intervenção'],
      colors: ['#ff0000', '#00ff00'],
      barThickness: 32,
    });

    expect(next.data.labels).toEqual(['Controle', 'Intervenção']);
    expect(next.data.datasets[0].backgroundColor).toEqual(['#ff0000', '#00ff00']);
    expect(
      (next.data.datasets[0] as { maxBarThickness?: number }).maxBarThickness,
    ).toBe(32);
    expect(
      (next.options?.plugins as { title?: { text?: string } } | undefined)?.title?.text,
    ).toBe('Comparação');
  });

  it('extracts editable fields from a bar chart', () => {
    const fields = extractEditableFields(sampleBar);
    expect(fields.categoryLabels).toEqual(['Grupo A', 'Grupo B']);
    expect(fields.isBar).toBe(true);
    expect(fields.axisX).toBe('Grupo');
  });

  it('wraps long titles into multiple lines at word boundaries', () => {
    const wrapped = wrapChartTitle(
      'Análise epidemiológica das diferenças regionais entre grupos no Brasil',
    );
    expect(Array.isArray(wrapped)).toBe(true);
    expect((wrapped as string[]).length).toBeGreaterThan(1);
    expect((wrapped as string[]).every((line) => line.length <= 36)).toBe(true);
  });

  it('filters annotations per chart without touching unrelated keys', () => {
    const withAnn: ChartProps = {
      ...sampleBar,
      options: {
        plugins: {
          annotation: {
            annotations: {
              zeroLine: { type: 'line' },
              showMeanValues_0: { type: 'label', content: '1' },
              showPValue: { type: 'label', content: 'p = 0,01' },
            },
          },
        },
      },
    };

    const next = applyChartOverrides(withAnn, {
      annotationToggles: { showMeanValues: false, showPValue: true },
    });
    const ann = (
      next.options?.plugins as { annotation?: { annotations?: Record<string, unknown> } }
    )?.annotation?.annotations;

    expect(ann?.zeroLine).toBeTruthy();
    expect(ann?.showPValue).toBeTruthy();
    expect(ann?.showMeanValues_0).toBeUndefined();
  });

  it('folds outlier points back into the main series when highlight is off', () => {
    const scatter: ChartProps = {
      type: 'scatter',
      ariaLabel: 'Dispersão',
      data: {
        datasets: [
          {
            label: 'X × Y',
            data: [{ x: 1, y: 2 }],
          },
          {
            label: 'Possíveis outliers',
            data: [{ x: 9, y: 9 }],
          },
        ],
      },
    };

    const next = applyChartOverrides(scatter, {
      annotationToggles: { highlightOutliers: false },
    });

    expect(next.data.datasets).toHaveLength(1);
    expect(next.data.datasets[0].data).toEqual([
      { x: 1, y: 2 },
      { x: 9, y: 9 },
    ]);
  });

  it('keeps generous top padding when a title override is applied', () => {
    const next = applyChartOverrides(sampleBar, { title: 'Comparação das médias' });
    const padding = (
      next.options?.layout as { padding?: { top?: number } } | undefined
    )?.padding;
    expect((padding?.top ?? 0) >= 28).toBe(true);
  });
});
