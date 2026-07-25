import { useCallback, useMemo, useReducer } from 'react';
import type { GeoLevel, MapViewState, TerritoryRef } from '@/geo/types';
import { resolvePresetTerritories, type RegionPresetId } from '@/geo/territoryCatalog';

export type TimeMode = 'point' | 'range' | 'compare';

export interface GroupTimeConfig {
  mode: TimeMode;
  point?: string;
  start?: string;
  end?: string;
  periodA?: string;
  periodB?: string;
}

export interface MapAnalysisGroup {
  id: string;
  name: string;
  territoryIds: TerritoryRef[];
  time: GroupTimeConfig;
  variableIds: string[];
}

export interface MapAnalysisState {
  groups: MapAnalysisGroup[];
  activeGroupId: string | null;
  mapView: MapViewState;
  provenance: 'mock' | 'paste' | 'hybrid';
}

export type MapAnalysisAction =
  | { type: 'CREATE_GROUP'; name?: string; territories?: TerritoryRef[] }
  | { type: 'RENAME_GROUP'; groupId: string; name: string }
  | { type: 'DELETE_GROUP'; groupId: string }
  | { type: 'MERGE_TERRITORIES_TO_GROUP'; groupId: string; territories: TerritoryRef[] }
  | { type: 'SET_ACTIVE_GROUP'; groupId: string | null }
  | { type: 'SET_GROUP_TIME'; groupId: string; time: GroupTimeConfig }
  | { type: 'TOGGLE_GROUP_VARIABLE'; groupId: string; variableId: string }
  | { type: 'SET_MAP_VIEW'; mapView: MapViewState }
  | { type: 'MERGE_PRESET'; presetId: RegionPresetId; groupId?: string }
  | { type: 'REPLACE_STATE'; state: MapAnalysisState };

let nextGroupCounter = 1;

function createEmptyGroup(name?: string, territories: TerritoryRef[] = []): MapAnalysisGroup {
  const id = `group-${nextGroupCounter++}`;
  return {
    id,
    name: name ?? `Grupo ${nextGroupCounter - 1}`,
    territoryIds: territories,
    time: { mode: 'point' },
    variableIds: [],
  };
}

export function createInitialMapAnalysisState(): MapAnalysisState {
  return {
    groups: [],
    activeGroupId: null,
    mapView: { level: 'uf' as GeoLevel },
    provenance: 'mock',
  };
}

function isTimeValid(time: GroupTimeConfig): boolean {
  switch (time.mode) {
    case 'point':
      return Boolean(time.point?.trim());
    case 'range':
      return Boolean(time.start?.trim() && time.end?.trim());
    case 'compare':
      return Boolean(time.periodA?.trim() && time.periodB?.trim());
    default:
      return false;
  }
}

function isGroupComplete(group: MapAnalysisGroup): boolean {
  return group.territoryIds.length > 0 && isTimeValid(group.time) && group.variableIds.length > 0;
}

