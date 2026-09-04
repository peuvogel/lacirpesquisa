import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './binomialNegativaConfig';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  computeAssumptionNudges,
  runAnalysis,
  sanitizeRecognizedColumns,
  validateColumnTypes,
  validateDataset,
} from './binomialNegativaEngine';
import { computeBinomialNegativaFittedValues } from './binomialNegativaCharts';

const fixtureDir = join(__dirname, '../../../test/fixtures');
const goldenDir = join(fixtureDir, 'jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(goldenDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function loadExemploDataset() {
  const exemploText = readFileSync(join(fixtureDir, 'tests/binomial-negativa-exemplo.txt'), 'utf8');
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

describe('binomialNegativaEngine golden parity', () => {
  it('matches JASP golden at display precision', () => {
    const golden = readGolden<{
      expected: {
        interceptBeta: number;
        slopeBeta: number;
        theta: number;
        pearsonChi2: number;
        dfResid: number;
        converged: boolean;
      };
    }>('binomial-negativa-exemplo.golden.json');

    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);

    expect(result.converged).toBe(golden.expected.converged);
    displayParity(result.coefficients[0].beta, golden.expected.interceptBeta, (v) => fmtNumber(v, 3));
    displayParity(result.coefficients[1].beta, golden.expected.slopeBeta, (v) => fmtNumber(v, 3));
    displayParity(result.theta, golden.expected.theta, (v) => fmtNumber(v, 3));
    displayParity(result.pearsonChi2, golden.expected.pearsonChi2, (v) => fmtNumber(v, 3));
    expect(result.dfResid).toBe(golden.expected.dfResid);
  });

  it('threads log(exposure) through the negative-binomial fit', () => {
    const rows = [
      ['10', '0', '100'], ['18', '0', '200'], ['35', '0', '300'],
      ['100', '1', '1000'], ['180', '1', '2000'], ['350', '1', '3000'],
    ];
    const dataset = buildDatasetFromConfirmed({
      headers: ['contagem', 'grupo', 'populacao'],
      rows,
      recognizedColumns: { contagem: 0, preditor: 1, offset_exposure: 2 },
      requireExposure: true,
    });
    const result = runAnalysis(dataset);
    const slope = result.coefficients.find((coefficient) => coefficient.term !== '(Intercept)')!;

    expect(dataset.design.offset).toHaveLength(rows.length);
    expect(Math.exp(slope.beta)).toBeCloseTo(1, 2);
    const fitted = computeBinomialNegativaFittedValues({ result, dataset, nudges: [] });
    expect(fitted[0]).toBeGreaterThan(0);
    expect(fitted[5]).toBeGreaterThan(fitted[0]);
  });

  it('builds design matrix from tabular paste', () => {
    const dataset = loadExemploDataset();
    expect(dataset.n).toBe(12);
    expect(dataset.design.terms).toEqual(['(Intercept)', 'exposicao']);
    expect(dataset.design.matrix[0]).toEqual([1, 1]);
  });
});

describe('binomialNegativaEngine assumption nudges', () => {
  it('returns info nudge about equidispersion relaxation when theta is finite', () => {
    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);
    expect(Number.isFinite(result.theta)).toBe(true);

    const nudges = computeAssumptionNudges(result, dataset);
    const info = nudges.find((nudge) => nudge.severity === 'info');
    expect(info).toBeDefined();
    expect(info?.message).toMatch(/equidispers/i);
    expect(info?.message).toContain(fmtNumber(result.theta, 3));
  });
});

describe('binomialNegativaEngine metrics', () => {
  it('includes theta on metric cards', () => {
    const dataset = loadExemploDataset();
    const result = runAnalysis(dataset);
    const metrics = buildMetrics(result, dataset);
    const thetaMetric = metrics.find((metric) => /θ|dispers/i.test(metric.label));
    expect(thetaMetric).toBeDefined();
    expect(thetaMetric?.value).toBe(fmtNumber(result.theta, 3));
  });

  it('gives every card a glossary entry, so none fica sem o "i"', () => {
    const dataset = loadExemploDataset();
    const metrics = buildMetrics(runAnalysis(dataset), dataset);
    for (const metric of metrics) {
      expect(metric.helpKey, metric.label).toBeDefined();
    }
  });
});

describe('binomialNegativaEngine validation', () => {
  it('rejects absent or non-positive exposure when territorial comparison requires it', () => {
    const missing = buildDatasetFromConfirmed({
      headers: ['contagem', 'preditor'],
      rows: [['2', '1'], ['3', '2'], ['4', '3']],
      recognizedColumns: { contagem: 0, preditor: 1 },
      requireExposure: true,
    });
    expect(validateDataset(missing)).toContainEqual(expect.stringMatching(/exposição|offset/i));

    expect(validateColumnTypes(
      ['contagem', 'preditor', 'populacao'],
      [['2', '1', '0'], ['3', '2', '-1']],
      { contagem: 0, preditor: 1, offset_exposure: 2 },
      { requireExposure: true },
    )).toContainEqual(expect.stringMatching(/positiva/i));
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

describe('sanitizeRecognizedColumns', () => {
  it('ignores out-of-range column indices from handoff', () => {
    const sanitized = sanitizeRecognizedColumns(['contagem', 'exposicao'], {
      contagem: 0,
      preditor: 1,
      invalid: 99,
    });
    expect(sanitized).toEqual({ contagem: 0, preditor: 1 });
  });
});
