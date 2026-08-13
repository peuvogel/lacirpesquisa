import { describe, expect, it } from 'vitest';
import type { MapAnalysisGroup } from './mapAnalysisState';
import {
  suggestResearchForSelection,
  suggestResearchFromFlatSelection,
} from './suggestResearchForSelection';

const group: MapAnalysisGroup = {
  id: 'g1',
  name: 'Grupo 1',
  territoryIds: [
    { level: 'uf', ibgeCode: '29', sigla: 'BA', name: 'Bahia' },
    { level: 'uf', ibgeCode: '35', sigla: 'SP', name: 'São Paulo' },
  ],
  time: { mode: 'compare', periodA: '2015-2019', periodB: '2020-2024' },
  variableIds: ['mock.internacoes', 'mock.obitos'],
};

describe('legacy map suggestion adapters', () => {
  it('returns no test without actual design, values and diagnostics', () => {
    expect(suggestResearchForSelection({ groups: [] })).toEqual([]);
    expect(suggestResearchForSelection({ groups: [group] })).toEqual([]);
  });

  it('does not infer t, ANOVA, correlation or Poisson from flat labels', () => {
    expect(suggestResearchFromFlatSelection(['SP', 'BA'], ['Internações hospitalares'])).toEqual([]);
    expect(suggestResearchFromFlatSelection(['SP', 'BA', 'PE'], ['Óbitos hospitalares'])).toEqual([]);
    expect(suggestResearchFromFlatSelection(['SP'], ['Taxa por 100 mil', 'Internações'])).toEqual([]);
  });
});
