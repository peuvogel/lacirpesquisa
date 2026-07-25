/**
 * Differential parity: ported correlacaoEngine vs legacy Stats (tests/correlacao/module.js runAnalysis).
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
import { TABULAR_OPTIONS } from './correlacaoConfig';
import {
  buildDatasetFromConfirmed,
  deriveDatasusDataset,
  runCorrelation,
  toEngineOutput,
  validatePairs,
} from './correlacaoEngine';

const legacyStatsOracle = loadLegacyStatsOracle();
const fixtureDir = join(__dirname, '../../../test/fixtures/tests');
const tabnetDir = join(__dirname, '../../../test/fixtures/tabnet');

function readFixture(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf8');
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
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

describe('correlacaoEngine differential parity vs legacy Stats', () => {
  const exemploText = readFixture(fixtureDir, 'correlacao-exemplo.txt');

  it('Pearson r and p match legacy at display precision on exemplo fixture', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      method: 'pearson',
    });

    const portResult = runCorrelation(dataset.x, dataset.y, 'pearson');
    const legacyResult = legacyStatsOracle.pearson(dataset.x, dataset.y);

    displayParity(portResult.coef, legacyResult.coef, (v) => fmtSigned(v, 3));
    displayParity(portResult.p, legacyResult.p, fmtP);
    expect(portResult.n).toBe(legacyResult.n);
  });

  it('Spearman rho and p match legacy on same fixture', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      method: 'spearman',
    });

    const portResult = runCorrelation(dataset.x, dataset.y, 'spearman');
    const legacyResult = legacyStatsOracle.spearman(dataset.x, dataset.y);

    displayParity(portResult.coef, legacyResult.coef, (v) => fmtSigned(v, 3));
    displayParity(portResult.p, legacyResult.p, fmtP);
    expect(portResult.n).toBe(legacyResult.n);
  });

  it('TABNET derive path produces correlation output matching legacy Stats on derived vectors', () => {
    const source = buildTabnetSource('correlacao-derive.txt');
    const metrics = portNormalizer.getMetricOptions(source);
    expect(metrics.length).toBeGreaterThanOrEqual(2);

    const xMetricKey = metrics[0].key;
    const yMetricKey = metrics[1].key;

    const derived = portNormalizer.deriveCorrelationPairs({
      source,
      xSource: source,
      ySource: source,
      xMetricKey,
      yMetricKey,
      timeKeys: [],
      includeTotal: false,
      stats: legacyStats,
    });

    expect(derived.ok, derived.errors.join('; ')).toBe(true);
    const x = derived.pairs.map((pair) => pair.x);
    const y = derived.pairs.map((pair) => pair.y);

    const portPearson = runCorrelation(x, y, 'pearson');
    const legacyPearson = legacyStatsOracle.pearson(x, y);
    displayParity(portPearson.coef, legacyPearson.coef, (v) => fmtSigned(v, 3));
    displayParity(portPearson.p, legacyPearson.p, fmtP);

    const wrapped = deriveDatasusDataset({
      xSource: source,
      ySource: source,
      knobs: {
        xSourceId: source.id,
        ySourceId: source.id,
        xMetricKey,
        yMetricKey,
        timeKey: '',
      },
    });
    expect(wrapped.ok).toBe(true);
    expect(wrapped.dataset?.x.length).toBeGreaterThanOrEqual(3);
  });

  it('validatePairs returns PT error for insufficient sample', () => {
    const dataset = {
      x: [1, 2, 3],
      y: [2, 3, 4],
      labels: ['a', 'b', 'c'],
      headers: ['X', 'Y'] as [string, string],
      method: 'pearson' as const,
    };
    expect(validatePairs(dataset)).toEqual([
      'Forneça ao menos 4 pares válidos para uma análise mais estável.',
    ]);
  });

  it('toEngineOutput includes r, p, n for interpretation parity (D-07)', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      method: 'pearson',
    });

    const output = toEngineOutput(dataset, 'pearson');
    expect(Number.isFinite(output.result.coef)).toBe(true);
    expect(Number.isFinite(output.result.p)).toBe(true);
    expect(output.result.n).toBeGreaterThanOrEqual(4);
    expect(output.pearson.coef).toBe(output.result.coef);
    displayParity(output.result.coef, output.pearson.coef, (v) => fmtNumber(v, 3));
  });
});
