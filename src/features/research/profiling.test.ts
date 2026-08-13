import { describe, expect, it } from 'vitest';
import {
  completePairs,
  profileVariable,
  shapiroWilk,
} from './profiling';
import type { AnalysisCell, VariableProfile } from './types';

const numericProfile: VariableProfile = {
  variableId: 'desfecho',
  label: 'Desfecho',
  variableType: 'numeric',
  temporalAggregation: 'point_only',
};

const countProfile: VariableProfile = {
  variableId: 'eventos',
  label: 'Eventos',
  variableType: 'count',
  temporalAggregation: 'sum',
};

function cell(
  rawValue: number | null,
  overrides: Partial<AnalysisCell> = {},
): AnalysisCell {
  return {
    territoryId: 'BA',
    groupId: 'grupo-a',
    periodKey: '2024',
    variableId: 'desfecho',
    rawValue,
    sourceStatus: rawValue === null ? 'missing' : 'observed',
    analyticStatus: rawValue === null ? 'exclude_missing' : 'include',
    ...overrides,
  };
}

function values(
  input: readonly number[],
  overrides: Partial<AnalysisCell> = {},
): AnalysisCell[] {
  return input.map((value, index) =>
    cell(value, {
      territoryId: `T${String(index + 1).padStart(2, '0')}`,
      ...overrides,
    }),
  );
}

describe('profileVariable', () => {
  it('summarizes usable values and keeps missing and zero counts explicit', () => {
    const profile = profileVariable(
      [
        ...values([0, 1, 2, 3, 9]),
        cell(null, { territoryId: 'T06' }),
        cell(99, { territoryId: 'T07', analyticStatus: 'exclude_manual' }),
      ],
      numericProfile,
    );

    expect(profile.overall).toMatchObject({
      expectedN: 7,
      n: 5,
      missingCount: 2,
      zeroCount: 1,
      zeroShare: 0.2,
      mean: 3,
      median: 2,
      sampleSd: Math.sqrt(12.5),
      iqr: 2,
      min: 0,
      max: 9,
    });
    // Fisher–Pearson adjusted sample skewness (the convention used by scipy/Excel SKEW).
    expect(profile.overall.skewness).toBeCloseTo(1.697, 3);
    expect(profile.overall.outliers).toEqual([
      expect.objectContaining({ territoryId: 'T05', value: 9 }),
    ]);
    expect(profile.overall.histogramBins.reduce((sum, bin) => sum + bin.count, 0)).toBe(5);
    expect(profile.overall.qqPoints).toHaveLength(5);
    expect(profile.overall.qqPoints.map((point) => point.observed)).toEqual([0, 1, 2, 3, 9]);
  });

  it('evaluates normality inside each independent group instead of pooling groups', () => {
    const normalShape = [-1.2, -0.8, -0.4, -0.1, 0.1, 0.35, 0.7, 1, 1.4, 1.8];
    const cells = [
      ...values(normalShape, { groupId: 'grupo-a' }),
      ...values(normalShape.map((value) => value + 20), { groupId: 'grupo-b' }),
    ];

    const profile = profileVariable(cells, numericProfile);

    expect(Object.keys(profile.byGroup)).toEqual(['grupo-a', 'grupo-b']);
    expect(profile.byGroup['grupo-a']?.normality.classification).toBe('approximately_normal');
    expect(profile.byGroup['grupo-b']?.normality.classification).toBe('approximately_normal');
    expect(profile.normalityScope).toBe('within_groups');
  });

  it('does not classify normality from Shapiro p-value alone', () => {
    const profile = profileVariable(values([0, 1, 2, 3, 9]), numericProfile);
    const normality = profile.byGroup['grupo-a']?.normality;

    expect(normality?.shapiro).toMatchObject({ state: 'supported' });
    if (normality?.shapiro?.state !== 'supported') throw new Error('fixture should be supported');
    expect(normality.shapiro.pValue).toBeGreaterThan(0.05);
    expect(normality?.diagnostics.outlierShare).toBe(0.2);
    expect(normality?.classification).toBe('non_normal');
  });

  it('reports count dispersion and makes normality not applicable', () => {
    const profile = profileVariable(
      values([0, 0, 1, 4], { variableId: 'eventos' }),
      countProfile,
    );

    expect(profile.overall).toMatchObject({ zeroCount: 2, zeroShare: 0.5 });
    // Fano factor: sample variance divided by the sample mean.
    expect(profile.overall.dispersionIndex).toBeCloseTo(2.8666666666666667, 12);
    expect(profile.byGroup['grupo-a']?.normality).toEqual({
      state: 'not_applicable',
      classification: 'not_applicable',
      diagnostics: expect.objectContaining({ reason: 'count_distribution' }),
    });
  });
});

describe('shapiroWilk', () => {
  it('matches R shapiro.test for a supported sample', () => {
    const result = shapiroWilk([-1.2, -0.8, -0.4, -0.1, 0.1, 0.35, 0.7, 1, 1.4, 1.8]);

    expect(result.state).toBe('supported');
    if (result.state !== 'supported') throw new Error('fixture should be supported');
    expect(result.w).toBeCloseTo(0.985548024834336, 7);
    expect(result.pValue).toBeCloseTo(0.987918550877331, 6);
  });

  it('reports stable boundary states for unsupported samples', () => {
    expect(shapiroWilk([1, 2])).toEqual({ state: 'insufficient', n: 2 });
    expect(shapiroWilk(Array.from({ length: 5001 }, (_, index) => index))).toEqual({
      state: 'insufficient',
      n: 5001,
    });
    expect(shapiroWilk([1, 1, 1])).toEqual({ state: 'insufficient', n: 3 });
  });
});

describe('completePairs', () => {
  it('pairs only the requested variables in the same analytic scope and reports n', () => {
    const cells = [
      cell(10, { territoryId: 'BA', variableId: 'x' }),
      cell(20, { territoryId: 'BA', variableId: 'y' }),
      cell(30, { territoryId: 'SE', variableId: 'x' }),
      cell(null, { territoryId: 'SE', variableId: 'y' }),
      cell(40, { territoryId: 'PE', periodKey: '2023', variableId: 'x' }),
      cell(50, { territoryId: 'PE', periodKey: '2024', variableId: 'y' }),
      cell(null, { territoryId: 'BA', variableId: 'unrelated' }),
    ];

    expect(completePairs(cells, 'x', 'y')).toEqual({
      n: 1,
      excludedScopeCount: 2,
      pairs: [
        {
          groupId: 'grupo-a',
          territoryId: 'BA',
          periodKey: '2024',
          x: 10,
          y: 20,
        },
      ],
    });
  });
});
