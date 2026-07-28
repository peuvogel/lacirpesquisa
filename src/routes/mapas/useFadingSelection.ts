import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_FADE_MS = 420;

/**
 * Keeps recently removed ids mounted so CSS can fade them out before unmount.
 * Returns a map of id → opacity target (1 while entering frame, 0 while fading).
 */
export function useFadingSelection(
  activeIds: readonly string[],
  options?: { durationMs?: number; reduceMotion?: boolean },
): ReadonlyMap<string, number> {
  const durationMs = options?.durationMs ?? DEFAULT_FADE_MS;
  const reduceMotion = options?.reduceMotion ?? false;
  const prevRef = useRef<string[]>([]);
  const [fading, setFading] = useState<Map<string, number>>(() => new Map());

  const activeKey = activeIds.join('\0');

  useEffect(() => {
    const prev = prevRef.current;
    const activeSet = new Set(activeIds);
    prevRef.current = [...activeIds];

    if (reduceMotion) {
      setFading((current) => (current.size === 0 ? current : new Map()));
      return;
    }

    const removed = prev.filter((id) => !activeSet.has(id));
    if (removed.length === 0) {
      // Drop fade entries that were re-selected.
      setFading((current) => {
        if (current.size === 0) return current;
        let changed = false;
        const next = new Map(current);
        for (const id of activeSet) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : current;
      });
      return;
    }

    setFading((current) => {
      const next = new Map(current);
      for (const id of removed) next.set(id, 1);
      return next;
    });

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setFading((current) => {
          const next = new Map(current);
          for (const id of removed) {
            if (next.has(id)) next.set(id, 0);
          }
          return next;
        });
      });
    });

    const timer = window.setTimeout(() => {
      setFading((current) => {
        const next = new Map(current);
        for (const id of removed) next.delete(id);
        return next.size === current.size ? current : next;
      });
    }, durationMs);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
    // activeKey tracks membership changes without depending on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeIds via activeKey
  }, [activeKey, durationMs, reduceMotion]);

  return useMemo(() => fading, [fading]);
}
