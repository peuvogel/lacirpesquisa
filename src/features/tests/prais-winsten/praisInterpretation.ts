import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import type { PraisBuiltDataset, RunPraisOutput } from './praisEngine';

const DEFAULT_CONTEXT = 'tendência temporal do indicador';

function trendStrength(apc: number): string {
  const abs = Math.abs(apc);
  if (abs < 1) return 'muito discreta';
  if (abs < 3) return 'leve';
  if (abs < 6) return 'moderada';
  return 'marcante';
}

function directionText(classification: string): string {
  if (classification === 'crescente') return 'os valores tenderam a aumentar ao longo do período';
  if (classification === 'decrescente') return 'os valores tenderam a diminuir ao longo do período';
  return 'não houve mudança consistente ao longo do período';
}

/**
 * Port of buildInterpretation — plain PT string[] (no HTML).
 */
export function buildPraisInterpretation(
  output: RunPraisOutput,
  alpha: number,
  researchQuestion?: string,
): string[] {
  const { model, dataset } = output;
  const significant = model.p < alpha;
  const pText = significant ? 'com evidência estatística' : 'sem evidência estatística robusta';
  const idText =
    dataset.uniqueIds.length === 1
      ? ` para ${dataset.idHeaderLabel} = ${dataset.uniqueIds[0]}`
      : '';
  const context = (researchQuestion ?? '').trim() || DEFAULT_CONTEXT;
  const scaleText = model.scale === 'log'
    ? 'A série foi analisada em escala log10, permitindo estimar a APC.'
    : 'Como a série contém zero, ela foi analisada na escala original, sem pseudocontagem; por isso o efeito é expresso como mudança absoluta, não APC.';

  const lead = `Analisou-se a tendência temporal de ${dataset.yHeaderLabel}${idText}, usando ${dataset.timeHeaderLabel} como eixo temporal, em ${dataset.periodLabel || 'todo o período disponível'}, com ${dataset.validCount} pontos válidos. A série foi classificada como ${model.classification}, ${pText}; em termos práticos, ${directionText(model.classification)}. ${scaleText} Contexto informado: ${context}.`;

  const acText =
    Math.abs(model.rho) < 0.3
      ? 'autocorrelação fraca'
      : Math.abs(model.rho) < 0.6
        ? 'autocorrelação moderada'
        : 'autocorrelação forte';

  const mainResult = model.scale === 'log'
    ? `Resultado principal: APC ${fmtSigned(model.apc, 2)}% (IC95% ${fmtNumber(model.ciApc[0], 2)} a ${fmtNumber(model.ciApc[1], 2)}), p = ${fmtP(model.p)}.`
    : `Resultado principal: mudança absoluta de ${fmtSigned(model.absoluteChange, 2)} por período (IC95% ${fmtNumber(model.ciAbsoluteChange[0], 2)} a ${fmtNumber(model.ciAbsoluteChange[1], 2)}), p = ${fmtP(model.p)}.`;

  const bullets = [
    mainResult,
    `Coeficiente da tendência (β): ${fmtSigned(model.beta, 4)} · Autocorrelação estimada: ρ = ${fmtSigned(model.rho, 3)} (${acText}).`,
    model.scale === 'log'
      ? `Magnitude da mudança: ${trendStrength(model.apc)}.`
      : 'A magnitude absoluta deve ser interpretada na unidade original do indicador.',
    `Período analisado: ${dataset.periodLabel || 'não informado'}.`,
  ];

  return [lead, ...bullets];
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
}

/** Trend direction + significance parity with legacy buildInterpretation (D-07/D-10). */
export function sameTrendConclusion(
  legacyParagraph: string,
  paragraphs: string[],
  alpha: number,
  pValue: number,
  classification: string,
): boolean {
  const plainLegacy = stripHtml(legacyParagraph).toLowerCase();
  const plainTs = paragraphs.join(' ').toLowerCase();
  const legacySignificant = pValue < alpha;
  const tsSignificant = plainTs.includes('com evidência estatística');
  const tsNotSignificant = plainTs.includes('sem evidência estatística robusta');

  const classificationMatch = plainTs.includes(classification.toLowerCase());
  if (!classificationMatch) return false;

  if (legacySignificant) {
    return legacySignificant === tsSignificant && plainLegacy.includes('com evidência estatística');
  }
  return !tsSignificant && tsNotSignificant && plainLegacy.includes('sem evidência estatística robusta');
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}

export function legacyDatasetFromBuilt(dataset: PraisBuiltDataset) {
  return {
    yHeaderLabel: dataset.yHeaderLabel,
    timeHeaderLabel: dataset.timeHeaderLabel,
    periodLabel: dataset.periodLabel,
    validRows: dataset.orderedRows,
    uniqueIds: dataset.uniqueIds,
    idHeaderLabel: dataset.idHeaderLabel,
  };
}
