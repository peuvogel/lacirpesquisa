import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SharedPeriodPanel } from './SharedPeriodPanel';
import {
  createInitialMapAnalysisState,
  mapAnalysisReducer,
} from './mapAnalysisState';

const sampleTerritory = {
  level: 'uf' as const,
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

describe('SharedPeriodPanel', () => {
  it('dispatches SET_SHARED_TIME when shared scope is selected', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });
    state = mapAnalysisReducer(state, { type: 'SET_PERIOD_SCOPE', scope: 'shared' });
    const dispatch = vi.fn();

    render(
      <SharedPeriodPanel
        state={state}
        dispatch={dispatch}
        diseaseVariableIds={state.groups[0]!.variableIds}
        activeGroup={state.groups[0]!}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Mesmo intervalo em todos os grupos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mesmo em todos/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Anos com dados nesta pesquisa/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ano inicial'), { target: { value: '2015' } });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_SHARED_TIME' }),
    );
  });

  it('offers pandemic compare helper in per-group mode', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });
    state = mapAnalysisReducer(state, { type: 'SET_PERIOD_SCOPE', scope: 'per-group' });
    const dispatch = vi.fn();

    render(
      <SharedPeriodPanel
        state={state}
        dispatch={dispatch}
        diseaseVariableIds={state.groups[0]!.variableIds}
        activeGroup={state.groups[0]!}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Preparar comparação/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'PREPARE_PERIOD_COMPARE' });
  });

  it('lets the shared recorte choose residence as the location basis', () => {
    const state = createInitialMapAnalysisState();
    const dispatch = vi.fn();

    render(
      <SharedPeriodPanel
        state={state}
        dispatch={dispatch}
        diseaseVariableIds={[]}
        activeGroup={null}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Residência' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_LOCATION_BASIS', locationBasis: 'residencia' });
  });
});
