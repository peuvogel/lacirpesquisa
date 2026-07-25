import { useCallback, type RefObject } from 'react';

const DEFAULT_FILENAME = 'grafico-lacirstat.png';

/**
 * PNG export (UI-04), ported verbatim from chart-manager.js's exportCanvas
 * (lines 138-147) with `document.getElementById(canvasId)` swapped for a
 * React ref. Uses `canvas.toDataURL` + a synthetic anchor download — no
 * `toBlob`/`URL.createObjectURL` and no screenshot dependency.
 */
export function useChartExport(canvasRef: RefObject<HTMLCanvasElement | null>) {
  return useCallback(
    (filename = DEFAULT_FILENAME) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png', 1.0);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [canvasRef],
  );
}
