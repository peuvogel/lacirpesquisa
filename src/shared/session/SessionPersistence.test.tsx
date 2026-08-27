import 'fake-indexeddb/auto';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createTableDocument, setTableRoleBinding } from '@/shared/data-input/tableDocument';
import { SessionPersistenceControl } from './SessionPersistenceControl';
import { SessionProvider, useSession, type SessionDataset } from './SessionProvider';
import {
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
  it('keeps memory-only data out of IndexedDB while opt-in is off', async () => {
    const storage = createStorage();
    const { result } = renderSession(storage);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));

    act(() => result.current.setDataset(sampleDataset()));

    await waitFor(() => expect(result.current.dataset).not.toBeNull());
    expect(await storage.read()).toBeNull();
    expect(result.current.persistenceStatus).toBe('off');
  });

  it('restores stable IDs and a non-default test binding after opt-in', async () => {
    const storage = createStorage();
    const first = renderSession(storage);
    await waitFor(() => expect(first.result.current.persistenceReady).toBe(true));
    act(() => {
      first.result.current.setDataset(sampleDataset());
      first.result.current.setVisualPreferences({ 'mann-whitney:rank': { height: 520 } });
      first.result.current.setPersistenceEnabled(true);
    });
    await waitFor(() => expect(first.result.current.persistenceStatus).toBe('saved'));
    first.unmount();

    const restored = renderSession(storage);
    await waitFor(() => expect(restored.result.current.persistenceStatus).toBe('saved'));

    expect(restored.result.current.persistenceEnabled).toBe(true);
    expect(restored.result.current.dataset?.table?.id).toBe('provider-table');
    expect(restored.result.current.dataset?.table?.bindings['mann-whitney']).toEqual({
      desfecho: 'provider-table-col-1',
      grupo: 'provider-table-col-2',
    });
    expect(restored.result.current.visualPreferences).toEqual({
      'mann-whitney:rank': { height: 520 },
    });
  });

  it('serializes clear after an in-flight write so stale data cannot return', async () => {
    const base = createStorage();
    const delayed = deferredWriteStorage(base);
    const { result } = renderSession(delayed.storage);
    await waitFor(() => expect(result.current.persistenceReady).toBe(true));
    act(() => {
      result.current.setDataset(sampleDataset());
      result.current.setPersistenceEnabled(true);
    });
    await waitFor(() => expect(result.current.persistenceStatus).toBe('saving'));

    act(() => result.current.clearSession());
    delayed.releaseWrite();

    await waitFor(() => expect(result.current.persistenceStatus).toBe('off'));
    expect(result.current.dataset).toBeNull();
    expect(await base.read()).toBeNull();
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
    act(() => {
      result.current.setDataset(sampleDataset());
      result.current.setPersistenceEnabled(true);
    });

    await waitFor(() => expect(result.current.persistenceStatus).toBe('error'));
    expect(result.current.dataset?.rows).toEqual([['1', 'A'], ['2', 'B']]);
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.persistenceError).toMatch(/armazenamento|salvar/i);
  });

  it('ignores a failed restore and exposes a recoverable error', async () => {
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
    expect(result.current.persistenceEnabled).toBe(false);
  });
});

describe('SessionPersistenceControl', () => {
  it('shows privacy copy and only reports saved after the write completes', async () => {
    const base = createStorage();
    const delayed = deferredWriteStorage(base);
    const user = userEvent.setup();
    render(
      <SessionProvider storage={delayed.storage}>
        <SessionPersistenceControl />
      </SessionProvider>,
    );
    const checkbox = await screen.findByRole('checkbox', { name: 'Lembrar neste dispositivo' });
    await waitFor(() => expect(checkbox).toBeEnabled());

    expect(screen.getByText(/outra pessoa que use este navegador/i)).toBeInTheDocument();
    await user.click(checkbox);

    expect(screen.getByText('Salvando neste dispositivo…')).toBeInTheDocument();
    expect(screen.queryByText('Salvo neste dispositivo')).not.toBeInTheDocument();
    delayed.releaseWrite();
    expect(await screen.findByText('Salvo neste dispositivo')).toBeInTheDocument();
  });
});
