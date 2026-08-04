import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as registry from '@/features/tests/registry';
import { SessionProvider, useSession, type SessionDataset } from '@/shared/session/SessionProvider';
import type { MapAnalysisGroup } from './mapAnalysisState';
import { createInitialMapAnalysisState, deriveSelectionSummary } from './mapAnalysisState';
import { ReviewAnalysisDialog, resolveHandoffTestId } from './ReviewAnalysisDialog';
import { guardHandoffTestId } from './mapHandoffShared';
import { TestPickerSelect } from './TestPickerSelect';

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

function twoGroupFixture(): MapAnalysisGroup[] {
  return [
    {
      id: 'g1',
      name: 'Grupo A',
      territoryIds: [baTerritory],
      time: { mode: 'point', point: '2020' },
      variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
    },
    {
      id: 'g2',
      name: 'Grupo B',
      territoryIds: [spTerritory],
      time: { mode: 'point', point: '2021' },
      variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
    },
  ];
}

function SessionObserver({ onDataset }: { onDataset: (dataset: ReturnType<typeof useSession>['dataset']) => void }) {
  const { dataset } = useSession();
  onDataset(dataset);
  return null;
}

function renderDialog(
  groups: MapAnalysisGroup[] = twoGroupFixture(),
  onDataset: (dataset: ReturnType<typeof useSession>['dataset']) => void = () => {},
) {
  const onOpenChange = vi.fn();
  const summary = deriveSelectionSummary({
    ...createInitialMapAnalysisState(),
    groups,
    activeGroupId: 'g1',
    mapView: { level: 'uf' },
    provenance: 'catalog',
  });

  render(
    <MemoryRouter>
      <SessionProvider>
        <SessionObserver onDataset={onDataset} />
        <ReviewAnalysisDialog
          open
          onOpenChange={onOpenChange}
          groups={groups}
          summary={summary}
          provenance="catalog"
        />
      </SessionProvider>
    </MemoryRouter>,
  );

  return { onOpenChange };
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

describe('ReviewAnalysisDialog', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders UI-SPEC copy and suggested test section', () => {
    renderDialog();

    expect(screen.getByText('Revisar antes de analisar')).toBeInTheDocument();
    expect(
      screen.getByText(/Confira territórios, grupos, período e variáveis/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Sua seleção')).toBeInTheDocument();
    expect(screen.getByText('Teste sugerido')).toBeInTheDocument();
    expect(screen.getByText('Usar outro teste')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir para Estatística' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver fontes oficiais' })).toBeInTheDocument();
  });

  it('publishes assembled dataset and navigates with activeTestId + recognizedColumns', async () => {
    const user = userEvent.setup();
    let latestDataset: SessionDataset | null = null;

    const { onOpenChange } = renderDialog(twoGroupFixture(), (dataset) => {
      latestDataset = dataset;
    });

    await user.click(screen.getByRole('button', { name: 'Ir para Estatística' }));

    await waitFor(() => {
      expect(latestDataset).not.toBeNull();
    });

    expect(latestDataset!.headers[0]).toBe('Território');
    expect(latestDataset!.rows.length).toBeGreaterThanOrEqual(2);
    expect(latestDataset!.sourceLabel).toMatch(/Mapas:/);

    expect(navigateMock).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({
        state: expect.objectContaining({
          activeTestId: 't-student',
          recognizedColumns: expect.any(Object),
        }),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('guardHandoffTestId respects user override when test is available', () => {
    expect(
      guardHandoffTestId('correlacao', [{ testId: 't-student', rationale: 't' }]),
    ).toBe('correlacao');
  });

  it('TestPickerSelect renders available registry tests', () => {
    const onChange = vi.fn();
    render(
      <TestPickerSelect value="t-student" onValueChange={onChange} />,
    );
    expect(screen.getByRole('combobox', { name: 'Usar outro teste' })).toBeInTheDocument();
  });

  it('collection links use noopener', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Ver fontes oficiais' }));

    const link = screen.getByRole('link', { name: /TABNET: SIH\/SUS/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
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

describe('ReviewAnalysisDialog handoff state', () => {
  it('includes recognizedColumns with territorio and medida keys', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Ir para Estatística' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({
        state: expect.objectContaining({
          activeTestId: 't-student',
          recognizedColumns: expect.objectContaining({
            territorio: expect.any(Number),
            medida: expect.any(Number),
          }),
        }),
      }),
    );
  });
});
