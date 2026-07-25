import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { TerritoryRef } from '@/geo/types';
import { useSession } from '@/shared/session/SessionProvider';
import { BrazilMapCanvas } from './BrazilMapCanvas';
import { ChoroplethLegend } from './ChoroplethLegend';
import { buildUngroupedTerritories, GroupBar } from './GroupBar';
import { GroupConfigPanel } from './GroupConfigPanel';
import { MapBreadcrumb } from './MapBreadcrumb';
import { MapLegendHint } from './MapLegendHint';
import { MapPrimaryActionBar } from './MapPrimaryActionBar';
import {
  createInitialMapAnalysisState,
  deriveFlatMapSelection,
  deriveSelectionSummary,
  useMapAnalysis,
} from './mapAnalysisState';
import { getDefaultMockVariableId, getMockMetricByUf } from './mockAnalysisData';
import { SelectionSummaryStrip } from './SelectionSummaryStrip';
import { TerritoryPastePanel } from './TerritoryPastePanel';

type ContextPanelMode = 'explore' | 'paste' | 'group';

const TABLET_BREAKPOINT = 1024;

function useIsTabletViewport(): boolean {
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < TABLET_BREAKPOINT : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const update = () => setIsTablet(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isTablet;
}

function collectGroupMembership(
  groups: ReturnType<typeof useMapAnalysis>['state']['groups'],
): Record<string, { groupIndex: number; groupName: string }> {
  const membership: Record<string, { groupIndex: number; groupName: string }> = {};
  groups.forEach((group, index) => {
    for (const t of group.territoryIds) {
      if (t.level === 'uf' && t.sigla) {
        membership[t.sigla] = { groupIndex: index, groupName: group.name };
      }
    }
  });
  return membership;
}

function territoriesToSiglas(territories: TerritoryRef[]): string[] {
  return territories
    .filter((t) => t.level === 'uf' && t.sigla)
    .map((t) => t.sigla!);
}

export function MapasPage() {
  const { setMapSelection, setMapAnalysis, mapAnalysis } = useSession();
  const { state, dispatch, derived } = useMapAnalysis(mapAnalysis ?? undefined);
  const isTablet = useIsTabletViewport();

  const [hoveredUF, setHoveredUF] = useState<string | null>(null);
  const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
  const [highlightedUFs, setHighlightedUFs] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [contextPanelMode, setContextPanelMode] = useState<ContextPanelMode>('explore');
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);

  const activeGroup = useMemo(
    () => state.groups.find((group) => group.id === state.activeGroupId) ?? null,
    [state.activeGroupId, state.groups],
  );

  const activeVariableId = useMemo(() => {
    if (activeGroup?.variableIds[0]) return activeGroup.variableIds[0];
    const firstWithVars = state.groups.find((group) => group.variableIds.length > 0);
    return firstWithVars?.variableIds[0] ?? getDefaultMockVariableId();
  }, [activeGroup, state.groups]);

  const choroplethValues = useMemo(() => getMockMetricByUf(activeVariableId), [activeVariableId]);

  const ungroupedTerritories = useMemo(
    () => buildUngroupedTerritories(selectedUFs, state.groups),
    [selectedUFs, state.groups],
  );

  const summary = useMemo(
    () => deriveSelectionSummary(state, ungroupedTerritories),
    [state, ungroupedTerritories],
  );

  const groupMembership = useMemo(() => collectGroupMembership(state.groups), [state.groups]);

  const activeGroupHighlight = useMemo(() => {
    if (!state.activeGroupId) return [];
    const group = state.groups.find((g) => g.id === state.activeGroupId);
    return group ? territoriesToSiglas(group.territoryIds) : [];
  }, [state.activeGroupId, state.groups]);

  const mapHighlightedUFs = useMemo(
    () => [...new Set([...highlightedUFs, ...activeGroupHighlight])],
    [highlightedUFs, activeGroupHighlight],
  );

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
  }, []);

  const handleHoverUF = useCallback(
    (uf: string | null) => {
      if (uf !== null) markInteracted();
      setHoveredUF(uf);
    },
    [markInteracted],
  );

  const handleToggleUF = useCallback(
    (uf: string) => {
      markInteracted();
      if (groupMembership[uf]) {
        const group = state.groups.find((g) =>
          g.territoryIds.some((t) => t.level === 'uf' && t.sigla === uf),
        );
        if (group) {
          dispatch({ type: 'SET_ACTIVE_GROUP', groupId: group.id });
          setContextPanelMode('group');
          if (isTablet) setGroupSheetOpen(true);
        }
        return;
      }
      setSelectedUFs((current) =>
        current.includes(uf) ? current.filter((sigla) => sigla !== uf) : [...current, uf],
      );
    },
    [dispatch, groupMembership, isTablet, markInteracted, state.groups],
  );

  const handleGroupCreated = useCallback(
    (siglas: string[]) => {
      setSelectedUFs((current) => current.filter((sigla) => !siglas.includes(sigla)));
      setHighlightedUFs([]);
      setContextPanelMode('group');
      if (isTablet) setGroupSheetOpen(true);
    },
    [isTablet],
  );

  const handleHighlightTerritories = useCallback((territories: TerritoryRef[]) => {
    setHighlightedUFs(territoriesToSiglas(territories));
  }, []);

  const handlePasteMatched = useCallback(
    (siglas: string[]) => {
      markInteracted();
      setSelectedUFs((current) => {
        const merged = [...current];
        for (const sigla of siglas) {
          if (!merged.includes(sigla) && !groupMembership[sigla]) merged.push(sigla);
        }
        return merged;
      });
    },
    [groupMembership, markInteracted],
  );

  const handlePasteTerritories = useCallback(
    (territories: TerritoryRef[]) => {
      markInteracted();
      const ufSiglas = territories
        .filter((t) => t.level === 'uf' && t.sigla)
        .map((t) => t.sigla!);
      if (ufSiglas.length > 0) {
        handlePasteMatched(ufSiglas);
      }
      const muniIds = territories
        .filter((t) => t.level === 'municipio')
        .map((t) => t.ibgeCode);
      if (muniIds.length > 0) {
        setSelectedUFs((current) => {
          const merged = [...current];
          for (const id of muniIds) {
            if (!merged.includes(id)) merged.push(id);
          }
          return merged;
        });
      }
    },
    [handlePasteMatched, markInteracted],
  );

  const handleSetMapView = useCallback(
    (mapView: typeof state.mapView) => {
      dispatch({ type: 'SET_MAP_VIEW', mapView });
    },
    [dispatch],
  );

  const clearUngroupedSelection = useCallback(() => {
    setSelectedUFs([]);
    setHoveredUF(null);
    setHighlightedUFs([]);
  }, []);

  const clearAllWork = useCallback(() => {
    dispatch({ type: 'REPLACE_STATE', state: createInitialMapAnalysisState() });
    setSelectedUFs([]);
    setHighlightedUFs([]);
    setHoveredUF(null);
    setContextPanelMode('explore');
    setClearAllOpen(false);
    setGroupSheetOpen(false);
    setReviewOpen(false);
  }, [dispatch]);

  const openPasteMode = useCallback(() => {
    setContextPanelMode('paste');
    if (isTablet) setGroupSheetOpen(true);
  }, [isTablet]);

  const handleReview = useCallback(() => {
    if (derived.canReview) setReviewOpen(true);
  }, [derived.canReview]);

  useEffect(() => {
    setMapAnalysis(state);
  }, [state, setMapAnalysis]);

  useEffect(() => {
    const flat = deriveFlatMapSelection(state);
    if (flat) {
      setMapSelection(flat);
      return;
    }
    if (selectedUFs.length > 0) {
      setMapSelection({ ufs: selectedUFs, variables: [] });
      return;
    }
    setMapSelection(null);
  }, [selectedUFs, setMapSelection, state]);

  useEffect(() => {
    if (state.activeGroupId && contextPanelMode !== 'paste') {
      setContextPanelMode('group');
    }
  }, [state.activeGroupId, contextPanelMode]);

  useEffect(() => {
    if (isTablet && state.activeGroupId && contextPanelMode === 'group') {
      setGroupSheetOpen(true);
    }
  }, [contextPanelMode, isTablet, state.activeGroupId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (event.shiftKey && state.groups.length > 0) {
        event.preventDefault();
        setClearAllOpen(true);
        return;
      }

      clearUngroupedSelection();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearUngroupedSelection, state.groups.length]);

  const renderExplorePanel = () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-border bg-surface p-6">
      <EmptyState
        heading="Explore o mapa do Brasil"
        body="Passe o mouse sobre um estado para ver o que está disponível. Clique para selecionar um ou mais estados e formar grupos de análise."
      />
    </div>
  );

  const renderContextBody = () => {
    if (contextPanelMode === 'paste') {
      return (
        <TerritoryPastePanel
          onMatched={handlePasteMatched}
          onMatchedTerritories={handlePasteTerritories}
          activeUfScope={state.mapView.level !== 'uf' ? state.mapView.parentCode : undefined}
        />
      );
    }

    if (contextPanelMode === 'group' && activeGroup) {
      return <GroupConfigPanel group={activeGroup} dispatch={dispatch} />;
    }

    return renderExplorePanel();
  };

  const actionBar = (
    <MapPrimaryActionBar
      canReview={derived.canReview}
      onReview={handleReview}
      onPasteTerritories={openPasteMode}
      onClearMap={() => setClearAllOpen(true)}
      clearConfirmOpen={clearAllOpen}
      onClearConfirmOpenChange={setClearAllOpen}
      onConfirmClear={clearAllWork}
    />
  );

  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8">
      <h1 className="font-sans text-display font-bold text-text">Mapas</h1>

      <GroupBar
        className="mt-6"
        state={state}
        dispatch={dispatch}
        ungroupedTerritories={ungroupedTerritories}
        onGroupCreated={handleGroupCreated}
        onHighlightTerritories={handleHighlightTerritories}
      />

      <SelectionSummaryStrip className="mt-4" summary={summary} />

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <section className="lacir-mapas-map w-full lg:w-[58%]" aria-label="Mapa do Brasil">
          <MapBreadcrumb
            className="mb-3"
            mapView={state.mapView}
            onNavigate={handleSetMapView}
          />
          <BrazilMapCanvas
            hoveredUF={hoveredUF}
            selectedUFs={selectedUFs}
            highlightedUFs={mapHighlightedUFs}
            groupMembership={groupMembership}
            onHoverUF={handleHoverUF}
            onToggleUF={handleToggleUF}
            choroplethValues={choroplethValues}
            activeVariableId={activeVariableId}
            mapView={state.mapView}
            onSetMapView={handleSetMapView}
          />
          <ChoroplethLegend
            values={Object.values(choroplethValues)}
            activeVariableId={activeVariableId}
          />
          {!hasInteracted ? <MapLegendHint /> : null}
        </section>

        {!isTablet ? (
          <aside className="lacir-mapas-panel flex w-full flex-col lg:w-[42%]" aria-label="Painel contextual">
            {renderContextBody()}
            <div className="mt-auto">{actionBar}</div>
          </aside>
        ) : (
          <>
            <div className="sticky bottom-0 z-20 rounded-xl border border-border bg-surface p-4 lg:hidden">
              {actionBar}
            </div>
            <Sheet open={groupSheetOpen} onOpenChange={setGroupSheetOpen}>
              <SheetContent side="right" className="w-full max-w-[480px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>
                    {activeGroup ? activeGroup.name : 'Configurar grupo'}
                  </SheetTitle>
                  <SheetDescription>
                    Defina período e variáveis para o grupo ativo.
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-6">
                  {contextPanelMode === 'paste' ? (
                    <TerritoryPastePanel
                      onMatched={handlePasteMatched}
                      onMatchedTerritories={handlePasteTerritories}
                      activeUfScope={
                        state.mapView.level !== 'uf' ? state.mapView.parentCode : undefined
                      }
                    />
                  ) : activeGroup ? (
                    <GroupConfigPanel group={activeGroup} dispatch={dispatch} className="border-0 p-0" />
                  ) : (
                    renderExplorePanel()
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg" data-testid="review-analysis-dialog">
          <DialogHeader>
            <DialogTitle>Revisar antes de analisar</DialogTitle>
            <DialogDescription>
              Confira territórios, grupos, período e variáveis. A LACIR sugere um teste — você pode
              trocar antes de continuar.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
