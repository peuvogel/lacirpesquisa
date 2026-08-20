import { DISEASES, parseCatalogId } from '@/features/catalog/taxonomy';
import type { ResearchGoal } from '@/features/research/types';
import type { GroupTimeConfig, MapAnalysisState } from './mapAnalysisState';

export type ComparisonAxis = 'none' | 'place' | 'period' | 'disease' | 'exposure';

export interface MapQuestionDraft {
  comparisonAxis: ComparisonAxis;
  objective: ResearchGoal | null;
}

export interface MapQuestionValidation {
  safeToStart: boolean;
  reasons: string[];
}

export function createInitialMapQuestionDraft(): MapQuestionDraft {
  return { comparisonAxis: 'none', objective: null };
}

function hasValidTime(time: GroupTimeConfig): boolean {
  if (time.mode === 'point') return Boolean(time.point?.trim());
  if (time.mode === 'range') {
    return Boolean(time.start?.trim() && time.end?.trim() && time.start <= time.end);
  }
  return Boolean(time.periodA?.trim() && time.periodB?.trim() && time.periodA !== time.periodB);
}

function selectedDiseaseIds(state: MapAnalysisState): string[] {
  return [
    ...new Set(
      state.groups.flatMap((group) =>
        group.variableIds.flatMap((id) => {
          const diseaseId = parseCatalogId(id)?.diseaseId;
          return diseaseId ? [diseaseId] : [];
        }),
      ),
    ),
  ];
}

export function validateMapQuestion(
  state: MapAnalysisState,
  draft: MapQuestionDraft,
): MapQuestionValidation {
  const reasons: string[] = [];
  const populatedGroups = state.groups.filter((group) => group.territoryIds.length > 0);

  if (populatedGroups.length === 0) {
    reasons.push('Selecione uma população no mapa.');
  }
  if (state.groups.some((group) => group.territoryIds.length === 0)) {
    reasons.push('Todo comparador criado precisa receber ao menos um território.');
  }
  if (selectedDiseaseIds(state).length === 0) {
    reasons.push('Selecione ao menos uma doença ou condição.');
  }
  if (state.groups.some((group) => !hasValidTime(group.time))) {
    reasons.push('Defina um período válido para cada população.');
  }
  if (!draft.objective) {
    reasons.push('Escolha se deseja descrever, comparar ou fazer ambos.');
  }

  if (draft.comparisonAxis === 'none' && draft.objective && draft.objective !== 'describe') {
    reasons.push('Sem um eixo de comparação, o objetivo seguro é Descrever.');
  }
  if (draft.comparisonAxis === 'place' && populatedGroups.length < 2) {
    reasons.push('Adicione e preencha um comparador no mapa para comparar lugares.');
  }
  if (draft.comparisonAxis === 'period') {
    const distinctPeriods = new Set(state.groups.map((group) => formatPeriod(group.time)));
    if (state.periodScope !== 'per-group' || populatedGroups.length < 2 || distinctPeriods.size < 2) {
      reasons.push('Prepare dois períodos distintos usando os controles de período existentes.');
    }
  }
  if (draft.comparisonAxis === 'disease') {
    reasons.push(
      'Neste recorte, as doenças ainda são combinadas antes da unidade analítica; a comparação por doença permanece bloqueada para não produzir um teste espúrio.',
    );
  }
  if (draft.comparisonAxis === 'exposure') {
    reasons.push(
      'A comparação por exposição exige uma exposição realmente carregável e ligada ao território e período; metadados de catálogo não bastam.',
    );
  }

  return { safeToStart: reasons.length === 0, reasons };
}

function territoryPhrase(state: MapAnalysisState): string {
  const labels = state.groups.flatMap((group) => group.territoryIds.map((territory) => territory.name));
  const unique = [...new Set(labels.filter(Boolean))];
  if (unique.length === 0) return 'na população selecionada';
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} e ${unique[1]}`;
  return `${unique[0]} e mais ${unique.length - 1} territórios`;
}

function groupTerritoryPhrase(state: MapAnalysisState): string[] {
  return state.groups.map((group) => {
    const labels = [...new Set(group.territoryIds.map((territory) => territory.name).filter(Boolean))];
    if (labels.length === 1) return labels[0]!;
    if (labels.length > 1) return `${labels[0]} e mais ${labels.length - 1}`;
    return group.name;
  });
}

function diseasePhrase(state: MapAnalysisState): string {
  const labels = selectedDiseaseIds(state).map(
    (id) => DISEASES.find((disease) => disease.id === id)?.label ?? id,
  );
  if (labels.length === 0) return 'a condição escolhida';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels[0]} e mais ${labels.length - 1} condições`;
}

function year(value: string | undefined): string {
  return value?.slice(0, 4) ?? '';
}

function formatPeriod(time: GroupTimeConfig): string {
  if (time.mode === 'point') return year(time.point);
  if (time.mode === 'range') {
    const start = year(time.start);
    const end = year(time.end);
    return start && end ? (start === end ? start : `${start}–${end}`) : '';
  }
  return time.periodA && time.periodB ? `${year(time.periodA)} × ${year(time.periodB)}` : '';
}

function sharedPeriodPhrase(state: MapAnalysisState): string {
  const formatted = formatPeriod(state.sharedTime);
  if (!formatted) return 'no período escolhido';
  if (formatted.includes('–')) {
    const [start, end] = formatted.split('–');
    return `entre ${start} e ${end}`;
  }
  return `em ${formatted}`;
}

export function buildQuestionSentence(state: MapAnalysisState, draft: MapQuestionDraft): string {
  const disease = diseasePhrase(state);
  const place = territoryPhrase(state);
  const period = sharedPeriodPhrase(state);

  switch (draft.comparisonAxis) {
    case 'place': {
      const groups = groupTerritoryPhrase(state);
      const comparison = groups.length >= 2 ? `${groups[0]} e ${groups[1]}` : place;
      return `Os dados de ${disease} diferem entre ${comparison} ${period}?`;
    }
    case 'period': {
      const periods = [...new Set(state.groups.map((group) => formatPeriod(group.time)).filter(Boolean))];
      const comparison = periods.length >= 2 ? `${periods[0]} e ${periods[1]}` : 'os períodos escolhidos';
      return `Na ${place}, os dados de ${disease} diferem entre ${comparison}?`;
    }
    case 'disease':
      return `Na ${place}, os desfechos diferem entre as doenças selecionadas ${period}?`;
    case 'exposure':
      return `Na ${place}, os desfechos de ${disease} se relacionam com uma exposição territorial ${period}?`;
    case 'none':
    default:
      return `Na ${place}, como se comportaram os dados de ${disease} ${period}?`;
  }
}
