import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFadingSelection } from './useFadingSelection';

describe('useFadingSelection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps removed ids while opacity animates to 0', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useFadingSelection(ids, { durationMs: 400 }),
      { initialProps: { ids: ['BA', 'SP'] } },
    );

    expect(result.current.size).toBe(0);

    rerender({ ids: ['SP'] });
    expect(result.current.get('BA')).toBe(1);

    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(result.current.get('BA')).toBe(0);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.has('BA')).toBe(false);
  });

  it('skips fade when reduceMotion is set', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useFadingSelection(ids, { durationMs: 400, reduceMotion: true }),
      { initialProps: { ids: ['BA'] } },
    );

    rerender({ ids: [] });
    expect(result.current.size).toBe(0);
  });
});
