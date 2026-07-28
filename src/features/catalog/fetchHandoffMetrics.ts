import { getSupabase } from '@/lib/supabaseClient';
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
}

interface UfRow {
  disease_id: string;
  uf: string;
  uf_codigo: string;
  ano: number;
  internacoes: number | null;
  obitos: number | null;
  valor_total: number | null;
  dias_permanencia: number | null;
  taxa_mortalidade: number | null;
}

interface MuniRow {
  disease_id: string;
  municipio_codigo: string;
  uf_codigo: string;
  ano: number;
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

function cell(row: UfRow | MuniRow, measure: string): number | null {
  if (!isMeasureCol(measure)) return null;
  const raw = row[measure];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/**
 * Prefetch SIH metrics for map handoff (UF + município) from Supabase.
 */
export async function fetchHandoffMetricLookup(
  requests: HandoffMetricRequest[],
): Promise<MetricLookup | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const diseaseIds = new Set<string>();
  const ufCodes = new Set<string>();
  const muniCodes = new Set<string>();
  const years = new Set<number>();
  const allVariableIds = new Set<string>();

  for (const req of requests) {
    for (const variableId of req.variableIds) {
      allVariableIds.add(variableId);
      const parsed = parseSihVariableId(variableId);
      if (parsed) diseaseIds.add(parsed.diseaseId);
    }
    for (const t of req.territories) {
      if (t.level === 'municipio') {
        muniCodes.add(t.ibgeCode.padStart(6, '0').slice(0, 6));
      } else if (t.level === 'uf') {
        ufCodes.add(t.ibgeCode.padStart(2, '0').slice(0, 2));
      }
    }
    if (req.year !== null) years.add(req.year);
  }

  if (!diseaseIds.size) return null;

  const diseaseList = [...diseaseIds];
  const yearList = years.size ? [...years] : undefined;
  const map = new Map<string, number>();

  const put = (variableId: string, key: string, year: number, value: number | null) => {
    if (value === null) return;
    map.set(`${variableId}|${key}|${year}`, value);
    map.set(`${variableId}|${key}|*`, value);
  };

  const varsForDisease = (diseaseId: string) =>
    [...allVariableIds].filter((id) => parseSihVariableId(id)?.diseaseId === diseaseId);

  if (ufCodes.size) {
    let q = supabase
      .from('sih_metric_uf')
      .select(
        'disease_id,uf,uf_codigo,ano,internacoes,obitos,valor_total,dias_permanencia,taxa_mortalidade',
      )
      .in('disease_id', diseaseList)
      .in('uf_codigo', [...ufCodes]);
    if (yearList) q = q.in('ano', yearList);
    const { data, error } = await q;
    if (error) {
      console.warn('[handoff] sih_metric_uf', error.message);
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
    const codes = [...muniCodes];
    const chunkSize = 80;
    for (let i = 0; i < codes.length; i += chunkSize) {
      const chunk = codes.slice(i, i + chunkSize);
      let q = supabase
        .from('sih_metric_muni')
        .select(
          'disease_id,municipio_codigo,uf_codigo,ano,internacoes,obitos,valor_total,dias_permanencia,taxa_mortalidade',
        )
        .in('disease_id', diseaseList)
        .in('municipio_codigo', chunk);
      if (yearList) q = q.in('ano', yearList);
      const { data, error } = await q;
      if (error) {
        console.warn('[handoff] sih_metric_muni', error.message);
        continue;
      }
      for (const row of (data ?? []) as MuniRow[]) {
        for (const variableId of varsForDisease(row.disease_id)) {
          const parsed = parseSihVariableId(variableId);
          if (!parsed) continue;
          const value = cell(row, parsed.measure);
          const code = row.municipio_codigo.padStart(6, '0').slice(0, 6);
          put(variableId, code, row.ano, value);
        }
      }
    }
  }

  return (variableId, territoryKey, year) => {
    if (year !== null) {
      const hit = map.get(`${variableId}|${territoryKey}|${year}`);
      if (hit !== undefined) return hit;
    }
    return map.get(`${variableId}|${territoryKey}|*`) ?? null;
  };
}
