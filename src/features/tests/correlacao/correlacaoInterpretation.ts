import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { classifyDirection, classifyStrength } from './correlacaoEngineHelpers';
import type { CorrelacaoEngineOutput } from './correlacaoEngine';

const DEFAULT_QUESTION = 'As duas variáveis estão associadas?';

function formatCi(ci: [number, number]): string {
  if (!ci.every(Number.isFinite)) return 'IC95% indisponível';
  return `${fmtNumber(ci[0], 3)} a ${fmtNumber(ci[1], 3)}`;
}

function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return 'n/d';
  return p < 0.001 ? '< 0,001' : fmtP(p);
}

function compareMessage(
  pearson: { coef: number },
  spearman: { coef: number },
): string {
  const gap = Math.abs(Math.abs(pearson.coef) - Math.abs(spearman.coef));
  const pearsonDir = Math.sign(pearson.coef || 0);
  const spearmanDir = Math.sign(spearman.coef || 0);
  if (pearsonDir && spearmanDir && pearsonDir !== spearmanDir) {
    return 'Pearson e Spearman apontaram direções diferentes, sinal de estrutura instável ou alta sensibilidade a pontos extremos.';
  }
  if (Math.abs(spearman.coef) - Math.abs(pearson.coef) > 0.18) {
    return 'Spearman ficou substancialmente maior que Pearson, sugerindo relação monótona com curvatura ou compressão nos extremos.';
  }
  if (Math.abs(pearson.coef) - Math.abs(spearman.coef) > 0.18) {
    return 'Pearson ficou acima de Spearman, indicando que a reta linear parece forte, mas a ordenação relativa não foi tão estável quanto a inclinação sugere.';
  }
  if (gap > 0.12) {
    return 'Pearson e Spearman diferiram moderadamente; vale revisar linearidade, resíduos e possíveis outliers antes de interpretar.';
  }
  return 'Pearson e Spearman foram semelhantes, sugerindo que a associação monótona está próxima de uma leitura linear.';
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
}

/**
 * Port of buildPearsonInterpretationHtml / buildSpearmanInterpretationHtml — plain PT string[].
 */
export function buildCorrelacaoInterpretation(
  output: CorrelacaoEngineOutput,
  alpha: number,
  question?: string,
): string[] {
  const { headers, pearson, spearman, method, labels, outlierFlags } = output;
  const trimmedQuestion = (question ?? '').trim().slice(0, 500);
  const active = method === 'spearman' ? spearman : pearson;
  const direction = classifyDirection(active.coef);
  const strength = classifyStrength(active.coef);
  const significant = active.p < alpha;
  const outlierLabels = labels.filter((_, index) => outlierFlags[index]);

  if (method === 'spearman') {
    const lead = significant
      ? `Spearman indicou associação monótona ${direction} de intensidade ${strength} entre ${headers[0]} e ${headers[1]} (ρ = ${fmtSigned(spearman.coef, 3)}; p ${formatPValue(spearman.p)}).`
      : `Spearman não encontrou evidência estatística robusta de associação monótona entre ${headers[0]} e ${headers[1]} (ρ = ${fmtSigned(spearman.coef, 3)}; p ${formatPValue(spearman.p)}).`;

    const bullets = [
      `Pergunta analisada: ${trimmedQuestion || DEFAULT_QUESTION}.`,
      `Força e direção monótona: ${strength}, ${direction}, com IC95% de ρ em ${formatCi(spearman.ci)}.`,
      `Comparação didática: ${compareMessage(pearson, spearman)}`,
      `Amostra: n = ${spearman.n} pares válidos.`,
    ];

    return [lead, ...bullets];
  }

  const lead = significant
    ? `Pearson indicou associação linear ${direction} de intensidade ${strength} entre ${headers[0]} e ${headers[1]} (r = ${fmtSigned(pearson.coef, 3)}; p ${formatPValue(pearson.p)}).`
    : `Pearson não encontrou evidência estatística robusta de associação linear entre ${headers[0]} e ${headers[1]} (r = ${fmtSigned(pearson.coef, 3)}; p ${formatPValue(pearson.p)}).`;

  const influenceText = outlierLabels.length
    ? `Os pontos ${outlierLabels.slice(0, 4).join(', ')}${outlierLabels.length > 4 ? ', ...' : ''} merecem revisão porque Pearson é mais sensível a outliers.`
    : 'Não apareceram outliers fortes na triagem inicial.';

  const bullets = [
    `Pergunta analisada: ${trimmedQuestion || DEFAULT_QUESTION}.`,
    `Força e direção: ${strength}, ${direction}, com IC95% de r em ${formatCi(pearson.ci)}.`,
    `Inclinação linear estimada: ${fmtSigned(pearson.slope, 3)} em ${headers[1]} para cada 1 unidade em ${headers[0]}.`,
    `Comparação didática: ${compareMessage(pearson, spearman)}`,
    `Pontos influentes: ${influenceText}`,
    `Amostra: n = ${pearson.n} pares válidos.`,
  ];

  return [lead, ...bullets];
}

/** True when legacy HTML and TS strings share significance call at α. */
export function sameSignificanceConclusion(
  legacyHtml: string,
  paragraphs: string[],
  alpha: number,
  pValue: number,
  method: 'pearson' | 'spearman',
): boolean {
  const plainLegacy = stripHtml(legacyHtml).toLowerCase();
  const plainTs = paragraphs.join(' ').toLowerCase();
  const legacySignificant = pValue < alpha;

  if (method === 'spearman') {
    const tsSignificant = plainTs.includes('indicou associação monótona');
    const tsNotSignificant = plainTs.includes('não encontrou evidência estatística robusta');
    if (legacySignificant) {
      return legacySignificant === tsSignificant && plainLegacy.includes('indicou associacao monotona');
    }
    return !tsSignificant && tsNotSignificant && plainLegacy.includes('nao encontrou evidencia');
  }

  const tsSignificant = plainTs.includes('indicou associação linear');
  const tsNotSignificant = plainTs.includes('não encontrou evidência estatística robusta');
  if (legacySignificant) {
    return legacySignificant === tsSignificant && plainLegacy.includes('indicou associacao linear');
  }
  return !tsSignificant && tsNotSignificant && plainLegacy.includes('nao encontrou evidencia');
}

export function paragraphsContainNoHtml(paragraphs: string[]): boolean {
  return paragraphs.every((paragraph) => !/<[^>]+>/.test(paragraph) && !/&[a-z]+;/i.test(paragraph));
}
