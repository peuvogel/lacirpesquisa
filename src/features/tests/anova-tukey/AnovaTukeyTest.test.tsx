import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { AnovaTukeyTest } from './AnovaTukeyTest';

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

function renderAnova(onNavigateTest?: (testId: string) => void) {
  return render(
    <SessionProvider>
      <AnovaTukeyTest onNavigateTest={onNavigateTest} />
    </SessionProvider>,
  );
}

describe('AnovaTukeyTest', () => {
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
    renderAnova();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configurar' })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: 'Configurar' }));
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resultados' })).toHaveAttribute('aria-current', 'step');
    });

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getByText('Comparações par a par')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Contraste' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'p ajustado' })).toBeInTheDocument();
    expect(screen.getByText('Tipos de gráfico')).toBeInTheDocument();
    expect(document.getElementById('chart-type-heatmap')).toBeInTheDocument();

    const prose = screen.getAllByText(/Observou-se|Não se observou|Pergunta analisada/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
  });

  it('shows soft reset alert when column roles change after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAnova();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configurar' })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: 'Configurar' }));
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resultados' })).toHaveAttribute('aria-current', 'step');
    });

    await user.click(screen.getByRole('button', { name: 'Configurar' }));
    await user.selectOptions(screen.getByLabelText(/Papel da coluna desfecho/i), 'categorica');

    expect(screen.getByText('Modo alterado.')).toBeInTheDocument();
  });

  it('calls onNavigateTest for Kruskal CTA when nudge is shown', async () => {
    const onNavigateTest = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAnova(onNavigateTest);

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configurar' })).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: 'Configurar' }));
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByText('Comparações par a par')).toBeInTheDocument();
    });

    const kruskalButton = screen.queryByRole('button', { name: /Kruskal/i });
    if (kruskalButton) {
      await user.click(kruskalButton);
      expect(onNavigateTest).toHaveBeenCalledWith('kruskal-dunn');
    }
  });
});
