import { describe, expect, it } from 'vitest';
import { DEMO_DATASET } from './demoData';
import { buildDemoInterpretation, summarizeGroups } from './demoStats';

function handMean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function handSampleSd(values: number[]): number {
  const mean = handMean(values);
  const sumSq = values.reduce((acc, value) => acc + (value - mean) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

describe('summarizeGroups', () => {
  it('returns two summaries with correct n, means, and sample sd on the demo fixture', () => {
    const summaries = summarizeGroups(DEMO_DATASET.rows, 0, 1);

    expect(summaries).toHaveLength(2);

    const groupA = summaries.find((summary) => summary.label === 'Grupo A');
    const groupB = summaries.find((summary) => summary.label === 'Grupo B');

    const valuesA = [5.2, 6.1, 4.8, 7.3, 5.9, 6.5, 4.2, 8.1, 5.5, 6.8, 7.0, 5.1];
    const valuesB = [4.1, 3.8, 5.0, 4.5, 3.2, 4.9, 5.5, 3.6, 4.3, 5.2, 4.0, 3.9];

    expect(groupA).toMatchObject({ n: 12, mean: handMean(valuesA) });
    expect(groupA?.sd).toBeCloseTo(handSampleSd(valuesA), 10);

    expect(groupB).toMatchObject({ n: 12, mean: handMean(valuesB) });
    expect(groupB?.sd).toBeCloseTo(handSampleSd(valuesB), 10);
  });

  it('excludes unparseable values from n rather than treating them as zero', () => {
    const rows = [
      ['Alpha', '1,5'],
      ['Alpha', 'xyz'],
      ['Alpha', '2,0'],
      ['Alpha', ''],
    ];
    const summaries = summarizeGroups(rows, 0, 1);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].n).toBe(2);
    expect(summaries[0].mean).toBeCloseTo(1.75, 10);
  });

  it('yields one summary when the group column has a single category', () => {
    const rows = [
      ['Único', '3,0'],
      ['Único', '4,0'],
    ];
    const summaries = summarizeGroups(rows, 0, 1);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].label).toBe('Único');
  });
});

describe('buildDemoInterpretation', () => {
  it('returns non-empty paragraphs naming both groups without inferential claims', () => {
    const summaries = summarizeGroups(DEMO_DATASET.rows, 0, 1);
    const paragraphs = buildDemoInterpretation(summaries);

    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    const joined = paragraphs.join(' ');
    expect(joined).toContain('Grupo A');
    expect(joined).toContain('Grupo B');
    expect(joined).not.toMatch(/p\s*=/i);
    expect(joined).not.toMatch(/p-valor/i);
    expect(joined).not.toMatch(/IC/);
  });
});
