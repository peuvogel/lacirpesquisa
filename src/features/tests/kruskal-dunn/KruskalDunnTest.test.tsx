import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { KruskalDunnTest } from './KruskalDunnTest';

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
  CategoryScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  Legend: {},
  Title: {},
  Tooltip: {},
  Filler: {},
}));

function renderKruskal(onNavigateTest?: (testId: string) => void) {
  return render(
    <SessionProvider>
      <KruskalDunnTest onNavigateTest={onNavigateTest} />
    </SessionProvider>,
  );
}

describe('KruskalDunnTest', () => {
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
    renderKruskal();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getByText('Comparações par a par')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Contraste' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'p ajustado' })).toBeInTheDocument();
    expect(screen.getByText('Tipos de gráfico')).toBeInTheDocument();
    expect(document.getElementById('chart-type-heatmap')).toBeInTheDocument();

    const prose = screen.getAllByText(/Kruskal-Wallis|Pergunta analisada/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
  });

  it('shows assumption nudge strip with rank-alternative info', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderKruskal();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await waitFor(() => {
      expect(screen.getByText('Comparações par a par')).toBeInTheDocument();
    });

    expect(screen.getByTestId('assumption-nudge-strip')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Kruskal-Wallis compara grupos pelos postos \(ranks\) — alternativa não paramétrica/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows soft reset alert when column roles change after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderKruskal();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await user.selectOptions(screen.getByLabelText(/Papel da coluna desfecho/i), 'categorica');

    expect(screen.getByText('Modo alterado.')).toBeInTheDocument();
  });
});
