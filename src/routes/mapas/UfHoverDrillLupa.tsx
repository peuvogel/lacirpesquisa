import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUfName } from './ufCodes';

export interface UfHoverDrillLupaProps {
  ufSigla: string | null;
  /** Position relative to the map container (CSS px). */
  x: number;
  y: number;
  onDrill: (sigla: string) => void;
  onHoverChange: (active: boolean) => void;
  className?: string;
}

/**
 * Discrete animated magnifier on UF hover — click zooms into municípios
 * (neighbors stay visible, not selectable).
 */
export function UfHoverDrillLupa({
  ufSigla,
  x,
  y,
  onDrill,
  onHoverChange,
  className,
}: UfHoverDrillLupaProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {ufSigla ? (
        <motion.button
          key={ufSigla}
          type="button"
          aria-label={`Zoom nos municípios de ${getUfName(ufSigla)}`}
          title={`Zoom — municípios de ${getUfName(ufSigla)}`}
          className={cn(
            'pointer-events-auto absolute z-20 flex size-9 items-center justify-center rounded-full',
            'border border-white/15 bg-elevated/95 text-accent shadow-lg backdrop-blur-sm',
            'hover:border-accent/50 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            className,
          )}
          style={{ left: x, top: y, translate: '-50% -120%' }}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9, y: 4 }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.28 }}
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
          onClick={(event) => {
            event.stopPropagation();
            onDrill(ufSigla);
          }}
        >
          <Search className="size-4" strokeWidth={2.25} aria-hidden />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
