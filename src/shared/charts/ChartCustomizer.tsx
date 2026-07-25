import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type AnnotationDefinition,
  type CustomizerState,
  type ThemeVariant,
  THEME_VARIANTS,
} from './useChartCustomizer';

export interface ChartPresetOption {
  id: string;
  label: string;
}

export interface ChartCustomizerProps {
  presets: ChartPresetOption[];
  state: CustomizerState;
  annotations?: AnnotationDefinition[];
  onPresetChange: (id: string) => void;
  onAxisLabelChange: (axis: 'x' | 'y', value: string) => void;
  onAnnotationToggle: (id: string, value: boolean) => void;
  onThemeChange: (variant: ThemeVariant) => void;
  onReset: () => void;
  className?: string;
}

export function ChartCustomizer({
  presets,
  state,
  annotations = [],
  onPresetChange,
  onAxisLabelChange,
  onAnnotationToggle,
  onThemeChange,
  onReset,
  className,
}: ChartCustomizerProps) {
  return (
    <aside
      className={cn(
        'rounded-lg border border-border bg-[var(--color-surface)] p-4 lg:p-6',
        className,
      )}
      aria-label="Personalizar gráfico"
    >
      <h3 className="text-lg font-bold text-foreground">Personalizar gráfico</h3>

      <div className="mt-4 space-y-5">
        {/* Tipo de gráfico */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-foreground">Tipo de gráfico</legend>
          <div
            role="radiogroup"
            aria-label="Tipo de gráfico"
            className="flex flex-wrap gap-2"
          >
            {presets.map((preset) => {
              const selected = state.chartTypePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onPresetChange(preset.id)}
                  className={cn(
                    'min-h-[44px] rounded-lg border px-3 py-2 text-sm font-bold transition-colors',
                    selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-foreground'
                      : 'border-border bg-[#171f1c] text-muted-foreground hover:bg-[#1a2420]',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Eixos */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-foreground">Eixos</legend>
          <div className="space-y-2">
            <Label htmlFor="axis-x" className="text-sm font-bold">
              Título do eixo X
            </Label>
            <input
              id="axis-x"
              type="text"
              value={state.axisLabels.x}
              onChange={(e) => onAxisLabelChange('x', e.target.value)}
              className="w-full rounded-lg border border-border bg-[#0a0f0d] px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="axis-y" className="text-sm font-bold">
              Título do eixo Y
            </Label>
            <input
              id="axis-y"
              type="text"
              value={state.axisLabels.y}
              onChange={(e) => onAxisLabelChange('y', e.target.value)}
              className="w-full rounded-lg border border-border bg-[#0a0f0d] px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
            />
          </div>
        </fieldset>

        {/* Anotações */}
        {annotations.length > 0 ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-foreground">Anotações</legend>
            {annotations.map((def) => (
              <div key={def.id} className="flex min-h-[44px] items-center justify-between gap-3">
                <Label htmlFor={`ann-${def.id}`} className="text-sm">
                  {def.label}
                </Label>
                <Switch
                  id={`ann-${def.id}`}
                  checked={state.annotationToggles[def.id] ?? true}
                  onCheckedChange={(checked) => onAnnotationToggle(def.id, checked)}
                />
              </div>
            ))}
          </fieldset>
        ) : null}

        {/* Tema visual */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-foreground">Tema visual</legend>
          <Select
            value={state.themeVariant}
            onValueChange={(v) => onThemeChange(v as ThemeVariant)}
          >
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(THEME_VARIANTS) as [ThemeVariant, { label: string }][]).map(
                ([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </fieldset>

        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          className="min-h-[44px] w-full"
        >
          Restaurar padrão do teste
        </Button>
      </div>
    </aside>
  );
}
