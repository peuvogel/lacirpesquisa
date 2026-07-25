import { describe, expect, it } from 'vitest';
import { matchMunicipality, matchTerritoryLabels, matchUfLabel } from './matchTerritoryLabels';
import type { MuniEntry } from './types';

const sampleCatalog: MuniEntry[] = [
  { id: '2927408', nome: 'Salvador' },
  { id: '2910800', nome: 'Feira de Santana' },
  { id: '2900108', nome: 'Abaíra' },
];

describe('matchUfLabel', () => {
  it('matches UF sigla BA', () => {
    const result = matchUfLabel('BA');
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.territory.sigla).toBe('BA');
      expect(result.territory.ibgeCode).toBe('29');
    }
  });

  it('matches normalized UF name bahia', () => {
    const result = matchUfLabel('bahia');
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.territory.name).toBe('Bahia');
    }
  });

  it('rejects unknown UF', () => {
    expect(matchUfLabel('XX').status).toBe('unmatched');
    expect(matchUfLabel('Atlantis').status).toBe('unmatched');
  });
});

describe('matchMunicipality', () => {
  it('matches exact municipality name scoped by UF', () => {
    const result = matchMunicipality('Salvador', 'BA', sampleCatalog);
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.territory.ibgeCode).toBe('2927408');
      expect(result.territory.level).toBe('municipio');
    }
  });

  it('reports unmatched municipality', () => {
    expect(matchMunicipality('Cidade Inexistente', 'BA', sampleCatalog).status).toBe('unmatched');
  });
});

describe('matchTerritoryLabels', () => {
  it('processes multiple UF lines', () => {
    const report = matchTerritoryLabels(['BA', 'SP', 'ZZ']);
    expect(report.matched).toHaveLength(2);
    expect(report.unmatched).toHaveLength(1);
  });

  it('caps paste at row limit', () => {
    const lines = Array.from({ length: 6000 }, () => 'BA');
    const report = matchTerritoryLabels(lines);
    expect(report.matched.length).toBeLessThanOrEqual(5000);
  });
});
