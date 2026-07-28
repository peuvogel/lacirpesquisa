import { useCallback, useMemo, useReducer } from 'react';
import type { GeoLevel, MapViewState, TerritoryRef } from '@/geo/types';
import { suggestGroupName } from '@/geo/municipioNames';
import { resolvePresetTerritories, type RegionPresetId } from '@/geo/territoryCatalog';
import {
  getCatalogLabel,
  getCatalogTimeSeriesYears,
  getCatalogVariableById,
  getDefaultYearForVariable,
} from '@/features/catalog/catalogAnalysisData';
import { MAX_LOADABLE_SELECTION } from '@/features/catalog/buildSessionDataset';
import { MEASURES, catalogIdFor, parseCatalogId } from '@/features/catalog/taxonomy';

export type MapProvenance = 'catalog' | 'paste' | 'hybrid';

/** Enough for one group per UF (27) in didactic presets. */
export const MAX_GROUPS = 27;
/** Allow full-UF municipality sets (e.g. Bahia ~417 munis). */
export const MAX_TERRITORIES_PER_GROUP = 500;
export const MIN_YEAR = 1990;
export const MAX_YEAR = 2030;
export const CAPACITATION_MIN_YEAR = 2000;
export const CAPACITATION_MAX_YEAR = 2025;

export type TimeMode = 'point' | 'range' | 'compare';

/** Shared period for all groups, or each group keeps its own (pré × pós, etc.). */
export type PeriodScope = 'shared' | 'per-group';

/** Calendar year used to split pré / pós pandemia in the didactic helper. */
export const PANDEMIC_SPLIT_YEAR = 2020;

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
  /** Default / shared interval — also seeds new groups. */
  sharedTime: GroupTimeConfig;
  periodScope: PeriodScope;
}

export type MapAnalysisAction =
  | { type: 'CREATE_GROUP'; name?: string; territories?: TerritoryRef[] }
  | { type: 'RENAME_GROUP'; groupId: string; name: string }
  | { type: 'DELETE_GROUP'; groupId: string }
  | { type: 'MERGE_TERRITORIES_TO_GROUP'; groupId: string; territories: TerritoryRef[] }
  | { type: 'SET_ACTIVE_GROUP'; groupId: string | null }
  | { type: 'SET_GROUP_TIME'; groupId: string; time: GroupTimeConfig }
  | { type: 'SET_SHARED_TIME'; time: GroupTimeConfig }
  | { type: 'SET_PERIOD_SCOPE'; scope: PeriodScope }
  /** Didactic: two groups, same place, pré × pós pandemia (or mid-split). */
  | { type: 'PREPARE_PERIOD_COMPARE'; splitYear?: number }
  | { type: 'TOGGLE_GROUP_VARIABLE'; groupId: string; variableId: string }
  /** Disease selection is shared — applies to every group. */
  | { type: 'TOGGLE_DISEASE_ALL_GROUPS'; diseaseId: string }
  | { type: 'SET_MAP_VIEW'; mapView: MapViewState }
  | { type: 'MERGE_PRESET'; presetId: RegionPresetId; groupId?: string }
  | { type: 'APPLY_CATALOG_VARIABLE_IDS'; variableIds: string[] }
  | { type: 'REPLACE_STATE'; state: MapAnalysisState };

export function toRangeTime(startYear: number, endYear: number): GroupTimeConfig {
  const start = Math.min(startYear, endYear);
  const end = Math.max(startYear, endYear);
  return {
    mode: 'range',
    start: `${start}-01`,
    end: `${end}-12`,
    point: String(end),
  };
}

function cloneTime(time: GroupTimeConfig): GroupTimeConfig {
  return { ...time };
}

function withEraSuffix(name: string, era: string): string {
  const base = name.replace(/\s*[·•]\s*(Pré|Pós)-pandemia$/i, '').trim() || name;
  return `${base} · ${era}`;
}

/** Preferred loadable catalog id for a disease (Internações first when available). */
export function preferredCatalogIdForDisease(diseaseId: string): string {
  for (const measure of MEASURES) {
    const id = catalogIdFor(measure.id, diseaseId);
    if (getCatalogVariableById(id)?.loadable) return id;
  }
  return catalogIdFor('internacoes', diseaseId);
}

