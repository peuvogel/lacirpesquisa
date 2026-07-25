import type { AssumptionNudge } from '@/features/tests/shared/assumptionNudges';
import { NB_HANDOFF_TEST_ID } from './poissonConfig';
import { fmtNumber, fmtP } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  fitPoisson,
  type GlmCoefficient,
  type GlmDesign,
  type GlmFitResult,
} from '@/shared/stats/glmEngine';
import { statsEngine } from '@/shared/stats/statsEngine';

export const OVERDISPERSION_THRESHOLD = 1.25;
export const MAX_OBS = 10_000;

const NB_CTA = {
  label: 'Abrir Binomial Negativa',
  testId: NB_HANDOFF_TEST_ID,
} as const;

export interface PoissonBuiltDataset {
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

export interface PoissonAnalysisResult extends GlmFitResult {
  overdispersionRatio: number;
}

export interface PoissonEngineOutput {
  result: PoissonAnalysisResult;
  dataset: PoissonBuiltDataset;
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

export function buildDatasetFromConfirmed(input: BuildDatasetInput): PoissonBuiltDataset {
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

export function validateDataset(dataset: PoissonBuiltDataset): string[] {
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

export function runAnalysis(dataset: PoissonBuiltDataset): PoissonAnalysisResult {
  const fit = fitPoisson(dataset.y, dataset.design);
  const overdispersionRatio =
    fit.dfResid > 0 ? fit.pearsonChi2 / fit.dfResid : Number.NaN;
  return { ...fit, overdispersionRatio };
}

function formatCoefSummary(coefficients: GlmCoefficient[]): string {
  const terms = coefficients.filter((coef) => coef.term !== '(Intercept)');
  if (!terms.length) return 'Intercepto apenas';
  return terms
    .slice(0, 3)
    .map((coef) => `${coef.term}: β = ${fmtNumber(coef.beta, 3)}, p = ${fmtP(coef.p)}`)
    .join(' · ');
}

export function buildMetrics(result: PoissonAnalysisResult, dataset: PoissonBuiltDataset): ResultMetric[] {
  const slope = result.coefficients.find((coef) => coef.term !== '(Intercept)');
  const ratioLabel = Number.isFinite(result.overdispersionRatio)
    ? fmtNumber(result.overdispersionRatio, 3)
    : 'n/d';

  return [
    {
      label: 'Desvio (residual)',
      value: fmtNumber(result.deviance, 3),
      hint: `gl residual = ${result.dfResid}`,
    },
    {
      label: 'χ² de Pearson',
      value: fmtNumber(result.pearsonChi2, 3),
      hint: `Razão χ²/gl = ${ratioLabel}`,
    },
    {
      label: 'Superdispersão (χ²/gl)',
      value: ratioLabel,
      hint:
        result.overdispersionRatio > OVERDISPERSION_THRESHOLD
          ? 'Acima de 1,25 — variância maior que a prevista pelo Poisson.'
          : 'Próximo de 1 indica equidispersão aproximada.',
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
  result: PoissonAnalysisResult,
  _dataset: PoissonBuiltDataset,
): AssumptionNudge[] {
  const nudges: AssumptionNudge[] = [];

  if (Number.isFinite(result.overdispersionRatio) && result.overdispersionRatio > OVERDISPERSION_THRESHOLD) {
    nudges.push({
      severity: 'warning',
      message: `Razão χ²/gl = ${fmtNumber(result.overdispersionRatio, 3)} (> 1,25) sugere superdispersão — a variância observada excede a prevista pelo Poisson. Considere Binomial Negativa com os mesmos preditores.`,
      cta: NB_CTA,
    });
  } else if (Number.isFinite(result.overdispersionRatio) && result.overdispersionRatio <= OVERDISPERSION_THRESHOLD) {
    nudges.push({
      severity: 'info',
      message: `Razão χ²/gl = ${fmtNumber(result.overdispersionRatio, 3)} indica equidispersão aproximada — o modelo de Poisson parece adequado para a variância observada.`,
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
  dataset: PoissonBuiltDataset,
  result: PoissonAnalysisResult,
): PoissonEngineOutput {
  return {
    result,
    dataset,
    nudges: computeAssumptionNudges(result, dataset),
  };
}
