import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createTableDocument, setTableRoleBinding } from '@/shared/data-input/tableDocument';
import { SessionProvider, useSession, type SessionDataset } from './SessionProvider';
import {
  SessionSnapshotValidationError,
  createIndexedDbSessionStorage,
  type SessionSnapshot,
  type SessionStorageAdapter,
} from './sessionStorage';

const databaseNames: string[] = [];

function createStorage(): SessionStorageAdapter {
  const dbName = `lacirstat-provider-test-${databaseNames.length + 1}-${Date.now()}`;
  databaseNames.push(dbName);
  return createIndexedDbSessionStorage({ dbName });
}

function sampleDataset(
  tableId = 'provider-table',
  sourceLabel = 'colado',
): SessionDataset {
  let table = createTableDocument(
    ['valor', 'grupo'],
    [['1', 'A'], ['2', 'B']],
    sourceLabel,
    () => tableId,
  );
  table = setTableRoleBinding(table, 'mann-whitney', 'desfecho', `${tableId}-col-1`);
  table = setTableRoleBinding(table, 'mann-whitney', 'grupo', `${tableId}-col-2`);
  return {
    headers: ['valor', 'grupo'],
    rows: [['1', 'A'], ['2', 'B']],
    sourceLabel,
    confirmedAt: 100,
    table,
  };
}

function renderSession(storage: SessionStorageAdapter) {
  return renderHook(() => useSession(), {
    wrapper: ({ children }) => <SessionProvider storage={storage}>{children}</SessionProvider>,
  });
}

function deferredWritesStorage(base: SessionStorageAdapter) {
  const pendingWrites: Array<{
    snapshot: SessionSnapshot;
    release(): Promise<void>;
    reject(error: unknown): void;
  }> = [];
  let clearCalls = 0;
  const storage: SessionStorageAdapter = {
    read: () => base.read(),
    clear: async () => {
      clearCalls += 1;
      await base.clear();
    },
    write: (snapshot: SessionSnapshot) => new Promise<void>((resolve, reject) => {
      pendingWrites.push({
        snapshot,
        release: async () => {
          try {
            await base.write(snapshot);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        reject,
      });
    }),
  };
  return {
    storage,
    get clearCalls() {
      return clearCalls;
    },
    pendingWrites,
  };
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  })));
});

