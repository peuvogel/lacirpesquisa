import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SESSION_RECORD_KEY,
  SESSION_STORE_NAME,
  SessionSnapshotValidationError,
  createIndexedDbSessionStorage,
  type SessionSnapshot,
} from './sessionStorage';
import { createTableDocument, setTableRoleBinding } from '@/shared/data-input/tableDocument';
import type { TabularImportSummary } from '@/shared/data-input/importDiagnostics';

const databaseNames: string[] = [];

function nextDatabaseName(): string {
  const name = `lacirstat-session-test-${databaseNames.length + 1}-${Date.now()}`;
  databaseNames.push(name);
  return name;
}

function sampleSnapshot(): SessionSnapshot {
  const importSummary: TabularImportSummary = {
    sourceType: 'file', fileName: 'dados.xlsx', tableName: 'Dados', sheetNames: ['Dados', 'Notas'],
    formatLabel: 'XLSX', delimiter: '', rowCount: 2, columnCount: 2, headerRowNumber: 1,
    recognitionMode: 'aliases', recognitionDetails: ['Desfecho reconhecido'],
    diagnostics: [{ code: 'short_rows', severity: 'warning', message: 'Linha incompleta.', rowNumbers: [2] }],
    importWarnings: [{ code: 'unusable-cell', message: 'Célula indisponível.', cellReference: 'B3', rowNumber: 3, columnIndex: 1 }],
  };
  let table = createTableDocument(
    ['desfecho', 'grupo'],
    [['10', 'A'], ['12', 'B']],
    'colado',
    () => 'stable-table',
    importSummary,
  );
  table = setTableRoleBinding(table, 'mann-whitney', 'desfecho', 'stable-table-col-1');
  table = setTableRoleBinding(table, 'mann-whitney', 'grupo', 'stable-table-col-2');
  return {
    version: 1,
    savedAt: 123,
    dataset: {
      headers: ['desfecho', 'grupo'],
      rows: [['10', 'A'], ['12', 'B']],
      sourceLabel: 'colado',
      confirmedAt: 100,
      table,
    },
    visualPreferences: { 'mann-whitney:rank': { height: 520 } },
  };
}

async function putRaw(dbName: string, value: unknown): Promise<void> {
  const request = indexedDB.open(dbName, 1);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SESSION_STORE_NAME)) {
        request.result.createObjectStore(SESSION_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
    transaction.objectStore(SESSION_STORE_NAME).put(value, SESSION_RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  })));
});

describe('IndexedDB session storage', () => {
  it('round-trips the versioned table, bindings and serializable visual preferences', async () => {
    const storage = createIndexedDbSessionStorage({ dbName: nextDatabaseName() });
    const snapshot = sampleSnapshot();

    await storage.write(snapshot);

    expect(await storage.read()).toEqual(snapshot);
  });

  it('accepts old snapshots without a summary and rejects malformed summary fields', async () => {
    const oldSnapshot = sampleSnapshot();
    if (!oldSnapshot.dataset?.table) throw new Error('O fixture exige uma tabela.');
    delete oldSnapshot.dataset.table.importSummary;
    const oldStorage = createIndexedDbSessionStorage({ dbName: nextDatabaseName() });
    await oldStorage.write(oldSnapshot);
    expect(await oldStorage.read()).toEqual(oldSnapshot);

    const invalidSnapshot = sampleSnapshot() as unknown as { dataset: { table: { importSummary: Record<string, unknown> } } };
    invalidSnapshot.dataset.table.importSummary = {
      ...invalidSnapshot.dataset.table.importSummary,
      unexpected: true,
    };
    const dbName = nextDatabaseName();
    await putRaw(dbName, invalidSnapshot);
    await expect(createIndexedDbSessionStorage({ dbName }).read()).rejects.toBeInstanceOf(SessionSnapshotValidationError);
  });

  it('clears the single persisted session record', async () => {
    const storage = createIndexedDbSessionStorage({ dbName: nextDatabaseName() });
    await storage.write(sampleSnapshot());

    await storage.clear();

    expect(await storage.read()).toBeNull();
  });

  it.each([
    { version: 2, savedAt: 1, dataset: null, visualPreferences: {} },
    { version: 1, savedAt: 1, dataset: { headers: [], rows: [[42]] }, visualPreferences: {} },
    { version: 1, savedAt: 1, dataset: null, visualPreferences: { chart: undefined } },
  ])('rejects unsupported or corrupt snapshots instead of partially restoring them', async (raw) => {
    const dbName = nextDatabaseName();
    const storage = createIndexedDbSessionStorage({ dbName });
    await putRaw(dbName, raw);

    await expect(storage.read()).rejects.toBeInstanceOf(SessionSnapshotValidationError);
  });
});
