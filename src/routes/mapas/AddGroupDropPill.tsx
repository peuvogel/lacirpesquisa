import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface AddGroupDropPillProps {
  visible: boolean;
  active: boolean;
  x: number;
  y: number;
  /** How many territories will join the new group (didactic subtitle). */
  selectionCount?: number;
  /** Pending group accent (hex stroke). */
  accentStroke?: string;
  className?: string;
}

/**
 * Floating drop target during right-drag — visual cue to “solte para criar o grupo”.
 */
export function AddGroupDropPill({
  visible,
  active,
  x,
  y,
  selectionCount = 0,
  accentStroke = '#209978',
  className,
}: AddGroupDropPillProps) {
  const reduceMotion = useReducedMotion();
  if (!visible) return null;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.88, y: 8 }}
      animate={{
        opacity: 1,
        scale: active ? 1.08 : 1,
        x: x - 104,
        y: y - 36,
      }}
      transition={{ type: 'spring', bounce: active ? 0.28 : 0.05, duration: 0.38 }}
      style={
        {
          ['--lacir-group-accent']: accentStroke,
          borderColor: active ? accentStroke : `${accentStroke}99`,
          color: active ? '#04120c' : accentStroke,
          backgroundColor: active ? accentStroke : 'rgba(24,24,27,0.95)',
          boxShadow: active
            ? `0 0 40px ${accentStroke}b3`
            : `0 0 28px ${accentStroke}66`,
        } as CSSProperties
      }
      className={cn(
        'pointer-events-none fixed z-50 flex w-[13rem] flex-col items-center justify-center gap-0.5 rounded-2xl border px-4 py-3 text-center backdrop-blur-md',
        active && 'lacir-add-group-pill--active',
        className,
      )}
    >
      <span className="font-sans text-sm font-bold tracking-tight">
        {active ? 'Solte para criar' : 'Adicionar grupo'}
      </span>
      <span
        className={cn(
          'font-sans text-[11px] font-medium',
          active ? 'text-[#04120c]/80' : 'text-text-muted',
        )}
      >
        {selectionCount > 0
          ? `${selectionCount} território${selectionCount === 1 ? '' : 's'} selecionado${selectionCount === 1 ? '' : 's'}`
          : 'Arraste até aqui'}
      </span>
    </motion.div>
  );
}
