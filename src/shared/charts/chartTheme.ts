/**
 * Chart.js theme, ported from assets/js/chart-manager.js:36-89.
 * Only two values are retinted for the new UI contract:
 *   - COLORS.primary:    #22c55e -> #10b981 (clinical teal, D-16)
 *   - COLORS.background: #0f1117 -> #0a0f0d (UI-SPEC dominant surface)
 * Everything else (grid/tick/label rgba values, animation timing, layout
 * flags) is unchanged so charts keep the v1.0 feel.
 */
import type { ChartOptions, ChartType } from 'chart.js';

export const COLORS = {
  primary: '#10b981',
  primaryLight: 'rgba(34,197,94,0.18)',
  blue: '#3b82f6',
  blueLight: 'rgba(59,130,246,0.15)',
  teal: '#14b8a6',
  tealLight: 'rgba(20,184,166,0.15)',
  warning: '#f59e0b',
  danger: '#ef4444',
  dangerLight: 'rgba(239,68,68,0.18)',
  grid: 'rgba(255,255,255,0.07)',
  tick: 'rgba(255,255,255,0.45)',
  label: 'rgba(255,255,255,0.65)',
  background: '#0a0f0d',
};

export const BASE_OPTS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      labels: {
        color: COLORS.label,
        font: { family: "'Inter', sans-serif", size: 12 },
        boxWidth: 14,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15,17,23,0.95)',
      borderColor: 'rgba(34,197,94,0.35)',
      borderWidth: 1,
      titleColor: COLORS.primary,
      bodyColor: '#e5e7eb',
      padding: 12,
      cornerRadius: 8,
      titleFont: { family: "'Inter', sans-serif", weight: 600, size: 12 },
      bodyFont: { family: "'Inter', sans-serif", size: 12 },
    },
  },
  scales: {
    x: {
      ticks: { color: COLORS.tick, font: { size: 11 } },
      grid: { color: COLORS.grid },
      border: { color: 'rgba(255,255,255,0.1)' },
    },
    y: {
      ticks: { color: COLORS.tick, font: { size: 11 } },
      grid: { color: COLORS.grid },
      border: { color: 'rgba(255,255,255,0.1)' },
    },
  },
};

/**
 * Merges a caller-supplied options override over BASE_OPTS. A plain spread
 * would clobber `plugins`/`scales` wholesale when a caller only wants to
 * override one nested field (e.g. a single tooltip callback), so this merges
 * one level into those two nested groups while shallow-spreading the rest.
 */
export function mergeChartOptions<T extends ChartType = ChartType>(
  base: ChartOptions<T>,
  override?: ChartOptions<T>,
): ChartOptions<T> {
  if (!override) return base;
  // ChartOptions<T> isn't indexable for a generic T, so merge through an
  // untyped record and cast back once at the boundary.
  const baseRecord = base as Record<string, unknown>;
  const overrideRecord = override as Record<string, unknown>;

  const merged: Record<string, unknown> = {
    ...baseRecord,
    ...overrideRecord,
    plugins: { ...(baseRecord.plugins as object), ...(overrideRecord.plugins as object) },
    scales: { ...(baseRecord.scales as object), ...(overrideRecord.scales as object) },
  };

  return merged as ChartOptions<T>;
}
