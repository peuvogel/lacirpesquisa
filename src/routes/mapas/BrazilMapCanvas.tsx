import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { createChoroplethScale } from '@/geo/choroplethScale';
import {
  MAP_METRIC_FILLS,
  MAP_METRIC_STROKES,
  isPositiveFiniteMapValue,
  mapMetricTooltip,
  normalizeMapMetricCell,
  type MapMetricInput,
} from '@/geo/mapMetricCell';
import { loadMesoTopo, loadMuniTopo } from '@/geo/loadGeoAsset';
import { municipalityIdsForMeso } from '@/geo/mesoMembership';
import {
  filterFeaturesByUfPrefix,
  projectFeaturesToBrazilUfPaths,
  projectTopoToBrazilUfPaths,
  topoToFeatures,
  type ProjectedPath,
} from '@/geo/projectGeoToSvg';
import { healthMacrosForUf } from '@/geo/healthMacroIds';
import {
  HEALTH_MACRO_CATALOG,
  municipalityIdsForHealthMacro,
} from '@/geo/territoryCatalog';
import type { GeoLevel, MapViewState } from '@/geo/types';
import { BRAZIL_UF_GROUP_TRANSFORM, BRAZIL_UF_PATHS, BRAZIL_UF_VIEWBOX } from './brazilUfPaths';
import { getUfName, UF_LIST } from './ufCodes';
import { DraggableUfPath } from './DraggableUfPath';
import {
  groupColor,
  groupHoverFill,
  groupMuniHoverFill,
  groupMuniSelectionFill,
  groupSelectionFill,
} from './groupPalette';
import { MapGeoPath } from './MapGeoPath';
import { UfHoverDrillLupa } from './UfHoverDrillLupa';
import { paddedViewBoxFromBBox, useAnimatedViewBox } from './useAnimatedViewBox';
import { useFadingSelection } from './useFadingSelection';
import type { BrazilMockMapProps, MapGroupMembership } from './BrazilMockMap';

const UF_DESELECT_FADE_MS = 420;

export interface BrazilMapCanvasProps extends BrazilMockMapProps {
  /** Typed cells are preferred; raw numbers remain supported at this boundary. */
  choroplethValues: Record<string, MapMetricInput>;
  activeVariableId: string | null;
  mapView?: MapViewState;
  onSetMapView?: (view: MapViewState) => void;
  /** Drag UF shapes into group slots (requires parent DndContext). */
  enableShapeDrag?: boolean;
  /** Municípios selected (drill click, mesorregião / macrorregião presets). */
  selectedMunicipioIds?: readonly string[];
  /** Municípios already assigned to analysis groups (paint with group colors). */
  groupMunicipioMembership?: Record<string, MapGroupMembership[]>;
  /** Toggle a feature on the drilled map (município / meso / macrorregião). */
  onToggleDrillFeature?: (featureId: string) => void;
  /** Whether a drilled feature is fully selected. */
  isDrillFeatureSelected?: (featureId: string) => boolean;
  /**
   * Palette index for the selection currently being built (next group).
   * After group 1 (index 0) exists, drafting group 2 uses index 1 (blue), etc.
   */
  pendingGroupIndex?: number;
}

const EMPTY_MUNI_MEMBERSHIP: Record<string, MapGroupMembership[]> = {};

const MULTI_GROUP_FILL = 'rgba(161, 161, 170, 0.24)';

function membershipBadge(memberships: MapGroupMembership[] | undefined): string | undefined {
  if (!memberships?.length) return undefined;
  if (memberships.length === 1) {
    return `Grupo ${memberships[0]!.groupIndex + 1}: ${memberships[0]!.groupName}`;
  }
  return `Grupos: ${memberships.map((membership) => membership.groupName).join(', ')}`;
}

function drillFeatureGroupMembership(
  featureId: string,
  level: GeoLevel,
  membership: Record<string, MapGroupMembership[]>,
): MapGroupMembership[] {
  if (level === 'municipio') return membership[featureId] ?? [];
  const ids =
    level === 'meso'
      ? municipalityIdsForMeso(featureId)
      : level === 'health-macro'
        ? municipalityIdsForHealthMacro(featureId)
        : [];
  if (ids.length === 0) return [];
  const first = membership[ids[0]!] ?? [];
  return first.filter((candidate) =>
    ids.every((id) =>
      membership[id]?.some((value) => value.groupIndex === candidate.groupIndex),
    ),
  );
}

