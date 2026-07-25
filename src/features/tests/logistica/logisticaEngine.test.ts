import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { RARE_EVENTS_THRESHOLD, TABULAR_OPTIONS } from './logisticaConfig';
import {
  buildDatasetFromConfirmed,
  computeAssumptionNudges,
  runAnalysis,
  validateColumnTypes,
  validateDataset,
} from './logisticaEngine';

const fixtureDir = join(__dirname, '../../../test/fixtures');
const goldenDir = join(fixtureDir, 'jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(goldenDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function loadExemploDataset() {
  const exemploText = readFileSync(join(fixtureDir, 'tests/logistica-exemplo.txt'), 'utf8');
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

describe('logisticaEngine golden parity', () => {
  it('matches JASP golden at display precision', () => {
    const golden = readGolden<{
      expected: {
        interceptOr: number;
        idadeOr: number;
        idadeP: number;
        converged: boolean;
      };
    }>('logistica-exemplo.golden.json');

    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);

    expect(result.converged).toBe(golden.expected.converged);
    displayParity(result.oddsRatios[0].or, golden.expected.interceptOr, (v) => fmtNumber(v, 3));
    const slopeOr = result.oddsRatios.find((row) => row.term !== '(Intercept)');
    expect(slopeOr).toBeDefined();
    displayParity(slopeOr!.or, golden.expected.idadeOr, (v) => fmtNumber(v, 3));
    const slopeCoef = result.coefficients.find((row) => row.term !== '(Intercept)');
    expect(slopeCoef).toBeDefined();
    displayParity(slopeCoef!.p, golden.expected.idadeP, fmtP);
    displayParity(slopeOr!.ci95[0], Math.exp(slopeCoef!.beta - 1.96 * slopeCoef!.se), (v) =>
      fmtNumber(v, 3),
    );
    displayParity(slopeOr!.ci95[1], Math.exp(slopeCoef!.beta + 1.96 * slopeCoef!.se), (v) =>
      fmtNumber(v, 3),
    );
  });

  it('builds design matrix from tabular paste', () => {
    const dataset = loadExemploDataset();
    expect(dataset.n).toBe(12);
    expect(dataset.design.terms).toEqual(['(Intercept)', 'dose']);
    expect(dataset.design.matrix[0]).toEqual([1, 1]);
    expect(dataset.classCounts.one).toBe(6);
    expect(dataset.classCounts.zero).toBe(6);
  });
});

describe('logisticaEngine assumption nudges', () => {
  it('returns warning on rare events when minority class below threshold', () => {
    const rows: string[][] = [];
    for (let i = 0; i < 96; i += 1) rows.push(['0', '1']);
    for (let i = 0; i < 4; i += 1) rows.push(['1', '2']);

    const dataset = buildDatasetFromConfirmed({
      headers: ['desfecho_binario', 'dose'],
      rows,
      recognizedColumns: { desfecho_binario: 0, preditor: 1 },
    });
    const minorityProp =
      Math.min(dataset.classCounts.zero, dataset.classCounts.one) / dataset.n;
    expect(minorityProp).toBeLessThan(RARE_EVENTS_THRESHOLD);

    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);
    const warning = nudges.find(
      (nudge) => nudge.severity === 'warning' && /eventos raros/i.test(nudge.message),
    );
    expect(warning).toBeDefined();
  });

  it('returns warning on separation heuristic when |beta| exceeds threshold', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['desfecho_binario', 'dose'],
      rows: [
        ['0', '1'],
        ['1', '2'],
        ['0', '3'],
        ['1', '4'],
      ],
      recognizedColumns: { desfecho_binario: 0, preditor: 1 },
    });
    const result = runAnalysis(dataset);
    result.coefficients = [
      { term: '(Intercept)', beta: 0.5, se: 0.2, z: 2.5, p: 0.01 },
      { term: 'dose', beta: 12.5, se: 3, z: 4.17, p: 0.001 },
    ];

    const nudges = computeAssumptionNudges(result, dataset);
    const warning = nudges.find(
      (nudge) => nudge.severity === 'warning' && /separação/i.test(nudge.message),
    );
    expect(warning).toBeDefined();
  });
});

describe('logisticaEngine validation', () => {
  it('rejects non-binary outcome with friendly PT message', () => {
    const errors = validateColumnTypes(
      ['desfecho_binario', 'dose'],
      [
        ['0', '1'],
        ['1', '2'],
        ['2', '3'],
      ],
      { desfecho_binario: 0, preditor: 1 },
    );
    expect(errors.some((error) => /binári|dois níveis/i.test(error))).toBe(true);
  });

  it('accepts two-level categorical outcome', () => {
    const errors = validateColumnTypes(
      ['desfecho', 'dose'],
      [
        ['nao', '1'],
        ['sim', '2'],
        ['nao', '3'],
      ],
      { desfecho_binario: 0, preditor: 1 },
    );
    expect(errors).toHaveLength(0);
  });

  it('coerces categorical outcome to 0/1 in dataset', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['desfecho', 'dose'],
      rows: [
        ['nao', '1'],
        ['sim', '2'],
        ['nao', '3'],
        ['sim', '4'],
      ],
      recognizedColumns: { desfecho_binario: 0, preditor: 1 },
    });
    expect(dataset.y).toEqual([0, 1, 0, 1]);
  });

  it('requires events in both classes', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['desfecho_binario', 'dose'],
      rows: [
        ['0', '1'],
        ['0', '2'],
        ['0', '3'],
      ],
      recognizedColumns: { desfecho_binario: 0, preditor: 1 },
    });
    const errors = validateDataset(dataset);
    expect(errors.some((error) => /evento \(1\) e um não evento/i.test(error))).toBe(true);
  });
});
