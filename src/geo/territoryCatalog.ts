import { UF_LIST, type UfEntry } from '@/routes/mapas/ufCodes';
import { HEALTH_MACRO_IDS, healthMacroMunicipalityIds } from './healthMacroIds';
import { municipioNome } from './municipioNames';
import type { TerritoryRef } from './types';

/** IBGE grande região presets (D-07). */
export const REGION_PRESETS = {
  N: { id: 'N', label: 'Norte', siglas: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'] as const },
  NE: { id: 'NE', label: 'Nordeste', siglas: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] as const },
  CO: { id: 'CO', label: 'Centro-Oeste', siglas: ['DF', 'GO', 'MS', 'MT'] as const },
  SE: { id: 'SE', label: 'Sudeste', siglas: ['ES', 'MG', 'RJ', 'SP'] as const },
  S: { id: 'S', label: 'Sul', siglas: ['PR', 'RS', 'SC'] as const },
} as const;

export type RegionPresetId = keyof typeof REGION_PRESETS;

/** Health macro-region metadata (MAP-08 infra — geometries loaded separately). */
export interface HealthMacroEntry {
  id: string;
  name: string;
  /** Municipality IBGE codes belonging to this macro-region. */
  municipalityIds: string[];
}

const HEALTH_MACRO_NAMES: Record<string, string> = {
  'ba-macro-1': 'Macro Bahia Norte',
  'ba-macro-2': 'Macro Bahia Sul',
};

/**
 * Didactic sample health macros for BA — full crosswalk ships with health-macro.json
 * after build-time MS/SUS fetch. Wave 0 uses static refs for preset resolution tests.
 */
export const HEALTH_MACRO_CATALOG: readonly HealthMacroEntry[] = HEALTH_MACRO_IDS.map(
  (entry) => ({
    id: entry.id,
    name: HEALTH_MACRO_NAMES[entry.id] ?? entry.id,
    municipalityIds: [...entry.municipalityIds],
  }),
);

/** Preset pills for health macro-regions (MAP-08). */
export const HEALTH_MACRO_PRESETS = HEALTH_MACRO_CATALOG.map((entry) => ({
  id: entry.id,
  label: entry.name.replace(/^Macro /, 'MR '),
  tooltip: entry.name,
}));

const UF_BY_SIGLA: Record<string, UfEntry> = Object.fromEntries(UF_LIST.map((uf) => [uf.sigla, uf]));

function ufToTerritory(uf: UfEntry): TerritoryRef {
  return {
    level: 'uf',
    ibgeCode: uf.ibgeCode,
    sigla: uf.sigla,
    name: uf.name,
  };
}

/** Resolve a grande região preset to TerritoryRef[] (D-07). */
export function resolvePresetTerritories(presetId: RegionPresetId): TerritoryRef[] {
  const preset = REGION_PRESETS[presetId];
  return preset.siglas
    .map((sigla) => UF_BY_SIGLA[sigla])
    .filter((uf): uf is UfEntry => uf !== undefined)
    .map(ufToTerritory);
}

/** Resolve a health macro-region to TerritoryRef entries (MAP-08). */
export function resolveHealthMacroTerritories(macroId: string): TerritoryRef[] {
  const macro = HEALTH_MACRO_CATALOG.find((entry) => entry.id === macroId);
  if (!macro) return [];

  return macro.municipalityIds.map((ibgeCode) => ({
    level: 'municipio' as const,
    ibgeCode,
    name: municipioNome(ibgeCode),
    sigla: ufSiglaForMunicipio(ibgeCode),
  }));
}

/** Municipality IBGE codes belonging to a health macro (empty if unknown). */
export function municipalityIdsForHealthMacro(macroId: string): string[] {
  return healthMacroMunicipalityIds(macroId);
}

/** Didactic sample macros exist for BA (29) only — hide the tab elsewhere. */
export function healthMacrosAvailableForUf(ufIbge: string): boolean {
  return HEALTH_MACRO_IDS.some((entry) =>
    entry.municipalityIds.some((id) => id.startsWith(ufIbge)),
  );
}

function ufSiglaForMunicipio(ibgeCode: string): string | undefined {
  const prefix = ibgeCode.slice(0, 2);
  return UF_LIST.find((uf) => uf.ibgeCode === prefix)?.sigla;
}

/** Lookup UF entry by sigla or IBGE code. */
export function findUfBySiglaOrCode(siglaOrCode: string): UfEntry | undefined {
  const upper = siglaOrCode.toUpperCase();
  return UF_LIST.find((uf) => uf.sigla === upper || uf.ibgeCode === siglaOrCode);
}
