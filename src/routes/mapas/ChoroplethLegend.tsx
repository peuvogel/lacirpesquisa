import { legendBreaks } from '@/geo/choroplethScale';
import {
  MAP_METRIC_FILLS,
  type MapMetricCell,
  normalizeMapMetricCell,
} from '@/geo/mapMetricCell';

export interface ChoroplethLegendProps {
  /** Legacy numeric values; normalized at this visual boundary. */
  values?: readonly (number | null | undefined)[];
  cells?: readonly MapMetricCell[];
  activeVariableId: string | null;
  variableLabel?: string;
}

export function ChoroplethLegend({
  values = [],
  cells,
  activeVariableId,
  variableLabel,
}: ChoroplethLegendProps) {
  const metricCells = (cells ?? values).map(normalizeMapMetricCell);
  if (!activeVariableId || metricCells.length === 0) {
    return (
      <p className="mt-6 font-sans text-sm text-text-muted">
        Selecione uma variável para ver a intensidade no mapa.
      </p>
    );
  }

  const breaks = legendBreaks(metricCells.map((cell) => cell.value));
  const hasZero = metricCells.some((cell) => cell.displayStatus === 'zero');
  const hasMissing = metricCells.some((cell) => cell.displayStatus === 'missing');
  const hasReview = metricCells.some((cell) => cell.displayStatus === 'review');

  return (
    <aside
      className="mt-8 rounded-lg border border-border bg-elevated p-4"
      aria-label="Legenda do mapa coroplético"
    >
      <h2 className="font-sans text-label font-bold text-text">Intensidade no mapa</h2>
      {variableLabel ? (
        <p className="mt-1 font-sans text-sm text-text-muted">{variableLabel}</p>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2" role="list">
        {breaks.map((entry) => (
          <li
            key={`${entry.label}-${entry.color}`}
            className="flex items-center gap-2 font-sans text-sm text-text-muted"
            role="listitem"
          >
            <span
              className="inline-block h-3 w-6 shrink-0 rounded-sm border border-border"
              data-legend-swatch={entry.color}
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span>{entry.label}</span>
          </li>
        ))}
        {hasZero ? <MetricLegendItem label="0" ariaLabel="0 confirmado" fill={MAP_METRIC_FILLS.zero} /> : null}
        {hasMissing ? <MetricLegendItem label="Sem dados" ariaLabel="Sem dados" kind="missing" /> : null}
        {hasReview ? <MetricLegendItem label="Revisar" ariaLabel="Revisar dado" kind="review" /> : null}
      </ul>
    </aside>
  );
}

function MetricLegendItem({
  label,
  ariaLabel,
  fill,
  kind,
}: {
  label: string;
  ariaLabel: string;
  fill?: string;
  kind?: 'missing' | 'review';
}) {
  const style =
    kind === 'missing'
      ? {
          backgroundColor: '#3f3f46',
          backgroundImage: 'repeating-linear-gradient(135deg, #71717a 0 2px, transparent 2px 5px)',
        }
      : kind === 'review'
        ? {
            backgroundColor: '#5c3d17',
            backgroundImage: 'repeating-linear-gradient(135deg, #fbbf24 0 2px, transparent 2px 5px)',
          }
        : { backgroundColor: fill };

  return (
    <li className="flex items-center gap-2 font-sans text-sm text-text-muted" role="listitem">
      <span
        className="inline-block h-3 w-6 shrink-0 rounded-sm border border-border"
        data-legend-special={kind ?? 'zero'}
        role="img"
        aria-label={ariaLabel}
        style={style}
      />
      <span>{label}</span>
    </li>
  );
}
