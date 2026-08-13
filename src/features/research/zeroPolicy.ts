import type { AnalysisCell, ResearchGeography, VariableProfile } from './types';

export const ZERO_POLICY_CONFIG = Object.freeze({
  minimumComparable: 5,
  positiveShare: 0.8,
  minimumExpected: 20,
  smallIndependentGroup: 10,
  unstableRateEvents: 16,
});

export type ZeroPolicyReasonCode =
  | 'zero_confirmed_by_source'
  | 'zero_suspected_noncollection'
  | 'zero_review_municipal'
  | 'zero_review_rare_variable'
  | 'zero_review_small_independent_group'
  | 'zero_review_unstable_rate'
  | 'zero_review_missing_rate_events'
  | 'zero_review_conflicting_evidence'
  | 'zero_review_insufficient_comparables'
  | 'zero_review_insufficient_history'
  | 'zero_review_low_expected';

export interface ZeroPolicyInput {
  targetCell: AnalysisCell;
  cells: readonly AnalysisCell[];
  profile: VariableProfile;
  geography: ResearchGeography;
  rareVariable?: boolean;
  explicitlyConfirmedZero?: boolean;
  conflictingEvidence?: boolean;
  exposures?: Readonly<Record<string, number>>;
  numeratorEvents?: Readonly<Record<string, number>>;
}

export interface ZeroPolicyDiagnostics {
  comparableCount: number;
  positiveShare: number;
  historyExpected: number | null;
  peerExpected: number | null;
  usedExposureNormalization: boolean;
}

export interface ZeroPolicyRecommendation {
  cell: AnalysisCell;
  explanation: string;
  diagnostics: ZeroPolicyDiagnostics;
}

