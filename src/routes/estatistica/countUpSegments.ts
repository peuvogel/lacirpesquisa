export type CountUpSegment =
  | { kind: 'text'; text: string }
  | { kind: 'number'; text: string; value: number };

/**
 * Números pt-BR como `src/shared/format.ts` os produz: milhar com ponto e
 * decimal com vírgula (`1.234,568`, `0,001`, `12`).
 */
const PT_BR_NUMBER = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

export function parseNumericText(text: string): number {
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

/**
 * Quebra um valor de métrica já formatado em trechos numéricos (animáveis) e
 * trechos de texto (sinal, `<`, `%`, `a`, ou rótulos como "Sim"/"n/d").
 *
 * Invariante: concatenar `text` de todos os segmentos reconstrói a string
 * original — nada some da tela.
 */
export function parseCountUpSegments(value: string): CountUpSegment[] {
  const segments: CountUpSegment[] = [];
  let cursor = 0;

  for (const match of value.matchAll(PT_BR_NUMBER)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: 'text', text: value.slice(cursor, start) });
    }
    segments.push({ kind: 'number', text: match[0], value: parseNumericText(match[0]) });
    cursor = start + match[0].length;
  }

  if (cursor < value.length) {
    segments.push({ kind: 'text', text: value.slice(cursor) });
  }

  return segments.length ? segments : [{ kind: 'text', text: value }];
}

export function hasAnimatableNumber(segments: CountUpSegment[]): boolean {
  return segments.some((segment) => segment.kind === 'number' && Number.isFinite(segment.value));
}
