import { useCallback, useMemo, useReducer } from 'react';
import type { GeoLevel, MapViewState, TerritoryRef } from '@/geo/types';
import { resolvePresetTerritories, type RegionPresetId } from '@/geo/territoryCatalog';
import {
  getCatalogLabel,
  getCatalogVariableById,
  getDefaultYearForVariable,
} from '@/features/catalog/catalogAnalysisData';
import { MAX_LOADABLE_SELECTION } from '@/features/catalog/buildSessionDataset';

export type MapProvenance = 'catalog' | 'paste' | 'hybrid';

export const MAX_GROUPS = 10;
export const MAX_TERRITORIES_PER_GROUP = 27;
export const MIN_YEAR = 1990;
export const MAX_YEAR = 2030;
export const CAPACITATION_MIN_YEAR = 2000;
export const CAPACITATION_MAX_YEAR = 2025;

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
  provenance: MapProvenance;
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
  | { type: 'APPLY_CATALOG_VARIABLE_IDS'; variableIds: string[] }
  | { type: 'REPLACE_STATE'; state: MapAnalysisState };

/**
 * Resolve navigate-state catalog IDs to known loadable catalog entries (T-05-12).
 * Unknown / reference-only IDs are ignored; selection is capped (T-05-13).
 */
export function resolveCatalogHandoffIds(rawIds: string[]): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawIds) {
    const entry = getCatalogVariableById(raw);
    if (!entry?.loadable) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    resolved.push(entry.id);
    if (resolved.length >= MAX_LOADABLE_SELECTION) break;
  }
  return resolved;
}

/** Merge Variáveis → Mapas handoff IDs into active group (D-15). */
export function applyCatalogVariableIds(
  state: MapAnalysisState,
  rawIds: string[],
): MapAnalysisState {
  const resolved = resolveCatalogHandoffIds(rawIds);
  if (resolved.length === 0) return state;

  let groups = [...state.groups];
  let activeGroupId = state.activeGroupId;
  const active = groups.find((g) => g.id === activeGroupId) ?? null;

  if (!active) {
    if (groups.length >= MAX_GROUPS) return state;
    const group = createEmptyGroup('Catálogo');
    groups = [...groups, group];
    activeGroupId = group.id;
  }

  const targetId = activeGroupId!;
  groups = groups.map((g) => {
    if (g.id !== targetId) return g;
    const variableIds = [...new Set([...g.variableIds, ...resolved])];
    let time = g.time;
    if (!isTimeValid(time)) {
      const year = getDefaultYearForVariable(resolved[0]!);
      if (year !== null) {
        time = { mode: 'point', point: String(year) };
      }
    }
    return { ...g, variableIds, time };
  });

  const provenance: MapProvenance =
    state.provenance === 'paste' || state.provenance === 'hybrid' ? 'hybrid' : 'catalog';

  return {
    ...state,
    groups,
    activeGroupId: targetId,
    provenance,
    mapView: { ...state.mapView, level: 'uf' as GeoLevel },
  };
}

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
    provenance: 'catalog',
  };
}

export function clampYear(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return '';
  const n = parseInt(trimmed, 10);
  return String(Math.min(MAX_YEAR, Math.max(MIN_YEAR, n)));
}

export function isRangeTimeInvalid(time: GroupTimeConfig): boolean {
  if (time.mode !== 'range' || !time.start?.trim() || !time.end?.trim()) return false;
  const start = parseInt(time.start, 10);
  const end = parseInt(time.end, 10);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return end < start;
}

function isTimeValid(time: GroupTimeConfig): boolean {
  switch (time.mode) {
    case 'point':
      return Boolean(time.point?.trim());
    case 'range':
      return Boolean(time.start?.trim() && time.end?.trim() && !isRangeTimeInvalid(time));
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
      if (merged.length >= MAX_TERRITORIES_PER_GROUP) break;
    }
  }
  return merged.slice(0, MAX_TERRITORIES_PER_GROUP);
}

function territoryLabel(t: TerritoryRef): string {
  return t.sigla ?? t.name;
}

