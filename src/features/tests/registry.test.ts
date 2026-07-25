import { describe, expect, it } from 'vitest';
import { getTestById, isTestAvailable, TEST_REGISTRY } from './registry';

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

  // Intentionally strict: when Phase 2 ships t-student, this assertion must
  // be updated deliberately — that update is the signal the registry is
  // being kept honest (01-07-PLAN.md Task 1).
  it('marks exactly one entry available, and it is demo', () => {
    const available = TEST_REGISTRY.filter((entry) => entry.status === 'available');
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('demo');
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
  it('is true only for demo', () => {
    expect(isTestAvailable('demo')).toBe(true);
    for (const entry of TEST_REGISTRY) {
      if (entry.id === 'demo') continue;
      expect(isTestAvailable(entry.id)).toBe(false);
    }
  });

  it('is false for an unknown id', () => {
    expect(isTestAvailable('nope')).toBe(false);
  });
});
