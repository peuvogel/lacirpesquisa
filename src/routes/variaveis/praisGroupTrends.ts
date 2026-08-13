import { aggregatePeriod } from '@/features/research/aggregatePeriod';
import type {
  AnalysisCell,
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
  profiles: readonly VariableProfile[];
  alpha?: number;
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
  profiles,
  alpha,
}: RunPraisForProfilesInput): PraisGroupTrendRun {
  return profiles.reduce<PraisGroupTrendRun>((combined, profile) => {
    const run = runPraisByGroup({ design, sourceCells, profile, ...(alpha === undefined ? {} : { alpha }) });
    combined.results.push(...run.results);
    combined.skippedGroups.push(...run.skippedGroups);
    return combined;
  }, { results: [], skippedGroups: [] });
}
