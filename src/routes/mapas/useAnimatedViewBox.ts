import { useEffect, useRef, useState } from 'react';

export interface ViewBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function parseViewBox(viewBox: string): ViewBoxRect {
  const [x = 0, y = 0, w = 1, h = 1] = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return { x, y, w: w || 1, h: h || 1 };
}

export function formatViewBox({ x, y, w, h }: ViewBoxRect): string {
  return `${x} ${y} ${w} ${h}`;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smoothly animates an SVG viewBox string toward `target` (GTA-style camera).
 */
export function useAnimatedViewBox(
  target: string,
  options?: { durationMs?: number; reduceMotion?: boolean },
): string {
  const durationMs = options?.durationMs ?? 720;
  const reduceMotion = options?.reduceMotion ?? false;
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(current);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    if (reduceMotion || currentRef.current === target) {
      setCurrent(target);
      return;
    }

    const from = parseViewBox(currentRef.current);
    const to = parseViewBox(target);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const e = easeInOutCubic(t);
      const next = formatViewBox({
        x: lerp(from.x, to.x, e),
        y: lerp(from.y, to.y, e),
        w: lerp(from.w, to.w, e),
        h: lerp(from.h, to.h, e),
      });
      setCurrent(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, reduceMotion]);

  return current;
}

/** Expand a path bbox so neighboring UFs stay in frame when zoomed. */
export function paddedViewBoxFromBBox(
  bbox: { x: number; y: number; width: number; height: number },
  padRatio = 0.38,
  minSpan = 3.2,
): string {
  const padX = Math.max(bbox.width * padRatio, minSpan * 0.15);
  const padY = Math.max(bbox.height * padRatio, minSpan * 0.15);
  let w = Math.max(bbox.width + padX * 2, minSpan);
  let h = Math.max(bbox.height + padY * 2, minSpan);
  // Keep a readable landscape-ish frame.
  const aspect = 4 / 3;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const x = bbox.x + bbox.width / 2 - w / 2;
  const y = bbox.y + bbox.height / 2 - h / 2;
  return formatViewBox({ x, y, w, h });
}
