import { fmtNumber, fmtP } from '@/shared/format';
import type { AnovaAnalysisResult } from './anovaEngine';

export function buildAnovaInterpretation(
  result: AnovaAnalysisResult,
  alpha: number,
  headers: { outcome: string; group: string },
  groupCount: number,
): string[] {
  const significant = result.p < alpha;

  const lead = significant
    ? `A ANOVA de uma via indicou diferença estatisticamente significativa entre os grupos de ${headers.group} para ${headers.outcome}.`
    : `A ANOVA de uma via não encontrou diferença estatisticamente significativa entre as médias dos grupos de ${headers.group} para ${headers.outcome}.`;

  const bullets = [
    `Resultado omnibus: F = ${fmtNumber(result.f, 3)}, gl entre = ${result.dfBetween}, gl dentro = ${result.dfWithin}, p = ${fmtP(result.p)}.`,
    `Tamanho de efeito: η² = ${fmtNumber(result.eta2, 3)} (${fmtNumber(result.eta2 * 100, 1)}% da variância explicada pelo fator).`,
    `Grupos analisados: ${groupCount}.`,
  ];

  if (significant && result.pairwise.length) {
    const top = result.pairwise[0];
    bullets.push(
      `Comparação par a par mais evidente (Tukey): ${top.contrast}, diferença = ${fmtNumber(top.statistic, 2)}, p ajustado = ${fmtP(top.pAdj)}.`,
    );
  } else if (significant) {
    bullets.push('Consulte a tabela de comparações par a par (Tukey) abaixo para identificar quais grupos diferem.');
  } else {
    bullets.push('As comparações par a par (Tukey) abaixo ajudam a explorar diferenças específicas, mas o teste omnibus não foi significativo neste α.');
  }

  return [lead, ...bullets];
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
