import { TEST_REGISTRY } from '@/features/tests/registry';
import { completePairs, profileVariable, shapiroWilk } from './profiling';
import type {
  AnalysisCell,
  AnalysisScenario,
  EligibilityDecision,
  EligibilityReason,
  ResearchDesign,
  ResearchPeriod,
  VariableProfile,
} from './types';

export interface EvaluateTestsInput {
  design: ResearchDesign;
  scenario: AnalysisScenario;
  profiles: VariableProfile[];
  roleAssignments?: Record<string, string>;
  contingencyTable?: number[][];
}

const TEST_IDS = [...new Set([...TEST_REGISTRY.map((entry) => entry.id), 'mann-whitney'])];

export const ELIGIBILITY_CONFIG = {
  minimumIndependentUnitsPerGroup: 3,
  minimumCorrelationPairs: 3,
  minimumSeriesPoints: 8,
  minimumRegressionRows: 20,
  regressionRowsPerPredictorPlusIntercept: 10,
  maximumSmallExpectedCellShare: 0.2,
  minimumExpectedCell: 1,
} as const;

function reason(code: string, message: string): EligibilityReason {
  return { code, message };
}

function decision(
  testId: string,
  status: EligibilityDecision['status'],
  reasons: EligibilityReason[],
  roles: Record<string, string>,
  diagnosticsUsed: string[] = [],
): EligibilityDecision {
  return { testId, status, reasons, roleAssignments: { ...roles }, diagnosticsUsed };
}

function usable(cell: AnalysisCell): cell is AnalysisCell & { rawValue: number } {
  return cell.analyticStatus === 'include'
    && (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero')
    && typeof cell.rawValue === 'number'
    && Number.isFinite(cell.rawValue);
}

function cellsFor(cells: readonly AnalysisCell[], variableId: string): Array<AnalysisCell & { rawValue: number }> {
  return cells.filter((cell): cell is AnalysisCell & { rawValue: number } => cell.variableId === variableId && usable(cell));
}

function groupCounts(cells: readonly (AnalysisCell & { rawValue: number })[]): Map<string, number> {
  const units = new Map<string, Set<string>>();
  for (const cell of cells) {
    const set = units.get(cell.groupId) ?? new Set<string>();
    set.add(cell.territoryId);
    units.set(cell.groupId, set);
  }
  return new Map([...units].map(([groupId, ids]) => [groupId, ids.size]));
}

function repeatedUnits(cells: readonly (AnalysisCell & { rawValue: number })[]): boolean {
  const periods = new Map<string, Set<string>>();
  for (const cell of cells) {
    const key = JSON.stringify([cell.groupId, cell.territoryId]);
    const set = periods.get(key) ?? new Set<string>();
    set.add(cell.periodKey);
    periods.set(key, set);
  }
  return [...periods.values()].some((set) => set.size > 1);
}

function overlappingTerritories(cells: readonly (AnalysisCell & { rawValue: number })[]): boolean {
  const groupsByTerritory = new Map<string, Set<string>>();
  for (const cell of cells) {
    const groups = groupsByTerritory.get(cell.territoryId) ?? new Set<string>();
    groups.add(cell.groupId);
    groupsByTerritory.set(cell.territoryId, groups);
  }
  return [...groupsByTerritory.values()].some((groups) => groups.size > 1);
}

function isPairedDesign(design: ResearchDesign): boolean {
  return design.comparisonKind === 'paired_period' || design.comparisonKind === 'paired_disease';
}

function pairedValues(
  cells: readonly (AnalysisCell & { rawValue: number })[],
  groupIds: readonly string[],
): Array<[number, number]> | null {
  if (groupIds.length !== 2) return null;
  const byGroup = groupIds.map((groupId) => new Map(
    cells
      .filter((cell) => cell.groupId === groupId)
      .map((cell) => [cell.territoryId, cell.rawValue] as const),
  ));
  const territoryIds = [...byGroup[0]!.keys()].sort();
  if (
    territoryIds.length !== byGroup[1]!.size
    || territoryIds.some((territoryId) => !byGroup[1]!.has(territoryId))
  ) return null;
  return territoryIds.map((territoryId) => [
    byGroup[0]!.get(territoryId)!,
    byGroup[1]!.get(territoryId)!,
  ]);
}

function scopeKey(cell: Pick<AnalysisCell, 'groupId' | 'territoryId' | 'periodKey'>): string {
  return JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey]);
}

