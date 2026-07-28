import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { CatalogEntry } from '@/features/catalog/types';
import {
  DISEASES,
  MEASURES,
  PLACE_CONTEXT_VARIABLES,
  parseCatalogId,
} from '@/features/catalog/taxonomy';
import { cn } from '@/lib/utils';
import { VARIABLE_TYPE_LABELS } from './VariableFilters';

const PLACE_CONTEXT_IDS = new Set(PLACE_CONTEXT_VARIABLES.map((v) => v.id));
const MEASURE_ORDER = new Map(MEASURES.map((m, i) => [m.id, i]));
const DISEASE_ORDER = new Map(DISEASES.map((d, i) => [d.id, i]));

type GroupKind = 'disease' | 'place' | 'outras';

interface CatalogGroup {
  key: string;
  kind: GroupKind;
  label: string;
  items: CatalogEntry[];
}

function diseaseLabel(diseaseId: string): string {
  return DISEASES.find((d) => d.id === diseaseId)?.label ?? diseaseId.replace(/_/g, ' ');
}

function groupForEntry(entry: CatalogEntry): Omit<CatalogGroup, 'items'> | null {
  if (entry.domain === 'meta' || entry.sourceSystem === 'LACIR') return null;

  const parsed = parseCatalogId(entry.id);
  if (parsed) {
    return {
      key: `disease:${parsed.diseaseId}`,
      kind: 'disease',
      label: diseaseLabel(parsed.diseaseId),
    };
  }

  if (PLACE_CONTEXT_IDS.has(entry.id) || entry.domain === 'populacao' || entry.domain === 'rh_sus') {
    return {
      key: 'place',
      kind: 'place',
      label: 'Contexto do território',
    };
  }

  return {
    key: 'outras',
    kind: 'outras',
    label: 'Outras fontes',
  };
}

function sortEntries(a: CatalogEntry, b: CatalogEntry): number {
  const pa = parseCatalogId(a.id);
  const pb = parseCatalogId(b.id);
  if (pa && pb) {
    const mo = (MEASURE_ORDER.get(pa.measureId) ?? 99) - (MEASURE_ORDER.get(pb.measureId) ?? 99);
    if (mo !== 0) return mo;
  }
  return a.label.localeCompare(b.label, 'pt-BR');
}

function rowLabel(entry: CatalogEntry): string {
  const parsed = parseCatalogId(entry.id);
  if (!parsed) return entry.label;
  return MEASURES.find((m) => m.id === parsed.measureId)?.label ?? entry.label;
}

export interface VariableListProps {
  entries: CatalogEntry[];
  selectedId: string | null;
  selectedLoadableIds: Set<string>;
  loading?: boolean;
  error?: string | null;
  onSelect: (id: string) => void;
  onToggleLoadable: (id: string) => void;
}

export function VariableList({
  entries,
  selectedId,
  selectedLoadableIds,
  loading = false,
  error = null,
  onSelect,
  onToggleLoadable,
}: VariableListProps) {
  const groups = useMemo(() => {
    const map = new Map<string, CatalogGroup>();
    for (const entry of entries) {
      const meta = groupForEntry(entry);
      if (!meta) continue;
      const existing = map.get(meta.key);
      if (existing) {
        existing.items.push(entry);
      } else {
        map.set(meta.key, { ...meta, items: [entry] });
      }
    }

    const list = [...map.values()].map((group) => ({
      ...group,
      items: [...group.items].sort(sortEntries),
    }));

    list.sort((a, b) => {
      const kindRank = { disease: 0, place: 1, outras: 2 } as const;
      const kr = kindRank[a.kind] - kindRank[b.kind];
      if (kr !== 0) return kr;
      if (a.kind === 'disease' && b.kind === 'disease') {
        const aid = a.key.slice('disease:'.length);
        const bid = b.key.slice('disease:'.length);
        const ao = DISEASE_ORDER.get(aid) ?? 999;
        const bo = DISEASE_ORDER.get(bid) ?? 999;
        if (ao !== bo) return ao - bo;
      }
      return a.label.localeCompare(b.label, 'pt-BR');
    });

    return list;
  }, [entries]);

  const visibleCount = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Lista de variáveis">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-sans text-label font-bold text-text">Catálogo</h2>
        <span className="font-sans text-sm text-text-muted">
          {loading ? 'Carregando…' : `${visibleCount} variável(is)`}
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul
        className="max-h-[min(62vh,640px)] space-y-2 overflow-y-auto rounded-xl border border-border bg-surface p-1"
        role="listbox"
        aria-label="Variáveis do catálogo"
        aria-busy={loading}
      >
        {!loading && visibleCount === 0 ? (
          <li className="px-3 py-8 text-center font-sans text-sm text-text-muted">
            Nenhuma variável corresponde aos filtros.
          </li>
        ) : null}

        {groups.map((group) => (
          <li key={group.key} className="list-none">
            <div className="sticky top-0 z-[1] border-b border-border/70 bg-surface px-2 py-2">
              <p className="font-sans text-[11px] font-bold tracking-wide text-text">
                {group.label}
              </p>
              <p className="font-sans text-[10px] uppercase tracking-wide text-text-muted">
                {group.kind === 'disease'
                  ? `${group.items.length} medida(s)`
                  : group.kind === 'place'
                    ? 'Denominadores e oferta'
                    : 'Referências externas'}
              </p>
            </div>
            <ul className="mt-0.5 space-y-0.5 px-0.5 pb-1">
              {group.items.map((entry) => {
                const isSelected = entry.id === selectedId;
                return (
                  <li key={entry.id} role="option" aria-selected={isSelected}>
                    <div
                      className={cn(
                        'flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors',
                        isSelected
                          ? 'bg-accent-soft shadow-[inset_3px_0_0_var(--color-accent)]'
                          : 'hover:bg-elevated',
                      )}
                    >
                      {entry.loadable ? (
                        <Checkbox
                          id={`load-${entry.id}`}
                          checked={selectedLoadableIds.has(entry.id)}
                          onCheckedChange={() => onToggleLoadable(entry.id)}
                          aria-label={`Incluir ${entry.label} na seleção para carregar`}
                          className="mt-0.5"
                        />
                      ) : (
                        <span className="mt-0.5 size-4 shrink-0" aria-hidden />
                      )}

                      <button
                        type="button"
                        onClick={() => onSelect(entry.id)}
                        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="font-sans text-sm font-medium text-text">
                          {rowLabel(entry)}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="font-sans text-[11px]">
                            {VARIABLE_TYPE_LABELS[entry.variableType]}
                          </Badge>
                          <span className="font-sans text-[11px] text-text-muted">
                            {entry.sourceSystem}
                          </span>
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
