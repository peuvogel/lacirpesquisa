import { fmtNumber, fmtP } from '@/shared/format';
import type { BinomialNegativaEngineOutput } from './binomialNegativaEngine';
import { defaultQuestion } from './binomialNegativaConfig';

export function buildBinomialNegativaInterpretation(
  output: BinomialNegativaEngineOutput,
  alpha: number,
  question?: string,
): string[] {
  const { result, dataset } = output;
  const trimmedQuestion = (question ?? '').trim().slice(0, 500);
  const slope = result.coefficients.find((coef) => coef.term !== '(Intercept)');
  const significant = slope ? slope.p < alpha : false;
  const predictorLabel = dataset.predictorHeaders[0] ?? 'preditor';

  const lead = significant
    ? `A regressão Binomial Negativa indicou associação estatisticamente significativa entre ${predictorLabel} e ${dataset.outcomeHeader}.`
    : `A regressão Binomial Negativa não encontrou associação estatisticamente significativa entre ${predictorLabel} e ${dataset.outcomeHeader}.`;

  const bullets = [
    `Pergunta analisada: ${trimmedQuestion || defaultQuestion}.`,
    slope
      ? `Coeficiente de ${slope.term}: β = ${fmtNumber(slope.beta, 3)}, p = ${fmtP(slope.p)} (efeito log-linear na contagem).`
      : 'Modelo com intercepto apenas.',
    `Parâmetro de dispersão θ = ${fmtNumber(result.theta, 3)} — relaxa equidispersão do Poisson.`,
    `Desvio residual = ${fmtNumber(result.deviance, 3)}, gl = ${result.dfResid}.`,
    `Observações válidas: ${dataset.n}.`,
  ];

  return [lead, ...bullets];
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
