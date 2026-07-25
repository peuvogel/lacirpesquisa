import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TEAL_STEPS } from '@/geo/choroplethScale';
import { ChoroplethLegend } from './ChoroplethLegend';
import { getMockMetricByUf } from './mockAnalysisData';

describe('ChoroplethLegend', () => {
  it('renders title and variable subtitle from mock metrics', () => {
    const values = Object.values(getMockMetricByUf('mock.internacoes'));
    render(
      <ChoroplethLegend
        values={values}
        activeVariableId="mock.internacoes"
        variableLabel="Internações hospitalares"
      />,
    );

    expect(screen.getByText('Intensidade no mapa')).toBeInTheDocument();
    expect(screen.getByText('Internações hospitalares')).toBeInTheDocument();
  });

  it('renders at least three legend ticks with Baixo and Alto labels', () => {
    const values = Object.values(getMockMetricByUf('mock.internacoes'));
    render(<ChoroplethLegend values={values} activeVariableId="mock.internacoes" />);

    expect(screen.getByText('Baixo')).toBeInTheDocument();
    expect(screen.getByText('Alto')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('uses teal scale colors from UI-SPEC, never purple', () => {
    const values = [10, 30, 50, 70, 90];
    const { container } = render(<ChoroplethLegend values={values} activeVariableId="mock.obitos" />);

    const swatches = container.querySelectorAll('[data-legend-swatch]');
    expect(swatches.length).toBeGreaterThanOrEqual(3);

    swatches.forEach((swatch) => {
      const color = swatch.getAttribute('data-legend-swatch');
      expect(TEAL_STEPS).toContain(color);
      expect(color).not.toMatch(/9333ea|a855f7|purple/i);
    });
  });
});

describe('mockAnalysisData', () => {
  it("getMockMetricByUf('mock.internacoes') returns 27 UF values with SP > 0", () => {
    const metrics = getMockMetricByUf('mock.internacoes');
    expect(Object.keys(metrics)).toHaveLength(27);
    expect(metrics.SP).toBeGreaterThan(0);
    expect(metrics.SP).toBeGreaterThan(metrics.AC ?? 0);
  });
});
