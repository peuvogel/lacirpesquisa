import { describe, expect, it } from 'vitest';
import { TEAL_STEPS, createChoroplethScale, legendBreaks } from './choroplethScale';

describe('choroplethScale', () => {
  it('maps domain min/max to teal steps', () => {
    const scale = createChoroplethScale([10, 50, 100]);
    const minColor = scale(10);
    const maxColor = scale(100);
    expect(TEAL_STEPS).toContain(minColor);
    expect(TEAL_STEPS).toContain(maxColor);
    expect(minColor).not.toBe('#9333ea');
  });

  it('uses middle teal for flat values', () => {
    const scale = createChoroplethScale([42, 42, 42]);
    expect(scale(42)).toBe(TEAL_STEPS[2]);
  });

  it('legendBreaks returns buckets with teal colors', () => {
    const breaks = legendBreaks([0, 25, 50, 75, 100]);
    expect(breaks.length).toBe(TEAL_STEPS.length);
    breaks.forEach((b) => {
      expect(TEAL_STEPS).toContain(b.color);
    });
  });

  it('handles empty values gracefully', () => {
    const scale = createChoroplethScale([]);
    expect(scale(0)).toBe(TEAL_STEPS[0]);
    expect(legendBreaks([])).toEqual([]);
  });
});
