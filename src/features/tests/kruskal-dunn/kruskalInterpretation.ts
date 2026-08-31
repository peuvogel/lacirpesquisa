import { fmtNumber, fmtP } from '@/shared/format';
import type { KruskalAnalysisResult } from './kruskalEngine';

export function buildKruskalInterpretation(
  result: KruskalAnalysisResult,
  alpha: number,
  headers: { outcome: string; group: string },
  groupCount: number,
): string[] {
  const significant = result.p < alpha;

  const lead = significant
    ? `O teste de Kruskal-Wallis indicou diferença estatisticamente significativa na distribuição de ${headers.outcome} entre os grupos de ${headers.group} (comparação por postos).`
    : `O teste de Kruskal-Wallis não encontrou diferença estatisticamente significativa na distribuição de ${headers.outcome} entre os grupos de ${headers.group} (comparação por postos).`;

  const bullets = [
    `Resultado omnibus: H = ${fmtNumber(result.h, 3)}, gl = ${result.df}, p = ${fmtP(result.p)}.`,
    `Grupos analisados: ${groupCount}.`,
  ];

  if (significant && result.pairwise.length) {
    const top = result.pairwise[0];
    bullets.push(
      `Comparação par a par mais evidente (Dunn, Holm): ${top.contrast}, z = ${fmtNumber(top.statistic, 3)}, p ajustado = ${fmtP(top.pAdj)}.`,
    );
  } else if (significant) {
    bullets.push(
      'Consulte a tabela de comparações par a par (Dunn) abaixo para identificar quais grupos diferem.',
    );
  } else {
    bullets.push(
      'As comparações par a par (Dunn) abaixo ajudam a explorar diferenças específicas, mas o teste omnibus não foi significativo neste α.',
    );
  }

  return [lead, ...bullets];
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
