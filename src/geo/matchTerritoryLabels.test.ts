import { describe, expect, it } from 'vitest';
import { UF_LIST } from '@/routes/mapas/ufCodes';
import {
  matchMunicipality,
  matchMunicipalityPaste,
  matchTerritoryLabels,
  matchUfLabel,
  matchUfPaste,
} from './matchTerritoryLabels';
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

  it.each([
    ['BA', 'BA'],
    ['bahia', 'BA'],
    ['Bahia', 'BA'],
    ['São Paulo', 'SP'],
    ['sao paulo', 'SP'],
    ['distrito federal', 'DF'],
  ] as const)('matches %s to %s', (input, expectedSigla) => {
    const result = matchUfLabel(input);
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.territory.sigla).toBe(expectedSigla);
    }
  });

  it('rejects XYZ as unmatched', () => {
    expect(matchUfLabel('XYZ').status).toBe('unmatched');
  });
});

describe('matchUfPaste', () => {
  it('matches multi-line paste with matched and unmatched arrays', () => {
    const result = matchUfPaste('BA\nPE\nXYZ\n');
    expect(result.matched.map((entry) => entry.sigla)).toEqual(['BA', 'PE']);
    expect(result.unmatched).toEqual(['XYZ']);
  });

  it('dedupes matched siglas preserving first occurrence order', () => {
    const result = matchUfPaste('BA\nbahia\nPE\nPE');
    expect(result.matched.map((entry) => entry.sigla)).toEqual(['BA', 'PE']);
  });

  it('preserves unmatched lines in report order', () => {
    const result = matchUfPaste('XYZ\nABC\nBA');
    expect(result.unmatched).toEqual(['XYZ', 'ABC']);
  });

  it('matches all 27 UFs by sigla and normalized full name', () => {
    for (const uf of UF_LIST) {
      expect(matchUfPaste(uf.sigla).matched[0]?.sigla).toBe(uf.sigla);
      expect(matchUfPaste(uf.name).matched[0]?.sigla).toBe(uf.sigla);
    }
  });

  it('caps paste at 100 lines', () => {
    const lines = Array.from({ length: 150 }, (_, index) => (index % 2 === 0 ? 'BA' : 'ZZ'));
    const result = matchUfPaste(lines.join('\n'));
    expect(result.matched.length + result.unmatched.length).toBeLessThanOrEqual(100);
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

describe('matchMunicipalityPaste', () => {
  it('matches Salvador with UF scope BA', () => {
    const result = matchMunicipalityPaste('Salvador', 'BA', sampleCatalog);
    expect(result.scopeRequired).toBe(false);
    expect(result.matched).toHaveLength(1);
    if (result.matched[0]?.status === 'matched') {
      expect(result.matched[0].territory.ibgeCode).toBe('2927408');
    }
    expect(result.unmatched).toHaveLength(0);
  });

  it('reports XYZ as unmatched with UF scope BA', () => {
    const result = matchMunicipalityPaste('XYZ', 'BA', sampleCatalog);
    expect(result.unmatched).toEqual(['XYZ']);
    expect(result.matched).toHaveLength(0);
  });

  it('flags scope required when municipality lines pasted without UF scope', () => {
    const result = matchMunicipalityPaste('Salvador', undefined, sampleCatalog);
    expect(result.scopeRequired).toBe(true);
    expect(result.matched).toHaveLength(0);
  });

  it('caps municipality paste at 200 lines', () => {
    const lines = Array.from({ length: 250 }, () => 'Salvador').join('\n');
    const result = matchMunicipalityPaste(lines, 'BA', sampleCatalog);
    expect(result.matched.length + result.unmatched.length).toBeLessThanOrEqual(200);
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
