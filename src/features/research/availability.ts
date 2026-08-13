import type { AnalysisCell, SourceCellStatus } from './types';

export type AvailabilityState = 'complete' | 'partial' | 'none';

export interface AvailabilityIssue {
  territoryId: string;
  periodKey: string;
  sourceStatus: SourceCellStatus;
}

export interface AvailabilitySummary {
  state: AvailabilityState;
  selectable: boolean;
  expectedCount: number;
  usableCount: number;
  unavailableCount: number;
  reason?: string;
  issues: AvailabilityIssue[];
}

const STATUS_LABELS: Record<SourceCellStatus | 'invalid_value', string> = {
  observed: 'valor observado inválido',
  collection_zero: 'zero de coleta inválido',
  missing: 'Dados ausentes',
  suppressed: 'suprimido',
  not_applicable: 'não aplicável',
  not_queried: 'não consultado',
  invalid_value: 'valor inválido',
};

const STATUS_ORDER: readonly SourceCellStatus[] = [
  'missing',
  'not_queried',
  'suppressed',
  'not_applicable',
  'observed',
  'collection_zero',
];

function isUsable(cell: AnalysisCell): boolean {
  return (
    (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero') &&
    typeof cell.rawValue === 'number' &&
    Number.isFinite(cell.rawValue)
  );
}

function issueReason(issues: readonly AvailabilityIssue[]): string {
  const byStatus = new Map<SourceCellStatus, AvailabilityIssue[]>();
  for (const issue of issues) {
    const existing = byStatus.get(issue.sourceStatus) ?? [];
    existing.push(issue);
    byStatus.set(issue.sourceStatus, existing);
  }

  const fragments: string[] = [];
  for (const status of STATUS_ORDER) {
    const statusIssues = byStatus.get(status);
    if (!statusIssues?.length) continue;
    const cells = [...statusIssues]
      .sort((left, right) =>
        left.territoryId.localeCompare(right.territoryId) ||
        left.periodKey.localeCompare(right.periodKey),
      )
      .map(({ territoryId, periodKey }) => `${territoryId} em ${periodKey}`)
      .join(', ');
    fragments.push(`${STATUS_LABELS[status]}: ${cells}`);
  }
  return `${fragments.join('; ')}.`;
}

export function summarizeAvailability(cells: readonly AnalysisCell[]): AvailabilitySummary {
  const usableCount = cells.filter(isUsable).length;
  const issues = cells
    .filter((cell) => !isUsable(cell))
    .map(({ territoryId, periodKey, sourceStatus }) => ({ territoryId, periodKey, sourceStatus }));
  const expectedCount = cells.length;
  const unavailableCount = expectedCount - usableCount;

  if (usableCount === expectedCount && expectedCount > 0) {
    return {
      state: 'complete',
      selectable: true,
      expectedCount,
      usableCount,
      unavailableCount,
      issues,
    };
  }

  const details = issueReason(issues);
  if (usableCount === 0) {
    return {
      state: 'none',
      selectable: false,
      expectedCount,
      usableCount,
      unavailableCount,
      reason: `Nenhum valor utilizável.${details ? ` ${details}` : ''}`,
      issues,
    };
  }

  return {
    state: 'partial',
    selectable: true,
    expectedCount,
    usableCount,
    unavailableCount,
    reason: details,
    issues,
  };
}
