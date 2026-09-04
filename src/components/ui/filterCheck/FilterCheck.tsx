import { cn } from '@/lib/utils';

export type FilterCheckState = boolean | 'mixed';

export interface FilterCheckProps {
  checked: FilterCheckState;
  className?: string;
  size?: number;
  /** Marca a caixa como pendente/obrigatória: contorno e preenchimento em vermelho. */
  invalid?: boolean;
}

/**
 * Caixa de seleção desenhada em SVG: o tique é traçado com stroke-dasharray
 * em vez de aparecer por opacidade, o que dá a sensação de estar sendo escrito.
 * Puramente visual — quem controla o estado é o <input> que a acompanha.
 */
export function FilterCheck({ checked, className, size, invalid }: FilterCheckProps) {
  return (
    <span
      aria-hidden="true"
      data-checked={checked === 'mixed' ? 'mixed' : checked ? 'true' : 'false'}
      data-invalid={invalid ? 'true' : undefined}
      className={cn('filter-check', className)}
      style={size ? ({ '--fc-size': `${size}px` } as React.CSSProperties) : undefined}
    >
      <svg className="fc-box" viewBox="0 0 16 16">
        <rect className="fc-shape" x="0.75" y="0.75" width="14.5" height="14.5" rx="4.25" />
        <path
          className="fc-tick"
          d={checked === 'mixed' ? 'M4.25 8H11.75' : 'M4.15 8.2L6.85 10.8L11.95 5.25'}
          fill="none"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default FilterCheck;
