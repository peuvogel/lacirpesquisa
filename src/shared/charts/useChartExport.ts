import { useCallback, type RefObject } from 'react';
import { Chart } from 'chart.js';

const DEFAULT_FILENAME = 'grafico-lacirstat.png';
/** Pixel ratio used only during PNG export (screen chart stays compact). */
export const EXPORT_PIXEL_RATIO = 3;

/** Imperative PNG download — temporarily upscales Chart.js for a crisp paper export. */
export function exportCanvasPng(
  canvas: HTMLCanvasElement,
  filename = DEFAULT_FILENAME,
  onError?: (error: unknown) => void,
): boolean {
  const chart =
    typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : undefined;
  let restore: (() => void) | undefined;

  if (chart) {
    const previousRatio = chart.options.devicePixelRatio;
    chart.options.devicePixelRatio = EXPORT_PIXEL_RATIO;
    chart.resize();
    restore = () => {
      chart.options.devicePixelRatio = previousRatio;
      chart.resize();
    };
  }

  try {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png', 1.0);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  } finally {
    restore?.();
  }
}

/**
 * PNG export (UI-04), ported from chart-manager.js's exportCanvas
 * with `document.getElementById(canvasId)` swapped for a React ref.
 */
export function useChartExport(canvasRef: RefObject<HTMLCanvasElement | null>) {
  return useCallback(
    (filename = DEFAULT_FILENAME) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      return exportCanvasPng(canvas, filename);
    },
    [canvasRef],
  );
}
