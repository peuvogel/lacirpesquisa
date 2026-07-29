import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { TesteDemo } from './TesteDemo';

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

function renderDemo() {
  return render(
    <SessionProvider>
      <TesteDemo />
    </SessionProvider>,
  );
}

describe('TesteDemo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes both Dados input modes', () => {
    renderDemo();
    expect(screen.getByRole('tab', { name: 'Colar ou enviar' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assistente DATASUS' })).toBeInTheDocument();
  });

  it('keeps Resultados locked until a dataset is confirmed', () => {
    renderDemo();
    expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument();
  });

  it('loads sample data, unlocks Configurar, and reaches Resultados after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDemo();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    expect(screen.getByText('Grupo A: média')).toBeInTheDocument();
    expect(screen.getByText('Grupo B: média')).toBeInTheDocument();
    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar gráfico (PNG)' })).toBeInTheDocument();

    const metricValues = screen.getAllByText(/\d,\d{3}/);
    expect(metricValues.length).toBeGreaterThan(0);
  });
});
