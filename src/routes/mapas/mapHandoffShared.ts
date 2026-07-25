import { isTestAvailable } from '@/features/tests/registry';
import type { TabularInputOptions } from '@/shared/data-input/types';
import type { ResearchSuggestion } from './suggestResearchForSelection';

/** Mapas → Estatística: suggested test if available, else t-student, else demo (T-04-07 whitelist). */
export function resolveHandoffTestId(suggestions: ResearchSuggestion[]): string {
  const primarySuggested = suggestions.find((suggestion) => suggestion.testId !== 'demo');
  if (primarySuggested && isTestAvailable(primarySuggested.testId)) {
    return primarySuggested.testId;
  }
  if (isTestAvailable('t-student')) {
    return 't-student';
  }
  return 'demo';
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
      'Óbitos',
      'Óbitos hospitalares',
      'Quantidade',
      'Valor',
      'Nascidos vivos',
    ],
    grupo: ['Grupo'],
    periodo: ['Período'],
  },
  requiredKeys: ['territorio', 'medida'],
  numericKeys: ['medida'],
  expectedFormatLabel: 'Território; Medida numérica',
};

/** Rejects unknown or unavailable test ids before navigation (T-04-07-01). */
export function guardHandoffTestId(testId: string, suggestions: ResearchSuggestion[]): string {
  if (isTestAvailable(testId)) return testId;
  return resolveHandoffTestId(suggestions);
}
