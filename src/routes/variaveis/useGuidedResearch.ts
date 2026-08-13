import { useEffect, useMemo, useState } from 'react';
import { aggregatePeriod } from '@/features/research/aggregatePeriod';
import { summarizeAvailability, type AvailabilitySummary } from '@/features/research/availability';
import {
  selectCommonCoverage,
  type CommonCoverageDiagnostic,
  type CommonCoverageState,
} from '@/features/research/commonCoverage';
import { evaluateTestsForSelection } from '@/features/research/eligibility';
import { profileVariable, type VariableProfileResult } from '@/features/research/profiling';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import { createRecommendedScenario } from '@/features/research/scenarios';
import {
  loadResearchCells,
  type ResearchDataSnapshot,
  type ResearchSourceCell,
} from '@/features/research/supabaseResearchRepository';
import type {
  AnalysisCell,
  AnalysisScenario,
  ResearchDesign,
  SourceCellStatus,
  VariableProfile,
  VariableType,
} from '@/features/research/types';
import { VARIABLE_PROFILES } from '@/features/research/variableProfiles';
import { analysisCellKey, recommendZeroPolicy } from '@/features/research/zeroPolicy';
import { TEST_REGISTRY } from '@/features/tests/registry';
import type {
  DataProfileViewModel,
  EligibleTestViewModel,
  GuidedResearchSelection,
  GuidedVariableViewModel,
} from './guidedViewModels';
import {
  buildHospitalOutcomeContingency,
  type HospitalOutcomeContingency,
} from './hospitalOutcomeContingency';

const POPULATION_PROFILE: VariableProfile = {
  variableId: 'populacao',
  label: 'População-exposição',
  variableType: 'numeric',
  unit: 'pessoas-ano',
  temporalAggregation: 'sum',
};

const TYPE_LABELS: Record<VariableType, string> = {
  count: 'Contagem',
  rate: 'Taxa',
  numeric: 'Numérica',
  categorical: 'Categórica',
  ordinal: 'Ordinal',
};

const STATUS_PRIORITY: SourceCellStatus[] = [
  'not_queried',
  'missing',
  'suppressed',
  'not_applicable',
  'observed',
  'collection_zero',
];

const AVAILABILITY_STATUS_LABELS: Record<SourceCellStatus, string> = {
  observed: 'valor inválido',
  collection_zero: 'zero inválido',
  missing: 'dados ausentes',
  suppressed: 'dado suprimido',
  not_applicable: 'não aplicável',
  not_queried: 'não consultado',
};

type ResearchLoader = typeof loadResearchCells;

export interface GuidedResearchData {
  design: ResearchDesign;
  variables: GuidedVariableViewModel[];
  availabilityByVariableId: Record<string, AvailabilitySummary>;
  annualCells: AnalysisCell[];
  analyticCells: AnalysisCell[];
  sourceCells: AnalysisCell[];
  recoverableMessages: string[];
}

export interface CommonCoverageScenarioBuild {
  state: CommonCoverageState;
  scenario: AnalysisScenario | null;
  diagnostics: CommonCoverageDiagnostic[];
  explanation: string;
}

export interface GuidedSelectionModel {
  profilesByVariableId: Record<string, DataProfileViewModel>;
  eligibility: EligibleTestViewModel[];
  decisions: ReturnType<typeof evaluateTestsForSelection>;
  scenario: AnalysisScenario;
  reviewsResolved: boolean;
  effectiveRoles: Record<string, string>;
  contingency: HospitalOutcomeContingency | null;
}

export interface UseGuidedResearchResult {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  variables?: GuidedVariableViewModel[];
  profilesByVariableId?: Record<string, DataProfileViewModel>;
  eligibility?: EligibleTestViewModel[];
  scenario: AnalysisScenario | null;
  decisions: ReturnType<typeof evaluateTestsForSelection>;
  reviewsResolved: boolean;
  effectiveRoles: Record<string, string>;
  recoverableMessages: string[];
  data?: GuidedResearchData;
  contingency?: HospitalOutcomeContingency | null;
}

