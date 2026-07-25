import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { cn } from '@/lib/utils';
import { BASE_OPTS, mergeChartOptions } from './chartTheme';

// Registered once at module scope. Chart.js is bundled from the npm
// dependency (never a CDN specifier) so this resolves at build time.
Chart.register(
  BarController,
  LineController,
  ScatterController,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  BarElement,
  Legend,
  Tooltip,
  Filler,
);

export type ChartCanvasType = 'bar' | 'line' | 'scatter';

export interface ChartCanvasProps {
  type: ChartCanvasType;
  data: ChartData;
  options?: ChartOptions;
  ariaLabel: string;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

/**
 * Owns a single Chart.js instance for its lifetime: React's mount/unmount
 * replaces the legacy global Map-based registry (chart-manager.js:91-105).
 * The instance is destroyed before being recreated whenever type/data/options
 * change, and destroyed again on unmount — no canvas context is ever leaked.
 */
export function ChartCanvas({ type, data, options, ariaLabel, className, onCanvasReady }: ChartCanvasProps) {
  const chartRef = useRef<Chart | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      setCanvasEl(node);
      onCanvasReady?.(node);
    },
    [onCanvasReady],
  );

  useEffect(() => {
    if (!canvasEl) return;

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasEl, {
      type,
      data,
      options: mergeChartOptions(BASE_OPTS, options),
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [canvasEl, type, data, options]);

  return (
    <div className={cn('relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-[#121917]', className)}>
      <canvas ref={setCanvasRef} role="img" aria-label={ariaLabel} className="h-full w-full" />
    </div>
  );
}
