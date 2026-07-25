import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  createInitialMapAnalysisState,
  deriveSelectionSummary,
  type MapAnalysisState,
} from './mapAnalysisState';
import { SelectionSummaryStrip } from './SelectionSummaryStrip';

const baTerritory = {
  level: 'uf' as const,
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

const peTerritory = {
  level: 'uf' as const,
  ibgeCode: '26',
  sigla: 'PE',
  name: 'Pernambuco',
};

describe('SelectionSummaryStrip', () => {
  it('renders empty state copy verbatim from UI-SPEC', () => {
    const summary = deriveSelectionSummary(createInitialMapAnalysisState(), []);
    render(<SelectionSummaryStrip summary={summary} />);

    expect(screen.getByText('Nada selecionado ainda')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Clique nos estados no mapa para começar. Depois forme grupos e escolha período e agravos.',
      ),
    ).toBeInTheDocument();
  });

  it('renders partial state when territories selected but no groups', () => {
    const summary = deriveSelectionSummary(createInitialMapAnalysisState(), [baTerritory, peTerritory]);
    render(<SelectionSummaryStrip summary={summary} />);

    expect(screen.getByText('2 estado(s) selecionado(s)')).toBeInTheDocument();
    expect(screen.getByText('Crie um grupo para definir período e doenças.')).toBeInTheDocument();
  });

  it('renders complete sentence when all segments present', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          territoryIds: [baTerritory, peTerritory],
          time: { mode: 'range', start: '2018', end: '2022' },
          variableIds: ['mock.internacoes', 'mock.obitos'],
        },
        {
          id: 'g2',
          name: 'Grupo 2',
          territoryIds: [
            {
              level: 'uf',
              ibgeCode: '35',
              sigla: 'SP',
              name: 'São Paulo',
            },
          ],
          time: { mode: 'point', point: '2020' },
          variableIds: ['mock.internacoes'],
        },
      ],
    };
    const summary = deriveSelectionSummary(state, []);
    render(<SelectionSummaryStrip summary={summary} />);

    expect(summary.mode).toBe('complete');
    expect(summary.sentence).toContain('BA, PE');
    expect(summary.sentence).toContain('2 grupos');
    expect(summary.sentence).toContain('2018–2022');
    expect(summary.sentence).toContain('Internações hospitalares');
  });

  it('has aria-live polite on container', () => {
    const summary = deriveSelectionSummary(createInitialMapAnalysisState(), []);
    render(<SelectionSummaryStrip summary={summary} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
