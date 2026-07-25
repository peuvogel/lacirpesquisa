import {
  getCatalogLabel,
  getMetricByUf,
  getMetricByUfAndYear,
} from '@/features/catalog/catalogAnalysisData';
import type { GroupTimeConfig, MapAnalysisGroup, MapProvenance } from './mapAnalysisState';
import { formatTimeSummary } from './mapAnalysisState';

const MAX_HANDOFF_ROWS = 10_000;

export interface PasteHandoffData {
  headers: string[];
  rows: string[][];
}

export interface AssembleHandoffOptions {
  /** When provenance is hybrid/paste and paste rows exist, prefer paste over catalog assembly. */
  pasteData?: PasteHandoffData | null;
  provenance?: MapProvenance;
}

export interface AssembledHandoffTable {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
}

function territoryLabel(group: MapAnalysisGroup, territory: MapAnalysisGroup['territoryIds'][number]): string {
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

/** Returns pack metric as string, or n/d when missing (never invent 0 for null rates). */
function metricValue(variableId: string, sigla: string, time: GroupTimeConfig): string {
  const year = resolveYearFromTime(time);
  const byUf =
    year !== null ? getMetricByUfAndYear(variableId, year) : getMetricByUf(variableId);
  const value = byUf[sigla];
  return value === undefined ? 'n/d' : String(value);
}

function variableHeaderLabel(variableId: string): string {
  return getCatalogLabel(variableId);
}

function buildSourceLabel(groups: MapAnalysisGroup[]): string {
  const timeSummaries = [
    ...new Set(groups.map((group) => formatTimeSummary(group.time)).filter(Boolean)),
  ];
  const timePart = timeSummaries.length ? timeSummaries.join(', ') : 'sem período';
  const groupPart = groups.length === 1 ? '1 grupo' : `${groups.length} grupos`;
  return `Mapas: ${groupPart} · ${timePart}`;
}

function collectVariableHeaders(groups: MapAnalysisGroup[]): string[] {
  const seen = new Set<string>();
  const headers: string[] = [];
  for (const group of groups) {
    for (const variableId of group.variableIds) {
      const label = variableHeaderLabel(variableId);
      if (!seen.has(label)) {
        seen.add(label);
        headers.push(label);
      }
    }
  }
  return headers;
}

/**
 * Assembles a wide tabular dataset from map analysis groups and catalog pack metrics.
 *
 * Output shape: Território; Grupo; Período; {variable columns…} — one row per territory per group.
 * When `provenance` is `paste` or `hybrid` and `pasteData` is provided, paste rows are returned as-is.
 */
export function assembleHandoffTable(
  groups: MapAnalysisGroup[],
  options: AssembleHandoffOptions = {},
): AssembledHandoffTable {
  const { pasteData, provenance = 'catalog' } = options;
  const sourceLabel = buildSourceLabel(groups);

  if (
    pasteData &&
    pasteData.headers.length >= 2 &&
    pasteData.rows.length > 0 &&
    (provenance === 'paste' || provenance === 'hybrid')
  ) {
    return {
      headers: pasteData.headers,
      rows: pasteData.rows.slice(0, MAX_HANDOFF_ROWS),
      sourceLabel,
    };
  }

  const variableHeaders = collectVariableHeaders(groups);
  const headers = ['Território', 'Grupo', 'Período', ...variableHeaders];
  const rows: string[][] = [];

  for (const group of groups) {
    const periodLabel = formatTimeSummary(group.time);
    for (const territory of group.territoryIds) {
      const sigla = territory.sigla ?? territory.ibgeCode;
      const row: string[] = [
        territoryLabel(group, territory),
        group.name,
        periodLabel,
      ];

      for (const header of variableHeaders) {
        const variableId =
          group.variableIds.find((id) => variableHeaderLabel(id) === header) ?? '';
        if (!variableId || !group.variableIds.includes(variableId)) {
          row.push('');
          continue;
        }
        row.push(metricValue(variableId, sigla, group.time));
      }

      rows.push(row);
      if (rows.length >= MAX_HANDOFF_ROWS) {
        return { headers, rows, sourceLabel };
      }
    }
  }

  return { headers, rows, sourceLabel };
}
