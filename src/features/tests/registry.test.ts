import { describe, expect, it } from 'vitest';
import {
  getTestBadgeLabel,
  getTestById,
  isTestAvailable,
  TEST_REGISTRY,
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

  it('marks exactly ten entries available: demo, three Phase 2, three Wave A classical, and three Wave B GLM tests', () => {
    const available = TEST_REGISTRY.filter((entry) => entry.status === 'available');
    expect(available).toHaveLength(10);
    expect(available.map((entry) => entry.id).sort()).toEqual(
      [
        'anova-tukey',
        'binomial-negativa',
        'correlacao',
        'demo',
        'kruskal-dunn',
        'logistica',
        'poisson',
        'prais-winsten',
        'qui-quadrado',
        't-student',
      ].sort(),
    );
  });

  it('has no em-breve entries remaining', () => {
    const emBreve = TEST_REGISTRY.filter((entry) => entry.status === 'em-breve');
    expect(emBreve).toHaveLength(0);
  });

  it('keeps demo in the Demonstração group', () => {
    expect(getTestById('demo')?.group).toBe('Demonstração');
  });

  it('covers the demo plus all nine roadmap tests', () => {
    expect(TEST_REGISTRY).toHaveLength(10);
  });
});

describe('getTestById', () => {
  it('resolves a known id', () => {
    expect(getTestById('demo')?.title).toBe('Teste demo');
  });

  it('returns undefined for an unknown id', () => {
    expect(getTestById('nope')).toBeUndefined();
  });
});

describe('isTestAvailable', () => {
  it('is true for demo, Phase 2 migrated tests, and all Phase 3 tests', () => {
    expect(isTestAvailable('demo')).toBe(true);
    expect(isTestAvailable('t-student')).toBe(true);
    expect(isTestAvailable('correlacao')).toBe(true);
    expect(isTestAvailable('prais-winsten')).toBe(true);
    expect(isTestAvailable('qui-quadrado')).toBe(true);
    expect(isTestAvailable('anova-tukey')).toBe(true);
    expect(isTestAvailable('kruskal-dunn')).toBe(true);
    expect(isTestAvailable('poisson')).toBe(true);
    expect(isTestAvailable('binomial-negativa')).toBe(true);
    expect(isTestAvailable('logistica')).toBe(true);
  });

  it('is false for an unknown id', () => {
    expect(isTestAvailable('nope')).toBe(false);
  });
});

describe('getTestBadgeLabel', () => {
  it('labels demo as Demonstração', () => {
    const demo = getTestById('demo');
    expect(demo).toBeDefined();
    expect(getTestBadgeLabel(demo!)).toBe('Demonstração');
  });

  it('labels available migrated tests as Disponível', () => {
    const tStudent = getTestById('t-student');
    expect(tStudent).toBeDefined();
    expect(getTestBadgeLabel(tStudent!)).toBe('Disponível');
  });

  it('labels Wave A available tests as Disponível', () => {
    const anova = getTestById('anova-tukey');
    expect(anova).toBeDefined();
    expect(getTestBadgeLabel(anova!)).toBe('Disponível');
  });

  it('labels Wave B GLM available tests as Disponível', () => {
    const poisson = getTestById('poisson');
    expect(poisson).toBeDefined();
    expect(getTestBadgeLabel(poisson!)).toBe('Disponível');
  });
});
