import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import type { ChartCanvasType } from './ChartCanvas';
import { COLORS, mergeChartOptions } from './chartTheme';

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
  buildChart: (engineOutput: T) => ChartProps;
  defaultAxisLabels?: { x: string; y: string };
  annotationKeys?: string[];
}

export interface CustomizerState {
  chartTypePreset: string;
  axisLabels: { x: string; y: string };
  annotationToggles: Record<string, boolean>;
  themeVariant: ThemeVariant;
}

export interface AnnotationDefinition {
  id: string;
  label: string;
}

const MAX_AXIS_LABEL_LENGTH = 120;
const DEBOUNCE_MS = 150;

const THEME_VARIANTS: Record<ThemeVariant, { label: string; gridOpacity: string; primaryOverride?: string }> = {
  lacir: { label: 'LACIR padrão', gridOpacity: COLORS.grid },
  neutral: { label: 'Neutro alto contraste', gridOpacity: 'rgba(255,255,255,0.12)', primaryOverride: '#94a3b8' },
  publication: { label: 'Publicação clara', gridOpacity: 'rgba(255,255,255,0.15)' },
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
      x: { ...(baseScales?.x ?? {}), grid: { color: gridColor } },
      y: { ...(baseScales?.y ?? {}), grid: { color: gridColor } },
    },
  });
}

function applyAnnotationToggles(
  options: ChartOptions,
  toggles: Record<string, boolean>,
  definitions: AnnotationDefinition[],
): ChartOptions {
  const annotations: Record<string, unknown> = {
    ...(options.plugins?.annotation as { annotations?: Record<string, unknown> } | undefined)?.annotations,
  };

  for (const def of definitions) {
    if (toggles[def.id] === false && annotations[def.id]) {
      const { [def.id]: _removed, ...rest } = annotations;
      Object.assign(annotations, rest);
      delete annotations[def.id];
    }
  }

  if (Object.keys(annotations).length === 0) {
    return options;
  }

  return mergeChartOptions(options, {
    plugins: {
      annotation: { annotations: annotations as Record<string, unknown> },
    },
  } as ChartOptions);
}

export interface UseChartCustomizerOptions<T> {
  presets: ChartPreset<T>[];
  defaultPresetId: string;
  engineOutput: T;
  annotations?: AnnotationDefinition[];
}

export interface UseChartCustomizerResult {
  state: CustomizerState;
  chart: ChartProps;
  debouncedOptions: ChartOptions | undefined;
  setChartTypePreset: (id: string) => void;
  setAxisLabel: (axis: 'x' | 'y', value: string) => void;
  setAnnotationToggle: (id: string, value: boolean) => void;
  setThemeVariant: (variant: ThemeVariant) => void;
  resetToDefault: () => void;
  mergeCustomizerIntoOptions: (baseOptions?: ChartOptions) => ChartOptions;
}

export function useChartCustomizer<T>({
  presets,
  defaultPresetId,
  engineOutput,
  annotations = [],
}: UseChartCustomizerOptions<T>): UseChartCustomizerResult {
  const defaultPreset = presets.find((p) => p.id === defaultPresetId) ?? presets[0];

  const buildDefaultState = useCallback((): CustomizerState => {
    const toggles: Record<string, boolean> = {};
    for (const def of annotations) {
      toggles[def.id] = true;
    }
    return {
      chartTypePreset: defaultPreset.id,
      axisLabels: {
        x: defaultPreset.defaultAxisLabels?.x ?? '',
        y: defaultPreset.defaultAxisLabels?.y ?? '',
      },
      annotationToggles: toggles,
      themeVariant: 'lacir',
    };
  }, [annotations, defaultPreset]);

  const [state, setState] = useState<CustomizerState>(buildDefaultState);
  const [debouncedOptions, setDebouncedOptions] = useState<ChartOptions | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePreset = presets.find((p) => p.id === state.chartTypePreset) ?? defaultPreset;

  const mergeCustomizerIntoOptions = useCallback(
    (baseOptions?: ChartOptions): ChartOptions => {
      let merged = mergeChartOptions(baseOptions ?? {}, {});

      const xTitle = sanitizeAxisLabel(state.axisLabels.x);
      const yTitle = sanitizeAxisLabel(state.axisLabels.y);

      if (xTitle || yTitle) {
        merged = mergeChartOptions(merged, {
          scales: {
            ...(xTitle
              ? { x: { title: { display: true, text: xTitle, color: COLORS.label, font: { size: 12 } } } }
              : {}),
            ...(yTitle
              ? { y: { title: { display: true, text: yTitle, color: COLORS.label, font: { size: 12 } } } }
              : {}),
          },
        });
      }

      merged = applyThemeVariant(merged, state.themeVariant);
      merged = applyAnnotationToggles(merged, state.annotationToggles, annotations);

      return merged;
    },
    [state.axisLabels, state.annotationToggles, state.themeVariant, annotations],
  );

  const baseChart = useMemo(
    () => activePreset.buildChart(engineOutput),
    [activePreset, engineOutput],
  );

  const mergedOptions = useMemo(
    () => mergeCustomizerIntoOptions(baseChart.options),
    [baseChart.options, mergeCustomizerIntoOptions],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedOptions(mergedOptions);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mergedOptions]);

  const chart: ChartProps = useMemo(
    () => ({
      ...baseChart,
      options: debouncedOptions ?? mergedOptions,
    }),
    [baseChart, debouncedOptions, mergedOptions],
  );

  const setChartTypePreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      setState((prev) => ({
        ...prev,
        chartTypePreset: id,
        axisLabels: {
          x: preset.defaultAxisLabels?.x ?? prev.axisLabels.x,
          y: preset.defaultAxisLabels?.y ?? prev.axisLabels.y,
        },
      }));
    },
    [presets],
  );

  const setAxisLabel = useCallback((axis: 'x' | 'y', value: string) => {
    setState((prev) => ({
      ...prev,
      axisLabels: { ...prev.axisLabels, [axis]: sanitizeAxisLabel(value) },
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

  const resetToDefault = useCallback(() => {
    setState(buildDefaultState());
  }, [buildDefaultState]);

  return {
    state,
    chart,
    debouncedOptions,
    setChartTypePreset,
    setAxisLabel,
    setAnnotationToggle,
    setThemeVariant,
    resetToDefault,
    mergeCustomizerIntoOptions,
  };
}

export { THEME_VARIANTS, sanitizeAxisLabel, DEBOUNCE_MS };
