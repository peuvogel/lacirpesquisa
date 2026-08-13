import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ResearchDesign } from '@/features/research/types';
import { useSession } from '@/shared/session/SessionProvider';
import type { SelectionSummary } from './mapAnalysisState';
import { SelectionSummaryStrip } from './SelectionSummaryStrip';

export interface ReviewAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SelectionSummary;
  researchDesign: ResearchDesign;
}

/** A short confirmation boundary: Mapas defines the cut; Variables defines the analysis. */
export function ReviewAnalysisDialog({
  open,
  onOpenChange,
  summary,
  researchDesign,
}: ReviewAnalysisDialogProps) {
  const navigate = useNavigate();
  const { setDataset, setResearchDesign } = useSession();

  function handleContinue() {
    setDataset(null);
    setResearchDesign(researchDesign);
    onOpenChange(false);
    navigate('/variaveis');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="review-analysis-dialog">
        <DialogHeader>
          <DialogTitle className="font-sans text-heading font-bold text-text">
            Seu recorte está pronto
          </DialogTitle>
          <DialogDescription>
            Na próxima etapa, você escolhe as variáveis para descrever ou comparar este recorte.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2" aria-labelledby="review-selection-heading">
          <h2 id="review-selection-heading" className="font-sans text-label font-bold text-text">
            Sua seleção
          </h2>
          <SelectionSummaryStrip summary={summary} className="border-0 bg-elevated px-3 py-2" />
        </section>

        <div className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-3">
          <p className="font-sans text-sm font-bold text-text">Próximo passo: variáveis</p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-text-muted">
            Escolha somente as medidas que respondem à sua pergunta. Os testes serão avaliados depois,
            conforme o desenho e os dados disponíveis.
          </p>
        </div>

        <Button type="button" className="w-full" onClick={handleContinue}>
          Continuar para Variáveis
        </Button>
      </DialogContent>
    </Dialog>
  );
}
