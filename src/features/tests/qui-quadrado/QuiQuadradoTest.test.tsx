import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { QuiQuadradoTest } from './QuiQuadradoTest';
import * as quiQuadradoInterpretation from './quiQuadradoInterpretation';
import { findColumnTypeWheel, selectColumnType } from '@/test/columnTypeWheel';
import { setColumnEnabled } from '@/test/columnToggle';
import datasusText from '@/test/fixtures/tests/qui-quadrado-datasus.csv?raw';

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

function renderQuiQuadrado() {
  return render(
    <SessionProvider>
      <QuiQuadradoTest />
    </SessionProvider>,
  );
}

describe('QuiQuadradoTest', () => {
  it('analyzes the pasted DATASUS age-by-sex frequency table without recoding counts as categories', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderQuiQuadrado();
    const input = screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET');
    fireEvent.change(input, { target: { value: datasusText } });
    await vi.advanceTimersByTimeAsync(200);
    await runToResultados(user);
    expect(screen.queryByText(/parece numérica/i)).not.toBeInTheDocument();
    expect(screen.getByText('Qui-quadrado (χ²)')).toBeInTheDocument();
    expect(screen.getAllByText(/Tabela 12×2/i).length).toBeGreaterThan(0);
    expect(screen.getByText('761164')).toBeInTheDocument();
    expect(input).toHaveValue(datasusText);
  });

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
    renderQuiQuadrado();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();

    const resultados = await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    await user.click(within(resultados).getByTestId('assumption-nudge-info'));
    expect(await screen.findByText('Pressupostos')).toBeInTheDocument();

    const prose = screen.getAllByText(/Observou-se|Não se observou|Resultado principal/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('shows soft reset alert when column role is adjusted after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderQuiQuadrado();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await setColumnEnabled(user, 'tratamento', false);

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });

  it('accepts numeric category codes after the user explicitly marks both columns categorical', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderQuiQuadrado();
    fireEvent.change(screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'), {
      target: { value: 'categoria_a;categoria_b\n0;0\n0;0\n0;1\n0;1\n1;0\n1;0\n1;1\n1;1' },
    });
    await vi.advanceTimersByTimeAsync(200);

    await findColumnTypeWheel('categoria_a');
    await selectColumnType(user, 'categoria_a', 'categorica');
    await selectColumnType(user, 'categoria_b', 'categorica');
    await runToResultados(user);

    expect(screen.getByText('Qui-quadrado (χ²)')).toBeInTheDocument();
    expect(screen.queryByText(/parece numérica/i)).not.toBeInTheDocument();
  });

  it('keeps decimal alpha 0.1 for the interpretation and shows 10%', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const interpretation = vi.spyOn(quiQuadradoInterpretation, 'buildQuiQuadradoInterpretation');
    renderQuiQuadrado();
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
