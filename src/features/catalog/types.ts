/** Variable typology for catalog entries (D-05). */
export type VariableType =
  | 'categorica'
  | 'numerica'
  | 'ordinal'
  | 'taxa'
  | 'contagem'
  | 'texto';

/** One curated / loadable variable with mandatory provenance (D-05). */
export interface CatalogEntry {
  id: string;
  label: string;
  variableType: VariableType;
  domain: string;
  sourceSystem: string;
  sourceName: string;
  tableOrIndicator: string;
  period: string;
  /** Absolute http(s) URL — validated by catalog:validate. */
  officialUrl: string;
  /** Non-empty methodology / gap notes. */
  methodologyNotes: string;
  loadable: boolean;
  /** Required when loadable === true. */
  packId?: string;
  /** Required when loadable === true; must exist in pack.metricKeys. */
  columnKey?: string;
  unit?: string;
  grain?: 'uf_ano' | string;
  aliases?: string[];
  yearsAvailable?: number[];
  nullYears?: number[];
}

export interface ManifestPackRef {
  packId: string;
  grain: string;
  sourceDir: string;
  rowCount: number;
  years: number[];
  keys: string[];
}

export interface Manifest {
  version: string;
  generatedAt: string;
  catalogEntryCount: number;
  packs: ManifestPackRef[];
}

/** Wide UF×ano pack row: identity keys plus metric columns as number|null. */
export interface PackRow {
  uf_codigo: string;
  uf: string;
  uf_nome?: string;
  ano: number;
  [metric: string]: string | number | null | undefined;
}

export interface PackFile {
  packId: string;
  grain: string;
  keys: string[];
  metricKeys: string[];
  rows: PackRow[];
}
