import { useMemo, type Dispatch } from 'react';
import { DISEASES, parseCatalogId } from '@/features/catalog/taxonomy';
import { MeasureDiseasePicker } from './MeasureDiseasePicker';
import { ResearchAccordionPanel } from './ResearchAccordionPanel';
import type { MapAnalysisAction } from './mapAnalysisState';

export interface SharedDiseasePanelProps {
  selectedVariableIds: string[];
  dispatch: Dispatch<MapAnalysisAction>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/**
 * Disease selection shared by every analysis group — sits above the per-group panel.
 */
export function SharedDiseasePanel({
  selectedVariableIds,
  dispatch,
  open,
  onOpenChange,
  className,
}: SharedDiseasePanelProps) {
  const summary = useMemo(() => {
    const ids = [
      ...new Set(
        selectedVariableIds
          .map((id) => parseCatalogId(id)?.diseaseId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ids.length === 0) return 'Nenhuma doença selecionada';
    const labels = ids.map(
      (id) => DISEASES.find((d) => d.id === id)?.label ?? id,
    );
    if (labels.length === 1) return labels[0]!;
    if (labels.length === 2) return `${labels[0]} · ${labels[1]}`;
    return `${labels[0]} +${labels.length - 1}`;
  }, [selectedVariableIds]);

  return (
    <ResearchAccordionPanel
      open={open}
      onOpenChange={onOpenChange}
      step="1 · Doença"
      title="Valem para todos os grupos"
      subtitle="Escolha uma ou mais doenças — o período fica no passo seguinte; as medidas, no grupo."
      summary={summary}
      className={className}
      aria-label="Doença da pesquisa"
    >
      <MeasureDiseasePicker
        selectedVariableIds={selectedVariableIds}
        onToggleDisease={(diseaseId) =>
          dispatch({ type: 'TOGGLE_DISEASE_ALL_GROUPS', diseaseId })
        }
        diseasesOnly
      />
    </ResearchAccordionPanel>
  );
}
