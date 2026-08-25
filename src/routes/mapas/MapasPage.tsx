import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eraser } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
import { MapTestRecommendation } from './MapTestRecommendation';
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
  useMapAnalysis,
} from './mapAnalysisState';
import { TerritoryPastePanel } from './TerritoryPastePanel';
import { TerritoryDraftBar } from './TerritoryDraftBar';
import { GroupConfigPanel } from './GroupConfigPanel';
import { GroupComparisonReview } from './GroupComparisonReview';
import { assessGroupComparison } from './comparisonAssessment';
import type { ComparisonAxis } from './mapQuestionDraft';

function territoryKey(territory: TerritoryRef): string {
  return `${territory.level}:${territory.ibgeCode}`;
}

function mergeTerritories(existing: TerritoryRef[], incoming: TerritoryRef[]): TerritoryRef[] {
  const merged = [...existing];
  const seen = new Set(existing.map(territoryKey));
  for (const territory of incoming) {
    const key = territoryKey(territory);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(territory);
  }
  return merged;
}

function withoutTerritories(existing: TerritoryRef[], removed: TerritoryRef[]): TerritoryRef[] {
  const keys = new Set(removed.map(territoryKey));
  return existing.filter((territory) => !keys.has(territoryKey(territory)));
}

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

type ContextPanelMode = 'draft' | 'paste' | 'group';

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

interface GroupMembership {
  groupIndex: number;
  groupName: string;
}

function collectGroupMembership(
  groups: ReturnType<typeof useMapAnalysis>['state']['groups'],
): Record<string, GroupMembership[]> {
  const membership: Record<string, GroupMembership[]> = {};
  groups.forEach((group, index) => {
    for (const territory of group.territoryIds) {
      if (territory.level === 'uf' && territory.sigla) {
        const current = membership[territory.sigla] ?? [];
        current.push({ groupIndex: index, groupName: group.name });
        membership[territory.sigla] = current;
      }
    }
  });
  return membership;
}

function collectGroupMunicipioMembership(
  groups: ReturnType<typeof useMapAnalysis>['state']['groups'],
): Record<string, GroupMembership[]> {
  const membership: Record<string, GroupMembership[]> = {};
  groups.forEach((group, index) => {
    for (const territory of group.territoryIds) {
      if (territory.level === 'municipio') {
        const current = membership[territory.ibgeCode] ?? [];
        current.push({ groupIndex: index, groupName: group.name });
        membership[territory.ibgeCode] = current;
      }
    }
  });
  return membership;
}

