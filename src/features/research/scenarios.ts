import type { AnalysisCell, AnalysisScenario, MissingDataDecision } from './types';

export type ScenarioDecision =
  | { action: 'use_original'; cellKey: string; note?: string }
  | { action: 'treat_as_missing'; cellKey: string; note?: string }
  | { action: 'restore_recommendation'; cellKey: string }
  | { action: 'exclude_observed'; cellKey: string; justification: string }
  | { action: 'exclude_variable'; variableId: string; justification: string };

export type EffectDirection = 'positive' | 'negative' | 'null';

export interface ScenarioResultHook {
  n: number;
  effectDirection?: EffectDirection;
  interpretationKey?: string;
}

export interface ScenarioComparison {
  exploratory: boolean;
  n: { recommended: number; revised: number; delta: number; changed: boolean };
  effectDirection: {
    recommended: EffectDirection | null;
    revised: EffectDirection | null;
    changed: boolean | null;
  };
  interpretationChanged: boolean | null;
}

export function scenarioCellKey(cell: Pick<AnalysisCell, 'groupId' | 'territoryId' | 'periodKey' | 'variableId'>): string {
  return JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey, cell.variableId]);
}

export function useOriginalValue(cellKey: string, note?: string): ScenarioDecision {
  return { action: 'use_original', cellKey, ...(note ? { note } : {}) };
}

export function treatAsMissing(cellKey: string, note?: string): ScenarioDecision {
  return { action: 'treat_as_missing', cellKey, ...(note ? { note } : {}) };
}

export function restoreRecommendation(cellKey: string): ScenarioDecision {
  return { action: 'restore_recommendation', cellKey };
}

export function excludeObservedValue(cellKey: string, justification: string): ScenarioDecision {
  return { action: 'exclude_observed', cellKey, justification };
}

export function excludeVariable(variableId: string, justification: string): ScenarioDecision {
  return { action: 'exclude_variable', variableId, justification };
}

function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

function scenarioFingerprint(
  kind: AnalysisScenario['kind'],
  cells: readonly AnalysisCell[],
  decisions: readonly MissingDataDecision[],
  createdAfterResults: boolean,
): string {
  const canonicalCells = [...cells]
    .map((cell) => ({ ...cell, cellKey: scenarioCellKey(cell) }))
    .sort((left, right) => left.cellKey.localeCompare(right.cellKey));
  const canonicalDecisions = [...decisions].sort((left, right) =>
    left.cellKey.localeCompare(right.cellKey) || left.reasonCode.localeCompare(right.reasonCode),
  );
  return `analysis-scenario:${hash(JSON.stringify({ kind, cells: canonicalCells, decisions: canonicalDecisions, createdAfterResults }))}`;
}

function freezeScenario(
  kind: AnalysisScenario['kind'],
  cells: readonly AnalysisCell[],
  decisions: readonly MissingDataDecision[],
  createdAfterResults: boolean,
): AnalysisScenario {
  const frozenCells = cells.map((cell) => Object.freeze({ ...cell }));
  const frozenDecisions = decisions.map((decision) => Object.freeze({ ...decision }));
  const fingerprint = scenarioFingerprint(kind, frozenCells, frozenDecisions, createdAfterResults);
  return Object.freeze({
    id: fingerprint,
    kind,
    cells: Object.freeze(frozenCells) as unknown as AnalysisCell[],
    decisions: Object.freeze(frozenDecisions) as unknown as MissingDataDecision[],
    createdAfterResults,
    fingerprint,
  });
}

export function createRecommendedScenario(cells: readonly AnalysisCell[]): AnalysisScenario {
  return freezeScenario('recommended', cells, [], false);
}

function requiredCell(cellsByKey: ReadonlyMap<string, AnalysisCell>, cellKey: string): AnalysisCell {
  const cell = cellsByKey.get(cellKey);
  if (!cell) throw new Error('A decisão aponta para uma observação que não pertence ao cenário recomendado.');
  return cell;
}

