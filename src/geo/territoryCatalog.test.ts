import { describe, expect, it } from 'vitest';
import {
  HEALTH_MACRO_CATALOG,
  healthMacrosAvailableForUf,
  REGION_PRESETS,
  resolveHealthMacroTerritories,
  resolvePresetTerritories,
} from './territoryCatalog';

describe('territoryCatalog', () => {
  it('Norte preset returns 7 UFs', () => {
    const territories = resolvePresetTerritories('N');
    expect(territories).toHaveLength(7);
    const siglas = territories.map((t) => t.sigla).sort();
    expect(siglas).toEqual(['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO']);
  });

  it('Nordeste preset includes BA', () => {
    const territories = resolvePresetTerritories('NE');
    expect(territories.some((t) => t.sigla === 'BA')).toBe(true);
    expect(territories).toHaveLength(REGION_PRESETS.NE.siglas.length);
  });

  it('each preset territory has ibgeCode join key', () => {
    for (const presetId of Object.keys(REGION_PRESETS) as Array<keyof typeof REGION_PRESETS>) {
      const territories = resolvePresetTerritories(presetId);
      territories.forEach((t) => {
        expect(t.level).toBe('uf');
        expect(t.ibgeCode).toMatch(/^\d{2}$/);
      });
    }
  });

  it('health macro resolves municipality IDs', () => {
    const macro = HEALTH_MACRO_CATALOG[0]!;
    const territories = resolveHealthMacroTerritories(macro.id);
    expect(territories.length).toBe(macro.municipalityIds.length);
    expect(territories[0]!.level).toBe('municipio');
  });

  it('returns empty for unknown health macro', () => {
    expect(resolveHealthMacroTerritories('unknown')).toEqual([]);
  });

  it('health macros sample is available for BA only', () => {
    expect(healthMacrosAvailableForUf('29')).toBe(true);
    expect(healthMacrosAvailableForUf('35')).toBe(false);
  });
});
