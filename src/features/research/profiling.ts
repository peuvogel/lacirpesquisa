import jStat from 'jstat';
import type { AnalysisCell, VariableProfile } from './types';

export type ShapiroResult =
  | { state: 'supported'; n: number; w: number; pValue: number }
  | { state: 'insufficient'; n: number };

export interface ProfilePoint {
  territoryId: string;
  groupId: string;
  periodKey: string;
  value: number;
}

export interface HistogramBin {
  lower: number;
  upper: number;
  count: number;
}

export interface QqPoint {
  theoretical: number;
  observed: number;
}

export interface NumericSummary {
  expectedN: number;
  n: number;
  missingCount: number;
  zeroCount: number;
  zeroShare: number;
  mean: number | null;
  median: number | null;
  sampleSd: number | null;
  iqr: number | null;
  min: number | null;
  max: number | null;
  skewness: number | null;
  dispersionIndex: number | null;
  outliers: ProfilePoint[];
  histogramBins: HistogramBin[];
  qqPoints: QqPoint[];
}

export type NormalityClassification =
  | 'approximately_normal'
  | 'non_normal'
  | 'insufficient'
  | 'not_applicable';

export interface NormalityResult {
  state: 'supported' | 'insufficient' | 'not_applicable';
  classification: NormalityClassification;
  shapiro?: ShapiroResult;
  diagnostics: {
    absoluteSkewness?: number;
    outlierShare?: number;
    qqCorrelation?: number;
    reason?: 'sample_size_or_constant' | 'count_distribution' | 'categorical_distribution';
  };
}

export interface VariableProfileResult {
  variableId: string;
  overall: NumericSummary;
  byGroup: Record<string, { summary: NumericSummary; normality: NormalityResult }>;
  normalityScope: 'within_groups';
}

function usable(cell: AnalysisCell): cell is AnalysisCell & { rawValue: number } {
  return (
    cell.analyticStatus === 'include'
    && (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero')
    && typeof cell.rawValue === 'number'
    && Number.isFinite(cell.rawValue)
  );
}

function quantile(sorted: readonly number[], probability: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const left = sorted[lower]!;
  const right = sorted[upper]!;
  return left + (right - left) * (position - lower);
}

function sampleSkewness(values: readonly number[], mean: number, sampleSd: number): number | null {
  const n = values.length;
  if (n < 3 || sampleSd === 0) return null;
  const standardizedCubeSum = values.reduce(
    (sum, value) => sum + ((value - mean) / sampleSd) ** 3,
    0,
  );
  return (n / ((n - 1) * (n - 2))) * standardizedCubeSum;
}

function histogram(values: readonly number[]): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ lower: min, upper: max, count: values.length }];
  const binCount = Math.max(1, Math.ceil(Math.log2(values.length) + 1));
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: min + index * width,
    upper: index === binCount - 1 ? max : min + (index + 1) * width,
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width));
    bins[index]!.count += 1;
  }
  return bins;
}

function qqPoints(values: readonly number[]): QqPoint[] {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.map((observed, index) => ({
    theoretical: jStat.normal.inv((index + 0.625) / (sorted.length + 0.25), 0, 1),
    observed,
  }));
}

function pearsonCorrelation(points: readonly QqPoint[]): number {
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, point) => sum + point.theoretical, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.observed, 0) / points.length;
  let numerator = 0;
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    const dx = point.theoretical - meanX;
    const dy = point.observed - meanY;
    numerator += dx * dy;
    sumX += dx * dx;
    sumY += dy * dy;
  }
  const denominator = Math.sqrt(sumX * sumY);
  return denominator === 0 ? 0 : numerator / denominator;
}

