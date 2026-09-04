import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { LogisticaTest } from './LogisticaTest';
import * as logisticaInterpretation from './logisticaInterpretation';
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


  it('runs exemplo flow through Resultados with OR metrics and interpretation', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogistica();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();

    await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    await user.click(screen.getByTestId('assumption-nudge-info'));
    expect(await screen.findByText('Pressupostos')).toBeInTheDocument();
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

    // O aviso não pode se esconder atrás de um ícone neutro: o gatilho se
    // marca como aviso antes mesmo de o texto ser aberto.
    const trigger = await screen.findByTestId('assumption-nudge-info');
    expect(trigger).toHaveAttribute('data-severity', 'warning');
    await user.click(trigger);
    // Dentro do popover: o mesmo termo também é rótulo de card de métrica.
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText(/eventos raros/i)).toBeInTheDocument();
  });

  it('shows soft reset alert when column role is adjusted after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLogistica();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await setColumnEnabled(user, 'desfecho_binario', false);

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });

  it('keeps decimal alpha 0.1 for the interpretation and shows 10%', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const interpretation = vi.spyOn(logisticaInterpretation, 'buildLogisticaInterpretation');
    renderLogistica();
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
