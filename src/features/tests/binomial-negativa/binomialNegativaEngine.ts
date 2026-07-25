import type { AssumptionNudge } from '@/features/tests/shared/assumptionNudges';
import { fmtNumber, fmtP } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  fitNegativeBinomial,
  type GlmCoefficient,
  type GlmDesign,
  type NegativeBinomialFitResult,
} from '@/shared/stats/glmEngine';
import { statsEngine } from '@/shared/stats/statsEngine';

export const MAX_OBS = 10_000;

export interface BinomialNegativaBuiltDataset {
  y: number[];
  design: GlmDesign;
  outcomeHeader: string;
  predictorHeaders: string[];
  n: number;
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
}

export interface BinomialNegativaEngineOutput {
  result: NegativeBinomialFitResult;
  dataset: BinomialNegativaBuiltDataset;
  nudges: AssumptionNudge[];
}

function resolveOutcomeHeader(headers: string[], recognizedColumns: Record<string, number>): string {
  const index = recognizedColumns.contagem;
  return index !== undefined ? headers[index] || 'contagem' : 'contagem';
}

function resolvePredictorHeader(headers: string[], recognizedColumns: Record<string, number>): string {
  const index = recognizedColumns.preditor;
  return index !== undefined ? headers[index] || 'preditor' : 'preditor';
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Math.abs(value - Math.round(value)) < 1e-9;
}

export function sanitizeRecognizedColumns(
  headers: string[],
  recognizedColumns: Record<string, number>,
): Record<string, number> {
  const maxIndex = headers.length - 1;
  const sanitized: Record<string, number> = {};
  for (const [key, index] of Object.entries(recognizedColumns)) {
    if (Number.isInteger(index) && index >= 0 && index <= maxIndex) {
      sanitized[key] = index;
    }
  }
  return sanitized;
}

export function buildDatasetFromConfirmed(input: BuildDatasetInput): BinomialNegativaBuiltDataset {
  const { headers, rows, recognizedColumns } = input;
  const indexOutcome = recognizedColumns.contagem;
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
    };
  }

  const y: number[] = [];
  const matrix: number[][] = [];
  const predictorTerm = predictorHeader.replace(/\s+/g, '_');

  rows.forEach((row) => {
    const rawOutcome = (row[indexOutcome] ?? '').trim();
    const rawPredictor = (row[indexPredictor] ?? '').trim();
    const outcome = statsEngine.parseNumber(rawOutcome);
    const predictor = statsEngine.parseNumber(rawPredictor);
    if (outcome === null || predictor === null) return;
    y.push(outcome);
    matrix.push([1, predictor]);
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
  };
}

