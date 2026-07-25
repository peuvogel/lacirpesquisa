import type { AssumptionNudge } from '@/features/tests/shared/assumptionNudges';
import { RARE_EVENTS_THRESHOLD, SEPARATION_BETA_THRESHOLD } from './logisticaConfig';
import { fmtNumber, fmtP } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  fitLogistic,
  type GlmCoefficient,
  type GlmDesign,
  type LogisticFitResult,
} from '@/shared/stats/glmEngine';
import { statsEngine } from '@/shared/stats/statsEngine';

export const MAX_OBS = 10_000;
export const MIN_EVENTS_PER_CLASS = 1;

export interface LogisticaBuiltDataset {
  y: number[];
  design: GlmDesign;
  outcomeHeader: string;
  predictorHeaders: string[];
  n: number;
  classCounts: { zero: number; one: number };
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
}

export interface LogisticaEngineOutput {
  result: LogisticFitResult;
  dataset: LogisticaBuiltDataset;
  nudges: AssumptionNudge[];
}

function resolveOutcomeHeader(headers: string[], recognizedColumns: Record<string, number>): string {
  const index = recognizedColumns.desfecho_binario;
  return index !== undefined ? headers[index] || 'desfecho_binario' : 'desfecho_binario';
}

function resolvePredictorHeader(headers: string[], recognizedColumns: Record<string, number>): string {
  const index = recognizedColumns.preditor;
  return index !== undefined ? headers[index] || 'preditor' : 'preditor';
}

function collectOutcomeRawValues(
  rows: string[][],
  indexOutcome: number,
): string[] {
  return rows
    .map((row) => (row[indexOutcome] ?? '').trim())
    .filter(Boolean);
}

function buildBinaryLevelMap(rawValues: string[]): Map<string, number> | null {
  const numericValues = rawValues.map((raw) => statsEngine.parseNumber(raw));
  const allNumeric = numericValues.every((value) => value !== null);

  if (allNumeric) {
    const unique = [...new Set(numericValues as number[])];
    if (unique.every((value) => value === 0 || value === 1) && unique.length <= 2) {
      return null;
    }
    if (unique.length === 2 && unique.every((value) => Number.isFinite(value))) {
      const sorted = [...unique].sort((a, b) => a - b);
      return new Map([
        [String(sorted[0]), 0],
        [String(sorted[1]), 1],
      ]);
    }
    return null;
  }

  const uniqueLevels = [...new Set(rawValues)];
  if (uniqueLevels.length !== 2) return null;
  const sorted = [...uniqueLevels].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return new Map([
    [sorted[0]!, 0],
    [sorted[1]!, 1],
  ]);
}

function coerceOutcomeValue(raw: string, levelMap: Map<string, number> | null): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const numeric = statsEngine.parseNumber(trimmed);
  if (numeric !== null) {
    if (levelMap) {
      const mapped = levelMap.get(String(numeric));
      return mapped !== undefined ? mapped : null;
    }
    if (numeric === 0 || numeric === 1) return numeric;
    return null;
  }

  if (levelMap) {
    const mapped = levelMap.get(trimmed);
    return mapped !== undefined ? mapped : null;
  }

  return null;
}

export function buildDatasetFromConfirmed(input: BuildDatasetInput): LogisticaBuiltDataset {
  const { headers, rows, recognizedColumns } = input;
  const indexOutcome = recognizedColumns.desfecho_binario;
  const indexPredictor = recognizedColumns.preditor;
  const outcomeHeader = resolveOutcomeHeader(headers, recognizedColumns);
  const predictorHeader = resolvePredictorHeader(headers, recognizedColumns);

  if (indexOutcome === undefined || indexPredictor === undefined) {
    return {
      y: [],
      design: { terms: ['(Intercept)'], matrix: [] },
      outcomeHeader,
      predictorHeaders: [predictorHeader],
      n: 0,
      classCounts: { zero: 0, one: 0 },
    };
  }

  const levelMap =
    indexOutcome !== undefined
      ? buildBinaryLevelMap(collectOutcomeRawValues(rows, indexOutcome))
      : null;

  const y: number[] = [];
  const matrix: number[][] = [];
  const predictorTerm = predictorHeader.replace(/\s+/g, '_');
  let zeroCount = 0;
  let oneCount = 0;

  rows.forEach((row) => {
    const rawOutcome = (row[indexOutcome] ?? '').trim();
    const rawPredictor = (row[indexPredictor] ?? '').trim();
    const outcome = coerceOutcomeValue(rawOutcome, levelMap);
    const predictor = statsEngine.parseNumber(rawPredictor);
    if (outcome === null || predictor === null) return;
    y.push(outcome);
    matrix.push([1, predictor]);
    if (outcome === 0) zeroCount += 1;
    else oneCount += 1;
  });

  return {
    y,
    design: {
      terms: ['(Intercept)', predictorTerm],
      matrix,
    },
    outcomeHeader,
    predictorHeaders: [predictorHeader],
    n: y.length,
    classCounts: { zero: zeroCount, one: oneCount },
  };
}

