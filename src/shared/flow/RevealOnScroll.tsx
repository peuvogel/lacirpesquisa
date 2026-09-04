import { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

/**
 * Sem IntersectionObserver não há como saber o que entrou em cena. Como o
 * bloco continua montado e apenas transparente, a alternativa segura é
 * mostrá-lo direto — nunca esconder conteúdo que não temos como revelar.
 */
const canObserve = typeof IntersectionObserver !== 'undefined';

export interface RevealOnScrollProps {
  children: ReactNode;
  /** Fração do bloco que precisa aparecer para ele entrar. */
  amount?: number;
  className?: string;
}

/**
 * Revela um bloco quando ele entra em cena, uma única vez.
 *
 * Os resultados chegam todos de uma vez, logo abaixo de uma rolagem suave;
 * revelar por bloco devolve o ritmo da leitura. O conteúdo nunca é
 * desmontado — só a opacidade muda —, então continua na árvore de
 * acessibilidade e ao alcance de quem chega pela busca do navegador.
 */
export function RevealOnScroll({ children, amount = 0.15, className }: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, { once: true, amount });
  const animated = canObserve && !reduceMotion;

  return (
    <motion.div
      // Sem o ref o observer nunca é criado — é assim que o caminho sem
      // animação evita tocar no IntersectionObserver.
      ref={animated ? ref : undefined}
      className={className}
      initial={animated ? { opacity: 0, y: 12 } : false}
      animate={!animated || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
