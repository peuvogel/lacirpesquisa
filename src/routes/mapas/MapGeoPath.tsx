import { cn } from '@/lib/utils';

export interface MapGeoPathProps {
  d: string;
  territoryId: string;
  name: string;
  isHovered: boolean;
  isSelected: boolean;
  fill: string;
  glowClass?: string;
  groupBadge?: string;
  onHover: (territoryId: string | null) => void;
  onToggle: (territoryId: string) => void;
  onDrill?: (territoryId: string) => void;
}

/**
 * Shared SVG path primitive for UF and drill-down maps (UI-SPEC MapGeoPath states).
 * Preserves BrazilMockMap a11y contract: role=button, aria-pressed, keyboard toggle.
 */
export function MapGeoPath({
  d,
  territoryId,
  name,
  isHovered,
  isSelected,
  fill,
  glowClass,
  groupBadge,
  onHover,
  onToggle,
  onDrill,
}: MapGeoPathProps) {
  return (
    <path
      data-territory-id={territoryId}
      data-uf={territoryId.length === 2 ? territoryId : undefined}
      d={d}
      role="button"
      tabIndex={0}
      aria-label={name}
      aria-pressed={isSelected}
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
      style={{ vectorEffect: 'non-scaling-stroke', fill }}
      className={cn(
        'cursor-pointer stroke-border-strong outline-none transition-colors',
        '[stroke-width:1px]',
        isHovered && !isSelected && 'opacity-90',
        isSelected && 'stroke-accent [stroke-width:2px] lacir-map-glow',
        glowClass,
        'focus-visible:stroke-accent focus-visible:[stroke-width:2px]',
      )}
    >
      {groupBadge ? <title>{groupBadge}</title> : null}
    </path>
  );
}
