import { describe, expect, it } from 'vitest';
import { fingerprintResearchDesign, validateResearchDesign } from './researchDesign';
import type { ResearchDesign } from './types';

const baGroup = {
  id: 'nordeste',
  name: 'Nordeste',
  territories: [
    { id: '29', label: 'Bahia' },
    { id: '28', label: 'Sergipe' },
  ],
};

const rjGroup = {
  id: 'sudeste',
  name: 'Sudeste',
  territories: [{ id: '33', label: 'Rio de Janeiro' }],
};

function fixtureDesign(overrides: Partial<ResearchDesign> = {}): ResearchDesign {
  return {
    groups: [baGroup, rjGroup],
    geography: 'uf',
    locationBasis: 'ocorrencia',
    diseaseIds: ['i63', 'i10'],
    period: { scope: 'shared', time: { mode: 'range', start: '2020-01', end: '2021-12' } },
    ...overrides,
  } as ResearchDesign;
}

describe('research design contracts', () => {
  it('produces the same fingerprint for semantically equal group, territory and disease order', () => {
    const a = fixtureDesign({ groups: [baGroup, rjGroup] });
    const b = fixtureDesign({
      groups: [{ ...baGroup, territories: [...baGroup.territories].reverse() }, rjGroup].reverse(),
      diseaseIds: ['i10', 'i63'],
    });

    expect(fingerprintResearchDesign(a)).toBe(fingerprintResearchDesign(b));
  });

  it('rejects a design without territory, disease or valid period', () => {
    expect(validateResearchDesign(fixtureDesign({ groups: [] })).ok).toBe(false);
    expect(validateResearchDesign(fixtureDesign({ diseaseIds: [] })).ok).toBe(false);
    expect(
      validateResearchDesign(
        fixtureDesign({ period: { scope: 'shared', time: { mode: 'range', start: '2021-12', end: '2020-01' } } }),
      ).ok,
    ).toBe(false);
  });
});
