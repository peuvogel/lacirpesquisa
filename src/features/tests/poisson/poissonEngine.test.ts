import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './poissonConfig';
import {
  OVERDISPERSION_THRESHOLD,
  buildDatasetFromConfirmed,
  computeAssumptionNudges,
  runAnalysis,
  validateColumnTypes,
  validateDataset,
} from './poissonEngine';
import { computePoissonFittedValues } from './poissonCharts';

const fixtureDir = join(__dirname, '../../../test/fixtures');
const goldenDir = join(fixtureDir, 'jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(goldenDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function loadExemploDataset() {
  const exemploText = readFileSync(join(fixtureDir, 'tests/poisson-exemplo.txt'), 'utf8');
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

describe('poissonEngine golden parity', () => {
  it('matches JASP golden at display precision', () => {
    const golden = readGolden<{
      expected: {
        interceptBeta: number;
        slopeBeta: number;
        slopeP: number;
        pearsonChi2: number;
        dfResid: number;
        overdispersionRatio: number;
        converged: boolean;
      };
    }>('poisson-exemplo.golden.json');

    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);

    expect(result.converged).toBe(golden.expected.converged);
    displayParity(result.coefficients[0].beta, golden.expected.interceptBeta, (v) => fmtNumber(v, 3));
    displayParity(result.coefficients[1].beta, golden.expected.slopeBeta, (v) => fmtNumber(v, 3));
    displayParity(result.coefficients[1].p, golden.expected.slopeP, fmtP);
    displayParity(result.pearsonChi2, golden.expected.pearsonChi2, (v) => fmtNumber(v, 3));
    expect(result.dfResid).toBe(golden.expected.dfResid);
    displayParity(result.overdispersionRatio, golden.expected.overdispersionRatio, (v) =>
      fmtNumber(v, 3),
    );
  });

  it('uses log(exposure) as offset so equal territorial rates have IRR near one', () => {
    const rows = [
      ['10', '0', '100'], ['20', '0', '200'], ['30', '0', '300'],
      ['100', '1', '1000'], ['200', '1', '2000'], ['300', '1', '3000'],
    ];
    const dataset = buildDatasetFromConfirmed({
      headers: ['contagem', 'grupo', 'populacao'],
      rows,
      recognizedColumns: { contagem: 0, preditor: 1, offset_exposure: 2 },
      requireExposure: true,
    });
    const result = runAnalysis(dataset);
    const slope = result.coefficients.find((coefficient) => coefficient.term !== '(Intercept)')!;

    expect(dataset.design.offset).toEqual(rows.map((row) => Math.log(Number(row[2]))));
    expect(Math.exp(slope.beta)).toBeCloseTo(1, 6);
    const fitted = computePoissonFittedValues({
      result,
      dataset,
      nudges: [],
    });
    expect(fitted[0]).toBeCloseTo(10, 6);
    expect(fitted[5]).toBeCloseTo(300, 6);
  });

  it('builds design matrix from tabular paste', () => {
    const dataset = loadExemploDataset();
    expect(dataset.n).toBe(12);
    expect(dataset.design.terms).toEqual(['(Intercept)', 'exposicao']);
    expect(dataset.design.matrix[0]).toEqual([1, 1]);
  });
});

describe('poissonEngine assumption nudges', () => {
  it('returns warning with binomial-negativa CTA when overdispersed', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['contagem', 'exposicao'],
      rows: [
        ['2', '1'],
        ['18', '1'],
        ['1', '1'],
        ['22', '1'],
        ['3', '1'],
        ['25', '1'],
        ['0', '1'],
        ['20', '1'],
        ['5', '1'],
        ['28', '1'],
        ['2', '1'],
        ['30', '1'],
      ],
      recognizedColumns: { contagem: 0, preditor: 1 },
    });
    const result = runAnalysis(dataset);
    expect(result.overdispersionRatio).toBeGreaterThan(OVERDISPERSION_THRESHOLD);

    const nudges = computeAssumptionNudges(result, dataset);
    const warning = nudges.find(
      (nudge) => nudge.severity === 'warning' && nudge.cta?.testId === 'binomial-negativa',
    );
    expect(warning).toBeDefined();
    expect(warning?.cta?.label).toMatch(/Binomial Negativa/i);
  });

  it('does not include NB CTA when equidispersed', () => {
    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);
    expect(result.overdispersionRatio).toBeLessThanOrEqual(OVERDISPERSION_THRESHOLD);

    const nudges = computeAssumptionNudges(result, dataset);
    expect(nudges.some((nudge) => nudge.cta?.testId === 'binomial-negativa')).toBe(false);
  });
});

describe('poissonEngine validation', () => {
  it('requires positive exposure for territorial comparisons', () => {
    const missing = buildDatasetFromConfirmed({
      headers: ['contagem', 'preditor'],
      rows: [['2', '1'], ['3', '2'], ['4', '3']],
      recognizedColumns: { contagem: 0, preditor: 1 },
      requireExposure: true,
    });
    expect(validateDataset(missing)).toContainEqual(expect.stringMatching(/exposição|offset/i));

    const errors = validateColumnTypes(
      ['contagem', 'preditor', 'populacao'],
      [['2', '1', '0'], ['3', '2', '-1']],
      { contagem: 0, preditor: 1, offset_exposure: 2 },
      { requireExposure: true },
    );
    expect(errors).toContainEqual(expect.stringMatching(/positiva/i));
  });
  it('rejects negative counts', () => {
    const errors = validateColumnTypes(
      ['contagem', 'exposicao'],
      [
        ['-1', '1'],
        ['2', '1'],
      ],
      { contagem: 0, preditor: 1 },
    );
    expect(errors.some((error) => /negativos/i.test(error))).toBe(true);
  });

  it('rejects non-integer counts', () => {
    const errors = validateColumnTypes(
      ['contagem', 'exposicao'],
      [
        ['2,5', '1'],
        ['3', '1'],
      ],
      { contagem: 0, preditor: 1 },
    );
    expect(errors.some((error) => /não inteiros/i.test(error))).toBe(true);
  });

  it('requires more rows than parameters', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['contagem', 'exposicao'],
      rows: [
        ['2', '1'],
        ['3', '1'],
      ],
      recognizedColumns: { contagem: 0, preditor: 1 },
    });
    const errors = validateDataset(dataset);
    expect(errors.some((error) => /mais observações/i.test(error))).toBe(true);
  });
});