function finiteSource(cell: ResearchSourceCell): cell is ResearchSourceCell & { rawValue: number } {
  return (
    (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero')
    && typeof cell.rawValue === 'number'
    && Number.isFinite(cell.rawValue)
  );
}

function sourceGroupKey(cell: ResearchSourceCell): string {
  return JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey, cell.variableId]);
}

function collapseDiseases(cells: readonly ResearchSourceCell[]): AnalysisCell[] {
  const groups = new Map<string, ResearchSourceCell[]>();
  for (const cell of cells) {
    groups.set(sourceGroupKey(cell), [...(groups.get(sourceGroupKey(cell)) ?? []), cell]);
  }

  return [...groups.values()].map((group): AnalysisCell => {
    const first = group[0]!;
    const invalid = STATUS_PRIORITY.find((status) =>
      group.some((cell) => cell.sourceStatus === status && !finiteSource(cell)),
    );
    if (invalid) {
      return {
        territoryId: first.territoryId,
        groupId: first.groupId,
        periodKey: first.periodKey,
        variableId: first.variableId,
        rawValue: null,
        sourceStatus: invalid,
        analyticStatus: 'exclude_missing',
        reasonCode: 'source_unavailable',
      };
    }

    const values = group.filter(finiteSource).map((cell) => cell.rawValue);
    if (values.length !== group.length) {
      return {
        territoryId: first.territoryId,
        groupId: first.groupId,
        periodKey: first.periodKey,
        variableId: first.variableId,
        rawValue: null,
        sourceStatus: 'missing',
        analyticStatus: 'exclude_missing',
        reasonCode: 'incomplete_disease_coverage',
      };
    }

    const populationValues = [...new Set(values)];
    const rawValue = first.variableId === 'populacao'
      ? (populationValues.length === 1 ? populationValues[0]! : null)
      : values.reduce((sum, value) => sum + value, 0);
    if (rawValue === null) {
      return {
        territoryId: first.territoryId,
        groupId: first.groupId,
        periodKey: first.periodKey,
        variableId: first.variableId,
        rawValue: null,
        sourceStatus: 'missing',
        analyticStatus: 'exclude_missing',
        reasonCode: 'inconsistent_population',
      };
    }
    return {
      territoryId: first.territoryId,
      groupId: first.groupId,
      periodKey: first.periodKey,
      variableId: first.variableId,
      rawValue,
      sourceStatus: group.every((cell) => cell.sourceStatus === 'collection_zero')
        ? 'collection_zero'
        : 'observed',
      analyticStatus: 'include',
    };
  }).sort((left, right) =>
    left.groupId.localeCompare(right.groupId)
    || left.territoryId.localeCompare(right.territoryId)
    || left.periodKey.localeCompare(right.periodKey)
    || left.variableId.localeCompare(right.variableId));
}

function scopeKey(cell: Pick<AnalysisCell, 'groupId' | 'territoryId' | 'periodKey'>): string {
  return JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey]);
}

function categoricalCell(cells: AnalysisCell[], profile: VariableProfile): AnalysisCell {
  const first = cells[0]!;
  const admissionsCells = cells.filter((cell) => cell.variableId === 'internacoes');
  const deathCells = cells.filter((cell) => cell.variableId === 'obitos');
  const admissions = admissionsCells.reduce((sum, cell) => sum + (cell.rawValue ?? 0), 0);
  const deaths = deathCells.reduce((sum, cell) => sum + (cell.rawValue ?? 0), 0);
  const usable = admissionsCells.length > 0
    && deathCells.length === admissionsCells.length
    && admissionsCells.every((cell) => cell.analyticStatus === 'include' && typeof cell.rawValue === 'number')
    && deathCells.every((cell) => cell.analyticStatus === 'include' && typeof cell.rawValue === 'number')
    && admissions > 0
    && deaths >= 0
    && deaths <= admissions;
  return {
    territoryId: first.territoryId,
    groupId: first.groupId,
    periodKey: first.periodKey,
    variableId: profile.variableId,
    rawValue: usable ? admissions : null,
    sourceStatus: usable ? 'observed' : 'not_applicable',
    analyticStatus: usable ? 'include' : 'exclude_missing',
    ...(usable ? {} : { reasonCode: 'invalid_categorical_components' }),
  };
}

