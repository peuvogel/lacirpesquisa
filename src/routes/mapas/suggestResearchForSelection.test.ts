import { describe, expect, it } from 'vitest';
import { getTestById, isTestAvailable } from '@/features/tests/registry';
import type { MapAnalysisGroup } from './mapAnalysisState';
import {
  suggestResearchForSelection,
  suggestResearchFromFlatSelection,
} from './suggestResearchForSelection';

const baTerritory = {
  level: 'uf' as const,
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

const spTerritory = {
  level: 'uf' as const,
  ibgeCode: '35',
  sigla: 'SP',
  name: 'São Paulo',
};

const peTerritory = {
  level: 'uf' as const,
  ibgeCode: '26',
  sigla: 'PE',
  name: 'Pernambuco',
};

function group(overrides: Partial<MapAnalysisGroup> = {}): MapAnalysisGroup {
  return {
    id: 'g1',
    name: 'Grupo 1',
    territoryIds: [baTerritory],
    time: { mode: 'point', point: '2020' },
    variableIds: ['mock.internacoes'],
    ...overrides,
  };
}

describe('suggestResearchForSelection', () => {
  it('returns only demo for an empty selection', () => {
    const result = suggestResearchForSelection({ groups: [] });
    expect(result).toHaveLength(1);
    expect(result[0]?.testId).toBe('demo');
  });

  it('resolves every testId in the registry and filters unavailable tests', () => {
    const scenarios: MapAnalysisGroup[][] = [
      [],
      [group()],
      [
        group({ territoryIds: [baTerritory, spTerritory] }),
        group({ id: 'g2', name: 'Grupo 2', territoryIds: [peTerritory] }),
      ],
      [
        group({
          time: { mode: 'compare', periodA: '2015-2019', periodB: '2020-2024' },
        }),
      ],
    ];

    for (const groups of scenarios) {
      const result = suggestResearchForSelection({ groups });
      expect(result.some((entry) => entry.testId === 'demo')).toBe(true);
      for (const entry of result) {
        expect(getTestById(entry.testId)).toBeDefined();
        expect(entry.rationale.trim().length).toBeGreaterThan(0);
        if (entry.testId !== 'demo') {
          expect(isTestAvailable(entry.testId)).toBe(true);
        }
      }
    }
  });

  it('suggests t-student for two groups and one variable', () => {
    const groups = [
      group({ id: 'g1', name: 'Grupo A', territoryIds: [baTerritory] }),
      group({
        id: 'g2',
        name: 'Grupo B',
        territoryIds: [spTerritory],
        time: { mode: 'point', point: '2021' },
      }),
    ];
    const result = suggestResearchForSelection({ groups });
    expect(result.some((entry) => entry.testId === 't-student')).toBe(true);
  });

  it('suggests anova-tukey for three groups and one variable', () => {
    const groups = [
      group({ id: 'g1', territoryIds: [baTerritory] }),
      group({ id: 'g2', territoryIds: [spTerritory] }),
      group({ id: 'g3', territoryIds: [peTerritory] }),
    ];
    const result = suggestResearchForSelection({ groups });
    expect(result.some((entry) => entry.testId === 'anova-tukey')).toBe(true);
  });

  it('suggests prais-winsten when compare time mode is set', () => {
    const groups = [
      group({
        time: { mode: 'compare', periodA: '2015-2019', periodB: '2020-2024' },
      }),
      group({
        id: 'g2',
        name: 'Grupo 2',
        territoryIds: [spTerritory],
        time: { mode: 'compare', periodA: '2010-2014', periodB: '2015-2019' },
      }),
    ];
    const result = suggestResearchForSelection({ groups });
    expect(result.some((entry) => entry.testId === 'prais-winsten')).toBe(true);
  });

  it('suggests correlacao for one group with multiple variables', () => {
    const groups = [
      group({
        variableIds: ['mock.internacoes', 'mock.obitos'],
      }),
    ];
    const result = suggestResearchForSelection({ groups });
    expect(result.some((entry) => entry.testId === 'correlacao')).toBe(true);
  });

  it('does not include stale Phase 1 demo rationale', () => {
    const result = suggestResearchForSelection({ groups: [group()] });
    expect(result.some((entry) => /Único teste disponível hoje/i.test(entry.rationale))).toBe(
      false,
    );
  });
});

describe('suggestResearchFromFlatSelection (legacy)', () => {
  it('suggests t-student for two UFs and one variable', () => {
    const result = suggestResearchFromFlatSelection(['SP', 'BA'], ['Internações hospitalares']);
    expect(result.some((entry) => entry.testId === 't-student')).toBe(true);
  });

  it('suggests anova-tukey for three UFs and one variable', () => {
    const result = suggestResearchFromFlatSelection(
      ['SP', 'BA', 'PE'],
      ['Internações hospitalares'],
    );
    expect(result.some((entry) => entry.testId === 'anova-tukey')).toBe(true);
  });

  it('suggests poisson for a count-style variable', () => {
    const result = suggestResearchFromFlatSelection(['SP'], ['Óbitos hospitalares']);
    expect(result.some((entry) => entry.testId === 'poisson')).toBe(true);
  });
});