export function analysisCellKey(cell: Pick<AnalysisCell, 'groupId' | 'territoryId' | 'periodKey' | 'variableId'>): string {
  return JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey, cell.variableId]);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function numericCell(cell: AnalysisCell): cell is AnalysisCell & { rawValue: number } {
  return (
    (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero') &&
    typeof cell.rawValue === 'number' &&
    Number.isFinite(cell.rawValue)
  );
}

function periodNumber(periodKey: string): number | null {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(periodKey);
  if (!match) return null;
  return Number(match[1]) * 12 + (match[2] ? Number(match[2]) - 1 : 0);
}

function adjacentHistory(input: ZeroPolicyInput): Array<AnalysisCell & { rawValue: number }> {
  const targetPeriod = periodNumber(input.targetCell.periodKey);
  if (targetPeriod === null) return [];
  const history = input.cells
    .filter((cell): cell is AnalysisCell & { rawValue: number } =>
      cell.territoryId === input.targetCell.territoryId &&
      cell.groupId === input.targetCell.groupId &&
      cell.variableId === input.targetCell.variableId &&
      cell.periodKey !== input.targetCell.periodKey &&
      numericCell(cell) &&
      cell.rawValue > 0 &&
      periodNumber(cell.periodKey) !== null,
    )
    .map((cell) => ({ cell, distance: Math.abs((periodNumber(cell.periodKey) as number) - targetPeriod) }))
    .sort((left, right) => left.distance - right.distance || left.cell.periodKey.localeCompare(right.cell.periodKey))
    .slice(0, 2);

  if (history.length < 2) return [];
  const selectedPeriods = history
    .map(({ cell }) => periodNumber(cell.periodKey) as number)
    .concat(targetPeriod)
    .sort((left, right) => left - right);
  const monthly = input.targetCell.periodKey.includes('-');
  const maximumStep = monthly ? 1 : 12;
  if (selectedPeriods.some((period, index) => index > 0 && period - selectedPeriods[index - 1] > maximumStep)) {
    return [];
  }
  return history.map(({ cell }) => cell);
}

function normalizedMedian(
  cells: readonly (AnalysisCell & { rawValue: number })[],
  target: AnalysisCell,
  exposures: Readonly<Record<string, number>> | undefined,
): { expected: number | null; normalized: boolean } {
  const targetExposure = exposures?.[analysisCellKey(target)];
  if (finitePositive(targetExposure)) {
    const rates = cells.flatMap((cell) => {
      const exposure = exposures?.[analysisCellKey(cell)];
      return finitePositive(exposure) ? [cell.rawValue / exposure] : [];
    });
    if (rates.length >= Math.min(cells.length, ZERO_POLICY_CONFIG.minimumComparable)) {
      const typicalRate = median(rates);
      return { expected: typicalRate === null ? null : typicalRate * targetExposure, normalized: true };
    }
  }
  return { expected: median(cells.map(({ rawValue }) => rawValue)), normalized: false };
}

function recommendation(
  input: ZeroPolicyInput,
  analyticStatus: AnalysisCell['analyticStatus'],
  reasonCode: ZeroPolicyReasonCode,
  explanation: string,
  diagnostics: ZeroPolicyDiagnostics,
): ZeroPolicyRecommendation {
  return {
    cell: { ...input.targetCell, analyticStatus, reasonCode },
    explanation,
    diagnostics,
  };
}

export function recommendZeroPolicy(input: ZeroPolicyInput): ZeroPolicyRecommendation {
  const target = input.targetCell;
  const peers = input.cells.filter((cell): cell is AnalysisCell & { rawValue: number } =>
    cell.variableId === target.variableId &&
    cell.groupId === target.groupId &&
    cell.periodKey === target.periodKey &&
    cell.territoryId !== target.territoryId &&
    numericCell(cell),
  );
  const positivePeers = peers.filter(({ rawValue }) => rawValue > 0);
  const history = adjacentHistory(input);
  const historyEstimate = normalizedMedian(history, target, input.exposures);
  const peerEstimate = normalizedMedian(positivePeers, target, input.exposures);
  const diagnostics: ZeroPolicyDiagnostics = {
    comparableCount: peers.length,
    positiveShare: peers.length === 0 ? 0 : positivePeers.length / peers.length,
    historyExpected: historyEstimate.expected,
    peerExpected: peerEstimate.expected,
    usedExposureNormalization: historyEstimate.normalized || peerEstimate.normalized,
  };

  if (target.rawValue !== 0 || !numericCell(target)) {
    return { cell: { ...target }, explanation: 'A política de zero não se aplica a esta célula.', diagnostics };
  }
  if (input.explicitlyConfirmedZero) {
    return recommendation(
      input,
      'include',
      'zero_confirmed_by_source',
      'Zero confirmado explicitamente pela fonte territorial.',
      diagnostics,
    );
  }
  if (input.geography === 'municipio') {
    return recommendation(input, 'requires_review', 'zero_review_municipal', 'Zero municipal exige revisão manual.', diagnostics);
  }
  if (input.rareVariable) {
    return recommendation(input, 'requires_review', 'zero_review_rare_variable', 'Zero em variável rara exige revisão manual.', diagnostics);
  }

  const independentUnits = new Set(
    input.cells
      .filter((cell) => cell.groupId === target.groupId && cell.variableId === target.variableId && numericCell(cell))
      .map(({ territoryId }) => territoryId),
  ).size;
  if (independentUnits < ZERO_POLICY_CONFIG.smallIndependentGroup) {
    return recommendation(
      input,
      'requires_review',
      'zero_review_small_independent_group',
      'Zero em grupo com menos de dez unidades independentes exige revisão manual.',
      diagnostics,
    );
  }
  const numeratorEvents = input.numeratorEvents?.[analysisCellKey(target)];
  if (input.profile.variableType === 'rate' && numeratorEvents === undefined) {
    return recommendation(
      input,
      'requires_review',
      'zero_review_missing_rate_events',
      'A contagem de eventos da taxa não está disponível; revisão manual necessária.',
      diagnostics,
    );
  }
  if (
    input.profile.variableType === 'rate' &&
    numeratorEvents !== undefined &&
    numeratorEvents < ZERO_POLICY_CONFIG.unstableRateEvents
  ) {
    return recommendation(
      input,
      'requires_review',
      'zero_review_unstable_rate',
      'Taxa baseada em poucos eventos exige revisão manual.',
      diagnostics,
    );
  }
  if (input.conflictingEvidence) {
    return recommendation(
      input,
      'requires_review',
      'zero_review_conflicting_evidence',
      'As evidências sobre o zero são conflitantes; revisão manual necessária.',
      diagnostics,
    );
  }
  if (
    peers.length < ZERO_POLICY_CONFIG.minimumComparable ||
    diagnostics.positiveShare < ZERO_POLICY_CONFIG.positiveShare
  ) {
    return recommendation(
      input,
      'requires_review',
      'zero_review_insufficient_comparables',
      'Não há territórios comparáveis suficientes para classificar o zero.',
      diagnostics,
    );
  }
  if (history.length < 2 || diagnostics.historyExpected === null) {
    return recommendation(
      input,
      'requires_review',
      'zero_review_insufficient_history',
      'Não há histórico positivo adjacente suficiente para classificar o zero.',
      diagnostics,
    );
  }
  if (
    (input.profile.variableType === 'rate'
      ? numeratorEvents === undefined || numeratorEvents < ZERO_POLICY_CONFIG.minimumExpected
      : diagnostics.historyExpected < ZERO_POLICY_CONFIG.minimumExpected ||
        diagnostics.peerExpected === null ||
        diagnostics.peerExpected < ZERO_POLICY_CONFIG.minimumExpected)
  ) {
    return recommendation(
      input,
      'requires_review',
      'zero_review_low_expected',
      'O volume esperado é baixo; o zero exige revisão manual.',
      diagnostics,
    );
  }
  return recommendation(
    input,
    'exclude_suspected_noncollection',
    'zero_suspected_noncollection',
    'Zero abrupto incompatível com o histórico e com territórios comparáveis; tratado como provável falha de coleta.',
    diagnostics,
  );
}
