/**
 * Differential parity suite for derive* helpers in `datasusNormalizer.ts`.
 * Each TABNET fixture exercises one derive function against the untouched
 * legacy `assets/js/datasus-normalizer.js` exports.
 *
 * Fixture sources:
 * - tests/t-student-exemplo.txt ← tests/t-student/config.json exampleText
 * - correlacao-exemplo.txt ← tests/correlacao/config.json examples[0].text
 * - prais-exemplo.txt ← tests/prais-winsten/config.json exampleRows
 * - t-student-derive.txt ← hand-authored TABNET for deriveIndependentTTest
 * - correlacao-derive.txt ← hand-authored TABNET for deriveCorrelationPairs
 * - prais-derive.txt ← hand-authored TABNET for derivePraisSeries
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as portImporter from './datasusImporter';
import * as portNormalizer from './datasusNormalizer';
// eslint-disable-next-line import/extensions -- differential parity import of the untouched legacy module
import * as legacyNormalizer from '../../../assets/js/datasus-normalizer.js';
import { legacyStats, legacyUtils } from './legacyAdapters';
import type { DatasusSource } from './types';

const tabnetDir = join(__dirname, '../../test/fixtures/tabnet');
const exemploDir = join(__dirname, '../../test/fixtures/tests');

function readFixture(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf8');
}

function buildSource(fixtureFile: string, dir = tabnetDir): DatasusSource {
  const text = readFixture(dir, fixtureFile);
  const parsed = portImporter.parseDatasusText({
    text,
    fileName: fixtureFile,
    utils: legacyUtils,
    stats: legacyStats,
  });

  if (!parsed.ok) {
    throw new Error(`Fixture ${fixtureFile} failed to parse: ${parsed.error}`);
  }

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

describe('deriveIndependentTTest differential parity', () => {
  it('matches legacy on t-student-derive.txt', () => {
    const source = buildSource('t-student-derive.txt');
    const categories = portNormalizer.getCategoryOptions(source, false);
    expect(categories.length).toBeGreaterThanOrEqual(4);

    const groupAKeys = categories.slice(0, 2).map((option) => option.key);
    const groupBKeys = categories.slice(2, 4).map((option) => option.key);
    const timeKeys = portNormalizer.getTimeOptions(source).map((option) => option.key);

    const options = {
      source,
      groupAKeys,
      groupBKeys,
      timeKeys,
      includeTotal: false,
      stats: legacyStats,
    };

    expect(portNormalizer.deriveIndependentTTest(options)).toEqual(
      legacyNormalizer.deriveIndependentTTest(options as never),
    );
  });
});

describe('derivePairedTTest differential parity', () => {
  it('matches legacy on paired t-student-derive sources', () => {
    const leftSource = buildSource('t-student-derive.txt');
    const rightSource = {
      ...buildSource('t-student-derive.txt'),
      id: 't-student-derive-right',
      fileName: 't-student-derive-right.txt',
    };
    const timeKeys = portNormalizer.getTimeOptions(leftSource).slice(0, 2).map((option) => option.key);

    const options = {
      leftSource,
      rightSource,
      timeKeys,
      includeTotal: false,
      stats: legacyStats,
    };

    expect(portNormalizer.derivePairedTTest(options)).toEqual(
      legacyNormalizer.derivePairedTTest(options as never),
    );
  });
});

describe('deriveCorrelationPairs differential parity', () => {
  it('matches legacy on correlacao-derive.txt (same source, two metrics)', () => {
    const source = buildSource('correlacao-derive.txt');
    const metrics = portNormalizer.getMetricOptions(source);
    expect(metrics.length).toBeGreaterThanOrEqual(2);

    const options = {
      xSource: source,
      ySource: source,
      xMetricKey: metrics[0].key,
      yMetricKey: metrics[1].key,
      categoryKeys: [],
      timeKeys: [],
      includeTotal: false,
      stats: legacyStats,
    };

    expect(portNormalizer.deriveCorrelationPairs(options)).toEqual(
      legacyNormalizer.deriveCorrelationPairs(options as never),
    );
  });
});

describe('derivePraisSeries differential parity', () => {
  it('matches legacy on prais-derive.txt', () => {
    const source = buildSource('prais-derive.txt');
    const categories = portNormalizer.getCategoryOptions(source, true);
    const categoryKey = categories[0]?.key || '';

    const options = {
      source,
      categoryKey,
      includeTotal: false,
      stats: legacyStats,
    };

    expect(portNormalizer.derivePraisSeries(options)).toEqual(
      legacyNormalizer.derivePraisSeries(options as never),
    );
  });
});

describe('exemplo fixture smoke tests', () => {
  it('t-student exemplo parses as non-empty tabular paste', () => {
    const text = readFixture(exemploDir, 't-student-exemplo.txt');
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).toContain('Grupo A');
  });

  it('correlacao exemplo parses as non-empty tabular paste', () => {
    const text = readFixture(exemploDir, 'correlacao-exemplo.txt');
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).toContain('variavel_x');
  });

  it('prais exemplo parses as non-empty tabular paste', () => {
    const text = readFixture(exemploDir, 'prais-exemplo.txt');
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).toContain('2015');
  });
});
