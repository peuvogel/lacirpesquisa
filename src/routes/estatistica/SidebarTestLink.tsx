import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TestRegistryEntry } from '@/features/tests/registry';

export interface SidebarTestLinkProps {
  entry: TestRegistryEntry;
  active: boolean;
  onSelect: (id: string) => void;
}

/**
 * One registry entry rendered as a sidebar/roadmap row (shared by Sidebar
 * and QualTesteModal, per 01-RESEARCH.md Pattern 1 — the row markup itself
 * must not fork between the two surfaces).
 *
 * Available rows are real <button>s (legacy .test-link hover/active
 * treatment, retinted teal). Unavailable rows are non-interactive elements
 * with aria-disabled="true" — structurally not navigable (D-14), not a
 * click handler that returns early.
 */
export function SidebarTestLink({ entry, active, onSelect }: SidebarTestLinkProps) {
  const isAvailable = entry.status === 'available';

  const content = (
    <>
      <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
        <span className="font-sans text-label font-bold text-text">{entry.title}</span>
        <span className="font-sans text-sm font-normal text-text-muted">{entry.subtitle}</span>
      </span>
      <Badge
        variant={isAvailable ? 'default' : 'outline'}
        className={cn('shrink-0', isAvailable ? 'bg-accent text-[#04120c]' : 'border-border text-text-muted')}
      >
        {isAvailable ? 'Disponível' : 'Em breve'}
      </Badge>
    </>
  );

  const rowClassName = 'flex w-full items-start justify-between gap-2 rounded-lg border px-3.5 py-3 transition-all duration-200';

  if (isAvailable) {
    return (
      <button
        type="button"
        onClick={() => onSelect(entry.id)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          rowClassName,
          'border-transparent bg-transparent text-left hover:translate-x-[3px] hover:border-border hover:bg-accent-soft',
          active && 'border-accent-border bg-accent-soft shadow-[inset_4px_0_0_var(--color-accent)]',
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-disabled="true" className={cn(rowClassName, 'cursor-not-allowed border-transparent bg-transparent opacity-60')}>
      {content}
    </div>
  );
}
