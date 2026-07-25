/**
 * @deprecated Phase 5 — prefer `@/features/catalog/catalogAnalysisData`.
 * Thin re-exports keep older test imports compiling; metrics come from packs, not UF_WEIGHT.
 */
export {
  CATALOG_ANALYSIS_VARIABLES as MOCK_ANALYSIS_VARIABLES,
  CATALOG_ID_TO_LABEL as MOCK_ID_TO_LABEL,
  getAnalysisVariableById as getMockVariableById,
  getCatalogVariableIdsByUf as getMockVariableIdsByUf,
  getDefaultCatalogVariableId as getDefaultMockVariableId,
  getMetricByIbgeCode as getMockMetricByIbgeCode,
  getMetricByUf as getMockMetricByUf,
  getMetricByUfAndYear as getMockMetricByUfAndYear,
  getCatalogTimeSeriesYears,
  type CatalogAnalysisVariable as MockVariable,
} from '@/features/catalog/catalogAnalysisData';

import { getCatalogTimeSeriesYears } from '@/features/catalog/catalogAnalysisData';

/** @deprecated Use getCatalogTimeSeriesYears(variableId) — pack years, not 2018–2022 didactic list. */
export const MOCK_TIME_SERIES_YEARS: readonly number[] = getCatalogTimeSeriesYears(
  'sih.embolia_trombose.internacoes',
);

/** Legacy Phase 1 label → catalog id (kept for old VariablePanel / flat-selection helpers). */
export const MOCK_LABEL_TO_ID: Record<string, string> = {
  'Internações por causa': 'sih.embolia_trombose.internacoes',
  'Internações hospitalares': 'sih.embolia_trombose.internacoes',
  'Óbitos hospitalares': 'sih.embolia_trombose.obitos',
  'Amputações de membros inferiores': 'sih.amputacao_mmii.internacoes',
  'Internações por embolia e trombose arteriais': 'sih.embolia_trombose.internacoes',
  'Óbitos hospitalares por embolia e trombose arteriais': 'sih.embolia_trombose.obitos',
  'Internações por amputação de membros inferiores': 'sih.amputacao_mmii.internacoes',
};
