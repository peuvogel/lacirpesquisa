import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP, fmtSigned } from './format';

describe('fmtNumber', () => {
  it('formats with pt-BR thousands + decimal separators', () => {
    expect(fmtNumber(1234.5678)).toBe('1.234,568');
  });

  it('returns the em-dash for non-finite input', () => {
    expect(fmtNumber(NaN)).toBe('—');
    expect(fmtNumber(undefined)).toBe('—');
  });

  it('respects a custom digits argument', () => {
    expect(fmtNumber(2, 0)).toBe('2');
  });
});

describe('fmtP', () => {
  it('returns the below-threshold string under 0.001', () => {
    expect(fmtP(0.0004)).toBe('< 0,001');
  });

  it('formats four decimal places with a decimal comma above the threshold', () => {
    expect(fmtP(0.0321)).toBe('0,0321');
  });

  it('returns the em-dash for non-finite input', () => {
    expect(fmtP(NaN)).toBe('—');
  });
});

describe('fmtSigned', () => {
  it('prefixes positive values with +', () => {
    expect(fmtSigned(1.5)).toBe('+1,500');
  });

  it('does not double-prefix negative values', () => {
    expect(fmtSigned(-1.5)).toBe('-1,500');
  });

  it('has no sign prefix for zero', () => {
    expect(fmtSigned(0)).toBe('0,000');
  });

  it('returns the em-dash for non-finite input', () => {
    expect(fmtSigned(NaN)).toBe('—');
  });
});
