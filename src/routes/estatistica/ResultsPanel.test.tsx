import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsPanel } from './ResultsPanel';

const { ChartMock, destroySpy } = vi.hoisted(() => {
  const destroySpy = vi.fn();
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock() {
    return { destroy: destroySpy };
  });
  const ChartMock = ChartConstructorSpy as unknown as typeof ChartConstructorSpy & {
    register: ReturnType<typeof vi.fn>;
  };
  ChartMock.register = vi.fn();
  return { ChartMock, destroySpy };
});

vi.mock('chart.js', () => ({
  Chart: ChartMock,
  BarController: {},
  LineController: {},
  ScatterController: {},
  LinearScale: {},
  CategoryScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  Legend: {},
  Tooltip: {},
  Filler: {},
}));

const sampleChart = {
  type: 'bar' as const,
  data: { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] },
  ariaLabel: 'Médias por grupo',
};

describe('ResultsPanel', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ChartMock.mockClear();
    destroySpy.mockClear();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders metric cards, chart, interpretation, and export in UI-SPEC order', () => {
    render(
      <ResultsPanel
        title="Resumo descritivo"
        metrics={[
          { label: 'Grupo A — média', value: '6,042' },
          { label: 'Grupo B — média', value: '4,342', hint: 'n = 12' },
        ]}
        chart={sampleChart}
        interpretation={['Primeiro parágrafo.', 'Segundo parágrafo.']}
        exportFilename="demo-teste.png"
      />,
    );

    expect(screen.getByText('Resumo descritivo')).toBeInTheDocument();
    expect(screen.getByText('Grupo A — média')).toBeInTheDocument();
    expect(screen.getByText('6,042')).toBeInTheDocument();
    expect(screen.getByText('Grupo B — média')).toBeInTheDocument();
    expect(screen.getByText('4,342')).toBeInTheDocument();
    expect(screen.getByText('n = 12')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Médias por grupo' })).toBeInTheDocument();
    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByText('Primeiro parágrafo.')).toBeInTheDocument();
    expect(screen.getByText('Segundo parágrafo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar gráfico (PNG)' })).toBeInTheDocument();
  });

  it('honors exportFilename when the PNG button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ResultsPanel
        title="Resumo"
        metrics={[{ label: 'Média', value: '1,0' }]}
        chart={sampleChart}
        interpretation={['Texto.']}
        exportFilename="meu-grafico-demo.png"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Baixar gráfico (PNG)' }));

    const anchorCall = (appendChildSpy.mock.calls as unknown[][]).find(
      (call) => call[0] instanceof HTMLAnchorElement,
    );
    const anchor = anchorCall?.[0] as HTMLAnchorElement | undefined;
    expect(anchor?.download).toBe('meu-grafico-demo.png');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('renders interpretation HTML-like payloads as literal text (T-01-XSS)', () => {
    render(
      <ResultsPanel
        title="Resumo"
        metrics={[{ label: 'Média', value: '1,0' }]}
        chart={sampleChart}
        interpretation={['Valor <b>bold</b> permanece literal.']}
      />,
    );

    expect(screen.getByText('Valor <b>bold</b> permanece literal.')).toBeInTheDocument();
    expect(document.querySelector('b')).not.toBeInTheDocument();
  });
});
