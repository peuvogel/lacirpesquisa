import {
  BarChart3,
  Binary,
  ChartScatter,
  FlaskConical,
  GitCompareArrows,
  Grid3x3,
  Sigma,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TestRegistryEntry, TestId } from '@/features/tests/registry';
import { getTestBadgeLabel } from '@/features/tests/registry';

const TEST_ICONS: Record<TestId, LucideIcon> = {
  't-student': GitCompareArrows,
  'mann-whitney': GitCompareArrows,
  correlacao: ChartScatter,
  'prais-winsten': TrendingUp,
  'qui-quadrado': Grid3x3,
  'anova-tukey': BarChart3,
  'kruskal-dunn': BarChart3,
  poisson: Sigma,
  'binomial-negativa': Sigma,
  logistica: Binary,
};

/**
 * TEST_ICONS is exhaustive over TestId — forgetting a key when a new test
 * is registered is a compile error (TS2741, QA-04/D-14). entry.id here is a
 * plain `string` (TestRegistryEntry stays generic on purpose, see below), so
 * the lookup goes through a cast — that cast is the exact point where the
 * runtime fallback stays alive and testable.
 */
function iconFor(id: string): LucideIcon {
  return (TEST_ICONS as Partial<Record<string, LucideIcon>>)[id] ?? FlaskConical;
}

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
  const Icon = iconFor(entry.id);
  const showBadge = dense ? entry.status === 'em-breve' : true;

  if (dense) {
    return isAvailable ? (
      <button
        type="button"
        onClick={() => onSelect(entry.id)}
        aria-current={active ? 'true' : undefined}
        title={collapsed ? entry.title : undefined}
        className={cn(
          'group relative flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-xl text-left transition-all duration-150',
          collapsed ? 'justify-center p-2' : 'px-3 py-2',
          active
            ? 'bg-white/10 text-white font-semibold'
            : 'text-white/60 hover:bg-white/[0.04] hover:text-white font-medium',
        )}
      >
        {active ? (
          <span className="absolute left-0 top-1/2 h-4.5 w-0.5 -translate-y-1/2 rounded-r-full bg-white" />
        ) : null}
        <Icon
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 transition-transform duration-150',
            active ? 'text-white' : 'text-white/60 group-hover:scale-110 group-hover:text-white',
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm transition-opacity duration-150',
            collapsed ? 'pointer-events-none w-0 flex-none overflow-hidden opacity-0' : 'opacity-100',
          )}
        >
          {entry.title}
        </span>
        {showBadge && !collapsed ? (
          <Badge
            variant="outline"
            className="shrink-0 border-white/10 px-1.5 py-0 text-[10px] text-white/40"
          >
            Em breve
          </Badge>
        ) : null}
        {collapsed ? <span className="sr-only">{entry.title}</span> : null}
      </button>
    ) : (
      <div
        aria-disabled="true"
        title={collapsed ? entry.title : undefined}
        className={cn(
          'flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2 opacity-40',
          collapsed && 'justify-center p-2',
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0 text-white/40" />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium text-white/40',
            'transition-opacity duration-150',
            collapsed ? 'pointer-events-none w-0 flex-none overflow-hidden opacity-0' : 'opacity-100',
          )}
        >
          {entry.title}
        </span>
        {showBadge && !collapsed ? (
          <Badge
            variant="outline"
            className="shrink-0 border-white/10 px-1.5 py-0 text-[10px] text-white/40"
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
