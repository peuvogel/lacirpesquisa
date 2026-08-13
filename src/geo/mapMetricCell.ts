/**
 * Display-ready metric returned to maps. `displayStatus` is deliberately
 * separate from the raw value: a real zero, absence, and a pending review
 * convey different information and must never share a choropleth class.
 */
export interface MapMetricCell {
  value: number | null;
  displayStatus: 'value' | 'zero' | 'missing' | 'review';
}

/** Transitional input accepted at the map boundary while callers migrate. */
export type MapMetricInput = MapMetricCell | number | null | undefined;

export const MAP_METRIC_FILLS = {
  zero: '#d6a500',
  missing: 'url(#lacir-map-missing-hatch)',
  review: 'url(#lacir-map-review-hatch)',
} as const;

export const MAP_METRIC_STROKES = {
  missing: '#a1a1aa',
  review: '#fbbf24',
} as const;

export function isPositiveFiniteMapValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isMapMetricCell(input: MapMetricInput): input is MapMetricCell {
  return typeof input === 'object' && input !== null && 'displayStatus' in input;
}

/**
 * Normalize legacy numeric input at the rendering boundary. Invalid numeric
 * values become missing, never zero. Explicit display states retain their raw
 * values so review/missing tooltips can disclose a zero excluded from analysis.
 */
export function normalizeMapMetricCell(input: MapMetricInput): MapMetricCell {
  if (!isMapMetricCell(input)) {
    if (input === 0) return { value: 0, displayStatus: 'zero' };
    if (isPositiveFiniteMapValue(input)) return { value: input, displayStatus: 'value' };
    return { value: null, displayStatus: 'missing' };
  }

  if (input.displayStatus === 'value' && !isPositiveFiniteMapValue(input.value)) {
    return { value: input.value, displayStatus: 'missing' };
  }
  if (input.displayStatus === 'zero' && input.value !== 0) {
    return { value: input.value, displayStatus: 'missing' };
  }
  return input;
}

export function mapMetricTooltip(cell: MapMetricCell): string {
  switch (cell.displayStatus) {
    case 'zero':
      return 'Zero confirmado para este território.';
    case 'review':
      return cell.value === 0
        ? 'Valor bruto: 0; aguarda revisão analítica.'
        : 'Dado aguarda revisão analítica.';
    case 'missing':
      return cell.value === 0
        ? 'Valor bruto: 0; tratado como ausência provável de coleta nesta análise.'
        : 'Sem dados para este território.';
    case 'value':
      return `Valor observado: ${cell.value}.`;
  }
}
