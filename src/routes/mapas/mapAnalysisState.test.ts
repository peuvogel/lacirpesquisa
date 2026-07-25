import { describe, expect, it } from 'vitest';
import {
  applyCatalogVariableIds,
  clampYear,
  createInitialMapAnalysisState,
  deriveFlatMapSelection,
  deriveMapAnalysis,
  deriveSelectionSummary,
  formatTimeSummary,
  isGroupComplete,
  isRangeTimeInvalid,
  mapAnalysisReducer,
  resolveCatalogHandoffIds,
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

describe('applyCatalogVariableIds', () => {
  it('creates a Catálogo group with resolved loadable IDs and UF layer', () => {
    const next = applyCatalogVariableIds(createInitialMapAnalysisState(), [
      'sih.embolia_trombose.internacoes',
      'unknown.var',
      'ref.sih.nibr',
      'mock.obitos',
    ]);
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]!.name).toBe('Catálogo');
    expect(next.groups[0]!.variableIds).toEqual([
      'sih.embolia_trombose.internacoes',
      'sih.embolia_trombose.obitos',
    ]);
    expect(next.groups[0]!.time.mode).toBe('point');
    expect(next.groups[0]!.time.point).toMatch(/^\d{4}$/);
    expect(next.mapView.level).toBe('uf');
    expect(next.provenance).toBe('catalog');
  });

  it('marks hybrid provenance when paste was already active', () => {
    const base = createInitialMapAnalysisState();
    const next = applyCatalogVariableIds(
      { ...base, provenance: 'paste' },
      ['sih.amputacao_mmii.internacoes'],
    );
    expect(next.provenance).toBe('hybrid');
  });

  it('ignores unknown ids in resolveCatalogHandoffIds', () => {
    expect(resolveCatalogHandoffIds(['nope', 'sih.embolia_trombose.internacoes'])).toEqual([
      'sih.embolia_trombose.internacoes',
    ]);
  });
});

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

  it('summaryChips update when groups change', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    const groupId = state.groups[0]!.id;
    state = mapAnalysisReducer(state, {
      type: 'SET_GROUP_TIME',
      groupId,
      time: { mode: 'range', start: '2018', end: '2022' },
    });
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId,
      variableId: 'mock.internacoes',
    });

    const summary = deriveSelectionSummary(state);
    expect(summary.mode).toBe('complete');
    expect(summary.sentence).toContain('2018–2022');
  });
});

describe('formatTimeSummary', () => {
  it('formats range mode with en-dash', () => {
    expect(formatTimeSummary({ mode: 'range', start: '2018', end: '2022' })).toBe('2018–2022');
  });

  it('formats compare mode with vs separator', () => {
    expect(
      formatTimeSummary({ mode: 'compare', periodA: '2015-2019', periodB: '2020-2024' }),
    ).toBe('2015-2019 vs 2020-2024');
  });

  it('formats point mode as year string', () => {
    expect(formatTimeSummary({ mode: 'point', point: '2020' })).toBe('2020');
  });
});

describe('MAP-06 time validation', () => {
  it('detects invalid range when end is before start', () => {
    expect(isRangeTimeInvalid({ mode: 'range', start: '2022', end: '2018' })).toBe(true);
    expect(isRangeTimeInvalid({ mode: 'range', start: '2018', end: '2022' })).toBe(false);
  });

  it('clampYear rejects non-numeric and clamps to threat-model bounds', () => {
    expect(clampYear('abc')).toBe('');
    expect(clampYear('1980')).toBe('1990');
    expect(clampYear('2040')).toBe('2030');
    expect(clampYear('2020')).toBe('2020');
  });

  it('canReview requires every group complete, not just one', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      groups: [
        completeGroup(),
        {
          id: 'g2',
          name: 'Grupo 2',
          territoryIds: [sampleTerritory],
          time: { mode: 'point' },
          variableIds: [],
        },
      ],
    };
    expect(deriveMapAnalysis(state).canReview).toBe(false);
  });

  it('invalid range does not count as valid time for group completion', () => {
    const group = completeGroup({
      time: { mode: 'range', start: '2022', end: '2018' },
    });
    expect(isGroupComplete(group)).toBe(false);
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
