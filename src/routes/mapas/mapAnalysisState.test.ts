import { describe, expect, it } from 'vitest';
import {
  applyCatalogVariableIds,
  clampYear,
  createResearchDesignFromMapState,
  createInitialMapAnalysisState,
  deriveFlatMapSelection,
  deriveMapAnalysis,
  deriveSelectionSummary,
  formatTimeSummary,
  isGroupComplete,
  isRangeTimeInvalid,
  mapAnalysisReducer,
  normalizeMapAnalysisState,
  resolveCatalogHandoffIds,
  territoryOwner,
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
    variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
    ...overrides,
  };
}

describe('applyCatalogVariableIds', () => {
  it('creates a Catálogo group with resolved loadable IDs and UF layer', () => {
    const next = applyCatalogVariableIds(createInitialMapAnalysisState(), [
      'sih.embolia_e_trombose_arteriais.internacoes',
      'unknown.var',
      'ref.sih.nibr',
      'mock.obitos',
    ]);
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]!.name).toBe('Catálogo');
    expect(next.groups[0]!.variableIds).toEqual([
      'sih.embolia_e_trombose_arteriais.internacoes',
      'sih.embolia_e_trombose_arteriais.obitos',
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
    expect(resolveCatalogHandoffIds(['nope', 'sih.embolia_e_trombose_arteriais.internacoes'])).toEqual([
      'sih.embolia_e_trombose_arteriais.internacoes',
    ]);
  });
});

describe('normalizeMapAnalysisState', () => {
  it('backfills sharedTime and periodScope from legacy session shapes', () => {
    const legacy = {
      groups: [
        {
          id: 'g1',
          name: 'BA',
          territoryIds: [sampleTerritory],
          time: { mode: 'range' as const, start: '2015-01', end: '2019-12' },
          variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
        },
      ],
      activeGroupId: 'g1',
      mapView: { level: 'uf' as const },
      provenance: 'catalog' as const,
    };
    const next = normalizeMapAnalysisState(legacy);
    expect(next.sharedTime).toEqual(legacy.groups[0]!.time);
    expect(next.periodScope).toBe('shared');
  });

  it('isTimeValid tolerates undefined time', () => {
    expect(isRangeTimeInvalid(undefined)).toBe(false);
    expect(formatTimeSummary(undefined)).toBe('');
  });
});

