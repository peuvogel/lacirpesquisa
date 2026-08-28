import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LogarithmicScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
  type ChartData,
  type ChartEvent,
  type ChartOptions,
  type LegendItem,
} from 'chart.js';
import { cn } from '@/lib/utils';
import { ensureChartAnnotationsRegistered } from './chartAnnotationSetup';
import type { ChartClickTarget } from './chartOverrides';
import { BASE_OPTS, mergeChartOptions, whiteBackgroundPlugin } from './chartTheme';

Chart.register(
  BarController,
  LineController,
  ScatterController,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  PointElement,
  LineElement,
  BarElement,
  Legend,
  Title,
  Tooltip,
  Filler,
  whiteBackgroundPlugin,
);
ensureChartAnnotationsRegistered();

export type ChartCanvasType = 'bar' | 'line' | 'scatter';

export const DEFAULT_CHART_HEIGHT = 420;
export const MIN_CHART_HEIGHT = 280;
export const MAX_CHART_HEIGHT = 900;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function clampChartHeight(height = DEFAULT_CHART_HEIGHT): number {
  if (!Number.isFinite(height)) return DEFAULT_CHART_HEIGHT;
  return Math.min(MAX_CHART_HEIGHT, Math.max(MIN_CHART_HEIGHT, Math.round(height)));
}

export interface ChartCanvasProps {
  type: ChartCanvasType;
  data: ChartData;
  options?: ChartOptions;
  ariaLabel: string;
  /** Responsive container height in CSS pixels. The canvas backing store remains Chart.js-managed. */
  height?: number;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onChartInteract?: (target: ChartClickTarget) => void;
}

function attachInteractHandlers(
  merged: ChartOptions,
  interactRef: MutableRefObject<((target: ChartClickTarget) => void) | undefined>,
): ChartOptions {
  const baseOptions: ChartOptions = {
    ...merged,
    devicePixelRatio: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
    ...(typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(REDUCED_MOTION_QUERY).matches
      ? { animation: false }
      : {}),
  };
  if (!interactRef.current) return baseOptions;

  const legendOnClick = (_event: ChartEvent, legendItem: LegendItem) => {
    const datasetIndex = legendItem.datasetIndex ?? 0;
    interactRef.current?.({ kind: 'dataset', datasetIndex });
  };

  return {
    ...baseOptions,
    onClick: (event, elements, chart) => {
      if (elements.length > 0) {
        const el = elements[0];
        interactRef.current?.({
          kind: 'element',
          datasetIndex: el.datasetIndex,
          index: el.index,
        });
        return;
      }

      const x = event.x;
      const y = event.y;
      if (typeof x === 'number' && typeof y === 'number') {
        const area = chart.chartArea;
        const labelCount = chart.data.labels?.length ?? 0;
        const xScale = chart.scales.x;

        if (y < area.top) {
          interactRef.current?.({ kind: 'title' });
          return;
        }

        if (
          xScale &&
          labelCount > 0 &&
          y > area.bottom &&
          x >= area.left &&
          x <= area.right
        ) {
          const raw = xScale.getValueForPixel(x);
          const index = typeof raw === 'number' ? Math.round(raw) : Number.NaN;
          if (Number.isFinite(index) && index >= 0 && index < labelCount) {
            interactRef.current?.({ kind: 'category', index });
            return;
          }
        }
      }

      interactRef.current?.({ kind: 'chart' });
    },
    plugins: {
      ...(baseOptions.plugins ?? {}),
      legend: {
        ...(baseOptions.plugins?.legend ?? {}),
        onClick: legendOnClick,
      },
    },
  };
}

/**
 * Compact on-screen chart. Updates in place without re-animating bars on each edit.
 */
export function ChartCanvas({
  type,
  data,
  options,
  ariaLabel,
  height,
  className,
  onCanvasReady,
  onChartInteract,
}: ChartCanvasProps) {
  const chartRef = useRef<Chart | null>(null);
  const interactRef = useRef(onChartInteract);
  interactRef.current = onChartInteract;
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      setCanvasEl(node);
      onCanvasReady?.(node);
    },
    [onCanvasReady],
  );

  // Create / recreate only when canvas or chart type changes.
  useEffect(() => {
    if (!canvasEl) return;

    chartRef.current?.destroy();
    const merged = attachInteractHandlers(mergeChartOptions(BASE_OPTS, options), interactRef);

    chartRef.current = new Chart(canvasEl, {
      type,
      data,
      options: merged,
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // Intentionally omit data/options — updated in the effect below without destroy.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/type only
  }, [canvasEl, type]);

  // Live updates (title, colors, annotations) without replay animation.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !canvasEl) return;

    const merged = attachInteractHandlers(mergeChartOptions(BASE_OPTS, options), interactRef);
    chart.config.options = merged;
    chart.data = data;
    chart.update('none');
  }, [canvasEl, data, onChartInteract, options]);

  return (
    <div
      className={cn(
        'relative mx-auto w-full overflow-visible rounded-xl bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)]',
        className,
      )}
      style={{ height: `${clampChartHeight(height)}px` }}
    >
      <canvas
        ref={setCanvasRef}
        role="img"
        aria-label={ariaLabel}
        className={cn('h-full w-full rounded-xl bg-white', onChartInteract && 'cursor-pointer')}
      />
    </div>
  );
}
