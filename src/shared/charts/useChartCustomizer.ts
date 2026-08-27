import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import type { ChartCanvasType } from './ChartCanvas';
import { COLORS, mergeChartOptions } from './chartTheme';
import type { ChartVisualType } from './chartTypeCatalog';
import {
  applyChartCapabilities,
  capabilityDefaults,
  type ChartCapability,
} from './chartCapabilities';

export type ThemeVariant = 'lacir' | 'neutral' | 'publication';

export interface ChartProps {
  type: ChartCanvasType;
  data: ChartData;
  options?: ChartOptions;
  ariaLabel: string;
}

export interface ChartPreset<T = unknown> {
  id: string;
  label: string;
  /** Datawrapper-style catalog id used by the checkbox picker. */
  visualType: ChartVisualType;
  buildChart: (engineOutput: T) => ChartProps;
  defaultAxisLabels?: { x: string; y: string };
  /** Explicit visual targets for every control offered by this preset. */
  capabilities: readonly ChartCapability[];
}

export interface BuiltChart<T = unknown> {
  id: string;
  label: string;
  visualType: ChartVisualType;
  chart: ChartProps;
  preset: ChartPreset<T>;
}

export interface CustomizerState {
  /** Chart focused for axis edits / primary export highlight. */
  chartTypePreset: string;
  axisLabels: { x: string; y: string };
  /** Preserves edits independently when the user moves between presets. */
  axisLabelsByPreset: Record<string, { x: string; y: string }>;
  annotationToggles: Record<string, boolean>;
  themeVariant: ThemeVariant;
  /** Which available presets are shown in the gallery. */
  visiblePresetIds: Record<string, boolean>;
}

export interface AnnotationDefinition {
  id: string;
  label: string;
}

export interface ChartPresetOption {
  id: string;
  label: string;
  visualType: ChartVisualType;
}

const MAX_AXIS_LABEL_LENGTH = 120;
const DEBOUNCE_MS = 150;

/** Accent variants on always-white canvas (publication default). */
const THEME_VARIANTS: Record<
  ThemeVariant,
  { label: string; gridOpacity: string }
> = {
  publication: { label: 'Publicação (branco)', gridOpacity: COLORS.grid },
  lacir: { label: 'Teal LACIR', gridOpacity: 'rgba(13, 148, 136, 0.14)' },
  neutral: { label: 'Neutro alto contraste', gridOpacity: 'rgba(15, 23, 42, 0.12)' },
};

function sanitizeAxisLabel(value: string): string {
  return value.slice(0, MAX_AXIS_LABEL_LENGTH);
}

function applyThemeVariant(options: ChartOptions, variant: ThemeVariant): ChartOptions {
  const theme = THEME_VARIANTS[variant];
  const gridColor = theme.gridOpacity;
  const baseScales = options.scales as Record<string, Record<string, unknown>> | undefined;

  return mergeChartOptions(options, {
    scales: {
      x: { ...(baseScales?.x ?? {}), grid: { color: gridColor, drawTicks: false } },
      y: { ...(baseScales?.y ?? {}), grid: { color: gridColor, drawTicks: false } },
    },
  });
}

function applyAxisLabels(
  options: ChartOptions | undefined,
  axisLabels: { x: string; y: string },
): ChartOptions {
  let merged = mergeChartOptions(options ?? {}, {});
  const xTitle = sanitizeAxisLabel(axisLabels.x);
  const yTitle = sanitizeAxisLabel(axisLabels.y);

  if (!xTitle && !yTitle) return merged;

  return mergeChartOptions(merged, {
    scales: {
      ...(xTitle
        ? {
            x: {
              title: {
                display: true,
                text: xTitle,
                color: COLORS.label,
                font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
              },
            },
          }
        : {}),
      ...(yTitle
        ? {
            y: {
              title: {
                display: true,
                text: yTitle,
                color: COLORS.label,
                font: { size: 12, family: "'Sora', 'Helvetica Neue', sans-serif", weight: 500 },
              },
            },
          }
        : {}),
    },
  });
}

export interface UseChartCustomizerOptions<T> {
  presets: ChartPreset<T>[];
  defaultPresetId: string;
  engineOutput: T;
  annotations?: AnnotationDefinition[];
}

export interface UseChartCustomizerResult<T = unknown> {
  state: CustomizerState;
  /** Active/focused chart (backward compatible). */
  chart: ChartProps;
  /** All built presets (visibility applied separately). */
  charts: BuiltChart<T>[];
  /** Presets currently checked in the type picker. */
  visibleCharts: BuiltChart<T>[];
  debouncedOptions: ChartOptions | undefined;
  setChartTypePreset: (id: string) => void;
  setAxisLabel: (axis: 'x' | 'y', value: string) => void;
  setAnnotationToggle: (id: string, value: boolean) => void;
  setThemeVariant: (variant: ThemeVariant) => void;
  setPresetVisible: (id: string, visible: boolean) => void;
  resetToDefault: () => void;
  mergeCustomizerIntoOptions: (baseOptions?: ChartOptions, axisLabels?: { x: string; y: string }) => ChartOptions;
}