export function validateDataset(dataset: LogisticaBuiltDataset): string[] {
  const errors: string[] = [];
  const { design, n, classCounts } = dataset;
  const p = design.terms.length;

  if (n === 0) {
    errors.push(
      'Informe as colunas desfecho binário (0/1 ou dois níveis) e preditor numérico com ao menos uma linha válida.',
    );
    return errors;
  }

  if (n > MAX_OBS) {
    errors.push(
      `Limite de ${MAX_OBS.toLocaleString('pt-BR')} observações excedido. Use uma amostra menor.`,
    );
    return errors;
  }

  if (n <= p) {
    errors.push(
      `São necessárias mais observações (${n}) do que parâmetros estimados (${p}). Adicione linhas ou reduza preditores.`,
    );
  }

  if (classCounts.zero < MIN_EVENTS_PER_CLASS || classCounts.one < MIN_EVENTS_PER_CLASS) {
    errors.push(
      'O desfecho binário precisa ter ao menos um evento (1) e um não evento (0) para estimar o modelo.',
    );
  }

  return errors;
}

export function validateColumnTypes(
  headers: string[],
  rows: string[][],
  recognizedColumns: Record<string, number>,
): string[] {
  const errors: string[] = [];
  const indexOutcome = recognizedColumns.desfecho_binario;
  const indexPredictor = recognizedColumns.preditor;

  if (indexOutcome === undefined && indexPredictor === undefined) {
    errors.push('Mapeie as colunas desfecho binário e preditor antes de analisar.');
    return errors;
  }

  if (indexOutcome === undefined) {
    errors.push('Falta mapear a coluna desfecho binário (0/1 ou fator com dois níveis).');
  }

  if (indexPredictor === undefined) {
    errors.push('Falta mapear a coluna preditor (covariável numérica explicativa).');
  }

  if (indexOutcome === undefined || indexPredictor === undefined) {
    return errors;
  }

  const rawOutcomes = collectOutcomeRawValues(rows, indexOutcome);
  if (rawOutcomes.length === 0) {
    errors.push(`A coluna "${headers[indexOutcome] || 'desfecho_binario'}" não possui valores válidos.`);
    return errors;
  }

  const levelMap = buildBinaryLevelMap(rawOutcomes);
  const numericValues = rawOutcomes.map((raw) => statsEngine.parseNumber(raw));
  const allNumeric = numericValues.every((value) => value !== null);

  if (allNumeric) {
    const unique = [...new Set(numericValues as number[])];
    if (unique.length > 2 || unique.some((value) => value !== 0 && value !== 1)) {
      errors.push(
        `A coluna "${headers[indexOutcome] || 'desfecho_binario'}" deve ser binária (0/1 ou exatamente dois níveis numéricos).`,
      );
    }
  } else {
    const uniqueLevels = [...new Set(rawOutcomes)];
    if (uniqueLevels.length > 2) {
      errors.push(
        `A coluna "${headers[indexOutcome] || 'desfecho_binario'}" possui mais de dois níveis — use um desfecho binário.`,
      );
    } else if (uniqueLevels.length < 2) {
      errors.push(
        `A coluna "${headers[indexOutcome] || 'desfecho_binario'}" precisa de dois níveis distintos (evento e não evento).`,
      );
    }
  }

  if (levelMap === null && allNumeric) {
    const unique = [...new Set(numericValues as number[])];
    if (unique.length === 2 && !unique.every((value) => value === 0 || value === 1)) {
      // two numeric levels other than 0/1 — allowed via coercion
    } else if (unique.some((value) => value !== 0 && value !== 1)) {
      errors.push(
        `A coluna "${headers[indexOutcome] || 'desfecho_binario'}" contém valores fora de 0/1.`,
      );
    }
  }

  const rawPredictorValues = rows
    .map((row) => (row[indexPredictor] ?? '').trim())
    .filter(Boolean);
  if (
    rawPredictorValues.length > 0 &&
    rawPredictorValues.every((value) => statsEngine.parseNumber(value) === null)
  ) {
    errors.push(`A coluna "${headers[indexPredictor] || 'preditor'}" precisa ser numérica.`);
  }

  return errors;
}

export function runAnalysis(dataset: LogisticaBuiltDataset): LogisticFitResult {
  return fitLogistic(dataset.y, dataset.design);
}

