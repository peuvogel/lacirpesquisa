import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GroupConfigPanel } from './GroupConfigPanel';
import { mapAnalysisReducer, createInitialMapAnalysisState } from './mapAnalysisState';

const sampleTerritory = {
  level: 'uf' as const,
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

describe('GroupConfigPanel', () => {
  it('shows variables when open and period summary in subtitle', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });
    state = mapAnalysisReducer(state, {
      type: 'SET_SHARED_TIME',
      time: { mode: 'range', start: '2015-01', end: '2020-12' },
    });
    const group = state.groups[0]!;
    const dispatch = vi.fn();

    render(
      <GroupConfigPanel
        group={group}
        dispatch={dispatch}
        periodScope={state.periodScope}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Variáveis deste grupo/i)).toBeInTheDocument();
    expect(screen.getByText(/compartilhado/i)).toBeInTheDocument();
  });

  it('enables measure chips after disease and period are ready', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    const groupId = state.groups[0]!.id;
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId,
      variableId: 'sih.embolia_e_trombose_arteriais.internacoes',
    });
    state = mapAnalysisReducer(state, {
      type: 'SET_GROUP_TIME',
      groupId,
      time: { mode: 'range', start: '2015-01', end: '2020-12' },
    });
    const group = state.groups[0]!;
    const dispatch = vi.fn();

    render(
      <GroupConfigPanel group={group} dispatch={dispatch} open onOpenChange={vi.fn()} />,
    );

    const obitos = screen.getByRole('button', { name: /^Óbitos$/i });
    expect(obitos).not.toBeDisabled();
    fireEvent.click(obitos);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TOGGLE_GROUP_VARIABLE',
        groupId: group.id,
      }),
    );
  });
});
