import { scaleSequential } from 'd3-scale';
import { isPositiveFiniteMapValue } from './mapMetricCell';

/** UI-SPEC teal choropleth steps — dark zinc to bright teal (never purple/rainbow). */
export const TEAL_STEPS = ['#18181b', '#1a3d34', '#209978', '#2eb896', '#5eead4'] as const;

export interface LegendBreak {
  min: number;
  max: number;
  color: string;
  label: string;
}

function stepColor(t: number): string {
  const index = Math.min(TEAL_STEPS.length - 1, Math.floor(t * TEAL_STEPS.length));
  return TEAL_STEPS[index]!;
}

/**
 * Create a sequential choropleth color scale from numeric values.
 * Uses fixed teal steps per UI-SPEC.
 */
export function createChoroplethScale(values: readonly (number | null | undefined)[]) {
  const positiveValues = values.filter(isPositiveFiniteMapValue);
  if (positiveValues.length === 0) {
    return scaleSequential<string>().domain([0, 1]).interpolator(() => TEAL_STEPS[0]!);
  }

  const min = Math.min(...positiveValues);
  const max = Math.max(...positiveValues);

  if (min === max) {
    return scaleSequential<string>().domain([min, max]).interpolator(() => TEAL_STEPS[2]!);
  }

  return scaleSequential<string>()
    .domain([min, max])
    .interpolator(stepColor);
}

function ptBucketLabel(index: number, bucketCount: number): string {
  if (index === 0) return 'Baixo';
  if (index === bucketCount - 1) return 'Alto';
  if (index === 1) return 'Baixo-médio';
  if (index === bucketCount - 2) return 'Médio-alto';
  return 'Médio';
}

/** Compute legend break buckets for display. */
export function legendBreaks(
  values: readonly (number | null | undefined)[],
  bucketCount = TEAL_STEPS.length,
): LegendBreak[] {
  const positiveValues = values.filter(isPositiveFiniteMapValue);
  if (positiveValues.length === 0) return [];

  const min = Math.min(...positiveValues);
  const max = Math.max(...positiveValues);

  if (min === max) {
    return [{ min, max, color: TEAL_STEPS[2]!, label: String(min) }];
  }

  const step = (max - min) / bucketCount;
  const breaks: LegendBreak[] = [];

  for (let i = 0; i < bucketCount; i += 1) {
    const bucketMin = min + step * i;
    const bucketMax = i === bucketCount - 1 ? max : min + step * (i + 1);
    const t = i / (bucketCount - 1);
    breaks.push({
      min: bucketMin,
      max: bucketMax,
      color: stepColor(t),
      label: ptBucketLabel(i, bucketCount),
    });
  }

  return breaks;
}
