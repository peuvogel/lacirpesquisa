/**
 * Mapas metric facade over committed catalog packs (D-02, D-18, D-19).
 * Sync imports keep Phase 4 call-site ergonomics (getMetricByUf*) without runtime TABNET.
 *
 * Null handling: omit UF keys when the pack cell is null — never coerce null→0 (T-05-11).
 */
import type { CatalogEntry, PackFile } from './types';
import variablesJson from '../../../public/data/catalog/variables.json';
import emboliaETromboseArteriaisPackJson from '../../../public/data/catalog/packs/sih.embolia_e_trombose_arteriais_uf.json';
import amputacaoMmiiPackJson from '../../../public/data/catalog/packs/sih.amputacao_mmii_uf.json';
import acidVascularCerebrNaoEspecHemorragOuIsquemPackJson from '../../../public/data/catalog/packs/sih.acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem_uf.json';
import flebiteTromboflebiteEmboliaETromboseVenosaPackJson from '../../../public/data/catalog/packs/sih.flebite_tromboflebite_embolia_e_trombose_venosa_uf.json';
import infartoCerebralPackJson from '../../../public/data/catalog/packs/sih.infarto_cerebral_uf.json';
import laringiteETraqueiteAgudasPackJson from '../../../public/data/catalog/packs/sih.laringite_e_traqueite_agudas_uf.json';
import otiteMediaEOutrTranstOuvidoMedioApofMastPackJson from '../../../public/data/catalog/packs/sih.otite_media_e_outr_transt_ouvido_medio_apof_mast_uf.json';
import outrasDoencasDasArteriasArteriolasECapilaresPackJson from '../../../public/data/catalog/packs/sih.outras_doencas_das_arterias_arteriolas_e_capilares_uf.json';
import outrasDoencasDoOlhoEAnexosPackJson from '../../../public/data/catalog/packs/sih.outras_doencas_do_olho_e_anexos_uf.json';
import outrasDoencasVascularesPerifericasPackJson from '../../../public/data/catalog/packs/sih.outras_doencas_vasculares_perifericas_uf.json';

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
  'mock.internacoes': 'sih.embolia_e_trombose_arteriais.internacoes',
  'mock.obitos': 'sih.embolia_e_trombose_arteriais.obitos',
  // mock.taxa_mortalidade intentionally NOT aliased (infantil ≠ hospital SIH rates)
};

const CATALOG_ENTRIES = variablesJson as CatalogEntry[];
const PACKS: Record<string, PackFile> = {
  'sih.embolia_e_trombose_arteriais_uf': emboliaETromboseArteriaisPackJson as PackFile,
  'sih.amputacao_mmii_uf': amputacaoMmiiPackJson as PackFile,
  'sih.acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem_uf': acidVascularCerebrNaoEspecHemorragOuIsquemPackJson as PackFile,
  'sih.flebite_tromboflebite_embolia_e_trombose_venosa_uf': flebiteTromboflebiteEmboliaETromboseVenosaPackJson as PackFile,
  'sih.infarto_cerebral_uf': infartoCerebralPackJson as PackFile,
  'sih.laringite_e_traqueite_agudas_uf': laringiteETraqueiteAgudasPackJson as PackFile,
  'sih.otite_media_e_outr_transt_ouvido_medio_apof_mast_uf': otiteMediaEOutrTranstOuvidoMedioApofMastPackJson as PackFile,
  'sih.outras_doencas_das_arterias_arteriolas_e_capilares_uf': outrasDoencasDasArteriasArteriolasECapilaresPackJson as PackFile,
  'sih.outras_doencas_do_olho_e_anexos_uf': outrasDoencasDoOlhoEAnexosPackJson as PackFile,
  'sih.outras_doencas_vasculares_perifericas_uf': outrasDoencasVascularesPerifericasPackJson as PackFile,
};

const ENTRIES_BY_ID = new Map(CATALOG_ENTRIES.map((entry) => [entry.id, entry]));

const LOADABLE_ENTRIES = CATALOG_ENTRIES.filter(
  (entry) => entry.loadable && entry.packId && entry.columnKey,
);

/** UF siglas + IBGE codes derived from packs (keeps this module free of Mapas imports). */
const UF_META: Array<{ sigla: string; ibgeCode: string }> = (() => {
  const seen = new Map<string, string>();
  for (const pack of Object.values(PACKS)) {
    for (const row of pack.rows) {
      const sigla = String(row.uf);
      if (!seen.has(sigla)) seen.set(sigla, String(row.uf_codigo));
    }
  }
  return [...seen.entries()]
    .map(([sigla, ibgeCode]) => ({ sigla, ibgeCode }))
    .sort((a, b) => a.sigla.localeCompare(b.sigla));
})();

const IBGE_BY_SIGLA: Record<string, string> = Object.fromEntries(
  UF_META.map(({ sigla, ibgeCode }) => [sigla, ibgeCode]),
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
  const preferred = 'sih.embolia_e_trombose_arteriais.internacoes';
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

/** Coerce pack cells that were serialized as numeric strings (multi-disease packs). */
function coercePackNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
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
    const ano = coercePackNumber(row.ano);
    if (ano === null || nullYearSet.has(ano)) continue;
    if (coercePackNumber(row[entry.columnKey]) !== null) {
      yearsWithData.add(ano);
    }
  }

  // Prefer years that actually have numeric cells; if cells were all strings and
  // still empty after coerce, fall back to catalog metadata for that pack.
  if (yearsWithData.size === 0 && fromEntry && fromEntry.length > 0) {
    return [...fromEntry].sort((a, b) => a - b);
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
    if (coercePackNumber(row.ano) !== year) continue;
    const sigla = String(row.uf);
    const value = coercePackNumber(row[entry.columnKey]);
    if (value !== null) out[sigla] = value;
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
  return Object.fromEntries(UF_META.map(({ sigla }) => [sigla, [...ids]]));
}

export function getCatalogLabel(variableId: string): string {
  const resolved = resolveVariableId(variableId);
  return (
    getCatalogVariableById(resolved)?.label ??
    CATALOG_ID_TO_LABEL[resolved] ??
    variableId
  );
}
