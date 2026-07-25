import { deriveCorrelationPairs } from '@/shared/data-input/datasusNormalizer';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import type { DatasusSource } from '@/shared/data-input/types';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { statsEngine, type PearsonResult } from '@/shared/stats/statsEngine';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import type { CorrelacaoMethod } from './correlacaoConfig';

export interface CorrelacaoBuiltDataset {
  x: number[];
  y: number[];
  labels: string[];
  headers: [string, string];
  method: CorrelacaoMethod;
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  method: CorrelacaoMethod;
}

export interface DatasusKnobState {
  xSourceId: string;
  ySourceId: string;
  xMetricKey: string;
  yMetricKey: string;
  timeKey: string;
}

export interface RunFromDatasusInput {
  xSource: DatasusSource;
  ySource: DatasusSource;
  knobs: DatasusKnobState;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/** Port of outlierMask from tests/correlacao/module.js:78-86. */
export function computeOutlierFlags(values: number[]): boolean[] {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return values.map((value) => value < low || value > high);
}

function resolveColumnLabels(
  headers: string[],
  recognizedColumns: Record<string, number>,
): [string, string] {
  const indexX = recognizedColumns.variavel_x;
  const indexY = recognizedColumns.variavel_y;
  return [
    indexX !== undefined ? headers[indexX] || 'variavel_x' : 'variavel_x',
    indexY !== undefined ? headers[indexY] || 'variavel_y' : 'variavel_y',
  ];
}

export function buildDatasetFromConfirmed(input: BuildDatasetInput): CorrelacaoBuiltDataset {
  const { headers, rows, recognizedColumns, method } = input;
  const indexX = recognizedColumns.variavel_x;
  const indexY = recognizedColumns.variavel_y;
  const columnLabels = resolveColumnLabels(headers, recognizedColumns);

  if (indexX === undefined || indexY === undefined) {
    return { x: [], y: [], labels: [], headers: columnLabels, method };
  }

  const x: number[] = [];
  const y: number[] = [];
  const labels: string[] = [];

  rows.forEach((row, rowIndex) => {
    const rawX = (row[indexX] ?? '').trim();
    const rawY = (row[indexY] ?? '').trim();
    const valueX = statsEngine.parseNumber(rawX);
    const valueY = statsEngine.parseNumber(rawY);
    if (valueX !== null && valueY !== null) {
      x.push(valueX);
      y.push(valueY);
      const idIndex = recognizedColumns.id;
      const idRaw = idIndex !== undefined ? (row[idIndex] ?? '').trim() : '';
      labels.push(idRaw || `Linha ${rowIndex + 1}`);
    }
  });

  return { x, y, labels, headers: columnLabels, method };
}

export function runCorrelation(
  x: number[],
  y: number[],
  method: CorrelacaoMethod,
): PearsonResult {
  return method === 'spearman' ? statsEngine.spearman(x, y) : statsEngine.pearson(x, y);
}

export function validatePairs(dataset: CorrelacaoBuiltDataset): string[] {
  const errors: string[] = [];
  if (dataset.x.length < 4) {
    errors.push('Forneça ao menos 4 pares válidos para uma análise mais estável.');
  }
  if (dataset.x.length >= 4) {
    const pearson = statsEngine.pearson(dataset.x, dataset.y);
    const spearman = statsEngine.spearman(dataset.x, dataset.y);
    if (!Number.isFinite(pearson.coef) || !Number.isFinite(spearman.coef)) {
      errors.push(
        'Não foi possível calcular a correlação. Revise se as colunas possuem variação suficiente.',
      );
    }
  }
  return errors;
}

export function deriveDatasusDataset(input: RunFromDatasusInput): {
  ok: boolean;
  errors: string[];
  dataset?: CorrelacaoBuiltDataset;
} {
  const { xSource, ySource, knobs } = input;
  const derived = deriveCorrelationPairs({
    xSource,
    ySource,
    xMetricKey: knobs.xMetricKey,
    yMetricKey: knobs.yMetricKey,
    timeKeys: knobs.timeKey ? [knobs.timeKey] : [],
    includeTotal: false,
    stats: legacyStats,
  });

  if (!derived.ok) {
    return {
      ok: false,
      errors: derived.errors.length ? derived.errors : [derived.primaryError],
    };
  }

  return {
    ok: true,
    errors: [],
    dataset: {
      x: derived.pairs.map((pair) => pair.x),
      y: derived.pairs.map((pair) => pair.y),
      labels: derived.pairs.map((pair) => pair.label),
      headers: [derived.xLabel || 'X', derived.yLabel || 'Y'],
      method: 'pearson',
    },
  };
}

export function buildMetrics(
  result: PearsonResult,
  method: CorrelacaoMethod,
  labels: [string, string],
): ResultMetric[] {
  const coefLabel = method === 'spearman' ? 'ρ de Spearman' : 'r de Pearson';
  const methodLabel = method === 'spearman' ? 'Spearman' : 'Pearson';

  return [
    {
      label: 'Método',
      value: methodLabel,
      hint: method === 'spearman' ? 'Associação monótona por ranks' : 'Associação linear',
    },
    {
      label: coefLabel,
      value: fmtSigned(result.coef, 3),
      hint: `Entre ${labels[0]} e ${labels[1]}`,
    },
    {
      label: 'p-valor',
      value: fmtP(result.p),
      hint: `n = ${result.n} pares válidos`,
    },
    {
      label: 'Amostra',
      value: String(result.n),
      hint: 'Pares utilizados no cálculo',
    },
    {
      label: 'IC95% do coeficiente',
      value: `${fmtNumber(result.ci[0], 3)} a ${fmtNumber(result.ci[1], 3)}`,
      hint: 'Intervalo de confiança aproximado (transformação de Fisher)',
    },
    {
      label: 'R²',
      value: fmtNumber(result.r2, 3),
      hint: method === 'pearson' ? 'Proporção da variação linear explicada' : 'Coeficiente ao quadrado',
    },
  ];
}

export interface CorrelacaoEngineOutput {
  result: PearsonResult;
  pearson: PearsonResult;
  spearman: PearsonResult;
  x: number[];
  y: number[];
  labels: string[];
  headers: [string, string];
  method: CorrelacaoMethod;
  outlierFlags: boolean[];
}

export function toEngineOutput(
  dataset: CorrelacaoBuiltDataset,
  method: CorrelacaoMethod,
): CorrelacaoEngineOutput {
  const pearson = statsEngine.pearson(dataset.x, dataset.y);
  const spearman = statsEngine.spearman(dataset.x, dataset.y);
  const result = method === 'spearman' ? spearman : pearson;
  const xOut = computeOutlierFlags(dataset.x);
  const yOut = computeOutlierFlags(dataset.y);
  const outlierFlags = xOut.map((flag, index) => flag || yOut[index]);

  return {
    result,
    pearson,
    spearman,
    x: dataset.x,
    y: dataset.y,
    labels: dataset.labels,
    headers: dataset.headers,
    method,
    outlierFlags,
  };
}
