import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { GripVerticalIcon, XIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ChartClickEditor } from './ChartClickEditor';
import type { ChartStyleOverrides } from './chartOverrides';
import type {
  AnnotationDefinition,
  ChartProps,
  ThemeVariant,
} from './useChartCustomizer';
import { THEME_VARIANTS } from './useChartCustomizer';

export interface ChartEditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartLabel: string;
  chart: ChartProps;
  overrides: ChartStyleOverrides;
  onOverridesChange: (next: ChartStyleOverrides) => void;
  annotations?: AnnotationDefinition[];
  annotationToggles: Record<string, boolean>;
  onAnnotationToggle: (id: string, value: boolean) => void;
  themeVariant: ThemeVariant;
  onThemeChange: (variant: ThemeVariant) => void;
  onReset: () => void;
}

const PANEL_WIDTH = 380;

function initialPosition() {
  if (typeof window === 'undefined') return { x: 48, y: 96 };
  const x = Math.max(16, window.innerWidth - PANEL_WIDTH - 32);
  const y = Math.max(72, Math.round(window.innerHeight * 0.12));
  return { x, y };
}

/**
 * Non-modal floating editor — draggable, hover-elevated, no backdrop blur
 * so chart changes stay visible in real time.
 */
export function ChartEditPanel({
  open,
  onOpenChange,
  chartLabel,
  chart,
  overrides,
  onOverridesChange,
  annotations = [],
  annotationToggles,
  onAnnotationToggle,
  themeVariant,
  onThemeChange,
  onReset,
}: ChartEditPanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [entered, setEntered] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setPos(initialPosition());
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open, chartLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const onDragPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return;

    event.preventDefault();
    dragOffset.current = {
      x: event.clientX - pos.x,
      y: event.clientY - pos.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDragPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? PANEL_WIDTH;
    const height = panel?.offsetHeight ?? 320;
    const nextX = event.clientX - dragOffset.current.x;
    const nextY = event.clientY - dragOffset.current.y;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    setPos({
      x: Math.min(Math.max(8, nextX), maxX),
      y: Math.min(Math.max(8, nextY), maxY),
    });
  };

  const onDragPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-lacir-chart-edit-panel=""
      data-dragging={dragging || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'lacir-chart-edit-float fixed z-50 flex w-[min(100vw-1.5rem,380px)] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground outline-none',
        'transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        dragging && 'cursor-grabbing select-none transition-none',
        hovered || dragging
          ? 'border-border shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)] ring-1 ring-foreground/10'
          : 'shadow-lg ring-1 ring-foreground/5',
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className={cn(
          'flex cursor-grab items-start gap-2 border-b border-border bg-muted/40 px-3 py-2.5 active:cursor-grabbing',
          dragging && 'cursor-grabbing',
        )}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <GripVerticalIcon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p id={titleId} className="text-sm font-medium leading-none">
            Editar gráfico
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{chartLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar editor"
          onClick={() => onOpenChange(false)}
        >
          <XIcon />
        </Button>
      </div>

      <div className="max-h-[min(52vh,380px)] space-y-4 overflow-y-auto px-3 py-3">
        <ChartClickEditor
          chart={chart}
          overrides={overrides}
          onChange={onOverridesChange}
          embedded
        />

        {annotations.length > 0 ? (
          <fieldset className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <legend className="px-1 text-sm font-medium text-foreground">Outros</legend>
            {annotations.map((def) => (
              <div key={def.id} className="flex min-h-9 items-center justify-between gap-3">
                <Label htmlFor={`edit-ann-${def.id}`} className="text-sm">
                  {def.label}
                </Label>
                <Switch
                  id={`edit-ann-${def.id}`}
                  checked={annotationToggles[def.id] ?? true}
                  onCheckedChange={(checked) => onAnnotationToggle(def.id, checked)}
                />
              </div>
            ))}
          </fieldset>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Paleta de acentos</legend>
          <Select
            value={themeVariant}
            onValueChange={(v) => onThemeChange(v as ThemeVariant)}
          >
            <SelectTrigger className="h-9 w-full">
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2.5">
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Restaurar padrão
        </Button>
        <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
          Concluir
        </Button>
      </div>
    </div>,
    document.body,
  );
}
