import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SESSION_RECORD_KEY,
  SESSION_STORE_NAME,
  SessionSnapshotValidationError,
  createIndexedDbSessionStorage,
  parseSessionSnapshot,
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

type RawSnapshot = {
  dataset: { table: { importSummary: Record<string, unknown> } };
};

function rawSnapshot(): RawSnapshot {
  return structuredClone(sampleSnapshot()) as unknown as RawSnapshot;
}

function coherentDimensionSnapshot(dataRows: number, columnCount: number): RawSnapshot {
  const headers = Array.from({ length: columnCount }, (_, index) => `coluna-${index + 1}`);
  const rows = Array.from({ length: dataRows }, () => Array.from({ length: columnCount }, () => '1'));
  const importSummary: TabularImportSummary = {
    sourceType: 'file', fileName: 'limite.csv', tableName: 'Tabela', sheetNames: [], formatLabel: 'CSV', delimiter: ',',
    rowCount: dataRows, columnCount, headerRowNumber: 1, recognitionMode: 'aliases', recognitionDetails: [],
    diagnostics: [], importWarnings: [],
  };
  const table = createTableDocument(headers, rows, 'limite.csv', () => 'dimension-table', importSummary);
  return structuredClone({
    version: 1,
    savedAt: 123,
    dataset: { headers, rows, sourceLabel: 'limite.csv', confirmedAt: 100, table },
    visualPreferences: {},
  }) as unknown as RawSnapshot;
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

  it.each([
    ['NaN row count', (summary: Record<string, unknown>) => { summary.rowCount = Number.NaN; }],
    ['infinite column count', (summary: Record<string, unknown>) => { summary.columnCount = Infinity; }],
    ['negative row count', (summary: Record<string, unknown>) => { summary.rowCount = -1; }],
    ['negative header row', (summary: Record<string, unknown>) => { summary.headerRowNumber = -1; }],
    ['too many rows', (summary: Record<string, unknown>) => { summary.rowCount = 10_001; }],
    ['too many columns', (summary: Record<string, unknown>) => { summary.columnCount = 129; }],
    ['diagnostic row zero', (summary: Record<string, unknown>) => { (summary.diagnostics as Array<Record<string, unknown>>)[0]!.rowNumbers = [0]; }],
    ['diagnostic row above limit', (summary: Record<string, unknown>) => { (summary.diagnostics as Array<Record<string, unknown>>)[0]!.rowNumbers = [10_001]; }],
    ['warning row above limit', (summary: Record<string, unknown>) => { (summary.importWarnings as Array<Record<string, unknown>>)[0]!.rowNumber = 10_001; }],
    ['warning row zero', (summary: Record<string, unknown>) => { (summary.importWarnings as Array<Record<string, unknown>>)[0]!.rowNumber = 0; }],
    ['warning column outside the import', (summary: Record<string, unknown>) => { (summary.importWarnings as Array<Record<string, unknown>>)[0]!.columnIndex = 2; }],
    ['negative warning column', (summary: Record<string, unknown>) => { (summary.importWarnings as Array<Record<string, unknown>>)[0]!.columnIndex = -1; }],
    ['too many sheets', (summary: Record<string, unknown>) => { summary.sheetNames = Array.from({ length: 33 }, () => 'Dados'); }],
    ['too many recognition details', (summary: Record<string, unknown>) => { summary.recognitionDetails = Array.from({ length: 129 }, () => 'detalhe'); }],
    ['too many diagnostics', (summary: Record<string, unknown>) => { summary.diagnostics = new Array(10_001); }],
    ['too many cell warnings', (summary: Record<string, unknown>) => { summary.importWarnings = new Array(200_001); }],
    ['oversized summary string', (summary: Record<string, unknown>) => { summary.fileName = 'a'.repeat(10_001); }],
    ['oversized diagnostic message', (summary: Record<string, unknown>) => { (summary.diagnostics as Array<Record<string, unknown>>)[0]!.message = 'a'.repeat(10_001); }],
    ['oversized warning reference', (summary: Record<string, unknown>) => { (summary.importWarnings as Array<Record<string, unknown>>)[0]!.cellReference = 'a'.repeat(10_001); }],
    ['invalid source union', (summary: Record<string, unknown>) => { summary.sourceType = 'api'; }],
    ['invalid recognition union', (summary: Record<string, unknown>) => { summary.recognitionMode = 'manual'; }],
    ['invalid diagnostic code', (summary: Record<string, unknown>) => { (summary.diagnostics as Array<Record<string, unknown>>)[0]!.code = 'other'; }],
    ['invalid diagnostic severity', (summary: Record<string, unknown>) => { (summary.diagnostics as Array<Record<string, unknown>>)[0]!.severity = 'error'; }],
    ['invalid warning code', (summary: Record<string, unknown>) => { (summary.importWarnings as Array<Record<string, unknown>>)[0]!.code = 'other'; }],
    ['extra summary key', (summary: Record<string, unknown>) => { summary.unexpected = true; }],
    ['extra diagnostic key', (summary: Record<string, unknown>) => { (summary.diagnostics as Array<Record<string, unknown>>)[0]!.unexpected = true; }],
    ['extra warning key', (summary: Record<string, unknown>) => { (summary.importWarnings as Array<Record<string, unknown>>)[0]!.unexpected = true; }],
  ])('rejects a persisted import summary with %s', async (_label, mutate) => {
    const raw = rawSnapshot();
    mutate(raw.dataset.table.importSummary);
    const dbName = nextDatabaseName();
    await putRaw(dbName, raw);

    await expect(createIndexedDbSessionStorage({ dbName }).read()).rejects.toBeInstanceOf(SessionSnapshotValidationError);
  });

  it('accepts strict summary boundary values through the persisted snapshot entrypoint', async () => {
    const raw = rawSnapshot();
    const summary = raw.dataset.table.importSummary;
    summary.delimiter = '';
    summary.fileName = 'a'.repeat(10_000);
    summary.sheetNames = Array.from({ length: 32 }, () => 'Dados');
    summary.recognitionDetails = Array.from({ length: 128 }, () => 'detalhe');
    summary.rowCount = 10_000;
    summary.columnCount = 1;
    summary.headerRowNumber = 10_000;
    (summary.diagnostics as Array<Record<string, unknown>>)[0]!.rowNumbers = [10_000];
    (summary.importWarnings as Array<Record<string, unknown>>)[0]!.rowNumber = 10_000;
    (summary.importWarnings as Array<Record<string, unknown>>)[0]!.columnIndex = 0;
    const dbName = nextDatabaseName();
    await putRaw(dbName, raw);
    await expect(createIndexedDbSessionStorage({ dbName }).read()).resolves.toEqual(raw);
  });

  it('accepts maximum columns when the strict bound is met', async () => {
    const maxColumns = rawSnapshot();
    maxColumns.dataset.table.importSummary.columnCount = 128;
    (maxColumns.dataset.table.importSummary.importWarnings as Array<Record<string, unknown>>)[0]!.columnIndex = 127;
    const columnsDbName = nextDatabaseName();
    await putRaw(columnsDbName, maxColumns);
    await expect(createIndexedDbSessionStorage({ dbName: columnsDbName }).read()).resolves.toEqual(maxColumns);
  });

  it('accepts exactly 200,000 cells and rejects the nearest larger representable matrix', async () => {
    const exact = coherentDimensionSnapshot(1_599, 125); // (1,599 data rows + header) × 125 = 200,000
    const exactDbName = nextDatabaseName();
    await putRaw(exactDbName, exact);
    await expect(createIndexedDbSessionStorage({ dbName: exactDbName }).read()).resolves.toEqual(exact);

    // 200,001 has no factorization inside the 10,001-row and 128-column caps.
    // 9,090 data rows + header and 22 columns is the nearest larger valid rectangle: 200,002 cells.
    const over = coherentDimensionSnapshot(9_090, 22);
    const overDbName = nextDatabaseName();
    await putRaw(overDbName, over);
    await expect(createIndexedDbSessionStorage({ dbName: overDbName }).read()).rejects.toBeInstanceOf(SessionSnapshotValidationError);
  });

  it('rejects summaries with a non-plain prototype at the public parser boundary', () => {
    const raw = rawSnapshot() as unknown as { dataset: { table: { importSummary: object } } };
    raw.dataset.table.importSummary = Object.assign(Object.create({ inherited: true }), raw.dataset.table.importSummary);

    expect(() => parseSessionSnapshot(raw)).toThrow(SessionSnapshotValidationError);
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
