export interface ResearchSuggestion {
  testId: string;
  rationale: string;
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

function formatUFs(selectedUFs: string[]): string {
  if (selectedUFs.length === 1) return selectedUFs[0] ?? '';
  return `${selectedUFs.length} estados (${selectedUFs.join(', ')})`;
}

export function suggestResearchForSelection(
  selectedUFs: string[],
  selectedVariables: string[],
): ResearchSuggestion[] {
  const ufCount = selectedUFs.length;
  const varCount = selectedVariables.length;

  if (ufCount === 0 && varCount === 0) {
    return [
      {
        testId: 'demo',
        rationale:
          'Selecione estados e variáveis no mapa para ver análises sugeridas — enquanto isso, o Teste demo mostra o fluxo completo da LACIR.',
      },
    ];
  }

  const suggestions: ResearchSuggestion[] = [];
  const ufLabel = formatUFs(selectedUFs);

  if (ufCount >= 2 && varCount === 1) {
    const variable = selectedVariables[0] ?? '';
    if (ufCount === 2) {
      suggestions.push({
        testId: 't-student',
        rationale: `Com ${ufLabel} e a variável "${variable}", um teste t de Student compara se a média difere entre os dois grupos.`,
      });
    } else {
      suggestions.push({
        testId: 'anova-tukey',
        rationale: `Com ${ufCount} estados e "${variable}", uma ANOVA compara as médias de todos os grupos de uma vez.`,
      });
      suggestions.push({
        testId: 'kruskal-dunn',
        rationale: `Alternativa não paramétrica para ${ufCount} estados com "${variable}" — prefira se os dados não forem normais.`,
      });
    }
  }

  if (ufCount === 1 && varCount >= 2) {
    suggestions.push({
      testId: 'correlacao',
      rationale: `Com ${varCount} variáveis em ${selectedUFs[0]}, a correlação verifica se elas caminham juntas.`,
    });
  }

  if (selectedVariables.some(impliesTimeSeries)) {
    const seriesVariable = selectedVariables.find(impliesTimeSeries) ?? '';
    suggestions.push({
      testId: 'prais-winsten',
      rationale: `"${seriesVariable}" costuma ser acompanhada ao longo dos anos — o Prais-Winsten estima tendência temporal para ${ufLabel}.`,
    });
  }

  for (const variable of selectedVariables) {
    if (isCountVariable(variable)) {
      suggestions.push({
        testId: 'poisson',
        rationale: `"${variable}" é uma contagem de eventos — a regressão de Poisson modela fatores que influenciam sua frequência em ${ufLabel}.`,
      });
    }
  }

  const seen = new Set<string>();
  const deduped = suggestions.filter((suggestion) => {
    if (seen.has(suggestion.testId)) return false;
    seen.add(suggestion.testId);
    return true;
  });

  deduped.push({
    testId: 'demo',
    rationale: `Explore o fluxo Dados → Configurar → Resultados com ${ufCount} estado(s) e ${varCount} variável(is) selecionados — único teste disponível hoje.`,
  });

  return deduped;
}
