import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CHART_TYPE_CATALOG } from './chartTypeCatalog';
import { ChartTypeIcon } from './ChartTypeIcon';
import type { ChartPresetOption, CustomizerState } from './useChartCustomizer';

export type { ChartPresetOption } from './useChartCustomizer';

export interface ChartCustomizerProps {
  presets: ChartPresetOption[];
  state: CustomizerState;
  onPresetVisibleChange: (id: string, visible: boolean) => void;
  className?: string;
}

/**
 * Sidebar: only which chart types appear in the gallery.
 * Per-chart styling opens from the pencil control under each chart.
 */
export function ChartCustomizer({
  presets,
  state,
  onPresetVisibleChange,
  className,
}: ChartCustomizerProps) {
  const availableVisualIds = new Set(presets.map((preset) => preset.visualType));
  const visualCounts = presets.reduce<Record<string, number>>((acc, preset) => {
    acc[preset.visualType] = (acc[preset.visualType] ?? 0) + 1;
    return acc;
  }, {});
  const unavailableTypes = CHART_TYPE_CATALOG.filter((type) => !availableVisualIds.has(type.id));

  return (
    <aside
      className={cn(
        'rounded-lg border border-border bg-[var(--color-surface)] p-4 lg:p-6',
        className,
      )}
      aria-label="Personalizar gráfico"
    >
      <h3 className="text-lg font-bold text-foreground">Personalizar gráfico</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Marque os tipos que deseja visualizar. Edite cada gráfico pelo lápis.
      </p>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-sm font-bold text-foreground">Tipos de gráfico</legend>
        <div className="lacir-vis-type-grid max-h-[28rem] overflow-y-auto pr-1">
          {presets.map((preset) => {
            const inputId = `chart-type-${preset.id}`;
            const checked = state.visiblePresetIds[preset.id] !== false;
            const label =
              (visualCounts[preset.visualType] ?? 0) > 1 ? `${preset.label}` : preset.label;
            return (
              <label
                key={preset.id}
                htmlFor={inputId}
                className={cn('lacir-vis-thumb', checked && 'lacir-vis-thumb--active')}
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={(value) => onPresetVisibleChange(preset.id, value === true)}
                  className="lacir-vis-thumb__check !absolute top-1.5 left-1.5 z-[1]"
                  aria-label={label}
                />
                <ChartTypeIcon type={preset.visualType} className="lacir-vis-thumb__icon" />
                <span className="lacir-vis-thumb__label">{label}</span>
              </label>
            );
          })}

          {unavailableTypes.map((type) => (
            <label key={type.id} className="lacir-vis-thumb lacir-vis-thumb--disabled">
              <Checkbox
                checked={false}
                disabled
                aria-label={type.label}
                className="lacir-vis-thumb__check !absolute top-1.5 left-1.5 z-[1]"
              />
              <ChartTypeIcon type={type.id} className="lacir-vis-thumb__icon" />
              <span className="lacir-vis-thumb__label">{type.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </aside>
  );
}
