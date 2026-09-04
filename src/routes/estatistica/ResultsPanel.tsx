import { useCallback, useRef, type ReactNode } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { Button } from '@/components/ui/button';
import { ChartCanvas, type ChartCanvasType } from '@/shared/charts/ChartCanvas';
import { useChartExport } from '@/shared/charts/useChartExport';
import { RevealOnScroll } from '@/shared/flow/RevealOnScroll';
import { CopyResultsButton } from './CopyResultsButton';
import { InterpretationText } from './InterpretationText';
import { ResultMetricCard, type ResultMetric } from './ResultMetricCard';
export type { ResultMetric } from './ResultMetricCard';

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

  const displayTitle = title.includes(': resultados') ? 'Resultados' : title;

  return (
    <div className="space-y-6">
      {headingLevel === 4 ? (
        <h4 className="text-xl font-bold text-foreground">{displayTitle}</h4>
      ) : headingLevel === 3 ? (
        <h3 className="text-2xl font-bold text-foreground">{displayTitle}</h3>
      ) : (
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{displayTitle}</h2>
      )}

      {/* Mesmo ritmo do painel com personalização: um bloco por vez, conforme
          a rolagem chega. Nada é desmontado — só a opacidade muda. */}
      <RevealOnScroll className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <ResultMetricCard key={metric.label} metric={metric} />
        ))}
      </RevealOnScroll>

      <RevealOnScroll className={additionalCharts.length > 0 ? 'grid gap-4 md:grid-cols-2' : undefined}>
        <article
          aria-label={`Gráfico: ${chart.ariaLabel}`}
          tabIndex={0}
          className="lacir-chart-card min-w-0"
        >
          <div className="lacir-chart-focus">
            <ChartCanvas
              type={chart.type}
              data={chart.data}
              options={chart.options}
              ariaLabel={chart.ariaLabel}
              onCanvasReady={handleCanvasReady}
            />
          </div>
        </article>
        {additionalCharts.map((additional) => (
          <article
            key={additional.ariaLabel}
            aria-label={`Gráfico: ${additional.ariaLabel}`}
            tabIndex={0}
            className="lacir-chart-card min-w-0"
          >
            <div className="lacir-chart-focus">
              <ChartCanvas
                type={additional.type}
                data={additional.data}
                options={additional.options}
                ariaLabel={additional.ariaLabel}
              />
            </div>
          </article>
        ))}
      </RevealOnScroll>

      <RevealOnScroll>
        <InterpretationText paragraphs={interpretation} />
      </RevealOnScroll>

      <RevealOnScroll className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => exportChart(exportFilename)}>
          Baixar gráfico (PNG)
        </Button>
        {actions}
        <CopyResultsButton title={title} metrics={metrics} interpretation={interpretation} />
      </RevealOnScroll>
    </div>
  );
}
