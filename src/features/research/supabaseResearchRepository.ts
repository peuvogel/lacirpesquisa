import {
  loadMunicipioPartition as defaultLoadMunicipioPartition,
  type MunicipioPartition,
} from '@/features/catalog/loadMunicipioPartition';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabaseClient';
import { UF_LIST } from '@/routes/mapas/ufCodes';
import { fingerprintResearchDesign } from './researchDesign';
import { indexMunicipioPartition, type MunicipioMetricRow } from './municipioPartitionIndex';
import type {
  LocationBasis,
  ResearchDesign,
  ResearchPeriod,
  SourceCellStatus,
  VariableProfile,
} from './types';

const METRIC_COLUMNS = [
  'internacoes',
  'obitos',
  'valor_total',
  'dias_permanencia',
  'taxa_mortalidade',
] as const;
const LEDGER_MEASURES = ['internacoes', 'obitos', 'valor_total', 'dias_permanencia'] as const;
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_PAGES = 100;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MUNICIPIO_PARTITION_CONCURRENCY = 3;

type MetricColumn = (typeof METRIC_COLUMNS)[number];
type LedgerMeasure = (typeof LEDGER_MEASURES)[number];
type GeographyGrain = 'uf' | 'municipio';

interface QueryResult {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
}

interface ResearchQueryBuilder extends PromiseLike<QueryResult> {
  in(column: string, values: unknown[]): ResearchQueryBuilder;
  eq(column: string, value: unknown): ResearchQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): ResearchQueryBuilder;
  range(from: number, to: number): ResearchQueryBuilder;
  abortSignal(signal: AbortSignal): ResearchQueryBuilder;
}

interface ResearchQuerySource {
  select(columns: string): ResearchQueryBuilder;
}

export interface ResearchSupabaseClient {
  from(table: string): ResearchQuerySource;
}

interface UfMetricRow {
  disease_id: string;
  uf_codigo: string;
  ano: number;
  local: LocationBasis;
  internacoes: number | null;
  obitos: number | null;
  valor_total: number | null;
  dias_permanencia: number | null;
  taxa_mortalidade: number | null;
}

interface LedgerRow {
  disease_id: string;
  medida: LedgerMeasure;
  grao: GeographyGrain;
  local: LocationBasis;
  ano: number;
  status: 'coletado' | 'falhou' | 'nunca_tentado';
  derived_at: string | null;
  cid_map_version: string | null;
}

interface PopulationRow {
  uf_codigo?: string;
  municipio_codigo?: string;
  ano: number;
  populacao: number;
}

export interface ResearchSourceCell {
  diseaseId: string;
  territoryId: string;
  groupId: string;
  periodKey: string;
  variableId: string;
  rawValue: number | null;
  sourceStatus: SourceCellStatus;
}

export type ResearchRepositoryErrorCode =
  | 'supabase_not_configured'
  | 'query_failed'
  | 'pagination_limit'
  | 'unstable_pagination'
  | 'unsupported_geography';

export class ResearchRepositoryError extends Error {
  constructor(
    readonly code: ResearchRepositoryErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ResearchRepositoryError';
  }
}

export interface ResearchRecoverableError {
  code: 'municipio_partition_unavailable';
  message: string;
  territoryIds: string[];
  uf: string;
}

export interface ResearchDataSnapshot {
  cells: ResearchSourceCell[];
  errors: ResearchRecoverableError[];
  fingerprint: string;
}

export interface ResearchLoadOptions {
  signal?: AbortSignal;
}

export interface CreateResearchRepositoryOptions {
  supabase: ResearchSupabaseClient | null;
  loadMunicipioPartition?: (
    uf: string,
    options?: { signal?: AbortSignal },
  ) => Promise<MunicipioPartition>;
  pageSize?: number;
  maxPages?: number;
  ttlMs?: number;
  now?: () => number;
  municipioPartitionConcurrency?: number;
}

export interface ResearchRepository {
  load(
    design: ResearchDesign,
    profiles: readonly VariableProfile[],
    options?: ResearchLoadOptions,
  ): Promise<ResearchDataSnapshot>;
  clearCache(): void;
}

