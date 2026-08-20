import { describe, expect, it, vi } from 'vitest';
import type { MunicipioPartition } from './loadMunicipioPartition';
import {
  fetchHandoffMetricLookup,
  type HandoffMetricDependencies,
  type HandoffQueryBuilder,
  type HandoffMetricRequest,
  type HandoffSupabaseClient,
} from './fetchHandoffMetrics';

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

/** Mirrors the complete v1 Storage payload: all metadata plus parallel data columns. */
function partition(uf: 'BA' | 'SP', municipio: string): MunicipioPartition {
  return {
    schema: 1,
    uf,
    colunas: [...COLUMNS],
    dados: [
      ['acidente_vascular_cerebral', 'acidente_vascular_cerebral'],
      [municipio, municipio],
      [2020, 2020],
      ['ocorrencia', 'residencia'],
      [uf === 'BA' ? 12 : 0, uf === 'BA' ? 9 : 4],
      [2, 1],
      [1200.5, 900],
      [36, 27],
      [16.67, 11.11],
    ],
    derivedAt: '2026-08-18T18:14:49Z',
    cidMapVersion: '5395d951-fixture',
  };
}

function municipalRequest(overrides: Partial<HandoffMetricRequest> = {}): HandoffMetricRequest {
  return {
    variableIds: ['sih.acidente_vascular_cerebral.internacoes'],
    territories: [{ level: 'municipio', ibgeCode: '292740' }],
    year: 2020,
    locationBasis: 'ocorrencia',
    ...overrides,
  };
}

function deps(overrides: Partial<HandoffMetricDependencies> = {}): HandoffMetricDependencies {
  return {
    getSupabase: () => null,
    loadMunicipioPartition: vi.fn(async (uf: string) => {
      if (uf === 'BA') return partition('BA', '292740');
      if (uf === 'SP') return partition('SP', '355030');
      throw new Error(`unexpected UF ${uf}`);
    }),
    ...overrides,
  };
}

describe('fetchHandoffMetricLookup', () => {
  it('loads each required UF partition once and serves municipal values without a removed-table query', async () => {
    const supabase: HandoffSupabaseClient = {
      from: vi.fn(() => { throw new Error('consulta relacional municipal inesperada'); }),
    };
    const dependencies = deps({ getSupabase: () => supabase });
    const lookup = await fetchHandoffMetricLookup([
      municipalRequest({
        territories: [
          { level: 'municipio', ibgeCode: '292740' },
          { level: 'municipio', ibgeCode: '355030' },
          { level: 'municipio', ibgeCode: '292740' },
        ],
      }),
    ], dependencies);

    expect(dependencies.loadMunicipioPartition).toHaveBeenCalledTimes(2);
    expect(dependencies.loadMunicipioPartition).toHaveBeenCalledWith('BA');
    expect(dependencies.loadMunicipioPartition).toHaveBeenCalledWith('SP');
    expect(supabase.from).not.toHaveBeenCalled();
    expect(lookup?.('sih.acidente_vascular_cerebral.internacoes', '292740', 2020)).toBe(12);
  });

  it('returns a zero observed in the municipal partition literally', async () => {
    const lookup = await fetchHandoffMetricLookup([
      municipalRequest({ territories: [{ level: 'municipio', ibgeCode: '355030' }] }),
    ], deps());

    expect(lookup?.('sih.acidente_vascular_cerebral.internacoes', '355030', 2020)).toBe(0);
  });

  it('keeps occurrence and residence values distinct when selecting municipal rows', async () => {
    const occurrence = await fetchHandoffMetricLookup([municipalRequest()], deps());
    const residence = await fetchHandoffMetricLookup([
      municipalRequest({ locationBasis: 'residencia' }),
    ], deps());

    expect(occurrence?.('sih.acidente_vascular_cerebral.internacoes', '292740', 2020)).toBe(12);
    expect(residence?.('sih.acidente_vascular_cerebral.internacoes', '292740', 2020)).toBe(9);
  });

  it('rejects when a required partition cannot be downloaded or validated', async () => {
    await expect(fetchHandoffMetricLookup([
      municipalRequest(),
    ], deps({ loadMunicipioPartition: async () => { throw new Error('Storage indisponível'); } }))).rejects
      .toThrow(/Storage indisponível/);

    await expect(fetchHandoffMetricLookup([
      municipalRequest(),
    ], deps({ loadMunicipioPartition: async () => ({ ...partition('BA', '292740'), schema: 2 }) }))).rejects
      .toThrow(/Partição municipal inválida/);
  });

  it('rejects an invalid municipal IBGE code before loading any partition', async () => {
    const dependencies = deps();

    await expect(fetchHandoffMetricLookup([
      municipalRequest({ territories: [{ level: 'municipio', ibgeCode: '999999' }] }),
    ], dependencies)).rejects.toThrow(/UF desconhecida|Código municipal inválido/);
    expect(dependencies.loadMunicipioPartition).not.toHaveBeenCalled();
  });

  it('rejects municipal SIH requests without a year instead of selecting an arbitrary year', async () => {
    const dependencies = deps();

    await expect(fetchHandoffMetricLookup([
      municipalRequest({ year: null }),
    ], dependencies)).rejects.toThrow(/ano/i);
    expect(dependencies.loadMunicipioPartition).not.toHaveBeenCalled();
  });

  it('rejects a batch that mixes location bases', async () => {
    await expect(fetchHandoffMetricLookup([
      municipalRequest(),
      municipalRequest({ locationBasis: 'residencia' }),
    ], deps())).rejects.toThrow(/bases|local/i);
  });

  it('filters the UF query by location basis', async () => {
    const eq = vi.fn();
    const result = {
      data: [{
        disease_id: 'acidente_vascular_cerebral',
        uf: 'BA',
        uf_codigo: '29',
        ano: 2020,
        local: 'residencia',
        internacoes: 7,
        obitos: 1,
        valor_total: 500,
        dias_permanencia: 9,
        taxa_mortalidade: 14.29,
      }],
      error: null,
    };
    const query: HandoffQueryBuilder = {
      in: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        eq(column, value);
        return query;
      }),
      then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
    };
    const supabase: HandoffSupabaseClient = {
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    };

    const lookup = await fetchHandoffMetricLookup([{
      variableIds: ['sih.acidente_vascular_cerebral.internacoes'],
      territories: [{ level: 'uf', ibgeCode: '29' }],
      year: 2020,
      locationBasis: 'residencia',
    }], deps({ getSupabase: () => supabase }));

    expect(eq).toHaveBeenCalledWith('local', 'residencia');
    expect(lookup?.('sih.acidente_vascular_cerebral.internacoes', 'BA', 2020)).toBe(7);
  });
});
