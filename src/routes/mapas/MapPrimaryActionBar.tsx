import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface MapPrimaryActionBarProps {
  canReview: boolean;
  analysisMode?: 'descriptive' | 'comparison';
  blockedMessage?: string;
  analysisUnlocked?: boolean;
  onReview: () => void;
  onPasteTerritories: () => void;
  onClearMap: () => void;
  clearConfirmOpen: boolean;
  onClearConfirmOpenChange: (open: boolean) => void;
  onConfirmClear: () => void;
  className?: string;
}

export function MapPrimaryActionBar({
  canReview,
  analysisMode = 'comparison',
  blockedMessage = 'Complete todos os grupos: território, doença, medida e período.',
  analysisUnlocked = false,
  onReview,
  onPasteTerritories,
  onClearMap,
  clearConfirmOpen,
  onClearConfirmOpenChange,
  onConfirmClear,
  className,
}: MapPrimaryActionBarProps) {
  return (
    <div className={cn('space-y-3 border-t border-border pt-4', className)} aria-label="Ações principais">
      {!canReview ? (
        <p
          className="flex items-start gap-2 font-sans text-xs text-text-muted"
          role="status"
          data-testid="review-blocked-hint"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
          {blockedMessage}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={!canReview}
        className="w-full"
        onClick={onReview}
        data-testid="review-analyze-button"
      >
        {analysisUnlocked
          ? 'Reabrir análise'
          : analysisMode === 'descriptive'
            ? 'Abrir análise descritiva'
            : 'Revisar e analisar'}
      </Button>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onPasteTerritories}>
          Colar territórios
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClearMap}>
          Limpar mapa
        </Button>
      </div>

      <Dialog open={clearConfirmOpen} onOpenChange={onClearConfirmOpenChange}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Limpar mapa</DialogTitle>
            <DialogDescription>
              Apagar grupos, seleções e dados colados desta sessão? Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClearConfirmOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmClear}>
              Sim, apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
