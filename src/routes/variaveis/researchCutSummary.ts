import { DISEASES } from '@/features/catalog/taxonomy';
import type { ResearchDesign, ResearchPeriod } from '@/features/research/types';
import type { ResearchCutSummaryViewModel } from './guidedViewModels';

export function buildResearchSummary(design: ResearchDesign): ResearchCutSummaryViewModel {
  const territoryCount = new Set(
    design.groups.flatMap((group) => group.territories.map((territory) => territory.id)),
  ).size;
  const groupNames = design.groups.map((group) => group.name).join(', ');
  const diseaseNames = design.diseaseIds.map(diseaseLabel).join(', ');

  return {
    eyebrow: 'Recorte recebido de Mapas',
    title: `${groupNames} · ${diseaseNames}`,
    facts: [
      `${territoryCount} ${territoryCount === 1 ? 'território' : 'territórios'}`,
      formatResearchPeriod(design),
      design.locationBasis === 'ocorrencia' ? 'Local de ocorrência' : 'Local de residência',
    ],
  };
}

export function diseaseLabel(diseaseId: string): string {
  return DISEASES.find((disease) => disease.id === diseaseId)?.label
    ?? diseaseId.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function formatResearchPeriodLabel(period: ResearchPeriod): string {
  if (period.mode === 'point') return period.point;
  if (period.mode === 'range') {
    const annualStart = annualBoundaryYear(period.start, '01');
    const annualEnd = annualBoundaryYear(period.end, '12');
    return annualStart && annualEnd
      ? `${annualStart}–${annualEnd}`
      : `${period.start}–${period.end}`;
  }
  const annualStart = annualBoundaryYear(period.periodA, '01');
  const annualEnd = annualBoundaryYear(period.periodB, '12');
  return annualStart && annualEnd
    ? `${annualStart} × ${annualEnd}`
    : `${period.periodA} × ${period.periodB}`;
}

function annualBoundaryYear(value: string, month: '01' | '12'): string | null {
  return new RegExp(`^(\\d{4})-${month}$`).exec(value)?.[1] ?? null;
}

export function formatResearchPeriod(design: ResearchDesign): string {
  if (design.period.scope === 'shared') return formatResearchPeriodLabel(design.period.time);
  return 'Períodos definidos por grupo';
}
