import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { MannWhitneyTest } from './MannWhitneyTest';

const { ChartMock } = vi.hoisted(() => {
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock() {
    return { destroy: vi.fn(), update: vi.fn(), config: { options: {} }, data: {} };
  });
  const ChartMock = ChartConstructorSpy as unknown as typeof ChartConstructorSpy & {
    register: ReturnType<typeof vi.fn>;
  };
  ChartMock.register = vi.fn();
  return { ChartMock };
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
  Title: {},
  Tooltip: {},
  Filler: {},
}));

describe('MannWhitneyTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('runs the example through inline results with U, effect and rank chart', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByRole('button', { name: 'Analisar dados' })).toBeDisabled();
    await user.click(await screen.findByRole('checkbox', { name: /grupos são independentes/i }));
    await runToResultados(user);

    expect(screen.getByText('Estatística U')).toBeInTheDocument();
    expect(screen.getByText('Efeito por postos')).toBeInTheDocument();
    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByText('Tipos de gráfico')).toBeInTheDocument();
    expect(document.getElementById('chart-type-rank-dot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
  });

  it('describes distributions/ranks and never automatically claims a median test', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await user.click(await screen.findByRole('checkbox', { name: /grupos são independentes/i }));
    await runToResultados(user);

    expect(screen.getAllByText(/distribuição|postos/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/teste (das?|de) medianas/i);
  });
});