function summarize(cells: readonly AnalysisCell[]): NumericSummary {
  const points = cells.filter(usable).map((cell) => ({
    territoryId: cell.territoryId,
    groupId: cell.groupId,
    periodKey: cell.periodKey,
    value: cell.rawValue,
  }));
  const sorted = points.map((point) => point.value).sort((left, right) => left - right);
  const n = sorted.length;
  const mean = n === 0 ? null : sorted.reduce((sum, value) => sum + value, 0) / n;
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q1 === null || q3 === null ? null : q3 - q1;
  const sampleVariance = n > 1 && mean !== null
    ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
    : null;
  const sampleSd = sampleVariance === null ? null : Math.sqrt(sampleVariance);
  const lowerFence = q1 === null || iqr === null ? null : q1 - 1.5 * iqr;
  const upperFence = q3 === null || iqr === null ? null : q3 + 1.5 * iqr;
  const outliers = lowerFence === null || upperFence === null
    ? []
    : points.filter((point) => point.value < lowerFence || point.value > upperFence);

  return {
    expectedN: cells.length,
    n,
    missingCount: cells.length - n,
    zeroCount: sorted.filter((value) => value === 0).length,
    zeroShare: n === 0 ? 0 : sorted.filter((value) => value === 0).length / n,
    mean,
    median,
    sampleSd,
    iqr,
    min: n === 0 ? null : sorted[0]!,
    max: n === 0 ? null : sorted[n - 1]!,
    skewness: mean === null || sampleSd === null ? null : sampleSkewness(sorted, mean, sampleSd),
    dispersionIndex: mean === null || mean <= 0 || sampleVariance === null ? null : sampleVariance / mean,
    outliers,
    histogramBins: histogram(sorted),
    qqPoints: qqPoints(sorted),
  };
}

function polynomial(coefficients: readonly number[], value: number): number {
  let result = coefficients[0] ?? 0;
  let power = value;
  for (let index = 1; index < coefficients.length; index += 1) {
    result += coefficients[index]! * power;
    power *= value;
  }
  return result;
}

