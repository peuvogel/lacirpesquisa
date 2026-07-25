import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { CorrelacaoTest } from './CorrelacaoTest';

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

function renderCorrelacao() {
  return render(
    <SessionProvider>
      <CorrelacaoTest />
    </SessionProvider>,
  );
}

describe('CorrelacaoTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to Pearson selected in Configurar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCorrelacao();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configurar' })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: 'Configurar' }));

    expect(screen.getByRole('radio', { name: /^Pearson/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('runs exemplo flow through Resultados with interpretation and PNG export', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCorrelacao();

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
    expect(screen.getByRole('button', { name: 'Baixar gráfico (PNG)' })).toBeInTheDocument();

    const prose = screen.getAllByText(/Pearson|Spearman|Pergunta analisada/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
  });

  it('shows soft reset alert when switching to Spearman after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCorrelacao();

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
    await user.click(screen.getByRole('radio', { name: /^Spearman/i }));

    expect(screen.getByText('Modo alterado.')).toBeInTheDocument();
    expect(
      screen.getByText(/Mantivemos os dados colados, mas limpamos as configurações específicas/i),
    ).toBeInTheDocument();
  });
});
