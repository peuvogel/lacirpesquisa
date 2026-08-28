import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartOptions } from 'chart.js';
import type { ChartPreset } from './useChartCustomizer';
import { ResultsPanelWithCustomizer } from './ResultsPanelWithCustomizer';

const { exportCanvasPngMock, setVisualPreferencesMock, sessionState } = vi.hoisted(() => ({
  exportCanvasPngMock: vi.fn((
    _canvas: HTMLCanvasElement,
    _filename: string,
    _onError?: () => void,
  ) => true),
  setVisualPreferencesMock: vi.fn(),
  sessionState: {
    dataset: {
      confirmedAt: 1,
      sourceLabel: 'teste.csv',
      table: { id: 'dataset-42' },
    },
    visualPreferences: {} as Record<string, unknown>,
  },
}));

vi.mock('@/shared/session/SessionProvider', () => ({
  useSession: () => ({
    dataset: sessionState.dataset,
    visualPreferences: sessionState.visualPreferences,
    setVisualPreferences: setVisualPreferencesMock,
  }),
}));

vi.mock('./useChartExport', () => ({
  exportCanvasPng: exportCanvasPngMock,
}));

vi.mock('./ChartCanvas', () => ({
  DEFAULT_CHART_HEIGHT: 420,
  clampChartHeight: (height = 420) => Math.min(900, Math.max(280, Math.round(height))),
  ChartCanvas: ({
    ariaLabel,
    height,
    options,
    onCanvasReady,
  }: {
    ariaLabel: string;
    height?: number;
    options?: ChartOptions;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  }) => {
    const title = (options?.plugins?.title as { text?: string | string[] } | undefined)?.text;
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-height={height}
        data-title={Array.isArray(title) ? title.join(' ') : title}
        ref={(node) => {
          if (node) {
            const canvas = document.createElement('canvas');
            canvas.dataset.chartHeight = String(height);
            onCanvasReady?.(canvas);
          }
        }}
      />
    );
  },
}));

const presets: ChartPreset<{ value: number }>[] = [
  {
    id: 'means',
    label: 'Médias por grupo',
    visualType: 'column',
    buildChart: () => ({
      type: 'bar',
      data: { labels: ['Grupo A', 'Grupo B'], datasets: [{ data: [4.9, 6.01] }] },
      options: { plugins: { title: { display: true, text: 'Médias originais' } } },
      ariaLabel: 'Médias por grupo',
    }),
    capabilities: [],
  },
];

function renderPanel() {
  return render(
    <ResultsPanelWithCustomizer
      title="t de Student: resultados"
      metrics={[]}
      engineOutput={{ value: 1 }}
      presets={presets}
      defaultPresetId="means"
      interpretation={['Interpretação.']}
      preferenceScopeId="t-student"
    />,
  );
}

describe('ResultsPanelWithCustomizer sizing and expansion', () => {
  beforeEach(() => {
    sessionState.visualPreferences = {};
    setVisualPreferencesMock.mockReset();
    exportCanvasPngMock.mockReset();
    exportCanvasPngMock.mockReturnValue(true);
  });

  it('updates a bounded chart height and stores only serializable visual preferences', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Editar Médias por grupo' }));

    const height = screen.getByRole('slider', { name: /Altura do gráfico/ });
    fireEvent.change(height, { target: { value: '620' } });

    expect(screen.getByRole('img', { name: 'Médias por grupo' })).toHaveAttribute(
      'data-height',
      '620',
    );
    expect(setVisualPreferencesMock).toHaveBeenLastCalledWith({
      'charts:dataset-42:t-student:means': { height: 620 },
    });
    expect(JSON.stringify(setVisualPreferencesMock.mock.lastCall?.[0])).not.toContain('buildChart');
  });

  it('keeps customization in the expanded dialog and restores focus on Escape', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Editar Médias por grupo' }));
    const title = screen.getByRole('textbox', { name: 'Título' });
    await user.clear(title);
    await user.type(title, 'Comparação ajustada');
    await user.click(screen.getByRole('button', { name: 'Concluir' }));

    const expand = screen.getByRole('button', { name: 'Ampliar Médias por grupo' });
    await user.click(expand);
    const dialog = screen.getByRole('dialog', { name: 'Médias por grupo' });
    expect(within(dialog).getByRole('img', { name: 'Comparação ajustada' })).toHaveAttribute(
      'data-title',
      'Comparação ajustada',
    );

    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(expand).toHaveFocus();
  });

  it('exports the expanded canvas from the expanded dialog', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Ampliar Médias por grupo' }));
    const dialog = screen.getByRole('dialog', { name: 'Médias por grupo' });
    await user.click(within(dialog).getByRole('button', { name: 'Baixar PNG' }));

    const exportedCanvas = exportCanvasPngMock.mock.lastCall?.[0] as HTMLCanvasElement;
    expect(Number(exportedCanvas.dataset.chartHeight)).toBeGreaterThan(420);
  });

  it('shows an accessible error when PNG export fails', async () => {
    exportCanvasPngMock.mockReturnValue(false);
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Baixar Médias por grupo' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível exportar o gráfico em PNG',
    );
  });
});
