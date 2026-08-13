import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import type { ResearchDesign } from '@/features/research/types';
import { ReviewAnalysisDialog } from './ReviewAnalysisDialog';
import type { SelectionSummary } from './mapAnalysisState';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useNavigate: () => navigateMock,
  };
});

const baTerritory = {
  level: 'uf' as const,
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

const spTerritory = {
  level: 'uf' as const,
  ibgeCode: '35',
  sigla: 'SP',
  name: 'São Paulo',
};

const design: ResearchDesign = {
  groups: [
    { id: 'g1', name: 'Grupo A', territories: [{ id: baTerritory.ibgeCode, label: baTerritory.name }] },
    { id: 'g2', name: 'Grupo B', territories: [{ id: spTerritory.ibgeCode, label: spTerritory.name }] },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia_e_trombose_arteriais'],
  period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
};

const summary: SelectionSummary = {
  mode: 'complete',
  headline: 'Bahia, São Paulo · 2 grupos · 2020 · Embolia e trombose arteriais',
  sentence: 'Bahia, São Paulo · 2 grupos · 2020 · Embolia e trombose arteriais',
  chips: [],
};

function SessionObserver({ onSession }: { onSession: (session: ReturnType<typeof useSession>) => void }) {
  onSession(useSession());
  return null;
}

function renderDialog(onSession: (session: ReturnType<typeof useSession>) => void = () => {}) {
  const onOpenChange = vi.fn();

  render(
    <MemoryRouter>
      <SessionProvider>
        <SessionObserver onSession={onSession} />
        <ReviewAnalysisDialog
          open
          onOpenChange={onOpenChange}
          summary={summary}
          researchDesign={design}
        />
      </SessionProvider>
    </MemoryRouter>,
  );

  return { onOpenChange };
}

describe('ReviewAnalysisDialog', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders a concise research cut review without a suggested test picker', () => {
    renderDialog();

    expect(screen.getByText('Seu recorte está pronto')).toBeInTheDocument();
    expect(screen.getByText(/Na próxima etapa, você escolhe as variáveis/i)).toBeInTheDocument();
    expect(screen.getByText('Sua seleção')).toBeInTheDocument();
    expect(screen.queryByText('Teste sugerido')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar para Variáveis' })).toBeInTheDocument();
  });

  it('persists only the research design and navigates to variables', async () => {
    const user = userEvent.setup();
    const sessionRef: { current: ReturnType<typeof useSession> | null } = { current: null };

    const { onOpenChange } = renderDialog((session) => {
      sessionRef.current = session;
    });

    await user.click(screen.getByRole('button', { name: 'Continuar para Variáveis' }));

    await waitFor(() => {
      expect(sessionRef.current?.researchDesign).toEqual(design);
    });
    expect(sessionRef.current?.dataset).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith('/variaveis');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
