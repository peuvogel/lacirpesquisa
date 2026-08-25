import { buildAnovaChartPresets } from '@/features/tests/anova-tukey/anovaCharts';
import {
  buildMetrics as buildAnovaMetrics,
  runAnalysis as runAnova,
  toEngineOutput as toAnovaOutput,
  validateDataset as validateAnova,
  type AnovaBuiltDataset,
} from '@/features/tests/anova-tukey/anovaEngine';
import { buildAnovaInterpretation } from '@/features/tests/anova-tukey/anovaInterpretation';
import { binomialNegativaChartPresets } from '@/features/tests/binomial-negativa/binomialNegativaCharts';
import {
  buildDatasetFromConfirmed as buildNegativeBinomialDataset,
  buildMetrics as buildNegativeBinomialMetrics,
  runAnalysis as runNegativeBinomial,
  toEngineOutput as toNegativeBinomialOutput,
  validateDataset as validateNegativeBinomial,
} from '@/features/tests/binomial-negativa/binomialNegativaEngine';
import { buildBinomialNegativaInterpretation } from '@/features/tests/binomial-negativa/binomialNegativaInterpretation';
import { buildCorrelacaoChartPresets } from '@/features/tests/correlacao/correlacaoCharts';
import {
  buildMetrics as buildCorrelationMetrics,
  toEngineOutput as toCorrelationOutput,
  type CorrelacaoBuiltDataset,
} from '@/features/tests/correlacao/correlacaoEngine';
import { buildCorrelacaoInterpretation } from '@/features/tests/correlacao/correlacaoInterpretation';
import { buildKruskalChartPresets } from '@/features/tests/kruskal-dunn/kruskalCharts';
import {
  buildMetrics as buildKruskalMetrics,
  runAnalysis as runKruskal,
  toEngineOutput as toKruskalOutput,
  validateDataset as validateKruskal,
  type KruskalBuiltDataset,
} from '@/features/tests/kruskal-dunn/kruskalEngine';
import { buildKruskalInterpretation } from '@/features/tests/kruskal-dunn/kruskalInterpretation';
import { mannWhitneyChartPresets } from '@/features/tests/mann-whitney/mannWhitneyCharts';
import {
  buildMetrics as buildMannWhitneyMetrics,
  runAnalysis as runMannWhitney,
  toEngineOutput as toMannWhitneyOutput,
  validateDataset as validateMannWhitney,
  type MannWhitneyBuiltDataset,
} from '@/features/tests/mann-whitney/mannWhitneyEngine';
import { buildMannWhitneyInterpretation } from '@/features/tests/mann-whitney/mannWhitneyInterpretation';
import { poissonChartPresets } from '@/features/tests/poisson/poissonCharts';
import {
  buildDatasetFromConfirmed as buildPoissonDataset,
  buildMetrics as buildPoissonMetrics,
  runAnalysis as runPoisson,
  toEngineOutput as toPoissonOutput,
  validateDataset as validatePoisson,
} from '@/features/tests/poisson/poissonEngine';
import { buildPoissonInterpretation } from '@/features/tests/poisson/poissonInterpretation';
import { buildQuiQuadradoChartPresets } from '@/features/tests/qui-quadrado/quiQuadradoCharts';
import {
  buildMetrics as buildQuiQuadradoMetrics,
  runAnalysis as runQuiQuadrado,
  toEngineOutput as toQuiQuadradoOutput,
  validateDataset as validateQuiQuadrado,
  type QuiQuadradoBuiltDataset,
} from '@/features/tests/qui-quadrado/quiQuadradoEngine';
import { buildQuiQuadradoInterpretation } from '@/features/tests/qui-quadrado/quiQuadradoInterpretation';
import { praisTrendPresets } from '@/features/tests/prais-winsten/praisCharts';
import {
  buildDatasetFromConfirmed as buildPraisDataset,
  buildMetrics as buildPraisMetrics,
  runAnalysis as runPrais,
  validateSeries as validatePrais,
} from '@/features/tests/prais-winsten/praisEngine';
import { buildPraisInterpretation } from '@/features/tests/prais-winsten/praisInterpretation';
import { TEST_REGISTRY } from '@/features/tests/registry';
import { buildTStudentChartPresets } from '@/features/tests/t-student/tStudentCharts';
import {
  buildMetrics as buildTStudentMetrics,
  runAnalysis as runTStudent,
  toEngineOutput as toTStudentOutput,
  validateSampleSize as validateTStudent,
  type TStudentBuiltDataset,
} from '@/features/tests/t-student/tStudentEngine';
import { buildTStudentInterpretation } from '@/features/tests/t-student/tStudentInterpretation';
import { completePairs, profileVariable } from '@/features/research/profiling';
import { evaluateTests } from '@/features/research/eligibility';
import type {
  AnalysisCell,
  AnalysisScenario,
  EligibilityDecision,
  ResearchDesign,
  VariableProfile,
} from '@/features/research/types';
import type { ResultMetric, ResultsPanelProps } from '@/routes/estatistica/ResultsPanel';
import type { HospitalOutcomeContingency } from './hospitalOutcomeContingency';

