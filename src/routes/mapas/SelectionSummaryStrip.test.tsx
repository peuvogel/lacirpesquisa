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
  it('empty state has no instructional CTA headline', () => {
    const summary = deriveSelectionSummary(createInitialMapAnalysisState(), []);
    expect(summary.mode).toBe('empty');
    expect(summary.headline).toBe('');
    expect(summary.hint).toBeUndefined();
  });

  it('ungrouped selection has no “Crie um grupo…” CTA strip copy', () => {
    const summary = deriveSelectionSummary(createInitialMapAnalysisState(), [
      baTerritory,
      peTerritory,
    ]);
    expect(summary.mode).toBe('partial');
    expect(summary.headline).toBe('');
    expect(summary.hint).toBeUndefined();
    expect(summary.chips).toHaveLength(2);
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
          variableIds: ['sih.embolia_e_trombose_arteriais.internacoes', 'sih.embolia_e_trombose_arteriais.obitos'],
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
          variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
        },
      ],
    };
    const summary = deriveSelectionSummary(state, []);
    render(<SelectionSummaryStrip summary={summary} />);

    expect(summary.mode).toBe('complete');
    expect(summary.sentence).toContain('BA, PE');
    expect(summary.sentence).toContain('2 grupos');
    expect(summary.sentence).toContain('2018–2022');
    expect(summary.sentence).toContain('Internações por embolia e trombose arteriais');
  });

  it('has aria-live polite on container when shown', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          territoryIds: [baTerritory],
          time: { mode: 'range', start: '2018', end: '2022' },
          variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
        },
      ],
    };
    const summary = deriveSelectionSummary(state, []);
    render(<SelectionSummaryStrip summary={summary} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
