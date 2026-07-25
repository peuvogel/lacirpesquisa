import { useMemo } from 'react';
import { createChoroplethScale } from '@/geo/choroplethScale';
import { BRAZIL_UF_GROUP_TRANSFORM, BRAZIL_UF_PATHS, BRAZIL_UF_VIEWBOX } from './brazilUfPaths';
import { getUfName } from './ufCodes';
import { MapGeoPath } from './MapGeoPath';
import type { BrazilMockMapProps } from './BrazilMockMap';

export interface BrazilMapCanvasProps extends BrazilMockMapProps {
  choroplethValues: Record<string, number>;
  activeVariableId: string | null;
}

const SURFACE_FILL = '#18181b';
const ACCENT_BORDER_FILL = 'rgba(23, 121, 94, 0.45)';

/**
 * UF map canvas with choropleth fills from mock metrics (MAP-01).
 * Extracted from BrazilMockMap — preserves inline SVG hit-testing (D-20–D-23).
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
}: BrazilMapCanvasProps) {
  const scale = useMemo(() => {
    const values = Object.values(choroplethValues);
    if (!activeVariableId || values.length === 0) {
      return null;
    }
    return createChoroplethScale(values);
  }, [activeVariableId, choroplethValues]);

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
              sigla={sigla}
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
            />
          );
        })}
      </g>
    </svg>
  );
}