function findOddsRatio(result: LogisticFitResult, term: string) {
  return result.oddsRatios.find((row) => row.term === term);
}

function formatOrSummary(result: LogisticFitResult, coefficients: GlmCoefficient[]): string {
  const terms = coefficients.filter((coef) => coef.term !== '(Intercept)');
  if (!terms.length) return 'Intercepto apenas';
  return terms
    .slice(0, 3)
    .map((coef) => {
      const or = findOddsRatio(result, coef.term);
      return or
        ? `${coef.term}: OR = ${fmtNumber(or.or, 3)}, p = ${fmtP(coef.p)}`
        : `${coef.term}: p = ${fmtP(coef.p)}`;
    })
    .join(' · ');
}

export function buildMetrics(result: LogisticFitResult, dataset: LogisticaBuiltDataset): ResultMetric[] {
  const slope = result.coefficients.find((coef) => coef.term !== '(Intercept)');
  const slopeOr = slope ? findOddsRatio(result, slope.term) : undefined;
  const minorityProp =
    dataset.n > 0
      ? Math.min(dataset.classCounts.zero, dataset.classCounts.one) / dataset.n
      : Number.NaN;

  return [
    {
      label: slope && slopeOr ? `OR (${slope.term})` : 'Odds ratios',
      value: slopeOr ? fmtNumber(slopeOr.or, 3) : formatOrSummary(result, result.coefficients),
      hint: slopeOr
        ? `IC95%: ${fmtNumber(slopeOr.ci95[0], 3)} a ${fmtNumber(slopeOr.ci95[1], 3)} · p = ${fmtP(slope!.p)}`
        : formatOrSummary(result, result.coefficients),
    },
    {
      label: 'Desvio (residual)',
      value: fmtNumber(result.deviance, 3),
      hint: `gl residual = ${result.dfResid}`,
    },
    {
      label: 'Proporção classe minoritária',
      value: Number.isFinite(minorityProp) ? fmtNumber(minorityProp * 100, 1) + '%' : 'n/d',
      hint: `${dataset.classCounts.one} eventos · ${dataset.classCounts.zero} não eventos`,
    },
    {
      label: 'Observações',
      value: String(dataset.n),
      hint: `${dataset.outcomeHeader} ~ ${dataset.predictorHeaders.join(' + ')}`,
    },
    {
      label: 'Convergência IRLS',
      value: result.converged ? 'Sim' : 'Não',
      hint: `${result.iterations} iteração(ões)`,
    },
  ];
}

export function computeAssumptionNudges(
  result: LogisticFitResult,
  dataset: LogisticaBuiltDataset,
): AssumptionNudge[] {
  const nudges: AssumptionNudge[] = [];
  const minorityProp =
    dataset.n > 0
      ? Math.min(dataset.classCounts.zero, dataset.classCounts.one) / dataset.n
      : Number.NaN;

  if (Number.isFinite(minorityProp) && minorityProp < RARE_EVENTS_THRESHOLD) {
    nudges.push({
      severity: 'warning',
      message: `A classe minoritária representa ${fmtNumber(minorityProp * 100, 1)}% dos casos (< 5%) — eventos raros podem tornar os intervalos de confiança instáveis. Interprete os OR com cautela.`,
    });
  }

  const extremeCoef = result.coefficients.find(
    (coef) => coef.term !== '(Intercept)' && Math.abs(coef.beta) > SEPARATION_BETA_THRESHOLD,
  );
  if (extremeCoef) {
    nudges.push({
      severity: 'warning',
      message: `Coeficiente extremo em ${extremeCoef.term} (|β| > ${SEPARATION_BETA_THRESHOLD}) sugere separação quase perfeita — os OR podem ser muito grandes ou instáveis.`,
    });
  }

  if (
    Number.isFinite(minorityProp) &&
    minorityProp >= RARE_EVENTS_THRESHOLD &&
    !extremeCoef
  ) {
    nudges.push({
      severity: 'info',
      message: `Desfecho com ${fmtNumber(minorityProp * 100, 1)}% na classe minoritária — proporções equilibradas facilitam a interpretação dos odds ratios.`,
    });
  }

  if (!result.converged) {
    nudges.push({
      severity: 'warning',
      message:
        'O ajuste IRLS não convergiu completamente. Revise os dados ou reduza a complexidade do modelo.',
    });
  }

  return nudges;
}

export function toEngineOutput(
  dataset: LogisticaBuiltDataset,
  result: LogisticFitResult,
): LogisticaEngineOutput {
  return {
    result,
    dataset,
    nudges: computeAssumptionNudges(result, dataset),
  };
}
