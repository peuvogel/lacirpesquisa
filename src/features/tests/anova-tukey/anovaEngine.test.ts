import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './anovaConfig';
import {
  buildDatasetFromConfirmed,
  computeAssumptionNudges,
  runAnalysis,
  validateDataset,
} from './anovaEngine';

const fixtureDir = join(__dirname, '../../../test/fixtures');
const goldenDir = join(fixtureDir, 'jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(goldenDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function loadExampleDataset() {
  const text = readFileSync(join(fixtureDir, 'tests/anova-tukey-exemplo.txt'), 'utf8');
  const parsed = readTabularPasteState(text, legacyStats, TABULAR_OPTIONS);
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

describe('anovaEngine golden parity', () => {
  it('matches omnibus F, df, p and η² at display precision', () => {
    const golden = readGolden<{
      expected: {
        f: number;
        dfBetween: number;
        dfWithin: number;
        p: number;
        eta2: number;
      };
    }>('anova-tukey-exemplo.golden.json');

    const dataset = loadExampleDataset();
    const result = runAnalysis(dataset);

    displayParity(result.f, golden.expected.f, (v) => fmtNumber(v, 3));
    expect(result.dfBetween).toBe(golden.expected.dfBetween);
    expect(result.dfWithin).toBe(golden.expected.dfWithin);
    displayParity(result.p, golden.expected.p, fmtP);
    displayParity(result.eta2, golden.expected.eta2, (v) => fmtNumber(v, 3));
  });

  it('matches Tukey pAdj for first pairwise contrast at display precision', () => {
    const golden = readGolden<{
      expected: {
        tukeyFirst: {
          contrast: string;
          statistic: number;
          pAdj: number;
        };
      };
    }>('anova-tukey-exemplo.golden.json');

    const dataset = loadExampleDataset();
    const result = runAnalysis(dataset);

    expect(result.pairwise.length).toBeGreaterThan(0);
    const match = result.pairwise.find((row) => row.contrast === golden.expected.tukeyFirst.contrast);
    expect(match).toBeDefined();
    displayParity(match!.pAdj, golden.expected.tukeyFirst.pAdj, fmtP);
    displayParity(match!.statistic, golden.expected.tukeyFirst.statistic, (v) => fmtNumber(v, 3));
    expect(result.pairwise[0].pAdj).toBeLessThanOrEqual(result.pairwise[1]?.pAdj ?? Infinity);
  });

  it('sorts pairwise rows by pAdj ascending', () => {
    const dataset = loadExampleDataset();
    const result = runAnalysis(dataset);
    const sorted = [...result.pairwise].sort((a, b) => a.pAdj - b.pAdj);
    expect(result.pairwise.map((row) => row.contrast)).toEqual(sorted.map((row) => row.contrast));
  });
});

describe('anovaEngine assumption nudges', () => {
  it('warns with Kruskal CTA when group size ratio exceeds 3', () => {
    const groups = {
      A: [1, 2, 3],
      B: [4, 5],
      C: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    };
    const dataset = {
      groups,
      groupOrder: ['A', 'B', 'C'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);

    const warning = nudges.find((n) => n.severity === 'warning' && n.cta?.testId === 'kruskal-dunn');
    expect(warning).toBeDefined();
    expect(warning?.cta?.label).toMatch(/kruskal/i);
  });

  it('shows info nudge for k=2 groups suggesting t-Student', () => {
    const groups = { A: [10, 11, 12, 13], B: [20, 21, 22, 23] };
    const dataset = {
      groups,
      groupOrder: ['A', 'B'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);

    const info = nudges.find(
      (n) => n.severity === 'info' && /t de Student|t-Student/i.test(n.message),
    );
    expect(info).toBeDefined();
  });
});

describe('anovaEngine validation', () => {
  it.each(['constructor', 'toString', '__proto__'])('keeps the arbitrary group label %s through summaries', (reservedLabel) => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['desfecho', 'grupo'],
      rows: [['1', reservedLabel], ['2', reservedLabel], ['3', 'B'], ['4', 'B']],
      recognizedColumns: { desfecho: 0, grupo: 1 },
    });

    expect(dataset.groupOrder).toEqual([reservedLabel, 'B']);
    expect(dataset.groups[reservedLabel]).toEqual([1, 2]);
    expect(runAnalysis(dataset).groupStats[reservedLabel]).toMatchObject({ n: 2, mean: 1.5 });
  });

  it('rejects fewer than two groups', () => {
    const dataset = {
      groups: { A: [1, 2, 3] },
      groupOrder: ['A'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    expect(validateDataset(dataset).some((msg) => /Ao menos dois grupos/i.test(msg))).toBe(true);
  });

  it('rejects groups with fewer than two observations for Tukey', () => {
    const dataset = {
      groups: { A: [1], B: [2, 3], C: [4, 5] },
      groupOrder: ['A', 'B', 'C'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    expect(validateDataset(dataset).some((msg) => /Tukey|observa/i.test(msg))).toBe(true);
  });

  it('rejects more than 20 groups (DoS guard)', () => {
    const groups: Record<string, number[]> = {};
    const groupOrder: string[] = [];
    for (let index = 0; index < 21; index += 1) {
      const label = `G${index}`;
      groups[label] = [index, index + 1];
      groupOrder.push(label);
    }
    const dataset = { groups, groupOrder, headers: { outcome: 'desfecho', group: 'grupo' } };
    expect(validateDataset(dataset).some((msg) => /20 grupos/i.test(msg))).toBe(true);
  });
});
