import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react';

import { hasAnimatableNumber, parseCountUpSegments } from './countUpSegments';

/**
 * Quantos passos cada dígito percorre até parar. Contar desde zero faria a casa
 * dos centésimos girar `valor / 0,01` vezes (490 voltas em "4,90"): vira borrão
 * e o spring não assenta a tempo. Uma volta e pouco lê bem em qualquer escala.
 */
const SPIN_STEPS = 12;

/** Springs por duração: o tempo independe da amplitude, então todo dígito termina quando prometido. */
const BASE_DURATION_S = 0.6;
const STAGGER_S = 0.07;
const MAX_STAGGER_SLOTS = 5;

/** Folga depois do último dígito antes de trocar o odômetro por texto estático. */
const SETTLE_BUFFER_MS = 260;

function digitDuration(digitIndex: number): number {
  return BASE_DURATION_S + Math.min(digitIndex, MAX_STAGGER_SLOTS) * STAGGER_S;
}

type RenderItem =
  | { kind: 'static'; key: string; text: string }
  | { kind: 'digit'; key: string; value: number; place: number; duration: number };

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value: number, place: number): number {
  return Math.floor(normalizeNearInteger(value / place));
}

/**
 * Achata o valor formatado numa lista de itens de render, numerando os dígitos
 * da esquerda para a direita para escalonar o assentamento.
 */
function buildRenderItems(value: string): RenderItem[] {
  const items: RenderItem[] = [];
  let digitIndex = 0;

  parseCountUpSegments(value).forEach((segment, segmentIndex) => {
    if (segment.kind === 'text') {
      items.push({ kind: 'static', key: `t${segmentIndex}`, text: segment.text });
      return;
    }

    const [integerText, fractionText = ''] = segment.text.split(',');
    const integerDigits = integerText.replace(/\./g, '').length;
    let seenIntegerDigits = 0;

    const pushChar = (char: string, place: number | null, charIndex: string) => {
      const key = `n${segmentIndex}-${charIndex}`;
      if (place === null) {
        items.push({ kind: 'static', key, text: char });
        return;
      }
      items.push({
        kind: 'digit',
        key,
        value: segment.value,
        place,
        duration: digitDuration(digitIndex),
      });
      digitIndex += 1;
    };

    integerText.split('').forEach((char, index) => {
      if (char >= '0' && char <= '9') {
        pushChar(char, 10 ** (integerDigits - 1 - seenIntegerDigits), `i${index}`);
        seenIntegerDigits += 1;
      } else {
        pushChar(char, null, `i${index}`);
      }
    });

    if (segment.text.includes(',')) {
      pushChar(',', null, 'sep');
      fractionText.split('').forEach((char, index) => {
        pushChar(char, char >= '0' && char <= '9' ? 10 ** -(index + 1) : null, `f${index}`);
      });
    }
  });

  return items;
}

function DigitFace({ mv, digit }: { mv: MotionValue<number>; digit: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + digit - placeValue) % 10;
    const memo = offset > 5 ? offset - 10 : offset;
    return `${memo * 100}%`;
  });

  return <motion.span style={{ y }}>{digit}</motion.span>;
}

function RollingDigit({ value, place, duration }: { value: number; place: number; duration: number }) {
  const target = getValueRoundedToPlace(value, place);
  // `visualDuration` é a opção que o motion lê em SEGUNDOS. `duration` é lida em
  // milissegundos: passar 0,6 ali virava 0,0006 s, clampado ao piso de 10 ms, e
  // todo dígito chegava ao valor final no primeiro quadro — a contagem existia,
  // mas era imperceptível.
  const spring = useMemo(() => ({ visualDuration: duration, bounce: 0 }), [duration]);
  // Começa SPIN_STEPS atrás do alvo e sobe: a montagem é o gatilho da contagem.
  // Sem piso em zero — o transform só usa `latest % 10`, então um início
  // negativo é válido e garante que todo dígito role a mesma distância,
  // inclusive os que terminam em 0 (o "0,001" de um p pequeno).
  const animated = useSpring(target - SPIN_STEPS, spring);

  useEffect(() => {
    animated.set(target);
  }, [animated, target]);

  return (
    <span className="lacir-count-digit">
      {Array.from({ length: 10 }, (_, digit) => (
        <DigitFace key={digit} mv={animated} digit={digit} />
      ))}
    </span>
  );
}

export interface CountUpValueProps {
  value: string;
}

/**
 * Anima um valor de métrica já formatado em pt-BR com um odômetro por dígito.
 * A contagem roda uma vez, na montagem — re-renders (troca de α, preset de
 * gráfico) não reanimam, porque o card permanece montado.
 *
 * O odômetro é `aria-hidden` e vem acompanhado do valor exato em `sr-only`,
 * para leitores de tela (e para o DOM continuar consultável pelo texto real).
 */
export function CountUpValue({ value }: CountUpValueProps) {
  const reduceMotion = useReducedMotion();
  const items = useMemo(() => buildRenderItems(value), [value]);
  const animatable = useMemo(() => hasAnimatableNumber(parseCountUpSegments(value)), [value]);
  const hostRef = useRef<HTMLSpanElement>(null);
  // O resultado monta junto com um scrollIntoView suave, então os cards nascem
  // abaixo da dobra: sem esperar a entrada em tela, a rolagem consumiria quase
  // toda a contagem e o usuário chegaria ao número já parado.
  const inView = useInView(hostRef, { once: true, amount: 0.6 });
  const [settled, setSettled] = useState(false);

  // Espera o dígito mais lento terminar de fato, em vez de cortar num prazo fixo.
  const settleMs = useMemo(() => {
    const longest = items.reduce(
      (max, item) => (item.kind === 'digit' ? Math.max(max, item.duration) : max),
      0,
    );
    return longest * 1000 + SETTLE_BUFFER_MS;
  }, [items]);

  useEffect(() => {
    if (!inView) return;
    const timer = window.setTimeout(() => setSettled(true), settleMs);
    return () => window.clearTimeout(timer);
  }, [inView, settleMs]);

  const rolling = inView && !settled;

  return (
    <span ref={hostRef} className="lacir-count-host">
      {reduceMotion || !rolling || !animatable ? value : (
        <>
          <span className="sr-only">{value}</span>
          <span aria-hidden className="lacir-count-value">
            {items.map((item) =>
              item.kind === 'static' ? (
                <span key={item.key}>{item.text}</span>
              ) : (
                <RollingDigit
                  key={item.key}
                  value={item.value}
                  place={item.place}
                  duration={item.duration}
                />
              ),
            )}
          </span>
        </>
      )}
    </span>
  );
}
