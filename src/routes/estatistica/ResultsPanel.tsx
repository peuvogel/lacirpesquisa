import { useCallback, useRef, type ReactNode } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { Button } from '@/components/ui/button';
import { ChartCanvas, type ChartCanvasType } from '@/shared/charts/ChartCanvas';
import { useChartExport } from '@/shared/charts/useChartExport';
import { InterpretationText } from './InterpretationText';

export interface ResultMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface ResultChart {
  type: ChartCanvasType;
  data: ChartData;
  options?: ChartOptions;
  ariaLabel: string;
}

export interface ResultsPanelProps {
  title: string;
  metrics: ResultMetric[];
  chart: ResultChart;
  additionalCharts?: ResultChart[];
  interpretation: string[];
  exportFilename?: string;
  actions?: ReactNode;
  headingLevel?: 2 | 3 | 4;
}

/**
 * Shared Resultados pattern (UI-04 + UI-06): metric cards, chart, plain-PT
 * interpretation, and PNG export. Phases 2 and 3 mount real engines into this
 * shell instead of reinventing the layout.
 */
export function ResultsPanel({
  title,
  metrics,
  chart,
  additionalCharts = [],
  interpretation,
  exportFilename = 'grafico-lacirstat.png',
  actions,
  headingLevel = 2,
}: ResultsPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportChart = useChartExport(canvasRef);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  return (
    <div className="space-y-6">
      {headingLevel === 4 ? (
        <h4 className="text-lg font-bold text-foreground">{title}</h4>
      ) : headingLevel === 3 ? (
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
      ) : (
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-border bg-[var(--color-surface)] px-4 py-3">
            <p className="text-sm font-bold text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-[20px] font-bold leading-tight text-foreground">{metric.value}</p>
            {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className={additionalCharts.length > 0 ? 'grid gap-4 md:grid-cols-2' : undefined}>
        <ChartCanvas
          type={chart.type}
          data={chart.data}
          options={chart.options}
          ariaLabel={chart.ariaLabel}
          onCanvasReady={handleCanvasReady}
          className="lacir-chart-card"
        />
        {additionalCharts.map((additional) => (
          <ChartCanvas
            key={additional.ariaLabel}
            type={additional.type}
            data={additional.data}
            options={additional.options}
            ariaLabel={additional.ariaLabel}
            className="lacir-chart-card"
          />
        ))}
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
