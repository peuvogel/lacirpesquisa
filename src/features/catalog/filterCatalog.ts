import type { CatalogEntry, VariableType } from './types';

export interface CatalogFilters {
  query?: string;
  sourceSystem?: string;
  variableType?: VariableType | '';
  domain?: string;
  loadable?: boolean | null;
}

export function filterCatalog(_entries: CatalogEntry[], _filters: CatalogFilters): CatalogEntry[] {
  throw new Error('not implemented');
}
