import { describe, expect, it } from 'vitest';
import { selectCommonCoverage } from './commonCoverage';
import type { AnalysisCell, ResearchDesign } from './types';

function design(
  period: ResearchDesign['period'] = {
    scope: 'shared',
    time: { mode: 'range', start: '2023', end: '2025' },
  },
): ResearchDesign {
  return {
    groups: [
      {
        id: 'nordeste',
        name: 'Nordeste',
        territories: [{ id: 'BA', label: 'Bahia' }, { id: 'SE', label: 'Sergipe' }],
      },
      {
        id: 'sudeste',
        name: 'Sudeste',
        territories: [{ id: 'SP', label: 'São Paulo' }, { id: 'RJ', label: 'Rio de Janeiro' }],
      },
    ],
    geography: 'uf',
    locationBasis: 'residencia',
    diseaseIds: ['doenca_teste'],
    period,
    goal: 'compare',
  };
}

function cell(
  groupId: string,
  territoryId: string,
  periodKey: string,
  variableId = 'internacoes',
  overrides: Partial<AnalysisCell> = {},
): AnalysisCell {
  return {
    groupId,
    territoryId,
    periodKey,
    variableId,
    rawValue: 10,
    sourceStatus: 'observed',
    analyticStatus: 'include',
    ...overrides,
  };
}

const units = [
  ['nordeste', 'BA'],
  ['nordeste', 'SE'],
  ['sudeste', 'SP'],
  ['sudeste', 'RJ'],
] as const;

function completePeriod(periodKey: string, variableId = 'internacoes'): AnalysisCell[] {
  return units.map(([groupId, territoryId]) => cell(groupId, territoryId, periodKey, variableId));
}

describe('selectCommonCoverage', () => {
  it('preserves a complete point design without manufacturing a restriction', () => {
    const pointCells = completePeriod('2024');
    const cells = [...pointCells, ...completePeriod('2023')];
    const result = selectCommonCoverage({
      design: design({ scope: 'shared', time: { mode: 'point', point: '2024' } }),
      cells,
    });

    expect(result.state).toBe('no_restriction');
    expect(result.cells).toEqual(pointCells);
    expect(result.diagnostics).toEqual([expect.objectContaining({
      variableId: 'internacoes',
      state: 'no_restriction',
      candidatePeriodKeys: ['2024'],
      commonPeriodKeys: ['2024'],
      excludedPeriodKeys: [],
      expectedUnitCount: 4,
    })]);
    expect(result.explanation).toMatch(/cobertura comum já coincide/i);
  });

  it('keeps only periods usable in every expected group and territory', () => {
    const cells = [
      ...completePeriod('2023'),
      ...completePeriod('2024'),
      ...completePeriod('2025'),
    ];
    cells.find((value) => value.territoryId === 'RJ' && value.periodKey === '2023')!.sourceStatus = 'missing';
    cells.find((value) => value.territoryId === 'BA' && value.periodKey === '2025')!.analyticStatus = 'exclude_missing';

    const result = selectCommonCoverage({ design: design(), cells });

    expect(result.state).toBe('restricted');
    expect(result.cells).toHaveLength(4);
    expect([...new Set(result.cells.map((value) => value.periodKey))]).toEqual(['2024']);
    expect(result.diagnostics[0]).toMatchObject({
      commonPeriodKeys: ['2024'],
      excludedPeriodKeys: ['2023', '2025'],
    });
    expect(result.explanation).toContain('2024');
    expect(result.explanation).toContain('2023, 2025');
    expect(result.explanation).not.toMatch(/MCAR|MAR|MNAR/);
  });

  it('calculates common periods independently for each variable', () => {
    const internacoes = [...completePeriod('2023'), ...completePeriod('2024')];
    internacoes.find((value) => value.territoryId === 'RJ' && value.periodKey === '2023')!.rawValue = null;
    const obitos = [...completePeriod('2023', 'obitos'), ...completePeriod('2024', 'obitos')];

    const result = selectCommonCoverage({
      design: design({ scope: 'shared', time: { mode: 'range', start: '2023', end: '2024' } }),
      cells: [...internacoes, ...obitos],
      variableIds: ['obitos', 'internacoes', 'obitos'],
    });

    expect(result.diagnostics.map((item) => [item.variableId, item.commonPeriodKeys])).toEqual([
      ['internacoes', ['2024']],
      ['obitos', ['2023', '2024']],
    ]);
    expect(result.cells.filter((value) => value.variableId === 'internacoes')).toHaveLength(4);
    expect(result.cells.filter((value) => value.variableId === 'obitos')).toHaveLength(8);
  });

  it('fails closed when an expected territory has no cell at any candidate period', () => {
    const cells = completePeriod('2024').filter((value) => value.territoryId !== 'RJ');

    const result = selectCommonCoverage({
      design: design({ scope: 'shared', time: { mode: 'point', point: '2024' } }),
      cells,
    });

    expect(result.state).toBe('no_common_support');
    expect(result.cells).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({
      commonPeriodKeys: [],
      excludedPeriodKeys: ['2024'],
      missingUnitsByPeriod: { '2024': ['sudeste|RJ'] },
    });
    expect(result.explanation).toMatch(/não existe suporte temporal comum/i);
  });

  it('accepts confirmed collection zero but rejects nonfinite, missing, suppressed and not_queried cells', () => {
    const statuses: AnalysisCell[] = [
      cell('nordeste', 'BA', '2024', 'x', { rawValue: 0, sourceStatus: 'collection_zero' }),
      cell('nordeste', 'SE', '2024', 'x', { rawValue: Number.NaN }),
      cell('sudeste', 'SP', '2024', 'x', { rawValue: null, sourceStatus: 'suppressed' }),
      cell('sudeste', 'RJ', '2024', 'x', { rawValue: null, sourceStatus: 'not_queried' }),
    ];

    const result = selectCommonCoverage({
      design: design({ scope: 'shared', time: { mode: 'point', point: '2024' } }),
      cells: statuses,
    });

    expect(result.state).toBe('no_common_support');
    expect(result.diagnostics[0]?.missingUnitsByPeriod['2024']).toEqual([
      'nordeste|SE', 'sudeste|RJ', 'sudeste|SP',
    ]);
  });

  it('reports no support for an explicitly requested variable absent from the cells', () => {
    const result = selectCommonCoverage({
      design: design({ scope: 'shared', time: { mode: 'point', point: '2024' } }),
      cells: completePeriod('2024'),
      variableIds: ['populacao'],
    });

    expect(result.state).toBe('no_common_support');
    expect(result.cells).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({
      variableId: 'populacao',
      candidatePeriodKeys: ['2024'],
      commonPeriodKeys: [],
    });
  });
});
