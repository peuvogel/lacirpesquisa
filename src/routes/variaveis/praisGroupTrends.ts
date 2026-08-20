import { aggregatePeriod } from '@/features/research/aggregatePeriod';
import { scenarioCellKey } from '@/features/research/scenarios';
import type {
  AnalysisCell,
  AnalysisScenario,
  ResearchDesign,
  ResearchPeriod,
  VariableProfile,
} from '@/features/research/types';
import { praisTrendPresets } from '@/features/tests/prais-winsten/praisCharts';
import {
  buildDatasetFromConfirmed as buildPraisDataset,
  buildMetrics as buildPraisMetrics,
  runAnalysis as runPrais,
  validateSeries as validatePrais,
} from '@/features/tests/prais-winsten/praisEngine';
import { buildPraisInterpretation } from '@/features/tests/prais-winsten/praisInterpretation';
import type { ResultMetric, ResultsPanelProps } from '@/routes/estatistica/ResultsPanel';

const MINIMUM_GROUP_POINTS = 8;

export interface PraisGroupSeries {
  groupId: string;
  groupLabel: string;
  outcomeVariableId: string;
  expectedYears: number[];
  rows: Array<{ year: number; value: number }>;
}

export interface PraisGroupTrendResult {
  groupId: string;
  groupLabel: string;
  outcomeVariableId: string;
  metrics: ResultMetric[];
  chart: ResultsPanelProps['chart'];
  interpretation: string[];
  pValue: number;
  effectDirection: 'positive' | 'negative' | 'null';
}

export interface PraisSkippedGroup {
  groupId: string;
  groupLabel: string;
  outcomeVariableId: string;
  reason: string;
}

export interface PraisGroupTrendRun {
  results: PraisGroupTrendResult[];
  skippedGroups: PraisSkippedGroup[];
}

interface RunPraisByGroupInput {
  design: ResearchDesign;
  sourceCells: AnalysisCell[];
  profile: VariableProfile;
  alpha?: number;
}

interface RunPraisForProfilesInput {
  design: ResearchDesign;
  sourceCells: AnalysisCell[];
  annualCells: AnalysisCell[];
  scenario: AnalysisScenario;
  profiles: readonly VariableProfile[];
  alpha?: number;
}

interface BuildScenarioAwarePraisCellsInput {
  sourceCells: AnalysisCell[];
  annualCells: AnalysisCell[];
  scenario: AnalysisScenario;
  profile: VariableProfile;
}

function profileScopeKey(cell: Pick<AnalysisCell, 'groupId' | 'territoryId'>, variableId: string): string {
  return JSON.stringify([cell.groupId, cell.territoryId, variableId]);
}

function profileCellKey(
  cell: Pick<AnalysisCell, 'groupId' | 'territoryId' | 'periodKey'>,
  variableId: string,
): string {
  return scenarioCellKey({ ...cell, variableId });
}

/**
 * Prais needs the annual source components, while review decisions belong to
 * the derived profile cells shown to the researcher. This projects the annual
 * policy and explicit scenario decisions back onto every required component.
 */
