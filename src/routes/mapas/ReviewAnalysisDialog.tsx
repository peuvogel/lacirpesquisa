import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useSession } from '@/shared/session/SessionProvider';
import { assembleHandoffTable, type PasteHandoffData } from './assembleHandoffTable';
import type { MapAnalysisGroup, SelectionSummary } from './mapAnalysisState';
import {
  guardHandoffTestId,
  MAPAS_TABULAR_OPTIONS,
  resolveHandoffTestId,
} from './mapHandoffShared';
import { getCollectionLinks } from './mockCollectionLinks';
import { MOCK_ID_TO_LABEL } from './mockAnalysisData';
import { SelectionSummaryStrip } from './SelectionSummaryStrip';
import { suggestResearchForSelection } from './suggestResearchForSelection';
import { SuggestedTestCard } from './SuggestedTestCard';
import { TestPickerSelect } from './TestPickerSelect';

export interface ReviewAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: MapAnalysisGroup[];
  summary: SelectionSummary;
  provenance?: 'mock' | 'paste' | 'hybrid';
  pasteData?: PasteHandoffData | null;
}

function collectVariableLabelsForLinks(groups: MapAnalysisGroup[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const group of groups) {
    for (const variableId of group.variableIds) {
      const label = MOCK_ID_TO_LABEL[variableId] ?? variableId;
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

export function ReviewAnalysisDialog({
  open,
  onOpenChange,
  groups,
  summary,
  provenance = 'mock',
  pasteData,
}: ReviewAnalysisDialogProps) {
  const navigate = useNavigate();
  const { setDataset } = useSession();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const suggestions = useMemo(
    () => suggestResearchForSelection({ groups, provenance }),
    [groups, provenance],
  );

  const primarySuggestion = useMemo(
    () => suggestions.find((s) => s.testId !== 'demo') ?? suggestions[0],
    [suggestions],
  );

  const effectiveTestId = guardHandoffTestId(
    selectedTestId ?? resolveHandoffTestId(suggestions),
    suggestions,
  );

  const variableLabels = useMemo(() => collectVariableLabelsForLinks(groups), [groups]);

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      const { headers, rows, sourceLabel } = assembleHandoffTable(groups, {
        pasteData,
        provenance,
      });

      if (headers.length < 2 || rows.length === 0) return;

      const recognizedColumns = deriveRecognizedColumnsFromTabular(
        headers,
        rows,
        MAPAS_TABULAR_OPTIONS,
      );

      setDataset({
        headers,
        rows,
        sourceLabel,
        confirmedAt: Date.now(),
      });

      onOpenChange(false);
      navigate('/', {
        state: {
          activeTestId: effectiveTestId,
          recognizedColumns,
        },
      });
    } finally {
      setIsConfirming(false);
    }
  }

  const canConfirm =
    groups.length > 0 &&
    (provenance === 'mock'
      ? groups.every((g) => g.territoryIds.length > 0 && g.variableIds.length > 0)
      : Boolean(pasteData?.rows.length));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,820px)] overflow-y-auto sm:max-w-lg" data-testid="review-analysis-dialog">
        <DialogHeader>
          <DialogTitle className="font-sans text-heading font-bold text-text">
            Revisar antes de analisar
          </DialogTitle>
          <DialogDescription>
            Confira territórios, grupos, período e variáveis. A LACIR sugere um teste — você pode
            trocar antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2" aria-labelledby="review-selection-heading">
          <h2 id="review-selection-heading" className="font-sans text-label font-bold text-text">
            Sua seleção
          </h2>
          <SelectionSummaryStrip summary={summary} className="border-0 bg-elevated px-3 py-2" />
        </section>

        <section className="space-y-3" aria-labelledby="review-suggested-test-heading">
          <h2 id="review-suggested-test-heading" className="font-sans text-label font-bold text-text">
            Teste sugerido
          </h2>
          {primarySuggestion ? (
            <SuggestedTestCard
              testId={primarySuggestion.testId}
              rationale={primarySuggestion.rationale}
            />
          ) : null}
          <TestPickerSelect value={effectiveTestId} onValueChange={setSelectedTestId} />
        </section>

        <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="px-0 text-primary">
              Ver fontes oficiais
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {variableLabels.length === 0 ? (
              <p className="text-sm text-text-muted">
                Selecione variáveis nos grupos para ver links oficiais.
              </p>
            ) : (
              variableLabels.map((variable) => {
                const links = getCollectionLinks(variable);
                return (
                  <div key={variable} className="rounded-lg border border-border px-3 py-3">
                    <h3 className="font-sans text-sm font-bold text-text">{variable}</h3>
                    {links.length === 0 ? (
                      <p className="mt-1 text-sm text-text-muted">sem link cadastrado ainda</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {links.map((link) => (
                          <li key={`${variable}-${link.label}`}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-sans text-sm font-bold text-primary underline-offset-2 hover:underline"
                            >
                              {link.label}
                            </a>
                            {link.note ? (
                              <p className="mt-0.5 text-sm text-text-muted">{link.note}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </CollapsibleContent>
        </Collapsible>

        <Button
          type="button"
          className="w-full"
          disabled={!canConfirm || isConfirming}
          aria-busy={isConfirming}
          onClick={() => void handleConfirm()}
        >
          {isConfirming ? 'Preparando…' : 'Ir para Estatística'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export { resolveHandoffTestId, MAPAS_TABULAR_OPTIONS, guardHandoffTestId } from './mapHandoffShared';
