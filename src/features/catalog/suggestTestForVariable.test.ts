import { describe, expect, it } from 'vitest';
import { resolveHint, suggestTestForVariable } from './suggestTestForVariable';
import type { CatalogEntry, VariableType } from './types';

function entry(variableType: VariableType): CatalogEntry {
  return {
    id: `fixture.${variableType}`,
    label: `Variável ${variableType}`,
    variableType,
    domain: 'vascular',
    sourceSystem: 'SIH/SUS',
    sourceName: 'Fixture',
    tableOrIndicator: 'sih/cnv/nibr.def',
    period: '2013–2025',
    officialUrl: 'https://example.com/fixture',
    methodologyNotes: 'Fixture de teste.',
    loadable: false,
  };
}

const VARIABLE_TYPES: VariableType[] = [
  'contagem',
  'taxa',
  'numerica',
  'ordinal',
  'categorica',
  'texto',
];

describe('legacy catalog test hint adapter', () => {
  it.each(VARIABLE_TYPES)('does not infer a test from %s without design and values', (variableType) => {
    expect(suggestTestForVariable(entry(variableType))).toBeNull();
    expect(resolveHint(entry(variableType))).toBeNull();
  });
});