interface CacheEntry {
  expiresAt: number;
  promise: Promise<ResearchDataSnapshot>;
  controller: AbortController;
  consumers: number;
  settled: boolean;
}

interface ExpectedCell {
  groupId: string;
  territoryId: string;
  years: number[];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueSortedNumbers(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function yearOf(value: string): number {
  const match = /^(\d{4})(?:-(?:0[1-9]|1[0-2]))?$/.exec(value);
  if (!match) {
    throw new ResearchRepositoryError('query_failed', `Período inválido: ${value}.`);
  }
  return Number(match[1]);
}

/** Database aggregates are annual; YYYY-MM inputs therefore select their containing year. */
export function expandResearchPeriodYears(period: ResearchPeriod): number[] {
  if (period.mode === 'point') return [yearOf(period.point)];
  if (period.mode === 'compare') {
    return uniqueSortedNumbers([yearOf(period.periodA), yearOf(period.periodB)]);
  }
  const first = yearOf(period.start);
  const last = yearOf(period.end);
  if (first > last) {
    throw new ResearchRepositoryError('query_failed', 'O início do período ocorre depois do fim.');
  }
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function expectedCells(design: ResearchDesign): ExpectedCell[] {
  const seen = new Set<string>();
  const expected: ExpectedCell[] = [];
  for (const group of design.groups) {
    const period = design.period.scope === 'shared'
      ? design.period.time
      : design.period.timesByGroupId[group.id];
    if (!period) {
      throw new ResearchRepositoryError('query_failed', `Período ausente para o grupo ${group.id}.`);
    }
    const years = expandResearchPeriodYears(period);
    for (const territory of group.territories) {
      const key = `${group.id}\u0000${territory.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expected.push({ groupId: group.id, territoryId: territory.id, years });
    }
  }
  return expected;
}

function profileFingerprint(profiles: readonly VariableProfile[]): string {
  return JSON.stringify([...profiles].map((profile) => ({
    variableId: profile.variableId,
    numeratorVariableId: profile.numeratorVariableId ?? null,
    denominatorVariableId: profile.denominatorVariableId ?? null,
    exposureVariableId: profile.exposureVariableId ?? null,
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
}

function requestedSourceVariables(profiles: readonly VariableProfile[]): string[] {
  const variables = new Set<string>();
  for (const profile of profiles) {
    if ((METRIC_COLUMNS as readonly string[]).includes(profile.variableId)) {
      variables.add(profile.variableId);
    }
    if (profile.numeratorVariableId) variables.add(profile.numeratorVariableId);
    if (profile.denominatorVariableId) variables.add(profile.denominatorVariableId);
    if (profile.exposureVariableId) variables.add(profile.exposureVariableId);
  }
  return uniqueSorted(variables);
}

function ledgerMeasuresFor(variables: readonly string[]): LedgerMeasure[] {
  const measures = new Set<LedgerMeasure>();
  for (const variable of variables) {
    if ((LEDGER_MEASURES as readonly string[]).includes(variable)) {
      measures.add(variable as LedgerMeasure);
    }
    if (variable === 'taxa_mortalidade') {
      measures.add('internacoes');
      measures.add('obitos');
    }
  }
  return [...measures].sort();
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

function attachConsumer(
  cache: Map<string, CacheEntry>,
  key: string,
  entry: CacheEntry,
  signal?: AbortSignal,
): Promise<ResearchDataSnapshot> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  if (entry.settled) return signal ? forSettledCaller(entry.promise, signal) : entry.promise;
  entry.consumers += 1;

  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      entry.consumers -= 1;
      if (entry.consumers === 0 && !entry.settled && !entry.controller.signal.aborted) {
        if (cache.get(key) === entry) cache.delete(key);
        entry.controller.abort();
      }
    };
    const onAbort = () => {
      release();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(
      (value) => {
        signal?.removeEventListener('abort', onAbort);
        release();
        resolve(value);
      },
      (error: unknown) => {
        signal?.removeEventListener('abort', onAbort);
        release();
        reject(error);
      },
    );
  });
}

function forSettledCaller<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function createConcurrencyLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1;
        void task().then(resolve, reject).finally(() => {
          active -= 1;
          queue.shift()?.();
        });
      };
      if (active < concurrency) start();
      else queue.push(start);
    });
  };
}

async function fetchAllPages<T>(input: {
  supabase: ResearchSupabaseClient;
  table: string;
  columns: string;
  filters: (query: ResearchQueryBuilder) => ResearchQueryBuilder;
  order: string[];
  keyOf: (row: T) => string;
  pageSize: number;
  maxPages: number;
  signal?: AbortSignal;
}): Promise<T[]> {
  const rows: T[] = [];
  const keys = new Set<string>();
  for (let page = 0; page < input.maxPages; page += 1) {
    assertNotAborted(input.signal);
    let query = input.filters(input.supabase.from(input.table).select(input.columns));
    for (const column of input.order) query = query.order(column, { ascending: true });
    query = query.range(page * input.pageSize, (page + 1) * input.pageSize - 1);
    if (input.signal) query = query.abortSignal(input.signal);
    const { data, error } = await query;
    assertNotAborted(input.signal);
    if (error) {
      throw new ResearchRepositoryError(
        'query_failed',
        `Falha ao consultar ${input.table}: ${error.message}`,
        { table: input.table, postgrestCode: error.code },
      );
    }
    if (!Array.isArray(data)) {
      throw new ResearchRepositoryError('query_failed', `${input.table} devolveu resposta inválida.`);
    }
    for (const value of data as T[]) {
      const key = input.keyOf(value);
      if (keys.has(key)) {
        throw new ResearchRepositoryError(
          'unstable_pagination',
          `Chave duplicada em ${input.table}; paginação não é confiável.`,
          { table: input.table, key },
        );
      }
      keys.add(key);
      rows.push(value);
    }
    if (data.length < input.pageSize) return rows;
  }
  throw new ResearchRepositoryError(
    'pagination_limit',
    `A consulta de ${input.table} excedeu ${input.maxPages} páginas; nenhum dado truncado foi aceito.`,
    { table: input.table, pageSize: input.pageSize, maxPages: input.maxPages },
  );
}

function metricKey(diseaseId: string, territoryId: string, year: number): string {
  return `${diseaseId}|${territoryId}|${year}`;
}

function ledgerKey(diseaseId: string, measure: LedgerMeasure, year: number): string {
  return `${diseaseId}|${measure}|${year}`;
}

function finiteMetric(row: UfMetricRow | MunicipioMetricRow, variable: MetricColumn): number | null {
  const value = row[variable];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function ledgerStatusFor(
  ledger: Map<string, LedgerRow>,
  diseaseId: string,
  variable: string,
  year: number,
): LedgerRow['status'] | undefined {
  const measures: LedgerMeasure[] = variable === 'taxa_mortalidade'
    ? ['internacoes', 'obitos']
    : (LEDGER_MEASURES as readonly string[]).includes(variable)
      ? [variable as LedgerMeasure]
      : [];
  const statuses = measures.map((measure) => ledger.get(ledgerKey(diseaseId, measure, year))?.status);
  if (statuses.some((status) => status === 'falhou' || status === 'nunca_tentado')) return 'falhou';
  if (statuses.length > 0 && statuses.every((status) => status === 'coletado')) return 'coletado';
  return undefined;
}

function sourceValue(input: {
  row: UfMetricRow | MunicipioMetricRow | undefined;
  variable: string;
  ledgerStatus: LedgerRow['status'] | undefined;
  population: number | undefined;
  partitionUnavailable: boolean;
}): { rawValue: number | null; sourceStatus: SourceCellStatus } {
  if (input.partitionUnavailable) return { rawValue: null, sourceStatus: 'not_queried' };
  if (input.variable === 'populacao') {
    return input.population === undefined
      ? { rawValue: null, sourceStatus: 'missing' }
      : { rawValue: input.population, sourceStatus: 'observed' };
  }
  if (input.ledgerStatus === 'falhou' || input.ledgerStatus === 'nunca_tentado') {
    return { rawValue: null, sourceStatus: 'missing' };
  }
  const value = input.row && (METRIC_COLUMNS as readonly string[]).includes(input.variable)
    ? finiteMetric(input.row, input.variable as MetricColumn)
    : null;
  if (value !== null) return { rawValue: value, sourceStatus: 'observed' };
  if (input.ledgerStatus === 'coletado') return { rawValue: 0, sourceStatus: 'collection_zero' };
  return { rawValue: null, sourceStatus: 'missing' };
}

const UF_SIGLA_BY_CODE = new Map(UF_LIST.map((uf) => [uf.ibgeCode, uf.sigla]));

function municipioTransportId(territoryId: string): string {
  if (/^\d{6}$/.test(territoryId)) return territoryId;
  if (/^\d{7}$/.test(territoryId)) return territoryId.slice(0, 6);
  throw new ResearchRepositoryError('query_failed', `Código municipal inválido: ${territoryId}.`);
}

function municipioUf(territoryId: string): string {
  const transportId = municipioTransportId(territoryId);
  if (!/^\d{6}$/.test(transportId)) {
    throw new ResearchRepositoryError('query_failed', `Código municipal inválido: ${territoryId}.`);
  }
  const sigla = UF_SIGLA_BY_CODE.get(transportId.slice(0, 2));
  if (!sigla) {
    throw new ResearchRepositoryError('query_failed', `UF desconhecida para o município ${territoryId}.`);
  }
  return sigla;
}

function supportsDesign(design: ResearchDesign): design is ResearchDesign & { geography: GeographyGrain } {
  return design.geography === 'uf' || design.geography === 'municipio';
}

export function createResearchRepository(options: CreateResearchRepositoryOptions): ResearchRepository {
  const cache = new Map<string, CacheEntry>();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const partitionLoader = options.loadMunicipioPartition ?? defaultLoadMunicipioPartition;
  const municipioPartitionConcurrency = options.municipioPartitionConcurrency
    ?? DEFAULT_MUNICIPIO_PARTITION_CONCURRENCY;
  if (
    !Number.isInteger(pageSize) || pageSize <= 0
    || !Number.isInteger(maxPages) || maxPages <= 0
    || !Number.isInteger(municipioPartitionConcurrency) || municipioPartitionConcurrency <= 0
  ) {
    throw new Error('pageSize, maxPages e municipioPartitionConcurrency precisam ser inteiros positivos.');
  }
  const limitMunicipioPartitionLoad = createConcurrencyLimiter(municipioPartitionConcurrency);

  async function loadUncached(
    design: ResearchDesign,
    profiles: readonly VariableProfile[],
    signal?: AbortSignal,
  ): Promise<ResearchDataSnapshot> {
    assertNotAborted(signal);
    if (!options.supabase) {
      throw new ResearchRepositoryError(
        'supabase_not_configured',
        'Dados de pesquisa indisponíveis: cliente Supabase anon não configurado.',
      );
    }
    if (!supportsDesign(design)) {
      throw new ResearchRepositoryError(
        'unsupported_geography',
        `O repositório ainda não suporta o grão ${design.geography}.`,
      );
    }

    const expected = expectedCells(design);
    const diseases = uniqueSorted(design.diseaseIds);
    const territories = uniqueSorted(expected.map((cell) => cell.territoryId));
    const grain = design.geography;
    const transportTerritories = grain === 'municipio'
      ? uniqueSorted(territories.map(municipioTransportId))
      : territories;
    const years = uniqueSortedNumbers(expected.flatMap((cell) => cell.years));
    const variables = requestedSourceVariables(profiles);
    const measures = ledgerMeasuresFor(variables);
    const needsPopulation = variables.includes('populacao');
    const local = design.locationBasis;

    const ledgerPromise = measures.length === 0 || diseases.length === 0 || years.length === 0
      ? Promise.resolve([] as LedgerRow[])
      : fetchAllPages<LedgerRow>({
          supabase: options.supabase,
          table: 'sih_collection_status',
          columns: 'disease_id,medida,grao,local,ano,status,derived_at,cid_map_version',
          filters: (query) => query
            .in('disease_id', diseases)
            .in('medida', measures)
            .in('ano', years)
            .eq('grao', grain)
            .eq('local', local),
          order: ['disease_id', 'medida', 'grao', 'local', 'ano'],
          keyOf: (row) => `${row.disease_id}|${row.medida}|${row.grao}|${row.local}|${row.ano}`,
          pageSize,
          maxPages,
          signal,
        });

    const populationPromise = !needsPopulation || territories.length === 0 || years.length === 0
      ? Promise.resolve([] as PopulationRow[])
      : fetchAllPages<PopulationRow>({
          supabase: options.supabase,
          table: grain === 'uf' ? 'sih_population_total_uf' : 'sih_population_total_muni',
          columns: grain === 'uf' ? 'uf_codigo,ano,populacao' : 'municipio_codigo,uf_codigo,ano,populacao',
          filters: (query) => query
            .in(grain === 'uf' ? 'uf_codigo' : 'municipio_codigo', transportTerritories)
            .in('ano', years),
          order: [grain === 'uf' ? 'uf_codigo' : 'municipio_codigo', 'ano'],
          keyOf: (row) => `${grain === 'uf' ? row.uf_codigo : row.municipio_codigo}|${row.ano}`,
          pageSize,
          maxPages,
          signal,
        });

    const metricPromise: Promise<{
      rows: Array<UfMetricRow | MunicipioMetricRow>;
      errors: ResearchRecoverableError[];
      unavailableMunicipioUfs: Set<string>;
    }> = grain === 'uf'
      ? (diseases.length === 0 || territories.length === 0 || years.length === 0
          ? Promise.resolve({ rows: [], errors: [], unavailableMunicipioUfs: new Set<string>() })
          : fetchAllPages<UfMetricRow>({
            supabase: options.supabase,
            table: 'sih_metric_uf',
            columns: 'disease_id,uf_codigo,ano,local,internacoes,obitos,valor_total,dias_permanencia,taxa_mortalidade',
            filters: (query) => query
              .in('disease_id', diseases)
              .in('uf_codigo', territories)
              .in('ano', years)
              .eq('local', local),
            order: ['disease_id', 'uf_codigo', 'ano', 'local'],
            keyOf: (row) => `${row.disease_id}|${row.uf_codigo}|${row.ano}|${row.local}`,
            pageSize,
            maxPages,
            signal,
          }).then((rows) => ({ rows, errors: [], unavailableMunicipioUfs: new Set<string>() })))
      : (async () => {
      const metricRows: MunicipioMetricRow[] = [];
      const recoverableErrors: ResearchRecoverableError[] = [];
      const unavailableMunicipioUfs = new Set<string>();
      const territoriesByUf = new Map<string, string[]>();
      for (const territory of territories) {
        const uf = municipioUf(territory);
        territoriesByUf.set(uf, [...(territoriesByUf.get(uf) ?? []), territory]);
      }
      const partitions = await mapWithConcurrency(
        [...territoriesByUf],
        municipioPartitionConcurrency,
        async ([uf, territoryIds]) => {
          try {
            const partition = await limitMunicipioPartitionLoad(async () => {
              assertNotAborted(signal);
              return partitionLoader(uf, { signal });
            });
            assertNotAborted(signal);
            if (partition.uf !== uf) throw new Error(`partição ${partition.uf} recebida para ${uf}`);
            return { uf, territoryIds, index: indexMunicipioPartition(partition) };
          } catch (error) {
            assertNotAborted(signal);
            unavailableMunicipioUfs.add(uf);
            recoverableErrors.push({
              code: 'municipio_partition_unavailable',
              message: `Não foi possível carregar a partição municipal de ${uf}: ${error instanceof Error ? error.message : String(error)}`,
              territoryIds: uniqueSorted(territoryIds),
              uf,
            });
            return { uf, territoryIds, index: null };
          }
        },
      );
      for (const { index, territoryIds } of partitions) {
        if (!index) continue;
        for (const diseaseId of diseases) {
          for (const territoryId of territoryIds) {
            for (const year of years) {
              const row = index.get(diseaseId, municipioTransportId(territoryId), year, local);
              if (row) metricRows.push(row);
            }
          }
        }
      }
      return { rows: metricRows, errors: recoverableErrors, unavailableMunicipioUfs };
    })();

    // Attach rejection handlers to all independent network branches immediately. Besides
    // reducing latency, this prevents a fast ledger/population rejection from becoming an
    // unhandled promise while a Storage partition is still downloading.
    const [metricResult, ledgerRows, populationRows] = await Promise.all([
      metricPromise,
      ledgerPromise,
      populationPromise,
    ]);
    const metricRows = metricResult.rows;
    const recoverableErrors = metricResult.errors;
    const unavailableMunicipioUfs = metricResult.unavailableMunicipioUfs;
    const metrics = new Map(metricRows.map((row) => [
      metricKey(
        row.disease_id,
        'uf_codigo' in row ? row.uf_codigo : row.municipio_codigo,
        row.ano,
      ),
      row,
    ]));
    const ledger = new Map(ledgerRows.map((row) => [ledgerKey(row.disease_id, row.medida, row.ano), row]));
    const population = new Map(populationRows.map((row) => [
      `${grain === 'uf' ? row.uf_codigo : row.municipio_codigo}|${row.ano}`,
      typeof row.populacao === 'number' && Number.isFinite(row.populacao) ? row.populacao : undefined,
    ]));

    const cells: ResearchSourceCell[] = [];
    for (const expectedCell of expected) {
      for (const year of expectedCell.years) {
        for (const diseaseId of diseases) {
          const transportTerritoryId = grain === 'municipio'
            ? municipioTransportId(expectedCell.territoryId)
            : expectedCell.territoryId;
          const row = metrics.get(metricKey(diseaseId, transportTerritoryId, year));
          const partitionUnavailable = grain === 'municipio'
            && unavailableMunicipioUfs.has(municipioUf(expectedCell.territoryId));
          for (const variableId of variables) {
            const value = sourceValue({
              row,
              variable: variableId,
              ledgerStatus: ledgerStatusFor(ledger, diseaseId, variableId, year),
              population: population.get(`${transportTerritoryId}|${year}`),
              partitionUnavailable,
            });
            cells.push({
              diseaseId,
              territoryId: expectedCell.territoryId,
              groupId: expectedCell.groupId,
              periodKey: String(year),
              variableId,
              ...value,
            });
          }
        }
      }
    }

    return {
      cells,
      errors: recoverableErrors.sort((left, right) => left.uf.localeCompare(right.uf)),
      fingerprint: `${fingerprintResearchDesign(design)}:${profileFingerprint(profiles)}`,
    };
  }

  return {
    load(design, profiles, loadOptions = {}) {
      if (loadOptions.signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      const key = `${fingerprintResearchDesign(design)}:${profileFingerprint(profiles)}`;
      const cached = cache.get(key);
      if (
        cached
        && !cached.controller.signal.aborted
        && (!cached.settled || cached.expiresAt > now())
      ) {
        return attachConsumer(cache, key, cached, loadOptions.signal);
      }
      if (cached) cache.delete(key);

      const controller = new AbortController();
      const promise = loadUncached(design, profiles, controller.signal);
      const entry: CacheEntry = {
        expiresAt: 0,
        promise,
        controller,
        consumers: 0,
        settled: false,
      };
      cache.set(key, entry);
      void promise.then(
        () => {
          entry.expiresAt = now() + ttlMs;
          entry.settled = true;
        },
        () => {
          entry.controller.abort();
          entry.settled = true;
          if (cache.get(key) === entry) cache.delete(key);
        },
      );
      return attachConsumer(cache, key, entry, loadOptions.signal);
    },
    clearCache() {
      for (const entry of cache.values()) {
        if (!entry.settled) entry.controller.abort();
      }
      cache.clear();
    },
  };
}

function adaptSupabaseClient(client: SupabaseClient | null): ResearchSupabaseClient | null {
  if (!client) return null;
  // The compile-time assignment in the repository test proves SupabaseClient satisfies this
  // structural boundary. Binding here also preserves the SDK method receiver without forcing
  // TypeScript to instantiate Supabase's recursive Database generics at module initialization.
  const from = Reflect.get(client as object, 'from') as (table: string) => ResearchQuerySource;
  return { from: from.bind(client) };
}

const configuredSupabase = adaptSupabaseClient(getSupabase());
const defaultRepository = createResearchRepository({ supabase: configuredSupabase });

export function loadResearchCells(
  design: ResearchDesign,
  profiles: readonly VariableProfile[],
  options?: ResearchLoadOptions,
): Promise<ResearchDataSnapshot> {
  return defaultRepository.load(design, profiles, options);
}

export function clearResearchRepositoryCache(): void {
  defaultRepository.clearCache();
}