function distinctValues(cells: readonly (AnalysisCell & { rawValue: number })[]): number {
  return new Set(cells.map((cell) => cell.rawValue)).size;
}

function hasDuplicateAnalyticScopes(cells: readonly (AnalysisCell & { rawValue: number })[]): boolean {
  const seen = new Set<string>();
  for (const cell of cells) {
    const key = JSON.stringify([cell.variableId, cell.groupId, cell.territoryId, cell.periodKey]);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function periodYears(period: ResearchPeriod): Set<number> {
  const year = (value: string) => Number(value.slice(0, 4));
  if (period.mode === 'point') return new Set([year(period.point)]);
  if (period.mode === 'compare') return new Set([year(period.periodA), year(period.periodB)]);
  const start = year(period.start);
  const end = year(period.end);
  return new Set(Array.from({ length: end - start + 1 }, (_, index) => start + index));
}

function scenarioMatchesDesign(design: ResearchDesign, cells: readonly AnalysisCell[]): boolean {
  const expectedByGroup = new Map(design.groups.map((group) => {
    const period = design.period.scope === 'shared'
      ? design.period.time
      : design.period.timesByGroupId[group.id];
    return [group.id, {
      territories: new Set(group.territories.map((territory) => territory.id)),
      years: period ? periodYears(period) : new Set<number>(),
    }] as const;
  }));
  return cells.every((cell) => {
    const expected = expectedByGroup.get(cell.groupId);
    const match = /^(\d{4})(?:-(?:0[1-9]|1[0-2]))?$/.exec(cell.periodKey);
    return Boolean(
      expected
      && expected.territories.has(cell.territoryId)
      && match
      && expected.years.has(Number(match[1])),
    );
  });
}

function outcomeProfile(input: EvaluateTestsInput): VariableProfile | undefined {
  const requested = input.roleAssignments?.outcome;
  if (requested) return input.profiles.find((profile) => profile.variableId === requested);
  const candidates = input.profiles.filter((profile) => ['numeric', 'rate', 'ordinal', 'count'].includes(profile.variableType));
  return candidates.length === 1 ? candidates[0] : undefined;
}

function groupTest(
  testId: string,
  input: EvaluateTestsInput,
  requiredGroups: 2 | 3,
  parametric: boolean,
): EligibilityDecision {
  const roles = input.roleAssignments ?? {};
  const paired = isPairedDesign(input.design);
  if (paired && testId !== 't-student') {
    return decision(testId, 'ineligible', [reason(
      'paired_test_not_supported',
      'Este contraste é pareado; nesta etapa, somente o teste t pareado está implementado.',
    )], roles);
  }
  const profile = outcomeProfile(input);
  const acceptedTypes = parametric ? ['numeric', 'rate'] : ['numeric', 'rate', 'ordinal'];
  if (!profile || !acceptedTypes.includes(profile.variableType)) {
    return decision(testId, 'ineligible', [reason(
      'numeric_or_ordinal_outcome_required',
      parametric
        ? 'Selecione um único desfecho numérico ou taxa.'
        : 'Selecione um único desfecho numérico, taxa ou ordinal.',
    )], roles);
  }
  const cells = cellsFor(input.scenario.cells, profile.variableId);
  const counts = groupCounts(cells);
  const selectedGroupCount = input.design.groups.length;
  const allSelectedGroupsRepresented = counts.size === selectedGroupCount;
  const groupNumberOk = allSelectedGroupsRepresented
    && (requiredGroups === 2 ? selectedGroupCount === 2 : selectedGroupCount >= 3);
  if (!groupNumberOk) {
    return decision(testId, 'ineligible', [reason('group_count_mismatch', requiredGroups === 2 ? 'Este teste exige exatamente dois grupos.' : 'Este teste exige três ou mais grupos.')], roles);
  }
  if (hasDuplicateAnalyticScopes(cells)) {
    return decision(testId, 'ineligible', [reason('duplicate_analytic_scope', 'Existe mais de um valor para a mesma unidade, período e variável.')], roles);
  }
  const alignedPairs = paired
    ? pairedValues(cells, input.design.groups.map((group) => group.id))
    : null;
  if (paired && !alignedPairs) {
    return decision(testId, 'ineligible', [reason(
      'paired_units_misaligned',
      'Os dois grupos pareados precisam conter exatamente os mesmos territórios com valores utilizáveis.',
    )], roles);
  }
  if (!paired && overlappingTerritories(cells)) {
    return decision(testId, 'ineligible', [reason('overlapping_independent_units', 'O mesmo território não pode representar grupos independentes distintos.')], roles);
  }
  if (repeatedUnits(cells)) {
    return decision(testId, 'ineligible', [reason('repeated_units_not_iid', 'Anos repetidos do mesmo território não são réplicas independentes.')], roles);
  }
  if ([...counts.values()].some((count) => count < ELIGIBILITY_CONFIG.minimumIndependentUnitsPerGroup)) {
    return decision(testId, 'ineligible', [reason(
      'insufficient_independent_units',
      `Cada grupo precisa de pelo menos ${ELIGIBILITY_CONFIG.minimumIndependentUnitsPerGroup} unidades independentes.`,
    )], roles);
  }
  const valuesByGroup = new Map<string, Array<AnalysisCell & { rawValue: number }>>();
  for (const cell of cells) {
    const values = valuesByGroup.get(cell.groupId) ?? [];
    values.push(cell);
    valuesByGroup.set(cell.groupId, values);
  }
  const pairedDifferences = alignedPairs?.map(([left, right]) => right - left) ?? [];
  if (paired && new Set(pairedDifferences).size < 2) {
    return decision(testId, 'ineligible', [reason('insufficient_variation', 'As diferenças dentro dos pares precisam apresentar variação.')], roles);
  }
  if (!paired && parametric && [...valuesByGroup.values()].some((values) => distinctValues(values) < 2)) {
    return decision(testId, 'ineligible', [reason('insufficient_variation', 'Cada grupo precisa apresentar variação para uma comparação paramétrica.')], roles);
  }
  if (!parametric && distinctValues(cells) < 2) {
    return decision(testId, 'ineligible', [reason('all_values_tied', 'Todos os valores estão empatados; uma comparação por postos não é informativa.')], roles);
  }
  const profiled = profileVariable(cells, profile);
  if (testId === 'anova-tukey') {
    const variances = Object.values(profiled.byGroup)
      .map((group) => group.summary.sampleSd)
      .filter((sampleSd): sampleSd is number => sampleSd !== null)
      .map((sampleSd) => sampleSd ** 2);
    const minimumVariance = Math.min(...variances);
    const maximumVariance = Math.max(...variances);
    if (minimumVariance <= 0 || maximumVariance / minimumVariance > 4) {
      return decision(
        testId,
        'ineligible',
        [reason('variance_heterogeneity', 'As variâncias dos grupos são incompatíveis com a ANOVA clássica deste fluxo.')],
        roles,
        ['within_group_normality', 'group_variance_ratio'],
      );
    }
  }
  const classifications = Object.values(profiled.byGroup).map((group) => group.normality.classification);
  if (paired) {
    const normality = shapiroWilk(pairedDifferences);
    if (normality.state === 'supported' && normality.pValue < 0.05 && pairedDifferences.length < 10) {
      return decision(
        testId,
        'ineligible',
        [reason('small_non_normal_pairs', 'Amostra pequena e diferenças não normais não sustentam o teste t pareado.')],
        roles,
        ['paired_difference_normality', 'complete_pair_count'],
      );
    }
    return decision(
      testId,
      normality.state === 'supported' && normality.pValue >= 0.05 ? 'eligible' : 'eligible_with_caveat',
      [reason(
        'paired_groups_supported',
        `${pairedDifferences.length} pares territoriais completos serão comparados pelas diferenças dentro de cada território.`,
      )],
      roles,
      ['paired_difference_normality', 'complete_pair_count'],
    );
  }
  const allNormal = classifications.every((classification) => classification === 'approximately_normal');
  const nonNormal = classifications.some((classification) => classification === 'non_normal') || profile.variableType === 'ordinal';
  if (parametric) {
    if (nonNormal && Math.min(...counts.values()) < 10) {
      return decision(
        testId,
        'ineligible',
        [reason('small_non_normal_groups', 'Amostras pequenas e não normais não sustentam esta comparação paramétrica.')],
        roles,
        ['within_group_normality', 'independent_unit_count'],
      );
    }
    return decision(
      testId,
      allNormal ? 'eligible' : 'eligible_with_caveat',
      allNormal
        ? [reason('independent_groups_supported', 'Unidades independentes e perfil compatível; use a versão de Welch quando as variâncias diferirem.')]
        : [reason('distribution_requires_sensitivity', 'A distribuição não sustenta normalidade em todos os grupos; use também uma análise por postos.')],
      roles,
      ['within_group_normality', 'independent_unit_count'],
    );
  }
  return decision(
    testId,
    nonNormal ? 'eligible' : 'eligible_with_caveat',
    [reason('rank_comparison_supported', requiredGroups === 2
      ? 'Compara distribuições por postos entre dois grupos independentes; não implica automaticamente diferença de medianas.'
      : 'Compara distribuições por postos entre grupos independentes.')],
    roles,
    ['within_group_normality', 'independent_unit_count'],
  );
}

function correlation(input: EvaluateTestsInput): EligibilityDecision {
  const roles = input.roleAssignments ?? {};
  const xId = roles.predictor;
  const yId = roles.outcome;
  if (!xId || !yId || xId === yId) {
    return decision('correlacao', 'ineligible', [reason('pair_roles_required', 'Confirme duas variáveis distintas para formar os pares da correlação.')], roles);
  }
  const xProfile = input.profiles.find((profile) => profile.variableId === xId);
  const yProfile = input.profiles.find((profile) => profile.variableId === yId);
  if (!xProfile || !yProfile || [xProfile, yProfile].some((profile) => !['numeric', 'rate', 'ordinal'].includes(profile.variableType))) {
    return decision('correlacao', 'ineligible', [reason('ordered_pair_required', 'Correlação exige duas variáveis numéricas, taxas ou ordinais.')], roles);
  }
  const relevant = input.scenario.cells.filter((cell) => cell.variableId === xId || cell.variableId === yId);
  const relevantUsable = relevant.filter(usable);
  if (hasDuplicateAnalyticScopes(relevantUsable)) {
    return decision('correlacao', 'ineligible', [reason('duplicate_analytic_scope', 'Existe mais de um valor para o mesmo par analítico.')], roles);
  }
  if (overlappingTerritories(relevantUsable)) {
    return decision('correlacao', 'ineligible', [reason('overlapping_independent_units', 'O mesmo território aparece em grupos diferentes e não é uma nova unidade independente.')], roles);
  }
  if (repeatedUnits(relevantUsable)) {
    return decision('correlacao', 'ineligible', [reason('repeated_units_not_iid', 'Anos repetidos do mesmo território não podem entrar em correlação ingênua.')], roles);
  }
  const pairs = completePairs(relevant, xId, yId);
  if (new Set(pairs.pairs.map((pair) => pair.x)).size < 2 || new Set(pairs.pairs.map((pair) => pair.y)).size < 2) {
    return decision('correlacao', 'ineligible', [reason('insufficient_variation', 'As duas variáveis precisam apresentar variação nos pares completos.')], roles, ['complete_pair_count']);
  }
  return pairs.n >= ELIGIBILITY_CONFIG.minimumCorrelationPairs
    ? decision('correlacao', pairs.n < 8 ? 'eligible_with_caveat' : 'eligible', [reason('complete_pairs', `${pairs.n} pares completos serão usados.`)], roles, ['complete_pair_count'])
    : decision('correlacao', 'ineligible', [reason('insufficient_complete_pairs', `São necessários pelo menos ${ELIGIBILITY_CONFIG.minimumCorrelationPairs} pares completos independentes.`)], roles);
}

function prais(input: EvaluateTestsInput): EligibilityDecision {
  const roles = input.roleAssignments ?? {};
  const profile = outcomeProfile(input);
  if (!profile || !roles.outcome) return decision('prais-winsten', 'ineligible', [reason('outcome_role_required', 'Defina a variável de desfecho da série temporal.')], roles);
  const cells = cellsFor(input.scenario.cells, profile.variableId);
  if (hasDuplicateAnalyticScopes(cells)) {
    return decision('prais-winsten', 'ineligible', [reason('duplicate_analytic_scope', 'A série tem mais de um valor para o mesmo período.')], roles);
  }
  const seriesKeys = new Set(cells.map((cell) => JSON.stringify([cell.groupId, cell.territoryId])));
  const years = [...new Set(cells.map((cell) => Number(cell.periodKey.slice(0, 4))))].filter(Number.isFinite).sort((a, b) => a - b);
  const regular = years.length >= ELIGIBILITY_CONFIG.minimumSeriesPoints && years.every((year, index) => index === 0 || year === years[index - 1]! + 1);
  if (seriesKeys.size !== 1 || !regular || cells.length !== years.length) {
    return decision('prais-winsten', 'ineligible', [reason('regular_single_series_required', `Prais–Winsten exige uma única série regular com pelo menos ${ELIGIBILITY_CONFIG.minimumSeriesPoints} pontos.`)], roles);
  }
  if (distinctValues(cells) < 2) {
    return decision('prais-winsten', 'ineligible', [reason('insufficient_variation', 'A série precisa apresentar variação ao longo do tempo.')], roles);
  }
  return decision('prais-winsten', 'eligible', [reason('regular_series_supported', `Série regular com ${years.length} pontos, preservando zeros observados.`)], roles, ['series_regularity']);
}

function countModel(testId: 'poisson' | 'binomial-negativa', input: EvaluateTestsInput): EligibilityDecision {
  const roles = input.roleAssignments ?? {};
  if (!roles.outcome || !roles.predictor || roles.outcome === roles.predictor) {
    return decision(testId, 'ineligible', [reason('directional_roles_required', 'Defina desfecho e preditor distintos antes da regressão.')], roles);
  }
  const outcome = input.profiles.find((profile) => profile.variableId === roles.outcome);
  if (!outcome || outcome.variableType !== 'count') return decision(testId, 'ineligible', [reason('count_outcome_required', 'Selecione uma contagem como desfecho.')], roles);
  if (!input.profiles.some((profile) => profile.variableId === roles.predictor)) {
    return decision(testId, 'ineligible', [reason('predictor_profile_required', 'O preditor escolhido não possui perfil analítico.')], roles);
  }
  const exposureId = roles.exposure ?? outcome.exposureVariableId;
  if (!exposureId) return decision(testId, 'ineligible', [reason('missing_exposure', 'Comparações territoriais de contagens exigem exposição/offset.')], roles);
  if (exposureId === roles.outcome || exposureId === roles.predictor) {
    return decision(testId, 'ineligible', [reason('invalid_exposure_role', 'A exposição deve ser uma variável positiva distinta do desfecho e do preditor.')], roles);
  }
  const outcomeCells = cellsFor(input.scenario.cells, outcome.variableId);
  const predictorCells = cellsFor(input.scenario.cells, roles.predictor);
  const exposureCells = cellsFor(input.scenario.cells, exposureId);
  if (hasDuplicateAnalyticScopes([...outcomeCells, ...predictorCells, ...exposureCells])) {
    return decision(testId, 'ineligible', [reason('duplicate_analytic_scope', 'O modelo tem mais de um valor para a mesma unidade, período e variável.')], roles);
  }
  if (overlappingTerritories(outcomeCells)) {
    return decision(testId, 'ineligible', [reason('overlapping_independent_units', 'O mesmo território aparece em grupos diferentes e não é uma nova linha independente.')], roles);
  }
  if (outcomeCells.length === 0 || exposureCells.length === 0) {
    return decision(testId, 'ineligible', [reason('missing_exposure', 'Não há denominador positivo disponível para as observações do modelo.')], roles);
  }
  const predictorByScope = new Map(predictorCells.map((cell) => [scopeKey(cell), cell.rawValue]));
  const exposureByScope = new Map(exposureCells.map((cell) => [scopeKey(cell), cell.rawValue]));
  const outcomeScopes = new Set(outcomeCells.map(scopeKey));
  const modelPredictorCells = predictorCells.filter((cell) => outcomeScopes.has(scopeKey(cell)));
  const completeRows = outcomeCells.filter((cell) => {
    const key = scopeKey(cell);
    const predictor = predictorByScope.get(key);
    const exposure = exposureByScope.get(key);
    return typeof predictor === 'number' && Number.isFinite(predictor)
      && typeof exposure === 'number' && Number.isFinite(exposure) && exposure > 0;
  });
  if (completeRows.length !== outcomeCells.length) {
    return decision(testId, 'ineligible', [reason('incomplete_model_rows', 'Desfecho, preditor e exposição positiva devem coincidir em todas as linhas do modelo.')], roles, ['complete_model_rows']);
  }
  if (outcomeCells.some((cell) => !Number.isInteger(cell.rawValue) || cell.rawValue < 0)) {
    return decision(testId, 'ineligible', [reason('invalid_count_outcome', 'O desfecho de contagem deve conter apenas inteiros não negativos.')], roles);
  }
  if (repeatedUnits(outcomeCells)) {
    return decision(testId, 'ineligible', [reason('repeated_units_not_iid', 'Anos repetidos do mesmo território exigem um modelo longitudinal fora deste fluxo.')], roles);
  }
  const minimumRows = Math.max(
    ELIGIBILITY_CONFIG.minimumRegressionRows,
    ELIGIBILITY_CONFIG.regressionRowsPerPredictorPlusIntercept * 2,
  );
  if (completeRows.length < minimumRows) {
    return decision(testId, 'ineligible', [reason('insufficient_model_rows', `Este modelo exige pelo menos ${minimumRows} linhas completas para um preditor.`)], roles, ['complete_model_rows']);
  }
  if (distinctValues(modelPredictorCells) < 2 || distinctValues(outcomeCells) < 2) {
    return decision(testId, 'ineligible', [reason('insufficient_variation', 'Desfecho e preditor precisam apresentar variação nas linhas completas.')], roles);
  }
  const diagnostics = profileVariable(outcomeCells, outcome).overall;
  if (diagnostics.dispersionIndex === null) {
    return decision(testId, 'ineligible', [reason('dispersion_unavailable', 'Não foi possível estimar a dispersão da contagem.')], roles, ['complete_model_rows', 'count_dispersion']);
  }
  const overdispersed = diagnostics.dispersionIndex > 1.5;
  if (testId === 'poisson' && overdispersed) {
    return decision(testId, 'eligible_with_caveat', [reason(
      'possible_overdispersion',
      'A dispersão bruta sugere conferir a binomial negativa como sensibilidade; a decisão final usa o ajuste com offset.',
    )], roles, ['complete_model_rows', 'exposure_coverage', 'count_dispersion', 'zero_share']);
  }
  if (testId === 'binomial-negativa' && !overdispersed) {
    return decision(testId, 'ineligible', [reason('overdispersion_not_supported', 'Os dados não sustentam sobredispersão para liberar a binomial negativa.')], roles, ['complete_model_rows', 'exposure_coverage', 'count_dispersion', 'zero_share']);
  }
  return decision(testId, 'eligible_with_caveat', [reason(
    'count_model_diagnostics_required',
    'Modelo permitido com offset; confirme resíduos, ajuste e excesso de zeros antes da conclusão.',
  )], roles, ['complete_model_rows', 'exposure_coverage', 'count_dispersion', 'zero_share']);
}

function chiSquare(input: EvaluateTestsInput): EligibilityDecision {
  const roles = input.roleAssignments ?? {};
  const table = input.contingencyTable;
  if (!table || table.length < 2 || table.some((row) => row.length < 2 || row.length !== table[0]!.length)) {
    return decision('qui-quadrado', 'ineligible', [reason('observed_frequency_table_required', 'Forneça uma tabela de frequências observadas, nunca percentuais.')], roles);
  }
  if (table.flat().some((value) => !Number.isFinite(value) || !Number.isInteger(value) || value < 0)) {
    return decision('qui-quadrado', 'ineligible', [reason('invalid_observed_counts', 'Frequências observadas devem ser inteiras e não negativas.')], roles);
  }
  const rowTotals = table.map((row) => row.reduce((sum, value) => sum + value, 0));
  const columnTotals = table[0]!.map((_, column) => table.reduce((sum, row) => sum + row[column]!, 0));
  const total = rowTotals.reduce((sum, value) => sum + value, 0);
  if (total === 0 || rowTotals.some((value) => value === 0) || columnTotals.some((value) => value === 0)) {
    return decision('qui-quadrado', 'ineligible', [reason('empty_contingency_margin', 'A tabela não pode ter linha ou coluna com total zero.')], roles, ['expected_cell_counts']);
  }
  const expected = rowTotals.flatMap((rowTotal) => columnTotals.map((columnTotal) => rowTotal * columnTotal / total));
  const smallShare = expected.filter((value) => value < 5).length / expected.length;
  if (
    expected.some((value) => value < ELIGIBILITY_CONFIG.minimumExpectedCell)
    || smallShare > ELIGIBILITY_CONFIG.maximumSmallExpectedCellShare
  ) {
    return decision('qui-quadrado', 'ineligible', [reason('small_expected_cells', 'As frequências esperadas são pequenas demais para o qui-quadrado.')], roles, ['expected_cell_counts']);
  }
  return decision('qui-quadrado', 'eligible', [reason('observed_counts_supported', 'Tabela de frequências observadas com células esperadas adequadas.')], roles, ['expected_cell_counts']);
}

export function evaluateTests(input: EvaluateTestsInput): EligibilityDecision[] {
  const roles = input.roleAssignments ?? {};
  if (!scenarioMatchesDesign(input.design, input.scenario.cells)) {
    return TEST_IDS.map((testId) => decision(testId, 'ineligible', [reason(
      'design_cell_mismatch',
      'O conjunto analítico não corresponde aos grupos, territórios ou períodos do recorte.',
    )], roles));
  }
  if (input.scenario.cells.filter(usable).length === 0 || input.profiles.length === 0) {
    return TEST_IDS.map((testId) => decision(testId, 'ineligible', [reason('no_usable_data', 'Não há dados analisáveis para avaliar este teste.')], roles));
  }
  const byId = new Map<string, EligibilityDecision>();
  byId.set('t-student', groupTest('t-student', input, 2, true));
  byId.set('mann-whitney', groupTest('mann-whitney', input, 2, false));
  byId.set('anova-tukey', groupTest('anova-tukey', input, 3, true));
  byId.set('kruskal-dunn', groupTest('kruskal-dunn', input, 3, false));
  byId.set('correlacao', correlation(input));
  byId.set('prais-winsten', prais(input));
  byId.set('qui-quadrado', chiSquare(input));
  byId.set('poisson', countModel('poisson', input));
  byId.set('binomial-negativa', countModel('binomial-negativa', input));
  byId.set('logistica', decision('logistica', 'ineligible', [reason('aggregated_logistic_not_supported', 'O catálogo contém agregados territoriais, não desfechos individuais binários.')], roles));
  return TEST_IDS.map((testId) => byId.get(testId)!);
}

const GROUP_TEST_TYPES: Record<string, readonly VariableProfile['variableType'][]> = {
  't-student': ['numeric', 'rate'],
  'mann-whitney': ['numeric', 'rate', 'ordinal'],
  'anova-tukey': ['numeric', 'rate'],
  'kruskal-dunn': ['numeric', 'rate', 'ordinal'],
};

/**
 * Evaluates comparisons as a family of separate outcomes. Directional tests
 * still use the explicit roles from `evaluateTests`; only map-defined group
 * comparisons are combined here.
 */
export function evaluateTestsForSelection(input: EvaluateTestsInput): EligibilityDecision[] {
  const base = evaluateTests(input);
  const byId = new Map(base.map((item) => [item.testId, item]));

  for (const [testId, acceptedTypes] of Object.entries(GROUP_TEST_TYPES)) {
    const outcomes = input.profiles.filter((profile) => acceptedTypes.includes(profile.variableType));
    if (outcomes.length === 0) continue;
    const perOutcome = outcomes.map((profile) => ({
      profile,
      result: evaluateTests({
        ...input,
        profiles: [profile],
        roleAssignments: { ...(input.roleAssignments ?? {}), outcome: profile.variableId },
      }).find((item) => item.testId === testId)!,
    }));
    const incompatible = perOutcome.filter(({ result }) => result.status === 'ineligible');
    const excluded = input.profiles.filter((profile) => !acceptedTypes.includes(profile.variableType));
    const status: EligibilityDecision['status'] = incompatible.length === perOutcome.length
      ? 'ineligible'
      : incompatible.length > 0 || excluded.length > 0 || perOutcome.some(({ result }) => result.status === 'eligible_with_caveat')
        ? 'eligible_with_caveat'
        : 'eligible';
    const decisionsToExplain = incompatible.length > 0
      ? incompatible
      : perOutcome.filter(({ result }) => result.status === 'eligible_with_caveat');
    const outcomeReasons = decisionsToExplain.flatMap(({ profile, result }) => result.reasons.map((item) => ({
      code: `${profile.variableId}:${item.code}`,
      message: `${profile.label}: ${item.message}`,
    })));
    const compatibleCount = perOutcome.length - incompatible.length;
    const familyReason = compatibleCount > 1
      ? [{
          code: 'multiple_outcomes_separate',
          message: `${compatibleCount} variáveis calculáveis serão analisadas separadamente; a família confirmatória receberá correção de Holm.`,
        }]
      : [];
    const partialReason = incompatible.length > 0 && incompatible.length < perOutcome.length
      ? [{
          code: 'partial_outcome_eligibility',
          message: `${compatibleCount} ${compatibleCount === 1 ? 'desfecho compatível continua' : 'desfechos compatíveis continuam'} separadamente; ${incompatible.length} ${incompatible.length === 1 ? 'aparece como não calculável e fica' : 'aparecem como não calculáveis e ficam'} fora da correção de Holm.`,
        }]
      : [];
    const excludedReason = excluded.length > 0
      ? [{
          code: 'variables_outside_test_family',
          message: `Este teste será aplicado somente a ${outcomes.map((profile) => profile.label).join(', ')}; ${excluded.map((profile) => profile.label).join(', ')} exige outra família ou permanece descritiva.`,
        }]
      : [];
    byId.set(testId, {
      testId,
      status,
      reasons: [...familyReason, ...partialReason, ...excludedReason, ...outcomeReasons],
      roleAssignments: { ...(input.roleAssignments ?? {}) },
      diagnosticsUsed: [...new Set(perOutcome.flatMap(({ result }) => result.diagnosticsUsed))],
    });
  }

  return TEST_IDS.map((testId) => byId.get(testId)!);
}
