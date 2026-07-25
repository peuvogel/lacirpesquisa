import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import {
  fitLogistic,
  fitNegativeBinomial,
  fitPoisson,
  type GlmDesign,
} from './glmEngine';

const fixtureDir = join(__dirname, '../../test/fixtures/jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtureDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

describe('glmEngine golden parity', () => {
  it('poisson — matches golden at display precision', () => {
    const golden = readGolden<{
      input: { y: number[]; design: GlmDesign };
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

    const result = fitPoisson(golden.input.y, golden.input.design);
    expect(result.converged).toBe(golden.expected.converged);
    displayParity(result.coefficients[0].beta, golden.expected.interceptBeta, (v) => fmtNumber(v, 3));
    displayParity(result.coefficients[1].beta, golden.expected.slopeBeta, (v) => fmtNumber(v, 3));
    displayParity(result.coefficients[1].p, golden.expected.slopeP, fmtP);
    displayParity(result.pearsonChi2, golden.expected.pearsonChi2, (v) => fmtNumber(v, 3));
    expect(result.dfResid).toBe(golden.expected.dfResid);
    const ratio = result.dfResid > 0 ? result.pearsonChi2 / result.dfResid : NaN;
    displayParity(ratio, golden.expected.overdispersionRatio, (v) => fmtNumber(v, 3));
  });

  it('nb — matches golden at display precision', () => {
    const golden = readGolden<{
      input: { y: number[]; design: GlmDesign };
      expected: {
        interceptBeta: number;
        slopeBeta: number;
        theta: number;
        pearsonChi2: number;
        dfResid: number;
        converged: boolean;
      };
    }>('binomial-negativa-exemplo.golden.json');

    const result = fitNegativeBinomial(golden.input.y, golden.input.design);
    expect(result.converged).toBe(golden.expected.converged);
    displayParity(result.coefficients[0].beta, golden.expected.interceptBeta, (v) => fmtNumber(v, 3));
    displayParity(result.coefficients[1].beta, golden.expected.slopeBeta, (v) => fmtNumber(v, 3));
    displayParity(result.theta, golden.expected.theta, (v) => fmtNumber(v, 3));
    displayParity(result.pearsonChi2, golden.expected.pearsonChi2, (v) => fmtNumber(v, 3));
    expect(result.dfResid).toBe(golden.expected.dfResid);
  });

  it('logistic — matches golden at display precision', () => {
    const golden = readGolden<{
      input: { y: number[]; design: GlmDesign };
      expected: {
        interceptOr: number;
        idadeOr: number;
        idadeP: number;
        converged: boolean;
      };
    }>('logistica-exemplo.golden.json');

    const result = fitLogistic(golden.input.y, golden.input.design);
    expect(result.converged).toBe(golden.expected.converged);
    displayParity(result.oddsRatios[0].or, golden.expected.interceptOr, (v) => fmtNumber(v, 3));
    const dose = result.oddsRatios.find((row) => row.term === 'x');
    expect(dose).toBeDefined();
    displayParity(dose!.or, golden.expected.idadeOr, (v) => fmtNumber(v, 3));
    const doseCoef = result.coefficients.find((row) => row.term === 'x');
    expect(doseCoef).toBeDefined();
    displayParity(doseCoef!.p, golden.expected.idadeP, fmtP);
  });
});
