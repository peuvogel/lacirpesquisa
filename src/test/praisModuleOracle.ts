/**
 * Legacy buildInterpretation oracle — manually ported from
 * tests/prais-winsten/module.js:696-708 (avoids chart-manager CDN import).
 */
export function buildLegacyPraisInterpretation(
  model: { p: number; classification: string },
  dataset: {
    yHeaderLabel: string;
    timeHeaderLabel: string;
    periodLabel?: string;
    validRows: unknown[];
    uniqueIds: string[];
    idHeaderLabel: string;
  },
  context: string,
  alpha: string | number,
): string {
  const alphaValue = parseFloat(String(alpha)) || 0.05;
  const pText = model.p < alphaValue ? 'com evidência estatística' : 'sem evidência estatística robusta';
  const directionText =
    model.classification === 'crescente'
      ? 'os valores tenderam a aumentar ao longo do período'
      : model.classification === 'decrescente'
        ? 'os valores tenderam a diminuir ao longo do período'
        : 'não houve mudança consistente ao longo do período';
  const idText =
    dataset.uniqueIds.length === 1
      ? ` para ${dataset.idHeaderLabel} = ${dataset.uniqueIds[0]}`
      : '';
  return `Analisou-se a tendência temporal de ${dataset.yHeaderLabel}${idText}, usando ${dataset.timeHeaderLabel} como eixo temporal, em ${dataset.periodLabel || 'todo o período disponível'}, com ${dataset.validRows.length} pontos válidos. A série foi classificada como ${model.classification}, ${pText}; em termos práticos, ${directionText}. Contexto informado: ${context || 'tendência temporal do indicador'}.`;
}
