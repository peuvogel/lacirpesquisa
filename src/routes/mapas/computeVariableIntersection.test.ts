import { describe, expect, it } from 'vitest';
import { computeVariableIntersection } from './computeVariableIntersection';
import { MOCK_VARIABLES_BY_UF } from './mockVariablesByUF';

describe('computeVariableIntersection', () => {
  it('returns empty lists when no UFs are selected', () => {
    expect(computeVariableIntersection([], { SP: ['a'] })).toEqual({
      intersection: [],
      partial: [],
    });
  });

  it('puts all variables in intersection for a single selected UF', () => {
    const result = computeVariableIntersection(['SP'], {
      SP: ['Internações por causa', 'Óbitos hospitalares', 'Taxa de mortalidade infantil'],
    });
    expect(result.intersection).toEqual([
      'Internações por causa',
      'Óbitos hospitalares',
      'Taxa de mortalidade infantil',
    ]);
    expect(result.partial).toEqual([]);
  });

  it('splits shared vs partial variables for two UFs and names missing siglas', () => {
    const variablesByUF = {
      SP: ['A', 'B', 'C'],
      BA: ['A', 'B'],
    };
    const result = computeVariableIntersection(['SP', 'BA'], variablesByUF);
    expect(result.intersection).toEqual(['A', 'B']);
    expect(result.partial).toEqual([{ variable: 'C', missingFrom: ['BA'] }]);
  });

  it('names every selected UF that lacks a partial variable', () => {
    const variablesByUF = {
      SP: ['A', 'B', 'C'],
      BA: ['A', 'B'],
      PE: ['A'],
    };
    const result = computeVariableIntersection(['SP', 'BA', 'PE'], variablesByUF);
    expect(result.intersection).toEqual(['A']);
    expect(result.partial).toEqual([
      { variable: 'B', missingFrom: ['PE'] },
      { variable: 'C', missingFrom: ['BA', 'PE'] },
    ]);
  });

  it('treats unknown siglas as empty variable lists', () => {
    expect(computeVariableIntersection(['XX'], { SP: ['A'] })).toEqual({
      intersection: [],
      partial: [],
    });

    const result = computeVariableIntersection(['SP', 'XX'], {
      SP: ['A', 'B'],
    });
    expect(result.intersection).toEqual([]);
    expect(result.partial).toEqual([
      { variable: 'A', missingFrom: ['XX'] },
      { variable: 'B', missingFrom: ['XX'] },
    ]);
  });

  it('never places the same variable in intersection and partial', () => {
    const result = computeVariableIntersection(['SP', 'BA', 'PE'], MOCK_VARIABLES_BY_UF);
    const intersectionSet = new Set(result.intersection);
    for (const entry of result.partial) {
      expect(intersectionSet.has(entry.variable)).toBe(false);
      expect(entry.missingFrom.every((uf) => ['SP', 'BA', 'PE'].includes(uf))).toBe(true);
    }
  });

  it('yields at least one real partial case from the shipped mock fixture', () => {
    const result = computeVariableIntersection(['SP', 'BA'], MOCK_VARIABLES_BY_UF);
    expect(result.partial.length).toBeGreaterThan(0);
    expect(result.partial.some((entry) => entry.missingFrom.includes('BA'))).toBe(true);
  });
});
