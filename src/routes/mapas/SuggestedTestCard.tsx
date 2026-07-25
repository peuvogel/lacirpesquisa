import { Badge } from '@/components/ui/badge';
import { getTestBadgeLabel, getTestById } from '@/features/tests/registry';
import { cn } from '@/lib/utils';

export interface SuggestedTestCardProps {
  testId: string;
  rationale: string;
}

export function SuggestedTestCard({ testId, rationale }: SuggestedTestCardProps) {
  const entry = getTestById(testId);
  if (!entry) return null;

  const isAvailable = entry.status === 'available';
  const badgeLabel = getTestBadgeLabel(entry);
  const isDemo = entry.id === 'demo';

  return (
    <div
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded-lg border px-3.5 py-3 transition-all duration-200',
        isAvailable
          ? 'border-accent-border bg-accent-soft shadow-[inset_4px_0_0_var(--color-accent)]'
          : 'cursor-not-allowed border-transparent bg-transparent opacity-60',
      )}
      aria-disabled={!isAvailable}
    >
      <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
        <span className="font-sans text-label font-bold text-text">{entry.title}</span>
        <span className="font-sans text-sm font-normal text-text-muted">{rationale}</span>
      </span>
      <Badge
        variant={isAvailable && !isDemo ? 'default' : 'outline'}
        className={cn(
          'shrink-0',
          isAvailable && !isDemo ? 'bg-accent text-[#04120c]' : 'border-border text-text-muted',
        )}
      >
        {badgeLabel}
      </Badge>
    </div>
  );
}
