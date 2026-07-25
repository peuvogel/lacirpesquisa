import { UF_LIST, type UfEntry } from '@/routes/mapas/ufCodes';
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

/**
 * Didactic sample health macros for BA — full crosswalk ships with health-macro.json
 * after build-time MS/SUS fetch. Wave 0 uses static refs for preset resolution tests.
 */
export const HEALTH_MACRO_CATALOG: readonly HealthMacroEntry[] = [
  {
    id: 'ba-macro-1',
    name: 'Macro Bahia Norte',
    municipalityIds: ['2900108', '2900207', '2927408'],
  },
  {
    id: 'ba-macro-2',
    name: 'Macro Bahia Sul',
    municipalityIds: ['2910800', '2921005'],
  },
];

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
    name: ibgeCode,
  }));
}

/** Lookup UF entry by sigla or IBGE code. */
export function findUfBySiglaOrCode(siglaOrCode: string): UfEntry | undefined {
  const upper = siglaOrCode.toUpperCase();
  return UF_LIST.find((uf) => uf.sigla === upper || uf.ibgeCode === siglaOrCode);
}
