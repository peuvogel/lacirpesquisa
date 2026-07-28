import {
  BarChart3,
  Binary,
  ChartScatter,
  GitCompareArrows,
  Grid3x3,
  Sigma,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TestRegistryEntry } from '@/features/tests/registry';
import { getTestBadgeLabel } from '@/features/tests/registry';

const TEST_ICONS: Record<string, LucideIcon> = {
  't-student': GitCompareArrows,
  correlacao: ChartScatter,
  'prais-winsten': TrendingUp,
  'qui-quadrado': Grid3x3,
  'anova-tukey': BarChart3,
  'kruskal-dunn': BarChart3,
  poisson: Sigma,
  'binomial-negativa': Sigma,
  logistica: Binary,
};

export interface SidebarTestLinkProps {
  entry: TestRegistryEntry;
  active: boolean;
  onSelect: (id: string) => void;
  /** Sidebar: title only. Modal/roadmap may show didactic subtitle. */
  showSubtitle?: boolean;
  /** Compact icon+title row for shadcn-style sidebar menus. */
  dense?: boolean;
  collapsed?: boolean;
}

/**
 * One registry entry as a nav row. Sidebar uses dense title-only mode;
 * QualTesteModal can pass showSubtitle for didactic copy.
 */
export function SidebarTestLink({
  entry,
  active,
  onSelect,
  showSubtitle = false,
  dense = false,
  collapsed = false,
}: SidebarTestLinkProps) {
  const isAvailable = entry.status === 'available';
  const badgeLabel = getTestBadgeLabel(entry);
  const Icon = TEST_ICONS[entry.id] ?? FlaskConical;
  const showBadge = dense ? entry.status === 'em-breve' : true;

  if (dense) {
    return isAvailable ? (
      <button
        type="button"
        onClick={() => onSelect(entry.id)}
        aria-current={active ? 'true' : undefined}
        title={entry.title}
        className={cn(
          'flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left',
          'hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
          active &&
            'bg-[var(--sidebar-accent)] font-medium text-[var(--sidebar-accent-foreground)] shadow-[inset_2px_0_0_var(--color-accent)]',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0',
            active ? 'text-[var(--color-accent)]' : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium text-text',
            'transition-opacity duration-100',
            collapsed ? 'pointer-events-none w-0 flex-none overflow-hidden opacity-0' : 'opacity-100',
          )}
        >
          {entry.title}
        </span>
        {showBadge && !collapsed ? (
          <Badge
            variant="outline"
            className="shrink-0 border-border px-1.5 py-0 text-[10px] text-text-muted"
          >
            Em breve
          </Badge>
        ) : null}
        {collapsed ? <span className="sr-only">{entry.title}</span> : null}
      </button>
    ) : (
      <div
        aria-disabled="true"
        title={entry.title}
        className={cn(
          'flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 opacity-50',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium text-text',
            'transition-opacity duration-100',
            collapsed ? 'pointer-events-none w-0 flex-none overflow-hidden opacity-0' : 'opacity-100',
          )}
        >
          {entry.title}
        </span>
        {showBadge && !collapsed ? (
          <Badge
            variant="outline"
            className="shrink-0 border-border px-1.5 py-0 text-[10px] text-text-muted"
          >
            Em breve
          </Badge>
        ) : null}
        {collapsed ? <span className="sr-only">{entry.title}</span> : null}
      </div>
    );
  }

  const content = (
    <>
      <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
        <span className="font-sans text-label font-bold text-text">{entry.title}</span>
        {showSubtitle ? (
          <span className="font-sans text-sm font-normal text-text-muted">{entry.subtitle}</span>
        ) : null}
      </span>
      {showBadge ? (
        <Badge
          variant={isAvailable ? 'default' : 'outline'}
          className={cn(
            'shrink-0',
            isAvailable
              ? 'bg-[var(--color-accent)] text-[#04120c]'
              : 'border-border text-text-muted',
          )}
        >
          {badgeLabel}
        </Badge>
      ) : null}
    </>
  );

  const rowClassName =
    'flex w-full items-start justify-between gap-2 rounded-lg border px-3.5 py-3 transition-colors duration-150';

  if (isAvailable) {
    return (
      <button
        type="button"
        onClick={() => onSelect(entry.id)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          rowClassName,
          'border-transparent bg-transparent text-left hover:border-border hover:bg-accent-soft',
          active && 'border-accent-border bg-accent-soft shadow-[inset_4px_0_0_var(--color-accent)]',
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      aria-disabled="true"
      className={cn(rowClassName, 'cursor-not-allowed border-transparent bg-transparent opacity-50')}
    >
      {content}
    </div>
  );
}
