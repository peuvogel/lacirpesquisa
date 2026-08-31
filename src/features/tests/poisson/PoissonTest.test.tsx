import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { PoissonTest } from './PoissonTest';

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

const OVERDISPERSED_PASTE = `contagem;exposicao
2;1
18;1
1;1
22;1
3;1
25;1
0;1
20;1
5;1
28;1
2;1
30;1`;

function renderPoisson(onNavigateTest?: (testId: string, recognizedColumns?: Record<string, number>) => void) {
  return render(
    <SessionProvider>
      <PoissonTest onNavigateTest={onNavigateTest} />
    </SessionProvider>,
  );
}

describe('PoissonTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs exemplo flow through Resultados with interpretation and PNG export', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPoisson();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();

    await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getByTestId('assumption-nudge-strip')).toBeInTheDocument();

    const prose = screen.getAllByText(/indicou associação|não encontrou associação|Coeficiente de|Modelo com intercepto apenas/i);
    expect(prose.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('shows overdispersion warning nudge on overdispersed paste', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPoisson();

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.paste(OVERDISPERSED_PASTE);
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await waitFor(() => {
      const strip = screen.getByTestId('assumption-nudge-strip');
      expect(strip.textContent).toMatch(/superdispersão/i);
    });
  });

  it('calls onNavigateTest for NB CTA with recognizedColumns when overdispersed', async () => {
    const onNavigateTest = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPoisson(onNavigateTest);

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.paste(OVERDISPERSED_PASTE);
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Abrir Binomial Negativa' }).length).toBeGreaterThan(0);
    });

    const nbButtons = screen.getAllByRole('button', { name: 'Abrir Binomial Negativa' });
    await user.click(nbButtons[nbButtons.length - 1]!);

    expect(onNavigateTest).toHaveBeenCalledWith('binomial-negativa', expect.objectContaining({
      contagem: expect.any(Number),
      preditor: expect.any(Number),
    }));
  });

  it('shows soft reset alert when column role is adjusted after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPoisson();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await user.selectOptions(screen.getByLabelText(/Tipo da coluna contagem/i), 'ignorar');

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });
});
