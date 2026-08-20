import { describe, expect, it, vi } from 'vitest';
import type { MunicipioPartition } from '@/features/catalog/loadMunicipioPartition';
import type { ResearchDesign, VariableProfile } from './types';
import {
  createResearchDesignFromMapState,
  type MapAnalysisState,
} from '@/routes/mapas/mapAnalysisState';
import {
  ResearchRepositoryError,
  createResearchRepository,
} from './supabaseResearchRepository';

interface QueryState {
  table: string;
  select?: string;
  filters: Array<{ kind: 'in' | 'eq'; column: string; value: unknown }>;
  orders: Array<{ column: string; ascending: boolean }>;
  range?: [number, number];
  signal?: AbortSignal;
}

interface FakeResponse {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
}

type Responder = (state: QueryState, attempt: number) => FakeResponse | Promise<FakeResponse>;

class FakeQuery implements PromiseLike<FakeResponse> {
  private readonly state: QueryState;

  constructor(
    table: string,
    private readonly execute: (state: QueryState) => Promise<FakeResponse>,
  ) {
    this.state = { table, filters: [], orders: [] };
  }

  select(columns: string) {
    this.state.select = columns;
    return this;
  }

  in(column: string, value: unknown[]) {
    this.state.filters.push({ kind: 'in', column, value: [...value] });
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ kind: 'eq', column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.state.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  range(from: number, to: number) {
    this.state.range = [from, to];
    return this;
  }

  abortSignal(signal: AbortSignal) {
    this.state.signal = signal;
    return this;
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?: ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute(this.state).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  readonly requests: QueryState[] = [];
  private attempts = new Map<string, number>();

  constructor(private readonly responders: Record<string, Responder>) {}

  from(table: string) {
    return new FakeQuery(table, async (state) => {
      const snapshot: QueryState = {
        ...state,
        filters: state.filters.map((filter) => ({ ...filter })),
        orders: state.orders.map((order) => ({ ...order })),
      };
      this.requests.push(snapshot);
      if (state.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const attempt = (this.attempts.get(table) ?? 0) + 1;
      this.attempts.set(table, attempt);
      return (this.responders[table] ?? (() => ({ data: [], error: null })))(snapshot, attempt);
    });
  }

  callsFor(table: string) {
    return this.requests.filter((request) => request.table === table);
  }
}

const baseProfiles: VariableProfile[] = [
  { variableId: 'internacoes', label: 'Internações', variableType: 'count', temporalAggregation: 'sum' },
  { variableId: 'obitos', label: 'Óbitos', variableType: 'count', temporalAggregation: 'sum' },
  { variableId: 'valor_total', label: 'Valor', variableType: 'numeric', temporalAggregation: 'sum' },
  { variableId: 'dias_permanencia', label: 'Dias', variableType: 'numeric', temporalAggregation: 'sum' },
  {
    variableId: 'taxa_mortalidade',
    label: 'Taxa',
    variableType: 'rate',
    numeratorVariableId: 'obitos',
    denominatorVariableId: 'internacoes',
    temporalAggregation: 'recompute_rate',
  },
];

const populationRate: VariableProfile = {
  variableId: 'taxa_internacao_100k',
  label: 'Taxa por 100 mil',
  variableType: 'rate',
  numeratorVariableId: 'internacoes',
  denominatorVariableId: 'populacao',
  temporalAggregation: 'recompute_rate',
};

function ufDesign(overrides: Partial<ResearchDesign> = {}): ResearchDesign {
  return {
    groups: [{
      id: 'grupo-nordeste',
      name: 'Nordeste',
      territories: [{ id: '29', label: 'Bahia' }, { id: '28', label: 'Sergipe' }],
    }],
    geography: 'uf',
    locationBasis: 'residencia',
    diseaseIds: ['acidente_vascular_cerebral', 'diabetes_mellitus'],
    period: { scope: 'shared', time: { mode: 'range', start: '2020-11', end: '2021-02' } },
    ...overrides,
  };
}

function metricRow(overrides: Record<string, unknown> = {}) {
  return {
    disease_id: 'acidente_vascular_cerebral',
    uf_codigo: '29',
    ano: 2020,
    local: 'residencia',
    internacoes: 12,
    obitos: 2,
    valor_total: 1200,
    dias_permanencia: 36,
    taxa_mortalidade: 16.67,
    ...overrides,
  };
}

function municipioMetricRow(overrides: Record<string, unknown> = {}) {
  return {
    disease_id: 'acidente_vascular_cerebral',
    municipio_codigo: '292740',
    ano: 2020,
    local: 'ocorrencia',
    internacoes: 7,
    obitos: 1,
    valor_total: 700,
    dias_permanencia: 14,
    taxa_mortalidade: 14.29,
    ...overrides,
  };
}

function municipioPartition(
  uf: string,
  rows: Array<Record<string, unknown>>,
): MunicipioPartition {
  const columns = [
    'disease_id', 'municipio_codigo', 'ano', 'local', 'internacoes', 'obitos',
    'valor_total', 'dias_permanencia', 'taxa_mortalidade',
  ];
  return {
    schema: 1,
    uf,
    colunas: columns,
    dados: columns.map((column) => rows.map((row) => row[column])),
    derivedAt: '2026-08-13T00:00:00Z',
    cidMapVersion: 'v1',
  };
}

function ledgerRows() {
  return ['acidente_vascular_cerebral', 'diabetes_mellitus'].flatMap((disease_id) =>
    [2020, 2021].flatMap((ano) =>
      ['internacoes', 'obitos', 'valor_total', 'dias_permanencia'].map((medida) => ({
        disease_id,
        medida,
        grao: 'uf',
        local: 'residencia',
        ano,
        status: 'coletado',
        derived_at: '2026-08-13T00:00:00Z',
        cid_map_version: 'v1',
      })),
    ),
  );
}

describe('Supabase research repository', () => {
  it('deduplicates concurrent identical loads and batches all selected profiles', async () => {
    const client = new FakeSupabase({
      sih_metric_uf: () => ({ data: [metricRow()], error: null }),
      sih_collection_status: () => ({ data: ledgerRows(), error: null }),
    });
    const repo = createResearchRepository({ supabase: client });

    const [first, second] = await Promise.all([
      repo.load(ufDesign(), baseProfiles),
      repo.load(ufDesign(), [...baseProfiles].reverse()),
    ]);

    expect(second).toBe(first);
    expect(client.callsFor('sih_metric_uf')).toHaveLength(1);
    expect(client.callsFor('sih_collection_status')).toHaveLength(1);
    expect(client.requests).toHaveLength(2);
    expect(client.callsFor('sih_population_total_uf')).toHaveLength(0);

    const metricQuery = client.callsFor('sih_metric_uf')[0]!;
    expect(metricQuery.filters).toEqual(expect.arrayContaining([
      { kind: 'in', column: 'disease_id', value: ['acidente_vascular_cerebral', 'diabetes_mellitus'] },
      { kind: 'in', column: 'uf_codigo', value: ['28', '29'] },
      { kind: 'in', column: 'ano', value: [2020, 2021] },
      { kind: 'eq', column: 'local', value: 'residencia' },
    ]));
    expect(metricQuery.orders.map(({ column }) => column)).toEqual([
      'disease_id', 'uf_codigo', 'ano', 'local',
    ]);
  });

  it('loads population only when required and preserves empty denominators as missing', async () => {
    const client = new FakeSupabase({
      sih_metric_uf: () => ({ data: [metricRow()], error: null }),
      sih_collection_status: () => ({ data: ledgerRows(), error: null }),
      sih_population_total_uf: () => ({ data: [], error: null }),
    });
    const repo = createResearchRepository({ supabase: client });

    const snapshot = await repo.load(ufDesign(), [populationRate]);

    expect(client.callsFor('sih_population_total_uf')).toHaveLength(1);
    const populationCell = snapshot.cells.find((cell) =>
      cell.diseaseId === 'acidente_vascular_cerebral' &&
      cell.territoryId === '29' &&
      cell.periodKey === '2020' &&
      cell.variableId === 'populacao');
    expect(populationCell).toMatchObject({ rawValue: null, sourceStatus: 'missing' });
  });

  it('paginates to a short page with a complete stable order and never truncates a full page', async () => {
    const rows = [
      metricRow({ uf_codigo: '28' }),
      metricRow({ uf_codigo: '29' }),
      metricRow({ disease_id: 'diabetes_mellitus', uf_codigo: '28' }),
    ];
    const client = new FakeSupabase({
      sih_metric_uf: (state) => {
        const [from, to] = state.range!;
        return { data: rows.slice(from, to + 1), error: null };
      },
      sih_collection_status: () => ({ data: [], error: null }),
    });
    const repo = createResearchRepository({ supabase: client, pageSize: 2 });

    const snapshot = await repo.load(ufDesign({ period: { scope: 'shared', time: { mode: 'point', point: '2020' } } }), [baseProfiles[0]!]);

    expect(client.callsFor('sih_metric_uf').map((query) => query.range)).toEqual([[0, 1], [2, 3]]);
    expect(snapshot.cells.find((cell) =>
      cell.diseaseId === 'diabetes_mellitus' && cell.territoryId === '28')?.rawValue).toBe(12);
  });

  it('fails closed when the bounded pagination cannot prove exhaustion', async () => {
    const client = new FakeSupabase({
      sih_metric_uf: (state) => ({
        data: [metricRow({ uf_codigo: state.range?.[0] === 0 ? '28' : '29' })],
        error: null,
      }),
      sih_collection_status: () => ({ data: [], error: null }),
    });
    const repo = createResearchRepository({ supabase: client, pageSize: 1, maxPages: 2 });

    await expect(repo.load(
      ufDesign({ period: { scope: 'shared', time: { mode: 'point', point: '2020' } } }),
      [baseProfiles[0]!],
    )).rejects.toMatchObject({ code: 'pagination_limit' });
    expect(client.callsFor('sih_metric_uf')).toHaveLength(2);
  });

  it('fails closed on a duplicate primary key across pages', async () => {
    const client = new FakeSupabase({
      sih_metric_uf: () => ({ data: [metricRow()], error: null }),
      sih_collection_status: () => ({ data: [], error: null }),
    });
    const repo = createResearchRepository({ supabase: client, pageSize: 1 });

    await expect(repo.load(
      ufDesign({ period: { scope: 'shared', time: { mode: 'point', point: '2020' } } }),
      [baseProfiles[0]!],
    )).rejects.toMatchObject({ code: 'unstable_pagination' });
  });

  it('turns ledger failure or an absent ledger row into missing, never collection zero', async () => {
    const client = new FakeSupabase({
      sih_metric_uf: () => ({ data: [], error: null }),
      sih_collection_status: () => ({
        data: [{
          disease_id: 'acidente_vascular_cerebral', medida: 'internacoes', grao: 'uf',
          local: 'residencia', ano: 2020, status: 'falhou', derived_at: null, cid_map_version: null,
        }],
        error: null,
      }),
    });
    const repo = createResearchRepository({ supabase: client });
    const design = ufDesign({
      diseaseIds: ['acidente_vascular_cerebral'],
      period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
    });

    const snapshot = await repo.load(design, [baseProfiles[0]!]);

    expect(snapshot.cells.map((cell) => cell.sourceStatus)).toEqual(['missing', 'missing']);
    expect(snapshot.cells.every((cell) => cell.rawValue === null)).toBe(true);
  });

  it('fails explicitly without a configured anon client and retries after rejected loads', async () => {
    const missingClient = createResearchRepository({ supabase: null });
    await expect(missingClient.load(ufDesign(), [baseProfiles[0]!])).rejects.toMatchObject({
      code: 'supabase_not_configured',
    });

    const client = new FakeSupabase({
      sih_metric_uf: (_state, attempt) => attempt === 1
        ? { data: null, error: { message: 'temporary failure' } }
        : { data: [metricRow()], error: null },
      sih_collection_status: () => ({ data: ledgerRows(), error: null }),
    });
    const repo = createResearchRepository({ supabase: client });
    await expect(repo.load(ufDesign(), [baseProfiles[0]!])).rejects.toBeInstanceOf(ResearchRepositoryError);
    await expect(repo.load(ufDesign(), [baseProfiles[0]!])).resolves.toMatchObject({ cells: expect.any(Array) });
    expect(client.callsFor('sih_metric_uf')).toHaveLength(2);
  });

  it('loads one indexed Storage partition per unique municipality UF and reports partition failure as not_queried', async () => {
    const client = new FakeSupabase({
      sih_collection_status: () => ({
        data: [{
          disease_id: 'acidente_vascular_cerebral', medida: 'internacoes', grao: 'municipio',
          local: 'ocorrencia', ano: 2020, status: 'coletado', derived_at: '2026-08-13T00:00:00Z', cid_map_version: 'v1',
        }],
        error: null,
      }),
    });
    const baPartition = municipioPartition('BA', [municipioMetricRow()]);
    const loadPartition = vi.fn(async (uf: string) => {
      if (uf === 'BA') return baPartition;
      throw new Error('SE unavailable');
    });
    const repo = createResearchRepository({ supabase: client, loadMunicipioPartition: loadPartition });
    const design = ufDesign({
      geography: 'municipio',
      locationBasis: 'ocorrencia',
      diseaseIds: ['acidente_vascular_cerebral'],
      groups: [{
        id: 'capitais',
        name: 'Capitais',
        territories: [
          { id: '292740', label: 'Salvador' },
          { id: '280030', label: 'Aracaju' },
          { id: '292740', label: 'Salvador repetida' },
        ],
      }],
      period: { scope: 'shared', time: { mode: 'point', point: '2020-07' } },
    });

    const snapshot = await repo.load(design, [baseProfiles[0]!]);

    expect(loadPartition.mock.calls.map(([uf]) => uf).sort()).toEqual(['BA', 'SE']);
    expect(client.callsFor('sih_metric_uf')).toHaveLength(0);
    expect(client.callsFor('sih_collection_status')).toHaveLength(1);
    expect(snapshot.cells.find((cell) => cell.territoryId === '292740')).toMatchObject({ rawValue: 7, sourceStatus: 'observed' });
    expect(snapshot.cells.find((cell) => cell.territoryId === '280030')).toMatchObject({ rawValue: null, sourceStatus: 'not_queried' });
    expect(snapshot.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'municipio_partition_unavailable', territoryIds: ['280030'] }),
    ]));
  });

