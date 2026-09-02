import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { LogisticaTest } from './LogisticaTest';

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

const IMBALANCED_PASTE = `desfecho_binario;dose
${Array.from({ length: 96 }, () => '0;1').join('\n')}
1;2
1;3
1;4
1;5`;

function renderLogistica() {
  return render(
    <SessionProvider>
      <LogisticaTest />
    </SessionProvider>,
  );
}

describe('LogisticaTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders exactly one import summary when configuration becomes visible', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogistica();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    await screen.findByRole('button', { name: 'Analisar dados' });

    expect(screen.getAllByRole('region', { name: 'Resumo da importação' })).toHaveLength(1);
  });

  it('runs exemplo flow through Resultados with OR metrics and interpretation', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogistica();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();

    await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getByTestId('assumption-nudge-strip')).toBeInTheDocument();
    expect(screen.getByText(/OR \(dose\)/i)).toBeInTheDocument();

    const prose = screen.getAllByText(/indicou associação|não encontrou associação|Odds ratio/i);
    expect(prose.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('shows rare events warning nudge on imbalanced paste', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogistica();

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.paste(IMBALANCED_PASTE);
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await waitFor(() => {
      const strip = screen.getByTestId('assumption-nudge-strip');
      expect(strip.textContent).toMatch(/eventos raros/i);
    });
  });

  it('shows soft reset alert when column role is adjusted after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogistica();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await user.selectOptions(screen.getByLabelText(/Tipo da coluna desfecho_binario/i), 'ignorar');

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });
});
