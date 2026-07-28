import { isTestAvailable } from '@/features/tests/registry';
import type { TabularInputOptions } from '@/shared/data-input/types';
import type { ResearchSuggestion } from './suggestResearchForSelection';

/** Mapas → Estatística: first available suggestion, else t-student. */
export function resolveHandoffTestId(suggestions: ResearchSuggestion[]): string {
  const primarySuggested = suggestions.find((suggestion) => isTestAvailable(suggestion.testId));
  if (primarySuggested) {
    return primarySuggested.testId;
  }
  return isTestAvailable('t-student') ? 't-student' : (suggestions[0]?.testId ?? 't-student');
}

/** Broad DATASUS-shaped aliases so junk paste errors while typical TABNET tables still load. */
export const MAPAS_TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    territorio: ['Município', 'UF', 'Unidade da Federação', 'Estado', 'Território'],
    medida: [
      'Taxa por 100k',
      'Taxa',
      'Internações',
      'Internações hospitalares',
      'Internações por embolia e trombose arteriais',
      'Internações por amputação de membros inferiores',
      'Óbitos',
      'Óbitos hospitalares',
      'Óbitos hospitalares por embolia e trombose arteriais',
      'Valor total',
      'Dias de permanência',
      'Taxa de mortalidade (%)',
      'Quantidade',
      'Valor',
      'Nascidos vivos',
    ],
    grupo: ['Grupo'],
    periodo: ['Período'],
  },
  // Grupo is enough for two-sample tests; medida covers the numeric column(s).
  requiredKeys: ['territorio', 'medida'],
  numericKeys: ['medida'],
  expectedFormatLabel: 'Território; Grupo; Medida numérica',
};

/** Rejects unknown or unavailable test ids before navigation (T-04-07-01). */
export function guardHandoffTestId(testId: string, suggestions: ResearchSuggestion[]): string {
  if (isTestAvailable(testId)) return testId;
  return resolveHandoffTestId(suggestions);
}
