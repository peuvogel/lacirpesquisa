import type { CSSProperties } from 'react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

export interface MapGeoPathProps {
  d: string;
  territoryId: string;
  name: string;
  isHovered: boolean;
  isSelected: boolean;
  isPreview?: boolean;
  isDragging?: boolean;
  /** Hide per-UF stroke (outer contour comes from parent SVG filter). */
  hideStroke?: boolean;
  fill: string;
  /** Stroke / focus accent for the pending group palette. */
  accentStroke?: string;
  /** Persistent status outline; focus continues to use `accentStroke`. */
  stroke?: string;
  glowClass?: string;
  groupBadge?: string;
  /** Accessible explanation of the metric state under the pointer/focus. */
  description?: string;
  onHover: (territoryId: string | null) => void;
  onToggle: (territoryId: string) => void;
  onDrill?: (territoryId: string) => void;
  pathRef?: (node: SVGPathElement | null) => void;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
}

export function MapGeoPath({
  d,
  territoryId,
  name,
  isHovered,
  isSelected,
  isPreview = false,
  isDragging = false,
  hideStroke = false,
  fill,
  accentStroke = '#209978',
  stroke,
  glowClass,
  groupBadge,
  description,
  onHover,
  onToggle,
  onDrill,
  pathRef,
  dragListeners,
  dragAttributes,
}: MapGeoPathProps) {
  const canShapeDrag = Boolean(dragListeners);

  return (
    <path
      ref={pathRef}
      data-territory-id={territoryId}
      data-uf={territoryId.length === 2 ? territoryId : undefined}
      d={d}
      {...(dragListeners ?? {})}
      {...(dragAttributes ?? {})}
      role="button"
      tabIndex={0}
      aria-label={name}
      aria-description={description}
      aria-pressed={isSelected}
      aria-grabbed={canShapeDrag ? isDragging : undefined}
      onMouseEnter={() => onHover(territoryId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(territoryId)}
      onBlur={() => onHover(null)}
      onClick={() => onToggle(territoryId)}
      onDoubleClick={() => onDrill?.(territoryId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onToggle(territoryId);
        } else if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          onToggle(territoryId);
        }
      }}
      style={
        {
          vectorEffect: 'non-scaling-stroke',
          fill,
          stroke,
          ['--lacir-path-accent']: accentStroke,
        } as CSSProperties
      }
      className={cn(
        'outline-none transition-[stroke,filter,opacity,fill] duration-150 ease-out',
        hideStroke ? '[stroke-width:0px] stroke-transparent' : '[stroke-width:1px] stroke-border-strong',
        canShapeDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isHovered && !isSelected && 'opacity-90',
        isDragging && 'opacity-35',
        isPreview && !isSelected && 'lacir-map-glow--preview',
        glowClass,
        'focus-visible:[stroke-width:2px] focus-visible:stroke-[var(--lacir-path-accent)]',
      )}
    >
      {groupBadge || description ? (
        <title>{[groupBadge, description].filter(Boolean).join(' — ')}</title>
      ) : null}
    </path>
  );
}
