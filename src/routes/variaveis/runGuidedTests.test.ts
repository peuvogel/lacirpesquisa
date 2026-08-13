import { describe, expect, it } from 'vitest';
import { evaluateTests, evaluateTestsForSelection } from '@/features/research/eligibility';
import { createRecommendedScenario } from '@/features/research/scenarios';
import type {
  AnalysisCell,
  ResearchDesign,
  VariableProfile,
} from '@/features/research/types';
import {
  adjustPValuesHolm,
  attachCommonCoverageSensitivity,
  kruskalEpsilonSquared,
  runGuidedTests,
} from './runGuidedTests';

const design: ResearchDesign = {
  groups: [
    {
      id: 'nordeste',
      name: 'Nordeste',
      territories: [
        { id: '29', label: 'Bahia' },
        { id: '28', label: 'Sergipe' },
        { id: '27', label: 'Alagoas' },
      ],
    },
    {
      id: 'sudeste',
      name: 'Sudeste',
      territories: [
        { id: '35', label: 'São Paulo' },
        { id: '33', label: 'Rio de Janeiro' },
        { id: '31', label: 'Minas Gerais' },
      ],
    },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['doenca_teste'],
  period: { scope: 'shared', time: { mode: 'point', point: '2025' } },
};

const rateProfile: VariableProfile = {
  variableId: 'taxa',
  label: 'Taxa de internação',
  variableType: 'rate',
  unit: 'por 100 mil',
  temporalAggregation: 'recompute_rate',
};

const categoricalProfile: VariableProfile = {
  variableId: 'desfecho_hospitalar',
  label: 'Desfecho hospitalar (óbito/não óbito)',
  variableType: 'categorical',
  temporalAggregation: 'point_only',
};

function rateCells(): AnalysisCell[] {
  const values = [12, 15, 18, 30, 34, 39];
  return design.groups.flatMap((group) => group.territories.map((territory) => ({
    groupId: group.id,
    territoryId: territory.id,
    periodKey: '2025',
    variableId: 'taxa',
    rawValue: values.shift()!,
    sourceStatus: 'observed' as const,
    analyticStatus: 'include' as const,
  })));
}

describe('runGuidedTests', () => {
  it('adjusts a confirmatory family with the step-down Holm procedure', () => {
    expect(adjustPValuesHolm([0.01, 0.04, 0.03])).toEqual([0.03, 0.06, 0.06]);
    expect(adjustPValuesHolm([0.8])).toEqual([0.8]);
  });

  it('computes a bounded omnibus effect magnitude for Kruskal–Wallis', () => {
    expect(kruskalEpsilonSquared(10, 3, 12)).toBeCloseTo(8 / 9, 10);
    expect(kruskalEpsilonSquared(1, 3, 12)).toBe(0);
    expect(kruskalEpsilonSquared(2, 3, 3)).toBeNull();
  });

  it('keeps common-coverage results explicitly separated from the main analysis', () => {
    const scenario = createRecommendedScenario(rateCells());
    const eligibility = evaluateTests({
      design,
      scenario,
      profiles: [rateProfile],
      roleAssignments: { outcome: 'taxa' },
    });
    const main = runGuidedTests({
      design, scenario, profiles: [rateProfile], eligibility,
      selectedTestIds: ['mann-whitney'], primaryTestId: 'mann-whitney', roleAssignments: { outcome: 'taxa' },
    });

    const merged = attachCommonCoverageSensitivity(main, main, 'Somente 2024 teve cobertura completa.');

    expect(merged.results).toHaveLength(2);
    expect(merged.results[0]).toMatchObject({ role: 'principal', support: 'largest_valid' });
    expect(merged.results[1]).toMatchObject({ role: 'sensibilidade', support: 'common_coverage' });
    expect(merged.results[1]?.interpretation[0]).toMatch(/2024/);
    expect(merged.coverageSensitivity).toMatchObject({ state: 'calculated' });
  });

  it('runs group inference separately for every selected outcome and reports Holm-adjusted evidence', () => {
    const secondProfile: VariableProfile = {
      variableId: 'custo',
      label: 'Custo hospitalar',
      variableType: 'numeric',
      unit: 'R$',
      temporalAggregation: 'sum',
    };
    const cells = rateCells();
    const scenario = createRecommendedScenario([
      ...cells,
      ...cells.map((cell, index) => ({ ...cell, variableId: 'custo', rawValue: 100 + index * 25 })),
    ]);
    const profiles = [rateProfile, secondProfile];
    const eligibility = evaluateTestsForSelection({ design, scenario, profiles });

    const run = runGuidedTests({
      design,
      scenario,
      profiles,
      eligibility,
      selectedTestIds: ['mann-whitney'],
      primaryTestId: 'mann-whitney',
      roleAssignments: {},
    });

    expect(run.results.map((result) => result.outcomeVariableId)).toEqual(['taxa', 'custo']);
    expect(run.results.every((result) => result.role === 'principal')).toBe(true);
    expect(run.results.every((result) => result.rawPValue !== null)).toBe(true);
    expect(run.results.every((result) => result.adjustedPValue !== null)).toBe(true);
    expect(run.results.every((result) => result.pValue === result.adjustedPValue)).toBe(true);
    expect(run.results.every((result) => result.metrics.some((metric) => /Holm/i.test(metric.label)))).toBe(true);
    expect(run.results.every((result) => result.interpretation.some((paragraph) => /família confirmatória/i.test(paragraph)))).toBe(true);
    expect(run.results.every((result) => /Holm/i.test(result.interpretation.at(-1) ?? ''))).toBe(true);
  });

  it('runs compatible outcomes and keeps incompatible ones visible but outside Holm', () => {
    const secondProfile: VariableProfile = {
      variableId: 'custo', label: 'Custo hospitalar', variableType: 'numeric', temporalAggregation: 'sum',
    };
    const cells = rateCells();
    const scenario = createRecommendedScenario([
      ...cells,
      ...cells.slice(0, 4).map((cell, index) => ({ ...cell, variableId: 'custo', rawValue: 100 + index })),
    ]);
    const profiles = [rateProfile, secondProfile];
    const eligibility = evaluateTestsForSelection({ design, scenario, profiles });

    const run = runGuidedTests({
      design, scenario, profiles, eligibility,
      selectedTestIds: ['mann-whitney'], primaryTestId: 'mann-whitney', roleAssignments: {},
    });

    expect(run.results.map((result) => result.outcomeVariableId)).toEqual(['taxa']);
    expect(run.results[0]?.adjustedPValue).toBeNull();
    expect(run.skippedOutcomes).toContainEqual(expect.objectContaining({
      testId: 'mann-whitney', outcomeVariableId: 'custo', reason: expect.stringMatching(/pelo menos 3/i),
    }));
  });

  it('keeps group ids distinct and follows design order when names are duplicated', () => {
    const sameNames: ResearchDesign = {
      ...design,
      groups: design.groups.map((group) => ({ ...group, name: 'Mesmo nome' })),
    };
    const scenario = createRecommendedScenario(rateCells().reverse());
    const eligibility = evaluateTestsForSelection({ design: sameNames, scenario, profiles: [rateProfile] });

    const run = runGuidedTests({
      design: sameNames, scenario, profiles: [rateProfile], eligibility,
      selectedTestIds: ['mann-whitney'], primaryTestId: 'mann-whitney', roleAssignments: {},
    });

    expect(JSON.stringify(run.results[0]?.chart.data)).toContain('Mesmo nome (nordeste)');
    expect(JSON.stringify(run.results[0]?.chart.data)).toContain('Mesmo nome (sudeste)');
    expect(run.results[0]?.effectDirection).toBe('negative');
  });

  it('runs only an eligible engine and puts effect/interval before statistical evidence', () => {
    const scenario = createRecommendedScenario(rateCells());
    const eligibility = evaluateTests({
      design,
      scenario,
      profiles: [rateProfile],
      roleAssignments: { outcome: 'taxa' },
    });

    const run = runGuidedTests({
      design,
      scenario,
      profiles: [rateProfile],
      eligibility,
      selectedTestIds: ['mann-whitney'],
      primaryTestId: 'mann-whitney',
      roleAssignments: { outcome: 'taxa' },
    });

    expect(run.scenarioFingerprint).toBe(scenario.fingerprint);
    expect(run.results).toHaveLength(1);
    expect(run.results[0]).toMatchObject({
      testId: 'mann-whitney',
      role: 'principal',
      coverage: { used: 6 },
    });
    expect(run.results[0]?.metrics.map((metric) => metric.label)).toEqual([
      'Efeito por postos',
      'Estatística U',
      'Evidência estatística',
    ]);
    expect(run.results[0]?.interpretation.at(-1)).toMatch(/não demonstra causalidade/i);
  });

  it('refuses a requested test when the eligibility decision is absent or ineligible', () => {
    const scenario = createRecommendedScenario(rateCells());
    expect(() => runGuidedTests({
      design,
      scenario,
      profiles: [rateProfile],
      eligibility: [],
      selectedTestIds: ['mann-whitney'],
      primaryTestId: 'mann-whitney',
      roleAssignments: { outcome: 'taxa' },
    })).toThrow(/não foi liberado/i);
  });

  it('uses complete aligned pairs for correlation and reports exclusions', () => {
    const predictor: VariableProfile = {
      variableId: 'renda', label: 'Renda', variableType: 'numeric', temporalAggregation: 'weighted_mean',
    };
    const outcome: VariableProfile = {
      variableId: 'taxa', label: 'Taxa', variableType: 'rate', temporalAggregation: 'recompute_rate',
    };
    const cells = rateCells().flatMap((cell, index) => [
      cell,
      {
        ...cell,
        variableId: 'renda',
        rawValue: index === 5 ? null : 1000 + index * 100,
        sourceStatus: index === 5 ? 'missing' as const : 'observed' as const,
        analyticStatus: index === 5 ? 'exclude_missing' as const : 'include' as const,
      },
    ]);
    const scenario = createRecommendedScenario(cells);
    const roles = { outcome: 'taxa', predictor: 'renda' };
    const eligibility = evaluateTests({ design, scenario, profiles: [predictor, outcome], roleAssignments: roles });

    const run = runGuidedTests({
      design,
      scenario,
      profiles: [predictor, outcome],
      eligibility,
      selectedTestIds: ['correlacao'],
      primaryTestId: 'correlacao',
      roleAssignments: roles,
    });

    expect(run.results[0]?.coverage).toEqual({ expected: 6, used: 5, missing: 1 });
    expect(run.results[0]?.chart.ariaLabel).toMatch(/dispersão/i);
  });

  it('runs chi-square only from a validated observed death/non-death table', () => {
    const scenario = createRecommendedScenario(rateCells().map((cell) => ({
      ...cell,
      variableId: 'desfecho_hospitalar',
      rawValue: 100,
    })));
    const contingency = {
      table: [[12, 288], [24, 276]],
      rowLabels: ['Nordeste', 'Sudeste'],
      colLabels: ['Óbito', 'Não óbito'],
      columnHeaders: ['Grupo territorial', 'Desfecho hospitalar'] as [string, string],
      expectedUnits: 6,
      usedUnits: 6,
    };
    const eligibility = evaluateTests({
      design,
      scenario,
      profiles: [categoricalProfile],
      contingencyTable: contingency.table,
    });

    const run = runGuidedTests({
      design,
      scenario,
      profiles: [categoricalProfile],
      eligibility,
      selectedTestIds: ['qui-quadrado'],
      primaryTestId: 'qui-quadrado',
      roleAssignments: {},
      contingency,
    });

    expect(run.results[0]).toMatchObject({
      testId: 'qui-quadrado',
      coverage: { expected: 6, used: 6, missing: 0 },
      outcomeVariableId: 'desfecho_hospitalar',
    });
    expect(run.results[0]?.metrics[0]?.label).toMatch(/efeito/i);
  });
});
