import { useEffect, useRef, type ReactNode } from 'react';
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
  /**
   * `scroll` (default): single-page flow — paste/config on top, results below.
   * `stepper`: legacy exclusive mount of one step at a time.
   */
  layout?: 'scroll' | 'stepper';
}

/**
 * Shared Dados → Configurar → Resultados flow.
 * Scroll layout fuses input (dados until loaded, then configurar) with results
 * anchored below after "Analisar dados".
 */
export function FlowSteps({
  active,
  onStepChange,
  canAdvance,
  dados,
  configurar,
  resultados,
  layout = 'scroll',
}: FlowStepsProps) {
  const activeIndex = FLOW_STEPS.indexOf(active);
  const effectiveCanAdvance: Record<FlowStep, boolean> = { ...canAdvance, dados: true };
  const resultsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (layout !== 'scroll') return;
    if (active !== 'resultados') return;
    const node = resultsRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [active, layout]);

  if (layout === 'stepper') {
    const content = { dados, configurar, resultados }[active];
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

  // Scroll: show paste until data is ready, then morph into configurar table/options.
  const showConfig = effectiveCanAdvance.configurar;
  const showResults = effectiveCanAdvance.resultados || active === 'resultados';

  return (
    <div className="space-y-10">
      <section aria-label="Dados e configuração" className="space-y-4">
        {showConfig ? configurar : dados}
      </section>
      {showResults ? (
        <section
          ref={resultsRef}
          aria-label="Resultados"
          id="lacir-flow-results"
          className="scroll-mt-6 space-y-4 border-t border-border pt-8"
        >
          {resultados}
        </section>
      ) : null}
    </div>
  );
}
