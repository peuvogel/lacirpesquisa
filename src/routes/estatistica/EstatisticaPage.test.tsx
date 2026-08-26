import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  SessionProvider,
  useSession,
  type SessionDataset,
} from '@/shared/session/SessionProvider';
import { EstatisticaPage } from './EstatisticaPage';

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

function SeedSession({
  dataset,
  children,
}: {
  dataset: SessionDataset;
  children: React.ReactNode;
}) {
  const { setDataset } = useSession();
  useEffect(() => {
    setDataset(dataset);
  }, [dataset, setDataset]);
  return <>{children}</>;
}

function renderPage(initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionProvider>
        <EstatisticaPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('EstatisticaPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to t de Student on cold start', () => {
    renderPage();
    const mount = document.getElementById('lacir-test-module-mount');
    expect(mount).toHaveAttribute('data-active-test-id', 't-student');
    expect(screen.getByRole('heading', { name: 't de Student' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar exemplo' })).toBeInTheDocument();
  });

  it('mounts correlação when selected from the sidebar', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Correlação/i }));

    const mount = document.getElementById('lacir-test-module-mount');
    expect(mount).toHaveAttribute('data-active-test-id', 'correlacao');
    expect(screen.getByRole('heading', { name: /Correlação/i })).toBeInTheDocument();
  });

  it('applies handoff test id when session data is present', async () => {
    const dataset: SessionDataset = {
      headers: ['Grupo', 'Valor'],
      rows: [['A', '1'], ['B', '2']],
      sourceLabel: 'Mapas: SP, BA',
      confirmedAt: Date.now(),
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/',
            state: { activeTestId: 'correlacao' },
          },
        ]}
      >
        <SessionProvider>
          <SeedSession dataset={dataset}>
            <EstatisticaPage />
          </SeedSession>
        </SessionProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const mount = document.getElementById('lacir-test-module-mount');
      expect(mount).toHaveAttribute('data-active-test-id', 'correlacao');
    });

    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeInTheDocument();
  });

  it('session handoff completes correlacao analysis through Resultados', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const dataset: SessionDataset = {
      headers: ['id', 'variavel_x', 'variavel_y', 'observacao_opcional'],
      rows: [
        ['UF1', '12,3', '45,2', ''],
        ['UF2', '14,1', '43,8', ''],
        ['UF3', '10,9', '48,0', ''],
        ['UF4', '15,2', '42,7', ''],
      ],
      sourceLabel: 'Mapas: SP',
      confirmedAt: Date.now(),
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/',
            state: { activeTestId: 'correlacao' },
          },
        ]}
      >
        <SessionProvider>
          <SeedSession dataset={dataset}>
            <EstatisticaPage />
          </SeedSession>
        </SessionProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const mount = document.getElementById('lacir-test-module-mount');
      expect(mount).toHaveAttribute('data-active-test-id', 'correlacao');
    });

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    });

    expect(screen.getByText('r de Pearson')).toBeInTheDocument();
    expect(screen.queryByText(/Cada grupo precisa/i)).not.toBeInTheDocument();
  });

  it.each([
    ['qui-quadrado', /Qui-quadrado/i],
    ['anova-tukey', /ANOVA de uma via/i],
    ['kruskal-dunn', /Kruskal-Wallis/i],
    ['poisson', /Regressão de Poisson/i],
    ['binomial-negativa', /Regressão Binomial Negativa/i],
    ['logistica', /Regressão Logística/i],
    ['mann-whitney', /Mann–Whitney/i],
  ] as const)('mounts %s from sidebar without null render', async (testId, namePattern) => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: namePattern }));

    const mount = document.getElementById('lacir-test-module-mount');
    expect(mount).toHaveAttribute('data-active-test-id', testId);
    expect(screen.getByRole('button', { name: 'Usar exemplo' })).toBeInTheDocument();
  });

  it('handoffs from ANOVA to Kruskal preserving recognizedColumns', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(screen.getByRole('button', { name: /ANOVA de uma via/i }));

    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeInTheDocument();
    });

    const desfechoSelect = screen.getByLabelText(/Tipo da coluna desfecho/i);
    const grupoSelect = screen.getByLabelText(/Tipo da coluna grupo/i);
    expect(desfechoSelect).toHaveValue('numerica');
    expect(grupoSelect).toHaveValue('categorica');

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    });

    const kruskalButton = screen.queryByRole('button', { name: /Kruskal/i });
    if (!kruskalButton) return;

    await user.click(kruskalButton);

    const mount = document.getElementById('lacir-test-module-mount');
    expect(mount).toHaveAttribute('data-active-test-id', 'kruskal-dunn');

    await waitFor(() => {
      expect(screen.getByLabelText(/Tipo da coluna desfecho/i)).toHaveValue('numerica');
    });

    expect(screen.getByLabelText(/Tipo da coluna grupo/i)).toHaveValue('categorica');
  });

  const OVERDISPERSED_PASTE = `contagem;exposicao
2;1
18;1
1;1
22;1
3;1
25;1
0;1
20;1
5;1
28;1
2;1
30;1`;

  it('handoffs from Poisson to Binomial Negativa preserving recognizedColumns', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(screen.getByRole('button', { name: /Regressão de Poisson/i }));

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.paste(OVERDISPERSED_PASTE);
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Tipo da coluna contagem/i)).toHaveValue('numerica');
    expect(screen.getByLabelText(/Tipo da coluna exposicao/i)).toHaveValue('numerica');

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    await waitFor(() => {
      expect(screen.getByText('O que isso significa?')).toBeInTheDocument();
    });

    const nbButtons = screen.getAllByRole('button', { name: 'Abrir Binomial Negativa' });
    await user.click(nbButtons[nbButtons.length - 1]!);

    const mount = document.getElementById('lacir-test-module-mount');
    expect(mount).toHaveAttribute('data-active-test-id', 'binomial-negativa');

    await waitFor(() => {
      expect(screen.getByLabelText(/Tipo da coluna contagem/i)).toHaveValue('numerica');
    });

    expect(screen.getByLabelText(/Tipo da coluna exposicao/i)).toHaveValue('numerica');
    expect(screen.getAllByText('em uso').length).toBeGreaterThanOrEqual(2);
  });
});
