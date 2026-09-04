import { useEffect, useRef, type ReactNode } from 'react';
import { useInView } from 'motion/react';

import { revealSticker } from '@/shared/sticker/stickerStore';

export type FlowStep = 'dados' | 'configurar' | 'resultados';

export const FLOW_STEPS: readonly FlowStep[] = ['dados', 'configurar', 'resultados'];

export interface FlowStepsProps {
  active: FlowStep;
  canAdvance: Record<FlowStep, boolean>;
  dados: ReactNode;
  configurar: ReactNode;
  resultados: ReactNode;
  resultadosAriaLabel?: string | null;
}

/**
 * Shared Dados → Configurar → Resultados flow.
 * Fuses input (dados until loaded, then configurar) with results anchored
 * below after "Analisar dados".
 */
export function FlowSteps({
  active,
  canAdvance,
  dados,
  configurar,
  resultados,
  resultadosAriaLabel = 'Resultados',
}: FlowStepsProps) {
  const resultsRef = useRef<HTMLElement | null>(null);
  const resultsInView = useInView(resultsRef, { amount: 0.15 });

  useEffect(() => {
    if (active !== 'resultados') return;
    const node = resultsRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [active]);

  // O adesivo é renderizado pelo AppShell; aqui só sinalizamos que os
  // resultados entraram em cena. Uma vez revelado, ele fica.
  useEffect(() => {
    if (resultsInView) revealSticker();
  }, [resultsInView]);

  const showConfig = canAdvance.configurar;
  const showResults = canAdvance.resultados || active === 'resultados';

  return (
    <div className="space-y-10">
      <section aria-label="Dados e configuração" className="space-y-4">
        {showConfig ? <>{dados}{configurar}</> : dados}
      </section>
      {showResults ? (
        <section
          ref={resultsRef}
          aria-label={resultadosAriaLabel ?? undefined}
          id="lacir-flow-results"
          className="scroll-mt-6 space-y-4 border-t border-border pt-8"
        >
          {resultados}
        </section>
      ) : null}
    </div>
  );
}
