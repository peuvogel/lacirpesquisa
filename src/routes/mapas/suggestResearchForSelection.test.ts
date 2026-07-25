import { describe, expect, it } from 'vitest';
import { getTestById } from '@/features/tests/registry';
import { suggestResearchForSelection } from './suggestResearchForSelection';

describe('suggestResearchForSelection', () => {
  it('returns only demo for an empty selection', () => {
    const result = suggestResearchForSelection([], []);
    expect(result).toHaveLength(1);
    expect(result[0]?.testId).toBe('demo');
  });

  it('always includes demo and resolves every testId in the registry', () => {
    const scenarios: Array<[string[], string[]]> = [
      [[], []],
      [['SP'], ['Internações por causa']],
      [['SP', 'BA'], ['Internações por causa']],
      [['SP', 'BA', 'PE'], ['Internações por causa']],
      [['SP'], ['Internações por causa', 'Óbitos hospitalares']],
      [['SP'], ['Taxa de mortalidade infantil']],
      [['SP'], ['Óbitos hospitalares']],
    ];

    for (const [ufs, variables] of scenarios) {
      const result = suggestResearchForSelection(ufs, variables);
      expect(result.some((entry) => entry.testId === 'demo')).toBe(true);
      for (const entry of result) {
        expect(getTestById(entry.testId)).toBeDefined();
        expect(entry.rationale.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('suggests t-student for two UFs and one variable', () => {
    const result = suggestResearchForSelection(['SP', 'BA'], ['Internações por causa']);
    expect(result.some((entry) => entry.testId === 't-student')).toBe(true);
  });

  it('suggests anova-tukey for three UFs and one variable', () => {
    const result = suggestResearchForSelection(['SP', 'BA', 'PE'], ['Internações por causa']);
    expect(result.some((entry) => entry.testId === 'anova-tukey')).toBe(true);
  });

  it('suggests correlacao for one UF and two variables', () => {
    const result = suggestResearchForSelection(
      ['SP'],
      ['Internações por causa', 'Óbitos hospitalares'],
    );
    expect(result.some((entry) => entry.testId === 'correlacao')).toBe(true);
  });

  it('suggests poisson for a count-style variable', () => {
    const result = suggestResearchForSelection(['SP'], ['Óbitos hospitalares']);
    expect(result.some((entry) => entry.testId === 'poisson')).toBe(true);
  });

  it('mentions selection size in rationales', () => {
    const twoUfs = suggestResearchForSelection(['SP', 'BA'], ['Internações por causa']);
    expect(twoUfs.some((entry) => /2 estados|SP, BA/i.test(entry.rationale))).toBe(true);

    const threeUfs = suggestResearchForSelection(['SP', 'BA', 'PE'], ['Internações por causa']);
    expect(threeUfs.some((entry) => /3 estados/i.test(entry.rationale))).toBe(true);

    const twoVars = suggestResearchForSelection(
      ['SP'],
      ['Internações por causa', 'Óbitos hospitalares'],
    );
    expect(twoVars.some((entry) => /2 variáveis/i.test(entry.rationale))).toBe(true);
  });
});
