import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDatasetFromPrepared,
  buildDatasetFromConfirmed,
  runAnalysis,
  runMannWhitney,
  validateDataset,
  validateDatasetIssues,
} from './mannWhitneyEngine';
import type { PreparedGroupedSamples } from '@/shared/data-input/groupedSamples';

interface GoldenCase {
  input: { groupA: number[]; groupB: number[] };
  requestedExact: boolean;
  expected: {
    u1: number;
    u2: number;
    u: number;
    p: number;
    probabilityOfSuperiority: number;
    rankBiserial: number;
  };
}

const golden = JSON.parse(readFileSync(
  join(__dirname, '../../../test/fixtures/jasp/mann-whitney-exemplo.golden.json'),
  'utf8',
)) as { cases: Record<string, GoldenCase> };

describe('runMannWhitney golden parity', () => {
  it.each(['exact_small', 'shifted_exact'])('matches R exact case %s', (caseName) => {
    const fixture = golden.cases[caseName]!;
    const result = runMannWhitney(fixture.input.groupA, fixture.input.groupB, { method: 'exact' });

    expect(result.method).toBe('exact');
    expect(result.u1).toBeCloseTo(fixture.expected.u1, 12);
    expect(result.u2).toBeCloseTo(fixture.expected.u2, 12);
    expect(result.u).toBeCloseTo(fixture.expected.u, 12);
    expect(result.pValue).toBeCloseTo(fixture.expected.p, 12);
    expect(result.probabilityOfSuperiority).toBeCloseTo(fixture.expected.probabilityOfSuperiority, 12);
    expect(result.rankBiserial).toBeCloseTo(fixture.expected.rankBiserial, 12);
  });

  it('matches R asymptotic tie correction and exposes midranks', () => {
    const fixture = golden.cases.ties_asymptotic!;
    const result = runMannWhitney(fixture.input.groupA, fixture.input.groupB, {
      method: 'asymptotic',
      continuityCorrection: true,
    });

    expect(result.method).toBe('asymptotic');
    expect(result.pValue).toBeCloseTo(fixture.expected.p, 12);
    expect(result.u1).toBe(fixture.expected.u1);
    expect(result.tieDiagnostics).toMatchObject({ hasTies: true, tieGroupSizes: [3, 2, 2] });
    expect(result.rankedValues.filter((item) => item.value === 2).map((item) => item.rank))
      .toEqual([3, 3, 3]);
  });

  it('falls back from exact when ties are present and from auto when samples are too large', () => {
    const tied = runMannWhitney([1, 2, 2], [2, 3, 4], { method: 'exact' });
    expect(tied).toMatchObject({ method: 'asymptotic', fallbackReason: 'ties' });

    const large = runMannWhitney(
      Array.from({ length: 15 }, (_, index) => index),
      Array.from({ length: 15 }, (_, index) => index + 20),
    );
    expect(large).toMatchObject({ method: 'asymptotic', fallbackReason: 'sample_too_large' });
  });

  it('keeps effect direction as group A superiority and handles all ties deterministically', () => {
    const shifted = runMannWhitney([10, 11, 12], [1, 2, 3], { method: 'exact' });
    expect(shifted.probabilityOfSuperiority).toBe(1);
    expect(shifted.rankBiserial).toBe(1);

    const allTied = runMannWhitney([5, 5, 5], [5, 5, 5]);
    expect(allTied).toMatchObject({ pValue: 1, rankBiserial: 0, probabilityOfSuperiority: 0.5 });
  });
});

describe('Mann–Whitney dataset contract', () => {
  it.each(['constructor', 'toString', '__proto__'])('keeps the arbitrary long-format label %s', (reservedLabel) => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['desfecho', 'grupo'],
      rows: [['1', reservedLabel], ['2', reservedLabel], ['3', reservedLabel], ['4', 'B'], ['5', 'B'], ['6', 'B']],
      recognizedColumns: { desfecho: 0, grupo: 1 },
    });

    expect(dataset.groupOrder).toEqual([reservedLabel, 'B']);
    expect(dataset.groupA).toEqual([1, 2, 3]);
  });

  it('builds exactly two long-format groups and validates replication/variation', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['valor', 'grupo'],
      rows: [['1', 'A'], ['2', 'A'], ['3', 'A'], ['7', 'B'], ['8', 'B'], ['9', 'B']],
      recognizedColumns: { desfecho: 0, grupo: 1 },
    });

    expect(dataset).toMatchObject({ labels: ['A', 'B'], groupA: [1, 2, 3], groupB: [7, 8, 9] });
    expect(validateDataset(dataset)).toEqual([]);
    expect(runAnalysis(dataset).method).toBe('exact');
  });

  it('rejects fewer/more than two groups, fewer than three observations and no variation', () => {
    expect(validateDataset({ groupA: [1], groupB: [], labels: ['A', 'B'], headers: { outcome: 'valor', group: 'grupo' } }))
      .toContainEqual(expect.stringMatching(/exatamente dois grupos/i));
    expect(validateDataset({ groupA: [1, 2], groupB: [3, 4], labels: ['A', 'B'], headers: { outcome: 'valor', group: 'grupo' } }))
      .toContainEqual(expect.stringMatching(/pelo menos 3/i));
    expect(validateDataset({ groupA: [5, 5, 5], groupB: [5, 5, 5], labels: ['A', 'B'], headers: { outcome: 'valor', group: 'grupo' } }))
      .toContainEqual(expect.stringMatching(/variação/i));
  });

  it('builds a wide dataset from two explicit columns', () => {
    const prepared: PreparedGroupedSamples = {
      format: 'wide',
      groups: [
        { label: 'Antes', values: [1, 2, 3], columnId: 'a' },
        { label: 'Depois', values: [7, 8, 9], columnId: 'b' },
      ],
      invalidRowCount: 0,
      invalidRowNumbers: [],
      issues: [],
    };

    const dataset = buildDatasetFromPrepared(prepared, { outcome: 'Valores', group: 'colunas separadas' });

    expect(dataset).toMatchObject({ labels: ['Antes', 'Depois'], groupA: [1, 2, 3], groupB: [7, 8, 9] });
    expect(validateDatasetIssues(dataset)).toEqual([]);
  });

  it('keeps structured issue codes and all discovered long groups', () => {
    const prepared: PreparedGroupedSamples = {
      format: 'long',
      groups: [
        { label: 'A', values: [1, 2, 3] },
        { label: 'B', values: [4, 5, 6] },
        { label: 'C', values: [7, 8, 9] },
      ],
      invalidRowCount: 0,
      invalidRowNumbers: [],
      issues: [{ code: 'group_count', severity: 'error', message: 'Foram encontrados 3 grupos (A, B, C).' }],
    };

    const dataset = buildDatasetFromPrepared(prepared, { outcome: 'Valor', group: 'Grupo' });

    expect(dataset.groupOrder).toEqual(['A', 'B', 'C']);
    expect(validateDatasetIssues(dataset)).toContainEqual(expect.objectContaining({ code: 'group_count' }));
  });

  it('returns distinct issue codes for too few observations and all ties', () => {
    const issues = validateDatasetIssues({
      groupA: [5, 5],
      groupB: [5, 5],
      labels: ['A', 'B'],
      groupOrder: ['A', 'B'],
      headers: { outcome: 'valor', group: 'grupo' },
    });

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['group_too_small', 'all_values_tied']));
  });
});
