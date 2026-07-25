import { describe, expect, it } from 'vitest';
import type { MapAnalysisGroup } from './mapAnalysisState';
import { assembleHandoffTable } from './assembleHandoffTable';

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

function group(overrides: Partial<MapAnalysisGroup> = {}): MapAnalysisGroup {
  return {
    id: 'g1',
    name: 'Grupo 1',
    territoryIds: [baTerritory],
    time: { mode: 'point', point: '2019' },
    variableIds: ['sih.embolia_trombose.internacoes'],
    ...overrides,
  };
}

describe('assembleHandoffTable', () => {
  it('produces wide headers with Território, Grupo, Período and variable columns for one group', () => {
    const result = assembleHandoffTable([group()]);

    expect(result.headers.length).toBeGreaterThanOrEqual(4);
    expect(result.headers[0]).toBe('Território');
    expect(result.headers[1]).toBe('Grupo');
    expect(result.headers[2]).toBe('Período');
    expect(result.headers).toContain('Internações por embolia e trombose arteriais');
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('emits pack metric for SP that is not the old mock UF_WEIGHT value', () => {
    const result = assembleHandoffTable([
      group({
        territoryIds: [spTerritory],
        variableIds: ['mock.internacoes'],
        time: { mode: 'point', point: '2019' },
      }),
    ]);
    const value = Number(result.rows[0]?.[3]);
    expect(value).toBe(5660);
    expect(value).not.toBe(898000);
  });

  it('emits one row per territory for two groups with two variables', () => {
    const groups: MapAnalysisGroup[] = [
      group({
        id: 'g1',
        name: 'Grupo A',
        territoryIds: [baTerritory],
        variableIds: ['sih.embolia_trombose.internacoes'],
      }),
      group({
        id: 'g2',
        name: 'Grupo B',
        territoryIds: [spTerritory],
        time: { mode: 'point', point: '2019' },
        variableIds: ['sih.embolia_trombose.obitos'],
      }),
    ];

    const result = assembleHandoffTable(groups);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.[0]).toBe('BA');
    expect(result.rows[0]?.[1]).toBe('Grupo A');
    expect(result.rows[1]?.[0]).toBe('SP');
    expect(result.sourceLabel).toMatch(/2 grupos/);
  });

  it('prefers paste rows when provenance is hybrid', () => {
    const paste = {
      headers: ['Município', 'Taxa por 100k'],
      rows: [['Salvador', '12,5']],
    };

    const result = assembleHandoffTable([group()], {
      provenance: 'hybrid',
      pasteData: paste,
    });

    expect(result.headers).toEqual(paste.headers);
    expect(result.rows).toEqual(paste.rows);
  });

  it('uses catalog assembly when provenance is catalog even if paste exists', () => {
    const paste = {
      headers: ['Município', 'Taxa por 100k'],
      rows: [['Salvador', '12,5']],
    };

    const result = assembleHandoffTable([group()], {
      provenance: 'catalog',
      pasteData: paste,
    });

    expect(result.headers[0]).toBe('Território');
    expect(result.rows[0]?.[0]).toBe('BA');
  });
});
