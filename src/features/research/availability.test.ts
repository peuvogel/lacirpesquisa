import { describe, expect, it } from 'vitest';
import { summarizeAvailability } from './availability';
import type { AnalysisCell, SourceCellStatus } from './types';

function cell(
  territoryId: string,
  periodKey: string,
  sourceStatus: SourceCellStatus,
  rawValue: number | null,
): AnalysisCell {
  return {
    territoryId,
    groupId: 'nordeste',
    periodKey,
    variableId: 'internacoes',
    rawValue,
    sourceStatus,
    analyticStatus: rawValue === null ? 'exclude_missing' : 'include',
  };
}

describe('summarizeAvailability', () => {
  it.each([
    ['complete', [cell('BA', '2025', 'observed', 10), cell('SE', '2025', 'collection_zero', 0)]],
    ['partial', [cell('BA', '2025', 'observed', 10), cell('SE', '2025', 'missing', null)]],
    ['none', [cell('BA', '2025', 'missing', null), cell('SE', '2025', 'not_queried', null)]],
  ] as const)('classifies %s coverage without turning absence into zero', (expected, cells) => {
    expect(summarizeAvailability(cells).state).toBe(expected);
  });

  it('names each unavailable source status, territory and year in a short partial reason', () => {
    const summary = summarizeAvailability([
      cell('BA', '2024', 'observed', 12),
      cell('BA', '2025', 'missing', null),
      cell('SE', '2025', 'not_queried', null),
      cell('AL', '2025', 'suppressed', null),
      cell('PE', '2025', 'not_applicable', null),
    ]);

    expect(summary).toMatchObject({ state: 'partial', selectable: true, usableCount: 1, expectedCount: 5 });
    expect(summary.reason).toBe(
      'Dados ausentes: BA em 2025; não consultado: SE em 2025; suprimido: AL em 2025; não aplicável: PE em 2025.',
    );
  });

  it('disables selection when no finite observed or collection-zero value is usable', () => {
    const summary = summarizeAvailability([
      cell('BA', '2025', 'observed', null),
      cell('SE', '2025', 'collection_zero', null),
      cell('AL', '2025', 'missing', null),
    ]);

    expect(summary).toMatchObject({
      state: 'none',
      selectable: false,
      usableCount: 0,
      expectedCount: 3,
    });
    expect(summary.reason).toContain('Nenhum valor utilizável.');
  });
});
