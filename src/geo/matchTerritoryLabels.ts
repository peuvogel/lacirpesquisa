import { normalizeHeaderToken } from '@/shared/data-input/parseTabular';
import { UF_LIST } from '@/routes/mapas/ufCodes';
import type { MatchReport, MatchResult, MuniEntry, TerritoryRef } from './types';

const SIGLA_BY_NORMALIZED_NAME = new Map(
  UF_LIST.map((uf) => [normalizeHeaderToken(uf.name), uf.sigla]),
);

const UF_BY_SIGLA = new Map(UF_LIST.map((uf) => [uf.sigla, uf]));

/** Match a single line to a UF by sigla or normalized name (MAP-02). */
export function matchUfLabel(line: string): MatchResult {
  const trimmed = line.trim();
  if (!trimmed) {
    return { status: 'unmatched', input: line };
  }

  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && UF_BY_SIGLA.has(upper)) {
    const uf = UF_BY_SIGLA.get(upper)!;
    return {
      status: 'matched',
      input: line,
      territory: {
        level: 'uf',
        ibgeCode: uf.ibgeCode,
        sigla: uf.sigla,
        name: uf.name,
      },
    };
  }

  const token = normalizeHeaderToken(trimmed);
  const sigla = SIGLA_BY_NORMALIZED_NAME.get(token);
  if (sigla) {
    const uf = UF_BY_SIGLA.get(sigla)!;
    return {
      status: 'matched',
      input: line,
      territory: {
        level: 'uf',
        ibgeCode: uf.ibgeCode,
        sigla: uf.sigla,
        name: uf.name,
      },
    };
  }

  return { status: 'unmatched', input: line };
}

/** Match municipality name scoped by UF (MAP-04). */
export function matchMunicipality(
  name: string,
  ufSigla: string,
  catalog: MuniEntry[],
): MatchResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { status: 'unmatched', input: name };
  }

  const token = normalizeHeaderToken(trimmed);
  const exact = catalog.find((entry) => normalizeHeaderToken(entry.nome) === token);

  if (exact) {
    return {
      status: 'matched',
      input: name,
      territory: {
        level: 'municipio',
        ibgeCode: exact.id,
        sigla: ufSigla.toUpperCase(),
        name: exact.nome,
      },
    };
  }

  return { status: 'unmatched', input: name };
}

const MAX_PASTE_LINES = 5000;

/** Match multiple territory labels with row cap (T-04-02 mitigation). */
export function matchTerritoryLabels(
  lines: string[],
  options: { ufSigla?: string; muniCatalog?: MuniEntry[] } = {},
): MatchReport {
  const capped = lines.slice(0, MAX_PASTE_LINES);
  const matched: MatchReport['matched'] = [];
  const unmatched: MatchReport['unmatched'] = [];
  const fuzzy: MatchReport['fuzzy'] = [];

  for (const line of capped) {
    if (!line.trim()) continue;

    let result: MatchResult;

    if (options.ufSigla && options.muniCatalog) {
      result = matchMunicipality(line, options.ufSigla, options.muniCatalog);
      if (result.status === 'unmatched') {
        result = matchUfLabel(line);
      }
    } else {
      result = matchUfLabel(line);
    }

    switch (result.status) {
      case 'matched':
        matched.push(result);
        break;
      case 'unmatched':
        unmatched.push(result);
        break;
      case 'fuzzy':
        fuzzy.push(result);
        break;
    }
  }

  return { matched, unmatched, fuzzy };
}

/** Extract TerritoryRef[] from a match report. */
export function territoriesFromReport(report: MatchReport): TerritoryRef[] {
  return report.matched.map((m) => m.territory);
}