/** Royston's AS R94 approximation, the same approximation family used by R's shapiro.test. */
export function shapiroWilk(input: readonly number[]): ShapiroResult {
  const values = [...input].filter(Number.isFinite).sort((left, right) => left - right);
  const n = values.length;
  if (n < 3 || n > 5000 || values[0] === values[n - 1]) return { state: 'insufficient', n };
  if (n === 3) {
    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    const ss = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    const b = Math.SQRT1_2 * (values[2]! - values[0]!);
    const w = (b * b) / ss;
    const pValue = Math.max(0, Math.min(1, (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.asin(Math.sqrt(0.75)))));
    return { state: 'supported', n, w, pValue };
  }

  const half = Math.floor(n / 2);
  const expected = Array.from({ length: half }, (_, index) =>
    jStat.normal.inv((index + 1 - 0.375) / (n + 0.25), 0, 1));
  const sumSquares = 2 * expected.reduce((sum, value) => sum + value * value, 0);
  const rootN = 1 / Math.sqrt(n);
  const coefficients = [...expected];
  const a1 = polynomial([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rootN)
    - expected[0]! / Math.sqrt(sumSquares);
  let start = 1;
  let numerator = sumSquares - 2 * expected[0]! ** 2;
  let denominator = 1 - 2 * a1 ** 2;
  coefficients[0] = a1;
  if (n > 5) {
    const a2 = polynomial([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rootN)
      - expected[1]! / Math.sqrt(sumSquares);
    coefficients[1] = a2;
    start = 2;
    numerator -= 2 * expected[1]! ** 2;
    denominator -= 2 * a2 ** 2;
  }
  const factor = Math.sqrt(numerator / denominator);
  for (let index = start; index < half; index += 1) coefficients[index] = -expected[index]! / factor;

  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const ss = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const weightedRange = coefficients.reduce(
    (sum, coefficient, index) => sum + coefficient * (values[n - 1 - index]! - values[index]!),
    0,
  );
  const w = Math.max(0, Math.min(1, (weightedRange * weightedRange) / ss));
  const y = Math.log1p(-w);
  let transformed = y;
  let location: number;
  let scale: number;
  if (n <= 11) {
    const gamma = polynomial([-2.273, 0.459], n);
    if (y >= gamma) return { state: 'supported', n, w, pValue: 1e-19 };
    transformed = -Math.log(gamma - y);
    location = polynomial([0.544, -0.39978, 0.025054, -0.0006714], n);
    scale = Math.exp(polynomial([1.3822, -0.77857, 0.062767, -0.0020322], n));
  } else {
    const logN = Math.log(n);
    location = polynomial([-1.5861, -0.31082, -0.083751, 0.0038915], logN);
    scale = Math.exp(polynomial([-0.4803, -0.082676, 0.0030302], logN));
  }
  const pValue = Math.max(0, Math.min(1, 1 - jStat.normal.cdf((transformed - location) / scale, 0, 1)));
  return { state: 'supported', n, w, pValue };
}

function normality(summary: NumericSummary, variableType: VariableProfile['variableType']): NormalityResult {
  if (variableType === 'count') {
    return { state: 'not_applicable', classification: 'not_applicable', diagnostics: { reason: 'count_distribution' } };
  }
  if (variableType === 'categorical' || variableType === 'ordinal') {
    return { state: 'not_applicable', classification: 'not_applicable', diagnostics: { reason: 'categorical_distribution' } };
  }
  const shapiro = shapiroWilk(summary.qqPoints.map((point) => point.observed));
  if (shapiro.state === 'insufficient') {
    return { state: 'insufficient', classification: 'insufficient', shapiro, diagnostics: { reason: 'sample_size_or_constant' } };
  }
  const absoluteSkewness = Math.abs(summary.skewness ?? 0);
  const outlierShare = summary.n === 0 ? 0 : summary.outliers.length / summary.n;
  const qqCorrelation = pearsonCorrelation(summary.qqPoints);
  const classification = (
    shapiro.pValue >= 0.05
    && absoluteSkewness <= 1
    && outlierShare < 0.1
    && qqCorrelation >= 0.95
  ) ? 'approximately_normal' : 'non_normal';
  return { state: 'supported', classification, shapiro, diagnostics: { absoluteSkewness, outlierShare, qqCorrelation } };
}

export function profileVariable(
  cells: readonly AnalysisCell[],
  profile: VariableProfile,
): VariableProfileResult {
  const relevant = cells.filter((cell) => cell.variableId === profile.variableId);
  const groupIds = [...new Set(relevant.map((cell) => cell.groupId))].sort();
  const byGroup = Object.fromEntries(groupIds.map((groupId) => {
    const summary = summarize(relevant.filter((cell) => cell.groupId === groupId));
    return [groupId, { summary, normality: normality(summary, profile.variableType) }];
  }));
  return {
    variableId: profile.variableId,
    overall: summarize(relevant),
    byGroup,
    normalityScope: 'within_groups',
  };
}

export interface CompletePair {
  groupId: string;
  territoryId: string;
  periodKey: string;
  x: number;
  y: number;
}

export function completePairs(cells: readonly AnalysisCell[], xVariableId: string, yVariableId: string): {
  n: number;
  excludedScopeCount: number;
  pairs: CompletePair[];
} {
  const byScope = new Map<string, Partial<Record<'x' | 'y', number>>>();
  const scopeParts = new Map<string, Pick<AnalysisCell, 'groupId' | 'territoryId' | 'periodKey'>>();
  const independentUnits = new Set<string>();
  for (const cell of cells) {
    if (cell.variableId !== xVariableId && cell.variableId !== yVariableId) continue;
    const key = JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey]);
    scopeParts.set(key, {
      groupId: cell.groupId,
      territoryId: cell.territoryId,
      periodKey: cell.periodKey,
    });
    independentUnits.add(JSON.stringify([cell.groupId, cell.territoryId]));
    const pair = byScope.get(key) ?? {};
    if (usable(cell)) pair[cell.variableId === xVariableId ? 'x' : 'y'] = cell.rawValue;
    byScope.set(key, pair);
  }
  const pairs: CompletePair[] = [];
  for (const [key, pair] of byScope) {
    if (typeof pair.x !== 'number' || typeof pair.y !== 'number') continue;
    const scope = scopeParts.get(key)!;
    pairs.push({ ...scope, x: pair.x, y: pair.y });
  }
  pairs.sort((left, right) =>
    left.groupId.localeCompare(right.groupId)
    || left.territoryId.localeCompare(right.territoryId)
    || left.periodKey.localeCompare(right.periodKey));
  const pairedUnits = new Set(pairs.map((pair) => JSON.stringify([pair.groupId, pair.territoryId])));
  return { n: pairs.length, excludedScopeCount: independentUnits.size - pairedUnits.size, pairs };
}
