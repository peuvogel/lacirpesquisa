import municipioNomeById from './municipioNomeById.json';
import type { TerritoryRef } from './types';

const NOME_BY_ID = municipioNomeById as Record<string, string>;

/** Resolve município display name from IBGE 7-digit code. */
export function municipioNome(ibgeCode: string): string {
  return NOME_BY_ID[ibgeCode] ?? ibgeCode;
}

/** Build a TerritoryRef for a município with a human-readable name. */
export function municipioTerritory(
  ibgeCode: string,
  sigla?: string,
): TerritoryRef {
  return {
    level: 'municipio',
    ibgeCode,
    sigla,
    name: municipioNome(ibgeCode),
  };
}

/**
 * Suggest a short group label from selected territories.
 * Prefer UF siglas / município names — never raw IBGE code lists.
 */
export function suggestGroupName(territories: readonly TerritoryRef[]): string {
  if (territories.length === 0) return 'Novo grupo';

  const ufs = territories
    .filter((t) => t.level === 'uf' && t.sigla)
    .map((t) => t.sigla!);
  const munis = territories.filter((t) => t.level === 'municipio');

  if (munis.length === 0) {
    if (ufs.length === 1) return ufs[0]!;
    if (ufs.length <= 3) return ufs.join(' · ');
    return `${ufs.slice(0, 2).join(' · ')} +${ufs.length - 2}`;
  }

  const ufHint =
    ufs[0] ??
    munis.find((t) => t.sigla)?.sigla ??
    (munis[0]?.ibgeCode ? undefined : undefined);

  const names = munis
    .map((t) => (t.name && !/^\d{7}$/.test(t.name) ? t.name : municipioNome(t.ibgeCode)))
    .filter(Boolean);

  if (names.length === 1) {
    const base = names[0]!;
    return ufHint && !ufs.length ? `${base} (${ufHint})` : base.slice(0, 40);
  }

  const prefix = ufHint ?? ufs[0];
  if (prefix) return `${prefix} · ${munis.length} mun.`;
  if (names.length <= 2) return names.join(' · ').slice(0, 40);
  return `${munis.length} municípios`;
}
