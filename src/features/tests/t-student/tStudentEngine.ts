import { deriveIndependentTTest, derivePairedTTest } from '@/shared/data-input/datasusNormalizer';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import type { DatasusSource } from '@/shared/data-input/types';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { statsEngine, type WelchTResult } from '@/shared/stats/statsEngine';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import type { TStudentMode } from './tStudentConfig';

export interface TStudentWelchResult extends WelchTResult {
  testKind?: 'independent';
}

export interface TStudentPairedResult extends WelchTResult {
  testKind: 'paired';
  meanDifference: number;
  sdDifference: number;
}

export type TStudentResult = TStudentWelchResult | TStudentPairedResult;

export interface TStudentBuiltDataset {
  g1: number[];
  g2: number[];
  labels: [string, string];
  mode: TStudentMode;
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  mode: TStudentMode;
}

export interface DatasusKnobState {
  groupAKeys: string[];
  groupBKeys: string[];
  timeKeys: string[];
  leftSourceId?: string;
  rightSourceId?: string;
}

export interface RunFromDatasusInput {
  mode: TStudentMode;
  source: DatasusSource;
  leftSource?: DatasusSource;
  rightSource?: DatasusSource;
  knobs: DatasusKnobState;
}

function effectivelyZeroStandardError(standardError: number, values: readonly number[]): boolean {
  const scale = Math.max(1, ...values.map((value) => Math.abs(value)));
  return !Number.isFinite(standardError) || standardError <= Number.EPSILON * scale * 32;
}

function unestimableStandardErrorMessage(
  mode: TStudentMode,
  g1: readonly number[],
  g2: readonly number[],
): string | null {
  if (mode === 'paired') {
    const differences = g1.map((value, index) => value - g2[index]!);
    const se = statsEngine.sd(differences) / Math.sqrt(differences.length);
    return effectivelyZeroStandardError(se, differences)
      ? 'O erro padrão das diferenças é zero ou numericamente indistinguível de zero; as diferenças pareadas não têm variação suficiente para estimar o teste t.'
      : null;
  }
  const se = Math.sqrt((statsEngine.sd([...g1]) ** 2) / g1.length + (statsEngine.sd([...g2]) ** 2) / g2.length);
  return effectivelyZeroStandardError(se, [...g1, ...g2])
    ? 'O erro padrão é zero ou numericamente indistinguível de zero; os grupos não têm variação suficiente para estimar o teste t.'
    : null;
}

/** Mirrors `classifyEffect` from tests/t-student/module.js:140-147. */
export function classifyEffect(d: number): string {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'muito pequeno';
  if (abs < 0.5) return 'pequeno';
  if (abs < 0.8) return 'moderado';
  if (abs < 1.2) return 'grande';
  return 'muito grande';
}

/** Port of safeWelch — parity oracle is this function, not raw statsEngine.welchT. */
export function runIndependentWelch(g1: number[], g2: number[]): TStudentWelchResult {
  const n1 = g1.length;
  const n2 = g2.length;
  const m1 = statsEngine.mean(g1);
  const m2 = statsEngine.mean(g2);
  const s1 = statsEngine.sd(g1);
  const s2 = statsEngine.sd(g2);
  const v1 = s1 ** 2;
  const v2 = s2 ** 2;
  const diff = m1 - m2;
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  if (effectivelyZeroStandardError(se, [...g1, ...g2])) {
    throw new Error('O erro padrão é zero; os grupos não têm variação suficiente para estimar o teste t.');
  }
  const t = diff / se;
  const dfDen = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  const df = dfDen === 0 ? n1 + n2 - 2 : (v1 / n1 + v2 / n2) ** 2 / dfDen;
  const p =
    Number.isFinite(df) && df > 0 ? 2 * (1 - statsEngine.tcdf(Math.abs(t), df)) : NaN;
  const tcrit = Number.isFinite(df) && df > 0 ? statsEngine.tInv(0.975, df) : NaN;
  const ci: [number, number] = Number.isFinite(tcrit)
    ? [diff - tcrit * se, diff + tcrit * se]
    : [NaN, NaN];
  const spDen = n1 + n2 - 2;
  const sp =
    spDen > 0 ? Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / spDen) : NaN;
  const d = !Number.isFinite(sp) || sp === 0 ? 0 : diff / sp;

  return { n1, n2, m1, m2, s1, s2, diff, se, t, df, p, ci, d, testKind: 'independent' };
}

