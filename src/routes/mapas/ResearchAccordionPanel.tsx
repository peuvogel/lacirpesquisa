import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ResearchAccordionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: string;
  title: string;
  /** Shown under the title when the section is expanded. */
  subtitle?: string;
  /** Compact line shown when collapsed. */
  summary: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Accessible name for the whole panel. */
  'aria-label'?: string;
}

/**
 * Large collapsible research step — grows inside a fixed-height column only;
 * content scrolls internally so the map column never reflows.
 */
export function ResearchAccordionPanel({
  open,
  onOpenChange,
  step,
  title,
  subtitle,
  summary,
  children,
  className,
  style,
  'aria-label': ariaLabel,
}: ResearchAccordionPanelProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/12 bg-surface/80 shadow-lg backdrop-blur-xl',
        open ? 'flex-1' : 'shrink-0',
        className,
      )}
      style={style}
      aria-label={ariaLabel}
    >
      <CollapsibleTrigger
        className={cn(
          'flex w-full shrink-0 items-start gap-3 px-4 py-3.5 text-left outline-none transition-colors',
          'hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[10px] font-bold uppercase tracking-wide text-accent">
            {step}
          </p>
          <h2 className="mt-0.5 font-sans text-base font-bold text-text">{title}</h2>
          {open && subtitle ? (
            <p className="mt-0.5 font-sans text-xs text-text-muted">{subtitle}</p>
          ) : null}
          {!open ? (
            <p className="mt-0.5 truncate font-sans text-xs text-text-muted">{summary}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            'mt-1 size-5 shrink-0 text-text-muted transition-transform duration-200',
            open && 'rotate-180 text-accent',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>

      {/* Conditional body (not Radix height animation) — keeps parent height stable. */}
      {open ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">
          {children}
        </div>
      ) : null}
    </Collapsible>
  );
}
