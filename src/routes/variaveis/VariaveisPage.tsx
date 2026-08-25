import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  filterCatalog,
  type CatalogFilters,
} from '@/features/catalog/filterCatalog';
import {
  assertCompatibleSelection,
  buildSessionDataset,
} from '@/features/catalog/buildSessionDataset';
import { ALIASES, withDiseaseAliases } from '@/features/catalog/diseaseAliases';
import { loadCatalog, type LoadedCatalog } from '@/features/catalog/loadCatalog';
import { DISEASES } from '@/features/catalog/taxonomy';
import type { CatalogEntry } from '@/features/catalog/types';
import { useSession } from '@/shared/session/SessionProvider';
import { GuidedAnalysisWorkspace } from './GuidedAnalysisWorkspace';
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
  const { researchDesign } = useSession();

  return researchDesign
    ? (
        <GuidedAnalysisWorkspace
          design={researchDesign}
          initialGoal={researchDesign.goal ?? null}
        />
      )
    : <DirectCatalogPage />;
}

function DirectCatalogPage() {
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
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [loadingEstatistica, setLoadingEstatistica] = useState(false);
  const [loadingMapas, setLoadingMapas] = useState(false);

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

  const variables = useMemo(
    () =>
      (catalog?.variables ?? []).filter(
        (v) => v.sourceSystem !== 'LACIR' && v.domain !== 'meta',
      ),
    [catalog],
  );
  const packs = catalog?.packs ?? {};

  const sourceOptions = useMemo(
    () => [...new Set(variables.map((v) => v.sourceSystem))].sort(),
    [variables],
  );

  const domainOptions = useMemo(
    () => [...new Set(variables.map((v) => v.domain))].sort(),
    [variables],
  );

  // Enriquece com apelidos clinicos curados (TAX-05) so no indice de busca, em memoria —
  // nunca gravado em public/data/catalog/variables.json (artefato gerado, TAX-06).
  const variablesWithAliases = useMemo(
    () => withDiseaseAliases(variables, DISEASES, ALIASES),
    [variables],
  );

  const filtered = useMemo(
    () => filterCatalog(variablesWithAliases, filters),
    [variablesWithAliases, filters],
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
    setHandoffError(null);
  }

  async function handleLoadEstatistica() {
    if (!catalog || loadSelection.length === 0) return;
    setLoadingEstatistica(true);
    setHandoffError(null);
    try {
      assertCompatibleSelection(loadSelection, packs);
      const dataset = buildSessionDataset(loadSelection, packs);
      setDataset(dataset);
      navigate('/');
    } catch (err: unknown) {
      setHandoffError(
        err instanceof Error ? err.message : 'Não foi possível carregar a seleção.',
      );
    } finally {
      setLoadingEstatistica(false);
    }
  }

  async function handleLoadMapas() {
    if (!catalog || loadSelection.length === 0) return;
    setLoadingMapas(true);
    setHandoffError(null);
    try {
      assertCompatibleSelection(loadSelection, packs);
      navigate('/mapas', {
        state: {
          catalogVariableIds: loadSelection.map((entry) => entry.id),
        },
      });
    } catch (err: unknown) {
      setHandoffError(
        err instanceof Error ? err.message : 'Não foi possível abrir a seleção no mapa.',
      );
    } finally {
      setLoadingMapas(false);
    }
  }

  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="lacir-page-enter mx-auto max-w-[1520px] px-6 py-8"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <h1 className="font-sans text-display font-bold tracking-tight text-text">Variáveis</h1>
      <p className="mt-2 max-w-2xl font-sans text-body text-text-muted">
        Catálogo curado com proveniência obrigatória. Busque, filtre e carregue na Estatística ou
        no Mapa — tudo no site, sem TABNET na aula.
      </p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-surface/50 p-4 backdrop-blur-md">
        <VariableFilters
          filters={filters}
          sourceOptions={sourceOptions}
          domainOptions={domainOptions}
          onChange={setFilters}
        />
        <p className="mt-2 font-sans text-xs text-text-muted">
          {loading ? 'Carregando…' : `${filtered.length} de ${variables.length} variáveis`}
          {selectedLoadableIds.size > 0
            ? ` · ${selectedLoadableIds.size} selecionada(s) para carregar`
            : null}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
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
          className="flex min-h-[320px] w-full flex-col rounded-2xl border border-white/10 bg-surface/70 p-6 shadow-lg backdrop-blur-xl lg:w-[58%]"
          aria-label="Detalhe da variável"
        >
          <VariableDetailPanel
            entry={selected}
            selectedLoadableCount={
              selectedLoadableIds.size > 0 ? selectedLoadableIds.size : loadSelection.length
            }
            canLoadEstatistica={canLoadEstatistica}
            canLoadMapas={canLoadEstatistica}
            loadError={handoffError}
            loadingEstatistica={loadingEstatistica}
            loadingMapas={loadingMapas}
            onLoadEstatistica={handleLoadEstatistica}
            onLoadMapas={handleLoadMapas}
          />
        </aside>
      </div>
    </motion.div>
  );
}
