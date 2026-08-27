import type { ChartData, ChartDataset, ChartOptions } from 'chart.js';
import type { ChartProps } from './useChartCustomizer';
import { mergeChartOptions } from './chartTheme';
import { applyChartCapabilities, type ChartCapability } from './chartCapabilities';

export interface ChartStyleOverrides {
  title?: string;
  categoryLabels?: string[];
  datasetLabels?: string[];
  colors?: string[];
  barThickness?: number;
  categoryPercentage?: number;
  axisX?: string;
  axisY?: string;
  /** Per-chart annotation visibility (does not affect other charts). */
  annotationToggles?: Record<string, boolean>;
}

export type ChartClickTarget =
  | { kind: 'chart' }
  | { kind: 'title' }
  | { kind: 'category'; index: number }
  | { kind: 'dataset'; datasetIndex: number }
  | { kind: 'element'; datasetIndex: number; index: number };

function asColorArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return undefined;
}

const TITLE_MAX_CHARS_PER_LINE = 36;

/**
 * Split a long title into lines (word-aware) so Chart.js keeps font size
 * instead of visually crushing a single oversized line.
 */
export function wrapChartTitle(
  title: string,
  maxCharsPerLine = TITLE_MAX_CHARS_PER_LINE,
): string | string[] {
  const normalized = title.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length <= maxCharsPerLine) return normalized;

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= maxCharsPerLine) {
      current = word;
    } else {
      // Hard-break oversized tokens.
      for (let i = 0; i < word.length; i += maxCharsPerLine) {
        const chunk = word.slice(i, i + maxCharsPerLine);
        if (i + maxCharsPerLine < word.length) lines.push(chunk);
        else current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length <= 1 ? lines[0] ?? normalized : lines;
}

/** Remove annotation keys matching a toggle id (`id` or `id_*`). */
export function filterAnnotationsByToggles(
  options: ChartOptions,
  toggles: Record<string, boolean>,
): ChartOptions {
  const current = (
    options.plugins?.annotation as { annotations?: Record<string, unknown> } | undefined
  )?.annotations;
  if (!current) return options;

  const next: Record<string, unknown> = { ...current };
  for (const [toggleId, enabled] of Object.entries(toggles)) {
    if (enabled !== false) continue;
    for (const key of Object.keys(next)) {
      if (key === toggleId || key.startsWith(`${toggleId}_`)) {
        delete next[key];
      }
    }
  }

  // Replace annotations wholesale so a deep merge cannot restore deleted keys.
  return {
    ...options,
    plugins: {
      ...(options.plugins ?? {}),
      annotation: {
        ...((options.plugins?.annotation as object) ?? {}),
        annotations: next as NonNullable<
          NonNullable<NonNullable<ChartOptions['plugins']>['annotation']>['annotations']
        >,
      },
    },
  };
}

function isHighlightDataset(label: string): boolean {
  return (
    label.includes('outlier') ||
    label.includes('diferença de rank') ||
    label.includes('diferenca de rank')
  );
}

function isPointDataset(label: string): boolean {
  if (!label) return true;
  if (label.includes('regress') || label.includes('ajuste') || label.includes('intervalo')) {
    return false;
  }
  return !isHighlightDataset(label);
}

/** Hide series toggles; fold highlight points back into the main scatter series. */
function hideDatasetsByToggle(data: ChartData, toggles: Record<string, boolean>): ChartData {
  const datasets = [...(data.datasets ?? [])];

  if (toggles.highlightOutliers === false) {
    const highlightIdx = datasets.findIndex((dataset) =>
      isHighlightDataset(String(dataset.label ?? '').toLowerCase()),
    );
    if (highlightIdx >= 0) {
      const highlight = datasets[highlightIdx];
      const mainIdx = datasets.findIndex((dataset, index) => {
        if (index === highlightIdx) return false;
        return isPointDataset(String(dataset.label ?? '').toLowerCase());
      });
      if (mainIdx >= 0) {
        const main = datasets[mainIdx];
        const mainData = Array.isArray(main.data) ? [...main.data] : [];
        const extra = Array.isArray(highlight.data) ? highlight.data : [];
        datasets[mainIdx] = { ...main, data: [...mainData, ...extra] };
      }
      datasets.splice(highlightIdx, 1);
    }
  }

  return {
    ...data,
    datasets: datasets.map((dataset) => {
      const label = String(dataset.label ?? '').toLowerCase();
      if (
        toggles.showConfidenceIntervals === false &&
        (label.includes('intervalo') || label.includes('confiança') || label.includes('confianca'))
      ) {
        return { ...dataset, hidden: true };
      }
      if (
        toggles.showRegressionLine === false &&
        (label.includes('regressão') || label.includes('regressao') || label.includes('ajuste'))
      ) {
        return { ...dataset, hidden: true };
      }
      return dataset;
    }),
  };
}

/** Apply user style overrides on top of a built chart (data + options). */
export function applyChartOverrides(
  chart: ChartProps,
  overrides?: ChartStyleOverrides,
  capabilities: readonly ChartCapability[] = [],
): ChartProps {
  if (!overrides) return chart;

  let data: ChartData = {
    ...chart.data,
    labels: overrides.categoryLabels
      ? overrides.categoryLabels
      : chart.data.labels
        ? [...chart.data.labels]
        : chart.data.labels,
    datasets: (chart.data.datasets ?? []).map((dataset, datasetIndex) => {
      const next = { ...dataset } as ChartDataset & {
        maxBarThickness?: number;
        categoryPercentage?: number;
      };
      if (overrides.datasetLabels?.[datasetIndex] != null) {
        next.label = overrides.datasetLabels[datasetIndex];
      }

      const colors = overrides.colors;
      if (colors && colors.length > 0) {
        const bg = next.backgroundColor;
        const bgArr = asColorArray(bg);
        if (bgArr && bgArr.length > 1) {
          next.backgroundColor = colors.slice(0, Math.max(bgArr.length, colors.length));
          next.borderColor = colors.slice(0, Math.max(bgArr.length, colors.length));
        } else if (colors[datasetIndex] != null) {
          next.backgroundColor = colors[datasetIndex];
          next.borderColor = colors[datasetIndex];
        } else if (colors[0] != null && datasetIndex === 0) {
          next.backgroundColor = colors[0];
          next.borderColor = colors[0];
        }
      }

      if (chart.type === 'bar') {
        if (overrides.barThickness != null) {
          next.maxBarThickness = overrides.barThickness;
        }
        if (overrides.categoryPercentage != null) {
          next.categoryPercentage = overrides.categoryPercentage;
        }
      }

      return next;
    }),
  };

  let options: ChartOptions = chart.options ?? {};

  if (overrides.title != null) {
    const wrapped = wrapChartTitle(overrides.title);
    const lineCount = Array.isArray(wrapped) ? wrapped.length : wrapped ? 1 : 0;
    const extraTop = lineCount > 1 ? 10 + (lineCount - 1) * 12 : 6;
    options = mergeChartOptions(options, {
      layout: {
        padding: {
          // Keep room for mean/p labels; only add space for multi-line titles.
          top: 28 + extraTop,
          right: 20,
          bottom: 10,
          left: 12,
        },
      },
      plugins: {
        title: {
          display: overrides.title.trim().length > 0,
          text: wrapped,
          color: '#1E293B',
          font: { size: 13, weight: 'bold', family: "'Sora', 'Helvetica Neue', sans-serif" },
          padding: { top: 4, bottom: 10 },
        },
      },
    });
  }

  if (overrides.axisX != null || overrides.axisY != null) {
    options = mergeChartOptions(options, {
      scales: {
        ...(overrides.axisX != null
          ? {
              x: {
                title: {
                  display: overrides.axisX.length > 0,
                  text: overrides.axisX,
                  color: '#334155',
                  font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
                },
              },
            }
          : {}),
        ...(overrides.axisY != null
          ? {
              y: {
                title: {
                  display: overrides.axisY.length > 0,
                  text: overrides.axisY,
                  color: '#334155',
                  font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
                },
              },
            }
          : {}),
      },
    });
  }

  if (overrides.annotationToggles && capabilities.length === 0) {
    options = filterAnnotationsByToggles(options, overrides.annotationToggles);
    data = hideDatasetsByToggle(data, overrides.annotationToggles);
  }

  const styled = {
    ...chart,
    data,
    options,
    ariaLabel: overrides.title?.trim() || chart.ariaLabel,
  };
  return overrides.annotationToggles && capabilities.length > 0
    ? applyChartCapabilities(styled, overrides.annotationToggles, capabilities)
    : styled;
}

export function extractEditableFields(chart: ChartProps): {
  title: string;
  categoryLabels: string[];
  datasetLabels: string[];
  colors: string[];
  barThickness: number;
  categoryPercentage: number;
  axisX: string;
  axisY: string;
  isBar: boolean;
  categoryColorsEditable: boolean;
  seriesColorsEditable: boolean;
  datasetLabelsEditable: boolean;
} {
  const labels = (chart.data.labels ?? []).map(String);
  const datasets = chart.data.datasets ?? [];
  const datasetLabels = datasets.map((d, i) => String(d.label ?? `Série ${i + 1}`));

  const first = datasets[0] as
    | (ChartDataset & { maxBarThickness?: number; categoryPercentage?: number })
    | undefined;
  const bg = asColorArray(first?.backgroundColor) ?? ['#0D9488'];
  const categoryColorsEditable =
    datasets.length === 1 && Array.isArray(first?.backgroundColor) && bg.length > 1;
  const seriesColorsEditable = datasets.length > 0 && !categoryColorsEditable;
  const colors = categoryColorsEditable
    ? bg
    : datasets.map((d) => asColorArray(d.backgroundColor)?.[0] ?? bg[0] ?? '#2563EB');

  const barThickness = typeof first?.maxBarThickness === 'number' ? first.maxBarThickness : 48;
  const categoryPercentage =
    typeof first?.categoryPercentage === 'number' ? first.categoryPercentage : 0.55;

  const scales = chart.options?.scales as
    | { x?: { title?: { text?: string } }; y?: { title?: { text?: string } } }
    | undefined;
  const pluginTitle = (chart.options?.plugins as { title?: { text?: string | string[] } } | undefined)
    ?.title?.text;
  const legendDisplay = (chart.options?.plugins as { legend?: { display?: boolean } } | undefined)
    ?.legend?.display;

  return {
    title: Array.isArray(pluginTitle)
      ? pluginTitle.join(' ')
      : (pluginTitle ?? chart.ariaLabel ?? ''),
    categoryLabels: labels,
    datasetLabels,
    colors,
    barThickness,
    categoryPercentage,
    axisX: String(scales?.x?.title?.text ?? ''),
    axisY: String(scales?.y?.title?.text ?? ''),
    isBar: chart.type === 'bar',
    categoryColorsEditable,
    seriesColorsEditable,
    datasetLabelsEditable: legendDisplay !== false,
  };
}
