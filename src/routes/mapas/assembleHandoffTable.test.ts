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
    variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
    ...overrides,
  };
}

describe('assembleHandoffTable', () => {
  it('produces clean headers Território, Grupo and short measure for point mode', () => {
    const result = assembleHandoffTable([group()]);

    expect(result.headers[0]).toBe('Território');
    expect(result.headers[1]).toBe('Grupo');
    expect(result.headers).toContain('Internações');
    expect(result.headers).not.toContain('Período');
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows[0]?.every((cell) => cell.toLowerCase() !== 'n/d')).toBe(true);
  });

  it('emits pack metric for SP that is not the old mock UF_WEIGHT value', () => {
    const result = assembleHandoffTable([
      group({
        territoryIds: [spTerritory],
        variableIds: ['mock.internacoes'],
        time: { mode: 'point', point: '2019' },
      }),
    ]);
    const value = Number(result.rows[0]?.[2]);
    expect(value).toBe(5660);
    expect(value).not.toBe(898000);
  });

  it('emits one row per territory for two groups with two variables', () => {
    const groups: MapAnalysisGroup[] = [
      group({
        id: 'g1',
        name: 'Grupo A',
        territoryIds: [baTerritory],
        variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
      }),
      group({
        id: 'g2',
        name: 'Grupo B',
        territoryIds: [spTerritory],
        time: { mode: 'point', point: '2019' },
        variableIds: ['sih.embolia_e_trombose_arteriais.obitos'],
      }),
    ];

    const result = assembleHandoffTable(groups);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.[0]).toBe('BA');
    expect(result.rows[0]?.[1]).toBe('Grupo A');
    expect(result.rows[1]?.[0]).toBe('SP');
    expect(result.sourceLabel).toMatch(/2 grupos/);
    expect(result.headers).toEqual(expect.arrayContaining(['Internações', 'Óbitos']));
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

  it('skips município rows when no muni metric is available (no UF leakage)', () => {
    const result = assembleHandoffTable([
      group({
        territoryIds: [
          {
            level: 'municipio',
            ibgeCode: '292740',
            name: 'Salvador',
          },
        ],
      }),
    ]);
    expect(result.rows).toHaveLength(0);
  });
});
