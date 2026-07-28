import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as registry from '@/features/tests/registry';
import { SessionProvider, useSession, type SessionDataset } from '@/shared/session/SessionProvider';
import { IniciarPesquisaModal, resolveHandoffTestId } from './IniciarPesquisaModal';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useNavigate: () => navigateMock,
  };
});

const TEXTAREA_LABEL = 'Cole aqui os dados copiados do DataSUS/TABNET';
const VALID_PASTE = 'Município;Taxa por 100k;Situação\nSão Paulo;12,5;Alerta\nRio;8,75;Estável';

function SessionObserver({ onDataset }: { onDataset: (dataset: ReturnType<typeof useSession>['dataset']) => void }) {
  const { dataset } = useSession();
  onDataset(dataset);
  return null;
}

function renderModal(
  overrides: Partial<Parameters<typeof IniciarPesquisaModal>[0]> = {},
  onDataset: (dataset: ReturnType<typeof useSession>['dataset']) => void = () => {},
) {
  const onOpenChange = vi.fn();

  render(
    <MemoryRouter>
      <SessionProvider>
        <SessionObserver onDataset={onDataset} />
        <IniciarPesquisaModal
          open
          onOpenChange={onOpenChange}
          selectedUFs={['SP', 'BA']}
          selectedVariables={['Internações por causa']}
          {...overrides}
        />
      </SessionProvider>
    </MemoryRouter>,
  );

  return { onOpenChange };
}

async function continueWithValidPaste(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(TEXTAREA_LABEL), { target: { value: VALID_PASTE } });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Continuar para Estatística' })).not.toBeDisabled();
  });

  await user.click(screen.getByRole('button', { name: 'Continuar para Estatística' }));
}

describe('resolveHandoffTestId', () => {
  it('prefers the first available suggestion', () => {
    expect(
      resolveHandoffTestId([
        { testId: 'correlacao', rationale: 'corr' },
        { testId: 't-student', rationale: 't' },
      ]),
    ).toBe('correlacao');
  });

  it('falls back to t-student when the primary suggestion is unavailable', () => {
    const spy = vi.spyOn(registry, 'isTestAvailable').mockImplementation((id) => id === 't-student');

    expect(
      resolveHandoffTestId([
        { testId: 'anova-tukey', rationale: 'anova' },
        { testId: 't-student', rationale: 't' },
      ]),
    ).toBe('t-student');

    spy.mockRestore();
  });
});

describe('IniciarPesquisaModal', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the deprecated notice, suggested analyses, and collection links with noopener', () => {
    renderModal();

    expect(screen.getByText(/Este fluxo legado será removido/i)).toBeInTheDocument();
    expect(screen.queryByText('Teste demo')).not.toBeInTheDocument();
    expect(screen.getByText('t de Student')).toBeInTheDocument();
    expect(screen.getAllByText('Disponível').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Em breve')).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /TABNET: SIH\/SUS/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps continue disabled before paste and enables it after a valid semicolon table', async () => {
    renderModal();

    const continueButton = screen.getByRole('button', { name: 'Continuar para Estatística' });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(TEXTAREA_LABEL), { target: { value: VALID_PASTE } });

    await waitFor(() => {
      expect(continueButton).not.toBeDisabled();
    });
  });

  it('publishes parsed data and navigates with t-student handoff for two UFs', async () => {
    const user = userEvent.setup();
    let latestDataset: SessionDataset | null = null;

    const { onOpenChange } = renderModal({}, (dataset) => {
      latestDataset = dataset;
    });

    await continueWithValidPaste(user);

    await waitFor(() => {
      expect(latestDataset).not.toBeNull();
    });

    expect(latestDataset!.headers).toEqual(['Município', 'Taxa por 100k', 'Situação']);
    expect(latestDataset!.rows).toHaveLength(2);
    expect(latestDataset!.sourceLabel).toBe('Mapas: SP, BA');
    expect(navigateMock).toHaveBeenCalledWith('/', { state: { activeTestId: 't-student' } });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('navigates with correlacao handoff when one UF and two variables are selected', async () => {
    const user = userEvent.setup();
    renderModal({
      selectedUFs: ['SP'],
      selectedVariables: ['Internações por causa', 'Taxa por 100k'],
    });

    await continueWithValidPaste(user);

    expect(navigateMock).toHaveBeenCalledWith('/', { state: { activeTestId: 'correlacao' } });
  });

  it('navigates with anova-tukey handoff when three UFs suggest ANOVA', async () => {
    const user = userEvent.setup();
    renderModal({
      selectedUFs: ['SP', 'BA', 'RJ'],
      selectedVariables: ['Internações por causa'],
    });

    await continueWithValidPaste(user);

    expect(navigateMock).toHaveBeenCalledWith('/', { state: { activeTestId: 'anova-tukey' } });
  });

  it('falls back to t-student when anova is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(registry, 'isTestAvailable').mockImplementation((id) => id === 't-student');

    renderModal({
      selectedUFs: ['SP', 'BA', 'RJ'],
      selectedVariables: ['Internações por causa'],
    });

    await continueWithValidPaste(user);

    expect(navigateMock).toHaveBeenCalledWith('/', { state: { activeTestId: 't-student' } });
  });

  it('shows the same friendly Portuguese error as Estatística for junk paste', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(TEXTAREA_LABEL), { target: { value: 'palavraisolada' } });

    expect(await screen.findByText('Não conseguimos reconhecer esses dados')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
