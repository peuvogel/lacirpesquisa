export type AlphaValue = number & { readonly __alphaValue: unique symbol };

export const MIN_ALPHA = 0.001;
export const MAX_ALPHA = 0.1;
export const DEFAULT_ALPHA = 0.05 as AlphaValue;

export function parseAlpha(value: unknown, fallback = DEFAULT_ALPHA): AlphaValue {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));

  return Number.isFinite(numeric) && numeric >= MIN_ALPHA && numeric <= MAX_ALPHA
    ? numeric as AlphaValue
    : fallback;
}

export function alphaToPercent(alpha: AlphaValue): number {
  return alpha * 100;
}

export function percentToAlpha(percent: number): AlphaValue {
  return parseAlpha(percent / 100);
}

export function formatAlphaPercent(alpha: AlphaValue): string {
  return `${alphaToPercent(alpha).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
