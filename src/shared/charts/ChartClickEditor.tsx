import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChartClickTarget } from './chartOverrides';
import { extractEditableFields, type ChartStyleOverrides } from './chartOverrides';
import type { ChartProps } from './useChartCustomizer';

const fieldClassName = cn(
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground shadow-none outline-none transition-colors',
  'placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'dark:bg-input/30',
);

function ColorSwatch({
  value,
  ariaLabel,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label
      className="relative inline-flex size-8 shrink-0 cursor-pointer overflow-hidden rounded-full border border-input shadow-sm"
      style={{ backgroundColor: value }}
      title={ariaLabel}
    >
      <input
        type="color"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}

export interface ChartClickEditorProps {
  chart: ChartProps;
  overrides: ChartStyleOverrides;
  focus?: ChartClickTarget;
  onChange: (next: ChartStyleOverrides) => void;
  /** When true, omit outer chrome (used inside Sheet). */
  embedded?: boolean;
  onClose?: () => void;
}

function focusHint(focus?: ChartClickTarget): string {
  if (!focus) return 'Edite título, rótulos, cores e barras.';
  if (focus.kind === 'category') return `Editando categoria #${focus.index + 1}`;
  if (focus.kind === 'element')
    return `Editando elemento (série ${focus.datasetIndex + 1}, item ${focus.index + 1})`;
  if (focus.kind === 'dataset') return `Editando série #${focus.datasetIndex + 1}`;
  if (focus.kind === 'title') return 'Editando título';
  return 'Editando gráfico';
}

export function ChartClickEditor({
  chart,
  overrides,
  focus,
  onChange,
  embedded = false,
  onClose,
}: ChartClickEditorProps) {
  const base = extractEditableFields(chart);
  const title = overrides.title ?? base.title;
  const categoryLabels = overrides.categoryLabels ?? base.categoryLabels;
  const datasetLabels = overrides.datasetLabels ?? base.datasetLabels;
  const colors = overrides.colors ?? base.colors;
  const barThickness = overrides.barThickness ?? base.barThickness;
  const categoryPercentage = overrides.categoryPercentage ?? base.categoryPercentage;
  const axisX = overrides.axisX ?? base.axisX;
  const axisY = overrides.axisY ?? base.axisY;

  const patch = (partial: ChartStyleOverrides) => onChange({ ...overrides, ...partial });

  const highlightCategory =
    focus?.kind === 'category' ? focus.index : focus?.kind === 'element' ? focus.index : null;
  const highlightDataset =
    focus?.kind === 'dataset'
      ? focus.datasetIndex
      : focus?.kind === 'element'
        ? focus.datasetIndex
        : null;

  const fields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="chart-edit-title" className="text-xs font-medium">
          Título
        </Label>
        <input
          id="chart-edit-title"
          type="text"
          value={title}
          autoFocus={focus?.kind === 'title' || focus?.kind === 'chart'}
          onChange={(e) => patch({ title: e.target.value })}
          className={fieldClassName}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="chart-edit-x" className="text-xs font-medium">
          Eixo X
        </Label>
        <input
          id="chart-edit-x"
          type="text"
          value={axisX}
          onChange={(e) => patch({ axisX: e.target.value })}
          className={fieldClassName}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="chart-edit-y" className="text-xs font-medium">
          Eixo Y
        </Label>
        <input
          id="chart-edit-y"
          type="text"
          value={axisY}
          onChange={(e) => patch({ axisY: e.target.value })}
          className={fieldClassName}
        />
      </div>

      {categoryLabels.length > 0 ? (
        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs font-medium text-foreground">Categorias / grupos</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {categoryLabels.map((label, index) => (
              <div key={`cat-${index}`} className="flex items-center gap-2">
                <ColorSwatch
                  ariaLabel={`Cor de ${label}`}
                  value={normalizeHex(colors[index] ?? colors[0] ?? '#0D9488')}
                  onChange={(hex) => {
                    const next = [...colors];
                    next[index] = hex;
                    patch({ colors: next });
                  }}
                />
                <input
                  type="text"
                  value={label}
                  autoFocus={highlightCategory === index}
                  onChange={(e) => {
                    const next = [...categoryLabels];
                    next[index] = e.target.value;
                    patch({ categoryLabels: next });
                  }}
                  className={fieldClassName}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {datasetLabels.length > 0 ? (
        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs font-medium text-foreground">Séries</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {datasetLabels.map((label, index) => (
              <div key={`ds-${index}`} className="flex items-center gap-2">
                {categoryLabels.length <= 1 ? (
                  <ColorSwatch
                    ariaLabel={`Cor da série ${label}`}
                    value={normalizeHex(colors[index] ?? colors[0] ?? '#0D9488')}
                    onChange={(hex) => {
                      const next = [...colors];
                      next[index] = hex;
                      patch({ colors: next });
                    }}
                  />
                ) : null}
                <input
                  type="text"
                  value={label}
                  autoFocus={highlightDataset === index && highlightCategory == null}
                  onChange={(e) => {
                    const next = [...datasetLabels];
                    next[index] = e.target.value;
                    patch({ datasetLabels: next });
                  }}
                  className={fieldClassName}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {base.isBar ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="chart-edit-thickness" className="text-xs font-medium">
              Largura das barras ({barThickness}px)
            </Label>
            <input
              id="chart-edit-thickness"
              type="range"
              min={12}
              max={96}
              value={barThickness}
              onChange={(e) => patch({ barThickness: Number(e.target.value) })}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="chart-edit-gap" className="text-xs font-medium">
              Espaçamento ({Math.round(categoryPercentage * 100)}%)
            </Label>
            <input
              id="chart-edit-gap"
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={categoryPercentage}
              onChange={(e) => patch({ categoryPercentage: Number(e.target.value) })}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>
        </>
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{focusHint(focus)}</p>
        {fields}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Editar gráfico</p>
          <p className="text-xs text-muted-foreground">{focusHint(focus)}</p>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        ) : null}
      </div>
      {fields}
    </div>
  );
}

function normalizeHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#0D9488';
}
