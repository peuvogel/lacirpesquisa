import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import {
  filterCatalog,
  type CatalogFilters,
} from '@/features/catalog/filterCatalog';
import { loadCatalog, type LoadedCatalog } from '@/features/catalog/loadCatalog';
import type { CatalogEntry } from '@/features/catalog/types';
import { VariableFilters } from './VariableFilters';
import { VariableList } from './VariableList';

const INITIAL_FILTERS: CatalogFilters = {
  query: '',
  sourceSystem: undefined,
  variableType: '',
  domain: undefined,
  loadable: null,
};

export function VariaveisPage() {
  const [catalog, setCatalog] = useState<LoadedCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogFilters>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLoadableIds, setSelectedLoadableIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCatalog()
      .then((loaded) => {
        if (cancelled) return;
        setCatalog(loaded);
        setLoadError(null);
        if (loaded.variables[0]) {
          setSelectedId((prev) => prev ?? loaded.variables[0]!.id);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : 'Falha ao carregar o catálogo.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variables = catalog?.variables ?? [];

  const sourceOptions = useMemo(
    () => [...new Set(variables.map((v) => v.sourceSystem))].sort(),
    [variables],
  );

  const domainOptions = useMemo(
    () => [...new Set(variables.map((v) => v.domain))].sort(),
    [variables],
  );

  const filtered = useMemo(
    () => filterCatalog(variables, filters),
    [variables, filters],
  );

  const selected: CatalogEntry | null =
    variables.find((v) => v.id === selectedId) ?? null;

  function handleToggleLoadable(id: string) {
    setSelectedLoadableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8">
      <h1 className="font-sans text-display font-bold text-text">Variáveis</h1>
      <p className="mt-2 max-w-2xl font-sans text-body text-text-muted">
        Catálogo curado com proveniência obrigatória. Busque, filtre e selecione variáveis
        para a aula — sem abrir TABNET durante a prática.
      </p>

      <div className="mt-6">
        <VariableFilters
          filters={filters}
          sourceOptions={sourceOptions}
          domainOptions={domainOptions}
          onChange={setFilters}
        />
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="w-full lg:w-[42%]">
          <VariableList
            entries={filtered}
            selectedId={selectedId}
            selectedLoadableIds={selectedLoadableIds}
            loading={loading}
            error={loadError}
            onSelect={setSelectedId}
            onToggleLoadable={handleToggleLoadable}
          />
        </div>

        <aside
          className="flex w-full min-h-[320px] flex-col rounded-xl border border-border bg-surface p-6 lg:w-[58%]"
          aria-label="Detalhe da variável"
        >
          {selected ? (
            <div className="space-y-2">
              <h2 className="font-sans text-heading font-bold text-text">{selected.label}</h2>
              <p className="font-sans text-sm text-text-muted">
                {selected.sourceSystem} · {selected.tableOrIndicator} · {selected.period}
              </p>
              <p className="font-sans text-sm text-text-muted">
                Painel completo de proveniência e teste sugerido em seguida.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                heading="Selecione uma variável"
                body="Escolha um item na lista para ver a proveniência completa, o teste sugerido e as ações de carregamento."
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
