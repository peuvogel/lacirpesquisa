import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eraser } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  findUfBySiglaOrCode,
  municipalityIdsForHealthMacro,
  resolvePresetTerritories,
  type RegionPresetId,
} from '@/geo/territoryCatalog';
import type { TerritoryRef } from '@/geo/types';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import type { ResearchDesign } from '@/features/research/types';
import { useSession } from '@/shared/session/SessionProvider';
import { GuidedAnalysisWorkspace } from '@/routes/variaveis/GuidedAnalysisWorkspace';
import { BrazilMapCanvas } from './BrazilMapCanvas';
import { ChoroplethLegend } from './ChoroplethLegend';
import { MapQuestionBuilder } from './MapQuestionBuilder';
import { MapVariableList } from './MapVariableList';
import {
  buildPresetMapState,
  type GroupSelectionPresetId,
} from './groupSelectionPresets';
import { MapBreadcrumb } from './MapBreadcrumb';
import { MapLegendHint } from './MapLegendHint';
import { SihDivergenceNotes } from '@/components/SihDivergenceNote';
import { MapPrimaryActionBar } from './MapPrimaryActionBar';
import { municipalityIdsForMeso } from '@/geo/mesoMembership';
import { municipioTerritory } from '@/geo/municipioNames';
import { PopulationGroupBar } from './PopulationGroupBar';
import { PresetTerritoryCarousel } from './PresetTerritoryCarousel';
import { UF_LIST } from './ufCodes';
import {
  createInitialMapAnalysisState,
  createResearchDesignFromMapState,
  resolveCatalogHandoffIds,
  territoryOwner,
  useMapAnalysis,
} from './mapAnalysisState';
import { TerritoryPastePanel } from './TerritoryPastePanel';
import {
  createInitialMapQuestionDraft,
  validateMapQuestion,
  type MapQuestionDraft,
} from './mapQuestionDraft';

function siglasToTerritories(siglas: string[]): TerritoryRef[] {
  return siglas.map((sigla) => {
    const uf = findUfBySiglaOrCode(sigla);
    return {
      level: 'uf' as const,
      ibgeCode: uf?.ibgeCode ?? sigla,
      sigla,
      name: uf?.name ?? sigla,
    };
  });
}

function municipioIdsToTerritories(ids: readonly string[]): TerritoryRef[] {
  return ids.map((id) => {
    const uf = UF_LIST.find((candidate) => candidate.ibgeCode === id.slice(0, 2));
    return municipioTerritory(id, uf?.sigla);
  });
}

export interface MapasLocationState {
  catalogVariableIds?: string[];
}

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

function collectGroupMunicipioMembership(
  groups: ReturnType<typeof useMapAnalysis>['state']['groups'],
): Record<string, { groupIndex: number; groupName: string }> {
  const membership: Record<string, { groupIndex: number; groupName: string }> = {};
  groups.forEach((group, index) => {
    for (const t of group.territoryIds) {
      if (t.level === 'municipio' && t.ibgeCode) {
        membership[t.ibgeCode] = { groupIndex: index, groupName: group.name };
      }
    }
  });
  return membership;
}