describe('SessionProvider persistence', () => {
  it('persists a new session automatically after restoration is ready', async () => {
    const storage = createStorage();
    const { result } = renderSession(storage);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));

    act(() => result.current.setDataset(sampleDataset()));

    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect((await storage.read())?.dataset?.table?.id).toBe('provider-table');
  });

  it('restores stable IDs, bindings, and visual preferences without opt-in', async () => {
    const storage = createStorage();
    const first = renderSession(storage);
    await waitFor(() => expect(first.result.current.persistenceReady).toBe(true));
    act(() => {
      first.result.current.setDataset(sampleDataset());
      first.result.current.setVisualPreferences({ 'mann-whitney:rank': { height: 520 } });
    });
    await waitFor(() => expect(first.result.current.persistenceStatus).toBe('saved'));
    first.unmount();

    const restored = renderSession(storage);
    await waitFor(() => expect(restored.result.current.persistenceStatus).toBe('saved'));

    expect(restored.result.current.dataset?.table?.bindings['mann-whitney']).toEqual({
      desfecho: 'provider-table-col-1',
      grupo: 'provider-table-col-2',
    });
    expect(restored.result.current.visualPreferences).toEqual({
      'mann-whitney:rank': { height: 520 },
    });
  });

  it('persists an isolated testSlots settings change and restores alpha 0.1', async () => {
    const storage = createStorage();
    const first = renderSession(storage);
    await waitFor(() => expect(first.result.current.persistenceReady).toBe(true));
    act(() => first.result.current.setDataset(sampleDataset()));
    await waitFor(() => expect(first.result.current.persistenceStatus).toBe('saved'));

    act(() => first.result.current.setTestSlotMeta('t-student', { settings: { alpha: 0.1 } }));

    expect(first.result.current.hasUnsavedChanges).toBe(true);
    await waitFor(() => expect(first.result.current.persistenceStatus).toBe('saved'));
    first.unmount();

    const restored = renderSession(storage);
    await waitFor(() => expect(restored.result.current.persistenceReady).toBe(true));
    expect(restored.result.current.testSlots['t-student']?.settings?.alpha).toBe(0.1);
  });

  it('serializes two deferred writes around clear and leaves only the newest generation readable', async () => {
    const base = createStorage();
    const delayed = deferredWritesStorage(base);
    const { result } = renderSession(delayed.storage);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    act(() => result.current.setDataset(sampleDataset()));
    await waitFor(() => expect(delayed.pendingWrites).toHaveLength(1));

    act(() => {
      result.current.clearSession();
      result.current.setDataset(sampleDataset('provider-table-newest', 'dados-novos.csv'));
    });
    await delayed.pendingWrites.shift()!.release();

    await waitFor(() => expect(delayed.clearCalls).toBe(1));
    await waitFor(() => expect(delayed.pendingWrites).toHaveLength(1));
    expect(await base.read()).toBeNull();
    expect(delayed.pendingWrites[0]!.snapshot.dataset?.table?.id).toBe('provider-table-newest');

    await delayed.pendingWrites.shift()!.release();
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect((await base.read())?.dataset?.table?.id).toBe('provider-table-newest');
  });

  it('lets a newer same-generation write succeed after an obsolete write rejects', async () => {
    const base = createStorage();
    const delayed = deferredWritesStorage(base);
    const { result } = renderSession(delayed.storage);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    act(() => result.current.setDataset(sampleDataset('provider-table-a', 'a.csv')));
    await waitFor(() => expect(delayed.pendingWrites).toHaveLength(1));

    act(() => result.current.setDataset(sampleDataset('provider-table-b', 'b.csv')));
    delayed.pendingWrites.shift()!.reject(new Error('write A failed'));

    await waitFor(() => expect(delayed.pendingWrites).toHaveLength(1));
    expect(delayed.pendingWrites[0]!.snapshot.dataset?.table?.id).toBe('provider-table-b');
    await delayed.pendingWrites.shift()!.release();

    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect(result.current.persistenceMode).toBe('persistent');
    expect((await base.read())?.dataset?.table?.id).toBe('provider-table-b');
  });

  it('serializes invalid-snapshot cleanup before clearing and saving a newer generation', async () => {
    let snapshot: SessionSnapshot | null = null;
    let clearCalls = 0;
    let writeCalls = 0;
    let releaseRecoveryClear!: () => void;
    const recoveryClearGate = new Promise<void>((resolve) => {
      releaseRecoveryClear = resolve;
    });
    const storage: SessionStorageAdapter = {
      read: async () => {
        throw new SessionSnapshotValidationError();
      },
      clear: async () => {
        clearCalls += 1;
        if (clearCalls === 1) await recoveryClearGate;
        snapshot = null;
      },
      write: async (next) => {
        writeCalls += 1;
        snapshot = structuredClone(next);
      },
    };
    const { result } = renderSession(storage);
    await waitFor(() => expect(clearCalls).toBe(1));

    await act(async () => {
      result.current.clearSession();
      result.current.setDataset(
        sampleDataset('provider-table-after-recovery', 'recuperado.csv'),
      );
      await Promise.resolve();
    });
    expect(clearCalls).toBe(1);
    expect(writeCalls).toBe(0);

    await act(async () => {
      releaseRecoveryClear();
      await recoveryClearGate;
    });

    await waitFor(() => expect(clearCalls).toBe(2));
    await waitFor(() => expect(snapshot?.dataset?.table?.id).toBe('provider-table-after-recovery'));
    expect(writeCalls).toBe(1);
    expect(result.current.persistenceStatus).toBe('saved');
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('saves an edit made while a clear is re-enabling persistence', async () => {
    let snapshot: SessionSnapshot | null = null;
    let writeCalls = 0;
    let clearCalls = 0;
    let releaseClear!: () => void;
    const clearGate = new Promise<void>((resolve) => {
      releaseClear = resolve;
    });
    const storage: SessionStorageAdapter = {
      read: async () => null,
      write: async (next) => {
        writeCalls += 1;
        if (writeCalls === 1) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        snapshot = structuredClone(next);
      },
      clear: async () => {
        clearCalls += 1;
        await clearGate;
        snapshot = null;
      },
    };
    const { result } = renderSession(storage);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    act(() => result.current.setDataset(sampleDataset('provider-table-failed', 'falhou.csv')));
    await waitFor(() => expect(result.current.persistenceMode).toBe('memory'));

    act(() => {
      result.current.clearSession();
      result.current.setDataset(sampleDataset('provider-table-reenabled', 'reabilitado.csv'));
    });
    await waitFor(() => expect(clearCalls).toBe(1));
    act(() => releaseClear());

    await waitFor(() => expect(snapshot?.dataset?.table?.id).toBe('provider-table-reenabled'));
    await waitFor(() => expect(result.current.hasUnsavedChanges).toBe(false));
    expect(writeCalls).toBe(2);
    expect(result.current.persistenceMode).toBe('persistent');
    expect(result.current.persistenceStatus).toBe('saved');
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('keeps the in-memory dataset usable and reports unsaved after a quota failure', async () => {
    const base = createStorage();
    const failing: SessionStorageAdapter = {
      read: () => base.read(),
      clear: () => base.clear(),
      write: async () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
    };
    const { result } = renderSession(failing);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    act(() => result.current.setDataset(sampleDataset()));

    await waitFor(() => expect(result.current.persistenceStatus).toBe('error'));
    expect(result.current.dataset?.rows).toEqual([['1', 'A'], ['2', 'B']]);
    expect(result.current.persistenceMode).toBe('memory');
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.persistenceError).toMatch(/armazenamento|salvar/i);
  });

  it('warns after removing an invalid snapshot until a later edit saves successfully', async () => {
    const base = createStorage();
    let clearCalls = 0;
    let writeCalls = 0;
    let releaseWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const invalidSnapshot: SessionStorageAdapter = {
      read: async () => {
        throw new SessionSnapshotValidationError();
      },
      write: async (snapshot) => {
        writeCalls += 1;
        await writeGate;
        await base.write(snapshot);
      },
      clear: async () => {
        clearCalls += 1;
        await base.clear();
      },
    };
    const { result } = renderSession(invalidSnapshot);

    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    expect(clearCalls).toBe(1);
    expect(result.current.dataset).toBeNull();
    expect(result.current.persistenceMode).toBe('persistent');
    expect(result.current.persistenceStatus).toBe('error');
    expect(result.current.persistenceError).toMatch(/incompatível|corrompida/i);
    expect(writeCalls).toBe(0);
    expect(await base.read()).toBeNull();

    act(() => result.current.setDataset(sampleDataset()));
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saving'));
    expect(result.current.persistenceError).toMatch(/incompatível|corrompida/i);
    releaseWrite();
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect(result.current.persistenceError).toBeNull();
    expect(writeCalls).toBe(1);
    expect((await base.read())?.dataset?.table?.id).toBe('provider-table');
  });

  it('keeps the invalid-snapshot warning while a pre-hydration edit is being saved', async () => {
    const base = createStorage();
    let rejectRead!: (error: unknown) => void;
    let releaseWrite!: () => void;
    const read = new Promise<SessionSnapshot | null>((_resolve, reject) => {
      rejectRead = reject;
    });
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const storage: SessionStorageAdapter = {
      read: () => read,
      clear: () => base.clear(),
      write: async (snapshot) => {
        await writeGate;
        await base.write(snapshot);
      },
    };
    const { result } = renderSession(storage);
    act(() => result.current.setDataset(sampleDataset()));
    act(() => rejectRead(new SessionSnapshotValidationError()));

    await waitFor(() => expect(result.current.persistenceStatus).toBe('saving'));
    expect(result.current.persistenceError).toMatch(/incompatível|corrompida/i);
    releaseWrite();

    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect(result.current.persistenceError).toBeNull();
    expect((await base.read())?.dataset?.table?.id).toBe('provider-table');
  });

  it('keeps the invalid-snapshot warning through clear until a real write succeeds', async () => {
    const base = createStorage();
    let clearCalls = 0;
    let releaseExplicitClear!: () => void;
    const explicitClearGate = new Promise<void>((resolve) => {
      releaseExplicitClear = resolve;
    });
    const storage: SessionStorageAdapter = {
      read: async () => {
        throw new SessionSnapshotValidationError();
      },
      write: (snapshot) => base.write(snapshot),
      clear: async () => {
        clearCalls += 1;
        if (clearCalls === 2) await explicitClearGate;
        await base.clear();
      },
    };
    const { result } = renderSession(storage);
    await waitFor(() => expect(result.current.persistenceStatus).toBe('error'));
    const corruptionWarning = result.current.persistenceError;
    expect(corruptionWarning).toMatch(/incompatível|corrompida/i);

    act(() => result.current.clearSession());
    await waitFor(() => expect(clearCalls).toBe(2));
    expect(result.current.persistenceStatus).toBe('saving');
    expect(result.current.persistenceError).toBe(corruptionWarning);
    act(() => releaseExplicitClear());

    await waitFor(() => expect(result.current.persistenceStatus).toBe('error'));
    expect(result.current.persistenceMode).toBe('persistent');
    expect(result.current.persistenceError).toBe(corruptionWarning);

    act(() => result.current.setDataset(sampleDataset('provider-table-recovered', 'novo.csv')));
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect(result.current.persistenceError).toBeNull();
    expect((await base.read())?.dataset?.table?.id).toBe('provider-table-recovered');
  });

  it('degrades to memory when clearing an invalid snapshot fails', async () => {
    const base = createStorage();
    let clearCalls = 0;
    const failingInvalidSnapshot: SessionStorageAdapter = {
      read: async () => {
        throw new SessionSnapshotValidationError();
      },
      write: (snapshot) => base.write(snapshot),
      clear: async () => {
        clearCalls += 1;
        throw new Error('clear failed');
      },
    };
    const { result } = renderSession(failingInvalidSnapshot);

    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    expect(clearCalls).toBe(1);
    expect(result.current.dataset).toBeNull();
    expect(result.current.persistenceMode).toBe('memory');
    expect(result.current.persistenceStatus).toBe('error');
    expect(result.current.persistenceError).toMatch(/remover a sessao salva|remover a sessão salva/i);

    act(() => result.current.setDataset(sampleDataset()));
    expect(result.current.dataset?.rows).toEqual([['1', 'A'], ['2', 'B']]);
    expect(result.current.persistenceStatus).toBe('error');
    expect(await base.read()).toBeNull();
  });

  it('continues analysis in memory when IndexedDB access fails', async () => {
    const base = createStorage();
    const failing: SessionStorageAdapter = {
      read: async () => {
        throw new Error('snapshot incompatible');
      },
      write: (snapshot) => base.write(snapshot),
      clear: () => base.clear(),
    };
    const { result } = renderSession(failing);

    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    expect(result.current.dataset).toBeNull();
    expect(result.current.persistenceMode).toBe('memory');
    expect(result.current.persistenceStatus).toBe('error');
    act(() => result.current.setDataset(sampleDataset()));
    expect(result.current.dataset?.rows).toEqual([['1', 'A'], ['2', 'B']]);
    expect(result.current.persistenceStatus).toBe('error');
  });
});
