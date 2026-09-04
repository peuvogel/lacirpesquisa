import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { AnovaTukeyTest } from './AnovaTukeyTest';
import * as anovaInterpretation from './anovaInterpretation';
import { selectColumnType } from '@/test/columnTypeWheel';

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

/**
 * Dataset com desvios-padrão deliberadamente díspares entre os grupos
 * (sd_C ≈ 11,2 contra sd_A ≈ 0,16) para disparar o nudge de heterogeneidade
 * de variâncias, que é o único que carrega o CTA "Abrir Kruskal-Wallis +
 * Dunn" (anovaEngine.ts:189-202).
 *
 * O `exampleText` do módulo NÃO serve para este teste: seus três grupos têm
 * n igual (5/5/5), desvios-padrão quase idênticos (1,29 / 1,39 / 1,65) e
 * média ≈ mediana, então nenhuma das quatro condições de
 * `computeAssumptionNudges` dispara e o botão do CTA nunca chega a existir.
 * Enquanto este teste usava `exampleText` + `queryByRole` condicional, ele
 * passava sem nunca executar sua própria asserção.
 */
const heteroscedasticText = `desfecho;grupo
12,0;A
12,2;A
11,8;A
12,1;A
11,9;A
18,0;B
18,3;B
17,7;B
18,1;B
17,9;B
10,0;C
30,0;C
20,0;C
40,0;C
25,0;C
`;

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

    await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getByText('Comparações par a par')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Contraste' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'p ajustado' })).toBeInTheDocument();
    expect(screen.getByText('Tipos de gráfico')).toBeInTheDocument();
    expect(document.getElementById('chart-type-heatmap')).toBeInTheDocument();

    const prose = screen.getAllByText(/A ANOVA de uma via/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('shows soft reset alert when column roles change after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAnova();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await selectColumnType(user, 'desfecho', 'categorica');

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });

  it('calls onNavigateTest for Kruskal CTA when nudge is shown', async () => {
    const onNavigateTest = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAnova(onNavigateTest);

    await user.click(screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'));
    await user.paste(heteroscedasticText);
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await waitFor(() => {
      expect(screen.getByText('Comparações par a par')).toBeInTheDocument();
    });

    await user.click(await screen.findByTestId('assumption-nudge-info'));
    const kruskalButton = await screen.findByRole('button', {
      name: 'Abrir Kruskal-Wallis + Dunn',
    });
    await user.click(kruskalButton);
    expect(onNavigateTest).toHaveBeenCalledWith('kruskal-dunn', expect.any(Object));
  });

  it('keeps decimal alpha 0.1 for the interpretation and shows 10%', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const interpretation = vi.spyOn(anovaInterpretation, 'buildAnovaInterpretation');
    renderAnova();
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