export function MapasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    setDataset,
    setGuidedAnalysis,
    setMapAnalysis,
    setResearchDesign,
    mapAnalysis,
  } = useSession();
  const { state, dispatch, derived } = useMapAnalysis(mapAnalysis ?? undefined);
  const isTablet = useIsTabletViewport();
  const reduceMotion = useReducedMotion();

  const [hoveredUF, setHoveredUF] = useState<string | null>(null);
  const [previewUFs, setPreviewUFs] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [contextPanelMode, setContextPanelMode] = useState<ContextPanelMode>('explore');
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [confirmedDesign, setConfirmedDesign] = useState<ResearchDesign | null>(null);
  const [questionDraft, setQuestionDraft] = useState<MapQuestionDraft>(
    createInitialMapQuestionDraft,
  );
  const [confirmedQuestionKey, setConfirmedQuestionKey] = useState<string | null>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);

  const analysisRef = useRef<HTMLElement>(null);

  const activeGroup = useMemo(
    () => state.groups.find((group) => group.id === state.activeGroupId) ?? null,
    [state.activeGroupId, state.groups],
  );

  const activeGroupIndex = state.groups.findIndex((group) => group.id === state.activeGroupId);
  const activeSelectedUFs = useMemo(
    () =>
      activeGroup?.territoryIds
        .filter((territory) => territory.level === 'uf' && territory.sigla)
        .map((territory) => territory.sigla!) ?? [],
    [activeGroup],
  );
  const activeSelectedMunicipios = useMemo(
    () =>
      activeGroup?.territoryIds
        .filter((territory) => territory.level === 'municipio')
        .map((territory) => territory.ibgeCode) ?? [],
    [activeGroup],
  );

  const questionValidation = useMemo(
    () => validateMapQuestion(state, questionDraft),
    [questionDraft, state],
  );
  const questionKey = `${questionDraft.comparisonAxis}:${questionDraft.objective ?? 'unset'}`;
  const researchDesignResult = useMemo(
    () => (derived.canReview ? createResearchDesignFromMapState(state) : null),
    [derived.canReview, state],
  );
  const researchDesign =
    researchDesignResult?.ok && questionValidation.safeToStart && questionDraft.objective
      ? { ...researchDesignResult.value, goal: questionDraft.objective }
      : null;
  const currentDesignFingerprint = researchDesign ? fingerprintResearchDesign(researchDesign) : null;
  const confirmedFingerprint = confirmedDesign ? fingerprintResearchDesign(confirmedDesign) : null;
  const visibleConfirmedDesign =
    confirmedFingerprint === currentDesignFingerprint && confirmedQuestionKey === questionKey
      ? confirmedDesign
      : null;

  useEffect(() => {
    if (
      confirmedFingerprint &&
      (confirmedFingerprint !== currentDesignFingerprint || confirmedQuestionKey !== questionKey)
    ) {
      setConfirmedDesign(null);
      setConfirmedQuestionKey(null);
      setGuidedAnalysis(null);
      setResearchDesign(null);
    }
  }, [
    confirmedFingerprint,
    confirmedQuestionKey,
    currentDesignFingerprint,
    questionKey,
    setGuidedAnalysis,
    setResearchDesign,
  ]);

  const groupMembership = useMemo(() => collectGroupMembership(state.groups), [state.groups]);
  const groupMunicipioMembership = useMemo(
    () => collectGroupMunicipioMembership(state.groups),
    [state.groups],
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
      const territory = siglasToTerritories([uf])[0]!;
      const owner = territoryOwner(state, territory);
      if (owner) {
        dispatch(
          owner.id === state.activeGroupId
            ? { type: 'REMOVE_TERRITORIES_FROM_GROUP', groupId: owner.id, territories: [territory] }
            : { type: 'SET_ACTIVE_GROUP', groupId: owner.id },
        );
      } else {
        dispatch({ type: 'ASSIGN_TERRITORIES_TO_ACTIVE', territories: [territory] });
      }
      setPreviewUFs([]);
      setContextPanelMode('group');
      if (isTablet) setGroupSheetOpen(true);
    },
    [dispatch, isTablet, markInteracted, state],
  );

  const applyTerritoriesToActive = useCallback(
    (territories: TerritoryRef[], checked: boolean) => {
      if (territories.length === 0) return;
      if (checked) {
        dispatch({ type: 'ASSIGN_TERRITORIES_TO_ACTIVE', territories });
      } else if (state.activeGroupId) {
        dispatch({
          type: 'REMOVE_TERRITORIES_FROM_GROUP',
          groupId: state.activeGroupId,
          territories,
        });
      }
    },
    [dispatch, state.activeGroupId],
  );

  const handleToggleRegion = useCallback(
    (presetId: RegionPresetId, checked: boolean) => {
      markInteracted();
      applyTerritoriesToActive(resolvePresetTerritories(presetId), checked);
      setPreviewUFs([]);
    },
    [applyTerritoriesToActive, markInteracted],
  );

  const handleToggleMeso = useCallback(
    (_mesoId: string, mesoCode: string, checked: boolean) => {
      markInteracted();
      applyTerritoriesToActive(
        municipioIdsToTerritories(municipalityIdsForMeso(mesoCode)),
        checked,
      );
      setPreviewUFs([]);
    },
    [applyTerritoriesToActive, markInteracted],
  );

  const handleToggleDrillFeature = useCallback(
    (featureId: string) => {
      markInteracted();
      const ids = /^\d{7}$/.test(featureId)
        ? [featureId]
        : state.mapView.level === 'meso'
          ? municipalityIdsForMeso(featureId)
          : state.mapView.level === 'health-macro'
            ? municipalityIdsForHealthMacro(featureId)
            : [];
      const territories = municipioIdsToTerritories(ids);
      if (territories.length === 0) return;

      const owners = territories.map((territory) => territoryOwner(state, territory));
      const firstOwner = owners[0];
      const allOwnedBySame =
        Boolean(firstOwner) && owners.every((owner) => owner?.id === firstOwner?.id);
      if (allOwnedBySame && firstOwner) {
        dispatch(
          firstOwner.id === state.activeGroupId
            ? {
                type: 'REMOVE_TERRITORIES_FROM_GROUP',
                groupId: firstOwner.id,
                territories,
              }
            : { type: 'SET_ACTIVE_GROUP', groupId: firstOwner.id },
        );
      } else {
        dispatch({ type: 'ASSIGN_TERRITORIES_TO_ACTIVE', territories });
      }
      setContextPanelMode('group');
      if (isTablet) setGroupSheetOpen(true);
    },
    [dispatch, isTablet, markInteracted, state],
  );

  const isDrillFeatureSelected = useCallback(
    (featureId: string) => {
      const level = state.mapView.level;
      const ids = level === 'municipio'
        ? [featureId]
        : level === 'meso'
          ? municipalityIdsForMeso(featureId)
          : level === 'health-macro'
            ? municipalityIdsForHealthMacro(featureId)
            : [];
      const first = ids.length > 0 ? groupMunicipioMembership[ids[0]!] : undefined;
      return Boolean(
        first && ids.every((id) => groupMunicipioMembership[id]?.groupIndex === first.groupIndex),
      );
    },
    [groupMunicipioMembership, state.mapView.level],
  );

  const handlePreviewRegion = useCallback((siglas: string[] | null) => {
    setPreviewUFs(siglas ?? []);
  }, []);

  const handlePasteMatched = useCallback(
    (siglas: string[]) => {
      markInteracted();
      applyTerritoriesToActive(siglasToTerritories(siglas), true);
    },
    [applyTerritoriesToActive, markInteracted],
  );

  const handlePasteTerritories = useCallback(
    (territories: TerritoryRef[]) => {
      markInteracted();
      applyTerritoriesToActive(territories, true);
    },
    [applyTerritoriesToActive, markInteracted],
  );

  const handleSetMapView = useCallback(
    (mapView: typeof state.mapView) => {
      dispatch({ type: 'SET_MAP_VIEW', mapView });
    },
    [dispatch],
  );

  const clearTransientMapState = useCallback(() => {
    setHoveredUF(null);
    setPreviewUFs([]);
  }, []);

  const clearAllWork = useCallback(() => {
    dispatch({ type: 'REPLACE_STATE', state: createInitialMapAnalysisState() });
    setPreviewUFs([]);
    setHoveredUF(null);
    setContextPanelMode('explore');
    setClearAllOpen(false);
    setGroupSheetOpen(false);
    setConfirmedDesign(null);
    setConfirmedQuestionKey(null);
    setQuestionDraft(createInitialMapQuestionDraft());
    setGuidedAnalysis(null);
    setResearchDesign(null);
  }, [dispatch, setGuidedAnalysis, setResearchDesign]);

  const openPasteMode = useCallback(() => {
    setContextPanelMode('paste');
    if (isTablet) setGroupSheetOpen(true);
  }, [isTablet]);

  const startAnalysis = useCallback(() => {
    if (!researchDesign) return;
    setDataset(null);
    setResearchDesign(researchDesign);
    setConfirmedDesign(researchDesign);
    setConfirmedQuestionKey(questionKey);
    requestAnimationFrame(() => {
      const section = analysisRef.current;
      if (typeof section?.scrollIntoView !== 'function') return;
      section.focus({ preventScroll: true });
      section.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, [questionKey, reduceMotion, researchDesign, setDataset, setResearchDesign]);

  const applySelectionPreset = useCallback(
    (presetId: GroupSelectionPresetId) => {
      markInteracted();
      dispatch({ type: 'REPLACE_STATE', state: buildPresetMapState(presetId) });
      setPreviewUFs([]);
      setContextPanelMode('group');
      if (isTablet) setGroupSheetOpen(true);
    },
    [dispatch, isTablet, markInteracted],
  );

  useEffect(() => {
    setMapAnalysis(state);
  }, [state, setMapAnalysis]);

  useEffect(() => {
    const navState = location.state as MapasLocationState | null;
    const rawIds = navState?.catalogVariableIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) return;

    const resolved = resolveCatalogHandoffIds(rawIds);
    if (resolved.length > 0) {
      dispatch({ type: 'APPLY_CATALOG_VARIABLE_IDS', variableIds: resolved });
      setHasInteracted(true);
      setContextPanelMode('group');
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [dispatch, location.pathname, location.state, navigate]);

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
      clearTransientMapState();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearTransientMapState, state.groups.length]);

  const renderExplorePanel = () => (
    <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-white/10 bg-surface/60 p-6 backdrop-blur-md">
      <EmptyState
        heading="Explore o mapa do Brasil"
        body="Clique em estados ou municípios para definir a População selecionada. Doença e período ficam nos painéis de cima; as variáveis serão escolhidas na próxima etapa."
      />
    </div>
  );

  const renderQuestionBuilder = () =>
    state.groups.length > 0 ? (
      <div className="h-full min-h-0 overflow-y-auto pr-1">
        <MapQuestionBuilder
          state={state}
          draft={questionDraft}
          dispatch={dispatch}
          onDraftChange={setQuestionDraft}
        />
      </div>
    ) : null;

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

    const questionBuilder = renderQuestionBuilder();
    if (questionBuilder) return questionBuilder;

    return renderExplorePanel();
  };

  const actionBar = (
    <MapPrimaryActionBar
      canReview={researchDesign !== null}
      analysisUnlocked={visibleConfirmedDesign !== null}
      onReview={startAnalysis}
      onPasteTerritories={openPasteMode}
      onClearMap={() => setClearAllOpen(true)}
      clearConfirmOpen={clearAllOpen}
      onClearConfirmOpenChange={setClearAllOpen}
      onConfirmClear={clearAllWork}
    />
  );

  return (
    <motion.div
      className="lacir-page-enter mx-auto max-w-[1520px] px-6 py-8"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <h1 className="font-sans text-display font-bold tracking-tight text-text">Mapas</h1>
      <p className="mt-1 max-w-2xl font-sans text-sm text-text-muted">
        Selecione territórios, defina populações, doenças e período — tudo no site, sem
        TABNET na aula.
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <section
          className="lacir-mapas-map w-full shrink-0 lg:w-[58%]"
          aria-label="Mapa do Brasil"
        >
          <MapBreadcrumb
            className="mb-3"
            mapView={state.mapView}
            onNavigate={handleSetMapView}
          />

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-elevated/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <PopulationGroupBar
                state={state}
                dispatch={dispatch}
                onApplySelectionPreset={applySelectionPreset}
              />

              <div className="relative px-2 pb-2 pt-1">
                <BrazilMapCanvas
                  hoveredUF={hoveredUF}
                  selectedUFs={activeSelectedUFs}
                  highlightedUFs={previewUFs}
                  groupMembership={groupMembership}
                  groupMunicipioMembership={groupMunicipioMembership}
                  onHoverUF={handleHoverUF}
                  onToggleUF={handleToggleUF}
                  choroplethValues={{}}
                  activeVariableId={null}
                  mapView={state.mapView}
                  onSetMapView={handleSetMapView}
                  selectedMunicipioIds={activeSelectedMunicipios}
                  onToggleDrillFeature={handleToggleDrillFeature}
                  isDrillFeatureSelected={isDrillFeatureSelected}
                  pendingGroupIndex={Math.max(0, activeGroupIndex)}
                />

                <PresetTerritoryCarousel
                  visible
                  focusUfSigla={
                    state.mapView.level !== 'uf' ? state.mapView.parentCode ?? null : null
                  }
                  selectedUFs={activeSelectedUFs}
                  selectedMunicipioIds={activeSelectedMunicipios}
                  onToggleRegion={handleToggleRegion}
                  onToggleMeso={handleToggleMeso}
                  onPreviewRegion={handlePreviewRegion}
                />

                {state.groups.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setClearAllOpen(true)}
                    aria-label="Limpar mapa"
                    title="Limpar seleção e grupos"
                    className={cn(
                      'pointer-events-auto absolute bottom-3 right-3 z-20 h-8 gap-1.5 rounded-full border border-white/10 bg-elevated/80 px-2.5 font-sans text-[11px] font-medium text-text-muted shadow-sm backdrop-blur-sm',
                      'transition-[color,background-color,border-color,opacity,transform] duration-150',
                      'hover:-translate-y-0.5 hover:border-white/20 hover:bg-elevated hover:text-text',
                      'focus-visible:ring-2 focus-visible:ring-accent/50',
                    )}
                  >
                    <Eraser className="size-3.5 opacity-70" aria-hidden />
                    Limpar
                  </Button>
                ) : null}
              </div>
          </div>

          <ChoroplethLegend
            values={[]}
            activeVariableId={null}
          />
          <SihDivergenceNotes
            variableIds={state.groups.flatMap((group) => group.variableIds)}
          />
          {!hasInteracted ? <MapLegendHint /> : null}
        </section>

        {!isTablet ? (
          <aside
            className="lacir-mapas-panel flex w-full shrink-0 flex-col overflow-hidden lg:h-[min(90vh,980px)] lg:w-[42%] lg:max-h-[min(90vh,980px)]"
            aria-label="Variáveis e configuração"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {renderContextBody()}
            </div>
            <div className="mt-3 shrink-0 pt-1">{actionBar}</div>
          </aside>
        ) : (
          <>
            <div className="sticky bottom-0 z-20 rounded-xl border border-border bg-surface/90 p-4 backdrop-blur-md lg:hidden">
              {actionBar}
            </div>
            <Sheet open={groupSheetOpen} onOpenChange={setGroupSheetOpen}>
              <SheetContent side="right" className="w-full max-w-[480px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>
                    {activeGroup ? activeGroup.name : 'Configurar grupo'}
                  </SheetTitle>
                  <SheetDescription>
                    Doença e período compartilhados no topo; as variáveis vêm na próxima etapa.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex min-h-[70vh] flex-col gap-2 px-4 pb-6">
                  {contextPanelMode === 'paste' ? (
                    <TerritoryPastePanel
                      onMatched={handlePasteMatched}
                      onMatchedTerritories={handlePasteTerritories}
                      activeUfScope={
                        state.mapView.level !== 'uf' ? state.mapView.parentCode : undefined
                      }
                    />
                  ) : (
                    <>
                      {renderQuestionBuilder() ?? renderExplorePanel()}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      {visibleConfirmedDesign ? (
        <section
          ref={analysisRef}
          id="analise-do-recorte"
          aria-label="Análise do recorte"
          tabIndex={-1}
          className="mt-10 scroll-mt-6"
        >
          <GuidedAnalysisWorkspace
            design={visibleConfirmedDesign}
            embedded
            initialGoal={visibleConfirmedDesign.goal ?? null}
            renderVariableSelector={(props) => <MapVariableList {...props} />}
          />
        </section>
      ) : null}
    </motion.div>
  );
}