/** Port of safePaired from tests/t-student/module.js:1077-1110. */
export function runPairedT(g1: number[], g2: number[]): TStudentPairedResult {
  const n = Math.min(g1.length, g2.length);
  const a = g1.slice(0, n);
  const b = g2.slice(0, n);
  const differences = a.map((value, index) => value - b[index]);
  const m1 = statsEngine.mean(a);
  const m2 = statsEngine.mean(b);
  const s1 = statsEngine.sd(a);
  const s2 = statsEngine.sd(b);
  const diff = statsEngine.mean(differences);
  const sdDifference = statsEngine.sd(differences);
  const se = sdDifference / Math.sqrt(n);
  if (effectivelyZeroStandardError(se, differences)) {
    throw new Error('O erro padrão das diferenças é zero; as diferenças pareadas não têm variação suficiente para estimar o teste t.');
  }
  const t = diff / se;
  const df = n - 1;
  const p =
    Number.isFinite(df) && df > 0 ? 2 * (1 - statsEngine.tcdf(Math.abs(t), df)) : NaN;
  const tcrit = Number.isFinite(df) && df > 0 ? statsEngine.tInv(0.975, df) : NaN;
  const ci: [number, number] = Number.isFinite(tcrit)
    ? [diff - tcrit * se, diff + tcrit * se]
    : [NaN, NaN];
  const d = !Number.isFinite(sdDifference) || sdDifference === 0 ? 0 : diff / sdDifference;

  return {
    testKind: 'paired',
    n1: n,
    n2: n,
    m1,
    m2,
    s1,
    s2,
    diff,
    meanDifference: diff,
    sdDifference,
    se,
    t,
    df,
    p,
    ci,
    d,
  };
}

function resolveColumnLabels(
  headers: string[],
  recognizedColumns: Record<string, number>,
): [string, string] {
  const indexA = recognizedColumns.grupo_a;
  const indexB = recognizedColumns.grupo_b;
  return [
    indexA !== undefined ? headers[indexA] || 'Grupo A' : 'Grupo A',
    indexB !== undefined ? headers[indexB] || 'Grupo B' : 'Grupo B',
  ];
}

/**
 * Maps confirmed tabular paste to group vectors — guided wide format primary
 * (unidade;grupo_a;grupo_b), porting buildManualDatasetFromTabularState semantics.
 */
export function buildDatasetFromConfirmed(input: BuildDatasetInput): TStudentBuiltDataset {
  const { headers, rows, recognizedColumns, mode } = input;
  const indexA = recognizedColumns.grupo_a;
  const indexB = recognizedColumns.grupo_b;

  if (indexA === undefined || indexB === undefined) {
    return { g1: [], g2: [], labels: resolveColumnLabels(headers, recognizedColumns), mode };
  }

  const g1: number[] = [];
  const g2: number[] = [];

  for (const row of rows) {
    const rawA = (row[indexA] ?? '').trim();
    const rawB = (row[indexB] ?? '').trim();
    const valueA = statsEngine.parseNumber(rawA);
    const valueB = statsEngine.parseNumber(rawB);

    if (mode === 'paired') {
      if (valueA !== null && valueB !== null) {
        g1.push(valueA);
        g2.push(valueB);
      }
    } else {
      if (valueA !== null) g1.push(valueA);
      if (valueB !== null) g2.push(valueB);
    }
  }

  return {
    g1,
    g2,
    labels: resolveColumnLabels(headers, recognizedColumns),
    mode,
  };
}

export function validateSampleSize(mode: TStudentMode, dataset: TStudentBuiltDataset): string[] {
  const errors: string[] = [];
  const { g1, g2 } = dataset;

  if (mode === 'paired') {
    if (g1.length < 2 || g2.length < 2) {
      errors.push('Cada grupo precisa de pelo menos 2 observações válidas.');
    }
    if (g1.length !== g2.length) {
      errors.push(
        'No t pareado, as duas colunas precisam ter o mesmo número de linhas válidas.',
      );
    }
  } else if (g1.length < 2 || g2.length < 2) {
    errors.push('Cada grupo precisa de pelo menos 2 observações válidas.');
  }

  if (!errors.length) {
    const standardErrorIssue = unestimableStandardErrorMessage(mode, g1, g2);
    if (standardErrorIssue) errors.push(standardErrorIssue);
  }

  return errors;
}