export interface GuidedResultCoverage {
  expected: number;
  used: number;
  missing: number;
}

export interface GuidedTestResult {
  testId: string;
  title: string;
  role: 'principal' | 'sensibilidade';
  metrics: ResultMetric[];
  chart: ResultsPanelProps['chart'];
  additionalCharts?: ResultsPanelProps['chart'][];
  interpretation: string[];
  coverage: GuidedResultCoverage;
  pValue: number | null;
  rawPValue?: number | null;
  adjustedPValue?: number | null;
  effectDirection: 'positive' | 'negative' | 'null';
  outcomeVariableId: string;
  support?: 'largest_valid' | 'common_coverage';
}

export interface GuidedSkippedOutcome {
  testId: string;
  outcomeVariableId: string;
  role: 'principal' | 'sensibilidade';
  reason: string;
  support?: 'largest_valid' | 'common_coverage';
}

export interface GuidedTestRun {
  fingerprint: string;
  scenarioFingerprint: string;
  results: GuidedTestResult[];
  skippedOutcomes?: GuidedSkippedOutcome[];
  coverageSensitivity?: {
    state: 'calculated' | 'not_calculable';
    explanation: string;
  };
}

export interface RunGuidedTestsInput {
  design: ResearchDesign;
  scenario: AnalysisScenario;
  profiles: readonly VariableProfile[];
  eligibility: readonly EligibilityDecision[];
  selectedTestIds: readonly string[];
  primaryTestId: string;
  roleAssignments: Record<string, string>;
  contingency?: HospitalOutcomeContingency;
  alpha?: number;
}

type UsableCell = AnalysisCell & { rawValue: number };

