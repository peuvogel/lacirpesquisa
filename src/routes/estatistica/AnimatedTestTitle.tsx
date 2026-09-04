import { motion, useReducedMotion } from 'motion/react';

/** Teto do escalonamento: títulos longos não podem arrastar a entrada. */
const MAX_STAGGER_LETTERS = 18;
const STAGGER_S = 0.018;

export interface AnimatedTestTitleProps {
  title: string;
  className?: string;
}

/**
 * Título do teste entrando letra a letra ao alternar de teste.
 *
 * As letras são `aria-hidden` e o título real vai num `sr-only` ao lado — sem
 * isso o leitor de tela soletraria o nome e `getByRole('heading', { name })`
 * deixaria de encontrá-lo. Mesma técnica do CountUpValue.
 *
 * Quem renderiza passa `key={activeTestId}` para o replay acontecer na troca.
 */
export function AnimatedTestTitle({ title, className }: AnimatedTestTitleProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <h1 className={className}>{title}</h1>;

  return (
    <h1 className={className}>
      <span className="sr-only">{title}</span>
      <span aria-hidden style={{ whiteSpace: 'pre' }}>
        {[...title].map((character, index) => (
          <motion.span
            key={`${character}-${index}`}
            className="inline-block"
            style={{ whiteSpace: 'pre' }}
            initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              duration: 0.32,
              ease: 'easeOut',
              delay: Math.min(index, MAX_STAGGER_LETTERS) * STAGGER_S,
            }}
          >
            {character}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}
