import { getSupabase } from '@/lib/supabaseClient';
import {
  loadMunicipioPartition as defaultLoadMunicipioPartition,
  type MunicipioPartition,
} from './loadMunicipioPartition';
import {
  indexMunicipioPartition as defaultIndexMunicipioPartition,
  type MunicipioPartitionIndex,
} from '@/features/research/municipioPartitionIndex';
import type { LocationBasis } from '@/features/research/types';
import { UF_LIST } from '@/routes/mapas/ufCodes';
import { parseSihVariableId } from './sihVariableIds';

export type MetricLookup = (
  variableId: string,
  territoryKey: string,
  year: number | null,
) => number | null;

export interface HandoffMetricTerritory {
  level: string;
  ibgeCode: string;
  sigla?: string;
}

export interface HandoffMetricRequest {
  variableIds: string[];
  territories: HandoffMetricTerritory[];
  year: number | null;
  locationBasis: LocationBasis;
}

interface QueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface HandoffQueryBuilder extends PromiseLike<QueryResult> {
  in(column: string, values: unknown[]): HandoffQueryBuilder;
  eq(column: string, value: unknown): HandoffQueryBuilder;
}

interface HandoffQuerySource {
  select(columns: string): HandoffQueryBuilder;
}

/** Deliberately narrow adapter over the Supabase query surface used by this legacy handoff. */
export interface HandoffSupabaseClient {
  from(table: 'sih_metric_uf'): HandoffQuerySource;
}

export interface HandoffMetricDependencies {
  getSupabase?: () => HandoffSupabaseClient | null;
  loadMunicipioPartition?: (uf: string) => Promise<MunicipioPartition>;
  indexMunicipioPartition?: (partition: MunicipioPartition) => MunicipioPartitionIndex;
}

interface UfRow {
  disease_id: string;
  uf: string;
  uf_codigo: string;
  ano: number;
  local: LocationBasis;
  internacoes: number | null;
  obitos: number | null;
  valor_total: number | null;
  dias_permanencia: number | null;
  taxa_mortalidade: number | null;
}

const MEASURE_COLUMNS = [
  'internacoes',
  'obitos',
  'valor_total',
  'dias_permanencia',
  'taxa_mortalidade',
] as const;

type MeasureCol = (typeof MEASURE_COLUMNS)[number];

function isMeasureCol(m: string): m is MeasureCol {
  return (MEASURE_COLUMNS as readonly string[]).includes(m);
}

