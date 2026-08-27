import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { Chart } from 'chart.js';
import { exportCanvasPng, useChartExport } from './useChartExport';

function renderWithCanvas(canvas: HTMLCanvasElement | null) {
  const canvasRef = { current: canvas } as RefObject<HTMLCanvasElement | null>;
  const { result } = renderHook(() => useChartExport(canvasRef));
  return result.current;
}

/** @testing-library/react's renderHook also appends its own container div
 * to document.body, so the export anchor is not necessarily the first
 * appendChild call — filter for the actual `<a>` element instead. */
function getAppendedAnchor(appendChildSpy: ReturnType<typeof vi.spyOn>) {
  const anchorCall = (appendChildSpy.mock.calls as unknown[][]).find(
    (call) => call[0] instanceof HTMLAnchorElement,
  );
  return anchorCall?.[0] as HTMLAnchorElement | undefined;
}

describe('useChartExport', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls toDataURL with image/png at full quality', () => {
    const canvas = document.createElement('canvas');
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL');

    const download = renderWithCanvas(canvas);
    download();

    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', 1.0);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the default filename when none is provided', () => {
    const canvas = document.createElement('canvas');

    const download = renderWithCanvas(canvas);
    download();

    const anchor = getAppendedAnchor(appendChildSpy);
    expect(anchor?.download).toBe('grafico-lacirstat.png');
  });

  it('honors a custom filename argument', () => {
    const canvas = document.createElement('canvas');

    const download = renderWithCanvas(canvas);
    download('meu-grafico.png');

    const anchor = getAppendedAnchor(appendChildSpy);
    expect(anchor?.download).toBe('meu-grafico.png');
  });

  it('removes the anchor from the DOM after the click (no leaked nodes)', () => {
    const canvas = document.createElement('canvas');

    const download = renderWithCanvas(canvas);
    download();

    const anchor = getAppendedAnchor(appendChildSpy);
    expect(anchor).toBeDefined();
    expect(anchor?.isConnected).toBe(false);
    expect(document.body.contains(anchor as Node)).toBe(false);
  });

  it('is a safe no-op when the canvas ref is null', () => {
    const download = renderWithCanvas(null);

    expect(() => download()).not.toThrow();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(getAppendedAnchor(appendChildSpy)).toBeUndefined();
  });

  it('restores the screen pixel ratio and reports an export failure', () => {
    const canvas = document.createElement('canvas');
    const resize = vi.fn();
    const chart = {
      options: { devicePixelRatio: 1.5 },
      resize,
    };
    vi.spyOn(Chart, 'getChart').mockReturnValue(chart as never);
    vi.spyOn(canvas, 'toDataURL').mockImplementation(() => {
      throw new Error('canvas tainted');
    });
    const reportError = vi.fn();

    const exported = exportCanvasPng(canvas, 'falha.png', reportError);

    expect(exported).toBe(false);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error));
    expect(chart.options.devicePixelRatio).toBe(1.5);
    expect(resize).toHaveBeenCalledTimes(2);
  });
});
