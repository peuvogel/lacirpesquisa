import { legacyStats } from './legacyAdapters';
import { matchTabularColumns, readTabularPasteState } from './parseTabular';
import type { RecognizedColumn, TabularInputOptions } from './types';

export type TabularColumnRole = 'numerica' | 'categorica' | 'tempo' | 'ignorar';

function isKnownDomainKey(key: string, options: TabularInputOptions): boolean {
  const aliases = options.aliases ?? {};
  const requiredKeys = options.requiredKeys ?? [];
  const numericKeys = options.numericKeys ?? [];
  return key in aliases || requiredKeys.includes(key) || numericKeys.includes(key);
}

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

/**
 * Maps user-selected column roles to domain keys for confirm-time analysis.
 * Starts from header alias matching, then applies role overrides and position fallback.
 */
export function deriveRecognizedColumnsFromRoles(
  roles: TabularColumnRole[],
  headers: string[],
  options: TabularInputOptions,
): Record<string, number> {
  const requiredKeys = options.requiredKeys ?? [];
  const numericKeys = options.numericKeys ?? [];
  const aliases = options.aliases ?? {};
  const positionFallback = options.positionFallback;

  const ignoredIndices = new Set(
    roles.map((role, index) => (role === 'ignorar' ? index : -1)).filter((index) => index >= 0),
  );

  const headerMatch = matchTabularColumns(headers, aliases, requiredKeys);
  const map: Record<string, number> = {};
  for (const [key, column] of Object.entries(headerMatch.recognizedColumns)) {
    if (!ignoredIndices.has(column.index)) {
      map[key] = column.index;
    }
  }

  const usedIndices = new Set(Object.values(map));

  if (isKnownDomainKey('tempo', options)) {
    roles.forEach((role, index) => {
      if (role === 'tempo' && !ignoredIndices.has(index) && map.tempo === undefined) {
        map.tempo = index;
        usedIndices.add(index);
      }
    });
  }

  for (const idKey of ['id', 'unidade']) {
    if (!isKnownDomainKey(idKey, options) || map[idKey] !== undefined) continue;
    const catIndex = roles.findIndex(
      (role, index) => role === 'categorica' && !ignoredIndices.has(index) && !usedIndices.has(index),
    );
    if (catIndex >= 0) {
      map[idKey] = catIndex;
      usedIndices.add(catIndex);
      break;
    }
  }

  const numericRequiredKeys = requiredKeys.filter((key) => numericKeys.includes(key));
  for (let index = 0; index < roles.length; index += 1) {
    if (roles[index] !== 'numerica' || ignoredIndices.has(index) || usedIndices.has(index)) continue;
    const nextKey = numericRequiredKeys.find((key) => map[key] === undefined);
    if (!nextKey) break;
    map[nextKey] = index;
    usedIndices.add(index);
  }

  if (positionFallback?.keysByIndex) {
    const minColumns = positionFallback.minColumns ?? positionFallback.keysByIndex.length;
    if (headers.length >= minColumns) {
      for (let index = 0; index < positionFallback.keysByIndex.length; index += 1) {
        const key = positionFallback.keysByIndex[index];
        if (!requiredKeys.includes(key)) continue;
        if (map[key] !== undefined) continue;
        if (ignoredIndices.has(index)) continue;
        if (index >= headers.length) continue;
        map[key] = index;
      }
    }
  }

  const result: Record<string, number> = {};
  for (const [key, index] of Object.entries(map)) {
    if (!isKnownDomainKey(key, options)) continue;
    if (index < 0 || index >= headers.length) continue;
    if (ignoredIndices.has(index)) continue;
    result[key] = index;
  }

  return result;
}
