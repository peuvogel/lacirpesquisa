/** Geographic level for map drill-down and territory references (MAP-03). */
export type GeoLevel = 'uf' | 'municipio' | 'meso' | 'health-macro';

/** Stable territory identifier — join keys use ibgeCode, never sigla-only (D-19). */
export interface TerritoryRef {
  level: GeoLevel;
  ibgeCode: string;
  sigla?: string;
  name: string;
}

/** Current map view state for drill-down navigation. */
export interface MapViewState {
  level: GeoLevel;
  /** Parent IBGE code when drilled below Brazil (e.g. UF code for muni view). */
  parentCode?: string;
}

/** Municipality entry from offline IBGE Localidades name tables. */
export interface MuniEntry {
  id: string;
  nome: string;
}

/** Result of matching a single territory label from paste input. */
export type MatchStatus = 'matched' | 'unmatched' | 'fuzzy';

export interface MatchedTerritory {
  status: 'matched';
  input: string;
  territory: TerritoryRef;
}

export interface UnmatchedTerritory {
  status: 'unmatched';
  input: string;
}

export interface FuzzyTerritory {
  status: 'fuzzy';
  input: string;
  territory: TerritoryRef;
  score: number;
}

export type MatchResult = MatchedTerritory | UnmatchedTerritory | FuzzyTerritory;

/** Aggregate report for paste UI (MAP-02 / MAP-04). */
export interface MatchReport {
  matched: MatchedTerritory[];
  unmatched: UnmatchedTerritory[];
  fuzzy: FuzzyTerritory[];
}
