import { useEffect, useState } from 'react';

export type PresencePhase = 'enter' | 'shown' | 'exit';

export type PresenceItem<T extends { id: string }> = T & { phase: PresencePhase };

const EXIT_MS = 180;

/**
 * Keeps items mounted briefly after removal so exit animations can play.
 */
export function usePresenceList<T extends { id: string }>(
  items: T[],
  exitMs = EXIT_MS,
): PresenceItem<T>[] {
  const [rendered, setRendered] = useState<PresenceItem<T>[]>(() =>
    items.map((item) => ({ ...item, phase: 'enter' as const })),
  );

  useEffect(() => {
    const nextIds = new Set(items.map((item) => item.id));
    const itemById = new Map(items.map((item) => [item.id, item]));

    setRendered((prev) => {
      const next: PresenceItem<T>[] = [];
      const kept = new Set<string>();

      for (const existing of prev) {
        const fresh = itemById.get(existing.id);
        if (fresh) {
          next.push({
            ...fresh,
            phase: existing.phase === 'exit' ? 'enter' : existing.phase === 'enter' ? 'shown' : 'shown',
          });
          kept.add(existing.id);
        } else if (existing.phase !== 'exit') {
          next.push({ ...existing, phase: 'exit' });
          kept.add(existing.id);
        } else {
          next.push(existing);
          kept.add(existing.id);
        }
      }

      for (const item of items) {
        if (!kept.has(item.id)) {
          next.push({ ...item, phase: 'enter' });
        }
      }

      const order = new Map(items.map((item, index) => [item.id, index]));
      next.sort((a, b) => {
        const ai = order.get(a.id);
        const bi = order.get(b.id);
        if (ai != null && bi != null) return ai - bi;
        if (ai != null) return -1;
        if (bi != null) return 1;
        return 0;
      });

      return next;
    });
  }, [items]);

  useEffect(() => {
    const exiting = rendered.filter((item) => item.phase === 'exit');
    if (exiting.length === 0) return;

    const timers = exiting.map((item) =>
      window.setTimeout(() => {
        setRendered((prev) => prev.filter((row) => row.id !== item.id));
      }, exitMs),
    );

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [rendered, exitMs]);

  return rendered;
}
