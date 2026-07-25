import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLeaveWarning } from './useLeaveWarning';

const activeBeforeUnloadListeners = new Set<EventListener>();

function countBeforeUnloadListeners(): number {
  return activeBeforeUnloadListeners.size;
}

function getBeforeUnloadListeners(): EventListener[] {
  return [...activeBeforeUnloadListeners];
}

describe('useLeaveWarning', () => {
  beforeEach(() => {
    activeBeforeUnloadListeners.clear();
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'beforeunload' && typeof listener === 'function') {
        activeBeforeUnloadListeners.add(listener);
      }
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'beforeunload' && typeof listener === 'function') {
        activeBeforeUnloadListeners.delete(listener);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches nothing when hasData is false on mount', () => {
    renderHook(() => useLeaveWarning(false));
    expect(countBeforeUnloadListeners()).toBe(0);
  });

  it('attaches exactly one listener when hasData is true on mount', () => {
    renderHook(() => useLeaveWarning(true));
    expect(countBeforeUnloadListeners()).toBe(1);
  });

  it('removes the listener when hasData goes true → false', () => {
    const { rerender } = renderHook(({ hasData }) => useLeaveWarning(hasData), {
      initialProps: { hasData: true },
    });
    expect(countBeforeUnloadListeners()).toBe(1);

    rerender({ hasData: false });
    expect(countBeforeUnloadListeners()).toBe(0);
    expect(window.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('attaches the listener when hasData goes false → true', () => {
    const { rerender } = renderHook(({ hasData }) => useLeaveWarning(hasData), {
      initialProps: { hasData: false },
    });
    expect(countBeforeUnloadListeners()).toBe(0);

    rerender({ hasData: true });
    expect(countBeforeUnloadListeners()).toBe(1);
  });

  it('removes the listener on unmount while hasData is true', () => {
    const { unmount } = renderHook(() => useLeaveWarning(true));
    expect(countBeforeUnloadListeners()).toBe(1);

    unmount();
    expect(countBeforeUnloadListeners()).toBe(0);
  });

  it('calls preventDefault and sets returnValue on beforeunload while hasData is true', () => {
    renderHook(() => useLeaveWarning(true));
    const [listener] = getBeforeUnloadListeners();
    expect(listener).toBeDefined();

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', { writable: true, value: undefined });

    listener!(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe('');
  });

  it('never exceeds one beforeunload listener across several rerenders', () => {
    const { rerender } = renderHook(({ hasData }) => useLeaveWarning(hasData), {
      initialProps: { hasData: false },
    });

    rerender({ hasData: true });
    rerender({ hasData: true });
    rerender({ hasData: false });
    rerender({ hasData: true });
    rerender({ hasData: false });
    rerender({ hasData: true });

    expect(countBeforeUnloadListeners()).toBe(1);
  });
});
