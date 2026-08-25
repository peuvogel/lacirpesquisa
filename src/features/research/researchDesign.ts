import type { GroupTimeConfig, MapAnalysisGroup, PeriodScope } from '@/routes/mapas/mapAnalysisState';
import type { TerritoryRef } from '@/geo/types';
import type {
  ResearchDesign,
  ResearchPeriod,
  ResearchTerritory,
  SharedOrPerGroupPeriod,
  TerritoryGroup,
} from './types';

export interface ResearchDesignValidationError {
  code:
    | 'missing_group'
    | 'missing_territory'
    | 'missing_disease'
    | 'invalid_period'
    | 'missing_group_period'
    | 'mixed_geography';
  message: string;
}

export type ResearchDesignValidation =
  | { ok: true; value: ResearchDesign }
  | { ok: false; errors: ResearchDesignValidationError[] };

export function adaptTerritory(territory: TerritoryRef): ResearchTerritory {
  return {
    id: territory.ibgeCode,
    label: territory.name,
  };
}

export function adaptGroup(group: Pick<MapAnalysisGroup, 'id' | 'name' | 'territoryIds'>): TerritoryGroup {
  return {
    id: group.id,
    name: group.name,
    territories: group.territoryIds.map(adaptTerritory),
  };
}

export function adaptGroupTime(time: GroupTimeConfig): ResearchPeriod | null {
  if (time.mode === 'point' && time.point) return { mode: 'point', point: time.point };
  if (time.mode === 'range' && time.start && time.end) {
    return { mode: 'range', start: time.start, end: time.end };
  }
  if (time.mode === 'compare' && time.periodA && time.periodB) {
    return { mode: 'compare', periodA: time.periodA, periodB: time.periodB };
  }
  return null;
}

export function adaptPeriods(
  scope: PeriodScope,
  sharedTime: GroupTimeConfig,
  groups: Pick<MapAnalysisGroup, 'id' | 'time'>[],
): SharedOrPerGroupPeriod | null {
  if (scope === 'shared') {
    const time = adaptGroupTime(sharedTime);
    return time ? { scope, time } : null;
  }

  const timesByGroupId: Record<string, ResearchPeriod> = {};
  for (const group of groups) {
    const time = adaptGroupTime(group.time);
    if (!time) return null;
    timesByGroupId[group.id] = time;
  }
  return { scope: 'per_group', timesByGroupId };
}

function isValidYearMonth(value: string): boolean {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value);
  if (!match) return false;
  const month = match[2];
  return month === undefined || (Number(month) >= 1 && Number(month) <= 12);
}

function isValidPeriod(period: ResearchPeriod): boolean {
  if (period.mode === 'point') return isValidYearMonth(period.point);
  if (period.mode === 'range') {
    return (
      isValidYearMonth(period.start) &&
      isValidYearMonth(period.end) &&
      period.start <= period.end
    );
  }
  return isValidYearMonth(period.periodA) && isValidYearMonth(period.periodB) && period.periodA !== period.periodB;
}

export function validateResearchDesign(design: ResearchDesign): ResearchDesignValidation {
  const errors: ResearchDesignValidationError[] = [];
  if (design.groups.length === 0) {
    errors.push({ code: 'missing_group', message: 'Selecione ao menos um grupo territorial.' });
  }
  if (design.groups.some((group) => group.territories.length === 0)) {
    errors.push({ code: 'missing_territory', message: 'Cada grupo precisa conter ao menos um território.' });
  }
  if (design.diseaseIds.length === 0) {
    errors.push({ code: 'missing_disease', message: 'Selecione ao menos uma doença.' });
  }

  if (design.period.scope === 'shared') {
    if (!isValidPeriod(design.period.time)) {
      errors.push({ code: 'invalid_period', message: 'Informe um período válido.' });
    }
  } else {
    for (const group of design.groups) {
      const period = design.period.timesByGroupId[group.id];
      if (!period) {
        errors.push({ code: 'missing_group_period', message: `Informe o período do grupo ${group.name}.` });
      } else if (!isValidPeriod(period)) {
        errors.push({ code: 'invalid_period', message: `O período do grupo ${group.name} é inválido.` });
      }
    }
  }

  return errors.length === 0 ? { ok: true, value: design } : { ok: false, errors };
}

function normalizePeriod(period: ResearchPeriod): ResearchPeriod {
  if (period.mode === 'point') return { mode: period.mode, point: period.point };
  if (period.mode === 'range') return { mode: period.mode, start: period.start, end: period.end };
  return { mode: period.mode, periodA: period.periodA, periodB: period.periodB };
}

export function canonicalizeResearchDesign(design: ResearchDesign): string {
  const groups = [...design.groups]
    .map((group) => ({
      id: group.id,
      name: group.name,
      territories: [...group.territories]
        .map(({ id, label, parentId }) => ({ id, label, ...(parentId ? { parentId } : {}) }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const period =
    design.period.scope === 'shared'
      ? { scope: design.period.scope, time: normalizePeriod(design.period.time) }
      : {
          scope: design.period.scope,
          timesByGroupId: Object.fromEntries(
            Object.entries(design.period.timesByGroupId)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([groupId, time]) => [groupId, normalizePeriod(time)]),
          ),
        };
  const groupOutcomes = design.groupOutcomes
    ? Object.fromEntries(
        Object.entries(design.groupOutcomes)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([groupId, outcome]) => [groupId, {
            diseaseId: outcome.diseaseId,
            variableId: outcome.variableId,
          }]),
      )
    : undefined;

  return JSON.stringify({
    groups,
    geography: design.geography,
    locationBasis: design.locationBasis,
    diseaseIds: [...design.diseaseIds].sort((a, b) => a.localeCompare(b)),
    ...(groupOutcomes ? { groupOutcomes } : {}),
    period,
    ...(design.goal ? { goal: design.goal } : {}),
    ...(design.comparisonKind ? { comparisonKind: design.comparisonKind } : {}),
  });
}

function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintResearchDesign(design: ResearchDesign): string {
  return `research-design:${hash(canonicalizeResearchDesign(design))}`;
}
