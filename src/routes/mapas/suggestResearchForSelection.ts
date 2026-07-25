import { isTestAvailable } from '@/features/tests/registry';
import type { MapAnalysisGroup } from './mapAnalysisState';
import { MOCK_ID_TO_LABEL } from './mockAnalysisData';

export interface ResearchSuggestion {
  testId: string;
  rationale: string;
}

export interface SuggestResearchInput {
  groups: MapAnalysisGroup[];
  provenance?: 'mock' | 'paste' | 'hybrid';
}

const COUNT_KEYWORDS = ['óbito', 'interna', 'amputa'] as const;
const TIME_SERIES_KEYWORDS = ['taxa', 'série', 'temporal'] as const;

function isCountVariable(name: string): boolean {
  const lower = name.toLowerCase();
  return COUNT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function impliesTimeSeries(name: string): boolean {
  const lower = name.toLowerCase();
  return TIME_SERIES_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function formatTerritories(count: number, labels: string[]): string {
  if (count === 0) return 'nenhum território';
  if (count === 1) return labels[0] ?? '1 território';
  return `${count} territórios (${labels.join(', ')})`;
}

function variableLabel(variableId: string): string {
  return MOCK_ID_TO_LABEL[variableId] ?? variableId;
}

function collectUniqueTerritoryLabels(groups: MapAnalysisGroup[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const group of groups) {
    for (const territory of group.territoryIds) {
      const label = territory.sigla ?? territory.name ?? territory.ibgeCode;
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

function collectUniqueVariableLabels(groups: MapAnalysisGroup[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const group of groups) {
    for (const variableId of group.variableIds) {
      const label = variableLabel(variableId);
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

function hasCompareTime(groups: MapAnalysisGroup[]): boolean {
  return groups.some((group) => group.time.mode === 'compare');
}

function filterAvailableSuggestions(suggestions: ResearchSuggestion[]): ResearchSuggestion[] {
  const seen = new Set<string>();
  const filtered: ResearchSuggestion[] = [];

  for (const suggestion of suggestions) {
    if (seen.has(suggestion.testId)) continue;
    if (suggestion.testId !== 'demo' && !isTestAvailable(suggestion.testId)) continue;
    seen.add(suggestion.testId);
    filtered.push(suggestion);
  }

  return filtered;
}

function appendDemoFallback(
  suggestions: ResearchSuggestion[],
  groupCount: number,
  territoryCount: number,
  variableCount: number,
): ResearchSuggestion[] {
  const deduped = filterAvailableSuggestions(suggestions);
  deduped.push({
    testId: 'demo',
    rationale: `Explore o fluxo Dados → Configurar → Resultados com ${groupCount} grupo(s), ${territoryCount} território(s) e ${variableCount} variável(is) selecionados.`,
  });
  return deduped;
}

/** Group-aware suggestion engine for MAP-09 review handoff (D-20). */
export function suggestResearchForSelection(input: SuggestResearchInput): ResearchSuggestion[] {
  const { groups } = input;
  const territoryLabels = collectUniqueTerritoryLabels(groups);
  const variableLabels = collectUniqueVariableLabels(groups);
  const territoryCount = territoryLabels.length;
  const variableCount = variableLabels.length;
  const groupCount = groups.length;

  if (groupCount === 0) {
    return [
      {
        testId: 'demo',
        rationale:
          'Selecione estados e variáveis no mapa para ver análises sugeridas. Enquanto isso, o Teste demo mostra o fluxo completo da LACIR.',
      },
    ];
  }

  const suggestions: ResearchSuggestion[] = [];
  const territoryLabel = formatTerritories(territoryCount, territoryLabels);

  if (hasCompareTime(groups)) {
    suggestions.push({
      testId: 'prais-winsten',
      rationale: `Com ${groupCount} grupo(s) comparando dois períodos, o Prais-Winsten estima tendência temporal para ${territoryLabel}.`,
    });
  }

  if (groupCount >= 2 && variableCount === 1) {
    const variable = variableLabels[0] ?? '';
    if (groupCount === 2) {
      suggestions.push({
        testId: 't-student',
        rationale: `Com 2 grupos (${groups.map((g) => g.name).join(' vs ')}) e "${variable}", um teste t de Student compara se a média difere entre os grupos.`,
      });
    } else {
      suggestions.push({
        testId: 'anova-tukey',
        rationale: `Com ${groupCount} grupos e "${variable}", uma ANOVA compara as médias de todos os grupos de uma vez.`,
      });
      suggestions.push({
        testId: 'kruskal-dunn',
        rationale: `Alternativa não paramétrica para ${groupCount} grupos com "${variable}" — prefira se os dados não forem normais.`,
      });
    }
  }

  if (territoryCount >= 2 && variableCount === 1 && groupCount <= 1) {
    const variable = variableLabels[0] ?? '';
    if (territoryCount === 2) {
      suggestions.push({
        testId: 't-student',
        rationale: `Com ${territoryLabel} e a variável "${variable}", um teste t de Student compara se a média difere entre os dois grupos.`,
      });
    } else {
      suggestions.push({
        testId: 'anova-tukey',
        rationale: `Com ${territoryCount} estados e "${variable}", uma ANOVA compara as médias de todos os grupos de uma vez.`,
      });
      suggestions.push({
        testId: 'kruskal-dunn',
        rationale: `Alternativa não paramétrica para ${territoryCount} estados com "${variable}" — prefira se os dados não forem normais.`,
      });
    }
  }

  if (territoryCount === 1 && variableCount >= 2) {
    suggestions.push({
      testId: 'correlacao',
      rationale: `Com ${variableCount} variáveis em ${territoryLabels[0]}, a correlação verifica se elas caminham juntas.`,
    });
  }

  if (groupCount === 1 && variableCount >= 2) {
    suggestions.push({
      testId: 'correlacao',
      rationale: `Com ${variableCount} variáveis no grupo "${groups[0]?.name}", a correlação verifica se elas caminham juntas.`,
    });
  }

  for (const label of variableLabels) {
    if (impliesTimeSeries(label)) {
      suggestions.push({
        testId: 'prais-winsten',
        rationale: `"${label}" costuma ser acompanhada ao longo dos anos. O Prais-Winsten estima tendência temporal para ${territoryLabel}.`,
      });
      break;
    }
  }

  for (const label of variableLabels) {
    if (isCountVariable(label)) {
      suggestions.push({
        testId: 'poisson',
        rationale: `"${label}" é uma contagem de eventos. A regressão de Poisson modela fatores que influenciam sua frequência em ${territoryLabel}.`,
      });
    }
  }

  return appendDemoFallback(suggestions, groupCount, territoryCount, variableCount);
}

/** Legacy flat UF/variable selection adapter (Phase 1 IniciarPesquisaModal). */
export function suggestResearchFromFlatSelection(
  selectedUFs: string[],
  selectedVariables: string[],
): ResearchSuggestion[] {
  const pseudoGroups: MapAnalysisGroup[] =
    selectedUFs.length > 0
      ? [
          {
            id: 'legacy-flat',
            name: 'Seleção do mapa',
            territoryIds: selectedUFs.map((sigla) => ({
              level: 'uf' as const,
              ibgeCode: sigla,
              sigla,
              name: sigla,
            })),
            time: { mode: 'point', point: '2020' },
            variableIds: selectedVariables.map((label) => {
              const entry = Object.entries(MOCK_ID_TO_LABEL).find(([, v]) => v === label);
              return entry?.[0] ?? label;
            }),
          },
        ]
      : [];

  if (selectedUFs.length === 0 && selectedVariables.length === 0) {
    return suggestResearchForSelection({ groups: [] });
  }

  return suggestResearchForSelection({ groups: pseudoGroups, provenance: 'mock' });
}
