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

  it('legendBreaks returns 5 steps with PT labels Baixo and Alto', () => {
    const breaks = legendBreaks([10, 50, 100, 200, 500]);
    expect(breaks).toHaveLength(5);
    expect(breaks[0]?.label).toBe('Baixo');
    expect(breaks[4]?.label).toBe('Alto');
  });

  it('handles empty values gracefully', () => {
    const scale = createChoroplethScale([]);
    expect(scale(0)).toBe(TEAL_STEPS[0]);
    expect(legendBreaks([])).toEqual([]);
  });

  it('uses only positive finite values for its domain and legend ramp', () => {
    const scale = createChoroplethScale([null, 0, 5, 10, Number.NaN, Number.POSITIVE_INFINITY]);

    expect(scale.domain()).toEqual([5, 10]);
    const breaks = legendBreaks([null, 0, 5, 10, Number.NaN]);
    expect(breaks[0]?.min).toBe(5);
    expect(breaks.at(-1)?.max).toBe(10);
  });
});
