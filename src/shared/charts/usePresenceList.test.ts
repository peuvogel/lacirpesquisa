import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresenceList } from './usePresenceList';

describe('usePresenceList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks removed items as exit then drops them after exitMs', () => {
    const { result, rerender } = renderHook(
      ({ items }) => usePresenceList(items, 180),
      { initialProps: { items: [{ id: 'a' }, { id: 'b' }] } },
    );

    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);

    rerender({ items: [{ id: 'a' }] });

    expect(result.current.find((item) => item.id === 'b')?.phase).toBe('exit');
    expect(result.current).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(result.current.map((item) => item.id)).toEqual(['a']);
  });

  it('adds new items with enter phase', () => {
    const { result, rerender } = renderHook(
      ({ items }) => usePresenceList(items, 180),
      { initialProps: { items: [{ id: 'a' }] } },
    );

    rerender({ items: [{ id: 'a' }, { id: 'c' }] });

    expect(result.current.find((item) => item.id === 'c')?.phase).toBe('enter');
  });
});
