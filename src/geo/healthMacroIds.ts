/**
 * Lightweight health-macro id → municipality crosswalk (no name resolution).
 * Used by the map canvas drill view; full TerritoryRefs live in territoryCatalog.
 */

export interface HealthMacroIds {
  id: string;
  municipalityIds: readonly string[];
}

export const HEALTH_MACRO_IDS: readonly HealthMacroIds[] = [
  {
    id: 'ba-macro-1',
    municipalityIds: ['2900108', '2900207', '2927408'],
  },
  {
    id: 'ba-macro-2',
    municipalityIds: ['2910800', '2921005'],
  },
];

export function healthMacroMunicipalityIds(macroId: string): string[] {
  return [...(HEALTH_MACRO_IDS.find((entry) => entry.id === macroId)?.municipalityIds ?? [])];
}

export function healthMacrosForUf(ufIbge: string): HealthMacroIds[] {
  return HEALTH_MACRO_IDS.filter((entry) =>
    entry.municipalityIds.some((id) => id.startsWith(ufIbge)),
  );
}
