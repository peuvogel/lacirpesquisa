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
  return (
    entry.label.toLowerCase().includes(q) ||
    entry.id.toLowerCase().includes(q) ||
    entry.sourceSystem.toLowerCase().includes(q)
  );
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
