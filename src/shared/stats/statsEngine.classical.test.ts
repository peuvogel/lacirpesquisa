import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import {
  dunnPostHoc,
  kruskalWallis,
  oneWayAnova,
  runChiSquareIndependence,
  tukeyHsd,
  type PairwiseRow,
} from './statsEngine';

const fixtureDir = join(__dirname, '../../test/fixtures/jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtureDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function expectPairwiseParity(actual: PairwiseRow, expected: PairwiseRow) {
  expect(actual.contrast).toBe(expected.contrast);
  displayParity(actual.pAdj, expected.pAdj, fmtP);
  displayParity(actual.statistic, expected.statistic, (v) => fmtNumber(v, 3));
  if (expected.meanDiff !== undefined && actual.meanDiff !== undefined) {
    displayParity(actual.meanDiff, expected.meanDiff, (v) => fmtNumber(v, 2));
  }
}

describe('Phase 3 classical statsEngine golden parity', () => {
  it('matches χ² golden at display precision', () => {
    const golden = readGolden<{
      input: { table: number[][] };
      expected: {
        chi2: number;
        df: number;
        p: number;
        cramersV: number;
        cellsBelow5: number;
        pctBelow5: number;
      };
    }>('qui-quadrado-exemplo.golden.json');

    const result = runChiSquareIndependence(golden.input.table);
    displayParity(result.chi2, golden.expected.chi2, (v) => fmtNumber(v, 3));
    expect(result.df).toBe(golden.expected.df);
    displayParity(result.p, golden.expected.p, fmtP);
    displayParity(result.cramersV, golden.expected.cramersV, (v) => fmtNumber(v, 3));
    expect(result.cellsBelow5).toBe(golden.expected.cellsBelow5);
    displayParity(result.pctBelow5, golden.expected.pctBelow5, (v) => fmtNumber(v, 1));
    expect(Number.isFinite(result.chi2)).toBe(true);
  });

  it('rejects contingency tables above 20×20 (DoS guard)', () => {
    const wide = Array.from({ length: 21 }, () => Array.from({ length: 2 }, () => 1));
    expect(() => runChiSquareIndependence(wide)).toThrow(/20×20/);
  });

  it('matches one-way ANOVA + Tukey golden at display precision', () => {
    const golden = readGolden<{
      input: { groups: Record<string, number[]> };
      expected: {
        f: number;
        dfBetween: number;
        dfWithin: number;
        p: number;
        eta2: number;
        tukeyFirst: PairwiseRow;
      };
    }>('anova-tukey-exemplo.golden.json');

    const anova = oneWayAnova(golden.input.groups);
    displayParity(anova.f, golden.expected.f, (v) => fmtNumber(v, 3));
    expect(anova.dfBetween).toBe(golden.expected.dfBetween);
    expect(anova.dfWithin).toBe(golden.expected.dfWithin);
    displayParity(anova.p, golden.expected.p, fmtP);
    displayParity(anova.eta2, golden.expected.eta2, (v) => fmtNumber(v, 3));

    const tukey = tukeyHsd(golden.input.groups);
    expectPairwiseParity(tukey[0], golden.expected.tukeyFirst);
  });

  it('matches Kruskal-Wallis + Dunn golden at display precision', () => {
    const golden = readGolden<{
      input: { groups: Record<string, number[]> };
      expected: {
        h: number;
        df: number;
        p: number;
        dunnFirst: PairwiseRow;
      };
    }>('kruskal-dunn-exemplo.golden.json');

    const kruskal = kruskalWallis(golden.input.groups);
    displayParity(kruskal.h, golden.expected.h, (v) => fmtNumber(v, 3));
    expect(kruskal.df).toBe(golden.expected.df);
    displayParity(kruskal.p, golden.expected.p, fmtP);

    const dunn = dunnPostHoc(golden.input.groups);
    expectPairwiseParity(dunn[0], golden.expected.dunnFirst);
  });
});
