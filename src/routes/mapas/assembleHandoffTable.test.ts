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
    time: { mode: 'point', point: '2020' },
    variableIds: ['mock.internacoes'],
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
    expect(result.headers).toContain('Internações hospitalares');
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('emits one row per territory for two groups with two variables', () => {
    const groups: MapAnalysisGroup[] = [
      group({
        id: 'g1',
        name: 'Grupo A',
        territoryIds: [baTerritory],
        variableIds: ['mock.internacoes'],
      }),
      group({
        id: 'g2',
        name: 'Grupo B',
        territoryIds: [spTerritory],
        time: { mode: 'point', point: '2021' },
        variableIds: ['mock.obitos'],
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

  it('uses mock assembly when provenance is mock even if paste exists', () => {
    const paste = {
      headers: ['Município', 'Taxa por 100k'],
      rows: [['Salvador', '12,5']],
    };

    const result = assembleHandoffTable([group()], {
      provenance: 'mock',
      pasteData: paste,
    });

    expect(result.headers[0]).toBe('Território');
    expect(result.rows[0]?.[0]).toBe('BA');
  });
});
