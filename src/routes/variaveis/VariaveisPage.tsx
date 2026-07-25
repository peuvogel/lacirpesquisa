import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  filterCatalog,
  type CatalogFilters,
} from '@/features/catalog/filterCatalog';
import {
  assertCompatibleSelection,
  buildSessionDataset,
} from '@/features/catalog/buildSessionDataset';
import { loadCatalog, type LoadedCatalog } from '@/features/catalog/loadCatalog';
import { resolveHint } from '@/features/catalog/suggestTestForVariable';
import type { CatalogEntry } from '@/features/catalog/types';
import { useSession } from '@/shared/session/SessionProvider';
import { VariableDetailPanel } from './VariableDetailPanel';
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
  const navigate = useNavigate();
  const { setDataset } = useSession();

  const [catalog, setCatalog] = useState<LoadedCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogFilters>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLoadableIds, setSelectedLoadableIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [estatisticaError, setEstatisticaError] = useState<string | null>(null);
  const [loadingEstatistica, setLoadingEstatistica] = useState(false);

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
  const packs = catalog?.packs ?? {};

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

  const loadSelection = useMemo(() => {
    const fromChecks = variables.filter(
      (v) => v.loadable && selectedLoadableIds.has(v.id),
    );
    if (fromChecks.length > 0) return fromChecks;
    if (selected?.loadable) return [selected];
    return [];
  }, [variables, selectedLoadableIds, selected]);

  const canLoadEstatistica = loadSelection.length > 0;

  function handleToggleLoadable(id: string) {
    setSelectedLoadableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setEstatisticaError(null);
  }

  async function handleLoadEstatistica() {
    if (!catalog || loadSelection.length === 0) return;
    setLoadingEstatistica(true);
    setEstatisticaError(null);
    try {
      assertCompatibleSelection(loadSelection, packs);
      const dataset = buildSessionDataset(loadSelection, packs);
      setDataset(dataset);
      const hint = resolveHint(loadSelection[0]!);
      navigate('/', {
        state: {
          activeTestId: hint.testId,
        },
      });
    } catch (err: unknown) {
      setEstatisticaError(
        err instanceof Error ? err.message : 'Não foi possível carregar a seleção.',
      );
    } finally {
      setLoadingEstatistica(false);
    }
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
          <VariableDetailPanel
            entry={selected}
            selectedLoadableCount={
              selectedLoadableIds.size > 0 ? selectedLoadableIds.size : loadSelection.length
            }
            canLoadEstatistica={canLoadEstatistica}
            loadError={estatisticaError}
            loadingEstatistica={loadingEstatistica}
            onLoadEstatistica={handleLoadEstatistica}
          />
        </aside>
      </div>
    </div>
  );
}