export function validateDataset(dataset: BinomialNegativaBuiltDataset): string[] {
  const errors: string[] = [];
  const { design, n } = dataset;
  const p = design.terms.length;

  if (n === 0) {
    errors.push(
      'Informe as colunas contagem (inteiro ≥ 0) e preditor numérico com ao menos uma linha válida.',
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

  return errors;
}

export function validateColumnTypes(
  headers: string[],
  rows: string[][],
  recognizedColumns: Record<string, number>,
): string[] {
  const errors: string[] = [];
  const indexOutcome = recognizedColumns.contagem;
  const indexPredictor = recognizedColumns.preditor;

  if (indexOutcome === undefined && indexPredictor === undefined) {
    errors.push('Mapeie as colunas contagem e preditor antes de analisar.');
    return errors;
  }

  if (indexOutcome === undefined) {
    errors.push('Falta mapear a coluna contagem (desfecho em contagens inteiras ≥ 0).');
  }

  if (indexPredictor === undefined) {
    errors.push('Falta mapear a coluna preditor (covariável numérica explicativa).');
  }

  if (indexOutcome === undefined || indexPredictor === undefined) {
    return errors;
  }

  let invalidCount = 0;
  let negativeCount = 0;
  let nonIntegerCount = 0;

  for (const row of rows) {
    const rawOutcome = (row[indexOutcome] ?? '').trim();
    if (!rawOutcome) continue;
    const outcome = statsEngine.parseNumber(rawOutcome);
    if (outcome === null) {
      invalidCount += 1;
      continue;
    }
    if (outcome < 0) negativeCount += 1;
    if (!isNonNegativeInteger(outcome)) nonIntegerCount += 1;
  }

  if (negativeCount > 0) {
    errors.push(
      `A coluna "${headers[indexOutcome] || 'contagem'}" contém valores negativos — contagens devem ser ≥ 0.`,
    );
  }

  if (nonIntegerCount > 0) {
    errors.push(
      `A coluna "${headers[indexOutcome] || 'contagem'}" contém valores não inteiros — use contagens discretas (0, 1, 2, …).`,
    );
  }

  if (invalidCount > 0 && !negativeCount && !nonIntegerCount) {
    errors.push(
      `A coluna "${headers[indexOutcome] || 'contagem'}" possui células não numéricas.`,
    );
  }

  const rawPredictorValues = rows
    .map((row) => (row[indexPredictor] ?? '').trim())
    .filter(Boolean);
  if (
    rawPredictorValues.length > 0 &&
    rawPredictorValues.every((value) => statsEngine.parseNumber(value) === null)
  ) {
    errors.push(
      `A coluna "${headers[indexPredictor] || 'preditor'}" precisa ser numérica.`,
    );
  }

  return errors;
}

export function runAnalysis(dataset: BinomialNegativaBuiltDataset): NegativeBinomialFitResult {
  return fitNegativeBinomial(dataset.y, dataset.design);
}

function formatCoefSummary(coefficients: GlmCoefficient[]): string {
  const terms = coefficients.filter((coef) => coef.term !== '(Intercept)');
  if (!terms.length) return 'Intercepto apenas';
  return terms
    .slice(0, 3)
    .map((coef) => `${coef.term}: β = ${fmtNumber(coef.beta, 3)}, p = ${fmtP(coef.p)}`)
    .join(' · ');
}

export function buildMetrics(
  result: NegativeBinomialFitResult,
  dataset: BinomialNegativaBuiltDataset,
): ResultMetric[] {
  const slope = result.coefficients.find((coef) => coef.term !== '(Intercept)');
  const thetaLabel = Number.isFinite(result.theta) ? fmtNumber(result.theta, 3) : 'n/d';

  return [
    {
      label: 'θ (dispersão)',
      value: thetaLabel,
      hint: 'Parâmetro de superdispersão — valores menores indicam variância extra maior.',
    },
    {
      label: 'Desvio (residual)',
      value: fmtNumber(result.deviance, 3),
      hint: `gl residual = ${result.dfResid}`,
    },
    {
      label: 'χ² de Pearson',
      value: fmtNumber(result.pearsonChi2, 3),
      hint: `gl = ${result.dfResid}`,
    },
    {
      label: slope ? `Coeficiente (${slope.term})` : 'Coeficientes',
      value: slope ? fmtNumber(slope.beta, 3) : formatCoefSummary(result.coefficients),
      hint: slope ? `p = ${fmtP(slope.p)} · efeito log-linear` : formatCoefSummary(result.coefficients),
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
  result: NegativeBinomialFitResult,
  _dataset: BinomialNegativaBuiltDataset,
): AssumptionNudge[] {
  const nudges: AssumptionNudge[] = [];

  if (Number.isFinite(result.theta)) {
    nudges.push({
      severity: 'info',
      message: `A Binomial Negativa relaxa a equidispersão do Poisson — o parâmetro θ = ${fmtNumber(result.theta, 3)} captura variância extra além da média (Var = μ + μ²/θ).`,
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
  dataset: BinomialNegativaBuiltDataset,
  result: NegativeBinomialFitResult,
): BinomialNegativaEngineOutput {
  return {
    result,
    dataset,
    nudges: computeAssumptionNudges(result, dataset),
  };
}
