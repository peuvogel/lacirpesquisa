import type { MapAnalysisGroup, MapProvenance } from './mapAnalysisState';

export interface ResearchSuggestion {
  testId: string;
  rationale: string;
}

export interface SuggestResearchInput {
  groups: MapAnalysisGroup[];
  provenance?: MapProvenance;
}

/**
 * Legacy compatibility adapter. Group counts, period labels and variable
 * names are not evidence of independence, distribution or model fit.
 */
export function suggestResearchForSelection(_input: SuggestResearchInput): ResearchSuggestion[] {
  return [];
}

/** Flat labels cannot safely select a statistical test. */
export function suggestResearchFromFlatSelection(
  _selectedUFs: string[],
  _selectedVariables: string[],
): ResearchSuggestion[] {
  return [];
}
