import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { ChartCanvas } from './ChartCanvas';
import { ChartCustomizer } from './ChartCustomizer';
import { ChartEditPanel } from './ChartEditPanel';
import { DownloadPngButton } from './DownloadPngButton';
import {
  ChartOverlayIconButton,
  PencilIcon,
} from './ChartOverlayIconButton';
import {
  applyChartOverrides,
  type ChartStyleOverrides,
} from './chartOverrides';
import { exportCanvasPng } from './useChartExport';
import {
  useChartCustomizer,
  type AnnotationDefinition,
  type ChartPreset,
} from './useChartCustomizer';
import { usePresenceList } from './usePresenceList';
import { capabilityDefaults } from './chartCapabilities';
import { InterpretationText } from '@/routes/estatistica/InterpretationText';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import { cn } from '@/lib/utils';

export interface ResultsPanelWithCustomizerProps<T> {
  title: string;
  metrics: ResultMetric[];
  engineOutput: T;
  presets: ChartPreset<T>[];
  defaultPresetId: string;
  annotations?: AnnotationDefinition[];
  interpretation: string[];
  exportFilename?: string;
  actions?: ReactNode;
}

function isInsideEditChrome(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      '[data-lacir-chart-edit-panel], [data-slot="select-content"], [data-slot="select-item"], [data-slot="select-trigger"]',
    ),
  );
}

/**
 * Results panel with compact on-screen charts (high-res on PNG download).
 * Gallery: 2 per row; odd last chart spans full width.
 */