export function buildScenarioAwarePraisCells({
  sourceCells,
  annualCells,
  scenario,
  profile,
}: BuildScenarioAwarePraisCellsInput): AnalysisCell[] {
  const relevantVariableIds = new Set([
    profile.variableId,
    profile.numeratorVariableId,
    profile.denominatorVariableId,
    profile.exposureVariableId,
  ].filter((variableId): variableId is string => Boolean(variableId)));
  const annualPolicyByKey = new Map(
    annualCells
      .filter((cell) => cell.variableId === profile.variableId)
      .map((cell) => [scenarioCellKey(cell), cell]),
  );
  const scenarioCellsByKey = new Map(scenario.cells.map((cell) => [scenarioCellKey(cell), cell]));
  const decisionsByKey = new Map(scenario.decisions.map((decision) => [decision.cellKey, decision]));
  const decisionsByScope = new Map<string, (typeof scenario.decisions)[number]>();
  const scenarioProfileCellsByScope = new Map<string, AnalysisCell[]>();

  for (const cell of scenario.cells.filter((item) => item.variableId === profile.variableId)) {
    const scopeKey = profileScopeKey(cell, profile.variableId);
    scenarioProfileCellsByScope.set(scopeKey, [...(scenarioProfileCellsByScope.get(scopeKey) ?? []), cell]);
  }
  for (const decision of scenario.decisions) {
    const decidedCell = scenarioCellsByKey.get(decision.cellKey);
    if (!decidedCell || decidedCell.variableId !== profile.variableId) continue;
    const scopeKey = profileScopeKey(decidedCell, profile.variableId);
    if ((scenarioProfileCellsByScope.get(scopeKey)?.length ?? 0) === 1) {
      decisionsByScope.set(scopeKey, decision);
    }
  }

  return sourceCells.map((sourceCell) => {
    if (!relevantVariableIds.has(sourceCell.variableId)) return sourceCell;
    const policyKey = profileCellKey(sourceCell, profile.variableId);
    const annualPolicy = annualPolicyByKey.get(policyKey);
    if (!annualPolicy) return sourceCell;

    const decision = decisionsByKey.get(policyKey)
      ?? decisionsByScope.get(profileScopeKey(sourceCell, profile.variableId));
    const analyticStatus = decision?.analyticStatus ?? annualPolicy.analyticStatus;
    const reasonCode = decision?.reasonCode ?? annualPolicy.reasonCode;

    if (analyticStatus === 'include') {
      const hasUsableSource = (sourceCell.sourceStatus === 'observed' || sourceCell.sourceStatus === 'collection_zero')
        && typeof sourceCell.rawValue === 'number'
        && Number.isFinite(sourceCell.rawValue);
      if (!hasUsableSource) return sourceCell;
    }
    return {
      ...sourceCell,
      analyticStatus,
      ...(reasonCode ? { reasonCode } : {}),
    };
  });
}

function periodForGroup(design: ResearchDesign, groupId: string): ResearchPeriod | undefined {
  return design.period.scope === 'shared'
    ? design.period.time
    : design.period.timesByGroupId[groupId];
}

function expectedAnnualYears(design: ResearchDesign, groupId: string): number[] {
  const period = periodForGroup(design, groupId);
  if (!period || period.mode !== 'range') return [];
  const start = Number(period.start.slice(0, 4));
  const end = Number(period.end.slice(0, 4));
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function groupLabels(design: ResearchDesign): Map<string, string> {
  const nameCounts = new Map<string, number>();
  for (const group of design.groups) {
    nameCounts.set(group.name, (nameCounts.get(group.name) ?? 0) + 1);
  }
  return new Map(design.groups.map((group) => [
    group.id,
    (nameCounts.get(group.name) ?? 0) > 1 ? `${group.name} (${group.id})` : group.name,
  ]));
}

export function buildPraisGroupSeries(
  design: ResearchDesign,
  sourceCells: AnalysisCell[],
  profile: VariableProfile,
): PraisGroupSeries[] {
  const labels = groupLabels(design);
  return design.groups.map((group) => {
    const expectedYears = expectedAnnualYears(design, group.id);
    const territoryIds = new Set(group.territories.map((territory) => territory.id));
    const rows = expectedYears.flatMap((year) => {
      const groupYearCells = sourceCells.filter((cell) =>
        cell.groupId === group.id
        && territoryIds.has(cell.territoryId)
        && Number(cell.periodKey.slice(0, 4)) === year);
      if (groupYearCells.length === 0) return [];

      // aggregatePeriod requires one analytic unit. The group becomes that unit,
      // while a synthetic period key preserves each territorial component pair.
      const collapsedToGroup = groupYearCells.map((cell) => ({
        ...cell,
        territoryId: group.id,
        periodKey: `${cell.periodKey}\u0000${cell.territoryId}`,
      }));
      const aggregated = aggregatePeriod(collapsedToGroup, profile);
      return aggregated.value === null ? [] : [{ year, value: aggregated.value }];
    });
    return {
      groupId: group.id,
      groupLabel: labels.get(group.id) ?? group.name,
      outcomeVariableId: profile.variableId,
      expectedYears,
      rows,
    };
  });
}

function direction(value: number): PraisGroupTrendResult['effectDirection'] {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-12) return 'null';
  return value > 0 ? 'positive' : 'negative';
}

