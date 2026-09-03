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

  it('renders exactly one import summary when configuration becomes visible', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await screen.findByRole('button', { name: 'Analisar dados' });

    expect(screen.getAllByRole('region', { name: 'Resumo da importação' })).toHaveLength(1);
  });

  it('runs the example through inline results with U, effect and rank chart', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByRole('button', { name: 'Analisar dados' })).toBeEnabled();
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

    const wideFormat = await screen.findByRole('radio', { name: /Uma coluna por grupo/i });
    expect(wideFormat).toBeChecked();
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

  it('does not throw or advance when independence scrolling is unavailable', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    const independence = await screen.findByRole('checkbox', { name: /grupos são independentes/i });
    expect(typeof independence.closest('label')?.scrollIntoView).not.toBe('function');

    await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));

    expect(screen.queryByText('Estatística U')).not.toBeInTheDocument();
    expect(independence.closest('label')).toHaveClass('animate-shake-lock');
  });

  it('requests a smooth centered scroll when the independence control exposes the API', async () => {
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <SessionProvider>
          <MannWhitneyTest />
        </SessionProvider>,
      );
      await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
      await act(async () => vi.advanceTimersByTimeAsync(300));

      await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(screen.queryByText('Estatística U')).not.toBeInTheDocument();
    } finally {
      if (original) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      } else {
        delete (Element.prototype as Partial<Element>).scrollIntoView;
      }
    }
  });

  it('surfaces a failure from an available independence scroll implementation', async () => {
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    const scrollError = new Error('scroll failed');
    const reportedErrors: ErrorEvent[] = [];
    const captureError = (event: ErrorEvent) => {
      reportedErrors.push(event);
      event.preventDefault();
    };
    Element.prototype.scrollIntoView = () => {
      throw scrollError;
    };
    window.addEventListener('error', captureError);

    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <SessionProvider>
          <MannWhitneyTest />
        </SessionProvider>,
      );
      await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
      await act(async () => vi.advanceTimersByTimeAsync(300));

      await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));

      expect(reportedErrors).toHaveLength(1);
      expect(reportedErrors[0]?.error).toBe(scrollError);
    } finally {
      window.removeEventListener('error', captureError);
      if (original) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      } else {
        delete (Element.prototype as Partial<Element>).scrollIntoView;
      }
    }
  });
});
