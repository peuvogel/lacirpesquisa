import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DatasusSource } from '@/shared/data-input/types';

export interface DatasusSourceCardsProps {
  sources: DatasusSource[];
  activeSourceId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function sourceStateLabel(source: DatasusSource): { text: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (source.confirmed && source.normalized?.ok) return { text: 'confirmada', tone: 'default' };
  if (source.normalized?.ok) return { text: 'mapeada', tone: 'secondary' };
  return { text: 'revisar', tone: 'outline' };
}

export function DatasusSourceCards({ sources, activeSourceId, onSelect, onRemove }: DatasusSourceCardsProps) {
  if (!sources.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {sources.map((source) => {
        const isActive = source.id === activeSourceId;
        const state = sourceStateLabel(source);
        const parsed = source.parsed?.ok ? source.parsed : null;

        return (
          <div key={source.id} className="relative">
            <button
              type="button"
              aria-label={`Fonte ${source.fileName}${isActive ? ', selecionada' : ''}`}
              aria-pressed={isActive}
              onClick={() => onSelect(source.id)}
              className={cn(
                'flex min-w-[200px] flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-primary bg-[var(--color-elevated)] ring-1 ring-primary/40'
                  : 'border-border bg-[var(--color-surface)] hover:border-primary/50',
              )}
            >
              <Badge variant={state.tone}>{state.text}</Badge>
              <strong className="text-sm text-foreground">{source.fileName}</strong>
              <span className="text-xs text-muted-foreground">
                {parsed?.diagnosis.formatType ?? 'n/d'} · cabeçalho linha {(parsed?.headerRowIndex ?? 0) + 1}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Remover fonte ${source.fileName}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(source.id);
              }}
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
