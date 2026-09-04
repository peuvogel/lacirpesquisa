import { describe, expect, it } from 'vitest';
import { METRIC_HELP_KEYS, metricHelp } from './metricHelp';

describe('metricHelp', () => {
  it('covers every key with a title, a definition and an example', () => {
    expect(METRIC_HELP_KEYS.length).toBeGreaterThan(30);

    for (const key of METRIC_HELP_KEYS) {
      const entry = metricHelp(key);
      expect(entry.title.trim(), key).not.toBe('');
      expect(entry.what.trim().length, key).toBeGreaterThan(30);
      expect(entry.example.trim().length, key).toBeGreaterThan(30);
    }
  });

  it('keeps every example concrete, with a number in it', () => {
    // Um exemplo sem número volta a ser definição — que é justamente o que o
    // verbete já disse na linha de cima.
    for (const key of METRIC_HELP_KEYS) {
      expect(metricHelp(key).example, key).toMatch(/\d/);
    }
  });

  it('never repeats the same wording between two keys', () => {
    const whats = METRIC_HELP_KEYS.map((key) => metricHelp(key).what);
    const examples = METRIC_HELP_KEYS.map((key) => metricHelp(key).example);

    expect(new Set(whats).size).toBe(whats.length);
    expect(new Set(examples).size).toBe(examples.length);
  });
});
