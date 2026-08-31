import { useEffect, useState } from 'react';
import { HelpCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TEST_REGISTRY, type TestRegistryEntry } from '@/features/tests/registry';
import { SidebarTestLink } from './SidebarTestLink';

const NARROW_MEDIA_QUERY = '(max-width: 980px)';

function isNarrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(NARROW_MEDIA_QUERY).matches;
}

/** Groups registry entries by `.group`, preserving first-appearance order. */
export function groupTestsByGroup(entries: readonly TestRegistryEntry[]): Array<[string, TestRegistryEntry[]]> {
  const groups = new Map<string, TestRegistryEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.group);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(entry.group, [entry]);
    }
  }
  return Array.from(groups.entries());
}

export interface SidebarProps {
  activeTestId: string | null;
  onSelectTest: (id: string) => void;
  onOpenQualTeste: () => void;
}

/**
 * Black collapsible sidebar — category + test name only.
 * Text is clipped instantly on collapse (no ghost copy during width tween).
 */
export function Sidebar({ activeTestId, onSelectTest, onOpenQualTeste }: SidebarProps) {
  const [expanded, setExpanded] = useState(() => !isNarrowViewport());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQueryList = window.matchMedia(NARROW_MEDIA_QUERY);
    function handleChange(event: MediaQueryListEvent) {
      setExpanded(!event.matches);
    }
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  const groups = groupTestsByGroup(TEST_REGISTRY);

  return (
    <aside
      aria-label="Testes disponíveis"
      data-expanded={expanded}
      data-state={expanded ? 'expanded' : 'collapsed'}
      className={cn(
        'lacir-stat-sidebar sticky top-16 flex h-[calc(100dvh-4rem)] shrink-0 self-start flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)]',
        'transition-[width] duration-150 ease-out',
        expanded ? 'w-64' : 'w-12',
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 overflow-hidden px-2">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher lista de testes' : 'Expandir lista de testes'}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-ring)]"
        >
          {expanded ? (
            <PanelLeftClose aria-hidden="true" className="size-4" />
          ) : (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          )}
        </button>
        <span
          className={cn(
            'truncate text-xs font-medium tracking-wide text-muted-foreground uppercase',
            'transition-opacity duration-100',
            expanded ? 'opacity-100' : 'pointer-events-none w-0 opacity-0',
          )}
          aria-hidden={!expanded}
        >
          Testes
        </span>
      </div>

      <div className="shrink-0 overflow-hidden px-2 pb-2">
        {expanded ? (
          <Button type="button" onClick={onOpenQualTeste} className="h-8 w-full text-sm">
            Qual teste usar?
          </Button>
        ) : (
          <button
            type="button"
            onClick={onOpenQualTeste}
            aria-label="Qual teste usar?"
            title="Qual teste usar?"
            className="mx-auto flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--sidebar-accent)] hover:text-[var(--color-accent)]"
          >
            <HelpCircle aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      <nav
        aria-label="Lista de testes"
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-2 pb-3',
          !expanded && 'overflow-y-hidden',
        )}
      >
        {groups.map(([groupName, entries]) => (
          <div key={groupName} className="flex flex-col gap-0.5 py-1">
            <h2
              className={cn(
                'flex h-7 items-center truncate px-2 text-xs font-medium text-muted-foreground',
                'transition-opacity duration-100',
                expanded ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0',
              )}
            >
              {groupName}
            </h2>
            {!expanded ? <span className="sr-only">{groupName}</span> : null}
            <ul className="flex flex-col gap-0.5">
              {entries.map((entry) => (
                <li key={entry.id} className="overflow-hidden">
                  <SidebarTestLink
                    entry={entry}
                    active={entry.id === activeTestId}
                    onSelect={onSelectTest}
                    showSubtitle={false}
                    dense
                    collapsed={!expanded}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
