import { describe, expect, it } from 'vitest';
import { aggregatePeriod } from './aggregatePeriod';
import type { AnalysisCell, VariableProfile } from './types';

const countProfile: VariableProfile = {
  variableId: 'internacoes',
  label: 'Internações',
  variableType: 'count',
  temporalAggregation: 'sum',
};

const rateProfile: VariableProfile = {
  variableId: 'taxa_internacao_100k',
  label: 'Taxa de internação por 100 mil',
  variableType: 'rate',
  numeratorVariableId: 'internacoes',
  denominatorVariableId: 'populacao',
  rateMultiplier: 100_000,
  temporalAggregation: 'recompute_rate',
};

const meanProfile: VariableProfile = {
  variableId: 'media',
  label: 'Média ponderada',
  variableType: 'numeric',
  exposureVariableId: 'internacoes',
  temporalAggregation: 'weighted_mean',
};

const pointProfile: VariableProfile = {
  variableId: 'desfecho_hospitalar',
  label: 'Desfecho hospitalar',
  variableType: 'categorical',
  temporalAggregation: 'point_only',
};

function cell(variableId: string, periodKey: string, rawValue: number | null): AnalysisCell {
  return {
    territoryId: '29',
    groupId: 'nordeste',
    periodKey,
    variableId,
    rawValue,
    sourceStatus: rawValue === 0 ? 'collection_zero' : 'observed',
    analyticStatus: 'include',
  };
}

function missingCell(variableId: string, periodKey: string): AnalysisCell {
  return {
    ...cell(variableId, periodKey, null),
    sourceStatus: 'missing',
    analyticStatus: 'exclude_missing',
  };
}

function forTerritory(cellValue: AnalysisCell, territoryId: string): AnalysisCell {
  return { ...cellValue, territoryId };
}

function countCells(values: number[]): AnalysisCell[] {
  return values.map((value, index) => cell('internacoes', String(2020 + index), value));
}

function rateCells({ events, population }: { events: number[]; population: number[] }): AnalysisCell[] {
  return events.flatMap((event, index) => [
    cell('internacoes', String(2020 + index), event),
    cell('populacao', String(2020 + index), population[index]!),
  ]);
}

function orphanRateCells(values: number[]): AnalysisCell[] {
  return values.map((value, index) => cell('taxa_internacao_100k', String(2020 + index), value));
}

describe('aggregatePeriod', () => {
  it('sums counts but recomputes a rate from components', () => {
    expect(aggregatePeriod(countCells([10, 0, 20]), countProfile).value).toBe(30);
    expect(
      aggregatePeriod(rateCells({ events: [5, 10], population: [100, 300] }), rateProfile).value,
    ).toBeCloseTo(3750);
  });

  it('never averages annual percentages or substitutes the last year', () => {
    expect(aggregatePeriod(orphanRateCells([10, 20]), rateProfile).status).toBe('not_applicable');
    expect(aggregatePeriod(orphanRateCells([10, 20]), rateProfile).reason).toEqual({
      code: 'missing_component',
      variableIds: ['internacoes', 'populacao'],
    });
  });

  it('returns not applicable when a rate denominator is zero', () => {
    const cells = rateCells({ events: [5], population: [0] });

    expect(aggregatePeriod(cells, rateProfile)).toMatchObject({
      value: null,
      status: 'not_applicable',
      reason: { code: 'invalid_denominator' },
    });
  });

  it('uses the matching exposure as the weight for a mean', () => {
    const cells = [
      cell('media', '2020', 2),
      cell('internacoes', '2020', 100),
      cell('media', '2021', 4),
      cell('internacoes', '2021', 300),
    ];

    expect(aggregatePeriod(cells, meanProfile).value).toBe(3.5);
  });

  it('does not aggregate a point-only variable across years', () => {
    const result = aggregatePeriod(
      [cell('desfecho_hospitalar', '2020', 1), cell('desfecho_hospitalar', '2021', 0)],
      pointProfile,
    );

    expect(result).toMatchObject({
      value: null,
      status: 'not_applicable',
      reason: { code: 'multiple_periods_for_point_only' },
    });
  });

  it('does not substitute the sole observed year when another selected year is missing', () => {
    const result = aggregatePeriod(
      [cell('desfecho_hospitalar', '2020', 1), missingCell('desfecho_hospitalar', '2021')],
      pointProfile,
    );

    expect(result).toMatchObject({
      value: null,
      status: 'not_applicable',
      reason: { code: 'multiple_periods_for_point_only', periodKeys: ['2020', '2021'] },
    });
  });

  it.each([
    ['sum', countProfile, [cell('internacoes', '2020', 10), cell('internacoes', '2021', 20)]],
    [
      'recomputed rate',
      rateProfile,
      rateCells({ events: [5, 10], population: [100, 300] }),
    ],
    [
      'weighted mean',
      meanProfile,
      [
        cell('media', '2020', 2),
        cell('internacoes', '2020', 100),
        cell('media', '2021', 4),
        cell('internacoes', '2021', 300),
      ],
    ],
    ['point only', pointProfile, [cell('desfecho_hospitalar', '2020', 1)]],
  ] as const)('refuses to aggregate %s cells from distinct territories', (_kind, profile, cells) => {
    const mixedTerritories = cells.flatMap((cellValue) => [cellValue, forTerritory(cellValue, '33')]);

    expect(aggregatePeriod(mixedTerritories, profile)).toMatchObject({
      value: null,
      status: 'not_applicable',
      reason: { code: 'multiple_analytic_units' },
    });
  });
});
