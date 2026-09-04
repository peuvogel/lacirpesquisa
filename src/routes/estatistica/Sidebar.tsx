import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
 * Glassmorphic Dark Sidebar — category + test name with smooth collapse,
 * left vertical active indicator bar, and LACIR Teal design tokens.
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
        'lacir-stat-sidebar sticky top-16 z-20 flex h-[calc(100dvh-4rem)] shrink-0 self-start flex-col overflow-hidden select-none',
        'transition-all duration-300 ease-in-out motion-reduce:transition-none',
        expanded ? 'w-60' : 'w-[68px]',
      )}
      style={{
        background:
          'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(32,153,120,0.02) 50%, rgba(255,255,255,0.01) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.1)',
      }}
    >
      {/* ── Navigation List ── */}
      <nav
        aria-label="Lista de testes"
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto py-1 scrollbar-none',
          expanded ? 'px-3' : 'px-2',
        )}
      >
        {groups.map(([groupName, entries], gi) => (
          <div key={groupName} className="mb-2">
            {/* Group Label */}
            {expanded ? (
              <p className="mb-1 mt-2 px-2 text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 truncate">
                {groupName}
              </p>
            ) : gi > 0 ? (
              <div className="mx-1 my-2 h-px bg-white/10" />
            ) : null}

            {/* Test Links */}
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

      {/* ── Footer Collapse Button ── */}
      <div className="border-t border-white/10 p-2.5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher lista de testes' : 'Expandir lista de testes'}
          title={expanded ? 'Recolher barra' : 'Expandir barra'}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-white/40 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronLeft className="size-4" />
              <span>Recolher</span>
            </>
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
