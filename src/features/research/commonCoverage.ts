import type { AnalysisCell, ResearchDesign, ResearchPeriod } from './types';

export type CommonCoverageState =
  | 'no_restriction'
  | 'restricted'
  | 'no_common_support';

export interface CommonCoverageDiagnostic {
  variableId: string;
  state: CommonCoverageState;
  candidatePeriodKeys: string[];
  commonPeriodKeys: string[];
  excludedPeriodKeys: string[];
  expectedUnitCount: number;
  missingUnitsByPeriod: Record<string, string[]>;
}

export interface CommonCoverageResult {
  state: CommonCoverageState;
  cells: AnalysisCell[];
  diagnostics: CommonCoverageDiagnostic[];
  explanation: string;
}

export interface CommonCoverageInput {
  design: ResearchDesign;
  cells: readonly AnalysisCell[];
  /** Defaults to every variable represented in `cells`. */
  variableIds?: readonly string[];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function usable(cell: AnalysisCell): boolean {
  return (
    cell.analyticStatus === 'include' &&
    (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero') &&
    typeof cell.rawValue === 'number' &&
    Number.isFinite(cell.rawValue)
  );
}

function unitKey(groupId: string, territoryId: string): string {
  return `${groupId}|${territoryId}`;
}

function expectedUnits(design: ResearchDesign): string[] {
  return uniqueSorted(
    design.groups.flatMap((group) =>
      group.territories.map((territory) => unitKey(group.id, territory.id)),
    ),
  );
}

type PeriodPrecision = 'year' | 'month';

function periodPrecision(cells: readonly AnalysisCell[], design: ResearchDesign): PeriodPrecision {
  const represented = cells.map((cell) => cell.periodKey);
  if (represented.some((key) => /^\d{4}-\d{2}$/.test(key))) return 'month';
  if (represented.some((key) => /^\d{4}$/.test(key))) return 'year';

  const values = design.period.scope === 'shared'
    ? periodValues(design.period.time)
    : Object.values(design.period.timesByGroupId).flatMap(periodValues);
  return values.some((value) => /^\d{4}-\d{2}$/.test(value)) ? 'month' : 'year';
}

function periodValues(period: ResearchPeriod): string[] {
  if (period.mode === 'point') return [period.point];
  if (period.mode === 'compare') return [period.periodA, period.periodB];
  return [period.start, period.end];
}

function normalizedPeriod(value: string, precision: PeriodPrecision): string | null {
  const match = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(value);
  if (!match) return null;
  if (precision === 'year') return match[1]!;
  return `${match[1]}-${match[2] ?? '01'}`;
}

function expandPeriod(period: ResearchPeriod, precision: PeriodPrecision): string[] {
  if (period.mode !== 'range') {
    return uniqueSorted(periodValues(period).flatMap((value) => {
      const normalized = normalizedPeriod(value, precision);
      return normalized ? [normalized] : [];
    }));
  }

  const start = normalizedPeriod(period.start, precision);
  const end = normalizedPeriod(period.end, precision);
  if (!start || !end || start > end) return [];
  if (precision === 'year') {
    const first = Number(start);
    const last = Number(end);
    return Array.from({ length: last - first + 1 }, (_, index) => String(first + index));
  }

  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  const first = startYear! * 12 + startMonth! - 1;
  const last = endYear! * 12 + endMonth! - 1;
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const cursor = first + index;
    const year = Math.floor(cursor / 12);
    const month = (cursor % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
}

function candidatePeriods(design: ResearchDesign, cells: readonly AnalysisCell[]): string[] {
  const precision = periodPrecision(cells, design);
  const declared = design.period.scope === 'shared'
    ? expandPeriod(design.period.time, precision)
    : Object.values(design.period.timesByGroupId).flatMap((period) =>
        expandPeriod(period, precision),
      );
  const represented = cells.map((cell) => cell.periodKey);
  return uniqueSorted(declared.length > 0 ? declared : represented);
}

function diagnosticFor(
  variableId: string,
  cells: readonly AnalysisCell[],
  units: readonly string[],
  periodKeys: readonly string[],
): CommonCoverageDiagnostic {
  const usableUnitsByPeriod = new Map<string, Set<string>>();
  for (const cell of cells) {
    if (cell.variableId !== variableId || !usable(cell)) continue;
    const periodUnits = usableUnitsByPeriod.get(cell.periodKey) ?? new Set<string>();
    periodUnits.add(unitKey(cell.groupId, cell.territoryId));
    usableUnitsByPeriod.set(cell.periodKey, periodUnits);
  }

  const missingUnitsByPeriod: Record<string, string[]> = {};
  const commonPeriodKeys: string[] = [];
  for (const periodKey of periodKeys) {
    const present = usableUnitsByPeriod.get(periodKey) ?? new Set<string>();
    const missing = units.filter((unit) => !present.has(unit));
    if (units.length > 0 && missing.length === 0) {
      commonPeriodKeys.push(periodKey);
    } else {
      missingUnitsByPeriod[periodKey] = missing.length > 0 ? missing : ['nenhuma_unidade_esperada'];
    }
  }
  const common = new Set(commonPeriodKeys);
  const excludedPeriodKeys = periodKeys.filter((periodKey) => !common.has(periodKey));
  const state: CommonCoverageState = commonPeriodKeys.length === 0
    ? 'no_common_support'
    : excludedPeriodKeys.length === 0
      ? 'no_restriction'
      : 'restricted';

  return {
    variableId,
    state,
    candidatePeriodKeys: [...periodKeys],
    commonPeriodKeys,
    excludedPeriodKeys,
    expectedUnitCount: units.length,
    missingUnitsByPeriod,
  };
}

function explain(diagnostics: readonly CommonCoverageDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'Nenhuma variável foi informada para avaliar a cobertura comum.';
  }
  const unsupported = diagnostics.filter((item) => item.state === 'no_common_support');
  if (unsupported.length > 0) {
    return `Não existe suporte temporal comum em todos os grupos e territórios esperados para: ${unsupported
      .map((item) => item.variableId)
      .join(', ')}. Nenhum valor foi imputado.`;
  }
  const restricted = diagnostics.filter((item) => item.state === 'restricted');
  if (restricted.length > 0) {
    return restricted.map((item) =>
      `${item.variableId}: suporte comum ${item.commonPeriodKeys.join(', ')}; períodos excluídos ${item.excludedPeriodKeys.join(', ')}.`,
    ).join(' ');
  }
  return 'A cobertura comum já coincide com todos os períodos avaliados; nenhuma restrição é necessária.';
}

/**
 * Selects the temporal support observed in every expected group/territory, independently for
 * each variable. This is a sensitivity subset only: it never imputes values or classifies the
 * missingness mechanism.
 */
export function selectCommonCoverage(input: CommonCoverageInput): CommonCoverageResult {
  const variables = uniqueSorted(input.variableIds ?? input.cells.map((cell) => cell.variableId));
  const units = expectedUnits(input.design);
  const periods = candidatePeriods(input.design, input.cells);
  const diagnostics = variables.map((variableId) =>
    diagnosticFor(variableId, input.cells, units, periods),
  );
  const commonByVariable = new Map(
    diagnostics.map((item) => [item.variableId, new Set(item.commonPeriodKeys)]),
  );
  const selectedVariables = new Set(variables);
  const cells = input.cells.filter((cell) =>
    selectedVariables.has(cell.variableId) &&
    commonByVariable.get(cell.variableId)?.has(cell.periodKey),
  );
  const state: CommonCoverageState = diagnostics.some((item) => item.state === 'no_common_support')
    ? 'no_common_support'
    : diagnostics.some((item) => item.state === 'restricted')
      ? 'restricted'
      : 'no_restriction';

  return { state, cells, diagnostics, explanation: explain(diagnostics) };
}