function cell(row: UfRow, measure: string): number | null {
  if (!isMeasureCol(measure)) return null;
  const raw = row[measure];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

const UF_SIGLA_BY_CODE = new Map(UF_LIST.map((uf) => [uf.ibgeCode, uf.sigla]));

function municipioCode(value: string): string {
  if (!/^\d{6}$/.test(value)) {
    throw new Error(`Código municipal inválido (${value}).`);
  }
  if (!UF_SIGLA_BY_CODE.has(value.slice(0, 2))) {
    throw new Error(`UF desconhecida para o município ${value}.`);
  }
  return value;
}

function municipioUf(code: string): string {
  const uf = UF_SIGLA_BY_CODE.get(code.slice(0, 2));
  if (!uf) throw new Error(`UF desconhecida para o município ${code}.`);
  return uf;
}

function adaptSupabaseClient(): HandoffSupabaseClient | null {
  const client = getSupabase();
  if (!client) return null;
  const from = Reflect.get(client as object, 'from') as HandoffSupabaseClient['from'];
  return { from: from.bind(client) };
}

/**
 * Prefetch SIH metrics for map handoff: UF from PostgREST and município from Storage.
 */
export async function fetchHandoffMetricLookup(
  requests: HandoffMetricRequest[],
  dependencies: HandoffMetricDependencies = {},
): Promise<MetricLookup | null> {
  const supabase = (dependencies.getSupabase ?? adaptSupabaseClient)();
  const loadMunicipioPartition = dependencies.loadMunicipioPartition ?? defaultLoadMunicipioPartition;
  const indexMunicipioPartition = dependencies.indexMunicipioPartition ?? defaultIndexMunicipioPartition;

  const diseaseIds = new Set<string>();
  const ufCodes = new Set<string>();
  const muniCodes = new Set<string>();
  const years = new Set<number>();
  const allVariableIds = new Set<string>();
  const locationBases = new Set<LocationBasis>();

  for (const req of requests) {
    locationBases.add(req.locationBasis);
    for (const variableId of req.variableIds) {
      allVariableIds.add(variableId);
      const parsed = parseSihVariableId(variableId);
      if (parsed) diseaseIds.add(parsed.diseaseId);
    }
    for (const t of req.territories) {
      if (t.level === 'municipio') {
        muniCodes.add(municipioCode(t.ibgeCode));
      } else if (t.level === 'uf') {
        if (!/^\d{2}$/.test(t.ibgeCode)) throw new Error(`Código de UF inválido (${t.ibgeCode}).`);
        ufCodes.add(t.ibgeCode);
      }
    }
    if (req.territories.length > 0 && req.year === null) {
      throw new Error('Ano obrigatório para consultar métricas SIH por território.');
    }
    if (req.year !== null) years.add(req.year);
  }

  if (!diseaseIds.size) return null;
  if (locationBases.size !== 1) {
    throw new Error('O lote de handoff precisa usar uma única base de local (ocorrência ou residência).');
  }
  const [locationBasis] = locationBases;
  if (!locationBasis) return null;

  const diseaseList = [...diseaseIds];
  const yearList = [...years];
  const map = new Map<string, number>();

  const put = (variableId: string, key: string, year: number, value: number | null) => {
    if (value === null) return;
    map.set(`${variableId}|${key}|${year}`, value);
  };

  const varsForDisease = (diseaseId: string) =>
    [...allVariableIds].filter((id) => parseSihVariableId(id)?.diseaseId === diseaseId);

  if (ufCodes.size) {
    if (!supabase) return null;
    const q = supabase
      .from('sih_metric_uf')
      .select(
        'disease_id,uf,uf_codigo,ano,local,internacoes,obitos,valor_total,dias_permanencia,taxa_mortalidade',
      )
      .in('disease_id', diseaseList)
      .in('uf_codigo', [...ufCodes])
      .in('ano', yearList)
      .eq('local', locationBasis);
    const { data, error } = await q;
    if (error) {
      throw new Error(`[handoff] sih_metric_uf: ${error.message}`);
    } else {
      for (const row of (data ?? []) as UfRow[]) {
        for (const variableId of varsForDisease(row.disease_id)) {
          const parsed = parseSihVariableId(variableId);
          if (!parsed) continue;
          const value = cell(row, parsed.measure);
          put(variableId, row.uf, row.ano, value);
          put(variableId, row.uf_codigo.padStart(2, '0'), row.ano, value);
        }
      }
    }
  }

  if (muniCodes.size) {
    const codesByUf = new Map<string, string[]>();
    for (const code of muniCodes) {
      const uf = municipioUf(code);
      codesByUf.set(uf, [...(codesByUf.get(uf) ?? []), code]);
    }
    const partitions = await Promise.all([...codesByUf].map(async ([uf, codes]) => {
      const partition = await loadMunicipioPartition(uf);
      if (partition.uf !== uf) throw new Error(`Partição ${partition.uf} recebida para ${uf}.`);
      return { codes, index: indexMunicipioPartition(partition) };
    }));
    for (const { codes, index } of partitions) {
      for (const diseaseId of diseaseList) {
        for (const code of codes) {
          for (const year of yearList) {
            const row = index.get(diseaseId, code, year, locationBasis);
            if (!row) continue;
            for (const variableId of varsForDisease(diseaseId)) {
              const parsed = parseSihVariableId(variableId);
              if (!parsed || !isMeasureCol(parsed.measure)) continue;
              put(variableId, code, year, row[parsed.measure]);
            }
          }
        }
      }
    }
  }

  return (variableId, territoryKey, year) => {
    if (year === null) return null;
    return map.get(`${variableId}|${territoryKey}|${year}`) ?? null;
  };
}
