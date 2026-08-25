import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { TStudentTest } from './TStudentTest';

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

function renderTStudent() {
  return render(
    <SessionProvider>
      <TStudentTest />
    </SessionProvider>,
  );
}

async function loadExample(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
  await vi.advanceTimersByTimeAsync(200);
  await waitFor(() => {
    expect(screen.getByText('Tabela pronta para configurar')).toBeInTheDocument();
  });
}

describe('TStudentTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to independent Welch mode after loading example', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTStudent();
    await loadExample(user);

    expect(screen.getByRole('radio', { name: /t independente \(Welch\)/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('runs exemplo flow through Resultados with interpretation and PNG export', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTStudent();
    await loadExample(user);

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar Intervalo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar Pontos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar Colunas' })).toBeInTheDocument();
    expect(screen.getByText('Tipos de gráfico')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dispersão')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Intervalo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Pontos' })).toBeInTheDocument();

    const prose = screen.getAllByText(/Observou-se|Não se observou|Pergunta analisada/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
  });

  it('shows soft reset alert when switching to paired after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTStudent();
    await loadExample(user);

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('radio', { name: /t pareado/i }));

    expect(screen.getByText('Modo alterado.')).toBeInTheDocument();
    expect(
      screen.getByText(/Mantivemos os dados colados, mas limpamos as configurações específicas/i),
    ).toBeInTheDocument();
  });
});
