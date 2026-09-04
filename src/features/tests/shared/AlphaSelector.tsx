import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Lock, Unlock } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import WheelPicker, { type WheelOption } from '@/components/ui/wheelPicker/WheelPicker';
import { cn } from '@/lib/utils';
import {
  alphaToPercent,
  formatAlphaPercent,
  parseAlpha,
  percentToAlpha,
  type AlphaValue,
} from './alpha';

export type { AlphaValue } from './alpha';

export interface AlphaSelectorProps {
  value: AlphaValue;
  onChange: (value: AlphaValue) => void;
  className?: string;
}

/**
 * Generates options from 0.1 to 10.0 in 0.1 steps.
 * Format label: '0,1', '0,2', ..., '0,5', ..., '10,0'
 */
export function generateSignificanceOptions(): WheelOption[] {
  const options: WheelOption[] = [];
  for (let i = 1; i <= 100; i++) {
    const valNum = i / 10;
    const valStr = valNum.toFixed(1);
    const labelStr = valStr.replace('.', ',');
    options.push({
      value: valStr,
      label: labelStr,
      className: valStr === '5.0' ? 'text-teal-400 font-extrabold' : 'text-white font-bold',
    });
  }
  return options;
}

export function AlphaSelector({ value, onChange, className }: AlphaSelectorProps) {
  const options = useMemo(() => generateSignificanceOptions(), []);
  const alpha = parseAlpha(value);
  const [isLocked, setIsLocked] = useState(true);
  const [isShaking, setIsShaking] = useState(false);
  const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerLockWarning = useCallback(() => {
    if (!isLocked) return;
    setIsShaking(true);
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = setTimeout(() => {
      setIsShaking(false);
    }, 400);
  }, [isLocked]);

  const currentWheelValue = alphaToPercent(alpha).toFixed(1);

  const handleWheelChange = (newValStr: string) => {
    if (isLocked) {
      triggerLockWarning();
      return;
    }
    onChange(percentToAlpha(Number(newValStr)));
  };

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-bold text-foreground">
          Nível de significância (α)
        </Label>
        <LockToggle
          locked={isLocked}
          shaking={isShaking}
          onToggle={() => {
            setIsLocked((prev) => !prev);
            setIsShaking(false);
          }}
        />
      </div>

      <div
        onClick={isLocked ? triggerLockWarning : undefined}
        className={cn(
          'flex flex-col items-center gap-1 py-1 w-full rounded-xl transition-all',
          isLocked && 'cursor-not-allowed'
        )}
      >
        {/* Roda 3D iOS (desabilitada enquanto bloqueada) */}
        <div className="flex items-center justify-center my-1">
          <WheelPicker
            ariaLabel="Nível de significância (α)"
            options={options}
            value={currentWheelValue}
            onChange={handleWheelChange}
            disabled={isLocked}
            width={120}
          />
        </div>

        {/* O readout acompanha a roda na mesma cadência: travado ele recua
            para o cinza do texto secundário, destravado volta ao texto pleno.
            É a mesma mudança de cor, só que gradual. */}
        <p
          className={cn(
            'text-xs text-center font-mono transition-colors duration-300',
            isLocked ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {formatAlphaPercent(alpha)} <span className="opacity-40">·</span> (α = {alpha})
        </p>
      </div>
    </div>
  );
}

/**
 * Cadeado sem pill nem rótulo: só o ícone, trocando com uma animação curta de
 * travar/destravar. O arco sobe e gira ao abrir, desce ao fechar.
 */
function LockToggle({
  locked,
  shaking,
  onToggle,
}: {
  locked: boolean;
  shaking: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const Icon = locked ? Lock : Unlock;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'duration-300',
        shaking
          ? 'animate-shake-lock text-destructive'
          : locked
            ? 'text-muted-foreground hover:text-white'
            : 'text-white hover:text-white/70',
      )}
      title={locked ? 'Clique para desbloquear o nível de significância' : 'Clique para bloquear'}
      aria-label={locked ? 'Desbloquear nível de significância' : 'Bloquear nível de significância'}
      aria-pressed={locked}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={locked ? 'locked' : 'unlocked'}
          initial={reduceMotion ? false : { opacity: 0, y: locked ? -5 : 5, rotate: locked ? -18 : 18 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: locked ? 5 : -5, rotate: locked ? 18 : -18 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
          className="inline-flex"
        >
          <Icon className="size-4" aria-hidden />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
