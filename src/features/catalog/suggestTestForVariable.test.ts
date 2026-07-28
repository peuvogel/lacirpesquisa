import { describe, expect, it } from 'vitest';
import { getTestById, isTestAvailable } from '@/features/tests/registry';
import { resolveHint, suggestTestForVariable } from './suggestTestForVariable';
import type { CatalogEntry, VariableType } from './types';

function entry(variableType: VariableType, label = 'Variável de teste'): CatalogEntry {
  return {
    id: `fixture.${variableType}`,
    label,
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

const EXPECTED: Record<VariableType, string> = {
  contagem: 'poisson',
  taxa: 'prais-winsten',
  numerica: 't-student',
  ordinal: 'kruskal-dunn',
  categorica: 'qui-quadrado',
  texto: 't-student',
};

describe('suggestTestForVariable', () => {
  it.each(Object.entries(EXPECTED) as [VariableType, string][])(
    'maps %s → %s',
    (variableType, testId) => {
      const hint = suggestTestForVariable(entry(variableType, `Rótulo ${variableType}`));
      expect(hint.testId).toBe(testId);
      expect(hint.rationale.length).toBeGreaterThan(0);
      expect(hint.rationale).toContain(`Rótulo ${variableType}`);
    },
  );

  it('returns a registry-resolvable testId for every VariableType', () => {
    for (const variableType of Object.keys(EXPECTED) as VariableType[]) {
      const hint = suggestTestForVariable(entry(variableType));
      expect(getTestById(hint.testId)).toBeDefined();
    }
  });
});

describe('resolveHint', () => {
  it('attaches registry entry when the suggested test is available', () => {
    const resolved = resolveHint(entry('contagem', 'Internações'));
    expect(resolved.testId).toBe('poisson');
    expect(resolved.registry?.id).toBe('poisson');
    expect(isTestAvailable(resolved.testId)).toBe(true);
    expect(resolved.rationale).toContain('Internações');
  });

  it('falls back to t-student for texto variables', () => {
    const resolved = resolveHint(entry('texto', 'Notas metodológicas'));
    expect(resolved.testId).toBe('t-student');
    expect(resolved.registry?.id).toBe('t-student');
  });
});
