import { beforeEach, describe, expect, it } from 'vitest';

import {
  hasParticleTextEntered,
  markParticleTextEntered,
  resetParticleTextEntrances,
} from './particleTextEntrances';

describe('particleTextEntrances', () => {
  beforeEach(() => {
    resetParticleTextEntrances();
  });

  it('only reports an entrance after it has been marked', () => {
    expect(hasParticleTextEntered('mapas')).toBe(false);
    markParticleTextEntered('mapas');
    expect(hasParticleTextEntered('mapas')).toBe(true);
  });

  it('keeps one latch per id, so each module still gets its first time', () => {
    markParticleTextEntered('mapas');
    expect(hasParticleTextEntered('variaveis')).toBe(false);
  });
});
