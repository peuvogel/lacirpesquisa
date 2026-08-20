import {
  getCatalogLabel,
  getCatalogVariableById,
  getMetricByUf,
  getMetricByUfAndYear,
  resolveVariableId,
} from '@/features/catalog/catalogAnalysisData';
import {
  formatHandoffNumber,
  handoffMeasureHeader,
  parseSihVariableId,
} from '@/features/catalog/sihVariableIds';
import type { GroupTimeConfig, MapAnalysisGroup, MapProvenance } from './mapAnalysisState';
import { formatTimeSummary } from './mapAnalysisState';

const MAX_HANDOFF_ROWS = 10_000;

export type MetricLookup = (
  variableId: string,
  territoryKey: string,
  year: number | null,
) => number | null;

export interface PasteHandoffData {
  headers: string[];
  rows: string[][];
}

export interface AssembleHandoffOptions {
  /** When provenance is hybrid/paste and paste rows exist, prefer paste over catalog assembly. */
  pasteData?: PasteHandoffData | null;
  provenance?: MapProvenance;
  /** Supabase (or other) lookup; falls back to local UF packs. */
  metricLookup?: MetricLookup | null;
  /** Suggested test id — shapes columns for common didactic tests. */
  testId?: string | null;
}

export interface AssembledHandoffTable {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
}

function territoryLabel(group: MapAnalysisGroup, territory: MapAnalysisGroup['territoryIds'][number]): string {
  if (territory.level === 'municipio') {
    return territory.name || territory.ibgeCode;
  }
  return territory.sigla ?? territory.name ?? territory.ibgeCode;
}

function resolveYearFromTime(time: GroupTimeConfig): number | null {
  switch (time.mode) {
    case 'point': {
      if (!time.point?.trim()) return null;
      const year = parseInt(time.point, 10);
      return Number.isNaN(year) ? null : year;
    }
    case 'range': {
      if (!time.end?.trim()) return null;
      const year = parseInt(time.end, 10);
      return Number.isNaN(year) ? null : year;
    }
    case 'compare': {
      const matches = time.periodB?.match(/\d{4}/g);
      if (!matches?.length) return null;
      const year = parseInt(matches[matches.length - 1]!, 10);
      return Number.isNaN(year) ? null : year;
    }
    default:
      return null;
  }
}

function packMetric(variableId: string, sigla: string, time: GroupTimeConfig): number | null {
  const year = resolveYearFromTime(time);
  const byUf =
    year !== null ? getMetricByUfAndYear(variableId, year) : getMetricByUf(variableId);
  const value = byUf[sigla];
  return value === undefined ? null : value;
}

function resolveMetric(
  variableId: string,
  territory: MapAnalysisGroup['territoryIds'][number],
  time: GroupTimeConfig,
  metricLookup?: MetricLookup | null,
): number | null {
  const year = resolveYearFromTime(time);
  const keys: string[] = [];
  if (territory.level === 'municipio') {
    keys.push(territory.ibgeCode.padStart(6, '0').slice(0, 6));
    keys.push(territory.ibgeCode);
  } else {
    if (territory.sigla) keys.push(territory.sigla);
    keys.push(territory.ibgeCode.padStart(2, '0').slice(0, 2));
    keys.push(territory.ibgeCode);
  }

  if (metricLookup) {
    for (const key of keys) {
      const hit = metricLookup(variableId, key, year);
      if (hit !== null && hit !== undefined) return hit;
    }
  }

  // Local packs are UF-grain only — never invent município values from UF totals.
  if (territory.level === 'municipio') return null;
  const sigla = territory.sigla;
  if (!sigla) return null;
  return packMetric(variableId, sigla, time);
}

function diseaseLabelForVariable(variableId: string): string {
  const resolved = resolveVariableId(variableId);
  const entry = getCatalogVariableById(resolved);
  const parsed = parseSihVariableId(resolved);
  if (entry?.label) {
    // Strip measure prefix noise: "Internações — X" → "X"
    const cleaned = entry.label
      .replace(/^(Internações|Óbitos|Custo \(valor total\)|Dias de permanência|Taxa de mortalidade hospitalar)\s*[—\-–]\s*/i, '')
      .replace(/^Internações por\s+/i, '')
      .replace(/^Óbitos hospitalares por\s+/i, '')
      .trim();
    if (cleaned && cleaned !== entry.label) return cleaned;
  }
  return parsed?.diseaseId.replace(/_/g, ' ') ?? variableId;
}