function isUsable(cell: AnalysisCell): cell is UsableCell {
  return cell.analyticStatus === 'include'
    && (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero')
    && typeof cell.rawValue === 'number'
    && Number.isFinite(cell.rawValue);
}

function labelForTest(testId: string): string {
  return TEST_REGISTRY.find((entry) => entry.id === testId)?.title ?? testId;
}

function outcomeProfile(input: RunGuidedTestsInput): VariableProfile {
  const explicit = input.roleAssignments.outcome;
  const profile = explicit
    ? input.profiles.find((item) => item.variableId === explicit)
    : input.profiles.filter((item) => item.variableType !== 'categorical')[0];
  if (!profile) throw new Error('Defina uma variável de desfecho antes de executar a análise.');
  return profile;
}

const GROUP_TEST_TYPES: Record<string, readonly VariableProfile['variableType'][]> = {
  't-student': ['numeric', 'rate'],
  'mann-whitney': ['numeric', 'rate', 'ordinal'],
  'anova-tukey': ['numeric', 'rate'],
  'kruskal-dunn': ['numeric', 'rate', 'ordinal'],
};

export function isGroupComparisonTest(testId: string): boolean {
  return Object.hasOwn(GROUP_TEST_TYPES, testId);
}

export function isGroupOutcomeTypeForTest(
  testId: string,
  variableType: VariableProfile['variableType'],
): boolean {
  return GROUP_TEST_TYPES[testId]?.includes(variableType) ?? false;
}

function groupOutcomeProfiles(input: RunGuidedTestsInput, testId: string): VariableProfile[] {
  const accepted = GROUP_TEST_TYPES[testId] ?? [];
  const profiles = input.profiles.filter((profile) => accepted.includes(profile.variableType));
  if (profiles.length === 0) throw new Error('Selecione ao menos uma variável compatível com a comparação de grupos.');
  return profiles;
}

interface GroupVector {
  id: string;
  label: string;
  values: number[];
}

function groupVectors(input: RunGuidedTestsInput, variableId: string): GroupVector[] {
  const groups = new Map<string, number[]>();
  for (const cell of input.scenario.cells) {
    if (cell.variableId !== variableId || !isUsable(cell)) continue;
    groups.set(cell.groupId, [...(groups.get(cell.groupId) ?? []), cell.rawValue]);
  }
  const nameCounts = new Map<string, number>();
  for (const group of input.design.groups) nameCounts.set(group.name, (nameCounts.get(group.name) ?? 0) + 1);
  return input.design.groups.flatMap((group) => {
    const values = groups.get(group.id);
    if (!values) return [];
    return [{
      id: group.id,
      label: (nameCounts.get(group.name) ?? 0) > 1 ? `${group.name} (${group.id})` : group.name,
      values,
    }];
  });
}

function pairedGroupVectors(input: RunGuidedTestsInput, variableId: string): GroupVector[] {
  const valuesByGroup = new Map<string, Map<string, number>>();
  for (const cell of input.scenario.cells) {
    if (cell.variableId !== variableId || !isUsable(cell)) continue;
    const group = valuesByGroup.get(cell.groupId) ?? new Map<string, number>();
    group.set(cell.territoryId, cell.rawValue);
    valuesByGroup.set(cell.groupId, group);
  }
  const territoryOrder = input.design.groups[0]?.territories
    .map((territory) => territory.id)
    .filter((territoryId) =>
      input.design.groups.every((group) => valuesByGroup.get(group.id)?.has(territoryId))) ?? [];
  const nameCounts = new Map<string, number>();
  for (const group of input.design.groups) {
    nameCounts.set(group.name, (nameCounts.get(group.name) ?? 0) + 1);
  }
  return input.design.groups.map((group) => ({
    id: group.id,
    label: (nameCounts.get(group.name) ?? 0) > 1 ? `${group.name} (${group.id})` : group.name,
    values: territoryOrder.map((territoryId) => valuesByGroup.get(group.id)!.get(territoryId)!),
  }));
}

function expectedScopes(input: RunGuidedTestsInput, variableIds: readonly string[]): number {
  const ids = new Set(variableIds);
  return new Set(input.scenario.cells
    .filter((cell) => ids.has(cell.variableId))
    .map((cell) => JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey])))
    .size;
}

function coverage(expected: number, used: number): GuidedResultCoverage {
  return { expected, used, missing: Math.max(0, expected - used) };
}

function direction(value: number): GuidedTestResult['effectDirection'] {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-12) return 'null';
  return value > 0 ? 'positive' : 'negative';
}

export function kruskalEpsilonSquared(h: number, groupCount: number, n: number): number | null {
  const denominator = n - groupCount;
  if (!Number.isFinite(h) || groupCount < 2 || denominator <= 0) return null;
  return Math.max(0, Math.min(1, (h - groupCount + 1) / denominator));
}

