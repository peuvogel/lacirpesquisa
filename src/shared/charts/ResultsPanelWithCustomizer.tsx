import { useCallback, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas';
import { ChartCustomizer } from './ChartCustomizer';
import { useChartExport } from './useChartExport';
import {
  useChartCustomizer,
  type AnnotationDefinition,
  type ChartPreset,
} from './useChartCustomizer';
import { InterpretationText } from '@/routes/estatistica/InterpretationText';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';

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

/**
 * ResultsPanel + ChartCustomizer grid layout for migrated tests (D-04).
 * Demo stays on plain ResultsPanel (D-06).
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportChart = useChartExport(canvasRef);

  const customizer = useChartCustomizer({
    presets,
    defaultPresetId,
    engineOutput,
    annotations,
  });

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  const { chart } = customizer;
  const presetOptions = presets.map(({ id, label }) => ({ id, label }));

  const chartBlock = (
    <ChartCanvas
      type={chart.type}
      data={chart.data}
      options={chart.options}
      ariaLabel={chart.ariaLabel}
      onCanvasReady={handleCanvasReady}
    />
  );

  const customizerBlock = (
    <ChartCustomizer
      presets={presetOptions}
      state={customizer.state}
      annotations={annotations}
      onPresetChange={customizer.setChartTypePreset}
      onAxisLabelChange={customizer.setAxisLabel}
      onAnnotationToggle={customizer.setAnnotationToggle}
      onThemeChange={customizer.setThemeVariant}
      onReset={customizer.resetToDefault}
    />
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-border bg-[var(--color-surface)] px-4 py-3">
            <p className="text-sm font-bold text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-[20px] font-bold leading-tight text-foreground">{metric.value}</p>
            {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
          </div>
        ))}
      </div>

      {/* Desktop: side-by-side 62/38 grid */}
      <div className="hidden lg:grid lg:grid-cols-[62%_38%] lg:gap-4">
        {chartBlock}
        {customizerBlock}
      </div>

      {/* Mobile/tablet: chart + collapsible customizer */}
      <div className="lg:hidden">
        {chartBlock}
        <Collapsible defaultOpen className="mt-4">
          <CollapsibleTrigger className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-border bg-[var(--color-surface)] px-4 py-2 text-sm font-bold text-foreground">
            Personalizar gráfico
            <ChevronDownIcon className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">{customizerBlock}</CollapsibleContent>
        </Collapsible>
      </div>

      <InterpretationText paragraphs={interpretation} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => exportChart(exportFilename)}>
          Baixar gráfico (PNG)
        </Button>
        {actions}
      </div>
    </div>
  );
}
