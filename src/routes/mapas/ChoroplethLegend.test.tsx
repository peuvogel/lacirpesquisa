import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TEAL_STEPS } from '@/geo/choroplethScale';
import { getMetricByUf } from '@/features/catalog/catalogAnalysisData';
import { ChoroplethLegend } from './ChoroplethLegend';

describe('ChoroplethLegend', () => {
  it('renders title and variable subtitle from catalog metrics', () => {
    const values = Object.values(getMetricByUf('sih.embolia_trombose.internacoes'));
    render(
      <ChoroplethLegend
        values={values}
        activeVariableId="sih.embolia_trombose.internacoes"
        variableLabel="Internações por embolia e trombose arteriais"
      />,
    );

    expect(screen.getByText('Intensidade no mapa')).toBeInTheDocument();
    expect(screen.getByText('Internações por embolia e trombose arteriais')).toBeInTheDocument();
    expect(screen.queryByText('Catálogo LACIR')).not.toBeInTheDocument();
  });

  it('renders at least three legend ticks with Baixo and Alto labels', () => {
    const values = Object.values(getMetricByUf('sih.embolia_trombose.internacoes'));
    render(
      <ChoroplethLegend
        values={values}
        activeVariableId="sih.embolia_trombose.internacoes"
      />,
    );

    expect(screen.getByText('Baixo')).toBeInTheDocument();
    expect(screen.getByText('Alto')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('uses teal scale colors from UI-SPEC, never purple', () => {
    const values = [10, 30, 50, 70, 90];
    const { container } = render(
      <ChoroplethLegend values={values} activeVariableId="sih.embolia_trombose.obitos" />,
    );

    const swatches = container.querySelectorAll('[data-legend-swatch]');
    expect(swatches.length).toBeGreaterThanOrEqual(3);

    swatches.forEach((swatch) => {
      const color = swatch.getAttribute('data-legend-swatch');
      expect(TEAL_STEPS).toContain(color);
      expect(color).not.toMatch(/9333ea|a855f7|purple/i);
    });
  });
});

describe('catalogAnalysisData via Mapas', () => {
  it("getMetricByUf('mock.internacoes') returns pack UF values with SP > 0 and ≠ mock weight", () => {
    const metrics = getMetricByUf('mock.internacoes');
    expect(Object.keys(metrics).length).toBeGreaterThanOrEqual(27);
    expect(metrics.SP).toBeGreaterThan(0);
    expect(metrics.SP).not.toBe(898000);
  });
});