function collectVariableHeaders(groups: MapAnalysisGroup[]): { id: string; header: string }[] {
  const diseaseIds = new Set(
    groups
      .flatMap((g) => g.variableIds)
      .map((id) => parseSihVariableId(resolveVariableId(id))?.diseaseId)
      .filter(Boolean),
  );
  const disambiguate = diseaseIds.size > 1;

  const seen = new Set<string>();
  const headers: { id: string; header: string }[] = [];
  for (const group of groups) {
    for (const variableId of group.variableIds) {
      const resolved = resolveVariableId(variableId);
      const header = handoffMeasureHeader(resolved, {
        disambiguate,
        diseaseLabel: diseaseLabelForVariable(resolved),
      });
      if (!seen.has(header)) {
        seen.add(header);
        headers.push({ id: variableId, header });
      }
    }
  }
  return headers;
}

function buildSourceLabel(groups: MapAnalysisGroup[]): string {
  const timeSummaries = [
    ...new Set(groups.map((group) => formatTimeSummary(group.time)).filter(Boolean)),
  ];
  const timePart = timeSummaries.length ? timeSummaries.join(', ') : 'sem período';
  const groupPart = groups.length === 1 ? '1 grupo' : `${groups.length} grupos`;
  return `Mapas: ${groupPart} · ${timePart}`;
}

function cleanPasteTable(paste: PasteHandoffData): AssembledHandoffTable {
  const headers = paste.headers.map((h) => h.trim());
  const rows = paste.rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== '' && cell.toLowerCase() !== 'n/d'));
  return { headers, rows: rows.slice(0, MAX_HANDOFF_ROWS), sourceLabel: 'Mapas: colado' };
}

/**
 * Assembles a clean tabular dataset from map groups for Estatística.
 *
 * Default shape: Território; Grupo; Período; {short measure columns…}
 * Skips rows with no numeric measures (no "n/d" pollution).
 * For two-group comparison tests, keeps Grupo so engines can split samples.
 */
export function assembleHandoffTable(
  groups: MapAnalysisGroup[],
  options: AssembleHandoffOptions = {},
): AssembledHandoffTable {
  const { pasteData, provenance = 'catalog', metricLookup = null, testId = null } = options;
  const sourceLabel = buildSourceLabel(groups);

  if (
    pasteData &&
    pasteData.headers.length >= 2 &&
    pasteData.rows.length > 0 &&
    (provenance === 'paste' || provenance === 'hybrid')
  ) {
    return { ...cleanPasteTable(pasteData), sourceLabel };
  }

  const variableHeaders = collectVariableHeaders(groups);
  const includePeriod =
    testId === 'prais-winsten' || groups.some((g) => g.time.mode !== 'point');
  const headers = includePeriod
    ? ['Território', 'Grupo', 'Período', ...variableHeaders.map((v) => v.header)]
    : ['Território', 'Grupo', ...variableHeaders.map((v) => v.header)];

  const rows: string[][] = [];

  for (const group of groups) {
    const periodLabel = formatTimeSummary(group.time);
    for (const territory of group.territoryIds) {
      const measureCells: string[] = [];
      let hasNumeric = false;

      for (const { id, header } of variableHeaders) {
        const variableId = group.variableIds.includes(id)
          ? id
          : (group.variableIds.find((vid) => {
              const candidate = variableHeaders.find((h) => h.id === vid);
              return candidate?.header === header;
            }) ?? '');

        if (!variableId) {
          measureCells.push('');
          continue;
        }

        const value = resolveMetric(variableId, territory, group.time, metricLookup);
        if (value === null) {
          measureCells.push('');
        } else {
          measureCells.push(formatHandoffNumber(value));
          hasNumeric = true;
        }
      }

      if (!hasNumeric) continue;

      const row = includePeriod
        ? [territoryLabel(group, territory), group.name, periodLabel, ...measureCells]
        : [territoryLabel(group, territory), group.name, ...measureCells];

      rows.push(row);
      if (rows.length >= MAX_HANDOFF_ROWS) {
        return { headers, rows, sourceLabel };
      }
    }
  }

  return { headers, rows, sourceLabel };
}

/** @deprecated Prefer handoffMeasureHeader — kept for callers that still show catalog labels in UI. */
export function catalogLabelForHandoff(variableId: string): string {
  return getCatalogLabel(variableId);
}
