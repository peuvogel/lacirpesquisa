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

function sampleDataset(): SessionDataset {
  let table = createTableDocument(
    ['valor', 'grupo'],
    [['1', 'A'], ['2', 'B']],
    'colado',
    () => 'provider-table',
  );
  table = setTableRoleBinding(table, 'mann-whitney', 'desfecho', 'provider-table-col-1');
  table = setTableRoleBinding(table, 'mann-whitney', 'grupo', 'provider-table-col-2');
  return {
    headers: ['valor', 'grupo'],
    rows: [['1', 'A'], ['2', 'B']],
    sourceLabel: 'colado',
    confirmedAt: 100,
    table,
  };
}

function renderSession(storage: SessionStorageAdapter) {
  return renderHook(() => useSession(), {
    wrapper: ({ children }) => <SessionProvider storage={storage}>{children}</SessionProvider>,
  });
}

function deferredWriteStorage(base: SessionStorageAdapter) {
  let releaseWrite!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const storage: SessionStorageAdapter = {
    read: () => base.read(),
    clear: () => base.clear(),
    write: async (snapshot: SessionSnapshot) => {
      await gate;
      await base.write(snapshot);
    },
  };
  return { storage, releaseWrite };
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

  it('clears after an in-flight write and automatically persists later edits', async () => {
    const base = createStorage();
    const delayed = deferredWriteStorage(base);
    const { result } = renderSession(delayed.storage);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    act(() => result.current.setDataset(sampleDataset()));
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saving'));

    act(() => result.current.clearSession());
    delayed.releaseWrite();

    await waitFor(() => expect(result.current.dataset).toBeNull());
    await waitFor(async () => expect(await base.read()).toBeNull());

    act(() => result.current.setDataset(sampleDataset()));
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect((await base.read())?.dataset).not.toBeNull();
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
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.persistenceError).toMatch(/armazenamento|salvar/i);
  });

  it('clears an invalid snapshot, starts empty, and persists later edits automatically', async () => {
    const base = createStorage();
    let clearCalls = 0;
    const invalidSnapshot: SessionStorageAdapter = {
      read: async () => {
        throw new SessionSnapshotValidationError();
      },
      write: (snapshot) => base.write(snapshot),
      clear: async () => {
        clearCalls += 1;
        await base.clear();
      },
    };
    const { result } = renderSession(invalidSnapshot);

    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    expect(clearCalls).toBe(1);
    expect(result.current.dataset).toBeNull();
    expect(result.current.persistenceStatus).toBe('saved');

    act(() => result.current.setDataset(sampleDataset()));
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
    expect((await base.read())?.dataset?.table?.id).toBe('provider-table');
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
    expect(result.current.persistenceStatus).toBe('error');
    act(() => result.current.setDataset(sampleDataset()));
    expect(result.current.dataset?.rows).toEqual([['1', 'A'], ['2', 'B']]);
    expect(result.current.persistenceStatus).toBe('error');
  });
});