export function mapAnalysisReducer(state: MapAnalysisState, action: MapAnalysisAction): MapAnalysisState {
  switch (action.type) {
    case 'CREATE_GROUP': {
      if (state.groups.length >= MAX_GROUPS) return state;
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

    case 'APPLY_CATALOG_VARIABLE_IDS':
      return applyCatalogVariableIds(state, action.variableIds);

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

export type SelectionSummaryMode = 'empty' | 'partial' | 'complete';

export interface SelectionSummary {
  mode: SelectionSummaryMode;
  headline: string;
  hint?: string;
  sentence?: string;
  chips: SummaryChip[];
}

/** Plain-PT time segment for summary strip and handoff (Wave 6). */
export function formatTimeSummary(time: GroupTimeConfig): string {
  switch (time.mode) {
    case 'point':
      return time.point?.trim() ?? '';
    case 'range':
      if (time.start?.trim() && time.end?.trim()) {
        return `${time.start}–${time.end}`;
      }
      return '';
    case 'compare':
      if (time.periodA?.trim() && time.periodB?.trim()) {
        return `${time.periodA} vs ${time.periodB}`;
      }
      return '';
    default:
      return '';
  }
}

function collectGroupTerritoryLabels(state: MapAnalysisState): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const group of state.groups) {
    for (const t of group.territoryIds) {
      const label = territoryLabel(t);
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

function collectVariableLabels(state: MapAnalysisState): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const group of state.groups) {
    for (const id of group.variableIds) {
      const label = getCatalogLabel(id);
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

function collectTimeSummaries(state: MapAnalysisState): string[] {
  const summaries: string[] = [];
  for (const group of state.groups) {
    if (isTimeValid(group.time)) {
      summaries.push(formatTimeSummary(group.time));
    }
  }
  return [...new Set(summaries)];
}

export function deriveSelectionSummary(
  state: MapAnalysisState,
  ungroupedTerritories: TerritoryRef[] = [],
): SelectionSummary {
  const territoryLabels = collectGroupTerritoryLabels(state);
  const ungroupedLabels = ungroupedTerritories.map(territoryLabel);
  const allTerritoryLabels = [...new Set([...territoryLabels, ...ungroupedLabels])];
  const groupCount = state.groups.length;
  const timeSummaries = collectTimeSummaries(state);
  const variableLabels = collectVariableLabels(state);

  const hasGroups = groupCount > 0;
  const hasUngrouped = ungroupedTerritories.length > 0;
  const hasCompleteShape =
    hasGroups &&
    territoryLabels.length > 0 &&
    state.groups.every((g) => g.territoryIds.length > 0 && isTimeValid(g.time) && g.variableIds.length > 0);

  if (!hasGroups && !hasUngrouped) {
    return {
      mode: 'empty',
      headline: 'Nada selecionado ainda',
      hint: 'Clique nos estados no mapa para começar. Depois forme grupos e escolha período e agravos.',
      chips: [],
    };
  }

  if (hasCompleteShape) {
    const segments = [
      territoryLabels.join(', '),
      groupCount === 1 ? '1 grupo' : `${groupCount} grupos`,
      timeSummaries.join(', '),
      variableLabels.join(', '),
    ].filter(Boolean);
    const sentence = segments.join(' · ');
    const chips: SummaryChip[] = [
      { label: territoryLabels.join(', '), kind: 'territory' },
      { label: groupCount === 1 ? '1 grupo' : `${groupCount} grupos`, kind: 'group' },
      ...timeSummaries.map((label) => ({ label, kind: 'time' as const })),
      ...variableLabels.map((label) => ({ label, kind: 'variable' as const })),
    ];
    return { mode: 'complete', headline: sentence, sentence, chips };
  }

  if (hasUngrouped && !hasGroups) {
    const count = ungroupedTerritories.length;
    return {
      mode: 'partial',
      headline: `${count} estado(s) selecionado(s)`,
      hint: 'Crie um grupo para definir período e doenças.',
      chips: ungroupedLabels.map((label) => ({ label, kind: 'territory' })),
    };
  }

  const partialHeadline =
    allTerritoryLabels.length > 0
      ? `${allTerritoryLabels.length} território(s) · ${groupCount} grupo(s)`
      : `${groupCount} grupo(s)`;

  return {
    mode: 'partial',
    headline: partialHeadline,
    hint: 'Complete período e variáveis em todos os grupos.',
    chips: [
      ...allTerritoryLabels.map((label) => ({ label, kind: 'territory' as const })),
      { label: groupCount === 1 ? '1 grupo' : `${groupCount} grupos`, kind: 'group' },
    ],
  };
}

function buildSummaryChips(state: MapAnalysisState): SummaryChip[] {
  return deriveSelectionSummary(state).chips;
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
  const canReview =
    state.groups.length > 0 && state.groups.every(isGroupComplete);
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
