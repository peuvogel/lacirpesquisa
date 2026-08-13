import { describe, expect, it } from 'vitest';
import type { MunicipioPartition } from '@/features/catalog/loadMunicipioPartition';
import { indexMunicipioPartition } from './municipioPartitionIndex';

const COLUMNS = [
  'disease_id',
  'municipio_codigo',
  'ano',
  'local',
  'internacoes',
  'obitos',
  'valor_total',
  'dias_permanencia',
  'taxa_mortalidade',
] as const;

function partition(overrides: Partial<MunicipioPartition> = {}): MunicipioPartition {
  return {
    schema: 1,
    uf: 'BA',
    colunas: [...COLUMNS],
    dados: [
      ['acidente_vascular_cerebral', 'acidente_vascular_cerebral'],
      ['292740', '292740'],
      [2020, 2020],
      ['ocorrencia', 'residencia'],
      [12, 9],
      [2, 1],
      [1200.5, 900],
      [36, 27],
      [16.67, 11.11],
    ],
    derivedAt: '2026-08-13T12:00:00Z',
    cidMapVersion: 'fixture-v1',
    ...overrides,
  };
}

describe('indexMunicipioPartition', () => {
  it('indexes rows by disease, municipality, year and location basis', () => {
    const index = indexMunicipioPartition(partition());

    expect(index.size).toBe(2);
    expect(index.get('acidente_vascular_cerebral', '292740', 2020, 'ocorrencia')).toEqual({
      disease_id: 'acidente_vascular_cerebral',
      municipio_codigo: '292740',
      ano: 2020,
      local: 'ocorrencia',
      internacoes: 12,
      obitos: 2,
      valor_total: 1200.5,
      dias_permanencia: 36,
      taxa_mortalidade: 16.67,
    });
    expect(index.get('acidente_vascular_cerebral', '292740', 2020, 'residencia')?.internacoes).toBe(9);
  });

  it.each([
    ['unsupported schema', partition({ schema: 2 })],
    ['missing required column', partition({ colunas: COLUMNS.slice(1) as unknown as string[], dados: partition().dados.slice(1) })],
    ['non-parallel arrays', partition({ dados: partition().dados.map((column, index) => index === 4 ? column.slice(1) : column) })],
    ['municipality outside partition UF', partition({ dados: partition().dados.map((column, index) => index === 1 ? ['282740', '292740'] : column) })],
  ])('rejects %s before exposing a partial index', (_label, payload) => {
    expect(() => indexMunicipioPartition(payload)).toThrow(/partição|schema|coluna|paralel|município/i);
  });

  it('rejects duplicate composite keys instead of silently overwriting a row', () => {
    const duplicate = partition({
      dados: partition().dados.map((column, index) => index === 3 ? ['ocorrencia', 'ocorrencia'] : column),
    });

    expect(() => indexMunicipioPartition(duplicate)).toThrow(/duplicada/i);
  });
});
