import type { AssumptionNudge } from '@/features/tests/shared/assumptionNudges';
import { fmtNumber, fmtP } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  runChiSquareIndependence,
  statsEngine,
  type ChiSquareIndependenceResult,
} from '@/shared/stats/statsEngine';

const MIN_TOTAL_N = 5;

export interface QuiQuadradoBuiltDataset {
  table: number[][];
  rowLabels: string[];
  colLabels: string[];
  columnHeaders: [string, string];
  totalN: number;
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
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

function collectUniqueLevels(values: string[]): string[] {
  const seen = new Set<string>();
  const levels: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      levels.push(value);
    }
  }
  return levels;
}

function isNumericOnlyColumn(values: string[]): boolean {
  if (!values.length) return false;
  return values.every((value) => statsEngine.parseNumber(value) !== null);
}

/**
 * Builds a contingency table from two categorical columns — string coercion only.
 */
export function buildDatasetFromConfirmed(input: BuildDatasetInput): QuiQuadradoBuiltDataset {
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

  const rawA: string[] = [];
  const rawB: string[] = [];

  for (const row of rows) {
    const valueA = String(row[indexA] ?? '').trim();
    const valueB = String(row[indexB] ?? '').trim();
    if (valueA && valueB) {
      rawA.push(valueA);
      rawB.push(valueB);
    }
  }

  const rowLabels = collectUniqueLevels(rawA);
  const colLabels = collectUniqueLevels(rawB);
  const table = rowLabels.map(() => colLabels.map(() => 0));

  rawA.forEach((valueA, rowIndex) => {
    const valueB = rawB[rowIndex];
    const rowIdx = rowLabels.indexOf(valueA);
    const colIdx = colLabels.indexOf(valueB);
    if (rowIdx >= 0 && colIdx >= 0) {
      table[rowIdx][colIdx] += 1;
    }
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
  const errors: string[] = [];
  const { table, rowLabels, colLabels, totalN } = dataset;

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

  if (table.length > 20 || colLabels.length > 20) {
    errors.push('A tabela de contingência não pode exceder 20×20 categorias.');
  }

  return errors;
}

export function validateColumnTypes(
  headers: string[],
  rows: string[][],
  recognizedColumns: Record<string, number>,
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

  if (isNumericOnlyColumn(valuesA)) {
    errors.push(
      `A coluna "${headers[indexA] || 'categoria_a'}" parece numérica — use categorias em texto (ex.: sim/não, A/B/C).`,
    );
  }

  if (isNumericOnlyColumn(valuesB)) {
    errors.push(
      `A coluna "${headers[indexB] || 'categoria_b'}" parece numérica — use categorias em texto (ex.: sim/não, A/B/C).`,
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
      value: fmtNumber(result.chi2, 3),
      hint: `Graus de liberdade = ${result.df}`,
    },
    {
      label: 'Evidência estatística',
      value: fmtP(result.p),
      hint: `χ² = ${fmtNumber(result.chi2, 3)} · gl = ${result.df}`,
    },
    {
      label: "Tamanho de efeito (Cramér's V)",
      value: fmtNumber(result.cramersV, 3),
      hint: `Associação ${effectClass} entre as categorias.`,
    },
    {
      label: 'Total de observações',
      value: String(totalN),
      hint: `Tabela ${dataset.rowLabels.length}×${dataset.colLabels.length}.`,
    },
    {
      label: 'Células com esperado < 5',
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
      message: `${result.cellsBelow5} de ${rows * cols} células (${fmtNumber(result.pctBelow5, 1)}%) têm contagem esperada menor que 5. O qui-quadrado pode ser menos confiável — interprete o p com cautela.`,
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
