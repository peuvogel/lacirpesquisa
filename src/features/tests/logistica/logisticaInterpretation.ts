import { fmtNumber, fmtP } from '@/shared/format';
import { RARE_EVENTS_THRESHOLD } from './logisticaConfig';
import type { LogisticaEngineOutput } from './logisticaEngine';

export function buildLogisticaInterpretation(
  output: LogisticaEngineOutput,
  alpha: number,
): string[] {
  const { result, dataset } = output;
  const slope = result.coefficients.find((coef) => coef.term !== '(Intercept)');
  const slopeOr = slope ? result.oddsRatios.find((row) => row.term === slope.term) : undefined;
  const significant = slope ? slope.p < alpha : false;
  const predictorLabel = dataset.predictorHeaders[0] ?? 'preditor';

  const lead = significant
    ? `A regressão logística indicou associação estatisticamente significativa entre ${predictorLabel} e ${dataset.outcomeHeader}.`
    : `A regressão logística não encontrou associação estatisticamente significativa entre ${predictorLabel} e ${dataset.outcomeHeader}.`;

  const bullets = [
    slope && slopeOr
      ? `Odds ratio de ${slope.term}: OR = ${fmtNumber(slopeOr.or, 3)} (IC95%: ${fmtNumber(slopeOr.ci95[0], 3)} a ${fmtNumber(slopeOr.ci95[1], 3)}), p = ${fmtP(slope.p)}.`
      : 'Modelo com intercepto apenas.',
    `Desvio residual = ${fmtNumber(result.deviance, 3)}, gl = ${result.dfResid}.`,
    `Observações válidas: ${dataset.n} (${dataset.classCounts.one} eventos, ${dataset.classCounts.zero} não eventos).`,
  ];

  const minorityProp =
    dataset.n > 0
      ? Math.min(dataset.classCounts.zero, dataset.classCounts.one) / dataset.n
      : Number.NaN;

  if (Number.isFinite(minorityProp) && minorityProp < RARE_EVENTS_THRESHOLD) {
    bullets.push(
      'A classe minoritária representa menos de 5% dos casos — eventos raros podem tornar os intervalos de confiança instáveis.',
    );
  }

  const extremeCoef = result.coefficients.find(
    (coef) => coef.term !== '(Intercept)' && Math.abs(coef.beta) > 10,
  );
  if (extremeCoef) {
    bullets.push(
      `Coeficiente extremo em ${extremeCoef.term} sugere separação quase perfeita — interprete os OR com cautela.`,
    );
  }

  return [lead, ...bullets];
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
