import { useId, useRef, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Info } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ModeChoiceOption {
  id: string;
  title: string;
  description: string;
}

export interface ModeChoiceCardProps {
  options: ModeChoiceOption[];
  value: string;
  onChange: (id: string) => void;
  groupLabel: string;
  className?: string;
}

const PILL_SPRING = { type: 'spring' as const, bounce: 0, duration: 0.34 };

/**
 * Segmented control (pílula deslizante) para escolher entre modos mutuamente
 * exclusivos de um mesmo teste. Mantém a semântica de radiogroup exigida pelo
 * UI-SPEC; as descrições de cada modo vivem no popover de info.
 */
export function ModeChoiceCard({
  options,
  value,
  onChange,
  groupLabel,
  className,
}: ModeChoiceCardProps) {
  const pillId = `mode-choice-pill-${useId()}`;
  const reduceMotion = useReducedMotion();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Roving tabindex: o modo ativo é o único ponto de entrada por Tab. Se `value`
  // não casar com nenhuma opção, o primeiro botão assume o foco para o grupo não
  // ficar inalcançável pelo teclado.
  const selectedIndex = options.findIndex((option) => option.id === value);
  const focusableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const selectAt = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.id);
    buttonRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        selectAt(index === last ? 0 : index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        selectAt(index === 0 ? last : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        selectAt(0);
        break;
      case 'End':
        event.preventDefault();
        selectAt(last);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-foreground">{groupLabel}</h3>
        <ModeInfoPopover options={options} value={value} groupLabel={groupLabel} />
      </div>

      <div
        role="radiogroup"
        aria-label={groupLabel}
        className="flex flex-col gap-0.5 rounded-lg border border-border bg-[var(--color-surface)] p-1 sm:flex-row"
      >
        {options.map((option, index) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={index === focusableIndex ? 0 : -1}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'relative flex min-h-[44px] flex-1 items-center justify-center rounded-md px-4 py-2.5 text-center text-sm font-bold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
                selected
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
              )}
            >
              {selected ? (
                <motion.span
                  layoutId={pillId}
                  aria-hidden
                  className="absolute inset-0 rounded-md border border-white/[0.10] bg-white/[0.08]"
                  transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
                />
              ) : null}
              <span className="relative">{option.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModeInfoPopover({
  options,
  value,
  groupLabel,
}: {
  options: ModeChoiceOption[];
  value: string;
  groupLabel: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Sobre as opções de ${groupLabel.toLowerCase()}`}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-transparent text-white transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 bg-[var(--color-elevated)]">
        <dl className="space-y-3">
          {options.map((option) => {
            const selected = value === option.id;
            return (
              <div
                key={option.id}
                className={cn(
                  '-mx-2 rounded-md px-2 py-1.5',
                  selected && 'bg-white/[0.06]',
                )}
              >
                <dt className="text-sm font-bold text-foreground">{option.title}</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">{option.description}</dd>
              </div>
            );
          })}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
