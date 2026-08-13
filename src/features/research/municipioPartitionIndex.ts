import type { MunicipioPartition } from '@/features/catalog/loadMunicipioPartition';
import { UF_LIST } from '@/routes/mapas/ufCodes';
import type { LocationBasis } from './types';

const REQUIRED_COLUMNS = [
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

const METRIC_COLUMNS = [
  'internacoes',
  'obitos',
  'valor_total',
  'dias_permanencia',
  'taxa_mortalidade',
] as const;
const UF_CODE_BY_SIGLA = new Map(UF_LIST.map((uf) => [uf.sigla, uf.ibgeCode]));

export interface MunicipioMetricRow {
  disease_id: string;
  municipio_codigo: string;
  ano: number;
  local: LocationBasis;
  internacoes: number | null;
  obitos: number | null;
  valor_total: number | null;
  dias_permanencia: number | null;
  taxa_mortalidade: number | null;
}

export interface MunicipioPartitionIndex {
  readonly size: number;
  get(
    diseaseId: string,
    municipioCodigo: string,
    ano: number,
    local: LocationBasis,
  ): MunicipioMetricRow | undefined;
}

function partitionError(message: string): Error {
  return new Error(`Partição municipal inválida: ${message}`);
}

function rowKey(
  diseaseId: string,
  municipioCodigo: string,
  ano: number,
  local: LocationBasis,
): string {
  return `${diseaseId}|${municipioCodigo}|${ano}|${local}`;
}

function isLocationBasis(value: unknown): value is LocationBasis {
  return value === 'ocorrencia' || value === 'residencia';
}

function metricValue(value: unknown, column: string, row: number): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw partitionError(`valor não numérico em ${column}, linha ${row}.`);
  }
  return value;
}

/**
 * Validates the columnar Storage payload once and builds an O(1) lookup. Consumers never scan
 * all parallel arrays for each selected variable or checkbox.
 */
export function indexMunicipioPartition(partition: MunicipioPartition): MunicipioPartitionIndex {
  if (!partition || typeof partition !== 'object') {
    throw partitionError('payload ausente.');
  }
  if (partition.schema !== 1) {
    throw partitionError(`schema ${String(partition.schema)} não suportado.`);
  }
  if (typeof partition.uf !== 'string' || !/^[A-Z]{2}$/.test(partition.uf)) {
    throw partitionError('sigla de UF inválida.');
  }
  const expectedUfCode = UF_CODE_BY_SIGLA.get(partition.uf);
  if (!expectedUfCode) throw partitionError(`sigla de UF desconhecida: ${partition.uf}.`);
  if (!Array.isArray(partition.colunas) || !Array.isArray(partition.dados)) {
    throw partitionError('colunas/dados ausentes.');
  }
  if (new Set(partition.colunas).size !== partition.colunas.length) {
    throw partitionError('coluna duplicada.');
  }
  if (partition.colunas.length !== partition.dados.length) {
    throw partitionError('colunas e arrays de dados não são paralelos.');
  }

  const positions = new Map(partition.colunas.map((column, index) => [column, index]));
  for (const column of REQUIRED_COLUMNS) {
    if (!positions.has(column)) throw partitionError(`coluna requerida ausente: ${column}.`);
  }

  const columns = partition.dados;
  if (columns.some((column) => !Array.isArray(column))) {
    throw partitionError('cada entrada de dados precisa ser um array.');
  }
  const rowCount = columns[0]?.length ?? 0;
  if (columns.some((column) => column.length !== rowCount)) {
    throw partitionError('arrays de dados não são paralelos.');
  }

  const valueAt = (column: string, row: number): unknown =>
    columns[positions.get(column)!]![row];
  const rows = new Map<string, MunicipioMetricRow>();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const diseaseId = valueAt('disease_id', rowIndex);
    const municipioCodigo = valueAt('municipio_codigo', rowIndex);
    const ano = valueAt('ano', rowIndex);
    const local = valueAt('local', rowIndex);
    if (typeof diseaseId !== 'string' || diseaseId.length === 0 || diseaseId.includes('|')) {
      throw partitionError(`disease_id inválido na linha ${rowIndex}.`);
    }
    if (typeof municipioCodigo !== 'string' || !/^\d{6}$/.test(municipioCodigo)) {
      throw partitionError(`código de município inválido na linha ${rowIndex}.`);
    }
    if (!municipioCodigo.startsWith(expectedUfCode)) {
      throw partitionError(
        `município ${municipioCodigo} não pertence à partição ${partition.uf}.`,
      );
    }
    if (!Number.isInteger(ano) || (ano as number) < 1990 || (ano as number) > 2100) {
      throw partitionError(`ano inválido na linha ${rowIndex}.`);
    }
    if (!isLocationBasis(local)) {
      throw partitionError(`local inválido na linha ${rowIndex}.`);
    }

    const metricValues = Object.fromEntries(
      METRIC_COLUMNS.map((column) => [column, metricValue(valueAt(column, rowIndex), column, rowIndex)]),
    ) as Pick<MunicipioMetricRow, (typeof METRIC_COLUMNS)[number]>;
    const indexedRow: MunicipioMetricRow = {
      disease_id: diseaseId,
      municipio_codigo: municipioCodigo,
      ano: ano as number,
      local,
      ...metricValues,
    };
    const key = rowKey(diseaseId, municipioCodigo, ano as number, local);
    if (rows.has(key)) throw partitionError(`chave duplicada ${key}.`);
    rows.set(key, indexedRow);
  }

  return {
    size: rows.size,
    get: (diseaseId, municipioCodigo, ano, local) =>
      rows.get(rowKey(diseaseId, municipioCodigo, ano, local)),
  };
}
