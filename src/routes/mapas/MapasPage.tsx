import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
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
import { parseCatalogId } from '@/features/catalog/taxonomy';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import type { ResearchDesign } from '@/features/research/types';
import { useSession } from '@/shared/session/SessionProvider';
import { GuidedAnalysisWorkspace } from '@/routes/variaveis/GuidedAnalysisWorkspace';
import { AddGroupDropPill } from './AddGroupDropPill';
import { BrazilMapCanvas } from './BrazilMapCanvas';
import { ChoroplethLegend } from './ChoroplethLegend';
import { buildUngroupedTerritories } from './GroupBar';
import { groupColor } from './groupPalette';
import { SharedDiseasePanel } from './SharedDiseasePanel';
import { SharedPeriodPanel } from './SharedPeriodPanel';
import {
  buildPresetMapState,
  type GroupSelectionPresetId,
} from './groupSelectionPresets';
import { MapBreadcrumb } from './MapBreadcrumb';
import {
  CREATE_DROP_ID,
  GROUP_DROP_PREFIX,
  MapGroupStrip,
} from './MapGroupStrip';
import { MapLegendHint } from './MapLegendHint';
import { SihDivergenceNote } from '@/components/SihDivergenceNote';
import { MapPrimaryActionBar } from './MapPrimaryActionBar';
import { municipalityIdsForMeso } from '@/geo/mesoMembership';
import { municipioTerritory, suggestGroupName } from '@/geo/municipioNames';
import { PresetTerritoryCarousel } from './PresetTerritoryCarousel';
import { UF_LIST } from './ufCodes';
import { UfShapeDragOverlay } from './UfShapeDragOverlay';
import {
  createInitialMapAnalysisState,
  createResearchDesignFromMapState,
  MAX_GROUPS,
  resolveCatalogHandoffIds,
  useMapAnalysis,
} from './mapAnalysisState';
import { getDivergenciaRazao } from '@/features/catalog/catalogAnalysisData';
import { TerritoryPastePanel } from './TerritoryPastePanel';

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

export interface MapasLocationState {
  catalogVariableIds?: string[];
}

type ContextPanelMode = 'explore' | 'paste' | 'group';

