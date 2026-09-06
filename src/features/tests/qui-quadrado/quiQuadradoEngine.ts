import type { AssumptionNudge } from '@/features/tests/shared/assumptionNudges';
import { fmtNumber, fmtP } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  runChiSquareIndependence,
  statsEngine,
  type ChiSquareIndependenceResult,
} from '@/shared/stats/statsEngine';

const MIN_TOTAL_N = 5;
export const MAX_CATEGORY_LEVELS = 20;

export interface QuiQuadradoBuiltDataset {
  table: number[][];
  rowLabels: string[];
  colLabels: string[];
  columnHeaders: [string, string];
  totalN: number;
  categoryLimitExceeded?: boolean;
  inputErrors?: string[];
}

export type QuiQuadradoInputFormat = 'auto' | 'individual' | 'counts';

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  inputFormat?: QuiQuadradoInputFormat;
  excludedColumnIndexes?: number[];
}

export type QuiQuadradoAnalysisResult = ChiSquareIndependenceResult;

export interface QuiQuadradoEngineOutput {
  result: QuiQuadradoAnalysisResult;
  dataset: QuiQuadradoBuiltDataset;
  nudges: AssumptionNudge[];
}

function resolveColumnHeaders(
  headers: string[],
  recognizedColumns: Record<string, number>,
): [string, string] {
  const indexA = recognizedColumns.categoria_a;
  const indexB = recognizedColumns.categoria_b;
  return [
    indexA !== undefined ? headers[indexA] || 'Categoria A' : 'Categoria A',
    indexB !== undefined ? headers[indexB] || 'Categoria B' : 'Categoria B',
  ];
}

function isNumericOnlyColumn(values: string[]): boolean {
  if (!values.length) return false;
  return values.every((value) => statsEngine.parseNumber(value) !== null);
}

function isTotal(value: string): boolean {
  return /^total(?: geral)?$/i.test(value.trim());
}

function countRows(rows: string[][]): string[][] {
  const footer = rows.findIndex((row) => /^(?:fonte\s*:|notas?\s*:)/i.test(row[0]?.trim() ?? '')
    && row.slice(1).every((cell) => !cell.trim()));
  return (footer < 0 ? rows : rows.slice(0, footer))
    .filter((row) => row.some((cell) => cell.trim()) && !isTotal(row[0] ?? ''));
}