function orderedMetrics(metrics: ResultMetric[]): ResultMetric[] {
  const evidence = /(?:evidência|p-valor|^p\s)/i;
  const effect = /(?:efeito|diferença|intervalo|variação|mudança|coeficiente\s*\(|r de pearson|ρ de spearman)/i;
  return [
    ...metrics.filter((metric) => effect.test(metric.label) && !evidence.test(metric.label)),
    ...metrics.filter((metric) => !effect.test(metric.label) && !evidence.test(metric.label)),
    ...metrics.filter((metric) => evidence.test(metric.label)),
  ];
}

function withSafetyConclusion(
  paragraphs: string[],
  resultCoverage: GuidedResultCoverage,
  design: ResearchDesign,
): string[] {
  const missingText = resultCoverage.missing > 0
    ? `${resultCoverage.missing} unidade(s) esperada(s) ficaram fora por ausência ou decisão analítica.`
    : 'Todas as unidades esperadas com valor utilizável entraram no cálculo.';
  const ecological = ['uf', 'municipio', 'mesorregiao', 'macro_saude'].includes(design.geography)
    ? 'Os dados são agregados por território: a associação ou diferença observada não demonstra causalidade nem deve ser transferida automaticamente para indivíduos.'
    : 'A associação ou diferença observada não demonstra causalidade nem, sozinha, importância prática.';
  return [
    ...paragraphs,
    `Cobertura analítica: ${resultCoverage.used} de ${resultCoverage.expected} unidade(s). ${missingText}`,
    ecological,
  ];
}

function validateEngine(errors: readonly string[], testId: string): void {
  if (errors.length > 0) {
    throw new Error(`${labelForTest(testId)} não pôde ser executado com segurança: ${errors.join(' ')}`);
  }
}

function resultBase(
  input: RunGuidedTestsInput,
  testId: string,
  outcomeVariableId: string,
  metrics: ResultMetric[],
  chart: ResultsPanelProps['chart'],
  interpretation: string[],
  resultCoverage: GuidedResultCoverage,
  pValue: number | null,
  effectDirection: GuidedTestResult['effectDirection'],
): GuidedTestResult {
  return {
    testId,
    title: labelForTest(testId),
    role: testId === input.primaryTestId ? 'principal' : 'sensibilidade',
    metrics: orderedMetrics(metrics),
    chart,
    interpretation: withSafetyConclusion(interpretation, resultCoverage, input.design),
    coverage: resultCoverage,
    pValue,
    rawPValue: pValue,
    adjustedPValue: null,
    effectDirection,
    outcomeVariableId,
    support: 'largest_valid',
  };
}

export function attachCommonCoverageSensitivity(
  main: GuidedTestRun,
  common: GuidedTestRun | null,
  explanation: string,
): GuidedTestRun {
  if (!common) {
    return {
      ...main,
      coverageSensitivity: { state: 'not_calculable', explanation },
    };
  }
  const sensitivityResults = common.results.map((result): GuidedTestResult => ({
    ...result,
    role: 'sensibilidade',
    support: 'common_coverage',
    interpretation: [explanation, ...result.interpretation],
  }));
  return {
    ...main,
    fingerprint: `${main.fingerprint}:common:${common.scenarioFingerprint}`,
    results: [...main.results, ...sensitivityResults],
    skippedOutcomes: [
      ...(main.skippedOutcomes ?? []),
      ...(common.skippedOutcomes ?? []).map((item): GuidedSkippedOutcome => ({
        ...item,
        role: 'sensibilidade',
        support: 'common_coverage',
      })),
    ],
    coverageSensitivity: { state: 'calculated', explanation },
  };
}

function runGroupTest(
  input: RunGuidedTestsInput,
  testId: string,
  alpha: number,
  outcome: VariableProfile,
): GuidedTestResult {
  const paired = input.design.comparisonKind === 'paired_period'
    || input.design.comparisonKind === 'paired_disease';
  const entries = paired
    ? pairedGroupVectors(input, outcome.variableId)
    : groupVectors(input, outcome.variableId);
  const expected = expectedScopes(input, [outcome.variableId]);
  const used = entries.reduce((sum, entry) => sum + entry.values.length, 0);
  const resultCoverage = coverage(expected, used);

  if (testId === 't-student') {
    const mode = paired ? 'paired' : 'independent';
    const dataset: TStudentBuiltDataset = {
      g1: entries[0]?.values ?? [],
      g2: entries[1]?.values ?? [],
      labels: [entries[0]?.label ?? 'Grupo A', entries[1]?.label ?? 'Grupo B'],
      mode,
    };
    validateEngine(validateTStudent(mode, dataset), testId);
    const result = runTStudent(mode, dataset);
    const output = toTStudentOutput(dataset, result);
    return resultBase(input, testId, outcome.variableId, buildTStudentMetrics(result, dataset.labels),
      buildTStudentChartPresets()[0]!.buildChart(output),
      buildTStudentInterpretation(result, alpha, dataset.labels), resultCoverage, result.p, direction(result.diff));
  }

  if (testId === 'mann-whitney') {
    const dataset: MannWhitneyBuiltDataset = {
      groupA: entries[0]?.values ?? [], groupB: entries[1]?.values ?? [],
      labels: [entries[0]?.label ?? 'Grupo A', entries[1]?.label ?? 'Grupo B'],
      headers: { outcome: outcome.label, group: 'grupo territorial' },
      groupOrder: entries.map((entry) => entry.label),
    };
    validateEngine(validateMannWhitney(dataset), testId);
    const result = runMannWhitney(dataset);
    const output = toMannWhitneyOutput(dataset, result);
    return resultBase(input, testId, outcome.variableId, buildMannWhitneyMetrics(result, dataset.labels),
      mannWhitneyChartPresets[0]!.buildChart(output),
      buildMannWhitneyInterpretation(result, alpha, dataset.labels), resultCoverage, result.pValue,
      direction(result.rankBiserial));
  }

  const groups = Object.fromEntries(entries.map((entry) => [entry.label, entry.values]));
  if (testId === 'anova-tukey') {
    const dataset: AnovaBuiltDataset = {
      groups, groupOrder: entries.map((entry) => entry.label), headers: { outcome: outcome.label, group: 'grupo territorial' },
    };
    validateEngine(validateAnova(dataset), testId);
    const result = runAnova(dataset);
    const output = toAnovaOutput(dataset, result);
    const presets = buildAnovaChartPresets(dataset.groupOrder.length);
    return { ...resultBase(input, testId, outcome.variableId, buildAnovaMetrics(result, dataset),
      presets[0]!.buildChart(output),
      buildAnovaInterpretation(result, alpha, dataset.headers, dataset.groupOrder.length),
      resultCoverage, result.p, 'null'),
      additionalCharts: presets.slice(1).map((preset) => preset.buildChart(output)),
    };
  }

  const dataset: KruskalBuiltDataset = {
    groups, groupOrder: entries.map((entry) => entry.label), headers: { outcome: outcome.label, group: 'grupo territorial' },
  };
  validateEngine(validateKruskal(dataset), testId);
  const result = runKruskal(dataset);
  const output = toKruskalOutput(dataset, result);
  const presets = buildKruskalChartPresets(dataset.groupOrder.length);
  const epsilonSquared = kruskalEpsilonSquared(result.h, dataset.groupOrder.length, used);
  const metrics = [
    ...buildKruskalMetrics(result, dataset),
    ...(epsilonSquared === null ? [] : [{
      label: 'Tamanho de efeito (ε²)',
      value: epsilonSquared.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
      hint: 'Magnitude global da separação entre os grupos por postos',
    }]),
  ];
  return { ...resultBase(input, testId, outcome.variableId, metrics,
    presets[0]!.buildChart(output),
    buildKruskalInterpretation(result, alpha, dataset.headers, dataset.groupOrder.length),
    resultCoverage, result.p, 'null'),
    additionalCharts: presets.slice(1).map((preset) => preset.buildChart(output)),
  };
}

function runCorrelationTest(input: RunGuidedTestsInput, alpha: number): GuidedTestResult {
  const xId = input.roleAssignments.predictor;
  const yId = input.roleAssignments.outcome;
  const xProfile = input.profiles.find((profile) => profile.variableId === xId);
  const yProfile = input.profiles.find((profile) => profile.variableId === yId);
  if (!xId || !yId || !xProfile || !yProfile) throw new Error('Confirme preditor e desfecho para a correlação.');
  const complete = completePairs(input.scenario.cells, xId, yId);
  const method: CorrelacaoBuiltDataset['method'] = [xProfile, yProfile].some((profile) => profile.variableType === 'ordinal')
    || [xProfile, yProfile].some((profile) => Object.values(profileVariable(input.scenario.cells, profile).byGroup)
      .some((group) => group.normality.classification === 'non_normal'))
    ? 'spearman'
    : 'pearson';
  const dataset: CorrelacaoBuiltDataset = {
    x: complete.pairs.map((pair) => pair.x),
    y: complete.pairs.map((pair) => pair.y),
    labels: complete.pairs.map((pair) => `${pair.territoryId} · ${pair.periodKey}`),
    headers: [xProfile.label, yProfile.label],
    method,
  };
  const output = toCorrelationOutput(dataset, method);
  const resultCoverage = coverage(expectedScopes(input, [xId, yId]), complete.n);
  return resultBase(input, 'correlacao', yId, buildCorrelationMetrics(output.result, method, dataset.headers),
    buildCorrelacaoChartPresets(method)[0]!.buildChart(output),
    buildCorrelacaoInterpretation(output, alpha), resultCoverage, output.result.p, direction(output.result.coef));
}

function runPraisTest(input: RunGuidedTestsInput, alpha: number): GuidedTestResult {
  const outcome = outcomeProfile(input);
  const cells = input.scenario.cells.filter((cell): cell is UsableCell => cell.variableId === outcome.variableId && isUsable(cell));
  const territory = input.design.groups.flatMap((group) => group.territories).find((item) => item.id === cells[0]?.territoryId);
  const dataset = buildPraisDataset({
    headers: ['território', 'tempo', outcome.label],
    rows: cells.map((cell) => [territory?.label ?? cell.territoryId, cell.periodKey, String(cell.rawValue)]),
    recognizedColumns: { id: 0, tempo: 1, variavel_y: 2 },
  });
  validateEngine(validatePrais(dataset), 'prais-winsten');
  const output = runPrais(dataset);
  const resultCoverage = coverage(expectedScopes(input, [outcome.variableId]), dataset.validCount);
  const effect = output.model.scale === 'log' ? output.model.apc : output.model.absoluteChange;
  return resultBase(input, 'prais-winsten', outcome.variableId, buildPraisMetrics(output.model, dataset),
    praisTrendPresets[0]!.buildChart(output), buildPraisInterpretation(output, alpha),
    resultCoverage, output.model.p, direction(effect));
}

function modelRows(input: RunGuidedTestsInput): {
  rows: string[][];
  expected: number;
  outcome: VariableProfile;
  predictor: VariableProfile;
} {
  const outcome = outcomeProfile(input);
  const predictorId = input.roleAssignments.predictor;
  const predictor = input.profiles.find((profile) => profile.variableId === predictorId);
  const exposureId = input.roleAssignments.exposure ?? outcome.exposureVariableId ?? 'populacao';
  if (!predictor || !predictorId) throw new Error('Defina o preditor do modelo de contagem.');
  const byScope = new Map<string, Partial<Record<'outcome' | 'predictor' | 'exposure', number>>>();
  for (const cell of input.scenario.cells) {
    if (!isUsable(cell)) continue;
    const role = cell.variableId === outcome.variableId
      ? 'outcome'
      : cell.variableId === predictorId
        ? 'predictor'
        : cell.variableId === exposureId
          ? 'exposure'
          : null;
    if (!role) continue;
    const key = JSON.stringify([cell.groupId, cell.territoryId, cell.periodKey]);
    byScope.set(key, { ...(byScope.get(key) ?? {}), [role]: cell.rawValue });
  }
  const rows = [...byScope.values()].flatMap((row) =>
    typeof row.outcome === 'number' && typeof row.predictor === 'number' && typeof row.exposure === 'number'
      ? [[String(row.outcome), String(row.predictor), String(row.exposure)]]
      : []);
  return { rows, expected: expectedScopes(input, [outcome.variableId]), outcome, predictor };
}

function runCountModel(input: RunGuidedTestsInput, testId: 'poisson' | 'binomial-negativa', alpha: number): GuidedTestResult {
  const built = modelRows(input);
  const headers = [built.outcome.label, built.predictor.label, 'População-exposição'];
  const recognizedColumns = { contagem: 0, preditor: 1, offset_exposure: 2 };
  const resultCoverage = coverage(built.expected, built.rows.length);
  if (testId === 'poisson') {
    const dataset = buildPoissonDataset({ headers, rows: built.rows, recognizedColumns, requireExposure: true });
    validateEngine(validatePoisson(dataset), testId);
    const result = runPoisson(dataset);
    const output = toPoissonOutput(dataset, result);
    const slope = result.coefficients.find((item) => item.term !== '(Intercept)');
    return resultBase(input, testId, built.outcome.variableId, buildPoissonMetrics(result, dataset),
      poissonChartPresets[0]!.buildChart(output), buildPoissonInterpretation(output, alpha),
      resultCoverage, slope?.p ?? null, direction(slope?.beta ?? 0));
  }
  const dataset = buildNegativeBinomialDataset({ headers, rows: built.rows, recognizedColumns, requireExposure: true });
  validateEngine(validateNegativeBinomial(dataset), testId);
  const result = runNegativeBinomial(dataset);
  const output = toNegativeBinomialOutput(dataset, result);
  const slope = result.coefficients.find((item) => item.term !== '(Intercept)');
  return resultBase(input, testId, built.outcome.variableId, buildNegativeBinomialMetrics(result, dataset),
    binomialNegativaChartPresets[0]!.buildChart(output), buildBinomialNegativaInterpretation(output, alpha),
    resultCoverage, slope?.p ?? null, direction(slope?.beta ?? 0));
}

function runChiSquareTest(input: RunGuidedTestsInput, alpha: number): GuidedTestResult {
  const contingency = input.contingency;
  if (!contingency) throw new Error('A tabela observada de óbito e não óbito não está disponível.');
  const dataset: QuiQuadradoBuiltDataset = {
    table: contingency.table.map((row) => [...row]),
    rowLabels: [...contingency.rowLabels],
    colLabels: [...contingency.colLabels],
    columnHeaders: [...contingency.columnHeaders],
    totalN: contingency.table.flat().reduce((sum, value) => sum + value, 0),
  };
  validateEngine(validateQuiQuadrado(dataset), 'qui-quadrado');
  const result = runQuiQuadrado(dataset);
  const output = toQuiQuadradoOutput(dataset, result);
  const resultCoverage = coverage(contingency.expectedUnits, contingency.usedUnits);
  return resultBase(
    input,
    'qui-quadrado',
    'desfecho_hospitalar',
    buildQuiQuadradoMetrics(result, dataset),
    buildQuiQuadradoChartPresets()[0]!.buildChart(output),
    buildQuiQuadradoInterpretation(output, alpha),
    resultCoverage,
    result.p,
    direction(result.cramersV),
  );
}

interface GuidedTestExecution {
  results: GuidedTestResult[];
  skipped: GuidedSkippedOutcome[];
}

function runOne(input: RunGuidedTestsInput, testId: string, alpha: number): GuidedTestExecution {
  if (['t-student', 'mann-whitney', 'anova-tukey', 'kruskal-dunn'].includes(testId)) {
    const role: GuidedSkippedOutcome['role'] = testId === input.primaryTestId ? 'principal' : 'sensibilidade';
    return groupOutcomeProfiles(input, testId).reduce<GuidedTestExecution>((execution, profile) => {
      const perOutcome = evaluateTests({
        design: input.design,
        scenario: input.scenario,
        profiles: [profile],
        roleAssignments: { ...input.roleAssignments, outcome: profile.variableId },
      }).find((item) => item.testId === testId);
      if (!perOutcome || perOutcome.status === 'ineligible') {
        execution.skipped.push({
          testId,
          outcomeVariableId: profile.variableId,
          role,
          reason: perOutcome?.reasons.map((item) => item.message).join(' ') || 'Combinação não calculável com segurança.',
          support: 'largest_valid',
        });
        return execution;
      }
      try {
        execution.results.push(runGroupTest(input, testId, alpha, profile));
      } catch (error) {
        execution.skipped.push({
          testId,
          outcomeVariableId: profile.variableId,
          role,
          reason: error instanceof Error ? error.message : 'O motor bloqueou este desfecho.',
          support: 'largest_valid',
        });
      }
      return execution;
    }, { results: [], skipped: [] });
  }
  if (testId === 'correlacao') return { results: [runCorrelationTest(input, alpha)], skipped: [] };
  if (testId === 'prais-winsten') return { results: [runPraisTest(input, alpha)], skipped: [] };
  if (testId === 'qui-quadrado') return { results: [runChiSquareTest(input, alpha)], skipped: [] };
  if (testId === 'poisson' || testId === 'binomial-negativa') return { results: [runCountModel(input, testId, alpha)], skipped: [] };
  throw new Error(`${labelForTest(testId)} ainda não possui um adaptador seguro para dados territoriais agregados.`);
}

export function adjustPValuesHolm(pValues: readonly number[]): number[] {
  if (pValues.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('Valores de p inválidos para a correção de Holm.');
  }
  const ordered = pValues
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value || left.index - right.index);
  let previous = 0;
  const adjusted = Array<number>(pValues.length);
  ordered.forEach((item, rank) => {
    previous = Math.max(previous, Math.min(1, item.value * (ordered.length - rank)));
    adjusted[item.index] = previous;
  });
  return adjusted;
}

