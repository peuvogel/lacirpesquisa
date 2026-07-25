import { legendBreaks } from '@/geo/choroplethScale';

export interface ChoroplethLegendProps {
  values: number[];
  activeVariableId: string | null;
  variableLabel?: string;
}

export function ChoroplethLegend({ values, activeVariableId, variableLabel }: ChoroplethLegendProps) {
  if (!activeVariableId || values.length === 0) {
    return (
      <p className="mt-6 font-sans text-sm text-text-muted">
        Selecione uma variável para ver a intensidade no mapa.
      </p>
    );
  }

  const breaks = legendBreaks(values);

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
      </ul>
      <p className="mt-3 font-sans text-xs text-text-muted">Exemplo didático</p>
    </aside>
  );
}