// TABNET count tables use dots/spaces as thousands separators. A decimal
// fraction, missing marker or suppressed value must never silently become zero.
function parseCount(raw: string): number | null {
  const value = raw.trim();
  const normalized = /^\d{1,3}(?:\.\d{3})+$/.test(value)
    ? value.replace(/\./g, '')
    : /^\d{1,3}(?:[ \u00a0]\d{3})+$/.test(value) ? value.replace(/[ \u00a0]/g, '') : value;
  if (!/^\d+(?:[,.]0+)?$/.test(normalized)) return null;
  const count = Number(normalized.replace(',', '.'));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function resolveQuiQuadradoInputFormat(input: BuildDatasetInput): 'individual' | 'counts' {
  if (input.inputFormat && input.inputFormat !== 'auto') return input.inputFormat;
  const rows = countRows(input.rows);
  const excluded = new Set(input.excludedColumnIndexes ?? []);
  const indexes = input.headers.flatMap((header, index) => index > 0 && !isTotal(header) && !excluded.has(index) ? [index] : []);
  // Totals provide evidence of aggregation. Without that evidence, keep the
  // individual-record contract; users can explicitly select a matrix without margins.
  const hasMargins = input.headers.some(isTotal) || input.rows.some((row) => isTotal(row[0] ?? ''));
  const looksLikeMatrix = hasMargins && input.headers.length >= 3
    && indexes.some((index) => rows.some((row) => parseCount(row[index] ?? '') !== null));
  return looksLikeMatrix ? 'counts' : 'individual';
}

function buildCountDataset(input: BuildDatasetInput): QuiQuadradoBuiltDataset {
  const excluded = new Set(input.excludedColumnIndexes ?? []);
  const indexes = input.headers.flatMap((header, index) => index > 0 && !isTotal(header) && !excluded.has(index) ? [index] : []);
  const rows = countRows(input.rows);
  const rowLabels = rows.map((row) => row[0]?.trim() ?? '');
  const colLabels = indexes.map((index) => input.headers[index]);
  const inputErrors: string[] = [];
  if (excluded.has(0)) inputErrors.push('Ative a primeira coluna, que identifica as linhas da tabela de contagens.');
  if (indexes.length < 2) inputErrors.push('Selecione pelo menos duas colunas de contagens, além da primeira coluna de categorias.');
  if (rowLabels.some((label) => !label) || new Set(rowLabels).size !== rowLabels.length) {
    inputErrors.push('Na tabela de contagens, cada linha precisa ter uma categoria distinta e preenchida na primeira coluna.');
  }
  if (new Set(colLabels).size !== colLabels.length) inputErrors.push('Use nomes distintos nas colunas de contagens.');
  const categoryLimitExceeded = rows.length > MAX_CATEGORY_LEVELS || indexes.length > MAX_CATEGORY_LEVELS;
  const table = categoryLimitExceeded ? [] : rows.map((row, rowIndex) => indexes.map((index) => {
    const value = parseCount(row[index] ?? '');
    if (value === null && inputErrors.length < 5) {
      inputErrors.push(`Contagem inválida em "${rowLabels[rowIndex]}", coluna "${input.headers[index]}". Use uma frequência inteira não negativa; valores ausentes ou suprimidos não são zero.`);
    }
    return value ?? NaN;
  }));
  const totalN = table.flat().reduce((sum, count) => sum + count, 0);
  if (!inputErrors.length && !categoryLimitExceeded) {
    if (!Number.isSafeInteger(totalN)) inputErrors.push('O total de contagens ultrapassa a precisão suportada.');
    if (table.some((row) => row.every((count) => count === 0))
      || indexes.some((_, index) => table.every((row) => row[index] === 0))) {
      inputErrors.push('Desative as linhas ou colunas cujo total é zero antes de analisar.');
    }
  }
  return { table, rowLabels, colLabels, columnHeaders: [input.headers[0] || 'Categoria', 'Categorias das colunas'],
    totalN, categoryLimitExceeded, inputErrors };
}

/**
 * Builds a contingency table from two categorical columns — string coercion only.
 */
export function buildDatasetFromConfirmed(input: BuildDatasetInput): QuiQuadradoBuiltDataset {
  if (resolveQuiQuadradoInputFormat(input) === 'counts') return buildCountDataset(input);
  const { headers, rows, recognizedColumns } = input;
  const indexA = recognizedColumns.categoria_a;
  const indexB = recognizedColumns.categoria_b;
  const columnHeaders = resolveColumnHeaders(headers, recognizedColumns);

  if (indexA === undefined || indexB === undefined) {
    return {
      table: [],
      rowLabels: [],
      colLabels: [],
      columnHeaders,
      totalN: 0,
    };
  }

  const pairs: Array<[string, string]> = [];
  const rowLabels: string[] = [];
  const colLabels: string[] = [];
  const rowIndexByLabel = new Map<string, number>();
  const colIndexByLabel = new Map<string, number>();
  let categoryLimitExceeded = false;

  for (const row of rows) {
    const valueA = String(row[indexA] ?? '').trim();
    const valueB = String(row[indexB] ?? '').trim();
    if (valueA && valueB) {
      if (!rowIndexByLabel.has(valueA)) {
        rowIndexByLabel.set(valueA, rowLabels.length);
        rowLabels.push(valueA);
        if (rowLabels.length > MAX_CATEGORY_LEVELS) categoryLimitExceeded = true;
      }
      if (!colIndexByLabel.has(valueB)) {
        colIndexByLabel.set(valueB, colLabels.length);
        colLabels.push(valueB);
        if (colLabels.length > MAX_CATEGORY_LEVELS) categoryLimitExceeded = true;
      }
      pairs.push([valueA, valueB]);
    }
  }

  if (categoryLimitExceeded) {
    return {
      table: [],
      rowLabels,
      colLabels,
      columnHeaders,
      totalN: pairs.length,
      categoryLimitExceeded: true,
    };
  }

  const table = rowLabels.map(() => colLabels.map(() => 0));

  pairs.forEach(([valueA, valueB]) => {
    table[rowIndexByLabel.get(valueA)!]![colIndexByLabel.get(valueB)!] += 1;
  });

  const totalN = statsEngine.sum(table.flat());

  return {
    table,
    rowLabels,
    colLabels,
    columnHeaders,
    totalN,
  };
}

export function validateDataset(dataset: QuiQuadradoBuiltDataset): string[] {
  if (dataset.inputErrors?.length) return dataset.inputErrors;
  const errors: string[] = [];
  const { table, rowLabels, colLabels, totalN } = dataset;

  if (dataset.categoryLimitExceeded) {
    return [`A tabela de contingência não pode exceder ${MAX_CATEGORY_LEVELS}×${MAX_CATEGORY_LEVELS} categorias.`];
  }

  if (!table.length || !colLabels.length) {
    errors.push(
      'Informe duas colunas categóricas (categoria_a e categoria_b) com pelo menos uma linha válida.',
    );
    return errors;
  }

  if (rowLabels.length < 2) {
    errors.push('A categoria A precisa de pelo menos 2 níveis distintos (linhas da tabela).');
  }

  if (colLabels.length < 2) {
    errors.push('A categoria B precisa de pelo menos 2 níveis distintos (colunas da tabela).');
  }

  if (totalN < MIN_TOTAL_N) {
    errors.push(`O total de observações válidas precisa ser pelo menos ${MIN_TOTAL_N}.`);
  }

  if (table.length > MAX_CATEGORY_LEVELS || colLabels.length > MAX_CATEGORY_LEVELS) {
    errors.push(`A tabela de contingência não pode exceder ${MAX_CATEGORY_LEVELS}×${MAX_CATEGORY_LEVELS} categorias.`);
  }

  return errors;
}

export function validateColumnTypes(
  headers: string[],
  rows: string[][],
  recognizedColumns: Record<string, number>,
  explicitlyCategoricalIndexes: readonly number[] = [],
): string[] {
  const errors: string[] = [];
  const indexA = recognizedColumns.categoria_a;
  const indexB = recognizedColumns.categoria_b;

  if (indexA === undefined && indexB === undefined) {
    errors.push('Mapeie as colunas categoria_a e categoria_b antes de analisar.');
    return errors;
  }

  if (indexA === undefined) {
    errors.push('Falta mapear a coluna categoria_a (primeira variável categórica).');
  }

  if (indexB === undefined) {
    errors.push('Falta mapear a coluna categoria_b (segunda variável categórica).');
  }

  if (indexA === undefined || indexB === undefined) {
    return errors;
  }

  const valuesA: string[] = [];
  const valuesB: string[] = [];

  for (const row of rows) {
    const rawA = String(row[indexA] ?? '').trim();
    const rawB = String(row[indexB] ?? '').trim();
    if (rawA) valuesA.push(rawA);
    if (rawB) valuesB.push(rawB);
  }

  const categoricalIndexes = new Set(explicitlyCategoricalIndexes);
  if (isNumericOnlyColumn(valuesA) && !categoricalIndexes.has(indexA)) {
    errors.push(
      `A coluna "${headers[indexA] || 'categoria_a'}" parece numérica. Use categorias em texto (ex.: sim/não, A/B/C).`,
    );
  }

  if (isNumericOnlyColumn(valuesB) && !categoricalIndexes.has(indexB)) {
    errors.push(
      `A coluna "${headers[indexB] || 'categoria_b'}" parece numérica. Use categorias em texto (ex.: sim/não, A/B/C).`,
    );
  }

  return errors;
}

export function runAnalysis(dataset: QuiQuadradoBuiltDataset): QuiQuadradoAnalysisResult {
  return runChiSquareIndependence(dataset.table);
}

export function classifyCramersV(v: number): string {
  const abs = Math.abs(v);
  if (abs < 0.1) return 'desprezível';
  if (abs < 0.3) return 'pequena';
  if (abs < 0.5) return 'moderada';
  return 'grande';
}

export function buildMetrics(
  result: QuiQuadradoAnalysisResult,
  dataset: QuiQuadradoBuiltDataset,
): ResultMetric[] {
  const effectClass = classifyCramersV(result.cramersV);
  const totalN = dataset.totalN;

  return [
    {
      label: 'Qui-quadrado (χ²)',
      helpKey: 'qui2',
      value: fmtNumber(result.chi2, 3),
      hint: `Graus de liberdade = ${result.df}`,
    },
    {
      label: 'p-valor',
      helpKey: 'p-valor',
      value: fmtP(result.p),
      hint: `χ² = ${fmtNumber(result.chi2, 3)} · gl = ${result.df}`,
    },
    {
      label: "Tamanho de efeito (Cramér's V)",
      helpKey: 'cramer-v',
      value: fmtNumber(result.cramersV, 3),
      hint: `Associação ${effectClass} entre as categorias.`,
    },
    {
      label: 'Total de observações',
      helpKey: 'total-observacoes',
      value: String(totalN),
      hint: `Tabela ${dataset.rowLabels.length}×${dataset.colLabels.length}.`,
    },
    {
      label: 'Células com esperado < 5',
      helpKey: 'celulas-esperado-baixo',
      value: String(result.cellsBelow5),
      hint: `${fmtNumber(result.pctBelow5, 1)}% das células da tabela.`,
    },
  ];
}

export function computeAssumptionNudges(
  result: QuiQuadradoAnalysisResult,
  dataset: QuiQuadradoBuiltDataset,
): AssumptionNudge[] {
  const nudges: AssumptionNudge[] = [];
  const { rowLabels, colLabels } = dataset;
  const rows = rowLabels.length;
  const cols = colLabels.length;

  if (result.cellsBelow5 > 0) {
    nudges.push({
      severity: 'warning',
      message: `${result.cellsBelow5} de ${rows * cols} células (${fmtNumber(result.pctBelow5, 1)}%) têm contagem esperada menor que 5. O qui-quadrado pode ser menos confiável. Interprete o p com cautela.`,
    });
  }

  if (rows === 2 && cols === 2 && result.cellsBelow5 > 0) {
    nudges.push({
      severity: 'info',
      message:
        'Em tabelas 2×2 esparsas, o teste exato de Fisher é uma alternativa mais conservadora (não calculado aqui).',
    });
  }

  return nudges;
}

export function toEngineOutput(
  dataset: QuiQuadradoBuiltDataset,
  result: QuiQuadradoAnalysisResult,
): QuiQuadradoEngineOutput {
  return {
    result,
    dataset,
    nudges: computeAssumptionNudges(result, dataset),
  };
}
