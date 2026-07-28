import type { TerritoryRef } from './types';
import membershipJson from './mesoMembership.json';

export interface MesoMembershipEntry {
  label: string;
  ufSigla: string;
  municipalityIds: string[];
}

const MEMBERSHIP = membershipJson as Record<string, MesoMembershipEntry>;

export function getMesoMembership(mesoCode: string): MesoMembershipEntry | undefined {
  return MEMBERSHIP[mesoCode];
}

export function listMesoMembership(): Array<{ mesoCode: string } & MesoMembershipEntry> {
  return Object.entries(MEMBERSHIP)
    .map(([mesoCode, entry]) => ({ mesoCode, ...entry }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Resolve mesorregião → município TerritoryRefs. */
export function resolveMesoMunicipios(mesoCode: string): TerritoryRef[] {
  const entry = MEMBERSHIP[mesoCode];
  if (!entry) return [];
  return entry.municipalityIds.map((id) => ({
    level: 'municipio' as const,
    ibgeCode: id,
    name: id,
    sigla: entry.ufSigla,
  }));
}

export function municipalityIdsForMeso(mesoCode: string): string[] {
  return MEMBERSHIP[mesoCode]?.municipalityIds ?? [];
}
