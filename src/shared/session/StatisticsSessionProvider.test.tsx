import 'fake-indexeddb/auto';
import { useEffect } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot, SessionStorageAdapter } from './sessionStorage';
import {
  StatisticsSessionProvider,
  useStatisticsSession,
  type SessionDataset,
} from './StatisticsSessionProvider';

function dataset(sourceLabel = 'atual.csv'): SessionDataset {
  return {
    headers: ['valor'],
    rows: [['1']],
    sourceLabel,
    confirmedAt: 10,
  };
}

function memoryStorage(initial: SessionSnapshot | null = null): SessionStorageAdapter {
  let snapshot = initial;
  return {
    read: async () => snapshot,
    write: async (next) => {
      snapshot = structuredClone(next);
    },
    clear: async () => {
      snapshot = null;
    },
  };
}

function renderStatisticsSession(storage?: SessionStorageAdapter) {
  return renderHook(() => useStatisticsSession(), {
    wrapper: ({ children }) => (
      <StatisticsSessionProvider storage={storage}>{children}</StatisticsSessionProvider>
    ),
  });
}

function deferredHydrationStorage() {
  let resolveRead!: (snapshot: SessionSnapshot | null) => void;
  let resolveClear!: () => void;
  let rejectClear!: (error: unknown) => void;
  let clearCalls = 0;
  const readPromise = new Promise<SessionSnapshot | null>((resolve) => {
    resolveRead = resolve;
  });
  const clearPromise = new Promise<void>((resolve, reject) => {
    resolveClear = resolve;
    rejectClear = reject;
  });
  const storage: SessionStorageAdapter = {
    read: () => readPromise,
    write: async () => undefined,
    clear: () => {
      clearCalls += 1;
      return clearPromise;
    },
  };
  return {
    storage,
    readPromise,
    resolveRead,
    resolveClear,
    rejectClear,
    get clearCalls() {
      return clearCalls;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StatisticsSessionProvider', () => {
  it('exposes only the active statistics session slices', async () => {
    const { result } = renderStatisticsSession(memoryStorage());
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));

    expect(result.current).toMatchObject({
      dataset: null,
      datasusSession: null,
      testSlots: {},
      persistenceMode: 'persistent',
    });
    expect(result.current).not.toHaveProperty('mapSelection');
    expect(result.current).not.toHaveProperty('researchDesign');
    expect(result.current).not.toHaveProperty('guidedAnalysis');
  });

  it('does not let delayed hydration overwrite test settings changed in the current session', async () => {
    let finishRead!: (snapshot: SessionSnapshot) => void;
    const storage = memoryStorage();
    storage.read = () => new Promise((resolve) => {
      finishRead = (snapshot) => resolve(snapshot);
    });
    const { result } = renderStatisticsSession(storage);

    act(() => result.current.setDataset(dataset()));
    act(() => result.current.setTestSlotMeta('t-student', { settings: { alpha: 0.1 } }));
    finishRead({
      version: 1,
      savedAt: 1,
      dataset: null,
      visualPreferences: {},
      testSlots: {
        't-student': {
          dataset: dataset('antigo.csv'),
          settings: { alpha: 0.01 },
        },
      },
    });

    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    expect(result.current.testSlots['t-student']?.settings?.alpha).toBe(0.1);
  });

  it.each([
    ['normal mount', false],
    ['StrictMode replay', true],
  ])('rejects stale hydration after a child clears during %s', async (_label, reactStrictMode) => {
    const staleSnapshot: SessionSnapshot = {
      version: 1,
      savedAt: 1,
      dataset: dataset('snapshot-excluido.csv'),
      visualPreferences: { chart: 'antigo' },
    };
    let storedSnapshot: SessionSnapshot | null = staleSnapshot;
    let resolveRead!: (snapshot: SessionSnapshot | null) => void;
    let clearCalls = 0;
    const readPromise = new Promise<SessionSnapshot | null>((resolve) => {
      resolveRead = resolve;
    });
    const storage: SessionStorageAdapter = {
      read: () => readPromise,
      write: async (snapshot) => {
        storedSnapshot = structuredClone(snapshot);
      },
      clear: async () => {
        clearCalls += 1;
        storedSnapshot = null;
      },
    };
    const { result } = renderHook(() => {
      const session = useStatisticsSession();
      useEffect(() => {
        session.clearSession();
      }, [session.clearSession]);
      return session;
    }, {
      reactStrictMode,
      wrapper: ({ children }) => (
        <StatisticsSessionProvider storage={storage}>{children}</StatisticsSessionProvider>
      ),
    });

    await waitFor(() => expect(clearCalls).toBeGreaterThanOrEqual(1));
    await waitFor(() => expect(result.current).toMatchObject({
      dataset: null,
      persistenceReady: true,
      persistenceMode: 'persistent',
      persistenceStatus: 'saved',
      persistenceError: null,
    }));
    expect(storedSnapshot).toBeNull();

    await act(async () => {
      resolveRead(staleSnapshot);
      await readPromise;
    });

    expect(result.current).toMatchObject({
      dataset: null,
      visualPreferences: {},
      persistenceReady: true,
      persistenceMode: 'persistent',
      persistenceStatus: 'saved',
      persistenceError: null,
    });
    expect(storedSnapshot).toBeNull();
  });

  it('finishes a successful clear before hydration and ignores the stale read result', async () => {
    const deferred = deferredHydrationStorage();
    const { result } = renderStatisticsSession(deferred.storage);

    act(() => result.current.clearSession());
    await waitFor(() => expect(deferred.clearCalls).toBe(1));
    act(() => deferred.resolveClear());

    await waitFor(() => expect(result.current).toMatchObject({
      persistenceReady: true,
      persistenceMode: 'persistent',
      persistenceStatus: 'saved',
      persistenceError: null,
    }));
    await act(async () => {
      deferred.resolveRead({
        version: 1,
        savedAt: 1,
        dataset: dataset('snapshot-antigo.csv'),
        visualPreferences: { chart: 'antigo' },
      });
      await deferred.readPromise;
    });

    expect(result.current).toMatchObject({
      dataset: null,
      visualPreferences: {},
      persistenceMode: 'persistent',
      persistenceStatus: 'saved',
      persistenceError: null,
    });
  });

  it('keeps a failed pre-hydration clear in ready memory error after the stale read resolves', async () => {
    const deferred = deferredHydrationStorage();
    const { result } = renderStatisticsSession(deferred.storage);

    act(() => result.current.clearSession());
    await waitFor(() => expect(deferred.clearCalls).toBe(1));
    act(() => deferred.rejectClear(new Error('clear failed')));

    await waitFor(() => expect(result.current).toMatchObject({
      persistenceReady: true,
      persistenceMode: 'memory',
      persistenceStatus: 'error',
    }));
    const error = result.current.persistenceError;
    await act(async () => {
      deferred.resolveRead({
        version: 1,
        savedAt: 1,
        dataset: dataset('snapshot-antigo.csv'),
        visualPreferences: { chart: 'antigo' },
      });
      await deferred.readPromise;
    });

    expect(result.current).toMatchObject({
      dataset: null,
      visualPreferences: {},
      persistenceMode: 'memory',
      persistenceStatus: 'error',
      persistenceError: error,
    });
  });

  it('falls back to memory mode when IndexedDB is absent', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const { result } = renderStatisticsSession();

    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    expect(result.current.persistenceMode).toBe('memory');
    expect(result.current.persistenceStatus).toBe('error');

    act(() => result.current.setDataset(dataset()));
    expect(result.current.dataset?.sourceLabel).toBe('atual.csv');
    expect(result.current.persistenceStatus).toBe('error');
  });

  it('throws a descriptive error outside the provider', () => {
    expect(() => renderHook(() => useStatisticsSession())).toThrow(
      'useStatisticsSession must be used within a StatisticsSessionProvider',
    );
  });
});
