import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider, useSession, type SessionDataset } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { BinomialNegativaTest } from './BinomialNegativaTest';

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

function renderBinomialNegativa(handoffRecognizedColumns?: Record<string, number>) {
  return render(
    <SessionProvider>
      <BinomialNegativaTest handoffRecognizedColumns={handoffRecognizedColumns} />
    </SessionProvider>,
  );
}

function HandoffBootstrapHarness({
  dataset,
  handoffRecognizedColumns,
}: {
  dataset: SessionDataset;
  handoffRecognizedColumns: Record<string, number>;
}) {
  const { setDataset } = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDataset(dataset);
    setReady(true);
  }, [dataset, setDataset]);

  if (!ready) return null;
  return <BinomialNegativaTest handoffRecognizedColumns={handoffRecognizedColumns} />;
}

describe('BinomialNegativaTest', () => {
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
    renderBinomialNegativa();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();

    const resultados = await runToResultados(user);

    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getByTestId('assumption-nudge-strip')).toBeInTheDocument();
    expect(within(resultados).getByText(/θ \(dispersão\)/i)).toBeInTheDocument();

    const prose = screen.getAllByText(/indicou associação|não encontrou associação|Parâmetro de dispersão/i);
    expect(prose.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('bootstraps recognizedColumns from Poisson handoff on session restore', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const handoffColumns = { contagem: 0, preditor: 1 };

    render(
      <SessionProvider>
        <HandoffBootstrapHarness
          dataset={{
            headers: ['contagem', 'exposicao'],
            rows: [
              ['8', '1,0'],
              ['12', '1,0'],
              ['15', '1,2'],
              ['9', '1,2'],
              ['18', '1,5'],
              ['22', '1,5'],
              ['14', '2,0'],
              ['25', '2,0'],
              ['30', '2,5'],
              ['28', '2,5'],
              ['35', '3,0'],
              ['40', '3,0'],
            ],
            sourceLabel: 'handoff-poisson',
            confirmedAt: Date.now(),
          }}
          handoffRecognizedColumns={handoffColumns}
        />
      </SessionProvider>,
    );

    await screen.findByRole('button', { name: 'Analisar dados' });

    const detectedBadges = screen.getAllByText('em uso');
    expect(detectedBadges.length).toBe(2);
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();

    const resultados = await runToResultados(user);

    expect(within(resultados).getByText(/θ \(dispersão\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('shows soft reset alert when column role is adjusted after confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBinomialNegativa();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await user.selectOptions(screen.getByLabelText(/Tipo da coluna contagem/i), 'ignorar');

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });
});
