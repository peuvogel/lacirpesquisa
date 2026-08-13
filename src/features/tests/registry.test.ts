import { describe, expect, it } from 'vitest';
import {
  getTestBadgeLabel,
  getTestById,
  isTestAvailable,
  TEST_REGISTRY,
  type TestStatus,
} from './registry';

describe('TEST_REGISTRY', () => {
  it('has unique ids', () => {
    const ids = TEST_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty title, subtitle, and group', () => {
    for (const entry of TEST_REGISTRY) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.subtitle.length).toBeGreaterThan(0);
      expect(entry.group.length).toBeGreaterThan(0);
    }
  });

  it('marks ten roadmap tests available, including Mann–Whitney', () => {
    const available = TEST_REGISTRY.filter((entry) => entry.status === 'available');
    expect(available).toHaveLength(10);
    expect(available.map((entry) => entry.id).sort()).toEqual(
      [
        'anova-tukey',
        'binomial-negativa',
        'correlacao',
        'kruskal-dunn',
        'logistica',
        'mann-whitney',
        'poisson',
        'prais-winsten',
        'qui-quadrado',
        't-student',
      ].sort(),
    );
  });

  it('has no em-breve entries remaining', () => {
    // `TEST_REGISTRY` is now `as const satisfies` (Task 1) — every current
    // entry's `status` narrows to the literal `'available'`, so comparing
    // directly to `'em-breve'` is a compile error (TS2367: no overlap).
    // Widen back to `TestStatus` to keep this guard meaningful if a future
    // entry is ever added with `status: 'em-breve'`.
    const emBreve = TEST_REGISTRY.filter((entry) => (entry.status as TestStatus) === 'em-breve');
    expect(emBreve).toHaveLength(0);
  });

  it('does not include the removed demo entry', () => {
    expect(getTestById('demo')).toBeUndefined();
    expect(TEST_REGISTRY).toHaveLength(10);
  });
});

describe('getTestById', () => {
  it('resolves a known id', () => {
    expect(getTestById('t-student')?.title).toBe('t de Student');
  });

  it('returns undefined for an unknown id', () => {
    expect(getTestById('nope')).toBeUndefined();
  });
});

describe('isTestAvailable', () => {
  it('is true for migrated roadmap tests', () => {
    expect(isTestAvailable('t-student')).toBe(true);
    expect(isTestAvailable('correlacao')).toBe(true);
    expect(isTestAvailable('prais-winsten')).toBe(true);
    expect(isTestAvailable('qui-quadrado')).toBe(true);
    expect(isTestAvailable('anova-tukey')).toBe(true);
    expect(isTestAvailable('kruskal-dunn')).toBe(true);
    expect(isTestAvailable('poisson')).toBe(true);
    expect(isTestAvailable('binomial-negativa')).toBe(true);
    expect(isTestAvailable('logistica')).toBe(true);
    expect(isTestAvailable('mann-whitney')).toBe(true);
  });

  it('is false for demo and unknown ids', () => {
    expect(isTestAvailable('demo')).toBe(false);
    expect(isTestAvailable('nope')).toBe(false);
  });
});

describe('getTestBadgeLabel', () => {
  it('labels available tests as Disponível', () => {
    const tStudent = getTestById('t-student');
    expect(tStudent).toBeDefined();
    expect(getTestBadgeLabel(tStudent!)).toBe('Disponível');
  });
});
