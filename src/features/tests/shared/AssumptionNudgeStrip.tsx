import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sortNudges, type AssumptionNudge } from './assumptionNudges';

export interface AssumptionNudgeStripProps {
  nudges: AssumptionNudge[];
  onNavigateTest?: (testId: string) => void;
  className?: string;
}

const severityStyles: Record<AssumptionNudge['severity'], string> = {
  info: 'border-l-[var(--color-accent)]',
  warning: 'border-l-amber-500',
};

export function AssumptionNudgeStrip({ nudges, onNavigateTest, className }: AssumptionNudgeStripProps) {
  if (!nudges.length) return null;

  const sorted = sortNudges(nudges);

  return (
    <div className={cn('space-y-3', className)} data-testid="assumption-nudge-strip">
      {sorted.map((nudge, index) => (
        <Alert
          key={`${nudge.severity}-${index}-${nudge.message.slice(0, 24)}`}
          role="status"
          aria-live="polite"
          className={cn(
            'border-l-4 bg-[var(--color-surface)]',
            severityStyles[nudge.severity],
          )}
        >
          <AlertTitle className="text-base font-bold text-foreground">Pressupostos</AlertTitle>
          <AlertDescription className="space-y-3 text-base text-muted-foreground">
            <p>{nudge.message}</p>
            {nudge.cta && onNavigateTest ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateTest(nudge.cta!.testId)}
              >
                {nudge.cta.label}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