function deriveCell(cells: AnalysisCell[], profile: VariableProfile): AnalysisCell {
  if (profile.variableType === 'categorical') return categoricalCell(cells, profile);
  const first = cells[0]!;
  const result = aggregatePeriod(cells, profile);
  const usable = result.value !== null
    && (result.status === 'observed' || result.status === 'collection_zero');
  return {
    territoryId: first.territoryId,
    groupId: first.groupId,
    periodKey: first.periodKey,
    variableId: profile.variableId,
    rawValue: result.value,
    sourceStatus: result.status,
    analyticStatus: usable ? 'include' : 'exclude_missing',
    ...(result.reason ? { reasonCode: result.reason.code } : {}),
  };
}

function groupByScope(cells: readonly AnalysisCell[]): Map<string, AnalysisCell[]> {
  const grouped = new Map<string, AnalysisCell[]>();
  for (const cell of cells) {
    grouped.set(scopeKey(cell), [...(grouped.get(scopeKey(cell)) ?? []), cell]);
  }
  return grouped;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function withZeroPolicy(
  cells: AnalysisCell[],
  sourceCells: AnalysisCell[],
  profile: VariableProfile,
  geography: ResearchDesign['geography'],
): AnalysisCell[] {
  if (profile.variableType !== 'count' && profile.variableType !== 'rate') return cells;
  const positive = cells
    .map((cell) => cell.rawValue)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const rareVariable = profile.variableType === 'count' && (median(positive) ?? 0) < 20;
  const sourceByScopeAndVariable = new Map(
    sourceCells.map((cell) => [`${scopeKey(cell)}\u0000${cell.variableId}`, cell]),
  );
  const exposures: Record<string, number> = {};
  const numeratorEvents: Record<string, number> = {};
  for (const cell of cells) {
    const population = sourceByScopeAndVariable.get(`${scopeKey(cell)}\u0000populacao`);
    if (typeof population?.rawValue === 'number' && population.rawValue > 0) {
      exposures[analysisCellKey(cell)] = population.rawValue;
    }
    if (profile.numeratorVariableId) {
      const numerator = sourceByScopeAndVariable.get(`${scopeKey(cell)}\u0000${profile.numeratorVariableId}`);
      if (typeof numerator?.rawValue === 'number' && numerator.rawValue >= 0) {
        numeratorEvents[analysisCellKey(cell)] = numerator.rawValue;
      }
    }
  }
  return cells.map((cell) => cell.rawValue === 0
    ? recommendZeroPolicy({
        targetCell: cell,
        cells,
        profile,
        geography,
        rareVariable,
        exposures,
        numeratorEvents,
      }).cell
    : cell);
}

function annualProfileCells(
  sourceCells: AnalysisCell[],
  profiles: readonly VariableProfile[],
  geography: ResearchDesign['geography'],
): AnalysisCell[] {
  const byScope = groupByScope(sourceCells);
  return profiles.flatMap((profile) => {
    const derived = [...byScope.values()].map((cells) => deriveCell(cells, profile));
    return withZeroPolicy(derived, sourceCells, profile, geography);
  });
}

function rangeYears(design: ResearchDesign, groupId: string): number[] {
  const period = design.period.scope === 'shared'
    ? design.period.time
    : design.period.timesByGroupId[groupId];
  if (!period) return [];
  const year = (value: string) => Number(value.slice(0, 4));
  if (period.mode === 'point') return [year(period.point)];
  if (period.mode === 'compare') return [year(period.periodA), year(period.periodB)].sort();
  const start = year(period.start);
  const end = year(period.end);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function shouldKeepAnnualSeries(design: ResearchDesign): boolean {
  const territories = new Set(design.groups.flatMap((group) => group.territories.map((item) => item.id)));
  if (territories.size !== 1 || design.groups.length !== 1) return false;
  return rangeYears(design, design.groups[0]!.id).length >= 8;
}

function aggregateAnalyticCells(
  design: ResearchDesign,
  sourceCells: AnalysisCell[],
  annual: AnalysisCell[],
  profiles: readonly VariableProfile[],
): AnalysisCell[] {
  const isRange = design.groups.some((group) => {
    const period = design.period.scope === 'shared'
      ? design.period.time
      : design.period.timesByGroupId[group.id];
    return period?.mode === 'range';
  });
  if (!isRange || shouldKeepAnnualSeries(design)) return annual;

  const unitGroups = new Map<string, AnalysisCell[]>();
  for (const cell of sourceCells) {
    const key = JSON.stringify([cell.groupId, cell.territoryId]);
    unitGroups.set(key, [...(unitGroups.get(key) ?? []), cell]);
  }
  const annualByUnitVariable = new Map<string, AnalysisCell[]>();
  for (const cell of annual) {
    const key = JSON.stringify([cell.groupId, cell.territoryId, cell.variableId]);
    annualByUnitVariable.set(key, [...(annualByUnitVariable.get(key) ?? []), cell]);
  }

  return [...profiles, POPULATION_PROFILE].flatMap((profile) => [...unitGroups.values()].map((cells) => {
    const first = cells[0]!;
    const base = deriveCell(cells, profile);
    const annualStatus = annualByUnitVariable.get(
      JSON.stringify([first.groupId, first.territoryId, profile.variableId]),
    ) ?? [];
    const review = annualStatus.find((cell) => cell.analyticStatus === 'requires_review');
    const excluded = annualStatus.find((cell) => cell.analyticStatus === 'exclude_suspected_noncollection');
    return {
      ...base,
      periodKey: String(rangeYears(design, first.groupId)[0] ?? first.periodKey),
      ...(review
        ? { analyticStatus: 'requires_review' as const, reasonCode: review.reasonCode }
        : excluded
          ? { analyticStatus: 'exclude_suspected_noncollection' as const, reasonCode: excluded.reasonCode }
          : {}),
    };
  }));
}

function sourceMethod(profile: VariableProfile): GuidedVariableViewModel['sourceMethod'] {
  const methods: Record<string, string> = {
    internacoes: 'Soma das internações registradas no recorte.',
    obitos: 'Soma dos óbitos hospitalares registrados.',
    valor_total: 'Soma do valor total aprovado.',
    dias_permanencia: 'Soma dos dias de permanência.',
    taxa_mortalidade: 'Recalculada por óbitos ÷ internações; taxas anuais não são promediadas.',
    taxa_internacao_100k: 'Internações ÷ população × 100 mil.',
    taxa_obitos_100k: 'Óbitos ÷ população × 100 mil.',
    media_permanencia_calculada: 'Dias de permanência ÷ internações.',
    desfecho_hospitalar: 'Frequências de óbito e não óbito derivadas das internações.',
  };
  return { source: 'SIH/SUS e população oficial', method: methods[profile.variableId] ?? 'Indicador calculado para o recorte.' };
}

function availabilityReason(
  summary: AvailabilitySummary,
  territoryLabels: ReadonlyMap<string, string>,
): string | undefined {
  if (summary.state === 'complete') return undefined;
  const headline = summary.state === 'none'
    ? 'Nenhum valor utilizável no recorte.'
    : `Cobertura parcial: ${summary.unavailableCount} de ${summary.expectedCount} combinações território–período sem dado.`;
  if (summary.issues.length > 3) {
    const territoryIds = [...new Set(summary.issues.map((issue) => issue.territoryId))].sort();
    const namedTerritories = territoryIds.slice(0, 2)
      .map((id) => territoryLabels.get(id) ?? id);
    const territoryRemainder = territoryIds.length - namedTerritories.length;
    const territoryText = `${namedTerritories.join(', ')}${territoryRemainder > 0
      ? ` e mais ${territoryRemainder} ${territoryRemainder === 1 ? 'território' : 'territórios'}`
      : ''}`;
    const periods = [...new Set(summary.issues.map((issue) => issue.periodKey))].sort();
    const periodText = periods.length === 1
      ? `em ${periods[0]}`
      : `de ${periods[0]} a ${periods.at(-1)}`;
    const statuses = [...new Set(summary.issues.map((issue) => issue.sourceStatus))];
    const cause = statuses.length === 1
      ? AVAILABILITY_STATUS_LABELS[statuses[0]!]
      : 'indisponível';
    return `${headline} ${cause[0]!.toUpperCase()}${cause.slice(1)} em ${territoryText}, ${periodText}.`;
  }
  const examples = [...summary.issues]
    .sort((left, right) =>
      STATUS_PRIORITY.indexOf(left.sourceStatus) - STATUS_PRIORITY.indexOf(right.sourceStatus)
      || left.territoryId.localeCompare(right.territoryId)
      || left.periodKey.localeCompare(right.periodKey))
    .slice(0, 3)
    .map((issue) => {
      const territory = territoryLabels.get(issue.territoryId) ?? issue.territoryId;
      return `${territory} em ${issue.periodKey} (${AVAILABILITY_STATUS_LABELS[issue.sourceStatus]})`;
    });
  if (examples.length === 0) return headline;
  const remaining = summary.issues.length - examples.length;
  return `${headline} Exemplos: ${examples.join('; ')}${remaining > 0 ? `; e mais ${remaining}.` : '.'}`;
}

function toVariableViewModel(
  profile: VariableProfile,
  availability: AvailabilitySummary,
  territoryLabels: ReadonlyMap<string, string>,
): GuidedVariableViewModel {
  const base = {
    id: profile.variableId,
    label: profile.label,
    type: profile.variableType,
    typeLabel: TYPE_LABELS[profile.variableType],
    sourceMethod: sourceMethod(profile),
  };
  if (availability.state === 'complete') return { ...base, availability: 'complete' };
  return {
    ...base,
    availability: availability.state,
    availabilityReason: availabilityReason(availability, territoryLabels) ?? 'Cobertura incompleta no recorte.',
  };
}

export function buildGuidedResearchData(
  design: ResearchDesign,
  snapshot: ResearchDataSnapshot,
): GuidedResearchData {
  const sourceCells = collapseDiseases(snapshot.cells);
  const annualVariables = annualProfileCells(sourceCells, VARIABLE_PROFILES, design.geography);
  const annualPopulation = annualProfileCells(sourceCells, [POPULATION_PROFILE], design.geography);
  const annualCells = [...annualVariables, ...annualPopulation];
  const analyticCells = aggregateAnalyticCells(
    design,
    sourceCells,
    annualCells,
    VARIABLE_PROFILES,
  );
  const availabilityByVariableId = Object.fromEntries(VARIABLE_PROFILES.map((profile) => [
    profile.variableId,
    summarizeAvailability(annualVariables.filter((cell) => cell.variableId === profile.variableId)),
  ]));
  const territoryLabels = new Map(design.groups.flatMap((group) =>
    group.territories.map((territory) => [territory.id, territory.label] as const)));
  return {
    design,
    variables: VARIABLE_PROFILES.map((profile) =>
      toVariableViewModel(profile, availabilityByVariableId[profile.variableId]!, territoryLabels)),
    availabilityByVariableId,
    annualCells,
    analyticCells,
    sourceCells,
    recoverableMessages: snapshot.errors.map((error) => error.message),
  };
}

/** Re-aggregates each outcome only across periods complete in every expected territory. */
export function buildCommonCoverageScenario(
  data: GuidedResearchData,
  profiles: readonly VariableProfile[],
  reviewedScenario?: AnalysisScenario | null,
): CommonCoverageScenarioBuild {
  const selectedProfiles = profiles.filter((profile) => profile.variableType !== 'categorical');
  const decisionsByScope = new Map<string, AnalysisScenario['decisions'][number]>();
  for (const item of reviewedScenario?.decisions ?? []) {
    try {
      const [groupId, territoryId, , variableId] = JSON.parse(item.cellKey) as [string, string, string, string];
      decisionsByScope.set(JSON.stringify([groupId, territoryId, variableId]), item);
    } catch {
      // Invalid external decision keys are ignored; they never create analytic data.
    }
  }
  const coverageCells = data.annualCells.map((cell) => {
    const explicit = decisionsByScope.get(JSON.stringify([cell.groupId, cell.territoryId, cell.variableId]));
    if (!explicit) return cell;
    if (explicit.analyticStatus === 'include' && (cell.rawValue === null || !Number.isFinite(cell.rawValue))) {
      return cell;
    }
    return { ...cell, analyticStatus: explicit.analyticStatus, reasonCode: explicit.reasonCode };
  });
  const selected = selectCommonCoverage({
    design: data.design,
    cells: coverageCells,
    variableIds: selectedProfiles.map((profile) => profile.variableId),
  });
  const labels = new Map(selectedProfiles.map((profile) => [profile.variableId, profile.label]));
  const supportedDiagnostics = selected.diagnostics.filter((item) => item.commonPeriodKeys.length > 0);
  const unsupportedDiagnostics = selected.diagnostics.filter((item) => item.commonPeriodKeys.length === 0);
  const needsSensitivity = unsupportedDiagnostics.length > 0
    || supportedDiagnostics.some((item) => item.state === 'restricted');
  if (supportedDiagnostics.length === 0 || !needsSensitivity) {
    return {
      state: supportedDiagnostics.length === 0 ? 'no_common_support' : 'no_restriction',
      scenario: null,
      diagnostics: selected.diagnostics,
      explanation: supportedDiagnostics.length === 0
        ? `Não existe suporte temporal comum completo para ${unsupportedDiagnostics
            .map((item) => labels.get(item.variableId) ?? item.variableId)
            .join(', ')}. Nenhum valor foi imputado.`
        : 'A cobertura comum coincide com o recorte principal; nenhuma análise adicional é necessária.',
    };
  }

  const diagnostics = new Map(selected.diagnostics.map((item) => [item.variableId, item]));
  const derived = selectedProfiles.flatMap((profile) => {
    const diagnostic = diagnostics.get(profile.variableId);
    if (!diagnostic || diagnostic.commonPeriodKeys.length === 0) return [];
    const commonPeriods = new Set(diagnostic.commonPeriodKeys);
    const source = data.sourceCells.filter((cell) => commonPeriods.has(cell.periodKey));
    const cells = data.design.groups.flatMap((group) => group.territories.map((territory) => {
      const unitSource = source.filter((cell) =>
        cell.groupId === group.id && cell.territoryId === territory.id);
      if (unitSource.length === 0) {
        return {
          groupId: group.id,
          territoryId: territory.id,
          periodKey: diagnostic.commonPeriodKeys[0]!,
          variableId: profile.variableId,
          rawValue: null,
          sourceStatus: 'missing' as const,
          analyticStatus: 'exclude_missing' as const,
          reasonCode: 'common_support_source_missing',
        };
      }
      return {
        ...deriveCell(unitSource, profile),
        periodKey: diagnostic.commonPeriodKeys[0]!,
      };
    }));
    return withZeroPolicy(cells, source, profile, data.design.geography).map((cell) => {
      const explicit = decisionsByScope.get(JSON.stringify([cell.groupId, cell.territoryId, cell.variableId]));
      if (!explicit) return cell;
      if (explicit.analyticStatus === 'include' && (cell.rawValue === null || !Number.isFinite(cell.rawValue))) {
        return cell;
      }
      return {
        ...cell,
        analyticStatus: explicit.analyticStatus,
        reasonCode: explicit.reasonCode,
      };
    });
  });
  const details = supportedDiagnostics
    .map((item) => `${labels.get(item.variableId) ?? item.variableId}: ${item.commonPeriodKeys.join(', ')}`)
    .join('; ');
  const unsupported = unsupportedDiagnostics.length > 0
    ? ` Sem suporte comum calculável para ${unsupportedDiagnostics.map((item) => labels.get(item.variableId) ?? item.variableId).join(', ')}; esses desfechos permanecem visíveis, mas fora do cálculo.`
    : '';
  return {
    state: 'restricted',
    scenario: createRecommendedScenario(derived),
    diagnostics: selected.diagnostics,
    explanation: `Sensibilidade no suporte temporal comum — ${details}.${unsupported} Períodos sem cobertura completa foram excluídos, sem imputação; o mecanismo da ausência não foi presumido.`,
  };
}

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function formatted(value: number | null, unit?: string): string {
  if (value === null || !Number.isFinite(value)) return 'n/d';
  return `${number.format(value)}${unit ? ` ${unit}` : ''}`;
}

function normalityLabel(result: VariableProfileResult, profile: VariableProfile): string {
  if (profile.variableType === 'count') return 'Normalidade não se aplica';
  if (profile.variableType === 'categorical') return 'Frequências observadas';
  const classifications = Object.values(result.byGroup).map((group) => group.normality.classification);
  if (classifications.length > 0 && classifications.every((item) => item === 'approximately_normal')) {
    return 'Aproximadamente normal';
  }
  if (classifications.some((item) => item === 'non_normal')) return 'Distribuição não normal';
  return 'Dados insuficientes para avaliar';
}

function categoricalCounts(
  data: GuidedResearchData,
  scenario: AnalysisScenario,
): Array<{ label: string; count: number }> {
  const contingency = buildHospitalOutcomeContingency(data.design, data.analyticCells, scenario);
  if (!contingency) return [];
  return contingency.colLabels.map((label, column) => ({
    label,
    count: contingency.table.reduce((sum, row) => sum + (row[column] ?? 0), 0),
  }));
}

export function buildProfileViewModel(
  data: GuidedResearchData,
  scenario: AnalysisScenario,
  profile: VariableProfile,
): DataProfileViewModel {
  const result = profileVariable(scenario.cells, profile);
  const summary = result.overall;
  const availability = data.availabilityByVariableId[profile.variableId]!;
  const categories = profile.variableType === 'categorical' ? categoricalCounts(data, scenario) : undefined;
  const facts = profile.variableType === 'count'
    ? [
        { label: 'Mediana', value: formatted(summary.median, profile.unit) },
        { label: 'Zeros', value: `${number.format(summary.zeroShare * 100)}%` },
        { label: 'Dispersão', value: summary.dispersionIndex === null ? 'n/d' : number.format(summary.dispersionIndex) },
        { label: 'Mín–máx', value: `${formatted(summary.min)} – ${formatted(summary.max)}` },
      ]
    : profile.variableType === 'categorical'
      ? (categories ?? []).map((item) => ({ label: item.label, value: number.format(item.count) }))
      : [
          { label: 'Média', value: formatted(summary.mean, profile.unit) },
          { label: 'Mediana', value: formatted(summary.median, profile.unit) },
          { label: 'Desvio-padrão', value: formatted(summary.sampleSd, profile.unit) },
          { label: 'Mín–máx', value: `${formatted(summary.min)} – ${formatted(summary.max)}` },
        ];
  return {
    variableId: profile.variableId,
    label: profile.label,
    kind: profile.variableType,
    coverage: {
      expected: availability.expectedCount,
      available: availability.usableCount,
      used: summary.n,
      missing: availability.unavailableCount,
    },
    facts,
    diagnosticLabel: normalityLabel(result, profile),
    distribution: {
      title: categories ? 'Frequências observadas' : profile.variableType === 'count' ? 'Distribuição das contagens' : 'Histograma e Q–Q',
      description: shouldKeepAnnualSeries(data.design)
        ? 'Cada barra representa um período utilizável da série.'
        : 'Valores usados na análise; intervalos foram agregados por território conforme o tipo da variável.',
      histogram: summary.histogramBins,
      qqPoints: profile.variableType === 'count' || profile.variableType === 'categorical' ? undefined : summary.qqPoints,
      categories,
    },
  };
}

function testLabel(id: string): string {
  return TEST_REGISTRY.find((entry) => entry.id === id)?.title ?? id;
}

export function toEligibilityViewModels(decisions: ReturnType<typeof evaluateTestsForSelection>): EligibleTestViewModel[] {
  return decisions.map((item) => ({
    id: item.testId,
    label: testLabel(item.testId),
    status: item.status,
    statusLabel: item.status === 'eligible'
      ? 'Permitido'
      : item.status === 'eligible_with_caveat'
        ? 'Permitido com ressalva'
        : 'Não permitido',
    reason: item.reasons.map((reason) => reason.message).join(' '),
  }));
}

export function buildGuidedSelectionModel(
  data: GuidedResearchData,
  selection: GuidedResearchSelection,
): GuidedSelectionModel {
  const selectedProfiles = selection.variableIds.flatMap((id) => {
    const profile = VARIABLE_PROFILES.find((item) => item.variableId === id);
    return profile ? [profile] : [];
  });
  const selectedIds = new Set([...selection.variableIds, 'populacao']);
  const scenario = createRecommendedScenario(
    data.analyticCells.filter((cell) => selectedIds.has(cell.variableId)),
  );
  const effectiveRoles = { ...(selection.roleAssignments ?? {}) };
  if (!effectiveRoles.outcome && selectedProfiles.length === 1 && selectedProfiles[0]?.variableType !== 'categorical') {
    effectiveRoles.outcome = selectedProfiles[0].variableId;
  }
  const outcome = selectedProfiles.find((profile) => profile.variableId === effectiveRoles.outcome);
  if (outcome?.variableType === 'count' && !effectiveRoles.exposure) effectiveRoles.exposure = 'populacao';
  const contingency = buildHospitalOutcomeContingency(data.design, data.analyticCells, scenario);
  const decisions = selectedProfiles.length > 0 && selection.goal !== 'describe'
    ? evaluateTestsForSelection({
        design: data.design,
        scenario,
        profiles: selectedProfiles,
        roleAssignments: effectiveRoles,
        ...(contingency ? { contingencyTable: contingency.table } : {}),
      })
    : [];
  const profilesByVariableId = Object.fromEntries(selectedProfiles.map((profile) => [
    profile.variableId,
    buildProfileViewModel(data, scenario, profile),
  ]));
  return {
    profilesByVariableId,
    eligibility: toEligibilityViewModels(decisions),
    decisions,
    scenario,
    reviewsResolved: !scenario.cells.some((cell) => cell.analyticStatus === 'requires_review'),
    effectiveRoles,
    contingency,
  };
}

export function useGuidedResearch(
  design: ResearchDesign,
  selection: GuidedResearchSelection,
  options: { loader?: ResearchLoader } = {},
): UseGuidedResearchResult {
  const loader = options.loader ?? loadResearchCells;
  const fingerprint = fingerprintResearchDesign(design);
  const [state, setState] = useState<
    | { status: 'loading'; fingerprint: string }
    | { status: 'ready'; fingerprint: string; snapshot: ResearchDataSnapshot }
    | { status: 'error'; fingerprint: string; message: string }
  >({ status: 'loading', fingerprint });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', fingerprint });
    loader(design, VARIABLE_PROFILES, { signal: controller.signal }).then(
      (snapshot) => setState({ status: 'ready', fingerprint, snapshot }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          fingerprint,
          message: error instanceof Error ? error.message : 'Não foi possível carregar os dados do recorte.',
        });
      },
    );
    return () => controller.abort();
  }, [fingerprint, loader]);

  const data = useMemo(
    () => state.status === 'ready' && state.fingerprint === fingerprint
      ? buildGuidedResearchData(design, state.snapshot)
      : null,
    [design, fingerprint, state],
  );
  const model = useMemo(
    () => data ? buildGuidedSelectionModel(data, selection) : null,
    [data, selection],
  );

  if (state.status === 'error' && state.fingerprint === fingerprint) {
    return {
      status: 'error', error: state.message, scenario: null, decisions: [], reviewsResolved: false,
      effectiveRoles: {}, recoverableMessages: [],
    };
  }
  if (!data || !model) {
    return {
      status: 'loading', error: null, scenario: null, decisions: [], reviewsResolved: false,
      effectiveRoles: {}, recoverableMessages: [],
    };
  }
  return {
    status: 'ready',
    error: null,
    variables: data.variables,
    profilesByVariableId: model.profilesByVariableId,
    eligibility: model.eligibility,
    scenario: model.scenario,
    decisions: model.decisions,
    reviewsResolved: model.reviewsResolved,
    effectiveRoles: model.effectiveRoles,
    recoverableMessages: data.recoverableMessages,
    data,
    contingency: model.contingency,
  };
}
