import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TEST_REGISTRY, type TestRegistryEntry } from '@/features/tests/registry';
import { SidebarTestLink } from './SidebarTestLink';

// Legacy .page-shell collapse breakpoint (assets/css/styles.css:1172-1174),
// preserved so the "collapses below ~980px" behavior matches the MVP.
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
  /** Only ever called with an 'available' id (SidebarTestLink structurally excludes the rest). */
  onSelectTest: (id: string) => void;
  onOpenQualTeste: () => void;
}

/**
 * Collapsible 300px left sidebar (D-05) — Qual teste usar? trigger above a
 * TEST_REGISTRY-driven, grouped list. Collapse is a custom <aside> width
 * transition, not a shadcn sidebar block (01-RESEARCH.md Open Question 2).
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
      className={cn(
        'shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out',
        expanded ? 'w-[300px]' : 'w-[56px]',
      )}
    >
      <div className={cn('flex h-full flex-col gap-4 py-4', expanded ? 'px-4' : 'items-center px-2')}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher lista de testes' : 'Expandir lista de testes'}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-elevated hover:text-text focus-visible:outline-none"
        >
          {expanded ? (
            <PanelLeftClose aria-hidden="true" className="size-5" />
          ) : (
            <PanelLeftOpen aria-hidden="true" className="size-5" />
          )}
        </button>

        {expanded ? (
          <>
            <Button type="button" onClick={onOpenQualTeste} className="w-full">
              Qual teste usar?
            </Button>

            <nav aria-label="Lista de testes" className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
              {groups.map(([groupName, entries]) => (
                <div key={groupName} className="flex flex-col gap-1.5">
                  <h2 className="px-1 font-sans text-xs font-bold tracking-wide text-text-muted uppercase">
                    {groupName}
                  </h2>
                  {entries.map((entry) => (
                    <SidebarTestLink
                      key={entry.id}
                      entry={entry}
                      active={entry.id === activeTestId}
                      onSelect={onSelectTest}
                    />
                  ))}
                </div>
              ))}
            </nav>
          </>
        ) : null}
      </div>
    </aside>
  );
}
