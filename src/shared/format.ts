/**
 * pt-BR number formatting helpers, ported verbatim from assets/js/app.js:85-107.
 * Every result screen in the project shares these so numbers read identically
 * to the v1.0 vanilla-JS app.
 */

export function fmtNumber(value: unknown, digits = 3): string {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function fmtP(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value < 0.001) return '< 0,001';
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

export function fmtSigned(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return sign + Number(value).toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}
