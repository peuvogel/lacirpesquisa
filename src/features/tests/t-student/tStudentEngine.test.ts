/**
 * Differential parity: ported tStudentEngine vs untouched tests/t-student/module.js exports.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import * as portImporter from '@/shared/data-input/datasusImporter';
import * as portNormalizer from '@/shared/data-input/datasusNormalizer';
import { legacyStats, legacyUtils } from '@/shared/data-input/legacyAdapters';
import type { DatasusSource } from '@/shared/data-input/types';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { loadLegacyStatsOracle } from '@/test/legacyStatsOracle';
import { loadTStudentModuleOracle } from '@/test/tStudentModuleOracle';
import { TABULAR_OPTIONS } from './tStudentConfig';
import {
  buildDatasetFromConfirmed,
  deriveDatasusDataset,
  runAnalysis,
  runFromDatasusDerived,
  runIndependentWelch,
  runPairedT,
  validateSampleSize,
  type TStudentWelchResult,
} from './tStudentEngine';

const legacyStatsOracle = loadLegacyStatsOracle();
const { safePaired, safeWelch } = loadTStudentModuleOracle();
const fixtureDir = join(__dirname, '../../../test/fixtures/tests');
const tabnetDir = join(__dirname, '../../../test/fixtures/tabnet');

function readFixture(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf8');
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function assertWelchParity(
  actual: TStudentWelchResult,
  expected: ReturnType<typeof safeWelch>,
) {
  expect(actual.n1).toBe(expected.n1);
  expect(actual.n2).toBe(expected.n2);
  displayParity(actual.m1, expected.m1, (v) => fmtNumber(v, 2));
  displayParity(actual.m2, expected.m2, (v) => fmtNumber(v, 2));
  displayParity(actual.t, expected.t, (v) => fmtNumber(v, 3));
  displayParity(actual.df, expected.df, (v) => fmtNumber(v, 2));
  displayParity(actual.p, expected.p, fmtP);
  displayParity(actual.diff, expected.diff, (v) => fmtSigned(v, 2));
  displayParity(actual.d, expected.d, (v) => fmtNumber(v, 2));
  displayParity(actual.ci[0], expected.ci[0], (v) => fmtSigned(v, 2));
  displayParity(actual.ci[1], expected.ci[1], (v) => fmtSigned(v, 2));
}

function buildTabnetSource(fixtureFile: string): DatasusSource {
  const text = readFixture(tabnetDir, fixtureFile);
  const parsed = portImporter.parseDatasusText({
    text,
    fileName: fixtureFile,
    utils: legacyUtils,
    stats: legacyStats,
  });
  if (!parsed.ok) throw new Error(`Fixture ${fixtureFile} failed to parse`);
  const source: DatasusSource = {
    id: `${fixtureFile}-source`,
    fileName: fixtureFile,
    rawText: text,
    parsed,
    mapping: parsed.initialMapping,
    confirmed: true,
  };
  source.normalized = portNormalizer.normalizeDatasusSource(source, legacyUtils, legacyStats);
  return source;
}

describe('tStudentEngine differential parity vs module.js', () => {
  const exemploText = readFixture(fixtureDir, 't-student-exemplo.txt');

  it('runIndependentWelch matches safeWelch on t-student-exemplo fixture', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      mode: 'independent',
    });

    const portResult = runIndependentWelch(dataset.g1, dataset.g2);
    const legacyResult = safeWelch(dataset.g1, dataset.g2, legacyStatsOracle);
    assertWelchParity(portResult, legacyResult);
  });

  it('runPairedT matches safePaired on t-student-exemplo fixture', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      mode: 'paired',
    });

    const portResult = runPairedT(dataset.g1, dataset.g2);
    const legacyResult = safePaired(dataset.g1, dataset.g2, legacyStatsOracle);

    expect(portResult.n1).toBe(legacyResult.n1);
    displayParity(portResult.p, legacyResult.p, fmtP);
    displayParity(portResult.t, legacyResult.t, (v) => fmtNumber(v, 3));
    displayParity(portResult.diff, legacyResult.diff, (v) => fmtSigned(v, 2));
    displayParity(portResult.ci[0], legacyResult.ci[0], (v) => fmtSigned(v, 2));
    displayParity(portResult.ci[1], legacyResult.ci[1], (v) => fmtSigned(v, 2));
  });

  it('TABNET derive path produces same Welch output as safeWelch on derived vectors', () => {
    const source = buildTabnetSource('t-student-derive.txt');
    const categories = portNormalizer
      .getCategoryOptions(source, false)
      .filter((option) => !/total/i.test(option.label));
    expect(categories.length).toBeGreaterThanOrEqual(4);
    const timeKeys = portNormalizer.getTimeOptions(source).map((option) => option.key);
    expect(timeKeys.length).toBeGreaterThan(0);

    const groupAKeys = categories.slice(0, 3).map((option) => option.key);
    const groupBKeys = categories.slice(3, 5).map((option) => option.key);

    const derivedRaw = portNormalizer.deriveIndependentTTest({
      source,
      groupAKeys,
      groupBKeys,
      timeKeys,
      includeTotal: false,
      stats: legacyStats,
    });

    expect(
      derivedRaw.ok,
      `errors=${derivedRaw.errors.join('; ')} A=${derivedRaw.vectors.A.length} B=${derivedRaw.vectors.B.length} keysA=${groupAKeys.length} keysB=${groupBKeys.length}`,
    ).toBe(true);

    const portResult = runFromDatasusDerived('independent', derivedRaw.vectors);
    const legacyResult = safeWelch(derivedRaw.vectors.A, derivedRaw.vectors.B, legacyStatsOracle);
    assertWelchParity(portResult as TStudentWelchResult, legacyResult);

    const wrapped = deriveDatasusDataset({
      mode: 'independent',
      source,
      knobs: {
        groupAKeys,
        groupBKeys,
        timeKeys,
      },
    });
    expect(wrapped.ok).toBe(true);
    expect(wrapped.dataset?.g1.length).toBeGreaterThanOrEqual(2);
  });

  it('validateSampleSize returns UI-SPEC PT errors for insufficient sample', () => {
    const dataset = { g1: [1], g2: [2, 3], labels: ['A', 'B'] as [string, string], mode: 'independent' as const };
    expect(validateSampleSize('independent', dataset)).toEqual([
      'Cada grupo precisa de pelo menos 2 observações válidas.',
    ]);
  });

  it('validateSampleSize returns paired length mismatch message', () => {
    const dataset = { g1: [1, 2, 3], g2: [1, 2], labels: ['A', 'B'] as [string, string], mode: 'paired' as const };
    expect(validateSampleSize('paired', dataset)).toEqual([
      'No t pareado, as duas colunas precisam ter o mesmo número de linhas válidas.',
    ]);
  });

  it('rejects independent and paired comparisons with zero standard error', () => {
    const independent = { g1: [1, 1], g2: [2, 2], labels: ['A', 'B'] as [string, string], mode: 'independent' as const };
    const paired = { g1: [1, 2], g2: [2, 3], labels: ['A', 'B'] as [string, string], mode: 'paired' as const };

    expect(validateSampleSize('independent', independent)).toContainEqual(expect.stringMatching(/erro padrão.*zero|variação.*insuficiente/i));
    expect(validateSampleSize('paired', paired)).toContainEqual(expect.stringMatching(/erro padrão.*zero|diferenças.*variação/i));
    expect(() => runAnalysis('independent', independent)).toThrow(/erro padrão|variação/i);
    expect(() => runAnalysis('paired', paired)).toThrow(/erro padrão|variação/i);
  });

  it('allows one constant independent group when the combined standard error is positive', () => {
    const dataset = { g1: [1, 1, 1], g2: [2, 3, 4], labels: ['A', 'B'] as [string, string], mode: 'independent' as const };
    expect(validateSampleSize('independent', dataset)).toEqual([]);
    expect(runAnalysis('independent', dataset).se).toBeGreaterThan(0);
  });

  it('runAnalysis delegates to Welch or paired based on mode', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

    const independentDataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      mode: 'independent',
    });

    const result = runAnalysis('independent', independentDataset);
    const legacyResult = safeWelch(independentDataset.g1, independentDataset.g2, legacyStatsOracle);
    assertWelchParity(result as TStudentWelchResult, legacyResult);
  });
});
