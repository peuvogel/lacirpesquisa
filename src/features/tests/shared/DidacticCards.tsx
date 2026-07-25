import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DidacticCard {
  title: string;
  body: string;
}

export interface DidacticCardsProps {
  cards: DidacticCard[];
  className?: string;
}

export function DidacticCards({ cards, className }: DidacticCardsProps) {
  if (cards.length === 0) return null;

  return (
    <section className={cn('space-y-3', className)} aria-label="Entenda este teste">
      <h3 className="text-lg font-bold text-foreground">Entenda este teste</h3>
      <div className="space-y-2">
        {cards.map((card) => (
          <Collapsible key={card.title} defaultOpen={false}>
            <div className="rounded-lg border border-border bg-[var(--color-surface)]">
              <CollapsibleTrigger className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-foreground">
                {card.title}
                <ChevronDownIcon className="size-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border px-4 py-3 text-base leading-relaxed text-muted-foreground">
                {card.body}
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </section>
  );
}
