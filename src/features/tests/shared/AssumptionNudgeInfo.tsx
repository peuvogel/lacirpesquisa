import { Info, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { sortNudges, type AssumptionNudge } from './assumptionNudges';

export interface AssumptionNudgeInfoProps {
  nudges: AssumptionNudge[];
  onNavigateTest?: (testId: string) => void;
  className?: string;
}

/**
 * Os pressupostos do teste num "i" ao lado do título da seção, no lugar das
 * tarjas que empilhavam antes dos resultados (até três no Kruskal).
 *
 * Quando há aviso, o ícone vira o triângulo âmbar: o que é ressalva de método
 * não pode sumir atrás de um ícone neutro só porque ocupava espaço.
 */
export function AssumptionNudgeInfo({ nudges, onNavigateTest, className }: AssumptionNudgeInfoProps) {
  if (!nudges.length) return null;

  const sorted = sortNudges(nudges);
  const hasWarning = sorted.some((nudge) => nudge.severity === 'warning');
  const label = hasWarning ? 'Pressupostos e avisos deste teste' : 'Pressupostos deste teste';
  const Icon = hasWarning ? TriangleAlert : Info;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-testid="assumption-nudge-info"
          data-severity={hasWarning ? 'warning' : 'info'}
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            hasWarning
              ? 'text-amber-500 hover:text-amber-400'
              : 'text-muted-foreground/70 hover:text-foreground',
            className,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-sm font-bold text-foreground">Pressupostos</p>
        <ul className="mt-2 space-y-3">
          {sorted.map((nudge, index) => (
            <li key={`${nudge.severity}-${index}-${nudge.message.slice(0, 24)}`} className="space-y-2">
              <p
                className={cn(
                  'text-xs',
                  nudge.severity === 'warning' ? 'text-amber-500' : 'text-muted-foreground',
                )}
              >
                {nudge.message}
              </p>
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
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
