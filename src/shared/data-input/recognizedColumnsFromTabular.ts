import { legacyStats } from './legacyAdapters';
import { readTabularPasteState } from './parseTabular';
import type { RecognizedColumn, TabularInputOptions } from './types';

function toIndexMap(recognizedColumns: Record<string, RecognizedColumn>): Record<string, number> {
  return Object.fromEntries(Object.entries(recognizedColumns).map(([key, column]) => [key, column.index]));
}

function tabularToPasteText(headers: string[], rows: string[][]): string {
  const headerLine = headers.join(';');
  const rowLines = rows.map((row) => row.join(';'));
  return [headerLine, ...rowLines].join('\n');
}

/**
 * Re-derives domain column keys from session/handoff headers and rows by
 * serializing to delimited paste text and delegating to readTabularPasteState.
 */
export function deriveRecognizedColumnsFromTabular(
  headers: string[],
  rows: string[][],
  options: TabularInputOptions,
): Record<string, number> {
  if (!headers.length) return {};

  const text = tabularToPasteText(headers, rows);
  const parsed = readTabularPasteState(text, legacyStats, options);

  if (parsed.status !== 'loaded') return {};

  return toIndexMap(parsed.recognizedColumns);
}
