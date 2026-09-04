import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { copyTextToClipboard, formatResultReport } from './resultReport';
import type { ResultMetric } from './ResultMetricCard';

const COPY_SUCCESS_TIMEOUT_MS = 2000;

export interface CopyResultsButtonProps {
  title: string;
  metrics: readonly ResultMetric[];
  interpretation: readonly string[];
}

/**
 * Copia o relatório e confirma no próprio botão: o rótulo se transforma em
 * "Copiado" com um check verde que entra e sai, e o botão volta sozinho depois
 * de {@link COPY_SUCCESS_TIMEOUT_MS}. O aviso vive no botão (e não num texto ao
 * lado) para o retorno nascer onde a mão está e não empurrar o layout.
 */
export function CopyResultsButton({
  title,
  metrics,
  interpretation,
}: CopyResultsButtonProps) {
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => () => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  const clearResetTimer = () => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const handleCopy = async () => {
    clearResetTimer();
    setCopied(false);
    setErrorMessage(null);

    try {
      await copyTextToClipboard(formatResultReport(title, metrics, interpretation));
      setCopied(true);
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, COPY_SUCCESS_TIMEOUT_MS);
    } catch {
      setErrorMessage('Não foi possível copiar. Tente novamente.');
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => void handleCopy()}
        data-copied={copied ? 'true' : undefined}
        // `layout` acompanha a troca de largura entre os dois rótulos; sem ele o
        // botão daria um salto ao virar "Copiado".
        layout={reduceMotion ? false : 'size'}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          copied &&
            'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="copied"
              className="inline-flex items-center gap-1.5"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
            >
              {/* O check tem mola própria: entra estourando e sai encolhendo —
                  é o que dá o "in and out" do sinal verde. */}
              <motion.span
                className="inline-flex"
                initial={reduceMotion ? false : { scale: 0.3, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 620, damping: 16, mass: 0.5 }
                }
              >
                <Check className="size-4" aria-hidden />
              </motion.span>
              Copiado
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              className="inline-flex items-center gap-1.5"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
            >
              <Copy className="size-4" aria-hidden />
              Copiar tudo
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      {/* O rótulo do botão já mostra "Copiado"; esta região existe para quem
          navega por leitor de tela ouvir a confirmação. */}
      {copied ? (
        <span role="status" className="sr-only">
          Copiado
        </span>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
