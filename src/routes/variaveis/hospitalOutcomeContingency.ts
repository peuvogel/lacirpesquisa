import type { AnalysisCell, AnalysisScenario, ResearchDesign } from '@/features/research/types';

export interface HospitalOutcomeContingency {
  table: number[][];
  rowLabels: string[];
  colLabels: string[];
  columnHeaders: [string, string];
  expectedUnits: number;
  usedUnits: number;
}

function scopeKey(cell: Pick<AnalysisCell, 'groupId' | 'territoryId' | 'periodKey'>): string {
  return JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey]);
}

function usableCount(cell: AnalysisCell | undefined): cell is AnalysisCell & { rawValue: number } {
  return Boolean(
    cell
    && cell.analyticStatus === 'include'
    && (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero')
    && typeof cell.rawValue === 'number'
    && Number.isInteger(cell.rawValue)
    && cell.rawValue >= 0,
  );
}

export function buildHospitalOutcomeContingency(
  design: ResearchDesign,
  analyticCells: readonly AnalysisCell[],
  scenario: AnalysisScenario,
): HospitalOutcomeContingency | null {
  const outcomeCells = scenario.cells.filter((cell) => cell.variableId === 'desfecho_hospitalar');
  if (outcomeCells.length === 0) return null;

  const componentByKey = new Map(analyticCells
    .filter((cell) => cell.variableId === 'internacoes' || cell.variableId === 'obitos')
    .map((cell) => [`${scopeKey(cell)}\u0000${cell.variableId}`, cell]));
  const countsByGroup = new Map(design.groups.map((group) => [group.id, { deaths: 0, nonDeaths: 0 }]));
  let usedUnits = 0;

  for (const outcomeCell of outcomeCells) {
    if (outcomeCell.analyticStatus !== 'include') continue;
    const key = scopeKey(outcomeCell);
    const admissions = componentByKey.get(`${key}\u0000internacoes`);
    const deaths = componentByKey.get(`${key}\u0000obitos`);
    if (!usableCount(admissions) || !usableCount(deaths) || deaths.rawValue > admissions.rawValue) continue;
    const group = countsByGroup.get(outcomeCell.groupId);
    if (!group) continue;
    group.deaths += deaths.rawValue;
    group.nonDeaths += admissions.rawValue - deaths.rawValue;
    usedUnits += 1;
  }

  return {
    table: design.groups.map((group) => {
      const counts = countsByGroup.get(group.id)!;
      return [counts.deaths, counts.nonDeaths];
    }),
    rowLabels: design.groups.map((group) => group.name),
    colLabels: ['Óbito', 'Não óbito'],
    columnHeaders: ['Grupo territorial', 'Desfecho hospitalar'],
    expectedUnits: outcomeCells.length,
    usedUnits,
  };
}
