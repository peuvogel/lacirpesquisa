import { legacyStats, parseNumber } from './legacyAdapters';
import { matchStructuredPositionFallback, matchTabularColumns } from './parseTabular';
import { resolveBindings, type TableDocument } from './tableDocument';
import { isSupportedTemporalToken } from './temporalPeriods';
import type { TabularInputOptions } from './types';

export interface TableValiditySummary {
  valid: number;
  incomplete: number[];
  invalid: number[];
}

function valueMatchesRole(
  value: string,
  key: string,
  numericKeys: readonly string[],
  temporalKeys: readonly string[],
): boolean {
  if (!value.trim()) return false;
  if (temporalKeys.includes(key)) return isSupportedTemporalToken(value);
  if (numericKeys.includes(key)) return parseNumber(value) !== null;
  return true;
}

/**
 * Produces existing engine indexes from stable bindings. Missing bindings are
 * suggested directly from column names and position fallback; cells are never
 * serialized and parsed again during an internal handoff.
 */
export function deriveRecognizedColumnsFromDocument(
  document: TableDocument,
  testId: string,
  options: TabularInputOptions,
): Record<string, number> {
  const bound = resolveBindings(document, testId);
  const requiredKeys = options.requiredKeys ?? [];
  const aliases = options.aliases ?? {};
  const matched = matchTabularColumns(document.columns.map((column) => column.name), aliases, requiredKeys);
  const ignoredIndexes = new Set(
    document.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.type === 'ignorar')
      .map(({ index }) => index),
  );
  const manuallyBoundRoles = new Set(Object.keys(document.bindings[testId] ?? {}));
  const manuallyBoundIndexes = new Set(Object.values(bound));
  const recognized: Record<string, number> = {
    ...Object.fromEntries(
      Object.entries(matched.recognizedColumns)
        .filter(([key, column]) => (
          !ignoredIndexes.has(column.index)
          && !manuallyBoundRoles.has(key)
          && !manuallyBoundIndexes.has(column.index)
        ))
        .map(([key, column]) => [key, column.index]),
    ),
    ...bound,
  };

  const positional = matchStructuredPositionFallback(
    document.columns.map((column) => column.name),
    document.rows,
    options,
    legacyStats,
  );
  Object.entries(positional).forEach(([key, column]) => {
    const index = column.index;
    const usedByAnotherRole = Object.entries(recognized)
      .some(([role, usedIndex]) => role !== key && usedIndex === index);
    if (
      recognized[key] === undefined
      && !manuallyBoundRoles.has(key)
      && index < document.columns.length
      && !ignoredIndexes.has(index)
      && !usedByAnotherRole
    ) {
      recognized[key] = index;
    }
  });

  const knownKeys = new Set([
    ...Object.keys(aliases),
    ...requiredKeys,
    ...(options.numericKeys ?? []),
    ...(options.temporalKeys ?? []),
  ]);
  return Object.fromEntries(Object.entries(recognized).filter(([key, index]) => (
    knownKeys.has(key)
    && index >= 0
    && index < document.columns.length
    && !ignoredIndexes.has(index)
  )));
}

/** Reports current editable-table rows for the roles this test actually uses. */
export function tableValiditySummary(
  document: TableDocument,
  testId: string,
  requiredKeys: readonly string[],
  numericKeys: readonly string[] = [],
  resolved?: Record<string, number>,
  temporalKeys: readonly string[] = [],
): TableValiditySummary {
  const bindings = resolved ?? resolveBindings(document, testId);
  const validRows: number[] = [];
  const incomplete: number[] = [];
  const invalid: number[] = [];

  document.rows.forEach((row, index) => {
    const missing = requiredKeys.some((key) => !String(row[bindings[key] ?? -1] ?? '').trim());
    if (missing) {
      incomplete.push(index + 1);
      return;
    }
    const mismatchedRole = [...numericKeys, ...temporalKeys].some((key) => {
      const columnIndex = bindings[key];
      return columnIndex !== undefined && !valueMatchesRole(
        String(row[columnIndex] ?? ''),
        key,
        numericKeys,
        temporalKeys,
      );
    });
    if (mismatchedRole) {
      invalid.push(index + 1);
      return;
    }
    validRows.push(index + 1);
  });
  return { valid: validRows.length, incomplete, invalid };
}
