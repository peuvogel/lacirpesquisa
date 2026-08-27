import type { ChartData, ChartOptions, ChartType } from 'chart.js';
import type { ChartProps } from './useChartCustomizer';

declare module 'chart.js' {
  interface ChartDatasetProperties<TType extends ChartType, TData> {
    /** Stable application id used by the LACIR chart customizer. */
    lacirId?: string;
  }

  interface ChartDatasetPropertiesCustomTypesPerDataset<TType extends ChartType, TData> {
    /** Stable application id used by the LACIR chart customizer. */
    lacirId?: string;
  }
}

interface CapabilityBase {
  id: string;
  defaultEnabled?: boolean;
}

export interface DatasetVisibilityCapability extends CapabilityBase {
  kind: 'datasetVisibility';
  datasetIds: string[];
  disabledBehavior?: 'hide' | 'merge';
  mergeIntoDatasetId?: string;
}

export interface AnnotationVisibilityCapability extends CapabilityBase {
  kind: 'annotationVisibility';
  annotationIds?: string[];
  annotationPrefixes?: string[];
}

export interface ScaleTypeCapability extends CapabilityBase {
  kind: 'scaleType';
  axis: 'x' | 'y';
  enabledType: 'linear' | 'logarithmic';
  disabledType: 'linear' | 'logarithmic';
}

export type ChartCapability =
  | DatasetVisibilityCapability
  | AnnotationVisibilityCapability
  | ScaleTypeCapability;

export function capabilityDefaults(
  capabilities: readonly ChartCapability[],
): Record<string, boolean> {
  return Object.fromEntries(
    capabilities.map((capability) => [capability.id, capability.defaultEnabled ?? true]),
  );
}

function enabledFor(
  capability: ChartCapability,
  toggles: Readonly<Record<string, boolean>>,
): boolean {
  return toggles[capability.id] ?? capability.defaultEnabled ?? true;
}

function applyDatasetCapability(
  data: ChartData,
  capability: DatasetVisibilityCapability,
  enabled: boolean,
): ChartData {
  if (enabled) return data;

  let datasets = [...data.datasets];
  if (capability.disabledBehavior === 'merge' && capability.mergeIntoDatasetId) {
    const targetIndex = datasets.findIndex(
      (dataset) => dataset.lacirId === capability.mergeIntoDatasetId,
    );
    if (targetIndex >= 0) {
      const target = datasets[targetIndex];
      const mergedData = [...(Array.isArray(target.data) ? target.data : [])];
      for (const dataset of datasets) {
        if (capability.datasetIds.includes(dataset.lacirId ?? '')) {
          mergedData.push(...(Array.isArray(dataset.data) ? dataset.data : []));
        }
      }
      datasets[targetIndex] = { ...target, data: mergedData };
      datasets = datasets.filter(
        (dataset) => !capability.datasetIds.includes(dataset.lacirId ?? ''),
      );
      return { ...data, datasets };
    }
  }

  return {
    ...data,
    datasets: datasets.map((dataset) =>
      capability.datasetIds.includes(dataset.lacirId ?? '')
        ? { ...dataset, hidden: true }
        : dataset,
    ),
  };
}

function appliesToAnnotation(
  key: string,
  capability: AnnotationVisibilityCapability,
): boolean {
  return Boolean(
    capability.annotationIds?.includes(key)
    || capability.annotationPrefixes?.some((prefix) => key.startsWith(prefix)),
  );
}

function applyAnnotationCapability(
  options: ChartOptions,
  capability: AnnotationVisibilityCapability,
  enabled: boolean,
): ChartOptions {
  if (enabled) return options;
  const annotationPlugin = options.plugins?.annotation as
    | { annotations?: Record<string, unknown> }
    | undefined;
  if (!annotationPlugin?.annotations) return options;
  const annotations = Object.fromEntries(
    Object.entries(annotationPlugin.annotations).filter(
      ([key]) => !appliesToAnnotation(key, capability),
    ),
  );
  return {
    ...options,
    plugins: {
      ...(options.plugins ?? {}),
      annotation: {
        ...annotationPlugin,
        annotations: annotations as NonNullable<
          NonNullable<NonNullable<ChartOptions['plugins']>['annotation']>['annotations']
        >,
      },
    },
  };
}

function applyScaleCapability(
  options: ChartOptions,
  capability: ScaleTypeCapability,
  enabled: boolean,
): ChartOptions {
  const scales = (options.scales ?? {}) as Record<string, Record<string, unknown>>;
  return {
    ...options,
    scales: {
      ...scales,
      [capability.axis]: {
        ...(scales[capability.axis] ?? {}),
        type: enabled ? capability.enabledType : capability.disabledType,
      },
    },
  } as ChartOptions;
}

/** Apply only explicit preset targets; labels are never used as control selectors. */
export function applyChartCapabilities(
  chart: ChartProps,
  toggles: Readonly<Record<string, boolean>>,
  capabilities: readonly ChartCapability[],
): ChartProps {
  let data = chart.data;
  let options = chart.options ?? {};

  for (const capability of capabilities) {
    const enabled = enabledFor(capability, toggles);
    if (capability.kind === 'datasetVisibility') {
      data = applyDatasetCapability(data, capability, enabled);
    } else if (capability.kind === 'annotationVisibility') {
      options = applyAnnotationCapability(options, capability, enabled);
    } else {
      options = applyScaleCapability(options, capability, enabled);
    }
  }

  return { ...chart, data, options };
}