const SURFACE_FILL = '#18181b';
const NEIGHBOR_FILL = '#121214';
const MUNI_HOVER_STROKE = 'rgba(255,255,255,0.28)';
const PARALLAX_MAX = 6;
/** Stable default — inline `= []` would re-trigger municipio paint effects every render. */
const EMPTY_MUNICIPIO_IDS: readonly string[] = [];

function mapMetricPaint(
  input: MapMetricInput,
  scale: ReturnType<typeof createChoroplethScale> | null,
): { fill: string; stroke?: string; description: string } {
  const cell = normalizeMapMetricCell(input);
  switch (cell.displayStatus) {
    case 'zero':
      return { fill: MAP_METRIC_FILLS.zero, description: mapMetricTooltip(cell) };
    case 'review':
      return {
        fill: MAP_METRIC_FILLS.review,
        stroke: MAP_METRIC_STROKES.review,
        description: mapMetricTooltip(cell),
      };
    case 'missing':
      return {
        fill: MAP_METRIC_FILLS.missing,
        stroke: MAP_METRIC_STROKES.missing,
        description: mapMetricTooltip(cell),
      };
    case 'value':
      return {
        fill: scale && isPositiveFiniteMapValue(cell.value) ? scale(cell.value) : MAP_METRIC_FILLS.missing,
        description: mapMetricTooltip(cell),
      };
  }
}

function ufIbgeForSigla(sigla: string): string | undefined {
  return UF_LIST.find((uf) => uf.sigla === sigla)?.ibgeCode;
}

/** Matches BRAZIL_UF_GROUP_TRANSFORM scale(0.0001,-0.0001). */
const UF_PATH_SCALE_X = 0.0001;
const UF_PATH_SCALE_Y = -0.0001;

type BBox = { x: number; y: number; width: number; height: number };

/**
 * path.getBBox() is in raw path units (before the UF group transform).
 * The SVG viewBox is in post-transform space — convert or the camera zooms to nowhere.
 */
function localPathBBoxToViewBox(box: BBox): BBox {
  const x1 = box.x * UF_PATH_SCALE_X;
  const x2 = (box.x + box.width) * UF_PATH_SCALE_X;
  const y1 = box.y * UF_PATH_SCALE_Y;
  const y2 = (box.y + box.height) * UF_PATH_SCALE_Y;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function approximateBBoxFromPath(d: string): BBox | null {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums || nums.length < 4) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]! * UF_PATH_SCALE_X;
    const y = nums[i + 1]! * UF_PATH_SCALE_Y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function viewBoxBBoxForUf(sigla: string, pathEl?: SVGPathElement | null): BBox | null {
  try {
    if (pathEl && typeof pathEl.getBBox === 'function') {
      const live = pathEl.getBBox();
      if (live.width > 0 && live.height > 0) {
        return localPathBBoxToViewBox(live);
      }
    }
  } catch {
    // jsdom / detached
  }
  const d = BRAZIL_UF_PATHS.find((p) => p.sigla === sigla)?.d;
  return d ? approximateBBoxFromPath(d) : null;
}

async function loadDrillPathsBrazilCrs(
  level: Exclude<GeoLevel, 'uf'>,
  ufIbge: string,
): Promise<ProjectedPath[]> {
  switch (level) {
    case 'municipio': {
      const topo = await loadMuniTopo(ufIbge);
      return projectTopoToBrazilUfPaths(topo);
    }
    case 'meso': {
      const topo = await loadMesoTopo();
      const features = filterFeaturesByUfPrefix(topoToFeatures(topo), ufIbge);
      return projectFeaturesToBrazilUfPaths(features);
    }
    case 'health-macro': {
      // Sample health-macro TopoJSON is stubby / misaligned with Brazil UF CRS.
      // Paint macros as their constituent municipalities (same CRS as municipio drill).
      const macros = healthMacrosForUf(ufIbge);
      if (macros.length === 0) return [];
      const topo = await loadMuniTopo(ufIbge);
      const muniPaths = projectTopoToBrazilUfPaths(topo);
      const byId = new Map(muniPaths.map((path) => [path.id, path]));
      const nameById = new Map(HEALTH_MACRO_CATALOG.map((entry) => [entry.id, entry.name]));
      const out: ProjectedPath[] = [];
      for (const macro of macros) {
        const nome = nameById.get(macro.id) ?? macro.id;
        for (const muniId of macro.municipalityIds) {
          const path = byId.get(muniId);
          if (!path?.d) continue;
          out.push({
            id: macro.id,
            d: path.d,
            properties: { ...path.properties, nome, muniId, codarea: macro.id },
          });
        }
      }
      return out;
    }
    default:
      return [];
  }
}

