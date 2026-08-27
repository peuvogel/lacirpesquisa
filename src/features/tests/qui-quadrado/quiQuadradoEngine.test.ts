import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './quiQuadradoConfig';
import {
  buildDatasetFromConfirmed,
  computeAssumptionNudges,
  runAnalysis,
  validateColumnTypes,
  validateDataset,
} from './quiQuadradoEngine';

const fixtureDir = join(__dirname, '../../../test/fixtures');
const goldenDir = join(fixtureDir, 'jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(goldenDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function loadExemploDataset() {
  const exemploText = readFileSync(join(fixtureDir, 'tests/qui-quadrado-exemplo.txt'), 'utf8');
  const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
  expect(parsed.status).toBe('loaded');
  if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

  return buildDatasetFromConfirmed({
    headers: parsed.headers,
    rows: parsed.bodyRows,
    recognizedColumns: Object.fromEntries(
      Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
    ),
  });
}

describe('quiQuadradoEngine golden parity', () => {
  it('matches JASP golden at display precision', () => {
    const golden = readGolden<{
      expected: {
        chi2: number;
        df: number;
        p: number;
        cramersV: number;
        cellsBelow5: number;
        pctBelow5: number;
      };
    }>('qui-quadrado-exemplo.golden.json');

    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);

    displayParity(result.chi2, golden.expected.chi2, (v) => fmtNumber(v, 3));
    expect(result.df).toBe(golden.expected.df);
    displayParity(result.p, golden.expected.p, fmtP);
    displayParity(result.cramersV, golden.expected.cramersV, (v) => fmtNumber(v, 3));
    expect(result.cellsBelow5).toBe(golden.expected.cellsBelow5);
    displayParity(result.pctBelow5, golden.expected.pctBelow5, (v) => fmtNumber(v, 1));
  });

  it('builds contingency table from categorical paste without numeric parsing', () => {
    const dataset = loadExemploDataset();
    expect(dataset.table).toEqual([
      [3, 2],
      [2, 3],
      [4, 1],
    ]);
    expect(dataset.totalN).toBe(15);
    expect(dataset.rowLabels).toEqual(['A', 'B', 'C']);
    expect(dataset.colLabels).toEqual(['sim', 'nao']);
  });
});

describe('quiQuadradoEngine assumption nudges', () => {
  it('returns warning when expected counts are below 5', () => {
    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);

    expect(nudges.some((nudge) => nudge.severity === 'warning')).toBe(true);
    expect(nudges[0]?.message).toMatch(/contagem esperada menor que 5/i);
  });

  it('adds Fisher tip for sparse 2×2 tables', () => {
    const dataset = {
      table: [
        [1, 2],
        [3, 1],
      ],
      rowLabels: ['X', 'Y'],
      colLabels: ['sim', 'nao'],
      columnHeaders: ['Linha', 'Coluna'] as [string, string],
      totalN: 7,
    };
    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);

    expect(nudges.some((nudge) => nudge.severity === 'info' && /Fisher/i.test(nudge.message))).toBe(
      true,
    );
  });
});

describe('quiQuadradoEngine validation', () => {
  it('returns PT errors for missing column mapping', () => {
    const errors = validateColumnTypes(['a', 'b'], [['1', '2']], { categoria_a: 0 });
    expect(errors[0]).toMatch(/categoria_b/i);
  });

  it('returns PT errors for numeric-only columns', () => {
    const errors = validateColumnTypes(
      ['x', 'y'],
      [
        ['1', '2'],
        ['3', '4'],
        ['5', '6'],
      ],
      { categoria_a: 0, categoria_b: 1 },
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toMatch(/numérica/i);
  });

  it('allows numeric category codes when both columns were explicitly marked categorical', () => {
    const errors = validateColumnTypes(
      ['exposição', 'desfecho'],
      [['0', '1'], ['1', '0'], ['1', '1']],
      { categoria_a: 0, categoria_b: 1 },
      [0, 1],
    );

    expect(errors).toEqual([]);
  });

  it('caps category levels before allocating the contingency matrix', () => {
    const rows = Array.from({ length: 21 * 21 }, (_, index) => [
      `A${Math.floor(index / 21)}`,
      `B${index % 21}`,
    ]);
    const dataset = buildDatasetFromConfirmed({
      headers: ['A', 'B'],
      rows,
      recognizedColumns: { categoria_a: 0, categoria_b: 1 },
    });

    expect(dataset).toMatchObject({ categoryLimitExceeded: true, table: [] });
    expect(validateDataset(dataset)).toContainEqual(expect.stringMatching(/20×20|20.*categorias/i));
  });

  it('returns PT errors for single-level categorical column', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['grupo', 'desfecho'],
      rows: [
        ['A', 'sim'],
        ['A', 'nao'],
        ['A', 'sim'],
      ],
      recognizedColumns: { categoria_a: 0, categoria_b: 1 },
    });
    const errors = validateDataset(dataset);
    expect(errors.some((error) => /2 níveis/i.test(error))).toBe(true);
  });

  it('does not throw on invalid input', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['only'],
      rows: [['x']],
      recognizedColumns: {},
    });
    expect(() => validateDataset(dataset)).not.toThrow();
    expect(validateDataset(dataset).length).toBeGreaterThan(0);
  });
});
