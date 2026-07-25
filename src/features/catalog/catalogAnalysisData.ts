/**
 * Mapas metric facade over committed catalog packs (D-02, D-18, D-19).
 * Sync imports keep Phase 4 call-site ergonomics (getMetricByUf*) without runtime TABNET.
 *
 * Null handling: omit UF keys when the pack cell is null — never coerce null→0 (T-05-11).
 */
import type { CatalogEntry, PackFile } from './types';
import variablesJson from '../../../public/data/catalog/variables.json';
import emboliaPackJson from '../../../public/data/catalog/packs/sih.embolia_trombose_uf.json';
import amputacaoPackJson from '../../../public/data/catalog/packs/sih.amputacao_mmii_uf.json';
import { UF_LIST } from '@/routes/mapas/ufCodes';

/** Analysis variable shown in Mapas checkboxes / choropleth (catalog or paste overlay). */
export interface CatalogAnalysisVariable {
  id: string;
  label: string;
  provenance: 'catalog' | 'paste';
  unit?: string;
  sourceSystem?: string;
}

/** Stable Phase 4 mock IDs → pack-backed catalog IDs where semantics match (D-18). */
export const VARIABLE_ID_ALIASES: Readonly<Record<string, string>> = {
  'mock.amputacoes': 'sih.amputacao_mmii.internacoes',
  'mock.internacoes': 'sih.embolia_trombose.internacoes',
  'mock.obitos': 'sih.embolia_trombose.obitos',
  // mock.taxa_mortalidade intentionally NOT aliased (infantil ≠ hospital SIH rates)
};

const CATALOG_ENTRIES = variablesJson as CatalogEntry[];
const PACKS: Record<string, PackFile> = {
  'sih.embolia_trombose_uf': emboliaPackJson as PackFile,
  'sih.amputacao_mmii_uf': amputacaoPackJson as PackFile,
};

const ENTRIES_BY_ID = new Map(CATALOG_ENTRIES.map((entry) => [entry.id, entry]));

const LOADABLE_ENTRIES = CATALOG_ENTRIES.filter(
  (entry) => entry.loadable && entry.packId && entry.columnKey,
);

const IBGE_BY_SIGLA: Record<string, string> = Object.fromEntries(
  UF_LIST.map(({ sigla, ibgeCode }) => [sigla, ibgeCode]),
);

export function resolveVariableId(variableId: string): string {
  return VARIABLE_ID_ALIASES[variableId] ?? variableId;
}

export function getCatalogVariableById(variableId: string): CatalogEntry | undefined {
  return ENTRIES_BY_ID.get(resolveVariableId(variableId));
}

/** Mapas checkbox row — loadable catalog entries only (paste overlays added by UI). */
export function toAnalysisVariable(entry: CatalogEntry): CatalogAnalysisVariable {
  return {
    id: entry.id,
    label: entry.label,
    provenance: 'catalog',
    unit: entry.unit,
    sourceSystem: entry.sourceSystem,
  };
}

export const CATALOG_ANALYSIS_VARIABLES: readonly CatalogAnalysisVariable[] =
  LOADABLE_ENTRIES.map(toAnalysisVariable);

export const CATALOG_ID_TO_LABEL: Record<string, string> = Object.fromEntries(
  CATALOG_ANALYSIS_VARIABLES.map((entry) => [entry.id, entry.label]),
);

/** Prefer embolia internações (legacy mock.internacoes default), else first loadable contagem. */
export function getDefaultCatalogVariableId(): string {
  const preferred = 'sih.embolia_trombose.internacoes';
  if (ENTRIES_BY_ID.has(preferred)) return preferred;
  const firstCount = LOADABLE_ENTRIES.find((e) => e.variableType === 'contagem');
  return firstCount?.id ?? LOADABLE_ENTRIES[0]?.id ?? preferred;
}

export function getAnalysisVariableById(
  variableId: string,
): CatalogAnalysisVariable | undefined {
  const entry = getCatalogVariableById(variableId);
  if (!entry?.loadable) return undefined;
  return toAnalysisVariable(entry);
}

/**
 * Years with at least one non-null pack cell for the metric.
 * Excludes entry.nullYears (D-19) even if yearsAvailable lists them.
 */
export function getCatalogTimeSeriesYears(variableId: string): number[] {
  const entry = getCatalogVariableById(variableId);
  if (!entry?.loadable || !entry.packId || !entry.columnKey) return [];

  const pack = PACKS[entry.packId];
  if (!pack) return [];

  const nullYearSet = new Set(entry.nullYears ?? []);
  const fromEntry = entry.yearsAvailable?.filter((y) => !nullYearSet.has(y));

  const yearsWithData = new Set<number>();
  for (const row of pack.rows) {
    if (nullYearSet.has(row.ano)) continue;
    const raw = row[entry.columnKey];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      yearsWithData.add(row.ano);
    }
  }

  if (fromEntry && fromEntry.length > 0) {
    return fromEntry.filter((y) => yearsWithData.has(y)).sort((a, b) => a - b);
  }

  return [...yearsWithData].sort((a, b) => a - b);
}

export function getDefaultYearForVariable(variableId: string): number | null {
  const years = getCatalogTimeSeriesYears(variableId);
  return years.length ? years[years.length - 1]! : null;
}

function metricForYear(
  entry: CatalogEntry,
  year: number,
): Record<string, number> {
  if (!entry.packId || !entry.columnKey) return {};
  const pack = PACKS[entry.packId];
  if (!pack) return {};
  if ((entry.nullYears ?? []).includes(year)) return {};

  const out: Record<string, number> = {};
  for (const row of pack.rows) {
    if (row.ano !== year) continue;
    const sigla = String(row.uf);
    const raw = row[entry.columnKey];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[sigla] = raw;
    }
  }
  return out;
}

/** UF sigla → metric for the latest non-null year (or empty if unknown). */
export function getMetricByUf(
  variableId: string = getDefaultCatalogVariableId(),
): Record<string, number> {
  const entry = getCatalogVariableById(variableId);
  if (!entry?.loadable) return {};
  const year = getDefaultYearForVariable(variableId);
  if (year === null) return {};
  return metricForYear(entry, year);
}

/** UF sigla → metric for a specific year; omits null cells. */
export function getMetricByUfAndYear(
  variableId: string,
  year: number,
): Record<string, number> {
  const entry = getCatalogVariableById(variableId);
  if (!entry?.loadable) return {};
  return metricForYear(entry, year);
}

/** Same metrics keyed by IBGE two-digit UF code. */
export function getMetricByIbgeCode(variableId: string): Record<string, number> {
  const bySigla = getMetricByUf(variableId);
  return Object.fromEntries(
    Object.entries(bySigla).map(([sigla, value]) => [IBGE_BY_SIGLA[sigla] ?? sigla, value]),
  );
}

/**
 * For v1 packs every UF has every loadable variable — intersection helpers stay simple.
 * Returns catalog ids (not mock aliases).
 */
export function getCatalogVariableIdsByUf(): Record<string, string[]> {
  const ids = LOADABLE_ENTRIES.map((e) => e.id);
  return Object.fromEntries(UF_LIST.map(({ sigla }) => [sigla, [...ids]]));
}

export function getCatalogLabel(variableId: string): string {
  const resolved = resolveVariableId(variableId);
  return (
    getCatalogVariableById(resolved)?.label ??
    CATALOG_ID_TO_LABEL[resolved] ??
    variableId
  );
}