export function ResultsPanelWithCustomizer<T>({
  title,
  metrics,
  engineOutput,
  presets,
  defaultPresetId,
  annotations,
  interpretation,
  exportFilename = 'grafico-lacirstat.png',
  actions,
}: ResultsPanelWithCustomizerProps<T>) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [overridesById, setOverridesById] = useState<Record<string, ChartStyleOverrides>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;

  const customizer = useChartCustomizer({
    presets,
    defaultPresetId,
    engineOutput,
    annotations,
  });

  const presenceCharts = usePresenceList(customizer.visibleCharts);
  const activeCount = presenceCharts.filter((item) => item.phase !== 'exit').length;
  const editingItem =
    editingId == null
      ? undefined
      : presenceCharts.find((item) => item.id === editingId) ??
        customizer.visibleCharts.find((item) => item.id === editingId);
  const effectiveToggles = useCallback(
    (item: (typeof customizer.charts)[number]) => ({
      ...capabilityDefaults(item.preset.capabilities),
      ...(overridesById[item.id]?.annotationToggles ?? {}),
    }),
    [overridesById],
  );

  const setChartTypePreset = customizer.setChartTypePreset;
  const beginEditing = useCallback(
    (id: string) => {
      setChartTypePreset(id);
      setEditingId(id);
    },
    [setChartTypePreset],
  );

  const handleCanvasReady = useCallback((id: string, canvas: HTMLCanvasElement | null) => {
    if (canvas) canvasRefs.current.set(id, canvas);
    else canvasRefs.current.delete(id);
  }, []);

  // Click outside edit menu closes it (edits already persisted live).
  // Click on another chart switches editing target.
  useEffect(() => {
    if (!editingId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (isInsideEditChrome(target)) return;

      const chartCard =
        target instanceof Element ? target.closest<HTMLElement>('[data-chart-id]') : null;
      if (chartCard) {
        const nextId = chartCard.dataset.chartId;
        if (nextId && nextId !== editingIdRef.current) {
          beginEditing(nextId);
        }
        return;
      }

      setEditingId(null);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [editingId, beginEditing]);

  const presetOptions = useMemo(
    () =>
      presets.map((preset) => ({
        id: preset.id,
        label: preset.label,
        visualType: preset.visualType,
      })),
    [presets],
  );

  const slugFilename = (label: string, id: string) => {
    const base = exportFilename.replace(/\.png$/i, '');
    const slug = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${base}-${slug || id}.png`;
  };

  const onFocusParallax = (event: ReactMouseEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (!el.classList.contains('lacir-chart-focus--editing')) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--parallax-x', `${px * 5.5}deg`);
    el.style.setProperty('--parallax-y', `${-py * 5.5}deg`);
  };

  const resetParallax = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--parallax-x', '0deg');
    event.currentTarget.style.setProperty('--parallax-y', '0deg');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-border bg-[var(--color-surface)] px-4 py-3"
          >
            <p className="text-sm font-bold text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-[20px] font-bold leading-tight text-foreground">{metric.value}</p>
            {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {customizer.visibleCharts.length === 0 && presenceCharts.length === 0 ? (
            <p className="rounded-lg border border-border bg-[var(--color-surface)] px-4 py-6 text-sm text-muted-foreground">
              Selecione ao menos um tipo de gráfico na lista ao lado.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {presenceCharts.map((item) => {
              const activeIndex = presenceCharts
                .filter((row) => row.phase !== 'exit')
                .findIndex((row) => row.id === item.id);
              const isLastOdd =
                item.phase !== 'exit' && activeCount % 2 === 1 && activeIndex === activeCount - 1;
              const isEditing = editingId === item.id;
              const isDimmed = editingId != null && !isEditing;
              const displayChart = applyChartOverrides(
                item.chart,
                {
                  ...(overridesById[item.id] ?? {}),
                  annotationToggles: effectiveToggles(item),
                },
                item.preset.capabilities,
              );

              return (
                <article
                  key={item.id}
                  data-phase={item.phase}
                  data-chart-id={item.id}
                  className={cn(
                    'lacir-chart-card min-w-0',
                    isLastOdd && 'md:col-span-2',
                    isEditing && 'lacir-chart-card--editing',
                    isDimmed && 'lacir-chart-card--dimmed',
                  )}
                >
                  <div
                    className={cn('lacir-chart-focus relative', isEditing && 'lacir-chart-focus--editing')}
                    onMouseMove={onFocusParallax}
                    onMouseLeave={resetParallax}
                  >
                    <ChartCanvas
                      type={displayChart.type}
                      data={displayChart.data}
                      options={displayChart.options}
                      ariaLabel={displayChart.ariaLabel}
                      onCanvasReady={(canvas) => handleCanvasReady(item.id, canvas)}
                      onChartInteract={() => beginEditing(item.id)}
                    />
                    <div className="pointer-events-none absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
                      <div className="pointer-events-auto">
                        <ChartOverlayIconButton
                          label={`Editar ${item.label}`}
                          onClick={() => {
                            if (editingId === item.id) {
                              setEditingId(null);
                              return;
                            }
                            beginEditing(item.id);
                          }}
                        >
                          <PencilIcon />
                        </ChartOverlayIconButton>
                      </div>
                      <div className="pointer-events-auto">
                        <DownloadPngButton
                          label={`Baixar ${item.label}`}
                          onClick={() => {
                            const canvas = canvasRefs.current.get(item.id);
                            if (canvas) exportCanvasPng(canvas, slugFilename(item.label, item.id));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <ChartCustomizer
            presets={presetOptions}
            state={customizer.state}
            onPresetVisibleChange={customizer.setPresetVisible}
          />
        </div>
      </div>

      <InterpretationText paragraphs={interpretation} />

      <div className="flex flex-wrap items-center gap-3">
        <DownloadPngButton
          wide
          label="Baixar todos"
          onClick={() => {
            for (const item of customizer.visibleCharts) {
              const canvas = canvasRefs.current.get(item.id);
              if (canvas) exportCanvasPng(canvas, slugFilename(item.label, item.id));
            }
          }}
        />
        {actions}
      </div>

      {editingItem ? (
        <ChartEditPanel
          open={editingId != null}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
          chartLabel={editingItem.label}
          chart={editingItem.chart}
          overrides={overridesById[editingItem.id] ?? {}}
          onOverridesChange={(next) =>
            setOverridesById((prev) => ({ ...prev, [editingItem.id]: next }))
          }
          annotations={(annotations ?? []).filter((def) =>
            editingItem.preset.capabilities.some((capability) => capability.id === def.id),
          )}
          annotationToggles={effectiveToggles(editingItem)}
          onAnnotationToggle={(id, value) => {
            setOverridesById((prev) => {
              const current = prev[editingItem.id] ?? {};
              return {
                ...prev,
                [editingItem.id]: {
                  ...current,
                  annotationToggles: {
                    ...(current.annotationToggles ?? {}),
                    [id]: value,
                  },
                },
              };
            });
          }}
          themeVariant={customizer.state.themeVariant}
          onThemeChange={customizer.setThemeVariant}
          onReset={() => {
            customizer.resetToDefault();
            setOverridesById((prev) => {
              const next = { ...prev };
              delete next[editingItem.id];
              return next;
            });
          }}
        />
      ) : null}
    </div>
  );
}