export function runAnalysis(
  mode: TStudentMode,
  dataset: TStudentBuiltDataset,
): TStudentResult {
  return mode === 'paired'
    ? runPairedT(dataset.g1, dataset.g2)
    : runIndependentWelch(dataset.g1, dataset.g2);
}

export function runFromDatasusDerived(
  mode: TStudentMode,
  vectors: { A: number[]; B: number[] },
): TStudentResult {
  return mode === 'paired'
    ? runPairedT(vectors.A, vectors.B)
    : runIndependentWelch(vectors.A, vectors.B);
}

export function deriveDatasusDataset(input: RunFromDatasusInput): {
  ok: boolean;
  errors: string[];
  dataset?: TStudentBuiltDataset;
} {
  const { mode, source, leftSource, rightSource, knobs } = input;

  if (mode === 'paired') {
    if (!leftSource || !rightSource) {
      return { ok: false, errors: ['Selecione as duas bases DATASUS para o t pareado.'] };
    }
    const derived = derivePairedTTest({
      leftSource,
      rightSource,
      timeKeys: knobs.timeKeys,
      includeTotal: false,
      stats: legacyStats,
    });
    if (!derived.ok) {
      return { ok: false, errors: derived.errors.length ? derived.errors : [derived.primaryError] };
    }
    return {
      ok: true,
      errors: [],
      dataset: {
        g1: derived.vectors.A,
        g2: derived.vectors.B,
        labels: ['Grupo A', 'Grupo B'],
        mode,
      },
    };
  }

  const derived = deriveIndependentTTest({
    source,
    groupAKeys: knobs.groupAKeys,
    groupBKeys: knobs.groupBKeys,
    timeKeys: knobs.timeKeys,
    includeTotal: false,
    stats: legacyStats,
  });

  if (!derived.ok) {
    return { ok: false, errors: derived.errors.length ? derived.errors : [derived.primaryError] };
  }

  return {
    ok: true,
    errors: [],
    dataset: {
      g1: derived.vectors.A,
      g2: derived.vectors.B,
      labels: derived.groupLabels as [string, string],
      mode,
    },
  };
}

export function buildMetrics(result: TStudentResult, labels: [string, string]): ResultMetric[] {
  const effectClass = classifyEffect(result.d);

  return [
    {
      label: `Média de ${labels[0]}`,
      value: fmtNumber(result.m1, 2),
      hint: `n = ${result.n1} · desvio-padrão = ${fmtNumber(result.s1, 2)}`,
    },
    {
      label: `Média de ${labels[1]}`,
      value: fmtNumber(result.m2, 2),
      hint: `n = ${result.n2} · desvio-padrão = ${fmtNumber(result.s2, 2)}`,
    },
    {
      label: 'Diferença entre médias',
      value: fmtSigned(result.diff, 2),
      hint: `IC95%: ${fmtNumber(result.ci[0], 2)} a ${fmtNumber(result.ci[1], 2)}`,
    },
    {
      label: 'Evidência estatística',
      value: fmtP(result.p),
      hint: `t = ${fmtNumber(result.t, 3)} · graus de liberdade = ${fmtNumber(result.df, 2)}`,
    },
    {
      label: "Tamanho de efeito (Cohen's d)",
      value: fmtSigned(result.d, 2),
      hint: `Classificação: ${effectClass}`,
    },
    {
      label: 'Intervalo de confiança de 95%',
      value: `${fmtNumber(result.ci[0], 2)} a ${fmtNumber(result.ci[1], 2)}`,
      hint: 'Faixa plausível para a diferença entre as médias.',
    },
  ];
}

export interface TStudentEngineOutput {
  result: TStudentResult;
  g1: number[];
  g2: number[];
  labels: [string, string];
  mode: TStudentMode;
}

export function toEngineOutput(
  dataset: TStudentBuiltDataset,
  result: TStudentResult,
): TStudentEngineOutput {
  return {
    result,
    g1: dataset.g1,
    g2: dataset.g2,
    labels: dataset.labels,
    mode: dataset.mode,
  };
}