function insufficientPointsReason(series: PraisGroupSeries): string {
  const expected = series.expectedYears.length;
  const observed = series.rows.length;
  return `Prais–Winsten exige pelo menos ${MINIMUM_GROUP_POINTS} pontos anuais regulares por grupo; ${observed} de ${expected} ano(s) esperado(s) foram agregados. Anos ausentes não foram imputados.`;
}

export function runPraisByGroup({
  design,
  sourceCells,
  profile,
  alpha = 0.05,
}: RunPraisByGroupInput): PraisGroupTrendRun {
  const seriesByGroup = buildPraisGroupSeries(design, sourceCells, profile);
  return seriesByGroup.reduce<PraisGroupTrendRun>((run, series) => {
    if (
      !['count', 'rate', 'numeric'].includes(profile.variableType)
      || profile.temporalAggregation === 'point_only'
    ) {
      run.skippedGroups.push({
        groupId: series.groupId,
        groupLabel: series.groupLabel,
        outcomeVariableId: profile.variableId,
        reason: `${profile.label} não forma uma série numérica compatível com Prais–Winsten.`,
      });
      return run;
    }
    if (series.expectedYears.length < MINIMUM_GROUP_POINTS || series.rows.length < MINIMUM_GROUP_POINTS) {
      run.skippedGroups.push({
        groupId: series.groupId,
        groupLabel: series.groupLabel,
        outcomeVariableId: profile.variableId,
        reason: insufficientPointsReason(series),
      });
      return run;
    }

    const dataset = buildPraisDataset({
      headers: ['grupo', 'ano', profile.label],
      rows: series.rows.map((row) => [series.groupLabel, String(row.year), String(row.value)]),
      recognizedColumns: { id: 0, tempo: 1, variavel_y: 2 },
    });
    const errors = validatePrais(dataset);
    if (errors.length > 0) {
      run.skippedGroups.push({
        groupId: series.groupId,
        groupLabel: series.groupLabel,
        outcomeVariableId: profile.variableId,
        reason: `A série do grupo não é elegível: ${errors.join(' ')}`,
      });
      return run;
    }
    if (new Set(dataset.values).size < 2) {
      run.skippedGroups.push({
        groupId: series.groupId,
        groupLabel: series.groupLabel,
        outcomeVariableId: profile.variableId,
        reason: 'A série precisa apresentar variação ao longo do tempo.',
      });
      return run;
    }

    try {
      const output = runPrais(dataset);
      const effect = output.model.scale === 'log'
        ? output.model.apc
        : output.model.absoluteChange;
      run.results.push({
        groupId: series.groupId,
        groupLabel: series.groupLabel,
        outcomeVariableId: profile.variableId,
        metrics: buildPraisMetrics(output.model, dataset),
        chart: praisTrendPresets[0]!.buildChart(output),
        interpretation: [
          `Tendência estimada somente para ${series.groupLabel}; este resultado não testa diferença em relação aos demais grupos.`,
          ...buildPraisInterpretation(output, alpha),
        ],
        pValue: output.model.p,
        effectDirection: direction(effect),
      });
    } catch (error) {
      run.skippedGroups.push({
        groupId: series.groupId,
        groupLabel: series.groupLabel,
        outcomeVariableId: profile.variableId,
        reason: error instanceof Error
          ? `O motor Prais–Winsten bloqueou esta série: ${error.message}`
          : 'O motor Prais–Winsten bloqueou esta série.',
      });
    }
    return run;
  }, { results: [], skippedGroups: [] });
}

export function runPraisForProfiles({
  design,
  sourceCells,
  annualCells,
  scenario,
  profiles,
  alpha,
}: RunPraisForProfilesInput): PraisGroupTrendRun {
  return profiles.reduce<PraisGroupTrendRun>((combined, profile) => {
    const effectiveCells = buildScenarioAwarePraisCells({ sourceCells, annualCells, scenario, profile });
    const run = runPraisByGroup({ design, sourceCells: effectiveCells, profile, ...(alpha === undefined ? {} : { alpha }) });
    combined.results.push(...run.results);
    combined.skippedGroups.push(...run.skippedGroups);
    return combined;
  }, { results: [], skippedGroups: [] });
}
