/**
 * Chart.js publication theme — white canvas for papers/congress abstracts.
 * Datawrapper-inspired: light grid, slate text, solid accent series, clean legend.
 */
import type { ChartOptions, ChartType, Plugin } from 'chart.js';

/** Mirrors the CSS `--font-sans` token for canvas text, where CSS variables are unavailable. */
export const CHART_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Geist Variable', 'Segoe UI', sans-serif";

export const COLORS = {
  primary: '#0F766E',
  primarySolid: '#0D9488',
  primaryLight: 'rgba(13, 148, 136, 0.18)',
  blue: '#2563EB',
  blueSolid: '#3B82F6',
  blueLight: 'rgba(37, 99, 235, 0.16)',
  teal: '#0D9488',
  tealLight: 'rgba(13, 148, 136, 0.14)',
  warning: '#D97706',
  danger: '#DC2626',
  dangerLight: 'rgba(220, 38, 38, 0.14)',
  grid: 'rgba(15, 23, 42, 0.08)',
  tick: '#64748B',
  label: '#334155',
  text: '#1E293B',
  muted: '#94A3B8',
  background: '#FFFFFF',
  border: '#E2E8F0',
};

/** Ensures PNG export and on-screen canvas are opaque white (not transparent). */
export const whiteBackgroundPlugin: Plugin = {
  id: 'lacirWhiteBackground',
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

export const BASE_OPTS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 450, easing: 'easeOutQuart' },
  layout: {
    padding: { top: 28, right: 28, bottom: 16, left: 18 },
  },
  plugins: {
    legend: {
      position: 'top',
      align: 'start',
      labels: {
        color: COLORS.text,
        font: { family: CHART_FONT_FAMILY, size: 12, weight: 500 },
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: 'rectRounded',
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderColor: COLORS.border,
      borderWidth: 1,
      titleColor: COLORS.text,
      bodyColor: COLORS.label,
      padding: 10,
      cornerRadius: 6,
      displayColors: true,
      boxPadding: 4,
      titleFont: { family: CHART_FONT_FAMILY, weight: 600, size: 12 },
      bodyFont: { family: CHART_FONT_FAMILY, size: 12 },
    },
  },
  scales: {
    x: {
      ticks: {
        color: COLORS.tick,
        font: { family: CHART_FONT_FAMILY, size: 11 },
        padding: 6,
      },
      grid: { color: COLORS.grid, drawTicks: false },
      border: { color: COLORS.border, display: true },
      title: {
        color: COLORS.label,
        font: { family: CHART_FONT_FAMILY, size: 12, weight: 500 },
      },
    },
    y: {
      ticks: {
        color: COLORS.tick,
        font: { family: CHART_FONT_FAMILY, size: 11 },
        padding: 6,
      },
      grid: { color: COLORS.grid, drawTicks: false },
      border: { display: false },
      title: {
        color: COLORS.label,
        font: { family: CHART_FONT_FAMILY, size: 12, weight: 500 },
      },
    },
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Merges chart options without clobbering nested layout/plugins/scales.
 * Annotation entries are additive; callers that need a full replace should
 * assign `plugins.annotation.annotations` directly (see filterAnnotationsByToggles).
 */
export function mergeChartOptions<T extends ChartType = ChartType>(
  base: ChartOptions<T>,
  override?: ChartOptions<T>,
): ChartOptions<T> {
  if (!override) return base;
  const baseRecord = base as Record<string, unknown>;
  const overrideRecord = override as Record<string, unknown>;

  const baseLayout = asRecord(baseRecord.layout);
  const overrideLayout = asRecord(overrideRecord.layout);
  const basePlugins = asRecord(baseRecord.plugins);
  const overridePlugins = asRecord(overrideRecord.plugins);
  const baseAnn = asRecord(basePlugins.annotation);
  const overrideAnn = asRecord(overridePlugins.annotation);
  const baseScales = asRecord(baseRecord.scales);
  const overrideScales = asRecord(overrideRecord.scales);

  const scaleKeys = new Set([...Object.keys(baseScales), ...Object.keys(overrideScales)]);
  const scales: Record<string, unknown> = {};
  for (const key of scaleKeys) {
    const left = asRecord(baseScales[key]);
    const right = asRecord(overrideScales[key]);
    scales[key] = {
      ...left,
      ...right,
      title: { ...asRecord(left.title), ...asRecord(right.title) },
      ticks: { ...asRecord(left.ticks), ...asRecord(right.ticks) },
      grid: { ...asRecord(left.grid), ...asRecord(right.grid) },
    };
  }

  const merged: Record<string, unknown> = {
    ...baseRecord,
    ...overrideRecord,
    layout: {
      ...baseLayout,
      ...overrideLayout,
      padding: {
        ...asRecord(baseLayout.padding),
        ...asRecord(overrideLayout.padding),
      },
    },
    plugins: {
      ...basePlugins,
      ...overridePlugins,
      ...(basePlugins.annotation != null || overridePlugins.annotation != null
        ? {
            annotation: {
              ...baseAnn,
              ...overrideAnn,
              annotations: {
                ...asRecord(baseAnn.annotations),
                ...asRecord(overrideAnn.annotations),
              },
            },
          }
        : {}),
    },
    scales,
  };

  return merged as ChartOptions<T>;
}
