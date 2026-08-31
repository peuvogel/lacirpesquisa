import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsPanel } from './ResultsPanel';

const { ChartMock, destroySpy } = vi.hoisted(() => {
  const destroySpy = vi.fn();
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock() {
    return { destroy: destroySpy, update: vi.fn(), config: { options: {} }, data: {} };
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
  LogarithmicScale: {},
  CategoryScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  Legend: {},
  Title: {},
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
  let execCommandSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ChartMock.mockClear();
    destroySpy.mockClear();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    execCommandSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders metric cards, chart, interpretation, and export in UI-SPEC order', () => {
    render(
      <ResultsPanel
        title="Resumo descritivo"
        metrics={[
          { label: 'Grupo A: média', value: '6,042' },
          { label: 'Grupo B: média', value: '4,342', hint: 'n = 12' },
        ]}
        chart={sampleChart}
        interpretation={['Primeiro parágrafo.', 'Segundo parágrafo.']}
        exportFilename="demo-teste.png"
      />,
    );

    expect(screen.getByText('Resumo descritivo')).toBeInTheDocument();
    expect(screen.getByText('Grupo A: média')).toBeInTheDocument();
    expect(screen.getByText('6,042')).toBeInTheDocument();
    expect(screen.getByText('Grupo B: média')).toBeInTheDocument();
    expect(screen.getByText('4,342')).toBeInTheDocument();
    expect(screen.getByText('n = 12')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Grupo A: média' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('article', { name: 'Grupo A: média' })).toHaveClass('lacir-result-metric');
    expect(screen.getByRole('img', { name: 'Médias por grupo' })).toBeInTheDocument();
    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByText('Primeiro parágrafo.')).toBeInTheDocument();
    expect(screen.getByText('Segundo parágrafo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar gráfico (PNG)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar tudo' })).toBeInTheDocument();
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

  it('renders pertinent post-hoc charts alongside the primary chart', () => {
    render(
      <ResultsPanel
        title="ANOVA"
        metrics={[{ label: 'Efeito', value: '0,30' }]}
        chart={sampleChart}
        additionalCharts={[{ ...sampleChart, type: 'scatter', ariaLabel: 'Heatmap pós-hoc' }]}
        interpretation={['Texto.']}
      />,
    );

    expect(screen.getByRole('img', { name: 'Médias por grupo' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Heatmap pós-hoc' })).toBeInTheDocument();
  });

  it('copies the formatted result report without raw table rows and announces success', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(
      <ResultsPanel
        title="t de Student: resultados"
        metrics={[
          { label: 'Média de Grupo A', value: '4,90', hint: 'n = 7 · desvio-padrão = 0,22' },
          { label: 'Diferença entre médias', value: '-1,10', hint: 'IC95%: -1,35 a -0,85' },
        ]}
        chart={sampleChart}
        interpretation={['Observou-se diferença entre os grupos.']}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copiar tudo' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Interpretação'));
    });
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining('A;4,9'));
    expect(screen.getByRole('status')).toHaveTextContent('Copiado');
    expect(execCommandSpy).not.toHaveBeenCalled();
  });

  it('falls back after clipboard rejection and stays retryable after copy failure', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    execCommandSpy.mockReturnValue(false);

    render(
      <ResultsPanel
        title="t de Student: resultados"
        metrics={[{ label: 'Média de Grupo A', value: '4,90' }]}
        chart={sampleChart}
        interpretation={['Observou-se diferença entre os grupos.']}
      />,
    );

    const button = screen.getByRole('button', { name: 'Copiar tudo' });
    await user.click(button);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(execCommandSpy).toHaveBeenCalledWith('copy');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível copiar');
    expect(button).toBeEnabled();

    execCommandSpy.mockReturnValue(true);
    await user.click(button);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Copiado');
  });

  it('clears the copy status timer when the panel unmounts', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = render(
      <ResultsPanel
        title="t de Student: resultados"
        metrics={[{ label: 'Média de Grupo A', value: '4,90' }]}
        chart={sampleChart}
        interpretation={['Observou-se diferença entre os grupos.']}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copiar tudo' }));
    await screen.findByRole('status');

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
