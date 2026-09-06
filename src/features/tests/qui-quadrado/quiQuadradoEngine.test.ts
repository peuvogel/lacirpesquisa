import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularFileState, readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats, legacyUtils } from '@/shared/data-input/legacyAdapters';
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
  it('decodes a Latin-1 DATASUS CSV file and preserves the same count matrix as paste', async () => {
    const text = readFileSync(join(fixtureDir, 'tests/qui-quadrado-datasus.csv'), 'utf8');
    const bytes = Uint8Array.from(Buffer.from(text, 'latin1'));
    const file = new File([bytes], 'datasus.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
    const parsed = await readTabularFileState(file, legacyUtils, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded CSV');
    expect(parsed.headers[0]).toBe('Faixa Etária 1');
    const dataset = buildDatasetFromConfirmed({ headers: parsed.headers, rows: parsed.bodyRows, recognizedColumns: {} });
    expect(dataset.table).toHaveLength(12);
    expect(dataset.colLabels).toEqual(['Masc', 'Fem']);
    expect(dataset.totalN).toBe(761164);
    expect(validateDataset(dataset)).toEqual([]);
  });

  it('uses DATASUS frequencies as a 12×2 matrix, excluding both margins and source notes', () => {
    const text = readFileSync(join(fixtureDir, 'tests/qui-quadrado-datasus.csv'), 'utf8');
    const parsed = readTabularPasteState(text, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');
    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers, rows: parsed.bodyRows,
      recognizedColumns: { categoria_a: 0, categoria_b: 1 },
    });
    expect(dataset.table).toHaveLength(12);
    expect(dataset.colLabels).toEqual(['Masc', 'Fem']);
    expect(dataset.table[0]).toEqual([39115, 29646]);
    expect(dataset.table[11]).toEqual([70907, 91936]);
    expect(dataset.totalN).toBe(761164);
    expect(validateDataset(dataset)).toEqual([]);
    expect(runAnalysis(dataset).df).toBe(11);
    expect(runAnalysis(dataset).chi2).toBeCloseTo(5455.843500604451, 7);
    expect(runAnalysis(dataset).cramersV).toBeCloseTo(0.0846626449655342, 10);
  });

  it('parses grouped counts and ignores disabled count columns without including margins', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Faixa', 'Masc', 'Fem', 'Ignorado', 'Total'],
      rows: [['A', '1.234', '2 000', '999', '4233'], ['B', '3', '4', '999', '1006'], ['Total', '1237', '2004', '1998', '5239']],
      recognizedColumns: {}, inputFormat: 'counts', excludedColumnIndexes: [3],
    });
    expect(dataset.table).toEqual([[1234, 2000], [3, 4]]);
    expect(dataset.totalN).toBe(3241);
    expect(validateDataset(dataset)).toEqual([]);
  });

  it.each(['', '-', '...', '-1', '1,5', '9007199254740992'])('blocks invalid or missing frequency %j instead of treating it as zero', (count) => {
    const dataset = buildDatasetFromConfirmed({ headers: ['Faixa', 'Masc', 'Fem'],
      rows: [['A', count, '10'], ['B', '5', '20']], recognizedColumns: {}, inputFormat: 'counts' });
    expect(validateDataset(dataset).join(' ')).toMatch(/Contagem inválida/);
  });

  it('rejects empty margins rather than calculating incorrect degrees of freedom', () => {
    const dataset = buildDatasetFromConfirmed({ headers: ['Faixa', 'Masc', 'Fem'],
      rows: [['A', '0', '0'], ['B', '5', '20']], recognizedColumns: {}, inputFormat: 'counts' });
    expect(validateDataset(dataset).join(' ')).toMatch(/total é zero/);
  });

  it('supports a count matrix without totals when explicitly selected', () => {
    const dataset = buildDatasetFromConfirmed({ headers: ['Faixa', 'Masc', 'Fem'],
      rows: [['A', '10', '20'], ['B', '5', '20']], recognizedColumns: {}, inputFormat: 'counts' });
    expect(dataset.table).toEqual([[10, 20], [5, 20]]);
    expect(dataset.totalN).toBe(55);
    expect(validateDataset(dataset)).toEqual([]);
  });

  it('does not reinterpret unique individual identifiers with two numeric fields as frequencies', () => {
    const dataset = buildDatasetFromConfirmed({ headers: ['Pessoa', 'Codigo', 'Idade'],
      rows: [['A', '1', '20'], ['B', '2', '30']], recognizedColumns: { categoria_a: 0, categoria_b: 1 } });
    expect(dataset.table).toEqual([[1, 0], [0, 1]]);
    expect(dataset.totalN).toBe(2);
  });

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
