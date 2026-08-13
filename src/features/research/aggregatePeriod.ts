import type {
  AggregationReason,
  AnalysisCell,
  PeriodAggregationResult,
  VariableProfile,
} from './types';

type NumericAnalysisCell = AnalysisCell & { rawValue: number };

function isUsable(cell: AnalysisCell): cell is NumericAnalysisCell {
  return (
    cell.analyticStatus === 'include' &&
    (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero') &&
    typeof cell.rawValue === 'number' &&
    Number.isFinite(cell.rawValue)
  );
}

function keyFor(cell: AnalysisCell): string {
  return `${cell.groupId}\u0000${cell.territoryId}\u0000${cell.periodKey}`;
}

function analyticUnitKeyFor(cell: AnalysisCell): string {
  return `${cell.groupId}\u0000${cell.territoryId}`;
}

function missingResult(
  reason: AggregationReason,
  includedCellCount = 0,
): PeriodAggregationResult {
  return { value: null, status: 'not_applicable', reason, includedCellCount };
}

function presentStatus(cells: AnalysisCell[]): PeriodAggregationResult['status'] {
  return cells.every((cell) => cell.sourceStatus === 'collection_zero')
    ? 'collection_zero'
    : 'observed';
}

function usableCellsFor(
  cells: AnalysisCell[],
  variableId: string,
): Array<AnalysisCell & { rawValue: number }> {
  return cells.filter((cell) => cell.variableId === variableId).filter(isUsable);
}

interface ComponentPair {
  numerator: NumericAnalysisCell;
  denominator: NumericAnalysisCell;
}

function matchingComponents(
  cells: AnalysisCell[],
  numeratorVariableId: string,
  denominatorVariableId: string,
): ComponentPair[] {
  const numerators = new Map(usableCellsFor(cells, numeratorVariableId).map((cell) => [keyFor(cell), cell]));
  const denominators = new Map(
    usableCellsFor(cells, denominatorVariableId).map((cell) => [keyFor(cell), cell]),
  );
  const pairs: ComponentPair[] = [];
  for (const [key, numerator] of numerators) {
    const denominator = denominators.get(key);
    if (denominator) pairs.push({ numerator, denominator });
  }
  return pairs;
}

function aggregateFromComponents(
  cells: AnalysisCell[],
  profile: VariableProfile,
  multiplier: number,
): PeriodAggregationResult {
  if (!profile.numeratorVariableId || !profile.denominatorVariableId) {
    return missingResult({ code: 'missing_component' });
  }

  const pairs = matchingComponents(
    cells,
    profile.numeratorVariableId,
    profile.denominatorVariableId,
  );
  if (pairs.length === 0) {
    return missingResult({
      code: 'missing_component',
      variableIds: [profile.numeratorVariableId, profile.denominatorVariableId],
    });
  }

  const positiveDenominatorPairs = pairs.filter((pair) => pair.denominator.rawValue > 0);
  if (positiveDenominatorPairs.length === 0) {
    return missingResult(
      {
        code: 'invalid_denominator',
        periodKeys: pairs.map((pair) => pair.denominator.periodKey).sort(),
      },
      pairs.length,
    );
  }

  const numerator = positiveDenominatorPairs.reduce((sum, pair) => sum + pair.numerator.rawValue, 0);
  const denominator = positiveDenominatorPairs.reduce(
    (sum, pair) => sum + pair.denominator.rawValue,
    0,
  );
  const value = (numerator / denominator) * multiplier;
  if (!Number.isFinite(value)) {
    return missingResult({ code: 'invalid_denominator' }, positiveDenominatorPairs.length);
  }

  return {
    value,
    status: presentStatus(
      positiveDenominatorPairs.flatMap((pair) => [pair.numerator, pair.denominator]),
    ),
    includedCellCount: positiveDenominatorPairs.length,
  };
}

function aggregateWeightedMean(cells: AnalysisCell[], profile: VariableProfile): PeriodAggregationResult {
  if (profile.numeratorVariableId && profile.denominatorVariableId) {
    return aggregateFromComponents(cells, profile, 1);
  }
  if (!profile.exposureVariableId) return missingResult({ code: 'missing_component' });

  const values = new Map(usableCellsFor(cells, profile.variableId).map((cell) => [keyFor(cell), cell]));
  const exposure = new Map(
    usableCellsFor(cells, profile.exposureVariableId).map((cell) => [keyFor(cell), cell]),
  );
  const pairs = [...values].flatMap(([key, value]) => {
    const weight = exposure.get(key);
    return weight ? [{ value, weight }] : [];
  });
  if (pairs.length === 0) {
    return missingResult({ code: 'missing_component', variableIds: [profile.exposureVariableId] });
  }

  const positiveWeights = pairs.filter((pair) => pair.weight.rawValue > 0);
  if (positiveWeights.length === 0) {
    return missingResult({ code: 'invalid_denominator' }, pairs.length);
  }
  const denominator = positiveWeights.reduce((sum, pair) => sum + pair.weight.rawValue, 0);
  const value = positiveWeights.reduce(
    (sum, pair) => sum + pair.value.rawValue * pair.weight.rawValue,
    0,
  ) / denominator;
  return {
    value,
    status: presentStatus(positiveWeights.flatMap((pair) => [pair.value, pair.weight])),
    includedCellCount: positiveWeights.length,
  };
}

export function aggregatePeriod(
  cells: AnalysisCell[],
  profile: VariableProfile,
): PeriodAggregationResult {
  const analyticUnits = new Set(cells.map(analyticUnitKeyFor));
  if (analyticUnits.size > 1) {
    return missingResult({ code: 'multiple_analytic_units' });
  }

  if (profile.temporalAggregation === 'sum') {
    const values = usableCellsFor(cells, profile.variableId);
    if (values.length === 0) return missingResult({ code: 'no_usable_values' });
    return {
      value: values.reduce((sum, cell) => sum + cell.rawValue, 0),
      status: presentStatus(values),
      includedCellCount: values.length,
    };
  }

  if (profile.temporalAggregation === 'recompute_rate') {
    return aggregateFromComponents(cells, profile, profile.rateMultiplier ?? 1);
  }

  if (profile.temporalAggregation === 'weighted_mean') {
    return aggregateWeightedMean(cells, profile);
  }

  const profileCells = cells.filter((cell) => cell.variableId === profile.variableId);
  const periodKeys = [...new Set(profileCells.map((cell) => cell.periodKey))].sort();
  if (periodKeys.length > 1) {
    return missingResult({ code: 'multiple_periods_for_point_only', periodKeys });
  }

  const values = usableCellsFor(profileCells, profile.variableId);
  if (values.length === 0) return missingResult({ code: 'no_usable_values' });
  if (values.length !== 1) return missingResult({ code: 'no_usable_values' }, values.length);
  return {
    value: values[0]!.rawValue,
    status: values[0]!.sourceStatus,
    includedCellCount: 1,
  };
}