function nonEmptyJustification(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

export function reviseScenario(
  base: AnalysisScenario,
  requestedDecisions: readonly ScenarioDecision[],
  options: { createdAfterResults?: boolean } = {},
): AnalysisScenario {
  if (base.kind !== 'recommended') {
    throw new Error('A revisão deve partir do cenário recomendado preservado.');
  }
  const recommendedByKey = new Map(base.cells.map((cell) => [scenarioCellKey(cell), cell]));
  const revisedByKey = new Map(base.cells.map((cell) => [scenarioCellKey(cell), { ...cell }]));
  const effectiveDecisions = new Map<string, MissingDataDecision>();

  const apply = (
    key: string,
    analyticStatus: AnalysisCell['analyticStatus'],
    reasonCode: string,
    note?: string,
  ) => {
    const current = requiredCell(revisedByKey, key);
    revisedByKey.set(key, { ...current, analyticStatus, reasonCode });
    effectiveDecisions.set(key, { cellKey: key, analyticStatus, reasonCode, ...(note ? { note } : {}) });
  };

  for (const decision of requestedDecisions) {
    if (decision.action === 'exclude_variable') {
      const justification = nonEmptyJustification(
        decision.justification,
        'Informe uma justificativa para excluir esta variável.',
      );
      const matching = [...revisedByKey.entries()].filter(([, cell]) => cell.variableId === decision.variableId);
      if (matching.length === 0) throw new Error('A variável não pertence ao cenário recomendado.');
      for (const [key] of matching) apply(key, 'exclude_manual', 'manual_variable_exclusion', justification);
      continue;
    }

    const recommended = requiredCell(recommendedByKey, decision.cellKey);
    if (decision.action === 'restore_recommendation') {
      revisedByKey.set(decision.cellKey, { ...recommended });
      effectiveDecisions.delete(decision.cellKey);
      continue;
    }
    if (decision.action === 'use_original') {
      if (
        (recommended.sourceStatus !== 'observed' && recommended.sourceStatus !== 'collection_zero') ||
        typeof recommended.rawValue !== 'number' ||
        !Number.isFinite(recommended.rawValue)
      ) {
        throw new Error('Não existe valor disponível para esta observação.');
      }
      apply(decision.cellKey, 'include', 'manual_use_original', decision.note);
      continue;
    }
    if (decision.action === 'treat_as_missing') {
      if (typeof recommended.rawValue !== 'number' || !Number.isFinite(recommended.rawValue)) {
        revisedByKey.set(decision.cellKey, { ...recommended });
        effectiveDecisions.delete(decision.cellKey);
      } else {
        apply(decision.cellKey, 'exclude_manual', 'manual_treat_as_missing', decision.note);
      }
      continue;
    }

    const justification = nonEmptyJustification(
      decision.justification,
      'Informe uma justificativa para excluir um valor positivo observado.',
    );
    if (
      recommended.sourceStatus !== 'observed' ||
      typeof recommended.rawValue !== 'number' ||
      !Number.isFinite(recommended.rawValue) ||
      recommended.rawValue <= 0
    ) {
      throw new Error('A exclusão avançada se aplica apenas a valor positivo observado.');
    }
    apply(decision.cellKey, 'exclude_manual', 'manual_positive_exclusion', justification);
  }

  return freezeScenario(
    'researcher_reviewed',
    [...revisedByKey.values()],
    [...effectiveDecisions.values()],
    options.createdAfterResults === true,
  );
}

function includedCount(scenario: AnalysisScenario): number {
  return scenario.cells.filter((cell) => cell.analyticStatus === 'include').length;
}

export function compareScenarios(
  recommended: AnalysisScenario,
  revised: AnalysisScenario,
  hooks?: { recommended?: ScenarioResultHook; revised?: ScenarioResultHook },
): ScenarioComparison {
  const recommendedN = hooks?.recommended?.n ?? includedCount(recommended);
  const revisedN = hooks?.revised?.n ?? includedCount(revised);
  const recommendedDirection = hooks?.recommended?.effectDirection ?? null;
  const revisedDirection = hooks?.revised?.effectDirection ?? null;
  const directionChanged = recommendedDirection === null || revisedDirection === null
    ? null
    : recommendedDirection !== revisedDirection;
  const recommendedInterpretation = hooks?.recommended?.interpretationKey;
  const revisedInterpretation = hooks?.revised?.interpretationKey;

  return {
    exploratory: revised.createdAfterResults,
    n: {
      recommended: recommendedN,
      revised: revisedN,
      delta: revisedN - recommendedN,
      changed: recommendedN !== revisedN,
    },
    effectDirection: {
      recommended: recommendedDirection,
      revised: revisedDirection,
      changed: directionChanged,
    },
    interpretationChanged:
      recommendedInterpretation === undefined || revisedInterpretation === undefined
        ? null
        : recommendedInterpretation !== revisedInterpretation,
  };
}
