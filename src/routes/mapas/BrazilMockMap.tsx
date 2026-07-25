import { BRAZIL_UF_GROUP_TRANSFORM, BRAZIL_UF_PATHS, BRAZIL_UF_VIEWBOX } from './brazilUfPaths';
import { getUfName } from './ufCodes';
import { cn } from '@/lib/utils';

export interface BrazilMockMapProps {
  hoveredUF: string | null;
  selectedUFs: string[];
  onHoverUF: (uf: string | null) => void;
  onToggleUF: (uf: string) => void;
}

/**
 * Inline SVG Brazil-by-UF map (D-20–D-23). Browser SVG hit-testing drives
 * hover/click — no point-in-polygon math (01-RESEARCH.md § Don't Hand-Roll).
 * Geometry is committed as data (`brazilUfPaths.ts`) and rendered as real
 * `<path>` elements, never via `dangerouslySetInnerHTML` (T-01-SVG).
 */
export function BrazilMockMap({ hoveredUF, selectedUFs, onHoverUF, onToggleUF }: BrazilMockMapProps) {
  return (
    <svg
      role="group"
      aria-label="Mapa do Brasil por unidade federativa"
      viewBox={BRAZIL_UF_VIEWBOX}
      className="h-auto w-full"
    >
      <g transform={BRAZIL_UF_GROUP_TRANSFORM}>
        {BRAZIL_UF_PATHS.map(({ sigla, d }) => {
          const isSelected = selectedUFs.includes(sigla);
          const isHovered = hoveredUF === sigla;

          return (
            <path
              key={sigla}
              data-uf={sigla}
              d={d}
              role="button"
              tabIndex={0}
              aria-label={getUfName(sigla)}
              aria-pressed={isSelected}
              onMouseEnter={() => onHoverUF(sigla)}
              onMouseLeave={() => onHoverUF(null)}
              onFocus={() => onHoverUF(sigla)}
              onBlur={() => onHoverUF(null)}
              onClick={() => onToggleUF(sigla)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onToggleUF(sigla);
                } else if (event.key === ' ' || event.key === 'Spacebar') {
                  event.preventDefault();
                  onToggleUF(sigla);
                }
              }}
              // `vector-effect:non-scaling-stroke` keeps the stroke a constant on-screen
              // width regardless of the <g> scale transform and the SVG's own viewBox
              // scaling — the only way to hit UI-SPEC's fixed "2px at map scale" rule
              // when the underlying geometry is expressed in huge raw IBGE coordinates.
              style={{ vectorEffect: 'non-scaling-stroke' }}
              className={cn(
                'cursor-pointer fill-surface stroke-border-strong outline-none transition-colors',
                '[stroke-width:1px]',
                isHovered && !isSelected && 'fill-accent-soft',
                isSelected && 'fill-accent-border stroke-accent [stroke-width:2px]',
                'focus-visible:stroke-accent focus-visible:[stroke-width:2px]',
              )}
            />
          );
        })}
      </g>
    </svg>
  );
}
