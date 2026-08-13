/**
 * Differential parity: ported praisEngine vs legacy Stats + vm oracle.
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
import { TABULAR_OPTIONS } from './praisConfig';
import {
  buildDatasetFromConfirmed,
  parseTemporalValue,
  runAnalysis,
  runPraisWinsten,
  validateSeries,
} from './praisEngine';

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

describe('praisEngine differential parity', () => {
  const exemploText = readFixture(fixtureDir, 'prais-exemplo.txt');

  it('runPraisWinsten matches legacy Stats on prais-exemplo fixture', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });

    const portModel = runPraisWinsten(dataset.time, dataset.values);
    const legacyModel = legacyStatsOracle.praisWinsten(dataset.time, dataset.values);

    expect(portModel.n).toBe(legacyModel.n);
    expect(portModel.classification).toBe(legacyModel.classification);
    displayParity(portModel.alpha, legacyModel.alpha, (v) => fmtNumber(v, 6));
    displayParity(portModel.beta, legacyModel.beta, (v) => fmtNumber(v, 6));
    displayParity(portModel.rho, legacyModel.rho, (v) => fmtNumber(v, 4));
    displayParity(portModel.p, legacyModel.p, fmtP);
  });

  it('fitted values match legacy pow(10, alpha+beta*t) formula', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });

    const output = runAnalysis(dataset);
    const legacyModel = legacyStatsOracle.praisWinsten(dataset.time, dataset.values);
    const legacyFitted = dataset.time.map((t) => 10 ** (legacyModel.alpha + legacyModel.beta * t));

    output.fitted.forEach((value, index) => {
      displayParity(value, legacyFitted[index], (v) => fmtNumber(v, 2));
    });
  });

  it('keeps confirmed zero rows and switches to original scale without pseudocount', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: Array.from({ length: 8 }, (_, index) => [String(2017 + index), String(index * 2)]),
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(dataset.values).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(dataset.orderedRows[0]).toMatchObject({ yRaw: '0', yValue: 0 });
    const output = runAnalysis(dataset);
    expect(output.model.scale).toBe('original');
    expect(output.model.apc).toBeNaN();
    expect(output.model.beta).toBeCloseTo(2, 8);
    expect(output.fitted[0]).toBeCloseTo(0, 8);
    expect(output.residuals.every(Number.isFinite)).toBe(true);
  });

  it('uses log scale and APC only for a strictly positive series', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: Array.from({ length: 8 }, (_, index) => [String(2017 + index), String(100 * 1.1 ** index)]),
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });
    const output = runAnalysis(dataset);

    expect(output.model.scale).toBe('log');
    expect(output.model.apc).toBeCloseTo(10, 8);
  });

  it('rejects internal temporal gaps instead of connecting them', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [['2017', '1'], ['2018', '2'], ['2020', '3'], ['2021', '4']],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(validateSeries(dataset)).toContainEqual(expect.stringMatching(/intervalos regulares|lacuna/i));
  });

  it('rejects negative indicators instead of silently dropping them', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [['2017', '1'], ['2018', '-2'], ['2019', '3'], ['2020', '4']],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(validateSeries(dataset)).toContainEqual(expect.stringMatching(/negativo/i));
  });

  it('parseTemporalValue handles year-month tokens and numeric years', () => {
    const year = parseTemporalValue('2015');
    expect(year.numeric).toBe(2015);
    expect(['year', 'integer']).toContain(year.timeType);

    const ym = parseTemporalValue('2015-03');
    expect(ym.numeric).toBeCloseTo(2015 + 2 / 12, 6);
    expect(ym.timeType).toBe('year-month');
  });

  it('validateSeries returns UI-SPEC error for fewer than 3 valid points', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [
        ['2015', '10'],
        ['2016', '12'],
      ],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(validateSeries(dataset)).toContain(
      'A série temporal precisa de pelo menos 3 pontos válidos.',
    );
  });

  it('TABNET derive path produces analyzable series', () => {
    const source = buildTabnetSource('prais-derive.txt');
    const categories = portNormalizer.getCategoryOptions(source, false);
    expect(categories.length).toBeGreaterThan(0);

    const categoryKey =
      categories.find((option) => /nacional/i.test(option.label))?.key ?? categories[0]?.key ?? '';

    const derived = portNormalizer.derivePraisSeries({
      source,
      categoryKey,
      includeTotal: false,
      stats: legacyStats,
    });
    expect(derived.ok, derived.errors.join('; ')).toBe(true);
    expect(derived.rows.length).toBeGreaterThanOrEqual(3);

    const headers = ['tempo', derived.metricLabel || 'valor'];
    const rows = derived.rows.map((row) => [row.timeLabel, String(row.value)]);
    const dataset = buildDatasetFromConfirmed({
      headers,
      rows,
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });
    expect(dataset.validCount).toBeGreaterThanOrEqual(3);

    const output = runAnalysis(dataset);
    const legacyModel = legacyStatsOracle.praisWinsten(dataset.time, dataset.values);
    displayParity(output.model.p, legacyModel.p, fmtP);
    displayParity(output.model.beta, legacyModel.beta, (v) => fmtNumber(v, 6));
  });
});
