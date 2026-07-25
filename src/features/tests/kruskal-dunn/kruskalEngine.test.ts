import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './kruskalConfig';
import {
  buildDatasetFromConfirmed,
  computeAssumptionNudges,
  runAnalysis,
  validateDataset,
} from './kruskalEngine';

const fixtureDir = join(__dirname, '../../../test/fixtures');
const goldenDir = join(fixtureDir, 'jasp');

function readGolden<T>(name: string): T {
  return JSON.parse(readFileSync(join(goldenDir, name), 'utf8')) as T;
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function loadExampleDataset() {
  const text = readFileSync(join(fixtureDir, 'tests/kruskal-dunn-exemplo.txt'), 'utf8');
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

describe('kruskalEngine golden parity', () => {
  it('matches omnibus H, df and p at display precision', () => {
    const golden = readGolden<{
      expected: {
        h: number;
        df: number;
        p: number;
      };
    }>('kruskal-dunn-exemplo.golden.json');

    const dataset = loadExampleDataset();
    const result = runAnalysis(dataset);

    displayParity(result.h, golden.expected.h, (v) => fmtNumber(v, 3));
    expect(result.df).toBe(golden.expected.df);
    displayParity(result.p, golden.expected.p, fmtP);
  });

  it('matches Dunn Holm pAdj for golden contrast at display precision', () => {
    const golden = readGolden<{
      expected: {
        dunnFirst: {
          contrast: string;
          statistic: number;
          pAdj: number;
        };
      };
    }>('kruskal-dunn-exemplo.golden.json');

    const dataset = loadExampleDataset();
    const result = runAnalysis(dataset);

    expect(result.pairwise.length).toBeGreaterThan(0);
    const match = result.pairwise.find((row) => row.contrast === golden.expected.dunnFirst.contrast);
    expect(match).toBeDefined();
    displayParity(match!.pAdj, golden.expected.dunnFirst.pAdj, fmtP);
    displayParity(match!.statistic, golden.expected.dunnFirst.statistic, (v) => fmtNumber(v, 3));
  });

  it('sorts pairwise rows by pAdj ascending', () => {
    const dataset = loadExampleDataset();
    const result = runAnalysis(dataset);
    const sorted = [...result.pairwise].sort((a, b) => a.pAdj - b.pAdj);
    expect(result.pairwise.map((row) => row.contrast)).toEqual(sorted.map((row) => row.contrast));
  });
});

describe('kruskalEngine assumption nudges', () => {
  it('always includes rank-alternative info nudge (D-06)', () => {
    const groups = { A: [10, 11, 12], B: [20, 21, 22], C: [30, 31, 32] };
    const dataset = {
      groups,
      groupOrder: ['A', 'B', 'C'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);

    const rankInfo = nudges.find(
      (n) => n.severity === 'info' && /postos|ranks|não paramétrica/i.test(n.message),
    );
    expect(rankInfo).toBeDefined();
  });

  it('shows Mann-Whitney info nudge for k=2 groups', () => {
    const groups = { A: [10, 11, 12, 13], B: [20, 21, 22, 23] };
    const dataset = {
      groups,
      groupOrder: ['A', 'B'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);

    const mannWhitney = nudges.find(
      (n) => n.severity === 'info' && /Mann-Whitney|Wilcoxon/i.test(n.message),
    );
    expect(mannWhitney).toBeDefined();
  });

  it('shows post-hoc tip for k=2 (single contrast)', () => {
    const groups = { A: [10, 11, 12], B: [20, 21, 22] };
    const dataset = {
      groups,
      groupOrder: ['A', 'B'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    const result = runAnalysis(dataset);
    const nudges = computeAssumptionNudges(result, dataset);

    const postHocTip = nudges.find((n) => /contraste par a par|única comparação/i.test(n.message));
    expect(postHocTip).toBeDefined();
  });
});

describe('kruskalEngine validation', () => {
  it('rejects fewer than two groups', () => {
    const dataset = {
      groups: { A: [1, 2, 3] },
      groupOrder: ['A'],
      headers: { outcome: 'desfecho', group: 'grupo' },
    };
    expect(validateDataset(dataset).some((msg) => /Ao menos dois grupos/i.test(msg))).toBe(true);
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