describe('mapAnalysisReducer', () => {
  it('ASSIGN_TERRITORIES_TO_ACTIVE creates and activates the first population', () => {
    const next = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'ASSIGN_TERRITORIES_TO_ACTIVE',
      territories: [sampleTerritory],
    });

    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]).toMatchObject({
      name: 'População selecionada',
      territoryIds: [sampleTerritory],
    });
    expect(next.activeGroupId).toBe(next.groups[0]!.id);
    expect(territoryOwner(next, sampleTerritory)?.id).toBe(next.groups[0]!.id);
  });

  it('ASSIGN_TERRITORIES_TO_ACTIVE merges new territories without duplicates', () => {
    const saoPaulo = {
      level: 'uf' as const,
      ibgeCode: '35',
      sigla: 'SP',
      name: 'São Paulo',
    };
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'ASSIGN_TERRITORIES_TO_ACTIVE',
      territories: [sampleTerritory],
    });

    state = mapAnalysisReducer(state, {
      type: 'ASSIGN_TERRITORIES_TO_ACTIVE',
      territories: [sampleTerritory, saoPaulo, saoPaulo],
    });

    expect(state.groups[0]!.territoryIds).toEqual([sampleTerritory, saoPaulo]);
  });

  it('REMOVE_TERRITORIES_FROM_GROUP only changes the addressed population', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      name: 'População selecionada',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'CREATE_GROUP',
      name: 'Comparador',
      territories: [sampleTerritory],
    });
    const [population, comparator] = state.groups;

    state = mapAnalysisReducer(state, {
      type: 'REMOVE_TERRITORIES_FROM_GROUP',
      groupId: population!.id,
      territories: [sampleTerritory],
    });

    expect(state.groups.find((group) => group.id === population!.id)!.territoryIds).toEqual([]);
    expect(state.groups.find((group) => group.id === comparator!.id)!.territoryIds).toEqual([
      sampleTerritory,
    ]);
  });

  it('does not silently move a territory owned by another population', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'ASSIGN_TERRITORIES_TO_ACTIVE',
      territories: [sampleTerritory],
    });
    const ownerId = state.activeGroupId!;
    state = mapAnalysisReducer(state, { type: 'CREATE_GROUP', name: 'Comparador' });
    const comparatorId = state.activeGroupId!;

    state = mapAnalysisReducer(state, {
      type: 'ASSIGN_TERRITORIES_TO_ACTIVE',
      territories: [sampleTerritory],
    });

    expect(territoryOwner(state, sampleTerritory)?.id).toBe(ownerId);
    expect(state.groups.find((group) => group.id === ownerId)!.territoryIds).toEqual([
      sampleTerritory,
    ]);
    expect(state.groups.find((group) => group.id === comparatorId)!.territoryIds).toEqual([]);
    expect(state.activeGroupId).toBe(comparatorId);
  });

  it('explicit comparator creation inherits the shared disease and time seed', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'ASSIGN_TERRITORIES_TO_ACTIVE',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'SET_SHARED_TIME',
      time: { mode: 'range', start: '2018-01', end: '2022-12' },
    });
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });

    state = mapAnalysisReducer(state, { type: 'CREATE_GROUP', name: 'Comparador' });

    expect(state.groups[1]!.time).toEqual({
      mode: 'range',
      start: '2018-01',
      end: '2022-12',
    });
    expect(state.groups[1]!.variableIds).toContain(
      'sih.embolia_e_trombose_arteriais.internacoes',
    );
  });

  it('direct assignment keeps legacy session defaults valid', () => {
    const legacy = {
      groups: [],
      activeGroupId: null,
      mapView: { level: 'uf' as const },
      provenance: 'catalog' as const,
    };

    const next = mapAnalysisReducer(legacy as unknown as MapAnalysisState, {
      type: 'ASSIGN_TERRITORIES_TO_ACTIVE',
      territories: [sampleTerritory],
      firstGroupName: 'Minha população',
    });

    expect(next.groups[0]!.name).toBe('Minha população');
    expect(next.groups[0]!.time).toEqual({ mode: 'point' });
    expect(next.periodScope).toBe('shared');
    expect(next.locationBasis).toBe('ocorrencia');
  });

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

  it('TOGGLE_DISEASE_ALL_GROUPS applies the same disease to every group', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'CREATE_GROUP',
      territories: [{ level: 'uf', ibgeCode: '35', sigla: 'SP', name: 'São Paulo' }],
    });

    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });

    expect(state.groups).toHaveLength(2);
    for (const group of state.groups) {
      expect(group.variableIds).toContain('sih.embolia_e_trombose_arteriais.internacoes');
    }

    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });
    for (const group of state.groups) {
      expect(group.variableIds).not.toContain('sih.embolia_e_trombose_arteriais.internacoes');
    }
  });

  it('CREATE_GROUP seeds disease catalog ids from the active group', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });
    state = mapAnalysisReducer(state, {
      type: 'CREATE_GROUP',
      territories: [{ level: 'uf', ibgeCode: '35', sigla: 'SP', name: 'São Paulo' }],
    });

    expect(state.groups[1]!.variableIds).toContain('sih.embolia_e_trombose_arteriais.internacoes');
  });

  it('SET_SHARED_TIME syncs every group while scope is shared', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'CREATE_GROUP',
      territories: [{ level: 'uf', ibgeCode: '35', sigla: 'SP', name: 'São Paulo' }],
    });
    const time = { mode: 'range' as const, start: '2015-01', end: '2019-12' };
    state = mapAnalysisReducer(state, { type: 'SET_SHARED_TIME', time });

    expect(state.sharedTime).toEqual(time);
    expect(state.groups[0]!.time).toEqual(time);
    expect(state.groups[1]!.time).toEqual(time);
  });

  it('PREPARE_PERIOD_COMPARE clones one group into pré × pós pandemia', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });
    state = mapAnalysisReducer(state, { type: 'PREPARE_PERIOD_COMPARE' });

    expect(state.periodScope).toBe('per-group');
    expect(state.groups).toHaveLength(2);
    expect(state.groups[0]!.name).toMatch(/Pré-pandemia/i);
    expect(state.groups[1]!.name).toMatch(/Pós-pandemia/i);
    expect(state.groups[0]!.territoryIds).toEqual(state.groups[1]!.territoryIds);
    expect(state.groups[0]!.time.start?.startsWith('20')).toBe(true);
    expect(state.groups[1]!.time.start?.startsWith('20')).toBe(true);
    const endA = parseInt(state.groups[0]!.time.end!.slice(0, 4), 10);
    const startB = parseInt(state.groups[1]!.time.start!.slice(0, 4), 10);
    expect(endA).toBeLessThan(startB);
  });

  it('per-group SET_GROUP_TIME does not overwrite the other group', () => {
    let state = mapAnalysisReducer(createInitialMapAnalysisState(), {
      type: 'CREATE_GROUP',
      territories: [sampleTerritory],
    });
    state = mapAnalysisReducer(state, {
      type: 'CREATE_GROUP',
      territories: [{ level: 'uf', ibgeCode: '35', sigla: 'SP', name: 'São Paulo' }],
    });
    state = mapAnalysisReducer(state, { type: 'SET_PERIOD_SCOPE', scope: 'per-group' });
    const timeA = { mode: 'range' as const, start: '2015-01', end: '2019-12' };
    const timeB = { mode: 'range' as const, start: '2020-01', end: '2023-12' };
    state = mapAnalysisReducer(state, {
      type: 'SET_GROUP_TIME',
      groupId: state.groups[0]!.id,
      time: timeA,
    });
    state = mapAnalysisReducer(state, {
      type: 'SET_GROUP_TIME',
      groupId: state.groups[1]!.id,
      time: timeB,
    });

    expect(state.groups[0]!.time).toEqual(timeA);
    expect(state.groups[1]!.time).toEqual(timeB);
  });
});