/** Disease×measure catalog ids from a reference group (for seeding new groups). */
function sharedDiseaseCatalogIds(state: MapAnalysisState): string[] {
  const ref =
    state.groups.find((g) => g.id === state.activeGroupId) ?? state.groups[0] ?? null;
  if (!ref) return [];
  return ref.variableIds.filter((id) => Boolean(parseCatalogId(id)));
}

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
  let sharedTime = state.sharedTime;
  groups = groups.map((g) => {
    if (g.id !== targetId) return g;
    const variableIds = [...new Set([...g.variableIds, ...resolved])];
    let time = g.time;
    if (!isTimeValid(time)) {
      const year = getDefaultYearForVariable(resolved[0]!);
      if (year !== null) {
        time = { mode: 'point', point: String(year) };
        sharedTime = time;
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
    sharedTime,
    provenance,
    mapView: { ...state.mapView, level: 'uf' as GeoLevel },
  };
}

let nextGroupCounter = 1;

function createEmptyGroup(name?: string, territories: TerritoryRef[] = []): MapAnalysisGroup {
  const n = nextGroupCounter++;
  const id = `group-${n}`;
  const autoName =
    name?.trim() ||
    (territories.length > 0 ? suggestGroupName(territories) : `Grupo ${n}`);
  return {
    id,
    name: autoName,
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
    sharedTime: { mode: 'point' },
    periodScope: 'shared',
  };
}

/**
 * Backfill fields added after session persistence (HMR / useSession).
 * Safe to call on any partial/legacy MapAnalysisState.
 */
export function normalizeMapAnalysisState(
  raw: Partial<MapAnalysisState> | null | undefined,
): MapAnalysisState {
  const base = createInitialMapAnalysisState();
  if (!raw) return base;

  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  const sharedFromGroup = groups.find((g) => g?.time && typeof g.time === 'object')?.time;
  const sharedTime: GroupTimeConfig =
    raw.sharedTime && typeof raw.sharedTime === 'object' && 'mode' in raw.sharedTime
      ? { ...raw.sharedTime }
      : sharedFromGroup
        ? { ...sharedFromGroup }
        : { mode: 'point' };

  return {
    groups,
    activeGroupId: raw.activeGroupId ?? null,
    mapView: raw.mapView ?? base.mapView,
    provenance: raw.provenance ?? base.provenance,
    sharedTime,
    periodScope: raw.periodScope === 'per-group' ? 'per-group' : 'shared',
  };
}

export function clampYear(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return '';
  const n = parseInt(trimmed, 10);
  return String(Math.min(MAX_YEAR, Math.max(MIN_YEAR, n)));
}

/** Compare period strings as year or YYYY-MM (lexicographic works for both). */
export function isRangeTimeInvalid(time: GroupTimeConfig | null | undefined): boolean {
  if (!time || time.mode !== 'range' || !time.start?.trim() || !time.end?.trim()) return false;
  return time.end.trim() < time.start.trim();
}

function isTimeValid(time: GroupTimeConfig | null | undefined): boolean {
  if (!time || typeof time !== 'object' || !time.mode) return false;
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
  if (t.level === 'municipio') return t.name || t.ibgeCode;
  return t.sigla ?? t.name;
}

export function mapAnalysisReducer(state: MapAnalysisState, action: MapAnalysisAction): MapAnalysisState {
  state = normalizeMapAnalysisState(state);
  switch (action.type) {
    case 'CREATE_GROUP': {
      if (state.groups.length >= MAX_GROUPS) return state;
      const seedDiseases = sharedDiseaseCatalogIds(state);
      const base = createEmptyGroup(action.name, action.territories ?? []);
      const group = {
        ...base,
        time: cloneTime(state.sharedTime),
        variableIds: seedDiseases.length > 0 ? [...seedDiseases] : base.variableIds,
      };
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

    case 'SET_GROUP_TIME': {
      // In shared scope, editing any group period updates everyone.
      if (state.periodScope === 'shared') {
        return {
          ...state,
          sharedTime: cloneTime(action.time),
          groups: state.groups.map((g) => ({ ...g, time: cloneTime(action.time) })),
        };
      }
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId ? { ...g, time: action.time } : g,
        ),
      };
    }

    case 'SET_SHARED_TIME': {
      const time = cloneTime(action.time);
      if (state.periodScope === 'shared') {
        return {
          ...state,
          sharedTime: time,
          groups: state.groups.map((g) => ({ ...g, time: cloneTime(time) })),
        };
      }
      return { ...state, sharedTime: time };
    }

    case 'SET_PERIOD_SCOPE': {
      if (action.scope === state.periodScope) return state;
      if (action.scope === 'shared') {
        const active = state.groups.find((g) => g.id === state.activeGroupId);
        const shared =
          active && isTimeValid(active.time) ? cloneTime(active.time) : cloneTime(state.sharedTime);
        return {
          ...state,
          periodScope: 'shared',
          sharedTime: shared,
          groups: state.groups.map((g) => ({ ...g, time: cloneTime(shared) })),
        };
      }
      return { ...state, periodScope: 'per-group' };
    }

    case 'PREPARE_PERIOD_COMPARE': {
      if (state.groups.length === 0) return state;
      const splitYear = action.splitYear ?? PANDEMIC_SPLIT_YEAR;
      const ref =
        state.groups.find((g) => g.id === state.activeGroupId) ?? state.groups[0]!;

      let years: number[] = [];
      for (const id of ref.variableIds) {
        if (!parseCatalogId(id)) continue;
        const ys = getCatalogTimeSeriesYears(id);
        if (ys.length === 0) continue;
        years = years.length === 0 ? [...ys] : years.filter((y) => ys.includes(y));
      }
      years = [...new Set(years)].sort((a, b) => a - b);

      let before = years.filter((y) => y < splitYear);
      let after = years.filter((y) => y >= splitYear);
      if (before.length === 0 && after.length === 0) {
        before = [2015, 2016, 2017, 2018, 2019];
        after = [2020, 2021, 2022, 2023];
      } else if (before.length === 0 || after.length === 0) {
        const mid = Math.max(1, Math.floor(years.length / 2));
        before = years.slice(0, mid);
        after = years.slice(mid);
        if (after.length === 0) after = [years[years.length - 1]!];
        if (before.length === 0) before = [years[0]!];
      }

      const timeA = toRangeTime(before[0]!, before[before.length - 1]!);
      const timeB = toRangeTime(after[0]!, after[after.length - 1]!);

      let groups: MapAnalysisGroup[];
      if (state.groups.length === 1) {
        const cloneBase = createEmptyGroup(undefined, [...ref.territoryIds]);
        const clone: MapAnalysisGroup = {
          ...cloneBase,
          variableIds: [...ref.variableIds],
          time: timeB,
          name: withEraSuffix(ref.name, 'Pós-pandemia'),
        };
        groups = [
          { ...ref, time: timeA, name: withEraSuffix(ref.name, 'Pré-pandemia') },
          clone,
        ];
      } else {
        const idxA = Math.max(
          0,
          state.groups.findIndex((g) => g.id === ref.id),
        );
        const idxB = state.groups.findIndex((_, i) => i !== idxA);
        groups = state.groups.map((g, i) => {
          if (i === idxA) {
            return { ...g, time: timeA, name: withEraSuffix(g.name, 'Pré-pandemia') };
          }
          if (i === idxB) {
            return {
              ...g,
              time: timeB,
              name: withEraSuffix(g.name, 'Pós-pandemia'),
              territoryIds:
                g.territoryIds.length === 0 ? [...ref.territoryIds] : g.territoryIds,
              variableIds:
                g.variableIds.length === 0 ? [...ref.variableIds] : g.variableIds,
            };
          }
          return g;
        });
      }

      return {
        ...state,
        periodScope: 'per-group',
        sharedTime: cloneTime(timeA),
        groups,
        activeGroupId: groups[0]?.id ?? state.activeGroupId,
      };
    }

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

    case 'TOGGLE_DISEASE_ALL_GROUPS': {
      if (state.groups.length === 0) return state;
      const { diseaseId } = action;
      const anyHas = state.groups.some((g) =>
        g.variableIds.some((id) => parseCatalogId(id)?.diseaseId === diseaseId),
      );
      const preferred = preferredCatalogIdForDisease(diseaseId);
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (anyHas) {
            return {
              ...g,
              variableIds: g.variableIds.filter(
                (id) => parseCatalogId(id)?.diseaseId !== diseaseId,
              ),
            };
          }
          if (g.variableIds.some((id) => parseCatalogId(id)?.diseaseId === diseaseId)) {
            return g;
          }
          return { ...g, variableIds: [...g.variableIds, preferred] };
        }),
      };
    }

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
      return normalizeMapAnalysisState(action.state);

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
export function formatTimeSummary(time: GroupTimeConfig | null | undefined): string {
  if (!time?.mode) return '';
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

  // Empty / ungrouped-only: no instructional strip (selection lives on the map + groups).
  if (!hasGroups) {
    return {
      mode: hasUngrouped ? 'partial' : 'empty',
      headline: '',
      chips: ungroupedLabels.map((label) => ({ label, kind: 'territory' as const })),
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
    normalizeMapAnalysisState(initialState),
  );

  // HMR / session may keep a pre-sharedTime shape; never expose raw gaps to UI.
  const safeState = useMemo(() => normalizeMapAnalysisState(state), [state]);

  const derived = useMemo(() => deriveMapAnalysis(safeState), [safeState]);

  const commit = useCallback((next: MapAnalysisState) => {
    dispatch({ type: 'REPLACE_STATE', state: next });
  }, []);

  return { state: safeState, dispatch, commit, derived };
}

export { isGroupComplete, isTimeValid };
