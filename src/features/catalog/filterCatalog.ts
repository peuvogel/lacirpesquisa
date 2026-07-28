import type { CatalogEntry, VariableType } from './types';

export interface CatalogFilters {
  query?: string;
  sourceSystem?: string;
  variableType?: VariableType | '';
  domain?: string;
  /** When null/undefined, do not filter by loadable. */
  loadable?: boolean | null;
}

function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    entry.label,
    entry.id,
    entry.sourceSystem,
    entry.sourceName,
    entry.domain,
    entry.tableOrIndicator,
    entry.period,
    entry.methodologyNotes,
    ...(entry.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase();
  // Support multi-token search (all tokens must match).
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

/** Pure CAT-01 search/filter over catalog entries (D-11). */
export function filterCatalog(entries: CatalogEntry[], filters: CatalogFilters): CatalogEntry[] {
  const { query = '', sourceSystem, variableType, domain, loadable } = filters;

  return entries.filter((entry) => {
    if (!matchesQuery(entry, query)) return false;
    if (sourceSystem && entry.sourceSystem !== sourceSystem) return false;
    if (variableType && entry.variableType !== variableType) return false;
    if (domain && entry.domain !== domain) return false;
    if (loadable === true || loadable === false) {
      if (entry.loadable !== loadable) return false;
    }
    return true;
  });
}