function formatPValue(value: number): string {
  if (value < 0.001) return '< 0,001';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function applyHolmToPrimaryFamily(results: GuidedTestResult[], alpha: number): GuidedTestResult[] {
  const family = results.filter((result) =>
    result.role === 'principal'
    && typeof result.rawPValue === 'number'
    && Number.isFinite(result.rawPValue));
  if (family.length < 2) return results;
  const adjusted = adjustPValuesHolm(family.map((result) => result.rawPValue!));
  const adjustedByResult = new Map(family.map((result, index) => [result, adjusted[index]!]));
  return results.map((result) => {
    const adjustedP = adjustedByResult.get(result);
    if (adjustedP === undefined) return result;
    const rawMetric = result.metrics.find((metric) => /evidência|p-valor/i.test(metric.label));
    const metrics = [
      ...result.metrics.filter((metric) => metric !== rawMetric),
      ...(rawMetric ? [{ ...rawMetric, label: 'p bruto (sem ajuste)' }] : []),
      { label: 'p ajustado por Holm', value: formatPValue(adjustedP), hint: `${family.length} desfechos na família confirmatória` },
    ];
    const effectParagraphs = result.interpretation.filter((paragraph) =>
      !/estatisticamente significativ|encontrou evidência|não encontrou evidência|\bp\s*=/.test(paragraph.toLowerCase()));
    const holmConclusion = adjustedP < alpha
      ? `Após a correção de Holm da família confirmatória, este desfecho manteve evidência estatística no limiar de ${(alpha * 100).toLocaleString('pt-BR')}% (p ajustado = ${formatPValue(adjustedP)}).`
      : `Após a correção de Holm da família confirmatória, este desfecho não manteve evidência estatística no limiar de ${(alpha * 100).toLocaleString('pt-BR')}% (p ajustado = ${formatPValue(adjustedP)}).`;
    return {
      ...result,
      metrics: orderedMetrics(metrics),
      interpretation: [...effectParagraphs, holmConclusion],
      pValue: adjustedP,
      adjustedPValue: adjustedP,
    };
  });
}

export function runGuidedTests(input: RunGuidedTestsInput): GuidedTestRun {
  if (!input.selectedTestIds.includes(input.primaryTestId)) {
    throw new Error('O teste principal precisa estar entre os testes selecionados.');
  }
  const allowed = new Map(input.eligibility.map((item) => [item.testId, item]));
  for (const testId of input.selectedTestIds) {
    const eligibility = allowed.get(testId);
    if (!eligibility || eligibility.status === 'ineligible') {
      throw new Error(`${labelForTest(testId)} não foi liberado para este cenário.`);
    }
  }
  const ordered = [
    input.primaryTestId,
    ...input.selectedTestIds.filter((testId) => testId !== input.primaryTestId),
  ];
  const alpha = input.alpha ?? 0.05;
  const executions = ordered.map((testId) => runOne(input, testId, alpha));
  const results = applyHolmToPrimaryFamily(executions.flatMap((item) => item.results), alpha);
  return {
    fingerprint: `guided-results:${input.scenario.fingerprint}:${ordered.join(',')}:${JSON.stringify(input.roleAssignments)}`,
    scenarioFingerprint: input.scenario.fingerprint,
    results,
    skippedOutcomes: executions.flatMap((item) => item.skipped),
  };
}
