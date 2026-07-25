import { describe, expect, it } from 'vitest';
import {
  createInitialMapAnalysisState,
  deriveFlatMapSelection,
  deriveMapAnalysis,
  isGroupComplete,
  mapAnalysisReducer,
  type MapAnalysisGroup,
  type MapAnalysisState,
} from './mapAnalysisState';

const sampleTerritory = {
  level: 'uf' as const,
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

function completeGroup(overrides: Partial<MapAnalysisGroup> = {}): MapAnalysisGroup {
  return {
    id: 'g1',
    name: 'Grupo 1',
    territoryIds: [sampleTerritory],
    time: { mode: 'point', point: '2020' },
    variableIds: ['obitos'],
    ...overrides,
  };
}

describe('mapAnalysisReducer', () => {
  it('CREATE_GROUP adds a named group and sets active', () => {
    const initial = createInitialMapAnalysisState();
    const next = mapAnalysisReducer(initial, { type: 'CREATE_GROUP', name: 'Meu Grupo' });
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]!.name).toBe('Meu Grupo');
    expect(next.activeGroupId).toBe(next.groups[0]!.id);
  });

  it('RENAME_GROUP updates group name', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      name: 'Antigo',
    });
    const groupId = state.groups[0]!.id;
    state = mapAnalysisReducer(state, { type: 'RENAME_GROUP', groupId, name: 'Novo' });
    expect(state.groups[0]!.name).toBe('Novo');
  });

  it('SET_GROUP_TIME point mode round-trips', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), { type: 'CREATE_GROUP' });
    const groupId = state.groups[0]!.id;
    const time = { mode: 'point' as const, point: '2019' };
    state = mapAnalysisReducer(state, { type: 'SET_GROUP_TIME', groupId, time });
    expect(state.groups[0]!.time).toEqual(time);
  });

  it('SET_GROUP_TIME range mode serializes start/end', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), { type: 'CREATE_GROUP' });
    const groupId = state.groups[0]!.id;
    const time = { mode: 'range' as const, start: '2015', end: '2020' };
    state = mapAnalysisReducer(state, { type: 'SET_GROUP_TIME', groupId, time });
    expect(state.groups[0]!.time).toEqual(time);
  });

  it('SET_GROUP_TIME compare mode serializes periodA/B', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), { type: 'CREATE_GROUP' });
    const groupId = state.groups[0]!.id;
    const time = { mode: 'compare' as const, periodA: '2015-2019', periodB: '2020-2024' };
    state = mapAnalysisReducer(state, { type: 'SET_GROUP_TIME', groupId, time });
    expect(state.groups[0]!.time).toEqual(time);
  });

  it('MERGE_PRESET creates group with Norte UFs', () => {
    const state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'MERGE_PRESET',
      presetId: 'N',
    });
    expect(state.groups[0]!.territoryIds).toHaveLength(7);
  });

  it('TOGGLE_GROUP_VARIABLE adds and removes variables', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), { type: 'CREATE_GROUP' });
    const groupId = state.groups[0]!.id;
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId,
      variableId: 'obitos',
    });
    expect(state.groups[0]!.variableIds).toContain('obitos');
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId,
      variableId: 'obitos',
    });
    expect(state.groups[0]!.variableIds).not.toContain('obitos');
  });
});

describe('deriveMapAnalysis', () => {
  it('canReview false with empty groups', () => {
    expect(deriveMapAnalysis(createInitialMapAnalysisState()).canReview).toBe(false);
  });

  it('canReview false with incomplete group', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          territoryIds: [sampleTerritory],
          time: { mode: 'point' },
          variableIds: [],
        },
      ],
    };
    expect(deriveMapAnalysis(state).canReview).toBe(false);
  });

  it('canReview true with complete group', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      groups: [completeGroup()],
    };
    expect(deriveMapAnalysis(state).canReview).toBe(true);
    expect(isGroupComplete(completeGroup())).toBe(true);
  });
});

describe('deriveFlatMapSelection', () => {
  it('derives ufs and variables from groups', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      groups: [completeGroup()],
    };
    const flat = deriveFlatMapSelection(state);
    expect(flat?.ufs).toContain('BA');
    expect(flat?.variables).toContain('obitos');
  });
});