  it('normalizes the canonical seven-digit Mapas municipality only at SIH transport boundaries', async () => {
    const client = new FakeSupabase({
      sih_collection_status: () => ({
        data: [{
          disease_id: 'embolia_e_trombose_arteriais', medida: 'internacoes', grao: 'municipio',
          local: 'ocorrencia', ano: 2020, status: 'coletado', derived_at: '2026-08-13T00:00:00Z', cid_map_version: 'v1',
        }],
        error: null,
      }),
      sih_population_total_muni: () => ({
        data: [{ municipio_codigo: '292740', uf_codigo: '29', ano: 2020, populacao: 2_900_000 }],
        error: null,
      }),
    });
    const mapState: MapAnalysisState = {
      groups: [{
        id: 'salvador',
        name: 'Salvador',
        territoryIds: [{ level: 'municipio', ibgeCode: '2927408', sigla: 'BA', name: 'Salvador' }],
        time: { mode: 'point', point: '2020' },
        variableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
      }],
      activeGroupId: 'salvador',
      mapView: { level: 'municipio', parentCode: 'BA', ufIbge: '29' },
      provenance: 'catalog',
      sharedTime: { mode: 'point', point: '2020' },
      periodScope: 'shared',
      locationBasis: 'ocorrencia',
    };
    const designResult = createResearchDesignFromMapState(mapState);
    expect(designResult.ok).toBe(true);
    if (!designResult.ok) throw new Error('recorte municipal deveria ser válido');
    const loadPartition = vi.fn(async () => municipioPartition('BA', [municipioMetricRow({
      disease_id: 'embolia_e_trombose_arteriais',
    })]));
    const repo = createResearchRepository({ supabase: client, loadMunicipioPartition: loadPartition });

    const snapshot = await repo.load(designResult.value, [baseProfiles[0]!, populationRate]);

    expect(loadPartition).toHaveBeenCalledWith('BA', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(client.callsFor('sih_population_total_muni')[0]?.filters).toContainEqual({
      kind: 'in', column: 'municipio_codigo', value: ['292740'],
    });
    expect(snapshot.cells.find((cell) => cell.variableId === 'internacoes')).toMatchObject({
      territoryId: '2927408', rawValue: 7, sourceStatus: 'observed',
    });
    expect(snapshot.cells.find((cell) => cell.variableId === 'populacao')).toMatchObject({
      territoryId: '2927408', rawValue: 2_900_000, sourceStatus: 'observed',
    });
  });

  it('isolates caller abort from an identical shared load and rejects aborted cache reads', async () => {
    let releaseFirstMetric: (() => void) | undefined;
    const client = new FakeSupabase({
      sih_metric_uf: (_state, attempt) => attempt === 1
        ? new Promise<FakeResponse>((resolve) => {
            releaseFirstMetric = () => resolve({ data: [metricRow()], error: null });
          })
        : { data: [metricRow()], error: null },
      sih_collection_status: () => ({ data: ledgerRows(), error: null }),
    });
    const repo = createResearchRepository({ supabase: client });
    const staleController = new AbortController();
    const activeController = new AbortController();

    const stale = repo.load(ufDesign(), [baseProfiles[0]!], { signal: staleController.signal });
    const active = repo.load(ufDesign(), [baseProfiles[0]!], { signal: activeController.signal });
    await vi.waitFor(() => expect(releaseFirstMetric).toBeTypeOf('function'));
    staleController.abort();
    await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    releaseFirstMetric!();
    const snapshot = await active;

    expect(client.callsFor('sih_metric_uf')).toHaveLength(1);
    expect(client.callsFor('sih_metric_uf')[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(client.callsFor('sih_metric_uf')[0]?.signal).not.toBe(staleController.signal);
    expect(client.callsFor('sih_metric_uf')[0]?.signal).not.toBe(activeController.signal);
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(repo.load(
      ufDesign(),
      [baseProfiles[0]!],
      { signal: alreadyAborted.signal },
    )).rejects.toMatchObject({ name: 'AbortError' });
    await expect(repo.load(ufDesign(), [baseProfiles[0]!])).resolves.toBe(snapshot);
  });

  it('keeps a shared municipal load alive when one of two consumers abandons it', async () => {
    const client = new FakeSupabase({ sih_collection_status: () => ({ data: [], error: null }) });
    let release: (() => void) | undefined;
    let internalSignal: AbortSignal | undefined;
    const loader = vi.fn((uf: string, options?: { signal?: AbortSignal }) => new Promise<MunicipioPartition>((resolve, reject) => {
      internalSignal = options?.signal;
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      release = () => resolve(municipioPartition(uf, [municipioMetricRow()]));
    }));
    const repo = createResearchRepository({ supabase: client, loadMunicipioPartition: loader });
    const design = ufDesign({
      geography: 'municipio', locationBasis: 'ocorrencia', diseaseIds: ['acidente_vascular_cerebral'],
      groups: [{ id: 'salvador', name: 'Salvador', territories: [{ id: '292740', label: 'Salvador' }] }],
      period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
    });
    const abandoned = new AbortController();
    const active = new AbortController();

    const first = repo.load(design, [baseProfiles[0]!], { signal: abandoned.signal });
    const second = repo.load(design, [baseProfiles[0]!], { signal: active.signal });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    abandoned.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(internalSignal?.aborted).toBe(false);
    release!();
    await expect(second).resolves.toMatchObject({ cells: expect.any(Array) });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('aborts the shared municipal work only after every consumer abandons it', async () => {
    const client = new FakeSupabase({ sih_collection_status: () => ({ data: [], error: null }) });
    let internalSignal: AbortSignal | undefined;
    const loader = vi.fn((_uf: string, options?: { signal?: AbortSignal }) => new Promise<MunicipioPartition>((_resolve, reject) => {
      internalSignal = options?.signal;
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const repo = createResearchRepository({ supabase: client, loadMunicipioPartition: loader });
    const design = ufDesign({
      geography: 'municipio', locationBasis: 'ocorrencia', diseaseIds: ['acidente_vascular_cerebral'],
      groups: [{ id: 'salvador', name: 'Salvador', territories: [{ id: '292740', label: 'Salvador' }] }],
      period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
    });
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = repo.load(design, [baseProfiles[0]!], { signal: firstController.signal });
    const second = repo.load(design, [baseProfiles[0]!], { signal: secondController.signal });
    await vi.waitFor(() => expect(internalSignal).toBeInstanceOf(AbortSignal));

    firstController.abort();
    expect(internalSignal?.aborted).toBe(false);
    secondController.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(internalSignal?.aborted).toBe(true);
  });

  it('bounds concurrent municipal partition downloads without serializing all of them', async () => {
    const client = new FakeSupabase({ sih_collection_status: () => ({ data: [], error: null }) });
    let active = 0;
    let maximum = 0;
    const loader = vi.fn(async (uf: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return municipioPartition(uf, []);
    });
    const repo = createResearchRepository({
      supabase: client,
      loadMunicipioPartition: loader,
      municipioPartitionConcurrency: 2,
    });
    const design = ufDesign({
      geography: 'municipio', locationBasis: 'ocorrencia', diseaseIds: ['acidente_vascular_cerebral'],
      groups: [{
        id: 'multirregional', name: 'Cinco UFs', territories: [
          { id: '120001', label: 'AC' }, { id: '130001', label: 'AM' }, { id: '150001', label: 'PA' },
          { id: '290001', label: 'BA' }, { id: '350001', label: 'SP' },
        ],
      }],
      period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
    });

    await repo.load(design, [baseProfiles[0]!]);

    expect(loader).toHaveBeenCalledTimes(5);
    expect(maximum).toBe(2);
  });

  it('shares the municipal concurrency bound across simultaneous distinct repository loads', async () => {
    const client = new FakeSupabase({ sih_collection_status: () => ({ data: [], error: null }) });
    let active = 0;
    let maximum = 0;
    const loader = vi.fn(async (uf: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return municipioPartition(uf, []);
    });
    const repo = createResearchRepository({
      supabase: client,
      loadMunicipioPartition: loader,
      municipioPartitionConcurrency: 2,
    });
    const designFor = (id: string, territories: Array<{ id: string; label: string }>) => ufDesign({
      geography: 'municipio', locationBasis: 'ocorrencia', diseaseIds: ['acidente_vascular_cerebral'],
      groups: [{ id, name: id, territories }],
      period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
    });

    await Promise.all([
      repo.load(designFor('norte-1', [{ id: '120001', label: 'AC' }, { id: '130001', label: 'AM' }]), [baseProfiles[0]!]),
      repo.load(designFor('norte-2', [{ id: '150001', label: 'PA' }, { id: '290001', label: 'BA' }]), [baseProfiles[0]!]),
    ]);

    expect(loader).toHaveBeenCalledTimes(4);
    expect(maximum).toBe(2);
  });

  it('fetches municipal population in one batch only when requested', async () => {
    const client = new FakeSupabase({
      sih_collection_status: () => ({ data: [], error: null }),
      sih_population_total_muni: () => ({
        data: [{ municipio_codigo: '292740', uf_codigo: '29', ano: 2020, populacao: 2_900_000 }],
        error: null,
      }),
    });
    const repo = createResearchRepository({
      supabase: client,
      loadMunicipioPartition: async () => municipioPartition('BA', [municipioMetricRow()]),
    });
    const design = ufDesign({
      geography: 'municipio',
      locationBasis: 'ocorrencia',
      diseaseIds: ['acidente_vascular_cerebral'],
      groups: [{
        id: 'capitais',
        name: 'Capitais',
        territories: [{ id: '292740', label: 'Salvador' }],
      }],
      period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
    });

    const snapshot = await repo.load(design, [populationRate]);

    expect(client.callsFor('sih_population_total_muni')).toHaveLength(1);
    expect(client.requests).toHaveLength(2);
    expect(snapshot.cells.find((cell) => cell.variableId === 'populacao')).toMatchObject({
      rawValue: 2_900_000,
      sourceStatus: 'observed',
    });
  });
});
