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

  it('marks exactly four entries available: demo plus three Phase 2 tests', () => {
    const available = TEST_REGISTRY.filter((entry) => entry.status === 'available');
    expect(available).toHaveLength(4);
    expect(available.map((entry) => entry.id).sort()).toEqual(
      ['correlacao', 'demo', 'prais-winsten', 't-student'].sort(),
    );
  });

  it('keeps demo in the Demonstração group', () => {
    expect(getTestById('demo')?.group).toBe('Demonstração');
  });

  it('assigns every em-breve entry to phase 2 or 3', () => {
    const emBreve = TEST_REGISTRY.filter((entry) => entry.status === 'em-breve');
    expect(emBreve.length).toBeGreaterThan(0);
    for (const entry of emBreve) {
      expect([2, 3]).toContain(entry.phase);
    }
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
  it('is true for demo and the three Phase 2 migrated tests', () => {
    expect(isTestAvailable('demo')).toBe(true);
    expect(isTestAvailable('t-student')).toBe(true);
    expect(isTestAvailable('correlacao')).toBe(true);
    expect(isTestAvailable('prais-winsten')).toBe(true);
  });

  it('is false for phase 3 em-breve tests', () => {
    expect(isTestAvailable('qui-quadrado')).toBe(false);
    expect(isTestAvailable('anova-tukey')).toBe(false);
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

  it('labels em-breve tests as Em breve', () => {
    const anova = getTestById('anova-tukey');
    expect(anova).toBeDefined();
    expect(getTestBadgeLabel(anova!)).toBe('Em breve');
  });
});
