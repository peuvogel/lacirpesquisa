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

export function ModeChoiceCard({
  options,
  value,
  onChange,
  groupLabel,
  className,
}: ModeChoiceCardProps) {
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="text-lg font-bold text-foreground">{groupLabel}</legend>
      <div role="radiogroup" aria-label={groupLabel} className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                'min-h-[44px] rounded-lg border px-4 py-3 text-left transition-colors',
                selected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                  : 'border-border bg-[#171f1c] hover:bg-[#1a2420]',
              )}
            >
              <span className="block text-sm font-bold text-foreground">{option.title}</span>
              <span className="mt-1 block text-base text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
