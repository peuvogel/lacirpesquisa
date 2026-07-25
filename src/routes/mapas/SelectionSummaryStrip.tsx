import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SelectionSummary } from './mapAnalysisState';

export interface SelectionSummaryStripProps {
  summary: SelectionSummary;
  className?: string;
}

const CHIP_KIND_CLASS: Record<SelectionSummary['chips'][number]['kind'], string> = {
  territory: 'border-accent-border bg-accent-soft text-accent',
  group: 'border-border bg-elevated text-text',
  time: 'border-border bg-surface text-text-muted',
  variable: 'border-accent-border/60 bg-surface text-text',
};

export function SelectionSummaryStrip({ summary, className }: SelectionSummaryStripProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Resumo da seleção"
      className={cn(
        'rounded-xl border border-border bg-surface px-4 py-3',
        className,
      )}
    >
      <p className="font-sans text-sm font-bold text-text">{summary.headline}</p>
      {summary.hint ? (
        <p className="mt-1 font-sans text-sm text-text-muted">{summary.hint}</p>
      ) : null}
      {summary.chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {summary.chips.map((chip) => (
            <Badge
              key={`${chip.kind}-${chip.label}`}
              variant="outline"
              className={cn('font-sans text-xs font-medium', CHIP_KIND_CLASS[chip.kind])}
            >
              {chip.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}