/**
 * UF map canvas with choropleth fills and MAP-03 drill-down.
 * Lupa zoom keeps Brazil in frame (neighbors visible, not selectable).
 */
export function BrazilMapCanvas({
  hoveredUF,
  selectedUFs,
  highlightedUFs = [],
  groupMembership = {},
  onHoverUF,
  onToggleUF,
  choroplethValues,
  activeVariableId,
  mapView = { level: 'uf' },
  onSetMapView,
  enableShapeDrag = false,
  selectedMunicipioIds = EMPTY_MUNICIPIO_IDS,
  groupMunicipioMembership = EMPTY_MUNI_MEMBERSHIP,
  onToggleDrillFeature,
  isDrillFeatureSelected,
  pendingGroupIndex = 0,
}: BrazilMapCanvasProps) {
  const [drillPaths, setDrillPaths] = useState<ProjectedPath[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const loadTokenRef = useRef(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const preferReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pendingColor = groupColor(pendingGroupIndex);
  const hoverFill = groupHoverFill(pendingGroupIndex);
  const selectionFill = groupSelectionFill(pendingGroupIndex);
  const muniSelectedFill = groupMuniSelectionFill(pendingGroupIndex);
  const muniHoverFill = groupMuniHoverFill(pendingGroupIndex);
  const selectionFilterId = `lacir-group-outer-${pendingGroupIndex % 10}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const paintPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lupaPinnedRef = useRef(false);
  const muniCacheRef = useRef<Map<string, ProjectedPath[]>>(new Map());

  const [lupaPos, setLupaPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverMuni, setHoverMuni] = useState<{
    sigla: string;
    paths: ProjectedPath[];
  } | null>(null);
  const [selectedMuniPaths, setSelectedMuniPaths] = useState<ProjectedPath[]>([]);
  const [cameraTarget, setCameraTarget] = useState(BRAZIL_UF_VIEWBOX);

  const selectedMuniSet = useMemo(() => new Set(selectedMunicipioIds), [selectedMunicipioIds]);
  const paintMuniIds = useMemo(() => {
    const ids = new Set(selectedMunicipioIds);
    for (const id of Object.keys(groupMunicipioMembership)) ids.add(id);
    return [...ids];
  }, [groupMunicipioMembership, selectedMunicipioIds]);
  const paintMuniSet = useMemo(() => new Set(paintMuniIds), [paintMuniIds]);

  const isDrilled = mapView.level !== 'uf' && Boolean(mapView.ufIbge);
  const focusSigla = isDrilled ? (mapView.parentCode ?? null) : null;

  const animatedViewBox = useAnimatedViewBox(cameraTarget, {
    durationMs: 780,
    reduceMotion: preferReducedMotion,
  });

  const scale = useMemo(() => {
    const values = Object.values(choroplethValues)
      .map(normalizeMapMetricCell)
      .filter((cell) => cell.displayStatus === 'value')
      .map((cell) => cell.value);
    if (!activeVariableId) {
      return null;
    }
    return createChoroplethScale(values);
  }, [activeVariableId, choroplethValues]);

  const handleDrillUF = useCallback(
    (sigla: string) => {
      if (!onSetMapView) return;
      const ibge = ufIbgeForSigla(sigla);
      if (!ibge) return;
      onSetMapView({ level: 'municipio', parentCode: sigla, ufIbge: ibge });
    },
    [onSetMapView],
  );

  const handleHoverUF = useCallback(
    (sigla: string | null) => {
      if (hoverClearTimer.current) {
        clearTimeout(hoverClearTimer.current);
        hoverClearTimer.current = null;
      }
      if (sigla) {
        onHoverUF(sigla);
        return;
      }
      if (lupaPinnedRef.current) return;
      hoverClearTimer.current = setTimeout(() => {
        if (!lupaPinnedRef.current) onHoverUF(null);
      }, 160);
    },
    [onHoverUF],
  );

  const loadBrazilUfMunis = useCallback(async (sigla: string): Promise<ProjectedPath[]> => {
    const cached = muniCacheRef.current.get(sigla);
    if (cached) return cached;
    const ibge = ufIbgeForSigla(sigla);
    if (!ibge) return [];
    const topo = await loadMuniTopo(ibge);
    const paths = projectTopoToBrazilUfPaths(topo);
    muniCacheRef.current.set(sigla, paths);
    return paths;
  }, []);

  // Camera target: full Brasil or padded zoom on focused UF (viewBox space).
  useEffect(() => {
    if (!isDrilled || !focusSigla) {
      setCameraTarget(BRAZIL_UF_VIEWBOX);
      return;
    }
    const box = viewBoxBBoxForUf(focusSigla, paintPathRefs.current.get(focusSigla));
    setCameraTarget(box ? paddedViewBoxFromBBox(box, 0.38, 3.2) : BRAZIL_UF_VIEWBOX);
  }, [focusSigla, isDrilled]);

  useEffect(() => {
    if (isDrilled || !hoveredUF) {
      setHoverMuni(null);
      setLupaPos(null);
      return;
    }

    const pathEl = paintPathRefs.current.get(hoveredUF);
    const container = containerRef.current;
    if (!pathEl || !container) return;

    const bbox = pathEl.getBBox();
    const ctm = pathEl.getScreenCTM();
    const containerRect = container.getBoundingClientRect();
    if (ctm) {
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;
      const screen = new DOMPoint(cx, cy).matrixTransform(ctm);
      setLupaPos({
        x: screen.x - containerRect.left,
        y: screen.y - containerRect.top,
      });
    }

    let cancelled = false;
    loadBrazilUfMunis(hoveredUF)
      .then((paths) => {
        if (!cancelled) setHoverMuni({ sigla: hoveredUF, paths });
      })
      .catch(() => {
        if (!cancelled) setHoverMuni(null);
      });

    return () => {
      cancelled = true;
    };
  }, [hoveredUF, isDrilled, loadBrazilUfMunis]);

  // Paint selected + grouped municípios on Brazil when not in contextual drill.
  useEffect(() => {
    if (isDrilled || paintMuniSet.size === 0) {
      setSelectedMuniPaths((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const ufPrefixes = new Set(
      [...paintMuniSet].map((id) => id.slice(0, 2)).filter(Boolean),
    );
    const siglas = UF_LIST.filter((u) => ufPrefixes.has(u.ibgeCode)).map((u) => u.sigla);
    let cancelled = false;
    Promise.all(siglas.map((s) => loadBrazilUfMunis(s)))
      .then((groups) => {
        if (cancelled) return;
        setSelectedMuniPaths(groups.flat().filter((p) => paintMuniSet.has(p.id)));
      })
      .catch(() => {
        if (!cancelled) setSelectedMuniPaths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isDrilled, loadBrazilUfMunis, paintMuniSet]);

  // Drill features in the same CRS as Brazil UF paths (selectable when zoomed).
  useEffect(() => {
    if (!isDrilled || !mapView.ufIbge) {
      setDrillPaths([]);
      setDrillError(null);
      setDrillLoading(false);
      return;
    }

    const token = ++loadTokenRef.current;
    setDrillLoading(true);
    setDrillError(null);

    loadDrillPathsBrazilCrs(mapView.level as Exclude<GeoLevel, 'uf'>, mapView.ufIbge)
      .then((paths) => {
        if (token !== loadTokenRef.current) return;
        setDrillPaths(paths);
        setDrillLoading(false);
      })
      .catch((error: unknown) => {
        if (token !== loadTokenRef.current) return;
        const message =
          error instanceof Error ? error.message : 'Falha ao carregar malha geográfica.';
        setDrillError(message);
        setDrillPaths([]);
        setDrillLoading(false);
      });
  }, [isDrilled, mapView.level, mapView.ufIbge]);

  const ungroupedSelected = useMemo(
    () => selectedUFs.filter((sigla) => !groupMembership[sigla]?.length),
    [groupMembership, selectedUFs],
  );

  const fadingSelection = useFadingSelection(ungroupedSelected, {
    durationMs: UF_DESELECT_FADE_MS,
    reduceMotion: preferReducedMotion,
  });
  const fadingUfSiglas = useMemo(() => [...fadingSelection.keys()], [fadingSelection]);

  const groupsByIndex = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const [sigla, memberships] of Object.entries(groupMembership)) {
      for (const membership of memberships) {
        const list = map.get(membership.groupIndex) ?? [];
        list.push(sigla);
        map.set(membership.groupIndex, list);
      }
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [groupMembership]);

  const pathBySigla = useMemo(
    () => Object.fromEntries(BRAZIL_UF_PATHS.map((p) => [p.sigla, p.d])),
    [],
  );

  const handleParallax = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (preferReducedMotion || isDrilled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      setParallax({ x: nx * PARALLAX_MAX, y: ny * PARALLAX_MAX });
    },
    [isDrilled, preferReducedMotion],
  );

  const muniOverlay =
    !isDrilled && hoverMuni && hoverMuni.sigla === hoveredUF ? hoverMuni : null;

  const emptyHint =
    mapView.level === 'health-macro'
      ? 'Ainda não há macrorregiões de saúde para este estado (amostra didática disponível na Bahia).'
      : 'Sem geometrias para este nível. Volte ao Brasil ou rode o fetch de malhas municipais.';

  return (
    <div ref={containerRef} className="relative">
      {drillError ? (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>Não foi possível carregar o mapa</AlertTitle>
          <AlertDescription>
            <p>{drillError}</p>
            {onSetMapView ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onSetMapView({ level: 'uf' })}
              >
                Voltar ao mapa do Brasil
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <svg
        role="group"
        aria-label={
          isDrilled && focusSigla
            ? `Zoom em ${getUfName(focusSigla)} — ${mapView.level}`
            : 'Mapa do Brasil por unidade federativa'
        }
        viewBox={animatedViewBox}
        className="h-auto w-full will-change-transform"
        onMouseMove={handleParallax}
        onMouseLeave={() => {
          setParallax({ x: 0, y: 0 });
          if (!isDrilled) handleHoverUF(null);
        }}
        style={{
          transform:
            preferReducedMotion || isDrilled
              ? undefined
              : `perspective(900px) rotateX(${-parallax.y * 0.35}deg) rotateY(${parallax.x * 0.35}deg) translate(${parallax.x * 0.4}px, ${parallax.y * 0.4}px)`,
          transition: preferReducedMotion || isDrilled ? undefined : 'transform 120ms ease-out',
        }}
      >
        <defs>
          {GROUP_PALETTE_FILTERS}
          <pattern id="lacir-map-missing-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#3f3f46" />
            <path d="M0 0V6" stroke="#71717a" strokeWidth="2" />
          </pattern>
          <pattern id="lacir-map-review-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#5c3d17" />
            <path d="M0 0V6" stroke="#fbbf24" strokeWidth="2" />
          </pattern>
          {BRAZIL_UF_PATHS.map(({ sigla, d }) => (
            <clipPath key={`clip-${sigla}`} id={`lacir-uf-clip-${sigla}`}>
              <path d={d} />
            </clipPath>
          ))}
        </defs>

        <g
          transform={`${BRAZIL_UF_GROUP_TRANSFORM}${
            isDrilled ? '' : ` translate(${parallax.x * 0.15} ${parallax.y * 0.15})`
          }`}
        >
          {BRAZIL_UF_PATHS.map(({ sigla, d }) => {
            const memberships = groupMembership[sigla] ?? [];
            const primaryMembership = memberships[0];
            const isUngroupedSelected = ungroupedSelected.includes(sigla);
            const isFadingOut = fadingSelection.has(sigla) && !isUngroupedSelected;
            const isFocus = focusSigla === sigla;
            const isNeighbor = isDrilled && !isFocus;
            const isHovered = !isDrilled && hoveredUF === sigla;
            const metric = activeVariableId ? mapMetricPaint(choroplethValues[sigla], scale) : null;
            let fill = SURFACE_FILL;
            if (isNeighbor) {
              fill = NEIGHBOR_FILL;
            } else if (isFocus && isDrilled) {
              fill = '#151518';
            } else if (metric) {
              fill = metric.fill;
            } else if (memberships.length > 1) {
              fill = MULTI_GROUP_FILL;
            } else if (primaryMembership) {
              fill = groupColor(primaryMembership.groupIndex).fill;
            } else if (isUngroupedSelected) {
              fill = selectionFill;
            } else if (isHovered) {
              fill = hoverFill;
            }
            const inComposite =
              !isDrilled && Boolean(memberships.length > 0 || isUngroupedSelected);
            return (
              <path
                key={`paint-${sigla}`}
                ref={(node) => {
                  if (node) paintPathRefs.current.set(sigla, node);
                  else paintPathRefs.current.delete(sigla);
                }}
                data-uf={sigla}
                data-layer="paint"
                d={d}
                fill={fill}
                opacity={isNeighbor ? 0.42 : 1}
                stroke={
                  isFocus && isDrilled
                    ? pendingColor.stroke
                    : inComposite
                      ? 'transparent'
                      : isHovered
                        ? pendingColor.stroke
                        : isNeighbor
                          ? 'rgba(255,255,255,0.08)'
                          : metric?.stroke
                }
                className={
                  isFocus && isDrilled
                    ? 'pointer-events-none [stroke-width:1.8px] transition-[fill,opacity,stroke] duration-300'
                    : inComposite
                      ? '[stroke-width:0px] pointer-events-none transition-[fill,opacity] duration-300'
                      : isFadingOut
                        ? 'pointer-events-none stroke-border-strong [stroke-width:1px] transition-[fill,stroke,opacity] ease-out'
                        : isHovered
                          ? 'pointer-events-none [stroke-width:1.5px] transition-[fill,stroke,opacity] duration-150'
                          : 'pointer-events-none stroke-border-strong [stroke-width:1px] transition-[fill,stroke,opacity] duration-300'
                }
                style={{
                  vectorEffect: 'non-scaling-stroke',
                  transitionDuration: isFadingOut ? `${UF_DESELECT_FADE_MS}ms` : undefined,
                }}
                aria-hidden
              />
            );
          })}

          {/* Municípios do UF em hover — paint only; selected ones are interactive below */}
          {muniOverlay ? (
            <g
              className="pointer-events-none"
              aria-hidden
              clipPath={`url(#lacir-uf-clip-${muniOverlay.sigla})`}
            >
              {muniOverlay.paths
                .filter((path) => !paintMuniSet.has(path.id))
                .map((path) => (
                  <path
                    key={`muni-${path.id}`}
                    d={path.d}
                    fill={muniHoverFill}
                    stroke={MUNI_HOVER_STROKE}
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            </g>
          ) : null}

          {!isDrilled
            ? groupsByIndex.map(([groupIndex, siglas]) => (
                <g
                  key={`group-outline-${groupIndex}`}
                  filter={`url(#lacir-group-outer-${groupIndex % 10})`}
                  className="pointer-events-none"
                  aria-hidden
                >
                  {siglas.map((sigla) => {
                    const d = pathBySigla[sigla];
                    if (!d) return null;
                    const memberships = groupMembership[sigla] ?? [];
                    const membership = memberships.find(
                      (candidate) => candidate.groupIndex === groupIndex,
                    );
                    if (!membership) return null;
                    const overlapRank = memberships.findIndex(
                      (candidate) => candidate.groupIndex === groupIndex,
                    );
                    return (
                      <path
                        key={`go-${groupIndex}-${sigla}`}
                        data-group-outline={groupIndex}
                        data-overlap-rank={overlapRank}
                        data-uf={sigla}
                        d={d}
                        fill="transparent"
                        stroke={groupColor(membership.groupIndex).stroke}
                        strokeWidth={memberships.length > 1 ? 2.2 + overlapRank * 1.35 : 1.65}
                        strokeDasharray={
                          memberships.length > 1
                            ? overlapRank % 2 === 0
                              ? '5 2.5'
                              : '2 3'
                            : undefined
                        }
                        vectorEffect="non-scaling-stroke"
                        opacity={memberships.length > 1 ? 0.95 : 0.82}
                      />
                    );
                  })}
                </g>
              ))
            : null}

          {!isDrilled && (ungroupedSelected.length > 0 || fadingUfSiglas.length > 0) ? (
            <g
              filter={`url(#${selectionFilterId})`}
              className="pointer-events-none"
              aria-hidden
              data-selection-filter={selectionFilterId}
            >
              {ungroupedSelected.map((sigla) => {
                const d = pathBySigla[sigla];
                if (!d) return null;
                return (
                  <path
                    key={`so-${sigla}`}
                    d={d}
                    fill={selectionFill}
                    opacity={1}
                    className="[stroke-width:0px] stroke-transparent transition-opacity ease-out"
                    style={{ transitionDuration: `${UF_DESELECT_FADE_MS}ms` }}
                  />
                );
              })}
              {fadingUfSiglas.map((sigla) => {
                if (ungroupedSelected.includes(sigla)) return null;
                const d = pathBySigla[sigla];
                if (!d) return null;
                return (
                  <path
                    key={`so-fade-${sigla}`}
                    d={d}
                    fill={selectionFill}
                    opacity={fadingSelection.get(sigla) ?? 0}
                    className="[stroke-width:0px] stroke-transparent transition-opacity ease-out"
                    style={{ transitionDuration: `${UF_DESELECT_FADE_MS}ms` }}
                    data-fading-uf={sigla}
                  />
                );
              })}
            </g>
          ) : null}

          {/* Drill layer: municípios / mesos / macros — selecionáveis */}
          {isDrilled && focusSigla && drillPaths.length > 0 ? (
            <g clipPath={`url(#lacir-uf-clip-${focusSigla})`} data-layer="drill-features">
              {drillPaths.map((path) => {
                const name = String(path.properties.nome ?? path.id);
                const metric = activeVariableId
                  ? mapMetricPaint(choroplethValues[path.id], scale)
                  : null;
                const memberships = drillFeatureGroupMembership(
                  path.id,
                  mapView.level,
                  groupMunicipioMembership,
                );
                const primaryMembership = memberships[0];
                const isSelected =
                  memberships.length > 0 ||
                  (isDrillFeatureSelected?.(path.id) ??
                    (mapView.level === 'municipio' && selectedMuniSet.has(path.id)));
                const isHovered = hoveredUF === path.id;
                let fill = 'rgba(255,255,255,0.04)';
                if (metric) fill = metric.fill;
                else if (memberships.length > 1) fill = MULTI_GROUP_FILL;
                else if (primaryMembership) {
                  fill = groupMuniSelectionFill(primaryMembership.groupIndex);
                }
                else if (isSelected) fill = muniSelectedFill;
                else if (isHovered) fill = hoverFill;
                const pathKey = String(path.properties.muniId ?? path.id);

                return (
                  <MapGeoPath
                    key={`drill-${path.id}-${pathKey}`}
                    d={path.d}
                    territoryId={path.id}
                    name={name}
                    isHovered={isHovered}
                    isSelected={isSelected}
                    fill={fill}
                    accentStroke={
                      primaryMembership
                        ? groupColor(primaryMembership.groupIndex).stroke
                        : metric?.stroke ?? pendingColor.stroke
                    }
                    stroke={primaryMembership ? undefined : metric?.stroke}
                    hideStroke={false}
                    glowClass="stroke-white/25 [stroke-width:0.55px]"
                    onHover={onHoverUF}
                    onToggle={onToggleDrillFeature ?? onToggleUF}
                    groupBadge={membershipBadge(memberships)}
                    description={metric?.description}
                  />
                );
              })}
            </g>
          ) : null}

          {/* UF hit targets — only when not drilled (neighbors stay non-interactive) */}
          {!isDrilled
            ? BRAZIL_UF_PATHS.map(({ sigla, d }) => {
                const memberships = groupMembership[sigla] ?? [];
                const isUngroupedSelected = ungroupedSelected.includes(sigla);
                const isSelected = isUngroupedSelected || memberships.length > 0;
                const isPreview =
                  highlightedUFs.includes(sigla) &&
                  !isUngroupedSelected &&
                  memberships.length === 0;
                const shapeProps = {
                  d,
                  territoryId: sigla,
                  name: getUfName(sigla),
                  isHovered: hoveredUF === sigla,
                  isSelected,
                  isPreview,
                  hideStroke: true as const,
                  fill: 'transparent',
                  accentStroke: pendingColor.stroke,
                  groupBadge: membershipBadge(memberships),
                  description: activeVariableId
                    ? mapMetricPaint(choroplethValues[sigla], scale).description
                    : undefined,
                  onHover: handleHoverUF,
                  onToggle: onToggleUF,
                  onDrill: onSetMapView ? handleDrillUF : undefined,
                };

                if (enableShapeDrag && isUngroupedSelected) {
                  return (
                    <DraggableUfPath
                      key={`hit-${sigla}`}
                      {...shapeProps}
                      enableShapeDrag
                      dragSiglas={ungroupedSelected}
                    />
                  );
                }

                return <MapGeoPath key={`hit-${sigla}`} {...shapeProps} />;
              })
            : null}

          {/*
            Selected municípios on Brazil view — above UF hits so the user can
            deselect without zooming into the state.
          */}
          {!isDrilled && selectedMuniPaths.length > 0 && onToggleDrillFeature ? (
            <g data-layer="selected-munis-hit">
              {selectedMuniPaths.map((path) => {
                const name = String(path.properties.nome ?? path.id);
                const memberships = groupMunicipioMembership[path.id] ?? [];
                const primaryMembership = memberships[0];
                return (
                  <MapGeoPath
                    key={`sel-muni-hit-${path.id}`}
                    d={path.d}
                    territoryId={path.id}
                    name={name}
                    isHovered={false}
                    isSelected
                    fill={
                      memberships.length > 1
                        ? MULTI_GROUP_FILL
                        : primaryMembership
                          ? groupMuniSelectionFill(primaryMembership.groupIndex)
                        : muniSelectedFill
                    }
                    accentStroke={
                      primaryMembership
                        ? groupColor(primaryMembership.groupIndex).stroke
                        : pendingColor.stroke
                    }
                    hideStroke={false}
                    glowClass="stroke-white/40 [stroke-width:0.7px]"
                    onHover={() => {}}
                    onToggle={onToggleDrillFeature}
                    groupBadge={membershipBadge(memberships)}
                  />
                );
              })}
            </g>
          ) : !isDrilled && selectedMuniPaths.length > 0 ? (
            <g className="pointer-events-none" aria-hidden>
              {selectedMuniPaths.map((path) => {
                const memberships = groupMunicipioMembership[path.id] ?? [];
                const primaryMembership = memberships[0];
                return (
                  <path
                    key={`sel-muni-${path.id}`}
                    d={path.d}
                    fill={
                      memberships.length > 1
                        ? MULTI_GROUP_FILL
                        : primaryMembership
                          ? groupMuniSelectionFill(primaryMembership.groupIndex)
                        : muniSelectedFill
                    }
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={0.8}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          ) : null}
        </g>
      </svg>

      {isDrilled && drillLoading ? (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 top-3 text-center font-sans text-xs text-text-muted"
        >
          Carregando malha…
        </p>
      ) : null}

      {isDrilled && drillPaths.length === 0 && !drillLoading && !drillError ? (
        <p className="mt-2 font-sans text-xs text-text-muted">{emptyHint}</p>
      ) : null}

      {isDrilled && onSetMapView ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSetMapView({ level: 'uf' })}
          className="absolute left-3 top-3 z-20 h-8 rounded-full border border-white/10 bg-elevated/85 px-3 font-sans text-[11px] text-text-muted backdrop-blur-sm hover:text-text"
        >
          ← Zoom out
        </Button>
      ) : null}

      {!isDrilled && onSetMapView && lupaPos ? (
        <UfHoverDrillLupa
          ufSigla={hoveredUF}
          x={lupaPos.x}
          y={lupaPos.y}
          onDrill={handleDrillUF}
          onHoverChange={(active) => {
            lupaPinnedRef.current = active;
            if (!active) handleHoverUF(null);
          }}
        />
      ) : null}
    </div>
  );
}

const GROUP_PALETTE_FILTERS = Array.from({ length: 10 }, (_, index) => {
  const color = groupColor(index);
  return (
    <filter
      key={index}
      id={`lacir-group-outer-${index}`}
      x="-8%"
      y="-8%"
      width="116%"
      height="116%"
    >
      <feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="dilated" />
      <feFlood floodColor={color.stroke} result="color" />
      <feComposite in="color" in2="dilated" operator="in" result="outline" />
      <feComposite in="outline" in2="SourceAlpha" operator="out" result="ring" />
      <feMerge>
        <feMergeNode in="ring" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
});
