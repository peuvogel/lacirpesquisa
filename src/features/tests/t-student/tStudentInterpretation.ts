import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { classifyEffect, type TStudentResult } from './tStudentEngine';

const DEFAULT_QUESTION = 'Comparação entre duas médias independentes';

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
}

/**
 * Port of buildManualInterpretation — returns plain PT string[] (no HTML).
 */
export function buildTStudentInterpretation(
  result: TStudentResult,
  alpha: number,
  labels: [string, string],
  question?: string,
): string[] {
  const effectClass = classifyEffect(result.d);
  const higherGroup = result.diff >= 0 ? labels[0] : labels[1];
  const diffAbs = Math.abs(result.diff);
  const significant = result.p < alpha;
  const trimmedQuestion = (question ?? '').trim().slice(0, 500);

  const lead = significant
    ? `Observou-se diferença estatisticamente significativa entre a média de ${labels[0]} e ${labels[1]}. A média foi maior em ${higherGroup}, com diferença média de ${fmtNumber(diffAbs, 2)} unidades.`
    : `Não se observou diferença estatisticamente significativa entre as médias de ${labels[0]} e ${labels[1]}. Ainda assim, ${higherGroup} apresentou média numericamente maior, com diferença média de ${fmtNumber(diffAbs, 2)} unidades.`;

  const bullets = [
    `Pergunta analisada: ${trimmedQuestion || DEFAULT_QUESTION}.`,
    `Resultado principal: t = ${fmtNumber(result.t, 3)}, gl = ${fmtNumber(result.df, 2)}, p = ${fmtP(result.p)}.`,
    `Tamanho de efeito: ${effectClass}. Em termos práticos, isso indica uma magnitude ${effectClass} da diferença.`,
    `Grupo com maior média: ${higherGroup}.`,
    `Diferença observada: ${fmtSigned(result.diff, 2)} unidades.`,
    `Intervalo de confiança de 95% da diferença: ${fmtNumber(result.ci[0], 2)} a ${fmtNumber(result.ci[1], 2)}.`,
  ];

  return [lead, ...bullets];
}

/** True when legacy HTML interpretation and TS strings share significance call at α. */
export function sameSignificanceConclusion(
  legacyHtml: string,
  paragraphs: string[],
  alpha: number,
  pValue: number,
): boolean {
  const plainLegacy = stripHtml(legacyHtml).toLowerCase();
  const plainTs = paragraphs.join(' ').toLowerCase();
  const legacySignificant = pValue < alpha;
  const tsSignificant = plainTs.includes('diferença estatisticamente significativa');
  const tsNotSignificant = plainTs.includes('não se observou diferença estatisticamente significativa');

  if (legacySignificant) {
    return legacySignificant === tsSignificant && plainLegacy.includes('significativa');
  }
  return !tsSignificant && tsNotSignificant && plainLegacy.includes('não se observou');
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
