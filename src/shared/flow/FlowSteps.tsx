import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FlowStep = 'dados' | 'configurar' | 'resultados';

export const FLOW_STEPS: readonly FlowStep[] = ['dados', 'configurar', 'resultados'];

export const FLOW_STEP_LABELS: Record<FlowStep, string> = {
  dados: 'Dados',
  configurar: 'Configurar',
  resultados: 'Resultados',
};

export interface FlowStepsProps {
  active: FlowStep;
  onStepChange: (step: FlowStep) => void;
  canAdvance: Record<FlowStep, boolean>;
  dados: ReactNode;
  configurar: ReactNode;
  resultados: ReactNode;
}

/**
 * Shared Dados → Configurar → Resultados stepper (UI-02). Only the active
 * step's slot is mounted — the other two are not rendered at all, so a test
 * module's Resultados-step chart effect can't run while the user is still on
 * Dados (01-RESEARCH.md Pattern 2).
 */
export function FlowSteps({ active, onStepChange, canAdvance, dados, configurar, resultados }: FlowStepsProps) {
  const activeIndex = FLOW_STEPS.indexOf(active);
  const content = { dados, configurar, resultados }[active];

  // The user must always be able to return to their data, even if a caller
  // passes canAdvance.dados: false — a deliberate override of the prop, not
  // a bug: losing the ability to get back to Dados would strand the user.
  const effectiveCanAdvance: Record<FlowStep, boolean> = { ...canAdvance, dados: true };

  return (
    <div className="space-y-6">
      <nav aria-label="Etapas" className="flex items-center gap-2">
        {FLOW_STEPS.map((step, index) => {
          const isActive = step === active;
          const isCompleted = index < activeIndex;
          const isDisabled = !isActive && !effectiveCanAdvance[step];

          return (
            <button
              key={step}
              type="button"
              aria-current={isActive ? 'step' : undefined}
              aria-disabled={isDisabled ? 'true' : undefined}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                onStepChange(step);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-bold transition-colors',
                isActive && 'bg-primary/10 text-primary',
                !isActive && isCompleted && 'text-primary/70',
                !isActive && !isCompleted && !isDisabled && 'text-muted-foreground hover:text-foreground',
                isDisabled && 'cursor-not-allowed text-muted-foreground opacity-60',
              )}
            >
              {isCompleted && !isActive ? <Check aria-hidden="true" className="size-3.5" /> : null}
              {FLOW_STEP_LABELS[step]}
            </button>
          );
        })}
      </nav>
      <section>{content}</section>
    </div>
  );
}
