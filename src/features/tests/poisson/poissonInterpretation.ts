import { fmtNumber, fmtP } from '@/shared/format';
import { OVERDISPERSION_THRESHOLD, type PoissonEngineOutput } from './poissonEngine';

export function buildPoissonInterpretation(
  output: PoissonEngineOutput,
  alpha: number,
): string[] {
  const { result, dataset } = output;
  const slope = result.coefficients.find((coef) => coef.term !== '(Intercept)');
  const significant = slope ? slope.p < alpha : false;
  const predictorLabel = dataset.predictorHeaders[0] ?? 'preditor';

  const lead = significant
    ? `A regressão de Poisson indicou associação estatisticamente significativa entre ${predictorLabel} e ${dataset.outcomeHeader}.`
    : `A regressão de Poisson não encontrou associação estatisticamente significativa entre ${predictorLabel} e ${dataset.outcomeHeader}.`;

  const bullets = [
    slope
      ? `Coeficiente de ${slope.term}: β = ${fmtNumber(slope.beta, 3)}, p = ${fmtP(slope.p)} (efeito log-linear na contagem).`
      : 'Modelo com intercepto apenas.',
    `Desvio residual = ${fmtNumber(result.deviance, 3)}, gl = ${result.dfResid}.`,
    `Superdispersão (χ²/gl) = ${fmtNumber(result.overdispersionRatio, 3)}.`,
    `Observações válidas: ${dataset.n}.`,
  ];

  if (result.overdispersionRatio > OVERDISPERSION_THRESHOLD) {
    bullets.push(
      'A razão χ²/gl acima de 1,25 sugere variância maior que a prevista pelo Poisson. Considere Binomial Negativa se a superdispersão persistir.',
    );
  }

  return [lead, ...bullets];
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
