import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartCustomizer } from './ChartCustomizer';

describe('ChartCustomizer', () => {
  it('mostra apenas gráficos que fazem sentido para o teste atual', () => {
    render(
      <ChartCustomizer
        presets={[
          { id: 'raw-data', label: 'Dados individuais por grupo', visualType: 'dot' },
          { id: 'effect', label: 'Diferença com IC95%', visualType: 'range' },
        ]}
        state={{
          chartTypePreset: 'raw-data',
          axisLabels: { x: 'Grupo', y: 'Valor' },
          annotationToggles: {},
          themeVariant: 'publication',
          visiblePresetIds: { 'raw-data': true, effect: true },
        }}
        onPresetVisibleChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Dados individuais por grupo' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Diferença com IC95%' })).toBeEnabled();
    expect(screen.queryByRole('checkbox', { name: 'Pizza' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Rosca eleitoral' })).not.toBeInTheDocument();
  });
});
