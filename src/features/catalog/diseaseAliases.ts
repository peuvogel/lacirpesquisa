/**
 * Disease alias matching — pure module, zero new deps (TAX-05).
 *
 * After the canonical taxonomy flip (08-06), ids like `avc` no longer exist — the three
 * true forms of AVC now live under `hemorragia_intracraniana`, `infarto_cerebral` and
 * `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem`, none of which contain the stroke
 * acronym substring in id or label. Searching the acronym after the flip would return
 * zero without this layer.
 *
 * Two complementary mechanisms, both pure:
 * - `labelMatchesQuery`: automatic accent-folded, tokenized, AND-between-tokens matching
 *   with a measured fuzzy floor (RESEARCH §6.2) — resolves the misspelled-synonym case
 *   (`arteroesclerose`, D-17) without any curated entry.
 * - `resolveAliasTerm` / `matchDiseases`: curated dictionary lookup (`aliases.json`, Task 1)
 *   for the residue the automatic rule cannot reach — short acronyms (avc/tvp/ait) and one
 *   popular synonym (varizes) too short or too far (edit distance) for fuzzy to alcançar safely.
 *
 * `matchDiseases` always returns canonical diseases (D-19): the alias term itself never
 * appears as an id, a label, or any returned key — it only steers which canonical entries
 * come back.
 */

import aliasesData from './aliases.json';

/** One canonical category a curated alias term resolves to (Task 1, invariante E). */
export interface AliasCategory {
  tabnetCode: string;
  labelEsperado: string;
}

/** One curated alias dictionary entry (`aliases.json` shape). */
export interface AliasEntry {
  termos: string[];
  categorias: AliasCategory[];
  motivo: string;
}

/** The curated dictionary, loaded once. Callers may pass a different array in tests. */
export const ALIASES: readonly AliasEntry[] = aliasesData as AliasEntry[];

/** Minimal shape `matchDiseases`/`labelMatchesQuery` need from a disease record. */
export interface DiseaseLike {
  id: string;
  label: string;
  tabnetCode: string;
}

/** Result of a `matchDiseases` call — the canonical diseases plus alias provenance for D-18's explanatory strip. */
export interface DiseaseMatchResult<T extends DiseaseLike = DiseaseLike> {
  diseases: T[];
  /** Normalized alias term that fired, or null when no curated entry matched. */
  aliasTerm: string | null;
  /** How many categories the fired alias resolved to (0 when aliasTerm is null). */
  aliasCategoryCount: number;
}

const COMBINING_MARKS_RE = /[̀-ͯ]/g;
const NON_ALNUM_RE = /[^a-z0-9]+/i;

/** Fuzzy applies only to token pairs at or above this length (D-17 measured floor, RESEARCH §6.2). */
const FUZZY_MIN_LENGTH = 6;
/** Maximum Levenshtein distance accepted once both tokens clear the floor. */
const FUZZY_MAX_DISTANCE = 2;

/** NFKD normalize + strip combining marks + lowercase. Without this the misspelled-synonym case and its official label never even reach comparison with the accent neutralized. */
export function foldAccents(texto: string): string {
  return texto.normalize('NFKD').replace(COMBINING_MARKS_RE, '').toLowerCase();
}

function tokenize(texto: string): string[] {
  return texto.split(NON_ALNUM_RE).filter(Boolean);
}

/** Levenshtein edit distance, hand-written dynamic programming — no library (Fase 5 zero-deps rule). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let previous = new Array<number>(n + 1);
  let current = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) previous[j] = j;

  for (let i = 1; i <= m; i++) {
    current[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[n];
}

/**
 * A query token matches a label token when it is a substring of it, or — only when both
 * tokens clear the 6-character floor — when their Levenshtein distance is <=2. The floor is
 * what eliminates short-acronym noise by construction: without it, a bare 3-letter acronym
 * produces 18 spurious matches against the real corpus (RESEARCH §6.2).
 */
function tokenMatches(queryToken: string, labelToken: string): boolean {
  if (labelToken.includes(queryToken)) return true;
  if (queryToken.length >= FUZZY_MIN_LENGTH && labelToken.length >= FUZZY_MIN_LENGTH) {
    return levenshtein(queryToken, labelToken) <= FUZZY_MAX_DISTANCE;
  }
  return false;
}

/**
 * Automatic matching: fold accents on both sides, tokenize by non-alphanumeric, and require
 * every query token to match some label token (AND, not OR — needed for multi-word queries
 * like "embolia pulmonar" to stay precise; see `filterCatalog.ts`'s `matchesQuery` for the
 * same AND-between-tokens shape applied to a different haystack).
 */