export function useChartCustomizer<T>({
  presets,
  defaultPresetId,
  engineOutput,
  annotations = [],
}: UseChartCustomizerOptions<T>): UseChartCustomizerResult<T> {
  const defaultPreset = presets.find((p) => p.id === defaultPresetId) ?? presets[0];

  const buildDefaultState = useCallback((): CustomizerState => {
    const toggles: Record<string, boolean> = {};
    for (const preset of presets) {
      Object.assign(toggles, capabilityDefaults(preset.capabilities));
    }
    for (const def of annotations) {
      if (!(def.id in toggles)) toggles[def.id] = true;
    }
    const visiblePresetIds: Record<string, boolean> = {};
    const axisLabelsByPreset: Record<string, { x: string; y: string }> = {};
    for (const preset of presets) {
      visiblePresetIds[preset.id] = true;
      axisLabelsByPreset[preset.id] = {
        x: preset.defaultAxisLabels?.x ?? '',
        y: preset.defaultAxisLabels?.y ?? '',
      };
    }
    return {
      chartTypePreset: defaultPreset.id,
      axisLabels: {
        x: defaultPreset.defaultAxisLabels?.x ?? '',
        y: defaultPreset.defaultAxisLabels?.y ?? '',
      },
      axisLabelsByPreset,
      annotationToggles: toggles,
      themeVariant: 'publication',
      visiblePresetIds,
    };
  }, [annotations, defaultPreset, presets]);

  const [state, setState] = useState<CustomizerState>(buildDefaultState);
  const [debouncedOptions, setDebouncedOptions] = useState<ChartOptions | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mergeCustomizerIntoOptions = useCallback(
    (baseOptions?: ChartOptions, axisLabels?: { x: string; y: string }): ChartOptions => {
      // Annotations stay on by default; per-chart toggles are applied in applyChartOverrides.
      let merged = applyAxisLabels(baseOptions, axisLabels ?? state.axisLabels);
      merged = applyThemeVariant(merged, state.themeVariant);
      return merged;
    },
    [state.axisLabels, state.themeVariant],
  );

  const charts: BuiltChart<T>[] = useMemo(() => {
    return presets.map((preset) => {
      const base = preset.buildChart(engineOutput);
      const controlled = applyChartCapabilities(
        base,
        state.annotationToggles,
        preset.capabilities,
      );
      const axisLabels = state.axisLabelsByPreset[preset.id] ?? {
        x: preset.defaultAxisLabels?.x ?? '',
        y: preset.defaultAxisLabels?.y ?? '',
      };
      const label = preset.label;
      return {
        id: preset.id,
        label,
        visualType: preset.visualType,
        preset,
        chart: {
          ...controlled,
          ariaLabel: label,
          options: mergeCustomizerIntoOptions(controlled.options, axisLabels),
        },
      };
    });
  }, [presets, engineOutput, state.axisLabelsByPreset, state.annotationToggles, mergeCustomizerIntoOptions]);

  const visibleCharts = useMemo(
    () => charts.filter((item) => state.visiblePresetIds[item.id] !== false),
    [charts, state.visiblePresetIds],
  );

  const chart: ChartProps = useMemo(() => {
    const focused =
      visibleCharts.find((c) => c.id === state.chartTypePreset) ??
      visibleCharts[0] ??
      charts[0];
    return focused.chart;
  }, [charts, visibleCharts, state.chartTypePreset]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedOptions(chart.options);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [chart.options]);

  const setChartTypePreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      setState((prev) => ({
        ...prev,
        chartTypePreset: id,
        axisLabels: prev.axisLabelsByPreset[id] ?? {
          x: preset.defaultAxisLabels?.x ?? '',
          y: preset.defaultAxisLabels?.y ?? '',
        },
      }));
    },
    [presets],
  );

  const setAxisLabel = useCallback((axis: 'x' | 'y', value: string) => {
    setState((prev) => ({
      ...prev,
      axisLabels: { ...prev.axisLabels, [axis]: sanitizeAxisLabel(value) },
      axisLabelsByPreset: {
        ...prev.axisLabelsByPreset,
        [prev.chartTypePreset]: {
          ...(prev.axisLabelsByPreset[prev.chartTypePreset] ?? prev.axisLabels),
          [axis]: sanitizeAxisLabel(value),
        },
      },
    }));
  }, []);

  const setAnnotationToggle = useCallback((id: string, value: boolean) => {
    setState((prev) => ({
      ...prev,
      annotationToggles: { ...prev.annotationToggles, [id]: value },
    }));
  }, []);

  const setThemeVariant = useCallback((variant: ThemeVariant) => {
    setState((prev) => ({ ...prev, themeVariant: variant }));
  }, []);

  const setPresetVisible = useCallback((id: string, visible: boolean) => {
    setState((prev) => {
      const nextVisible = { ...prev.visiblePresetIds, [id]: visible };
      const stillVisible = Object.entries(nextVisible).some(([, on]) => on);
      // Keep at least one chart visible.
      if (!visible && !stillVisible) {
        return prev;
      }
      const nextFocus =
        !visible && prev.chartTypePreset === id
          ? (Object.entries(nextVisible).find(([, on]) => on)?.[0] ?? prev.chartTypePreset)
          : prev.chartTypePreset;
      const focusPreset = presets.find((p) => p.id === nextFocus);
      return {
        ...prev,
        visiblePresetIds: nextVisible,
        chartTypePreset: nextFocus,
        axisLabels: focusPreset
          ? prev.axisLabelsByPreset[focusPreset.id] ?? {
              x: focusPreset.defaultAxisLabels?.x ?? '',
              y: focusPreset.defaultAxisLabels?.y ?? '',
            }
          : prev.axisLabels,
      };
    });
  }, [presets]);

  const resetToDefault = useCallback(() => {
    setState(buildDefaultState());
  }, [buildDefaultState]);

  return {
    state,
    chart,
    charts,
    visibleCharts,
    debouncedOptions,
    setChartTypePreset,
    setAxisLabel,
    setAnnotationToggle,
    setThemeVariant,
    setPresetVisible,
    resetToDefault,
    mergeCustomizerIntoOptions,
  };
}

export { THEME_VARIANTS, sanitizeAxisLabel, DEBOUNCE_MS };