const TABLET_BREAKPOINT = 1024;
const PILL_HIT_W = 176;
const PILL_HIT_H = 48;

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
  const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
  const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([]);
  const [previewUFs, setPreviewUFs] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [contextPanelMode, setContextPanelMode] = useState<ContextPanelMode>('explore');
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [confirmedDesign, setConfirmedDesign] = useState<ResearchDesign | null>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  /** Exclusive accordion: at most one large panel; null = all collapsed. */
  const [openResearchSection, setOpenResearchSection] = useState<'disease' | 'period' | null>(
    'disease',
  );

  const openResearch = (section: 'disease' | 'period') => (open: boolean) => {
    setOpenResearchSection(open ? section : null);
  };

  const [rightDragActive, setRightDragActive] = useState(false);
  const [pillPos, setPillPos] = useState({ x: 0, y: 0 });
  const [pillHot, setPillHot] = useState(false);
  const [mapSelectNudge, setMapSelectNudge] = useState(false);
  const rightDragRef = useRef(false);
  const mapSelectNudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisRef = useRef<HTMLElement>(null);

  const activeGroup = useMemo(
    () => state.groups.find((group) => group.id === state.activeGroupId) ?? null,
    [state.activeGroupId, state.groups],
  );

  const activeVariableId = useMemo(() => {
    if (activeGroup?.variableIds[0]) return activeGroup.variableIds[0];
    const firstWithVars = state.groups.find((group) => group.variableIds.length > 0);
    return firstWithVars?.variableIds[0] ?? null;
  }, [activeGroup, state.groups]);

  const [dragSiglas, setDragSiglas] = useState<string[]>([]);
  const [dragProximity, setDragProximity] = useState(0);
  const groupStripRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const ungroupedTerritories = useMemo(
    () => buildUngroupedTerritories(selectedUFs, state.groups),
    [selectedUFs, state.groups],
  );

  const researchDesignResult = useMemo(
    () => (derived.canReview ? createResearchDesignFromMapState(state) : null),
    [derived.canReview, state],
  );
  const researchDesign = researchDesignResult?.ok ? researchDesignResult.value : null;
  const currentDesignFingerprint = researchDesign ? fingerprintResearchDesign(researchDesign) : null;
  const confirmedFingerprint = confirmedDesign ? fingerprintResearchDesign(confirmedDesign) : null;

  useEffect(() => {
    if (confirmedFingerprint && confirmedFingerprint !== currentDesignFingerprint) {
      setConfirmedDesign(null);
      setGuidedAnalysis(null);
    }
  }, [confirmedFingerprint, currentDesignFingerprint, setGuidedAnalysis]);

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
    (siglas: string[], muniIds: string[] = []) => {
      setSelectedUFs((current) => current.filter((sigla) => !siglas.includes(sigla)));
      if (muniIds.length > 0) {
        const drop = new Set(muniIds);
        setSelectedMunicipios((current) => current.filter((id) => !drop.has(id)));
      }
      setPreviewUFs([]);
      setContextPanelMode('group');
      if (isTablet) setGroupSheetOpen(true);
    },
    [isTablet],
  );

  const mergeOrCreateFromSiglas = useCallback(
    (siglas: string[], targetGroupId?: string) => {
      const muniTerritories: TerritoryRef[] = selectedMunicipios.map((id) => {
        const uf = UF_LIST.find((u) => u.ibgeCode === id.slice(0, 2));
        return municipioTerritory(id, uf?.sigla);
      });
      const territories = [...siglasToTerritories(siglas), ...muniTerritories];
      if (territories.length === 0) return;
      if (targetGroupId) {
        dispatch({ type: 'MERGE_TERRITORIES_TO_GROUP', groupId: targetGroupId, territories });
      } else if (state.groups.length < MAX_GROUPS) {
        dispatch({
          type: 'CREATE_GROUP',
          name: suggestGroupName(territories),
          territories,
        });
      } else {
        return;
      }
      handleGroupCreated(siglas, selectedMunicipios);
    },
    [dispatch, handleGroupCreated, selectedMunicipios, state.groups.length],
  );

  const handleShapeDragStart = useCallback((event: DragStartEvent) => {
    const siglas = event.active.data.current?.siglas as string[] | undefined;
    setDragSiglas(siglas ?? []);
    setDragProximity(0);
  }, []);

  const handleShapeDragMove = useCallback((event: DragMoveEvent) => {
    const strip = groupStripRef.current?.getBoundingClientRect();
    const translated = event.active.rect.current.translated;
    if (!strip || !translated) {
      setDragProximity(0);
      return;
    }
    const cx = translated.left + translated.width / 2;
    const cy = translated.top + translated.height / 2;
    const nearestX = Math.min(Math.max(cx, strip.left), strip.right);
    const nearestY = Math.min(Math.max(cy, strip.top), strip.bottom);
    const dist = Math.hypot(cx - nearestX, cy - nearestY);
    // Geometry only — closestCenter reports a droppable even when far away,
    // so we must not treat `event.over` as full shrink.
    // Start shrinking ~280px from the strip; full shrink on contact.
    const proximity = 1 - Math.min(1, dist / 280);
    setDragProximity(proximity);
  }, []);

  const handleShapeDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragSiglas([]);
      setDragProximity(0);
      const siglas = event.active.data.current?.siglas as string[] | undefined;
      if (!siglas?.length || !event.over) return;
      const overId = String(event.over.id);
      if (overId === CREATE_DROP_ID) {
        mergeOrCreateFromSiglas(siglas);
        return;
      }
      if (overId.startsWith(GROUP_DROP_PREFIX)) {
        mergeOrCreateFromSiglas(siglas, overId.slice(GROUP_DROP_PREFIX.length));
      }
    },
    [mergeOrCreateFromSiglas],
  );

  const handleToggleRegion = useCallback(
    (presetId: RegionPresetId, checked: boolean) => {
      markInteracted();
      const siglas = resolvePresetTerritories(presetId)
        .map((t) => t.sigla!)
        .filter(Boolean);
      const drop = new Set(siglas);
      setSelectedUFs((current) => {
        if (checked) {
          const next = new Set(current);
          for (const s of siglas) {
            if (!groupMembership[s]) next.add(s);
          }
          return [...next];
        }
        return current.filter((s) => !drop.has(s));
      });
      setPreviewUFs([]);
    },
    [groupMembership, markInteracted],
  );

  const handleToggleMeso = useCallback(
    (_mesoId: string, mesoCode: string, checked: boolean) => {
      markInteracted();
      const muniIds = municipalityIdsForMeso(mesoCode);
      const drop = new Set(muniIds);
      setSelectedMunicipios((current) => {
        if (checked) return [...new Set([...current, ...muniIds])];
        return current.filter((id) => !drop.has(id));
      });
      // Soft UF highlight for meso parent should not linger as a fake selection.
      setPreviewUFs([]);
    },
    [markInteracted],
  );

  const handleToggleMunicipioSet = useCallback(
    (ibgeCodes: readonly string[], checked: boolean) => {
      markInteracted();
      setSelectedMunicipios((current) => {
        if (checked) return [...new Set([...current, ...ibgeCodes])];
        const drop = new Set(ibgeCodes);
        return current.filter((id) => !drop.has(id));
      });
    },
    [markInteracted],
  );

  const handleToggleDrillFeature = useCallback(
    (featureId: string) => {
      markInteracted();
      // 7-digit IBGE municipality — toggle from Brazil view or UF zoom (no drill required).
      if (/^\d{7}$/.test(featureId)) {
        if (groupMunicipioMembership[featureId]) {
          const group = state.groups.find((g) =>
            g.territoryIds.some((t) => t.level === 'municipio' && t.ibgeCode === featureId),
          );
          if (group) {
            dispatch({ type: 'SET_ACTIVE_GROUP', groupId: group.id });
            setContextPanelMode('group');
            if (isTablet) setGroupSheetOpen(true);
          }
          return;
        }
        setSelectedMunicipios((current) =>
          current.includes(featureId)
            ? current.filter((id) => id !== featureId)
            : [...current, featureId],
        );
        return;
      }
      const level = state.mapView.level;
      if (level === 'meso') {
        const ids = municipalityIdsForMeso(featureId);
        if (ids.length === 0) return;
        if (ids.every((id) => groupMunicipioMembership[id])) {
          const group = state.groups.find((g) =>
            g.territoryIds.some((t) => t.level === 'municipio' && t.ibgeCode === ids[0]),
          );
          if (group) {
            dispatch({ type: 'SET_ACTIVE_GROUP', groupId: group.id });
            setContextPanelMode('group');
            if (isTablet) setGroupSheetOpen(true);
          }
          return;
        }
        const selected = new Set(selectedMunicipios);
        const checked = !ids.every((id) => selected.has(id));
        handleToggleMunicipioSet(ids, checked);
        return;
      }
      if (level === 'health-macro') {
        const ids = municipalityIdsForHealthMacro(featureId);
        if (ids.length === 0) return;
        if (ids.every((id) => groupMunicipioMembership[id])) {
          const group = state.groups.find((g) =>
            g.territoryIds.some((t) => t.level === 'municipio' && t.ibgeCode === ids[0]),
          );
          if (group) {
            dispatch({ type: 'SET_ACTIVE_GROUP', groupId: group.id });
            setContextPanelMode('group');
            if (isTablet) setGroupSheetOpen(true);
          }
          return;
        }
        const selected = new Set(selectedMunicipios);
        const checked = !ids.every((id) => selected.has(id));
        handleToggleMunicipioSet(ids, checked);
      }
    },
    [
      dispatch,
      groupMunicipioMembership,
      handleToggleMunicipioSet,
      isTablet,
      markInteracted,
      selectedMunicipios,
      state.groups,
      state.mapView.level,
    ],
  );

  const isDrillFeatureSelected = useCallback(
    (featureId: string) => {
      const level = state.mapView.level;
      const selected = new Set([
        ...selectedMunicipios,
        ...Object.keys(groupMunicipioMembership),
      ]);
      if (level === 'municipio') return selected.has(featureId);
      if (level === 'meso') {
        const ids = municipalityIdsForMeso(featureId);
        return ids.length > 0 && ids.every((id) => selected.has(id));
      }
      if (level === 'health-macro') {
        const ids = municipalityIdsForHealthMacro(featureId);
        return ids.length > 0 && ids.every((id) => selected.has(id));
      }
      return false;
    },
    [groupMunicipioMembership, selectedMunicipios, state.mapView.level],
  );

  const handlePreviewRegion = useCallback((siglas: string[] | null) => {
    setPreviewUFs(siglas ?? []);
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
      if (ufSiglas.length > 0) handlePasteMatched(ufSiglas);
      const muniIds = territories
        .filter((t) => t.level === 'municipio')
        .map((t) => t.ibgeCode);
      if (muniIds.length > 0) {
        setSelectedMunicipios((current) => [...new Set([...current, ...muniIds])]);
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
    setSelectedMunicipios([]);
    setHoveredUF(null);
    setPreviewUFs([]);
  }, []);

  const clearAllWork = useCallback(() => {
    dispatch({ type: 'REPLACE_STATE', state: createInitialMapAnalysisState() });
    setSelectedUFs([]);
    setSelectedMunicipios([]);
    setPreviewUFs([]);
    setHoveredUF(null);
    setContextPanelMode('explore');
    setClearAllOpen(false);
    setGroupSheetOpen(false);
    setConfirmedDesign(null);
    setGuidedAnalysis(null);
  }, [dispatch, setGuidedAnalysis]);

  const openPasteMode = useCallback(() => {
    setContextPanelMode('paste');
    if (isTablet) setGroupSheetOpen(true);
  }, [isTablet]);

  const startAnalysis = useCallback(() => {
    if (!researchDesign) return;
    setDataset(null);
    setResearchDesign(researchDesign);
    setConfirmedDesign(researchDesign);
    requestAnimationFrame(() => {
      const section = analysisRef.current;
      if (typeof section?.scrollIntoView !== 'function') return;
      section.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, [reduceMotion, researchDesign, setDataset, setResearchDesign]);

  const createGroupFromSelection = useCallback(() => {
    if (state.groups.length >= MAX_GROUPS) return;
    const siglas = ungroupedTerritories.filter((t) => t.sigla).map((t) => t.sigla!);
    if (siglas.length === 0 && selectedMunicipios.length === 0) return;
    mergeOrCreateFromSiglas(siglas);
  }, [
    mergeOrCreateFromSiglas,
    selectedMunicipios.length,
    state.groups.length,
    ungroupedTerritories,
  ]);

  const requestMapSelect = useCallback(() => {
    markInteracted();
    if (mapSelectNudgeTimer.current) clearTimeout(mapSelectNudgeTimer.current);
    setMapSelectNudge(true);
    mapSelectNudgeTimer.current = setTimeout(() => setMapSelectNudge(false), 1400);
  }, [markInteracted]);

  const applySelectionPreset = useCallback(
    (presetId: GroupSelectionPresetId) => {
      markInteracted();
      dispatch({ type: 'REPLACE_STATE', state: buildPresetMapState(presetId) });
      setSelectedUFs([]);
      setSelectedMunicipios([]);
      setPreviewUFs([]);
      setContextPanelMode('group');
      if (isTablet) setGroupSheetOpen(true);
    },
    [dispatch, isTablet, markInteracted],
  );

  useEffect(
    () => () => {
      if (mapSelectNudgeTimer.current) clearTimeout(mapSelectNudgeTimer.current);
    },
    [],
  );

  const hitPill = useCallback((clientX: number, clientY: number) => {
    const left = pillPos.x - PILL_HIT_W / 2;
    const top = pillPos.y - PILL_HIT_H / 2;
    return (
      clientX >= left &&
      clientX <= left + PILL_HIT_W &&
      clientY >= top &&
      clientY <= top + PILL_HIT_H
    );
  }, [pillPos.x, pillPos.y]);

  const hasUngroupedSelection =
    ungroupedTerritories.length > 0 || selectedMunicipios.length > 0;

  const onMapPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 2) return;
      if (!hasUngroupedSelection) return;
      event.preventDefault();
      rightDragRef.current = true;
      setRightDragActive(true);
      setPillPos({ x: event.clientX, y: event.clientY - 56 });
      setPillHot(false);
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    },
    [hasUngroupedSelection],
  );

  const onMapPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!rightDragRef.current) return;
      setPillHot(hitPill(event.clientX, event.clientY));
    },
    [hitPill],
  );

  const onMapPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!rightDragRef.current) return;
      rightDragRef.current = false;
      const hot = hitPill(event.clientX, event.clientY);
      setRightDragActive(false);
      setPillHot(false);
      if (hot) createGroupFromSelection();
    },
    [createGroupFromSelection, hitPill],
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
      clearUngroupedSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearUngroupedSelection, state.groups.length]);

  const selectionCount = ungroupedTerritories.length + selectedMunicipios.length;

  const sharedDiseaseVariableIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const group of state.groups) {
      for (const id of group.variableIds) {
        if (!parseCatalogId(id) || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [state.groups]);

  const renderExplorePanel = () => (
    <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-white/10 bg-surface/60 p-6 backdrop-blur-md">
      <EmptyState
        heading="Explore o mapa do Brasil"
        body="Selecione estados ou municípios e clique em Adicionar grupo. Doença e período ficam nos painéis de cima; as variáveis serão escolhidas na próxima etapa."
      />
    </div>
  );

  const renderSharedResearchPanels = () =>
    state.groups.length > 0 ? (
      <>
        <SharedDiseasePanel
          selectedVariableIds={sharedDiseaseVariableIds}
          dispatch={dispatch}
          open={openResearchSection === 'disease'}
          onOpenChange={openResearch('disease')}
        />
        <SharedPeriodPanel
          state={state}
          dispatch={dispatch}
          diseaseVariableIds={sharedDiseaseVariableIds}
          activeGroup={activeGroup}
          open={openResearchSection === 'period'}
          onOpenChange={openResearch('period')}
        />
      </>
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

    const sharedPanels = renderSharedResearchPanels();

    if (contextPanelMode === 'group' && activeGroup) {
      return (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          {sharedPanels}
          <div className="rounded-2xl border border-border bg-elevated/40 p-5">
            <p className="font-sans text-sm font-bold text-text">{activeGroup.name}</p>
            <p className="mt-1 font-sans text-sm leading-relaxed text-text-muted">
              Territórios definidos para este grupo. Continue com doença e período; as variáveis
              serão escolhidas depois do recorte.
            </p>
          </div>
        </div>
      );
    }

    if (sharedPanels) {
      return (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          {sharedPanels}
          <div className="min-h-0 flex-1 overflow-hidden">{renderExplorePanel()}</div>
        </div>
      );
    }

    return renderExplorePanel();
  };

  const actionBar = (
    <MapPrimaryActionBar
      canReview={researchDesign !== null}
      analysisUnlocked={confirmedDesign !== null}
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
        Selecione territórios, forme grupos e defina doenças e período — tudo no site, sem
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleShapeDragStart}
            onDragMove={handleShapeDragMove}
            onDragEnd={handleShapeDragEnd}
            onDragCancel={() => {
              setDragSiglas([]);
              setDragProximity(0);
            }}
          >
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl border border-white/10 bg-elevated/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[box-shadow,border-color] duration-300',
                mapSelectNudge && 'lacir-map-select-nudge',
              )}
              onContextMenu={(e) => {
                if (hasUngroupedSelection) e.preventDefault();
              }}
              onPointerDown={onMapPointerDown}
              onPointerMove={onMapPointerMove}
              onPointerUp={onMapPointerUp}
              onPointerCancel={() => {
                rightDragRef.current = false;
                setRightDragActive(false);
                setPillHot(false);
              }}
            >
              <MapGroupStrip
                ref={groupStripRef}
                state={state}
                dispatch={dispatch}
                selectionCount={selectionCount}
                onCreateFromSelection={createGroupFromSelection}
                onRequestMapSelect={requestMapSelect}
                onApplySelectionPreset={applySelectionPreset}
              />

              <div className="relative px-2 pb-2 pt-1">
                <BrazilMapCanvas
                  hoveredUF={hoveredUF}
                  selectedUFs={selectedUFs}
                  highlightedUFs={previewUFs}
                  groupMembership={groupMembership}
                  groupMunicipioMembership={groupMunicipioMembership}
                  onHoverUF={handleHoverUF}
                  onToggleUF={handleToggleUF}
                  choroplethValues={{}}
                  activeVariableId={null}
                  mapView={state.mapView}
                  onSetMapView={handleSetMapView}
                  enableShapeDrag
                  selectedMunicipioIds={selectedMunicipios}
                  onToggleDrillFeature={handleToggleDrillFeature}
                  isDrillFeatureSelected={isDrillFeatureSelected}
                  pendingGroupIndex={state.groups.length}
                />

                <PresetTerritoryCarousel
                  visible
                  focusUfSigla={
                    state.mapView.level !== 'uf' ? state.mapView.parentCode ?? null : null
                  }
                  selectedUFs={selectedUFs}
                  selectedMunicipioIds={selectedMunicipios}
                  onToggleRegion={handleToggleRegion}
                  onToggleMeso={handleToggleMeso}
                  onPreviewRegion={handlePreviewRegion}
                />

                {(hasUngroupedSelection || state.groups.length > 0) && (
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
                )}
              </div>
            </div>
            <DragOverlay dropAnimation={null}>
              {dragSiglas.length > 0 ? (
                <UfShapeDragOverlay
                  siglas={dragSiglas}
                  proximity={dragProximity}
                  accentStroke={groupColor(state.groups.length).stroke}
                />
              ) : null}
            </DragOverlay>
          </DndContext>

          <ChoroplethLegend
            values={[]}
            activeVariableId={null}
          />
          <SihDivergenceNote
            razao={activeVariableId ? getDivergenciaRazao(activeVariableId) : null}
          />
          {!hasInteracted ? <MapLegendHint /> : null}
          {hasUngroupedSelection ? (
            <p className="mt-2 font-sans text-xs text-text-muted">
              {selectionCount} território{selectionCount === 1 ? '' : 's'} pronto
              {selectionCount === 1 ? '' : 's'} — clique em{' '}
              <span className="font-semibold text-accent">Adicionar grupo</span> acima (ou
              arraste com o botão direito até a pill). O período fica no painel à direita.
            </p>
          ) : null}
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
                      {renderSharedResearchPanels()}
                      {activeGroup ? (
                        <div className="rounded-2xl border border-border bg-elevated/40 p-5">
                          <p className="font-sans text-sm font-bold text-text">{activeGroup.name}</p>
                          <p className="mt-1 font-sans text-sm leading-relaxed text-text-muted">
                            Territórios definidos para este grupo. Continue com doença e período;
                            as variáveis serão escolhidas depois do recorte.
                          </p>
                        </div>
                      ) : renderExplorePanel()}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      <AddGroupDropPill
        visible={rightDragActive}
        active={pillHot}
        x={pillPos.x}
        y={pillPos.y}
        selectionCount={selectionCount}
        accentStroke={groupColor(state.groups.length).stroke}
      />

      {confirmedDesign ? (
        <section
          ref={analysisRef}
          id="analise-do-recorte"
          aria-label="Análise do recorte"
          className="mt-10 scroll-mt-6"
        >
          <GuidedAnalysisWorkspace design={confirmedDesign} embedded />
        </section>
      ) : null}
    </motion.div>
  );
}
