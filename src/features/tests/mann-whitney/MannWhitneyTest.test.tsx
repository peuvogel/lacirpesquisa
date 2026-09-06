import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { createTableDocument, setTableRoleBinding } from '@/shared/data-input/tableDocument';
import { runToResultados } from '@/test/flowHelpers';
import { exampleText as tStudentExampleText } from '@/features/tests/t-student/tStudentConfig';
import { MannWhitneyTest } from './MannWhitneyTest';
import * as mannWhitneyInterpretation from './mannWhitneyInterpretation';

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
    // O botão fica habilitado de propósito: clicar sem confirmar a independência
    // devolve o usuário à caixa e a sinaliza, em vez de falhar em silêncio.
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
    // Rótulo e n passaram a ser <dt>/<dd> separados, em vez de uma pill única.
    const groups = await screen.findByRole('region', { name: 'Prévia dos grupos' });
    expect(groups).toHaveTextContent('Grupo A');
    expect(groups).toHaveTextContent('Grupo B');
    expect(groups.textContent?.match(/n = 7/g)).toHaveLength(2);

    const independence = screen.getByRole('checkbox', { name: /grupos são independentes/i });
    await user.click(independence);
    await user.click(screen.getByRole('radio', { name: /Valor \+ coluna de grupo/i }));
    await user.click(screen.getByRole('radio', { name: /Uma coluna por grupo/i }));
    expect(independence).toBeChecked();

    await runToResultados(user);
    expect(screen.getByText('Estatística U')).toBeInTheDocument();
  });

  it.each([
    { lastBahia: '4', totalBahia: '10', bahiaN: 4 },
    { lastBahia: '', totalBahia: '6', bahiaN: 3 },
  ])('compares the Bahia/Pernambuco columns, not month or totals, with Bahia n=$bahiaN', async ({ lastBahia, totalBahia, bahiaN }) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SessionProvider><MannWhitneyTest /></SessionProvider>);
    fireEvent.change(screen.getByRole('textbox', { name: /Cole aqui os dados/i }), {
      target: { value: `Mês de atendimento;Bahia;Pernambuco;Total\nJan;1;5;6\nFev;2;6;8\nMar;3;7;10\nAbr;${lastBahia};8;${lastBahia ? '12' : '8'}\nTotal;${totalBahia};26;${Number(totalBahia) + 26}` },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(await screen.findByRole('radio', { name: /Uma coluna por grupo/i })).toBeChecked();
    expect(within(screen.getByRole('combobox', { name: 'Vincular Grupo A' })).getByRole('option', { selected: true })).toHaveTextContent('Bahia');
    expect(within(screen.getByRole('combobox', { name: 'Vincular Grupo B' })).getByRole('option', { selected: true })).toHaveTextContent('Pernambuco');
    const groups = screen.getByRole('region', { name: 'Prévia dos grupos' });
    expect(within(groups).getByText('Bahia').parentElement).toHaveTextContent(`n = ${bahiaN}`);
    expect(within(groups).getByText('Pernambuco').parentElement).toHaveTextContent('n = 4');
    await user.click(screen.getByRole('checkbox', { name: /grupos são independentes/i }));
    await runToResultados(user);
    expect(screen.getByText('Estatística U')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Estatística U' })).getByText('0,00')).toBeInTheDocument();
  });

  it('releases manual long-format bindings before selecting both wide groups', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SessionProvider><MannWhitneyTest /></SessionProvider>);
    fireEvent.change(screen.getByRole('textbox', { name: /Cole aqui os dados/i }), {
      target: { value: 'Bahia;Pernambuco\n1;5\n2;6\n3;7\n;8' },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await user.click(screen.getByRole('radio', { name: /Valor \+ coluna de grupo/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Vincular Desfecho' }),
      screen.getByRole('combobox', { name: 'Vincular Desfecho' }).querySelectorAll('option')[1]!);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Vincular Grupo' }),
      screen.getByRole('combobox', { name: 'Vincular Grupo' }).querySelectorAll('option')[2]!);
    await user.click(screen.getByRole('radio', { name: /Uma coluna por grupo/i }));

    const groupA = screen.getByRole('combobox', { name: 'Vincular Grupo A' });
    const groupB = screen.getByRole('combobox', { name: 'Vincular Grupo B' });
    const bahia = within(groupA).getByRole('option', { name: /Bahia/ });
    const pernambuco = within(groupB).getByRole('option', { name: /Pernambuco/ });
    expect(bahia).toBeEnabled();
    expect(pernambuco).toBeEnabled();
    await user.selectOptions(groupA, bahia);
    await user.selectOptions(groupB, pernambuco);
    const groups = screen.getByRole('region', { name: 'Prévia dos grupos' });
    expect(within(groups).getByText('Bahia').parentElement).toHaveTextContent('n = 3');
    expect(within(groups).getByText('Pernambuco').parentElement).toHaveTextContent('n = 4');
    await user.click(screen.getByRole('checkbox', { name: /grupos são independentes/i }));
    await runToResultados(user);
    expect(screen.getByText('Estatística U')).toBeInTheDocument();
  });

  it.each([false, true])('preserves saved wide bindings and revision, including a deliberate empty A=%s', async (emptyA) => {
    function SeedSavedBindings() {
      const { setDataset, dataset } = useSession();
      useEffect(() => {
        let table = createTableDocument(['Bahia', 'Pernambuco'], [['1', '5'], ['2', '6'], ['3', '7']], 'salvo', () => 'saved-wide');
        table = setTableRoleBinding(table, 'mann-whitney', 'grupo_a', emptyA ? null : table.columns[1]!.id);
        table = setTableRoleBinding(table, 'mann-whitney', 'grupo_b', table.columns[0]!.id);
        setDataset({ headers: table.columns.map((column) => column.name), rows: table.rows, sourceLabel: table.sourceLabel, confirmedAt: 1, table });
      }, [setDataset]);
      return <><MannWhitneyTest /><output aria-label="Revisão da tabela">{dataset?.table?.revision}</output></>;
    }
    render(<SessionProvider><SeedSavedBindings /></SessionProvider>);
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByRole('combobox', { name: 'Vincular Grupo A' })).toHaveValue(emptyA ? '' : 'saved-wide-col-2');
    expect(screen.getByRole('combobox', { name: 'Vincular Grupo B' })).toHaveValue('saved-wide-col-1');
    expect(screen.getByLabelText('Revisão da tabela')).toHaveTextContent('2');
  });

  it('refuses to analyse until independence is confirmed, flagging the checkbox', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SessionProvider>
        <MannWhitneyTest />
      </SessionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    const independence = await screen.findByRole('checkbox', { name: /grupos são independentes/i });
    expect(independence).not.toBeChecked();
    expect(typeof independence.closest('label')?.scrollIntoView).not.toBe('function');

    await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));

    // Não avança e marca a caixa como pendente.
    expect(screen.queryByText('Estatística U')).not.toBeInTheDocument();
    expect(independence.closest('label')).toHaveClass('animate-shake-lock');
    expect(independence.closest('label')?.querySelector('.filter-check'))
      .toHaveAttribute('data-invalid', 'true');

    // Marcar limpa o alerta e libera a análise.
    await user.click(independence);
    expect(independence.closest('label')).not.toHaveClass('animate-shake-lock');
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

  it('keeps decimal alpha 0.1 for the interpretation and shows 10%', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const interpretation = vi.spyOn(mannWhitneyInterpretation, 'buildMannWhitneyInterpretation');
    render(<SessionProvider><MannWhitneyTest /></SessionProvider>);
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    await user.click(screen.getByRole('button', { name: /desbloquear/i }));
    await user.click(screen.getByRole('option', { name: '10,0' }));
    expect(screen.getByText(/10%/)).toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: /grupos são independentes/i }));
    await runToResultados(user);

    expect(interpretation.mock.calls.at(-1)?.[1]).toBe(0.1);
  });
});
