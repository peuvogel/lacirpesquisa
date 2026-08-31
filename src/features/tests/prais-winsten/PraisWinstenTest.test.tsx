import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { PraisWinstenTest } from './PraisWinstenTest';

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

function renderPraisWinsten() {
  return render(
    <SessionProvider>
      <PraisWinstenTest />
    </SessionProvider>,
  );
}

describe('PraisWinstenTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows series preview on Configurar after Usar exemplo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await screen.findByRole('button', { name: 'Analisar dados' });

    expect(screen.getByText('Prévia da série temporal')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();
    expect(screen.getAllByText('2015').length).toBeGreaterThan(0);
    expect(screen.getAllByText('120,4').length).toBeGreaterThan(0);
  });

  it('runs exemplo flow through Resultados with interpretation and PNG export', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Baixar/i }).length).toBeGreaterThanOrEqual(1);

    const prose = screen.getAllByText(/Analisou-se a tendência temporal|Resultado principal/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('can reach both trend and residual chart tabs in Resultados', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Tendência' })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Resíduos' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Resíduos' }));

    await waitFor(() => {
      expect(screen.getByText('Prais-Winsten: resíduos')).toBeInTheDocument();
    });
  });

  it('explains that the previous result was invalidated after a table edit', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    await runToResultados(user);

    const firstValue = screen.getByLabelText('Linha 1, coluna 2');
    await user.clear(firstValue);
    await user.type(firstValue, '121');

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
    expect(screen.queryByText('O que isso significa?')).not.toBeInTheDocument();
  });
});
