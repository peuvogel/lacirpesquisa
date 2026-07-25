import { normalizeHeaderToken } from '@/shared/data-input/parseTabular';
import { UF_LIST, type UfEntry } from '@/routes/mapas/ufCodes';
import type { MatchReport, MatchResult, MuniEntry, TerritoryRef } from './types';

const SIGLA_BY_NORMALIZED_NAME = new Map(
  UF_LIST.map((uf) => [normalizeHeaderToken(uf.name), uf.sigla]),
);

/** Common UF name variants beyond official IBGE names (MAP-02). */
const UF_ALIASES: Record<string, string> = {
  'distrito federal': 'DF',
  'rio de janeiro': 'RJ',
  'rio grande do sul': 'RS',
  'rio grande do norte': 'RN',
  'minas gerais': 'MG',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'espirito santo': 'ES',
  'sao paulo': 'SP',
  'santa catarina': 'SC',
};

for (const [alias, sigla] of Object.entries(UF_ALIASES)) {
  if (!SIGLA_BY_NORMALIZED_NAME.has(alias)) {
    SIGLA_BY_NORMALIZED_NAME.set(alias, sigla);
  }
}

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

const MAX_UF_PASTE_LINES = 100;

export interface UfPasteResult {
  matched: UfEntry[];
  unmatched: string[];
}

/** Match multi-line UF paste text — sigla or normalized name (MAP-02). */
export function matchUfPaste(text: string): UfPasteResult {
  const lines = text.split(/\r?\n/).slice(0, MAX_UF_PASTE_LINES);
  const matched: UfEntry[] = [];
  const unmatched: string[] = [];
  const seenSiglas = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const result = matchUfLabel(line);
    if (result.status === 'matched') {
      const sigla = result.territory.sigla!;
      if (!seenSiglas.has(sigla)) {
        seenSiglas.add(sigla);
        const entry = UF_BY_SIGLA.get(sigla);
        if (entry) matched.push(entry);
      }
    } else {
      unmatched.push(trimmed);
    }
  }

  return { matched, unmatched };
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
