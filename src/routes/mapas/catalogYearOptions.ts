import { getCatalogTimeSeriesYears } from '@/features/catalog/catalogAnalysisData';
import { parseCatalogId } from '@/features/catalog/taxonomy';
import { isTimeValid, type GroupTimeConfig } from './mapAnalysisState';

/**
 * Years with pack data for the selected disease variables.
 * Empty when nothing loadable is selected — never invent years from another disease.
 */
export function resolveCatalogYearOptions(variableIds: string[]): string[] {
  const diseaseIds = variableIds.filter((id) => Boolean(parseCatalogId(id)));
  if (diseaseIds.length === 0) return [];

  let intersection: number[] | null = null;
  for (const id of diseaseIds) {
    const years = getCatalogTimeSeriesYears(id);
    if (years.length === 0) continue;
    intersection =
      intersection === null
        ? [...years]
        : intersection.filter((y) => years.includes(y));
  }
  return (intersection ?? []).map(String);
}

export function isPeriodReady(
  time: GroupTimeConfig | null | undefined,
  yearOptions: string[],
): boolean {
  if (!time || yearOptions.length === 0 || !isTimeValid(time)) return false;
  const yearSet = new Set(yearOptions);
  const start = (time.start ?? time.point)?.slice(0, 4);
  const end = (time.end ?? time.point)?.slice(0, 4);
  return Boolean(start && yearSet.has(start) && end && yearSet.has(end));
}