describe('deriveMapAnalysis', () => {
  it('creates a research design with unique diseases, independent from selected measures', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      mapView: { level: 'uf' },
      groups: [
        completeGroup({
          variableIds: [
            'sih.embolia_e_trombose_arteriais.internacoes',
            'sih.embolia_e_trombose_arteriais.obitos',
          ],
        }),
        completeGroup({
          id: 'g2',
          name: 'Grupo 2',
          territoryIds: [{ level: 'uf', ibgeCode: '35', sigla: 'SP', name: 'São Paulo' }],
          variableIds: ['sih.amputacao_mmii.obitos'],
        }),
      ],
      periodScope: 'shared',
      sharedTime: { mode: 'range', start: '2020-01', end: '2021-12' },
      locationBasis: 'residencia',
    };

    expect(createResearchDesignFromMapState(state)).toEqual({
      ok: true,
      value: {
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          territories: [{ id: '29', label: 'Bahia' }],
        },
        {
          id: 'g2',
          name: 'Grupo 2',
          territories: [{ id: '35', label: 'São Paulo' }],
        },
      ],
      geography: 'uf',
      locationBasis: 'residencia',
      diseaseIds: ['embolia_e_trombose_arteriais', 'amputacao_mmii'],
      period: { scope: 'shared', time: { mode: 'range', start: '2020-01', end: '2021-12' } },
      },
    });
  });

  it('derives municipal geography from the selected territories, not a zoomed-out map view', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      sharedTime: { mode: 'point', point: '2020' },
      mapView: { level: 'uf' },
      groups: [
        completeGroup({
          territoryIds: [
            { level: 'municipio', ibgeCode: '2927408', name: 'Salvador' },
            { level: 'municipio', ibgeCode: '2910800', name: 'Feira de Santana' },
          ],
          variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
        }),
      ],
    };

    expect(createResearchDesignFromMapState(state)).toMatchObject({
      ok: true,
      value: {
        geography: 'municipio',
        groups: [
          {
            territories: [
              { id: '2927408', label: 'Salvador' },
              { id: '2910800', label: 'Feira de Santana' },
            ],
          },
        ],
      },
    });
  });

  it('fails closed when selected groups mix incompatible territory levels', () => {
    const state: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      sharedTime: { mode: 'point', point: '2020' },
      groups: [
        completeGroup(),
        completeGroup({
          id: 'g2',
          territoryIds: [{ level: 'municipio', ibgeCode: '2927408', name: 'Salvador' }],
        }),
      ],
    };

    expect(createResearchDesignFromMapState(state)).toEqual({
      ok: false,
      errors: [
        {
          code: 'mixed_geography',
          message: 'Todos os territórios do recorte precisam usar o mesmo grão geográfico.',
        },
      ],
    });
  });

  it('defaults location basis to occurrence and updates it through the reducer', () => {
    const initial = createInitialMapAnalysisState();
    const next = mapAnalysisReducer(initial, { type: 'SET_LOCATION_BASIS', locationBasis: 'residencia' });

    expect(initial.locationBasis).toBe('ocorrencia');
    expect(next.locationBasis).toBe('residencia');
  });

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

  it('requires a shared disease, not a separately selected measure in every group', () => {
    const withoutDisease: MapAnalysisState = {
      ...createInitialMapAnalysisState(),
      groups: [completeGroup({ variableIds: ['mock.internacoes'] })],
    };
    const withDisease: MapAnalysisState = {
      ...withoutDisease,
      groups: [
        completeGroup({ variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'] }),
      ],
    };

    expect(deriveMapAnalysis(withoutDisease).canReview).toBe(false);
    expect(deriveMapAnalysis(withDisease).canReview).toBe(true);
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
      variableId: 'sih.embolia_e_trombose_arteriais.internacoes',
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
    expect(flat?.variables).toContain('sih.embolia_e_trombose_arteriais.internacoes');
  });
});
