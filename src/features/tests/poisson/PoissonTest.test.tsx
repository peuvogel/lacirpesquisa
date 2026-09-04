import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { PoissonTest } from './PoissonTest';
import * as poissonInterpretation from './poissonInterpretation';
import { selectColumnType } from '@/test/columnTypeWheel';
import { setColumnEnabled } from '@/test/columnToggle';

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
    await user.click(screen.getByTestId('assumption-nudge-info'));
    expect(await screen.findByText('Pressupostos')).toBeInTheDocument();

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

    const trigger = await screen.findByTestId('assumption-nudge-info');
    expect(trigger).toHaveAttribute('data-severity', 'warning');
    await user.click(trigger);
    // Dentro do popover: o mesmo termo também é rótulo de card de métrica.
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText(/superdispersão/i)).toBeInTheDocument();
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

    await setColumnEnabled(user, 'contagem', false);

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });

  it('keeps decimal alpha 0.1 for the interpretation and shows 10%', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const interpretation = vi.spyOn(poissonInterpretation, 'buildPoissonInterpretation');
    renderPoisson();
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    await screen.findByRole('button', { name: 'Analisar dados' });

    await user.click(screen.getByRole('button', { name: /desbloquear/i }));
    await user.click(screen.getByRole('option', { name: '10,0' }));
    expect(screen.getByText(/10%/)).toBeInTheDocument();
    await runToResultados(user);

    expect(interpretation.mock.calls.at(-1)?.[1]).toBe(0.1);
  });
});
