import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { exampleText as tStudentExampleText } from '@/features/tests/t-student/tStudentConfig';
import { MannWhitneyTest } from './MannWhitneyTest';

const { ChartMock } = vi.hoisted(() => {
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock() {
    return { destroy: vi.fn(), update: vi.fn(), config: { options: {} }, data: {} };
  });
  const ChartMock = ChartConstructorSpy as unknown as typeof ChartConstructorSpy & {
    register: ReturnType<typeof vi.fn>;
  };
  ChartMock.register = vi.fn();
  return { ChartMock };
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

describe('MannWhitneyTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('runs the example through inline results with U, effect and rank chart', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByRole('button', { name: 'Analisar dados' })).toBeDisabled();
    await user.click(await screen.findByRole('checkbox', { name: /grupos são independentes/i }));
    await runToResultados(user);

    expect(screen.getByText('Estatística U')).toBeInTheDocument();
    expect(screen.getByText('Efeito por postos')).toBeInTheDocument();
    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByText('Tipos de gráfico')).toBeInTheDocument();
    expect(document.getElementById('chart-type-rank-dot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
  });

  it('describes distributions/ranks and never automatically claims a median test', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await user.click(await screen.findByRole('checkbox', { name: /grupos são independentes/i }));
    await runToResultados(user);

    expect(screen.getAllByText(/distribuição|postos/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/teste (das?|de) medianas/i);
  });

  it('lists all three long-format groups and blocks analysis instead of dropping one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );

    const text = 'desfecho;grupo\n1;A\n2;A\n3;A\n4;B\n5;B\n6;B\n7;C\n8;C\n9;C';
    await user.type(screen.getByRole('textbox', { name: /Cole aqui os dados/i }), text);
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(await screen.findByText(/Foram encontrados 3 grupos \(A, B, C\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeDisabled();
  });

  it('accepts the actual t-student example as wide data and retains independence across format switches', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    function SeedTStudentHandoff() {
      const { setDataset } = useSession();
      useEffect(() => {
        const [headerLine, ...rowLines] = tStudentExampleText.trim().split(/\r?\n/);
        setDataset({
          headers: headerLine!.split('\t'),
          rows: rowLines.map((line) => line.split('\t')),
          sourceLabel: 'exemplo t de Student',
          confirmedAt: Date.now(),
        });
      }, [setDataset]);
      return <MannWhitneyTest />;
    }

    render(
      <SessionProvider>
        <SeedTStudentHandoff />
      </SessionProvider>,
    );

    await user.click(await screen.findByRole('radio', { name: /Uma coluna por grupo/i }));
    expect(await screen.findByText((_, node) => node?.textContent === 'Grupo A: n=7')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Grupo B: n=7')).toBeInTheDocument();

    const independence = screen.getByRole('checkbox', { name: /grupos são independentes/i });
    await user.click(independence);
    await user.click(screen.getByRole('radio', { name: /Valor \+ coluna de grupo/i }));
    await user.click(screen.getByRole('radio', { name: /Uma coluna por grupo/i }));
    expect(independence).toBeChecked();

    await runToResultados(user);
    expect(screen.getByText('Estatística U')).toBeInTheDocument();
  });
});
