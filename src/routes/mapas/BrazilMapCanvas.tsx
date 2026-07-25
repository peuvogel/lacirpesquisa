import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { createChoroplethScale } from '@/geo/choroplethScale';
import {
  loadHealthMacroTopo,
  loadMesoTopo,
  loadMuniTopo,
} from '@/geo/loadGeoAsset';
import {
  filterFeaturesByUfPrefix,
  projectFeaturesToPaths,
  projectTopoToPaths,
  topoToFeatures,
  type ProjectedPath,
} from '@/geo/projectGeoToSvg';
import type { GeoLevel, MapViewState } from '@/geo/types';
import { BRAZIL_UF_GROUP_TRANSFORM, BRAZIL_UF_PATHS, BRAZIL_UF_VIEWBOX } from './brazilUfPaths';
import { getUfName, UF_LIST } from './ufCodes';
import { MapGeoPath } from './MapGeoPath';
import type { BrazilMockMapProps } from './BrazilMockMap';

export interface BrazilMapCanvasProps extends BrazilMockMapProps {
  choroplethValues: Record<string, number>;
  activeVariableId: string | null;
  mapView?: MapViewState;
  onSetMapView?: (view: MapViewState) => void;
}

const SURFACE_FILL = '#18181b';
const ACCENT_BORDER_FILL = 'rgba(23, 121, 94, 0.45)';
const DRILL_VIEWBOX = '0 0 800 600';

function ufIbgeForSigla(sigla: string): string | undefined {
  return UF_LIST.find((uf) => uf.sigla === sigla)?.ibgeCode;
}

async function loadDrillPaths(
  level: Exclude<GeoLevel, 'uf'>,
  ufIbge: string,
): Promise<ProjectedPath[]> {
  switch (level) {
    case 'municipio': {
      const topo = await loadMuniTopo(ufIbge);
      return projectTopoToPaths(topo);
    }
    case 'meso': {
      const topo = await loadMesoTopo();
      const features = filterFeaturesByUfPrefix(topoToFeatures(topo), ufIbge);
      return projectFeaturesToPaths(features);
    }
    case 'health-macro': {
      const topo = await loadHealthMacroTopo();
      return projectTopoToPaths(topo);
    }
    default:
      return [];
  }
}

/**
 * UF map canvas with choropleth fills and MAP-03 drill-down ladder.
 * Sub-UF geo loads lazily via dynamic import (D-19 / MAP-05).
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
}: BrazilMapCanvasProps) {
  const [drillPaths, setDrillPaths] = useState<ProjectedPath[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const loadTokenRef = useRef(0);

  const isDrilled = mapView.level !== 'uf' && Boolean(mapView.ufIbge);

  const scale = useMemo(() => {
    const values = Object.values(choroplethValues);
    if (!activeVariableId || values.length === 0) {
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

    loadDrillPaths(mapView.level as Exclude<GeoLevel, 'uf'>, mapView.ufIbge)
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

  if (isDrilled) {
    const ufSigla = mapView.parentCode ?? '';

    return (
      <div className="relative">
        {drillLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex aspect-[4/3] items-center justify-center rounded-lg border border-border bg-surface"
          >
            <p className="font-sans text-sm text-text-muted">Carregando mapa…</p>
          </div>
        ) : null}

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

        {!drillLoading && !drillError ? (
          <svg
            role="group"
            aria-label={`Mapa de ${getUfName(ufSigla)} por ${mapView.level}`}
            viewBox={DRILL_VIEWBOX}
            className="h-auto w-full"
          >
            {drillPaths.map((path) => {
              const name = String(path.properties.nome ?? path.id);
              const metric = choroplethValues[path.id];
              const fill =
                scale && metric !== undefined ? scale(metric) : SURFACE_FILL;

              return (
                <MapGeoPath
                  key={path.id}
                  d={path.d}
                  territoryId={path.id}
                  name={name}
                  isHovered={hoveredUF === path.id}
                  isSelected={selectedUFs.includes(path.id)}
                  fill={fill}
                  onHover={onHoverUF}
                  onToggle={onToggleUF}
                />
              );
            })}
          </svg>
        ) : null}

        {drillPaths.length === 0 && !drillLoading && !drillError ? (
          <p className="mt-2 font-sans text-xs text-text-muted">
            Sem geometrias para este nível no conjunto de amostra. Escolha Município para Bahia ou
            volte ao mapa do Brasil.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <svg
      role="group"
      aria-label="Mapa do Brasil por unidade federativa"
      viewBox={BRAZIL_UF_VIEWBOX}
      className="h-auto w-full"
    >
      <g transform={BRAZIL_UF_GROUP_TRANSFORM}>
        {BRAZIL_UF_PATHS.map(({ sigla, d }) => {
          const membership = groupMembership[sigla];
          const isUngroupedSelected = selectedUFs.includes(sigla);
          const isHighlighted = highlightedUFs.includes(sigla);
          const isSelected = isUngroupedSelected || isHighlighted || Boolean(membership);
          const isHovered = hoveredUF === sigla;
          const metric = choroplethValues[sigla];
          const fill =
            scale && metric !== undefined
              ? scale(metric)
              : isSelected
                ? ACCENT_BORDER_FILL
                : SURFACE_FILL;

          const glowClass =
            isUngroupedSelected && !membership
              ? 'lacir-map-glow lacir-map-glow--eligible'
              : membership || isHighlighted
                ? 'lacir-map-glow'
                : undefined;

          return (
            <MapGeoPath
              key={sigla}
              d={d}
              territoryId={sigla}
              name={getUfName(sigla)}
              isHovered={isHovered}
              isSelected={isSelected}
              fill={fill}
              glowClass={glowClass}
              groupBadge={
                membership ? `Grupo ${membership.groupIndex + 1}: ${membership.groupName}` : undefined
              }
              onHover={onHoverUF}
              onToggle={onToggleUF}
              onDrill={onSetMapView ? handleDrillUF : undefined}
            />
          );
        })}
      </g>
    </svg>
  );
}
