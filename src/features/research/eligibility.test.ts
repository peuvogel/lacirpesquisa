import { describe, expect, it } from 'vitest';
import { TEST_REGISTRY } from '@/features/tests/registry';
import { createRecommendedScenario } from './scenarios';
import { evaluateTests, evaluateTestsForSelection } from './eligibility';
import type { AnalysisCell, ResearchDesign, VariableProfile } from './types';

const design: ResearchDesign = {
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia'],
  period: { scope: 'shared', time: { mode: 'point', point: '2024' } },
  groups: [
    {
      id: 'a',
      name: 'A',
      territories: ['BA', 'SE', 'AL', ...Array.from({ length: 20 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`)]
        .map((id) => ({ id, label: id })),
    },
    { id: 'b', name: 'B', territories: ['SP', 'RJ', 'MG'].map((id) => ({ id, label: id })) },
  ],
};

const numeric: VariableProfile = {
  variableId: 'x', label: 'Desfecho', variableType: 'numeric', temporalAggregation: 'point_only',
};
const numericY: VariableProfile = {
  variableId: 'y', label: 'Segundo indicador', variableType: 'numeric', temporalAggregation: 'point_only',
};
const count: VariableProfile = {
  variableId: 'eventos', label: 'Eventos', variableType: 'count', temporalAggregation: 'sum',
};
const population: VariableProfile = {
  variableId: 'pop', label: 'População', variableType: 'count', temporalAggregation: 'point_only',
};

function cell(groupId: string, territoryId: string, value: number, overrides: Partial<AnalysisCell> = {}): AnalysisCell {
  return {
    groupId, territoryId, periodKey: '2024', variableId: 'x', rawValue: value,
    sourceStatus: value === 0 ? 'collection_zero' : 'observed', analyticStatus: 'include', ...overrides,
  };
}

function decision(input: Parameters<typeof evaluateTests>[0], testId: string) {
  return evaluateTests(input).find((item) => item.testId === testId)!;
}

describe('evaluateTests', () => {
  it('evaluates every selected numeric outcome separately for territorial group comparisons', () => {
    const xCells = [
      cell('a', 'BA', 1), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('b', 'SP', 8), cell('b', 'RJ', 13), cell('b', 'MG', 18),
    ];
    const scenario = createRecommendedScenario([
      ...xCells,
      ...xCells.map((entry) => ({ ...entry, variableId: 'y', rawValue: (entry.rawValue ?? 0) + 2 })),
    ]);

    const result = evaluateTestsForSelection({ design, scenario, profiles: [numeric, numericY] });
    const mannWhitney = result.find((item) => item.testId === 'mann-whitney')!;

    expect(mannWhitney.status).not.toBe('ineligible');
    expect(mannWhitney.reasons).toContainEqual(expect.objectContaining({
      code: 'multiple_outcomes_separate',
      message: expect.stringMatching(/2 variáveis.*separadamente.*Holm/i),
    }));
    expect(result.find((item) => item.testId === 'correlacao')).toMatchObject({ status: 'ineligible' });
  });

  it('keeps compatible outcomes calculable when another selected outcome is incompatible', () => {
    const xCells = [
      cell('a', 'BA', 1), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('b', 'SP', 8), cell('b', 'RJ', 13), cell('b', 'MG', 18),
    ];
    const scenario = createRecommendedScenario([
      ...xCells,
      ...xCells.slice(0, 4).map((entry) => ({ ...entry, variableId: 'y' })),
    ]);

    const mannWhitney = evaluateTestsForSelection({ design, scenario, profiles: [numeric, numericY] })
      .find((item) => item.testId === 'mann-whitney')!;

    expect(mannWhitney).toMatchObject({ status: 'eligible_with_caveat' });
    expect(mannWhitney.reasons.some((item) => /Segundo indicador/.test(item.message))).toBe(true);
    expect(mannWhitney.reasons.some((item) => /continua separadamente/i.test(item.message))).toBe(true);
  });

  it('returns one fail-closed decision for every registered test', () => {
    const result = evaluateTests({ design, scenario: createRecommendedScenario([]), profiles: [] });
    expect(result.map((item) => item.testId)).toEqual(TEST_REGISTRY.map((entry) => entry.id));
    expect(result.every((item) => item.status === 'ineligible')).toBe(true);
  });

  it('blocks every test when scenario cells do not belong to the research design', () => {
    const scenario = createRecommendedScenario([cell('a', 'ZZ', 1)]);
    const result = evaluateTests({ design, scenario, profiles: [numeric] });

    expect(result.every((item) => item.status === 'ineligible')).toBe(true);
    expect(result.every((item) => item.reasons.some((itemReason) => itemReason.code === 'design_cell_mismatch'))).toBe(true);
  });

  it('blocks group tests when each group has only one independent observation', () => {
    const scenario = createRecommendedScenario([cell('a', 'BA', 1), cell('b', 'SP', 2)]);
    const input = { design, scenario, profiles: [numeric] };
    for (const id of ['t-student', 'mann-whitney']) {
      expect(decision(input, id)).toMatchObject({ status: 'ineligible' });
      expect(decision(input, id).reasons.some((reason) => reason.code === 'insufficient_independent_units')).toBe(true);
    }
    const threeGroupDesign: ResearchDesign = {
      ...design,
      groups: [...design.groups, { id: 'c', name: 'C', territories: [{ id: 'PE', label: 'PE' }] }],
    };
    const threeGroups = {
      design: threeGroupDesign,
      scenario: createRecommendedScenario([
        cell('a', 'BA', 1), cell('b', 'SP', 2), cell('c', 'PE', 3),
      ]),
      profiles: [numeric],
    };
    for (const id of ['anova-tukey', 'kruskal-dunn']) {
      expect(decision(threeGroups, id)).toMatchObject({ status: 'ineligible' });
      expect(decision(threeGroups, id).reasons.some((reason) => reason.code === 'insufficient_independent_units')).toBe(true);
    }
  });

  it('offers Welch-style t and Mann–Whitney for two independent numeric groups', () => {
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 1), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('b', 'SP', 8), cell('b', 'RJ', 13), cell('b', 'MG', 18),
    ]);
    const input = { design, scenario, profiles: [numeric] };
    expect(decision(input, 't-student').status).not.toBe('ineligible');
    expect(decision(input, 'mann-whitney').status).not.toBe('ineligible');
  });

  it('offers ANOVA and Kruskal–Wallis only after three replicated groups exist', () => {
    const threeGroupDesign: ResearchDesign = {
      ...design,
      groups: [
        ...design.groups,
        { id: 'c', name: 'C', territories: ['PE', 'PB', 'CE'].map((id) => ({ id, label: id })) },
      ],
    };
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 1), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('b', 'SP', 10), cell('b', 'RJ', 11), cell('b', 'MG', 12),
      cell('c', 'PE', 20), cell('c', 'PB', 21), cell('c', 'CE', 22),
    ]);
    const input = { design: threeGroupDesign, scenario, profiles: [numeric] };

    expect(decision(input, 'anova-tukey').status).not.toBe('ineligible');
    expect(decision(input, 'kruskal-dunn').status).not.toBe('ineligible');
    expect(decision(input, 't-student').status).toBe('ineligible');
  });

  it('never silently drops a selected group with no usable outcome data', () => {
    const threeGroupDesign: ResearchDesign = {
      ...design,
      groups: [
        ...design.groups,
        { id: 'c', name: 'C', territories: ['PE', 'PB', 'CE'].map((id) => ({ id, label: id })) },
      ],
    };
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 1), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('b', 'SP', 8), cell('b', 'RJ', 13), cell('b', 'MG', 18),
    ]);
    const input = { design: threeGroupDesign, scenario, profiles: [numeric] };

    expect(decision(input, 't-student')).toMatchObject({ status: 'ineligible' });
    expect(decision(input, 'anova-tukey')).toMatchObject({ status: 'ineligible' });
  });

  it('blocks classical ANOVA when group variances are grossly incompatible', () => {
    const threeGroupDesign: ResearchDesign = {
      ...design,
      groups: [
        ...design.groups,
        { id: 'c', name: 'C', territories: ['PE', 'PB', 'CE'].map((id) => ({ id, label: id })) },
      ],
    };
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 0), cell('a', 'SE', 1), cell('a', 'AL', 2),
      cell('b', 'SP', 10), cell('b', 'RJ', 11), cell('b', 'MG', 12),
      cell('c', 'PE', 20), cell('c', 'PB', 30), cell('c', 'CE', 40),
    ]);

    expect(decision({ design: threeGroupDesign, scenario, profiles: [numeric] }, 'anova-tukey').reasons)
      .toContainEqual(expect.objectContaining({ code: 'variance_heterogeneity' }));
  });

  it('requires three independent units per group and rejects duplicated analytic scopes', () => {
    const twoPerGroup = createRecommendedScenario([
      cell('a', 'BA', 1), cell('a', 'SE', 2),
      cell('b', 'SP', 4), cell('b', 'RJ', 5),
    ]);
    expect(decision({ design, scenario: twoPerGroup, profiles: [numeric] }, 't-student').reasons)
      .toContainEqual(expect.objectContaining({ code: 'insufficient_independent_units' }));

    const duplicated = createRecommendedScenario([
      cell('a', 'BA', 1), cell('a', 'BA', 2), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('b', 'SP', 8), cell('b', 'RJ', 13), cell('b', 'MG', 18),
    ]);
    expect(decision({ design, scenario: duplicated, profiles: [numeric] }, 't-student').reasons)
      .toContainEqual(expect.objectContaining({ code: 'duplicate_analytic_scope' }));
  });

  it('does not count the same territory twice across independent groups', () => {
    const overlappingDesign: ResearchDesign = {
      ...design,
      groups: design.groups.map((group) => group.id === 'b'
        ? { ...group, territories: [...group.territories, { id: 'BA', label: 'BA' }] }
        : group),
    };
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 1), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('b', 'BA', 8), cell('b', 'RJ', 13), cell('b', 'MG', 18),
    ]);

    expect(decision({ design: overlappingDesign, scenario, profiles: [numeric] }, 't-student').reasons)
      .toContainEqual(expect.objectContaining({ code: 'overlapping_independent_units' }));
  });

  it('allows only paired t when the declared comparison aligns the same territories', () => {
    const pairedDesign: ResearchDesign = {
      ...design,
      comparisonKind: 'paired_period',
      groups: [
        { id: 'a', name: 'Antes', territories: ['BA', 'SE', 'AL'].map((id) => ({ id, label: id })) },
        { id: 'b', name: 'Depois', territories: ['BA', 'SE', 'AL'].map((id) => ({ id, label: id })) },
      ],
      period: {
        scope: 'per_group',
        timesByGroupId: {
          a: { mode: 'range', start: '2015', end: '2019' },
          b: { mode: 'range', start: '2020', end: '2024' },
        },
      },
    };
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 1, { periodKey: '2015' }),
      cell('a', 'SE', 2, { periodKey: '2015' }),
      cell('a', 'AL', 4, { periodKey: '2015' }),
      cell('b', 'BA', 3, { periodKey: '2020' }),
      cell('b', 'SE', 5, { periodKey: '2020' }),
      cell('b', 'AL', 8, { periodKey: '2020' }),
    ]);

    expect(decision({ design: pairedDesign, scenario, profiles: [numeric] }, 't-student').status)
      .not.toBe('ineligible');
    expect(decision({ design: pairedDesign, scenario, profiles: [numeric] }, 'mann-whitney').status)
      .toBe('ineligible');
  });

  it('requires explicit pair roles and variation for correlation', () => {
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 1), cell('a', 'SE', 2), cell('a', 'AL', 3),
      cell('a', 'BA', 4, { variableId: 'y' }),
      cell('a', 'SE', 5, { variableId: 'y' }),
      cell('a', 'AL', 6, { variableId: 'y' }),
    ]);
    const input = { design, scenario, profiles: [numeric, numericY] };
    expect(decision(input, 'correlacao').reasons)
      .toContainEqual(expect.objectContaining({ code: 'pair_roles_required' }));
  });

  it('blocks iid comparisons and naive correlation for repeated state-years', () => {
    const xCells = [
      cell('a', 'BA', 1, { periodKey: '2023' }),
      cell('a', 'BA', 2, { periodKey: '2024' }),
      cell('a', 'SE', 3, { periodKey: '2023' }),
      cell('a', 'SE', 4, { periodKey: '2024' }),
      cell('b', 'SP', 5, { periodKey: '2023' }),
      cell('b', 'SP', 6, { periodKey: '2024' }),
      cell('b', 'RJ', 7, { periodKey: '2023' }),
      cell('b', 'RJ', 8, { periodKey: '2024' }),
    ];
    const scenario = createRecommendedScenario([
      ...xCells,
      ...xCells.map((entry) => ({ ...entry, variableId: 'y', rawValue: (entry.rawValue ?? 0) * 2 })),
    ]);
    const repeatedDesign: ResearchDesign = {
      ...design,
      period: { scope: 'shared', time: { mode: 'range', start: '2023', end: '2024' } },
    };
    const input = {
      design: repeatedDesign,
      scenario,
      profiles: [numeric, numericY],
      roleAssignments: { outcome: 'x', predictor: 'y' },
    };
    expect(decision(input, 't-student').reasons.some((reason) => reason.code === 'repeated_units_not_iid')).toBe(true);
    expect(decision(input, 'correlacao').reasons.some((reason) => reason.code === 'repeated_units_not_iid')).toBe(true);
  });

  it('requires exposure and explicit roles for territorial count models', () => {
    const scenario = createRecommendedScenario([
      cell('a', 'BA', 10, { variableId: 'eventos' }),
      cell('a', 'SE', 20, { variableId: 'eventos' }),
    ]);
    const input = { design, scenario, profiles: [count] };
    expect(decision(input, 'poisson')).toMatchObject({ status: 'ineligible' });
    expect(decision(input, 'poisson').reasons.map((reason) => reason.code)).toContain('directional_roles_required');

    const rolesWithoutExposure = { outcome: 'eventos', predictor: 'x' };
    expect(decision({ ...input, profiles: [count, numeric], roleAssignments: rolesWithoutExposure }, 'poisson').reasons)
      .toContainEqual(expect.objectContaining({ code: 'missing_exposure' }));

    const modelCells = Array.from({ length: 20 }, (_, index) => {
      const territoryId = `T${String(index + 1).padStart(2, '0')}`;
      return [
        cell('a', territoryId, 8 + (index % 5), { variableId: 'eventos' }),
        cell('a', territoryId, 1000 + index * 10, { variableId: 'pop' }),
        cell('a', territoryId, index % 4, { variableId: 'x' }),
      ];
    }).flat();
    const withExposure = createRecommendedScenario(modelCells);
    const roles = { outcome: 'eventos', predictor: 'x', exposure: 'pop' };
    const allowed = { design, scenario: withExposure, profiles: [{ ...count, exposureVariableId: 'pop' }, population, numeric], roleAssignments: roles };
    expect(decision(allowed, 'poisson').status).not.toBe('ineligible');

    const overdispersed = createRecommendedScenario(modelCells.map((entry, index) =>
      entry.variableId === 'eventos'
        ? { ...entry, rawValue: index % 2 === 0 ? 0 : 50, sourceStatus: index % 2 === 0 ? 'collection_zero' as const : 'observed' as const }
        : entry));
    expect(decision({ ...allowed, scenario: overdispersed }, 'poisson')).toMatchObject({ status: 'eligible_with_caveat' });
    expect(decision({ ...allowed, scenario: overdispersed }, 'binomial-negativa').status).not.toBe('ineligible');

    const missingOneExposure = createRecommendedScenario(
      modelCells.filter((entry) => !(entry.variableId === 'pop' && entry.territoryId === 'T20')),
    );
    expect(decision({ ...allowed, scenario: missingOneExposure }, 'poisson').reasons)
      .toContainEqual(expect.objectContaining({ code: 'incomplete_model_rows' }));
  });

  it('blocks logistic regression for aggregated catalog cells', () => {
    const scenario = createRecommendedScenario([cell('a', 'BA', 1), cell('a', 'SE', 0)]);
    expect(decision({ design, scenario, profiles: [numeric], roleAssignments: { outcome: 'x', predictor: 'x' } }, 'logistica'))
      .toMatchObject({ status: 'ineligible', reasons: [expect.objectContaining({ code: 'aggregated_logistic_not_supported' })] });
  });

  it('requires one regular series with at least eight points for Prais–Winsten', () => {
    const series = Array.from({ length: 8 }, (_, index) => cell('a', 'BA', index, { periodKey: String(2017 + index) }));
    const seriesDesign: ResearchDesign = {
      ...design,
      period: { scope: 'shared', time: { mode: 'range', start: '2017', end: '2024' } },
    };
    const input = { design: seriesDesign, scenario: createRecommendedScenario(series), profiles: [numeric], roleAssignments: { outcome: 'x' } };
    expect(decision(input, 'prais-winsten').status).not.toBe('ineligible');
    const irregular = createRecommendedScenario(series.filter((_, index) => index !== 3));
    expect(decision({ ...input, scenario: irregular }, 'prais-winsten').status).toBe('ineligible');
  });

  it('requires observed frequency tables with acceptable expected cells for chi-square', () => {
    const scenario = createRecommendedScenario([cell('a', 'BA', 1)]);
    const input = { design, scenario, profiles: [numeric], contingencyTable: [[10, 20], [15, 25]] };
    expect(decision(input, 'qui-quadrado').status).not.toBe('ineligible');
    expect(decision({ ...input, contingencyTable: [[1, 0], [0, 1]] }, 'qui-quadrado').status).toBe('ineligible');
  });
});