function comparisonAxisForDesign(
  assessment: ReturnType<typeof assessGroupComparison>,
): ComparisonAxis {
  if (assessment.differingDimensions.includes('territory')) return 'place';
  if (assessment.differingDimensions.includes('period')) return 'period';
  if (assessment.differingDimensions.includes('disease')) return 'disease';
  return 'none';
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
  const { state, dispatch } = useMapAnalysis(mapAnalysis ?? undefined);
  const isTablet = useIsTabletViewport();
  const reduceMotion = useReducedMotion();

  const [territoryDraft, setTerritoryDraft] = useState<TerritoryRef[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [pendingCatalogIds, setPendingCatalogIds] = useState<string[]>([]);
  const [hoveredUF, setHoveredUF] = useState<string | null>(null);
  const [previewUFs, setPreviewUFs] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [contextPanelMode, setContextPanelMode] = useState<ContextPanelMode>(
    state.activeGroupId ? 'group' : 'draft',
  );
  const [groupPanelOpen, setGroupPanelOpen] = useState(true);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [confirmedDesign, setConfirmedDesign] = useState<ResearchDesign | null>(null);
  const [confirmedConfigurationKey, setConfirmedConfigurationKey] = useState<string | null>(null);

  const analysisRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);

  const activeGroup = useMemo(
    () => state.groups.find((group) => group.id === state.activeGroupId) ?? null,
    [state.activeGroupId, state.groups],
  );
  const activeGroupIndex = state.groups.findIndex((group) => group.id === state.activeGroupId);
  const editingGroup = useMemo(
    () => state.groups.find((group) => group.id === editingGroupId) ?? null,
    [editingGroupId, state.groups],
  );
  const draftSelectedUFs = useMemo(
    () =>
      territoryDraft
        .filter((territory) => territory.level === 'uf' && territory.sigla)
        .map((territory) => territory.sigla!),
    [territoryDraft],
  );
  const draftSelectedMunicipios = useMemo(
    () =>
      territoryDraft
        .filter((territory) => territory.level === 'municipio')
        .map((territory) => territory.ibgeCode),
    [territoryDraft],
  );
  const draftKeys = useMemo(() => new Set(territoryDraft.map(territoryKey)), [territoryDraft]);

  const assessment = useMemo(() => assessGroupComparison(state.groups), [state.groups]);
  const researchDesignResult = useMemo(
    () => (assessment.canDescribe ? createResearchDesignFromMapState(state) : null),
    [assessment.canDescribe, state],
  );
  const researchDesign = useMemo(() => {
    if (!researchDesignResult?.ok) return null;
    return {
      ...researchDesignResult.value,
      comparisonKind: assessment.designKind,
      goal:
        state.groups.length > 1 && assessment.canInfer
          ? ('describe_and_compare' as const)
          : ('describe' as const),
    };
  }, [assessment.canInfer, assessment.designKind, researchDesignResult, state.groups.length]);
  const currentDesignFingerprint = researchDesign ? fingerprintResearchDesign(researchDesign) : null;
  const currentConfigurationKey = useMemo(
    () =>
      JSON.stringify(
        state.groups.map((group) => ({
          id: group.id,
          territories: group.territoryIds.map(territoryKey).sort(),
          time: group.time,
          variableIds: [...group.variableIds].sort(),
        })),
      ),
    [state.groups],
  );
  const confirmedFingerprint = confirmedDesign ? fingerprintResearchDesign(confirmedDesign) : null;
  const visibleConfirmedDesign =
    confirmedFingerprint === currentDesignFingerprint &&
    confirmedConfigurationKey === currentConfigurationKey
      ? confirmedDesign
      : null;

  useEffect(() => {
    if (
      confirmedFingerprint &&
      (confirmedFingerprint !== currentDesignFingerprint ||
        confirmedConfigurationKey !== currentConfigurationKey)
    ) {
      setConfirmedDesign(null);
      setConfirmedConfigurationKey(null);
      setGuidedAnalysis(null);
      setResearchDesign(null);
    }
  }, [
    confirmedFingerprint,
    confirmedConfigurationKey,
    currentConfigurationKey,
    currentDesignFingerprint,
    setGuidedAnalysis,
    setResearchDesign,
  ]);

  const groupMembership = useMemo(() => collectGroupMembership(state.groups), [state.groups]);
  const groupMunicipioMembership = useMemo(
    () => collectGroupMunicipioMembership(state.groups),
    [state.groups],
  );

  const markInteracted = useCallback(() => setHasInteracted(true), []);

  const toggleDraftTerritories = useCallback(
    (territories: TerritoryRef[], checked?: boolean) => {
      if (territories.length === 0) return;
      setTerritoryDraft((current) => {
        const allSelected = territories.every((territory) =>
          current.some((candidate) => territoryKey(candidate) === territoryKey(territory)),
        );
        const shouldAdd = checked ?? !allSelected;
        return shouldAdd
          ? mergeTerritories(current, territories)
          : withoutTerritories(current, territories);
      });
    },
    [],
  );

  const handleToggleUF = useCallback(
    (uf: string) => {
      markInteracted();
      toggleDraftTerritories(siglasToTerritories([uf]));
      setContextPanelMode('draft');
      setPreviewUFs([]);
    },
    [markInteracted, toggleDraftTerritories],
  );

  const handleToggleRegion = useCallback(
    (presetId: RegionPresetId, checked: boolean) => {
      markInteracted();
      toggleDraftTerritories(resolvePresetTerritories(presetId), checked);
      setContextPanelMode('draft');
      setPreviewUFs([]);
    },
    [markInteracted, toggleDraftTerritories],
  );

  const handleToggleMeso = useCallback(
    (_mesoId: string, mesoCode: string, checked: boolean) => {
      markInteracted();
      toggleDraftTerritories(
        municipioIdsToTerritories(municipalityIdsForMeso(mesoCode)),
        checked,
      );
      setContextPanelMode('draft');
      setPreviewUFs([]);
    },
    [markInteracted, toggleDraftTerritories],
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
      toggleDraftTerritories(municipioIdsToTerritories(ids));
      setContextPanelMode('draft');
    },
    [markInteracted, state.mapView.level, toggleDraftTerritories],
  );

  const isDrillFeatureSelected = useCallback(
    (featureId: string) => {
      const ids =
        state.mapView.level === 'municipio'
          ? [featureId]
          : state.mapView.level === 'meso'
            ? municipalityIdsForMeso(featureId)
            : state.mapView.level === 'health-macro'
              ? municipalityIdsForHealthMacro(featureId)
              : [];
      return ids.length > 0 && ids.every((id) => draftKeys.has(`municipio:${id}`));
    },
    [draftKeys, state.mapView.level],
  );

  const createDraftGroup = useCallback(() => {
    if (territoryDraft.length === 0) return;
    if (editingGroupId) {
      dispatch({
        type: 'SET_GROUP_TERRITORIES',
        groupId: editingGroupId,
        territories: territoryDraft,
      });
      dispatch({ type: 'SET_ACTIVE_GROUP', groupId: editingGroupId });
      setEditingGroupId(null);
      setTerritoryDraft([]);
      setContextPanelMode('group');
      setGroupPanelOpen(true);
      return;
    }
    const groupNumber = state.groups.length + 1;
    dispatch({
      type: 'CREATE_GROUP',
      name: `Grupo ${groupNumber}`,
      territories: territoryDraft,
    });
    if (pendingCatalogIds.length > 0) {
      dispatch({ type: 'APPLY_CATALOG_VARIABLE_IDS', variableIds: pendingCatalogIds });
      setPendingCatalogIds([]);
    }
    setTerritoryDraft([]);
    setContextPanelMode('group');
    setGroupPanelOpen(true);
    requestAnimationFrame(() => {
      configRef.current?.focus({ preventScroll: true });
      configRef.current?.scrollIntoView?.({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, [dispatch, editingGroupId, pendingCatalogIds, reduceMotion, state.groups.length, territoryDraft]);

  const editGroupTerritories = useCallback((groupId: string) => {
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    dispatch({ type: 'SET_ACTIVE_GROUP', groupId });
    setEditingGroupId(groupId);
    setTerritoryDraft(group.territoryIds);
    setContextPanelMode('draft');
    setPreviewUFs([]);
  }, [dispatch, state.groups]);

  const cancelTerritoryEdit = useCallback(() => {
    setEditingGroupId(null);
    setTerritoryDraft([]);
    setContextPanelMode('group');
    setGroupPanelOpen(true);
  }, []);

  const startNewGroup = useCallback(() => {
    setTerritoryDraft([]);
    setEditingGroupId(null);
    setContextPanelMode('draft');
    setPreviewUFs([]);
  }, []);

  const selectConfirmedGroup = useCallback((groupId: string) => {
    dispatch({ type: 'SET_ACTIVE_GROUP', groupId });
    setEditingGroupId(null);
    setContextPanelMode('group');
    setGroupPanelOpen(true);
  }, [dispatch]);

  const handleSetMapView = useCallback(
    (mapView: typeof state.mapView) => dispatch({ type: 'SET_MAP_VIEW', mapView }),
    [dispatch],
  );

  const clearAllWork = useCallback(() => {
    dispatch({ type: 'REPLACE_STATE', state: createInitialMapAnalysisState() });
    setTerritoryDraft([]);
    setEditingGroupId(null);
    setPendingCatalogIds([]);
    setPreviewUFs([]);
    setHoveredUF(null);
    setContextPanelMode('draft');
    setClearAllOpen(false);
    setConfirmedDesign(null);
    setConfirmedConfigurationKey(null);
    setGuidedAnalysis(null);
    setResearchDesign(null);
  }, [dispatch, setGuidedAnalysis, setResearchDesign]);

  const startAnalysis = useCallback(() => {
    if (!researchDesign) return;
    setDataset(null);
    setResearchDesign(researchDesign);
    setConfirmedDesign(researchDesign);
    setConfirmedConfigurationKey(currentConfigurationKey);
    requestAnimationFrame(() => {
      const section = analysisRef.current;
      if (typeof section?.scrollIntoView !== 'function') return;
      section.focus({ preventScroll: true });
      section.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, [currentConfigurationKey, reduceMotion, researchDesign, setDataset, setResearchDesign]);

  const applySelectionPreset = useCallback(
    (presetId: GroupSelectionPresetId) => {
      markInteracted();
      dispatch({ type: 'REPLACE_STATE', state: buildPresetMapState(presetId) });
      setTerritoryDraft([]);
      setEditingGroupId(null);
      setPreviewUFs([]);
      setContextPanelMode('group');
      setGroupPanelOpen(true);
    },
    [dispatch, markInteracted],
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
      if (state.activeGroupId) {
        dispatch({ type: 'APPLY_CATALOG_VARIABLE_IDS', variableIds: resolved });
        setContextPanelMode('group');
      } else {
        setPendingCatalogIds(resolved);
        setContextPanelMode('draft');
      }
      setHasInteracted(true);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [dispatch, location.pathname, location.state, navigate, state.activeGroupId]);

  useEffect(() => {
    if (state.activeGroupId && contextPanelMode === 'group') setGroupPanelOpen(true);
  }, [contextPanelMode, state.activeGroupId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.shiftKey && (state.groups.length > 0 || territoryDraft.length > 0)) {
        event.preventDefault();
        setClearAllOpen(true);
        return;
      }
      setHoveredUF(null);
      setPreviewUFs([]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.groups.length, territoryDraft.length]);

  const renderContextBody = () => {
    if (contextPanelMode === 'paste') {
      return (
        <TerritoryPastePanel
          onMatched={(siglas) => toggleDraftTerritories(siglasToTerritories(siglas), true)}
          onMatchedTerritories={(territories) => toggleDraftTerritories(territories, true)}
          activeUfScope={state.mapView.level !== 'uf' ? state.mapView.parentCode : undefined}
        />
      );
    }

    if (contextPanelMode === 'group' && activeGroup) {
      return (
        <div
          ref={configRef}
          data-testid="map-group-config-step"
          tabIndex={-1}
          className="scroll-mt-6 focus:outline-none"
        >
          <GroupConfigPanel
            group={activeGroup}
            groupIndex={Math.max(0, activeGroupIndex)}
            dispatch={dispatch}
            open={groupPanelOpen}
            onOpenChange={setGroupPanelOpen}
            onEditTerritories={() => editGroupTerritories(activeGroup.id)}
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-white/10 bg-surface/60 p-6 backdrop-blur-md">
        <EmptyState
          heading="Primeiro, delimite um grupo"
          body={
            pendingCatalogIds.length > 0
              ? 'A variável escolhida no catálogo está reservada. Selecione os territórios no mapa e confirme o grupo.'
              : 'Clique nos territórios no mapa. Revise a cesta Seleção atual e confirme em Criar Grupo.'
          }
        />
      </div>
    );
  };

  const actionBar = (
    <MapPrimaryActionBar
      canReview={researchDesign !== null}
      analysisMode={assessment.canInfer ? 'comparison' : 'descriptive'}
      analysisUnlocked={visibleConfirmedDesign !== null}
      onReview={startAnalysis}
      onPasteTerritories={() => setContextPanelMode('paste')}
      onClearMap={() => setClearAllOpen(true)}
      clearConfirmOpen={clearAllOpen}
      onClearConfirmOpenChange={setClearAllOpen}
      onConfirmClear={clearAllWork}
    />
  );

  const comparisonReview = state.groups.length > 0 ? (
    <GroupComparisonReview groups={state.groups} assessment={assessment} />
  ) : null;

  return (
    <motion.div
      className="lacir-page-enter mx-auto max-w-[1520px] px-6 py-8"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <h1 className="font-sans text-display font-bold tracking-tight text-text">Mapas</h1>
      <p className="mt-1 max-w-3xl font-sans text-sm leading-relaxed text-text-muted">
        Primeiro selecione e confirme cada grupo. Depois defina, dentro dele, território,
        doença, medida e período. A comparação só é liberada quando o desenho é válido.
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className="lacir-mapas-map w-full shrink-0 lg:w-[58%]" aria-label="Mapa do Brasil">
          <MapBreadcrumb className="mb-3" mapView={state.mapView} onNavigate={handleSetMapView} />

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-elevated/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <PopulationGroupBar
              state={state}
              dispatch={dispatch}
              onNewGroup={startNewGroup}
              onSelectGroup={selectConfirmedGroup}
              onApplySelectionPreset={applySelectionPreset}
            />

            <div className="px-3 pt-3">
              <TerritoryDraftBar
                territories={territoryDraft}
                nextGroupNumber={state.groups.length + 1}
                onCreateGroup={createDraftGroup}
                onClear={() => setTerritoryDraft([])}
                editingGroupName={editingGroup?.name}
                onCancelEdit={editingGroup ? cancelTerritoryEdit : undefined}
                onRemove={(territory) =>
                  setTerritoryDraft((current) => withoutTerritories(current, [territory]))
                }
              />
            </div>

            <div className="relative px-2 pb-2 pt-1">
              <BrazilMapCanvas
                hoveredUF={hoveredUF}
                selectedUFs={draftSelectedUFs}
                highlightedUFs={previewUFs}
                groupMembership={groupMembership}
                groupMunicipioMembership={groupMunicipioMembership}
                onHoverUF={(uf) => {
                  if (uf) markInteracted();
                  setHoveredUF(uf);
                }}
                onToggleUF={handleToggleUF}
                choroplethValues={{}}
                activeVariableId={null}
                mapView={state.mapView}
                onSetMapView={handleSetMapView}
                selectedMunicipioIds={draftSelectedMunicipios}
                onToggleDrillFeature={handleToggleDrillFeature}
                isDrillFeatureSelected={isDrillFeatureSelected}
                pendingGroupIndex={
                  editingGroup
                    ? Math.max(0, state.groups.findIndex((group) => group.id === editingGroup.id))
                    : state.groups.length
                }
              />

              <PresetTerritoryCarousel
                visible
                focusUfSigla={state.mapView.level !== 'uf' ? state.mapView.parentCode ?? null : null}
                selectedUFs={draftSelectedUFs}
                selectedMunicipioIds={draftSelectedMunicipios}
                onToggleRegion={handleToggleRegion}
                onToggleMeso={handleToggleMeso}
                onPreviewRegion={(siglas) => setPreviewUFs(siglas ?? [])}
              />

              {state.groups.length > 0 || territoryDraft.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClearAllOpen(true)}
                  aria-label="Limpar mapa"
                  title="Limpar seleção e grupos"
                  className={cn(
                    'pointer-events-auto absolute bottom-3 right-3 z-20 h-8 gap-1.5 rounded-full border border-white/10 bg-elevated/80 px-2.5 font-sans text-[11px] font-medium text-text-muted shadow-sm backdrop-blur-sm',
                    'transition-[color,background-color,border-color,opacity,transform] duration-150 hover:-translate-y-0.5 hover:border-white/20 hover:bg-elevated hover:text-text',
                  )}
                >
                  <Eraser className="size-3.5 opacity-70" aria-hidden />
                  Limpar
                </Button>
              ) : null}
            </div>
          </div>

          <ChoroplethLegend values={[]} activeVariableId={null} />
          <SihDivergenceNotes variableIds={state.groups.flatMap((group) => group.variableIds)} />
          {!hasInteracted ? <MapLegendHint /> : null}
        </section>

        {!isTablet ? (
          <div
            className="lacir-mapas-panel flex w-full shrink-0 flex-col lg:max-h-[min(90vh,980px)] lg:w-[42%]"
            aria-label="Grupos e configuração"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {renderContextBody()}
              {comparisonReview}
            </div>
            <div className="mt-3 shrink-0 pt-1">{actionBar}</div>
          </div>
        ) : (
          <div className="w-full min-w-0 space-y-4 lg:hidden" aria-label="Grupos e configuração">
            {renderContextBody()}
            {comparisonReview}
            <div className="sticky bottom-0 z-20 rounded-xl border border-border bg-surface/90 p-4 backdrop-blur-md">
              {actionBar}
            </div>
          </div>
        )}
      </div>

      {visibleConfirmedDesign ? (
        <div
          ref={analysisRef}
          id="analise-do-recorte"
          data-testid="map-analysis-step"
          role="group"
          aria-label="Análise do recorte"
          tabIndex={-1}
          className="mt-10 scroll-mt-6"
        >
          <GuidedAnalysisWorkspace
            design={visibleConfirmedDesign}
            embedded
            initialGoal={visibleConfirmedDesign.goal ?? null}
            renderVariableSelector={(props) => <MapVariableList {...props} />}
            renderTestSelector={(props) => (
              <MapTestRecommendation
                {...props}
                comparisonAxis={comparisonAxisForDesign(assessment)}
              />
            )}
          />
        </div>
      ) : null}
    </motion.div>
  );
}
