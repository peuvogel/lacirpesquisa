/**
 * Differential parity suite: every assertion runs the ported `statsEngine.ts`
 * and the untouched legacy `Stats` slice from `assets/js/app.js:240-533` over
 * the same inputs. Display-rounded assertions use fmtP/fmtNumber/fmtSigned (D-08).
 */
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { statsEngine } from './statsEngine';
import { loadLegacyStatsOracle } from '@/test/legacyStatsOracle';

const legacy = loadLegacyStatsOracle();

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function expectFiniteOrBothNaN(actual: number, expected: number) {
  if (Number.isNaN(expected)) {
    expect(Number.isNaN(actual)).toBe(true);
    return;
  }
  expect(actual).toBe(expected);
}

describe('statsEngine differential parity vs legacy Stats', () => {
  it('parseNumber matches legacy on pt-BR samples', () => {
    const samples = ['1.234,56', '1,5', '0,5', '1.5', '1 234,56', '', null, undefined, NaN];
    samples.forEach((sample) => {
      expect(statsEngine.parseNumber(sample)).toEqual(legacy.parseNumber(sample));
    });
  });

  it('mean/variance/sd match legacy', () => {
    const arr = [4.8, 5.1, 4.9, 5.0, 4.7, 5.2, 4.6];
    expect(statsEngine.mean(arr)).toBe(legacy.mean(arr));
    expect(statsEngine.variance(arr)).toBe(legacy.variance(arr));
    expect(statsEngine.sd(arr)).toBe(legacy.sd(arr));
  });

  it('tcdf/tInv/fisherCI match legacy', () => {
    const tValues = [0, 1.5, -2.3, 3.8];
    const dfs = [2, 5, 12, 30];
    tValues.forEach((t) => {
      dfs.forEach((df) => {
        displayParity(statsEngine.tcdf(t, df), legacy.tcdf(t, df), fmtNumber);
      });
    });

    [0.025, 0.05, 0.5, 0.95, 0.975].forEach((p) => {
      displayParity(statsEngine.tInv(p, 10), legacy.tInv(p, 10), fmtNumber);
    });

    const ci = statsEngine.fisherCI(0.72, 20);
    const legacyCi = legacy.fisherCI(0.72, 20);
    displayParity(ci[0], legacyCi[0], fmtNumber);
    displayParity(ci[1], legacyCi[1], fmtNumber);
  });

  it('welchT matches legacy with display-rounded p and diff', () => {
    const groupA = [4.8, 5.1, 4.9, 5.0, 4.7, 5.2, 4.6];
    const groupB = [6.1, 5.8, 6.0, 5.9, 6.2, 5.7, 6.3];
    const result = statsEngine.welchT(groupA, groupB);
    const expected = legacy.welchT(groupA, groupB);

    expect(result.n1).toBe(expected.n1);
    expect(result.n2).toBe(expected.n2);
    displayParity(result.m1, expected.m1, (v) => fmtNumber(v, 3));
    displayParity(result.m2, expected.m2, (v) => fmtNumber(v, 3));
    displayParity(result.t, expected.t, (v) => fmtNumber(v, 3));
    displayParity(result.df, expected.df, (v) => fmtNumber(v, 3));
    displayParity(result.p, expected.p, fmtP);
    displayParity(result.diff, expected.diff, (v) => fmtSigned(v, 3));
    displayParity(result.d, expected.d, (v) => fmtNumber(v, 3));
    displayParity(result.ci[0], expected.ci[0], (v) => fmtSigned(v, 3));
    displayParity(result.ci[1], expected.ci[1], (v) => fmtSigned(v, 3));
  });

  it('pearson/spearman match legacy with display-rounded outputs', () => {
    const x = [12.3, 14.1, 10.9, 15.2, 11.8, 13.5];
    const y = [45.2, 43.8, 48.0, 42.7, 46.1, 44.5];

    const pearson = statsEngine.pearson(x, y);
    const legacyPearson = legacy.pearson(x, y);
    displayParity(pearson.coef, legacyPearson.coef, (v) => fmtNumber(v, 4));
    displayParity(pearson.p, legacyPearson.p, fmtP);
    displayParity(pearson.slope, legacyPearson.slope, (v) => fmtNumber(v, 4));
    displayParity(pearson.intercept, legacyPearson.intercept, (v) => fmtNumber(v, 4));

    const spearman = statsEngine.spearman(x, y);
    const legacySpearman = legacy.spearman(x, y);
    displayParity(spearman.coef, legacySpearman.coef, (v) => fmtNumber(v, 4));
    displayParity(spearman.p, legacySpearman.p, fmtP);
  });

  it('rank matches legacy including tied values', () => {
    const tied = [10, 20, 20, 30, 40];
    expect(statsEngine.rank(tied)).toEqual(legacy.rank(tied));
  });

  it('praisWinsten matches legacy on example series', () => {
    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const values = [120.4, 125.8, 130.2, 134.9, 138.1, 142.7, 145.5, 149.2, 153.6, 157.1];
    const result = statsEngine.praisWinsten(years, values);
    const expected = legacy.praisWinsten(years, values);

    expect(result.n).toBe(expected.n);
    expect(result.classification).toBe(expected.classification);
    displayParity(result.rho, expected.rho, (v) => fmtNumber(v, 4));
    displayParity(result.beta, expected.beta, (v) => fmtNumber(v, 6));
    displayParity(result.p, expected.p, fmtP);
    displayParity(result.apc, expected.apc, (v) => fmtNumber(v, 3));
    displayParity(result.ciApc[0], expected.ciApc[0], (v) => fmtSigned(v, 3));
    displayParity(result.ciApc[1], expected.ciApc[1], (v) => fmtSigned(v, 3));
  });

  describe('edge cases', () => {
    it('handles n=2 arrays', () => {
      const a = [1, 2];
      const b = [3, 4];
      const welch = statsEngine.welchT(a, b);
      const legacyWelch = legacy.welchT(a, b);
      displayParity(welch.p, legacyWelch.p, fmtP);
      expect(Number.isFinite(welch.t)).toBe(Number.isFinite(legacyWelch.t));
    });

    it('handles constant arrays without throwing', () => {
      const constant = [5, 5, 5, 5];
      expect(() => statsEngine.welchT(constant, [6, 7, 8, 9])).not.toThrow();
      expect(() => legacy.welchT(constant, [6, 7, 8, 9])).not.toThrow();
    });

    it('returns NaN fisherCI for invalid r', () => {
      const ci = statsEngine.fisherCI(1, 10);
      const legacyCi = legacy.fisherCI(1, 10);
      expectFiniteOrBothNaN(ci[0], legacyCi[0]);
      expectFiniteOrBothNaN(ci[1], legacyCi[1]);
    });
  });
});

describe('ensureChartAnnotationsRegistered', () => {
  it('registers idempotently', async () => {
    const { ensureChartAnnotationsRegistered } = await import('@/shared/charts/chartAnnotationSetup');
    expect(() => {
      ensureChartAnnotationsRegistered();
      ensureChartAnnotationsRegistered();
    }).not.toThrow();
  });
});
