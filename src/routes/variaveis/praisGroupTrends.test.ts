import { describe, expect, it } from 'vitest';
import type { AnalysisCell, ResearchDesign, VariableProfile } from '@/features/research/types';
import {
  buildPraisGroupSeries,
  runPraisByGroup,
  runPraisForProfiles,
} from './praisGroupTrends';

const countProfile: VariableProfile = {
  variableId: 'internacoes',
  label: 'Internações',
  variableType: 'count',
  temporalAggregation: 'sum',
};

const deathsProfile: VariableProfile = {
  variableId: 'obitos',
  label: 'Óbitos hospitalares',
  variableType: 'count',
  temporalAggregation: 'sum',
};

const mortalityRateProfile: VariableProfile = {
  variableId: 'taxa_mortalidade',
  label: 'Taxa de mortalidade',
  variableType: 'rate',
  numeratorVariableId: 'obitos',
  denominatorVariableId: 'internacoes',
  rateMultiplier: 100,
  temporalAggregation: 'recompute_rate',
};

const twoGroupRangeDesign: ResearchDesign = {
  groups: [
    {
      id: 'nordeste',
      name: 'Nordeste',
      territories: [{ id: '29', label: 'Bahia' }, { id: '28', label: 'Sergipe' }],
    },
    {
      id: 'sudeste',
      name: 'Sudeste',
      territories: [{ id: '35', label: 'São Paulo' }, { id: '33', label: 'Rio de Janeiro' }],
    },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['teste'],
  period: { scope: 'shared', time: { mode: 'range', start: '2017', end: '2024' } },
};

function cell(
  groupId: string,
  territoryId: string,
  periodKey: string,
  variableId: string,
  rawValue: number,
): AnalysisCell {
  return {
    groupId,
    territoryId,
    periodKey,
    variableId,
    rawValue,
    sourceStatus: rawValue === 0 ? 'collection_zero' : 'observed',
    analyticStatus: 'include',
  };
}

function countCells(): AnalysisCell[] {
  return twoGroupRangeDesign.groups.flatMap((group, groupIndex) => {
    const years = Array.from({ length: 8 }, (_, index) => String(2017 + index));
    return years.flatMap((year) => group.territories.map((territory, territoryIndex) =>
      cell(
        group.id,
        territory.id,
        year,
        'internacoes',
        Number(year) === 2017 && group.id === 'nordeste' && territoryIndex === 0
          ? 0
          : 10 + groupIndex * 4 + territoryIndex + (Number(year) - 2017) ** 2,
      )));
  });
}

describe('Prais–Winsten por grupo territorial', () => {
  it('builds and runs one regular annual series per selected group while preserving zero', () => {
    const sourceCells = countCells();
    const series = buildPraisGroupSeries(twoGroupRangeDesign, sourceCells, countProfile);
    const run = runPraisByGroup({
      design: twoGroupRangeDesign,
      sourceCells,
      profile: countProfile,
    });

    expect(series.map((item) => item.groupId)).toEqual(['nordeste', 'sudeste']);
    expect(series[0]?.rows).toHaveLength(8);
    expect(series[0]?.rows[0]).toEqual({ year: 2017, value: 11 });
    expect(run.results.map((result) => result.groupId)).toEqual(['nordeste', 'sudeste']);
    expect(run.results.every((result) => result.metrics.length > 0)).toBe(true);
    expect(run.results[0]?.interpretation[0]).toMatch(/somente para Nordeste.*não testa diferença/i);
    expect(run.skippedGroups).toEqual([]);
  });

  it('recomputes a rate from summed group-year components instead of averaging territorial rates', () => {
    const sourceCells = Array.from({ length: 8 }, (_, index) => ({
      year: String(2017 + index),
      index,
    })).flatMap(({ year, index }) => [
      cell('nordeste', '29', year, 'obitos', index === 0 ? 1 : 2 + index),
      cell('nordeste', '29', year, 'internacoes', index === 0 ? 5 : 20 + index),
      cell('nordeste', '29', year, 'taxa_mortalidade', index === 0 ? 20 : 0),
      cell('nordeste', '28', year, 'obitos', index === 0 ? 2 : 4 + index),
      cell('nordeste', '28', year, 'internacoes', index === 0 ? 25 : 40 + index),
      cell('nordeste', '28', year, 'taxa_mortalidade', index === 0 ? 8 : 0),
    ]);
    const oneGroupDesign = { ...twoGroupRangeDesign, groups: [twoGroupRangeDesign.groups[0]!] };

    const series = buildPraisGroupSeries(oneGroupDesign, sourceCells, mortalityRateProfile);

    expect(series[0]?.rows[0]?.value).toBeCloseTo((3 / 30) * 100);
    expect(series[0]?.rows[0]?.value).not.toBeCloseTo((20 + 8) / 2);
  });

  it('keeps an invalid group visible without blocking a valid group or imputing its missing year', () => {
    const sourceCells = countCells().filter((item) =>
      !(item.groupId === 'sudeste' && item.periodKey === '2020'));

    const series = buildPraisGroupSeries(twoGroupRangeDesign, sourceCells, countProfile);
    const run = runPraisByGroup({
      design: twoGroupRangeDesign,
      sourceCells,
      profile: countProfile,
    });

    expect(series.find((item) => item.groupId === 'sudeste')?.rows.map((row) => row.year))
      .toEqual([2017, 2018, 2019, 2021, 2022, 2023, 2024]);
    expect(run.results.map((result) => result.groupId)).toEqual(['nordeste']);
    expect(run.skippedGroups).toEqual([{
      groupId: 'sudeste',
      groupLabel: 'Sudeste',
      outcomeVariableId: 'internacoes',
      reason: expect.stringContaining('8 pontos'),
    }]);
  });

  it('evaluates every variable × group combination without favorable selection or Holm', () => {
    const admissions = countCells();
    const deaths = admissions.map((item, index) => ({
      ...item,
      variableId: 'obitos',
      rawValue: 2 + (index % 7) ** 2,
      sourceStatus: 'observed' as const,
    })).filter((item) => !(item.groupId === 'sudeste' && item.periodKey === '2021'));

    const run = runPraisForProfiles({
      design: twoGroupRangeDesign,
      sourceCells: [...admissions, ...deaths],
      profiles: [countProfile, deathsProfile],
    });

    expect(run.results.map((result) => `${result.outcomeVariableId}:${result.groupId}`)).toEqual([
      'internacoes:nordeste',
      'internacoes:sudeste',
      'obitos:nordeste',
    ]);
    expect(run.skippedGroups).toEqual([expect.objectContaining({
      groupId: 'sudeste',
      outcomeVariableId: 'obitos',
    })]);
    expect(run.results.flatMap((result) => result.metrics).map((metric) => metric.label).join(' '))
      .not.toMatch(/Holm|ajustado/i);
  });

  it('fails closed for a selected variable that is not count, rate or numeric', () => {
    const ordinalProfile: VariableProfile = {
      ...countProfile,
      variableType: 'ordinal',
      label: 'Faixa ordinal',
    };

    const run = runPraisByGroup({
      design: twoGroupRangeDesign,
      sourceCells: countCells(),
      profile: ordinalProfile,
    });

    expect(run.results).toEqual([]);
    expect(run.skippedGroups).toHaveLength(2);
    expect(run.skippedGroups.every((item) => item.outcomeVariableId === 'internacoes')).toBe(true);
  });
});
