import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { runToResultados } from '@/test/flowHelpers';
import { PraisWinstenValidationAlert } from './PraisWinstenConfigPanel';
import { PraisWinstenTest } from './PraisWinstenTest';

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

function renderPraisWinsten() {
  return render(
    <SessionProvider>
      <PraisWinstenTest />
    </SessionProvider>,
  );
}

const pastedSemesters = `Semestre\tN de inscritos
2021.1\t90
2021.2\t92
2022.1\t93
2022.2\t95
2023.1\t95
2023.2\t97
2024.1\t98
2024.2\t100
2025.1\t102
2025.2\t105
2026.1\t108
2026.2\t114`;

describe('PraisWinstenTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects pasted semesters, exposes an override and reaches results', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    fireEvent.change(
      screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'),
      { target: { value: pastedSemesters } },
    );
    await vi.advanceTimersByTimeAsync(200);

    expect(await screen.findByText(/Periodicidade detectada: Semestral/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Interpretar períodos como')).toHaveValue('auto');
    expect(screen.getByText(/efeito anualizado/i)).toBeInTheDocument();

    await runToResultados(user);
    const results = screen.getByRole('region', { name: 'Resultados' });
    expect(within(results).queryByText(/intervalos irregulares/i)).not.toBeInTheDocument();
    expect(within(results).getByText(/Semestral/i)).toBeInTheDocument();
    expect(within(results).getAllByText(/2021\.1 a 2026\.2/i).length).toBeGreaterThan(0);
  });

  it('names the missing semester when a temporal gap blocks analysis', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    fireEvent.change(
      screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'),
      { target: { value: pastedSemesters.replace('2023.2\t97\n', '') } },
    );
    await vi.advanceTimersByTimeAsync(200);

    await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Período ausente: 2023.2. Linhas: 5, 6.');
    expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pontos temporais')).not.toBeInTheDocument();
    expect(screen.queryByText('O que isso significa?')).not.toBeInTheDocument();
  });

  it('invalidates a confirmed result when the temporal interpretation changes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    await runToResultados(user);

    await user.selectOptions(screen.getByLabelText('Interpretar períodos como'), 'order');

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
    expect(screen.getByLabelText('Interpretar períodos como')).toHaveValue('order');
    expect(screen.getByText(/Periodicidade detectada: Ordem observada/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument();
    expect(screen.queryByText('O que isso significa?')).not.toBeInTheDocument();
  });

  it('does not claim a previous analysis was invalidated before any result existed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await user.selectOptions(await screen.findByLabelText('Interpretar períodos como'), 'order');

    expect(screen.queryByText('Análise anterior invalidada.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Interpretar períodos como')).toHaveValue('order');
  });

  it('renders one import summary owner after Configurar becomes visible', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await screen.findByLabelText('Interpretar períodos como');
    expect(screen.getAllByRole('region', { name: 'Resumo da importação' })).toHaveLength(1);
  });

  it('keeps a reordered-series warning visible above successful results', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    fireEvent.change(
      screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'),
      {
        target: {
          value: `Semestre\tValor
2021.2\t92
2021.1\t90
2022.1\t93
2022.2\t95
2023.1\t97
2023.2\t100`,
        },
      },
    );
    await vi.advanceTimersByTimeAsync(200);
    await runToResultados(user);

    const warningTitle = screen.getByText('Observações sobre a série temporal');
    const warningAlert = warningTitle.closest('[role="alert"]');
    const resultsRegion = screen.getByRole('region', { name: 'Resultados' });
    const activePanel = within(resultsRegion).getByRole('tabpanel');
    expect(screen.getAllByText('Observações sobre a série temporal')).toHaveLength(1);
    expect(warningAlert?.nextElementSibling).toBe(activePanel);
    expect(warningAlert).not.toHaveClass('text-destructive');
    expect(warningAlert).toHaveTextContent('Os períodos não estão na ordem temporal original.');
    expect(warningAlert).toHaveTextContent('Linhas: 1, 2.');
    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
  });

  it('shows every blocking issue with affected rows and separates warnings', () => {
    render(
      <PraisWinstenValidationAlert
        issues={[
          {
            code: 'missing_period',
            severity: 'error',
            message: 'Período ausente: 2022.1.',
            rowNumbers: [2, 3],
          },
          {
            code: 'duplicate_period',
            severity: 'error',
            message: 'Período duplicado: 2023.1.',
            rowNumbers: [4, 5],
          },
          {
            code: 'temporal_reordered',
            severity: 'warning',
            message: 'Os períodos não estão na ordem temporal original.',
            rowNumbers: [1, 2],
          },
        ]}
      />,
    );

    const primaryIssue = screen.getByText(/Período ausente: 2022\.1\./);
    expect(primaryIssue.tagName).toBe('P');
    expect(primaryIssue).toHaveTextContent('Linhas: 2, 3.');
    expect(screen.getByText('Ver outros problemas encontrados')).toBeInTheDocument();
    expect(screen.getByText(/Período duplicado: 2023\.1\./)).toHaveTextContent('Linhas: 4, 5.');
    const warningTitle = screen.getByText('Observações sobre a série temporal');
    expect(warningTitle.closest('[role="alert"]')).toHaveTextContent('Linhas: 1, 2.');
  });

  it('shows series preview on Configurar after Usar exemplo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await screen.findByRole('button', { name: 'Analisar dados' });

    expect(screen.getByText('Prévia da série temporal')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();
    expect(screen.getAllByText('2015').length).toBeGreaterThan(0);
    expect(screen.getAllByText('120,4').length).toBeGreaterThan(0);
  });

  it('runs exemplo flow through Resultados with interpretation and PNG export', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    expect(screen.queryByText('Observações sobre a série temporal')).not.toBeInTheDocument();
    expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Baixar/i }).length).toBeGreaterThanOrEqual(1);

    const prose = screen.getAllByText(/Analisou-se a tendência temporal|Resultado principal/i);
    expect(prose.length).toBeGreaterThan(0);
    prose.forEach((node) => {
      expect(node.textContent ?? '').not.toMatch(/<[^>]+>/);
    });
    expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
  });

  it('can reach both trend and residual chart tabs in Resultados', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await runToResultados(user);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Tendência' })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Resíduos' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Resíduos' }));

    await waitFor(() => {
      expect(screen.getByText('Prais-Winsten: resíduos')).toBeInTheDocument();
    });
  });

  it('explains that the previous result was invalidated after a table edit', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPraisWinsten();
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);
    await runToResultados(user);

    const firstValue = screen.getByLabelText('Linha 1, coluna 2');
    await user.clear(firstValue);
    await user.type(firstValue, '121');

    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
    expect(screen.queryByText('O que isso significa?')).not.toBeInTheDocument();
  });
});
