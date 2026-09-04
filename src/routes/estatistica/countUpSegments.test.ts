import { describe, expect, it } from 'vitest';
import { hasAnimatableNumber, parseCountUpSegments } from './countUpSegments';

const CASES: Array<{ input: string; numbers: number[] }> = [
  { input: '4,90', numbers: [4.9] },
  { input: '0,318', numbers: [0.318] },
  { input: '1.234,568', numbers: [1234.568] },
  { input: '+1,10', numbers: [1.1] },
  { input: '-0,25', numbers: [0.25] },
  { input: '< 0,001', numbers: [0.001] },
  { input: '12', numbers: [12] },
  { input: '12,4%', numbers: [12.4] },
  { input: '-1,35 a -0,85', numbers: [1.35, 0.85] },
  { input: 'Sim', numbers: [] },
  { input: 'Pearson', numbers: [] },
  { input: 'n/d', numbers: [] },
  { input: 'Não definida', numbers: [] },
];

describe('parseCountUpSegments', () => {
  it.each(CASES)('extracts the numeric runs of "$input"', ({ input, numbers }) => {
    const segments = parseCountUpSegments(input);
    const parsed = segments
      .filter((segment) => segment.kind === 'number')
      .map((segment) => (segment.kind === 'number' ? segment.value : Number.NaN));

    expect(parsed).toEqual(numbers);
  });

  it.each(CASES)('round-trips "$input" without losing characters', ({ input }) => {
    const segments = parseCountUpSegments(input);
    expect(segments.map((segment) => segment.text).join('')).toBe(input);
  });

  it('keeps the sign and the threshold prefix as static text', () => {
    expect(parseCountUpSegments('< 0,001')[0]).toEqual({ kind: 'text', text: '< ' });
    expect(parseCountUpSegments('+1,10')[0]).toEqual({ kind: 'text', text: '+' });
  });

  it('keeps the thousands separator inside the numeric run', () => {
    expect(parseCountUpSegments('1.234,568')).toEqual([
      { kind: 'number', text: '1.234,568', value: 1234.568 },
    ]);
  });

  it('returns a single text segment for values with no digits', () => {
    expect(parseCountUpSegments('Sim')).toEqual([{ kind: 'text', text: 'Sim' }]);
  });
});

describe('hasAnimatableNumber', () => {
  it.each(CASES)('reports "$input" correctly', ({ input, numbers }) => {
    expect(hasAnimatableNumber(parseCountUpSegments(input))).toBe(numbers.length > 0);
  });
});