function mergeTerritories(existing: TerritoryRef[], incoming: TerritoryRef[]): TerritoryRef[] {
  const seen = new Set(existing.map((t) => `${t.level}:${t.ibgeCode}`));
  const merged = [...existing];
  for (const t of incoming) {
    const key = `${t.level}:${t.ibgeCode}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(t);
    }
  }
  return merged;
}

export function mapAnalysisReducer(state: MapAnalysisState, action: MapAnalysisAction): MapAnalysisState {
  switch (action.type) {
    case 'CREATE_GROUP': {
      const group = createEmptyGroup(action.name, action.territories ?? []);
      return {
        ...state,
        groups: [...state.groups, group],
        activeGroupId: group.id,
      };
    }

    case 'RENAME_GROUP':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId ? { ...g, name: action.name } : g,
        ),
      };

    case 'DELETE_GROUP': {
      const groups = state.groups.filter((g) => g.id !== action.groupId);
      const activeGroupId =
        state.activeGroupId === action.groupId ? (groups[0]?.id ?? null) : state.activeGroupId;
      return { ...state, groups, activeGroupId };
    }

    case 'MERGE_TERRITORIES_TO_GROUP':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? { ...g, territoryIds: mergeTerritories(g.territoryIds, action.territories) }
            : g,
        ),
      };

    case 'SET_ACTIVE_GROUP':
      return { ...state, activeGroupId: action.groupId };

    case 'SET_GROUP_TIME':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId ? { ...g, time: action.time } : g,
        ),
      };

    case 'TOGGLE_GROUP_VARIABLE':
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          const has = g.variableIds.includes(action.variableId);
          return {
            ...g,
            variableIds: has
              ? g.variableIds.filter((v) => v !== action.variableId)
              : [...g.variableIds, action.variableId],
          };
        }),
      };

    case 'SET_MAP_VIEW':
      return { ...state, mapView: action.mapView };

    case 'MERGE_PRESET': {
      const territories = resolvePresetTerritories(action.presetId);
      if (action.groupId) {
        return mapAnalysisReducer(state, {
          type: 'MERGE_TERRITORIES_TO_GROUP',
          groupId: action.groupId,
          territories,
        });
      }
      return mapAnalysisReducer(state, { type: 'CREATE_GROUP', territories });
    }

    case 'REPLACE_STATE':
      return action.state;

    default:
      return state;
  }
}

export interface SummaryChip {
  label: string;
  kind: 'territory' | 'time' | 'variable' | 'group';
}

function buildSummaryChips(state: MapAnalysisState): SummaryChip[] {
  const chips: SummaryChip[] = [];
  for (const group of state.groups) {
    chips.push({ label: group.name, kind: 'group' });
    if (group.territoryIds.length > 0) {
      chips.push({
        label: `${group.territoryIds.length} território(s)`,
        kind: 'territory',
      });
    }
    if (isTimeValid(group.time)) {
      chips.push({ label: group.time.mode, kind: 'time' });
    }
    if (group.variableIds.length > 0) {
      chips.push({
        label: `${group.variableIds.length} variável(is)`,
        kind: 'variable',
      });
    }
  }
  return chips;
}

function collectAllTerritoryIds(state: MapAnalysisState): TerritoryRef[] {
  const seen = new Set<string>();
  const all: TerritoryRef[] = [];
  for (const group of state.groups) {
    for (const t of group.territoryIds) {
      const key = `${t.level}:${t.ibgeCode}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(t);
      }
    }
  }
  return all;
}

export function deriveMapAnalysis(state: MapAnalysisState) {
  const canReview = state.groups.some(isGroupComplete);
  return {
    summaryChips: buildSummaryChips(state),
    canReview,
    allTerritoryIds: collectAllTerritoryIds(state),
  };
}

/** Flat { ufs, variables } derived from active/complete groups for backward compat. */
export function deriveFlatMapSelection(state: MapAnalysisState | null): {
  ufs: string[];
  variables: string[];
} | null {
  if (!state || state.groups.length === 0) return null;

  const ufs = new Set<string>();
  const variables = new Set<string>();

  for (const group of state.groups) {
    for (const t of group.territoryIds) {
      if (t.level === 'uf' && t.sigla) ufs.add(t.sigla);
    }
    for (const v of group.variableIds) variables.add(v);
  }

  if (ufs.size === 0 && variables.size === 0) return null;
  return { ufs: [...ufs], variables: [...variables] };
}

export function useMapAnalysis(initialState?: MapAnalysisState) {
  const [state, dispatch] = useReducer(
    mapAnalysisReducer,
    initialState ?? createInitialMapAnalysisState(),
  );

  const derived = useMemo(() => deriveMapAnalysis(state), [state]);

  const commit = useCallback((next: MapAnalysisState) => {
    dispatch({ type: 'REPLACE_STATE', state: next });
  }, []);

  return { state, dispatch, commit, derived };
}

export { isGroupComplete, isTimeValid };