export function labelMatchesQuery(label: string, query: string): boolean {
  const queryTokens = tokenize(foldAccents(query));
  if (queryTokens.length === 0) return false;
  const labelTokens = tokenize(foldAccents(label));
  return queryTokens.every((queryToken) =>
    labelTokens.some((labelToken) => tokenMatches(queryToken, labelToken)),
  );
}

/**
 * Resolves a query to a curated alias entry when the normalized query equals exactly one of
 * its `termos` — whole-term match, never substring, so an alias never fires by accident
 * inside a longer search.
 */
export function resolveAliasTerm(
  query: string,
  aliases: readonly AliasEntry[],
): AliasEntry | null {
  const normalized = foldAccents(query.trim());
  if (!normalized) return null;
  return aliases.find((entry) => entry.termos.includes(normalized)) ?? null;
}

/**
 * Resolves a query to canonical diseases. When a curated alias fires, its `tabnetCode`s
 * supply one source of matches; `labelMatchesQuery` against every disease's label supplies
 * the other. The two sources are unioned without duplicating (keyed by disease id) — the
 * alias source guarantees a curated term's categories are always present (e.g. the stroke
 * acronym resolves to exactly its curated codes, currently 4 — see `aliases.json`'s `avc`
 * entry) even when the automatic rule alone would find nothing or something different.
 */
export function matchDiseases<T extends DiseaseLike>(
  diseases: readonly T[],
  query: string,
  aliases: readonly AliasEntry[],
): DiseaseMatchResult<T> {
  const aliasEntry = resolveAliasTerm(query, aliases);
  const matched = new Map<string, T>();
  let aliasTerm: string | null = null;

  if (aliasEntry) {
    aliasTerm = foldAccents(query.trim());
    const codes = new Set(aliasEntry.categorias.map((categoria) => categoria.tabnetCode));
    for (const disease of diseases) {
      if (codes.has(disease.tabnetCode)) matched.set(disease.id, disease);
    }
  }

  for (const disease of diseases) {
    if (matched.has(disease.id)) continue;
    if (labelMatchesQuery(disease.label, query)) matched.set(disease.id, disease);
  }

  return {
    diseases: Array.from(matched.values()),
    aliasTerm,
    aliasCategoryCount: aliasEntry ? aliasEntry.categorias.length : 0,
  };
}

/** Minimal disease shape `withDiseaseAliases` needs to resolve a pack back to its `tabnetCode`. */
export interface DiseaseWithPack extends DiseaseLike {
  packId: string;
}

/** Minimal catalog-entry shape `withDiseaseAliases` reads/writes — matches `CatalogEntry`'s
 * own optional `packId`/`aliases` fields (`types.ts`) without importing that module. */
export interface AliasableCatalogEntry {
  packId?: string;
  aliases?: string[];
}

/**
 * Enriches loadable catalog entries with curated alias terms for the Variáveis search
 * (TAX-05). Pure and in-memory only: for every entry with a `packId`, resolves the disease
 * that pack belongs to (matched by `packId`, the same field both `DiseaseDef` and
 * `CatalogEntry` already carry — never by string-slicing an id) and, when that disease's
 * `tabnetCode` appears among a curated alias entry's `categorias`, appends that entry's
 * `termos` to the entry's `aliases` array — the exact extension point `filterCatalog.ts`'s
 * `matchesQuery` already reads (`...(entry.aliases ?? [])`).
 *
 * Existing aliases are preserved, never overwritten or deduplicated away; entries without a
 * matching pack/tabnetCode pass through as the same object reference (no new terms, no
 * unnecessary churn). Deliberately never writes back to `public/data/catalog/variables.json`
 * (a generated artifact under invariants B/D2, TAX-06) — the enrichment lives only in the
 * in-memory array `VariaveisPage` builds before calling `filterCatalog`.
 */
export function withDiseaseAliases<T extends AliasableCatalogEntry>(
  entries: readonly T[],
  diseases: readonly DiseaseWithPack[],
  aliases: readonly AliasEntry[],
): T[] {
  const diseaseByPackId = new Map(diseases.map((d) => [d.packId, d]));
  const termsByTabnetCode = new Map<string, string[]>();
  for (const entry of aliases) {
    for (const categoria of entry.categorias) {
      const existing = termsByTabnetCode.get(categoria.tabnetCode);
      if (existing) existing.push(...entry.termos);
      else termsByTabnetCode.set(categoria.tabnetCode, [...entry.termos]);
    }
  }

  return entries.map((entry) => {
    if (!entry.packId) return entry;
    const disease = diseaseByPackId.get(entry.packId);
    if (!disease) return entry;
    const newTerms = termsByTabnetCode.get(disease.tabnetCode);
    if (!newTerms || newTerms.length === 0) return entry;
    return { ...entry, aliases: [...new Set([...(entry.aliases ?? []), ...newTerms])] };
  });
}
