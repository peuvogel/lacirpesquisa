import { fmtNumber, fmtP } from '@/shared/format';
import type { MannWhitneyResult } from './mannWhitneyEngine';

export function buildMannWhitneyInterpretation(
  result: MannWhitneyResult,
  alpha: number,
  labels: [string, string],
): string[] {
  const significant = result.pValue < alpha;
  const lead = significant
    ? `O Mann–Whitney encontrou evidência de diferença na ordenação/distribuição dos valores entre ${labels[0]} e ${labels[1]}.`
    : `O Mann–Whitney não encontrou evidência suficiente de diferença na ordenação/distribuição dos valores entre ${labels[0]} e ${labels[1]}.`;
  const a = result.groupSummaries.A;
  const b = result.groupSummaries.B;
  const method = result.method === 'exact'
    ? 'cálculo exato'
    : 'aproximação normal com correção para empates quando necessária';
  return [
    lead,
    `Resultado: U = ${fmtNumber(result.u, 2)}, p = ${fmtP(result.pValue)} (${method}).`,
    `Tamanho de efeito por postos: correlação bisserial = ${fmtNumber(result.rankBiserial, 3)}; probabilidade de superioridade de ${labels[0]} sobre ${labels[1]} = ${fmtNumber(result.probabilityOfSuperiority * 100, 1)}%.`,
    `Descrição: ${labels[0]} n=${a.n}, mediana=${fmtNumber(a.median, 2)}, IQR=${fmtNumber(a.iqr, 2)}; ${labels[1]} n=${b.n}, mediana=${fmtNumber(b.median, 2)}, IQR=${fmtNumber(b.iqr, 2)}.`,
    'As medianas acima descrevem os grupos; interpretar o teste como diferença de localização exige formatos de distribuição comparáveis.',
  ];
}
