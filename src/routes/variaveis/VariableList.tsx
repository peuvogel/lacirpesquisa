import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { CatalogEntry } from '@/features/catalog/types';
import { cn } from '@/lib/utils';
import { VARIABLE_TYPE_LABELS } from './VariableFilters';

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
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Lista de variáveis">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-sans text-label font-bold text-text">Catálogo</h2>
        <span className="font-sans text-sm text-text-muted">
          {loading ? 'Carregando…' : `${entries.length} variável(is)`}
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul
        className="max-h-[min(62vh,640px)] space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-1"
        role="listbox"
        aria-label="Variáveis do catálogo"
        aria-busy={loading}
      >
        {!loading && entries.length === 0 ? (
          <li className="px-3 py-8 text-center font-sans text-sm text-text-muted">
            Nenhuma variável corresponde aos filtros.
          </li>
        ) : null}

        {entries.map((entry) => {
          const isSelected = entry.id === selectedId;
          return (
            <li key={entry.id} role="option" aria-selected={isSelected}>
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg px-2 py-2 transition-colors',
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
                    className="mt-1"
                  />
                ) : (
                  <span className="mt-1 size-4 shrink-0" aria-hidden />
                )}

                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="font-sans text-sm font-medium text-text">{entry.label}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="font-sans text-[11px]">
                      {VARIABLE_TYPE_LABELS[entry.variableType]}
                    </Badge>
                    <Badge
                      variant={entry.loadable ? 'default' : 'outline'}
                      className={cn(
                        'font-sans text-[11px]',
                        entry.loadable
                          ? 'bg-accent text-[#04120c]'
                          : 'border-border text-text-muted',
                      )}
                    >
                      {entry.loadable ? 'Carregável' : 'Referência'}
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
    </section>
  );
}
