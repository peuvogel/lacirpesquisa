import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { TStudentTest } from './TStudentTest';
import { TABULAR_OPTIONS } from './tStudentConfig';
import * as tStudentInterpretation from './tStudentInterpretation';

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

function renderTStudent() {
  function GlobalClearControl() {
    const { clearSession } = useSession();
    return <button type="button" onClick={clearSession}>Limpar sessão global</button>;
  }

  return render(
    <SessionProvider>
      <GlobalClearControl />
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

  it('renders exactly one import summary when configuration becomes visible', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTStudent();
    await loadExample(user);

    expect(screen.getAllByRole('region', { name: 'Resumo da importação' })).toHaveLength(1);
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
    expect(screen.getByRole('button', { name: 'Baixar Diferença de médias (IC95%)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar Distribuição por grupo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar Barras de médias' })).toBeInTheDocument();
    expect(screen.getByText('Tipos de gráfico')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dispersão')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Diferença de médias (IC95%)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Distribuição por grupo' })).toBeInTheDocument();

    const prose = screen.getAllByText(/Observou-se|Não se observou/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
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

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
    expect(
      screen.getByText(/Os dados ou a configuração foram alterados/i),
    ).toBeInTheDocument();
  });

  it('invalidates the visible result when a new source replaces the confirmed table', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTStudent();
    await loadExample(user);
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
    await screen.findByText('O que isso significa?');

    fireEvent.change(screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'), {
      target: { value: 'Grupo A;Grupo B\n1;4\n2;5\n3;6' },
    });
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(screen.queryByText('O que isso significa?')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
  });

  it('returns to the empty data step when the global session is cleared', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTStudent();
    await loadExample(user);
    expect(screen.getByText('Papéis desta análise')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar sessão global' }));

    await waitFor(() => {
      expect(screen.queryByText('Papéis desta análise')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Cole ou envie seus dados')).toBeInTheDocument();
  });

  it('shows a corrective error instead of a finite result when standard error is zero', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTStudent();
    fireEvent.change(screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'), {
      target: { value: 'Grupo A;Grupo B\n1;2\n1;2' },
    });
    await vi.advanceTimersByTimeAsync(200);

    await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));

    expect(await screen.findByText(/erro padrão.*zero|variação suficiente/i)).toBeInTheDocument();
    expect(screen.queryByText('Estatística t')).not.toBeInTheDocument();
  });
  it('keeps decimal alpha 0.1 for the interpretation and shows 10%', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const interpretation = vi.spyOn(tStudentInterpretation, 'buildTStudentInterpretation');
    renderTStudent();
    await loadExample(user);

    await user.click(screen.getByRole('button', { name: /desbloquear/i }));
    await user.click(screen.getByRole('option', { name: '10,0' }));
    expect(screen.getByText(/10%/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
    await screen.findByText('O que isso significa?');

    expect(interpretation).toHaveBeenCalled();
    expect(interpretation.mock.calls.at(-1)?.[1]).toBe(0.1);
  });
  it('adopts delayed restored alpha before any local choice', async () => {
    let resolveRead: ((snapshot: {
      version: 1; savedAt: number; dataset: { headers: string[]; rows: string[][]; sourceLabel: string; confirmedAt: number }; visualPreferences: Record<string, unknown>; testSlots: Record<string, { dataset: { headers: string[]; rows: string[][]; sourceLabel: string; confirmedAt: number }; settings: { alpha: number } }>
    }) => void) | undefined;
    const dataset = { headers: ['Grupo A', 'Grupo B'], rows: [['1', '2'], ['2', '3'], ['3', '4']], sourceLabel: 'restaurado', confirmedAt: 1 };
    const storage = {
      read: () => new Promise<any>((resolve) => { resolveRead = resolve; }),
      write: async () => undefined,
      clear: async () => undefined,
    };
    const interpretation = vi.spyOn(tStudentInterpretation, 'buildTStudentInterpretation');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    function LaterSettingsUpdate() {
      const { setSettings } = useAnalysisTable('t-student', { tabularOptions: TABULAR_OPTIONS });
      return <button type="button" onClick={() => setSettings({ alpha: 0.1 })}>Atualizar alpha restaurado</button>;
    }
    render(<SessionProvider storage={storage}><LaterSettingsUpdate /><TStudentTest /></SessionProvider>);

    await act(async () => resolveRead?.({ version: 1, savedAt: 1, dataset, visualPreferences: {}, testSlots: { 't-student': { dataset, settings: { alpha: 0.1 } } } }));
    expect(await screen.findByText(/10%/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));
    await screen.findByText('O que isso significa?');
    expect(interpretation.mock.calls.at(-1)?.[1]).toBe(0.1);

    await user.click(screen.getByRole('button', { name: /desbloquear/i }));
    await user.click(screen.getByRole('option', { name: '1,0' }));
    expect(screen.getByText(/1%/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Atualizar alpha restaurado' }));
    expect(screen.getByText(/1%/)).toBeInTheDocument();
  });
});
