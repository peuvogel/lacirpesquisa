import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { resolveHealthMacroTerritories, resolvePresetTerritories } from '@/geo/territoryCatalog';
import {
  createInitialMapAnalysisState,
  mapAnalysisReducer,
  type MapAnalysisAction,
} from './mapAnalysisState';
import { GroupBar } from './GroupBar';

function renderGroupBar(
  dispatch: ReturnType<typeof vi.fn>,
  overrides: {
    state?: ReturnType<typeof createInitialMapAnalysisState>;
    ungroupedTerritories?: Parameters<typeof GroupBar>[0]['ungroupedTerritories'];
  } = {},
) {
  const state = overrides.state ?? createInitialMapAnalysisState();
  return render(
    <GroupBar
      state={state}
      dispatch={dispatch}
      ungroupedTerritories={overrides.ungroupedTerritories ?? []}
    />,
  );
}

describe('GroupBar', () => {
  it('Norte preset creates group with 7 territories via territoryCatalog', () => {
    const dispatch = vi.fn();
    renderGroupBar(dispatch);

    fireEvent.click(screen.getByRole('button', { name: 'Norte' }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'CREATE_GROUP',
      name: 'Norte',
      territories: resolvePresetTerritories('N'),
    });
    expect(resolvePresetTerritories('N')).toHaveLength(7);
  });

  it('Criar grupo com seleção dispatches CREATE_GROUP without drag', () => {
    const dispatch = vi.fn();
    const ungrouped = [
      { level: 'uf' as const, ibgeCode: '29', sigla: 'BA', name: 'Bahia' },
      { level: 'uf' as const, ibgeCode: '26', sigla: 'PE', name: 'Pernambuco' },
    ];
    renderGroupBar(dispatch, { ungroupedTerritories: ungrouped });

    fireEvent.click(screen.getByRole('button', { name: 'Criar grupo com seleção' }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'CREATE_GROUP',
      territories: ungrouped,
    });
  });

  it('health macro preset creates group with health-macro level TerritoryRefs', () => {
    const dispatch = vi.fn();
    renderGroupBar(dispatch);

    fireEvent.click(screen.getByRole('button', { name: 'MR Bahia Norte' }));

    const territories = resolveHealthMacroTerritories('ba-macro-1');
    expect(territories.length).toBeGreaterThan(0);
    expect(territories.every((t) => t.level === 'municipio')).toBe(true);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'CREATE_GROUP',
      name: 'MR Bahia Norte',
      territories,
    });
  });

  it('empty drop zone aria-label includes solte estados selecionados aqui', () => {
    renderGroupBar(vi.fn());

    expect(
      screen.getByLabelText('Grupo 1, solte estados selecionados aqui'),
    ).toBeInTheDocument();
  });

  it('rename dispatches RENAME_GROUP', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      name: 'Grupo Teste',
    });
    const groupId = state.groups[0]!.id;

    const dispatch = vi.fn((action: MapAnalysisAction) => {
      state = mapAnalysisReducer(state, action);
    });

    render(
      <GroupBar
        state={state}
        dispatch={dispatch}
        ungroupedTerritories={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Renomear Grupo Teste' }));
    const input = screen.getByLabelText('Renomear Grupo Teste');
    fireEvent.change(input, { target: { value: 'Nordeste A' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'RENAME_GROUP',
      groupId,
      name: 'Nordeste A',
    });
  });
});

describe('mapAnalysisReducer preset', () => {
  it('MERGE_PRESET N resolves exactly 7 UFs', () => {
    const state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'MERGE_PRESET',
      presetId: 'N',
    });
    expect(state.groups[0]!.territoryIds).toHaveLength(7);
  });
});
