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
  it('renders temporalidade empty state for new group', () => {
    const state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    const group = state.groups[0]!;
    const dispatch = vi.fn();

    render(<GroupConfigPanel group={group} dispatch={dispatch} />);

    expect(screen.getByRole('heading', { name: 'Quando analisar?' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ano único' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Intervalo de anos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Comparar dois períodos' })).toBeInTheDocument();
  });

  it('shows variable list with provenance badge after time is set', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    const groupId = state.groups[0]!.id;
    state = mapAnalysisReducer(state, {
      type: 'SET_GROUP_TIME',
      groupId,
      time: { mode: 'point', point: '2020' },
    });
    const group = state.groups[0]!;
    const dispatch = vi.fn();

    render(<GroupConfigPanel group={group} dispatch={dispatch} />);

    expect(screen.getByRole('heading', { name: 'O que comparar?' })).toBeInTheDocument();
    expect(screen.getAllByText(/Catálogo LACIR/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('variable-provenance-footnote')).toBeInTheDocument();
  });

  it('dispatches TOGGLE_GROUP_VARIABLE when checkbox is clicked', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    const groupId = state.groups[0]!.id;
    state = mapAnalysisReducer(state, {
      type: 'SET_GROUP_TIME',
      groupId,
      time: { mode: 'point', point: '2020' },
    });
    const group = state.groups[0]!;
    const dispatch = vi.fn();

    render(<GroupConfigPanel group={group} dispatch={dispatch} />);

    const checkbox = screen.getByRole('checkbox', {
      name: /Internações por embolia e trombose arteriais/i,
    });
    fireEvent.click(checkbox);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId,
      variableId: 'sih.embolia_trombose.internacoes',
    });
  });

  it('lists catalog loadables for BA+RS without partial-availability gaps', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [
        sampleTerritory,
        { level: 'uf', ibgeCode: '43', sigla: 'RS', name: 'Rio Grande do Sul' },
      ],
    });
    const groupId = state.groups[0]!.id;
    state = mapAnalysisReducer(state, {
      type: 'SET_GROUP_TIME',
      groupId,
      time: { mode: 'range', start: '2018', end: '2021' },
    });
    const group = state.groups[0]!;

    render(<GroupConfigPanel group={group} dispatch={vi.fn()} />);

    expect(
      screen.getByRole('checkbox', { name: /Internações por embolia e trombose arteriais/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Não existe em/)).not.toBeInTheDocument();
  });
});
