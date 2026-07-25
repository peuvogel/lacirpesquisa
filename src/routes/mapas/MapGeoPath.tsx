import { cn } from '@/lib/utils';

export interface MapGeoPathProps {
  d: string;
  sigla: string;
  name: string;
  isHovered: boolean;
  isSelected: boolean;
  fill: string;
  glowClass?: string;
  groupBadge?: string;
  onHover: (sigla: string | null) => void;
  onToggle: (sigla: string) => void;
}

/**
 * Shared SVG path primitive for UF and drill-down maps (UI-SPEC MapGeoPath states).
 * Preserves BrazilMockMap a11y contract: role=button, aria-pressed, keyboard toggle.
 */
export function MapGeoPath({
  d,
  sigla,
  name,
  isHovered,
  isSelected,
  fill,
  glowClass,
  groupBadge,
  onHover,
  onToggle,
}: MapGeoPathProps) {
  return (
    <path
      key={sigla}
      data-uf={sigla}
      d={d}
      role="button"
      tabIndex={0}
      aria-label={name}
      aria-pressed={isSelected}
      onMouseEnter={() => onHover(sigla)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(sigla)}
      onBlur={() => onHover(null)}
      onClick={() => onToggle(sigla)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onToggle(sigla);
        } else if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          onToggle(sigla);
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
