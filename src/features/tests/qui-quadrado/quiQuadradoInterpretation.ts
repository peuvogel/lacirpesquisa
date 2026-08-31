import { fmtNumber, fmtP } from '@/shared/format';
import { classifyCramersV, type QuiQuadradoEngineOutput } from './quiQuadradoEngine';

export function buildQuiQuadradoInterpretation(
  output: QuiQuadradoEngineOutput,
  alpha: number,
): string[] {
  const { result, dataset } = output;
  const effectClass = classifyCramersV(result.cramersV);
  const significant = result.p < alpha;
  const headers = dataset.columnHeaders;

  const lead = significant
    ? `Observou-se associação estatisticamente significativa entre ${headers[0]} e ${headers[1]}.`
    : `Não se observou associação estatisticamente significativa entre ${headers[0]} e ${headers[1]}.`;

  const bullets = [
    `Resultado principal: χ² = ${fmtNumber(result.chi2, 3)}, gl = ${result.df}, p = ${fmtP(result.p)}.`,
    `Tamanho de efeito: Cramér's V = ${fmtNumber(result.cramersV, 3)} (associação ${effectClass}).`,
    `Total analisado: ${dataset.totalN} observações em tabela ${dataset.rowLabels.length}×${dataset.colLabels.length}.`,
  ];

  if (result.cellsBelow5 > 0) {
    bullets.push(
      `Atenção: ${result.cellsBelow5} célula(s) (${fmtNumber(result.pctBelow5, 1)}%) têm contagem esperada < 5 — interprete o p com cautela.`,
    );
  }

  return [lead, ...bullets];
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
