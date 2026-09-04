import { describe, expect, it } from 'vitest';
import {
  alphaToPercent,
  formatAlphaPercent,
  parseAlpha,
  percentToAlpha,
} from './alpha';

describe('alpha decimal contract', () => {
  it.each([
    [0.001, '0,1%'],
    [0.01, '1%'],
    [0.05, '5%'],
    [0.1, '10%'],
  ] as const)('round-trips alpha %s as %s', (decimal, label) => {
    const alpha = parseAlpha(decimal);

    expect(formatAlphaPercent(alpha)).toBe(label);
    expect(percentToAlpha(alphaToPercent(alpha))).toBe(decimal);
  });

  it('rejects values outside the closed decimal range', () => {
    const fallback = parseAlpha(0.05);

    expect(parseAlpha(0.0009, fallback)).toBe(fallback);
    expect(parseAlpha(0.1001, fallback)).toBe(fallback);
  });
});
