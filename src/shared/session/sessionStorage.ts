import type { SessionDataset } from './StatisticsSessionProvider';
import { IMPORT_LIMITS } from '@/shared/data-input/importLimits';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportDiagnostic, TabularImportSummary } from '@/shared/data-input/importDiagnostics';
import type { ImportWarning } from '@/shared/data-input/types';

export const SESSION_DATABASE_NAME = 'lacirstat-private-session';
export const SESSION_STORE_NAME = 'session';
export const SESSION_RECORD_KEY = 'current';
const SESSION_DATABASE_VERSION = 1;
const SNAPSHOT_VERSION = 1;

const TABLE_COLUMN_TYPES = new Set(['numerica', 'categorica', 'tempo', 'ignorar']);
const IMPORT_DIAGNOSTIC_CODES = new Set<ImportDiagnostic['code']>([
  'duplicate_headers', 'short_rows', 'extra_cells', 'positional_mapping', 'decimal_comma',
  'excel_dates_converted', 'possible_excel_serial', 'mixed_numeric_format', 'missing_tokens',
]);
const IMPORT_WARNING_CODES = new Set<ImportWarning['code']>(['formula-without-cache', 'unusable-cell']);
const IMPORT_RECOGNITION_MODES = new Set<TabularImportSummary['recognitionMode']>(['aliases', 'position', 'unmapped']);
const MAX_IMPORT_STRING_LENGTH = 10_000;

/** Arquivo de um teste: o que ele tinha quando o usuário saiu dele. */
export interface SessionTestSlot {
  dataset: SessionDataset;
  /** revision do documento ao confirmar; se divergir, o resultado é descartado. */
  confirmedRevision?: number;
  /** blob opaco do módulo: alpha, mode, temporalMode, format… */
  settings?: Record<string, unknown>;
}

export interface SessionSnapshot {
  version: 1;
  savedAt: number;
  dataset: SessionDataset | null;
  visualPreferences: Record<string, unknown>;
  /** Opcional: snapshots gravados antes do arquivo por teste seguem válidos. */
  testSlots?: Record<string, SessionTestSlot>;
}

export interface SessionStorageAdapter {
  read(): Promise<SessionSnapshot | null>;
  write(snapshot: SessionSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export interface IndexedDbSessionStorageOptions {
  dbName?: string;
  indexedDBFactory?: IDBFactory;
}

export class SessionSnapshotValidationError extends Error {
  constructor(message = 'A sessão salva é incompatível ou está corrompida.') {
    super(message);
    this.name = 'SessionSnapshotValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isSerializableValue(
  value: unknown,
  depth = 0,
  ancestors: ReadonlySet<object> = new Set(),
): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth >= 12 || (typeof value !== 'object' && !Array.isArray(value))) return false;
  if (!value || ancestors.has(value)) return false;

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    return value.length <= 1_000
      && value.every((item) => isSerializableValue(item, depth + 1, nextAncestors));
  }
  if (!isRecord(value) || Object.keys(value).length > 1_000) return false;
  return Object.values(value).every((item) => isSerializableValue(item, depth + 1, nextAncestors));
}

export function isSerializableVisualPreferences(
  value: unknown,
): value is Record<string, unknown> {
  return isRecord(value) && isSerializableValue(value);
}

function isStringMatrix(value: unknown, maxColumns: number): value is string[][] {
  return Array.isArray(value)
    && value.length <= IMPORT_LIMITS.dataRows
    && (value.length + 1) * maxColumns <= IMPORT_LIMITS.cells
    && value.every((row) => (
      Array.isArray(row)
      && row.length <= maxColumns
      && row.every((cell) => typeof cell === 'string')
    ));
}

function isBoundedString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_IMPORT_STRING_LENGTH;
}

function isBoundedStringList(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value) && value.length <= maximum && value.every(isBoundedString);
}

function isStrictImportDiagnostic(value: unknown): value is ImportDiagnostic {
  if (!isRecord(value) || !hasOnlyKeys(value, ['code', 'severity', 'message', 'rowNumbers'])) return false;
  if (
    typeof value.code !== 'string' || !IMPORT_DIAGNOSTIC_CODES.has(value.code as ImportDiagnostic['code'])
    || (value.severity !== 'info' && value.severity !== 'warning')
    || !isBoundedString(value.message)
  ) return false;
  return value.rowNumbers === undefined || (
    Array.isArray(value.rowNumbers)
    && value.rowNumbers.length <= IMPORT_LIMITS.dataRows
    && value.rowNumbers.every((rowNumber) => Number.isInteger(rowNumber) && rowNumber >= 1 && rowNumber <= IMPORT_LIMITS.dataRows)
  );
}

function isStrictImportWarning(value: unknown, columnCount: number): value is ImportWarning {
  return isRecord(value)
    && hasOnlyKeys(value, ['code', 'message', 'cellReference', 'rowNumber', 'columnIndex'])
    && typeof value.code === 'string'
    && IMPORT_WARNING_CODES.has(value.code as ImportWarning['code'])
    && isBoundedString(value.message)
    && isBoundedString(value.cellReference)
    && typeof value.rowNumber === 'number'
    && Number.isInteger(value.rowNumber)
    && value.rowNumber >= 1
    && value.rowNumber <= IMPORT_LIMITS.dataRows
    && typeof value.columnIndex === 'number'
    && Number.isInteger(value.columnIndex)
    && value.columnIndex >= 0
    && value.columnIndex < columnCount;
}

function isStrictTabularImportSummary(value: unknown): value is TabularImportSummary {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'sourceType', 'fileName', 'tableName', 'sheetNames', 'formatLabel', 'delimiter', 'rowCount', 'columnCount',
    'headerRowNumber', 'recognitionMode', 'recognitionDetails', 'diagnostics', 'importWarnings',
  ])) return false;
  if (
    typeof value.rowCount !== 'number'
    || typeof value.columnCount !== 'number'
    || typeof value.headerRowNumber !== 'number'
  ) return false;
  const rowCount = value.rowCount;
  const columnCount = value.columnCount;
  const headerRowNumber = value.headerRowNumber;
  if (
    (value.sourceType !== 'paste' && value.sourceType !== 'file')
    || !isBoundedString(value.fileName)
    || !isBoundedString(value.tableName)
    || !isBoundedString(value.formatLabel)
    || !isBoundedString(value.delimiter)
    || !isBoundedStringList(value.sheetNames, IMPORT_LIMITS.sheets)
    || !isBoundedStringList(value.recognitionDetails, IMPORT_LIMITS.columns)
    || !Number.isFinite(rowCount) || !Number.isInteger(rowCount) || rowCount < 0 || rowCount > IMPORT_LIMITS.dataRows
    || !Number.isFinite(columnCount) || !Number.isInteger(columnCount) || columnCount < 1 || columnCount > IMPORT_LIMITS.columns
    || !Number.isFinite(headerRowNumber) || !Number.isInteger(headerRowNumber) || headerRowNumber < 1 || headerRowNumber > IMPORT_LIMITS.dataRows
    || !IMPORT_RECOGNITION_MODES.has(value.recognitionMode as TabularImportSummary['recognitionMode'])
    || !Array.isArray(value.diagnostics) || value.diagnostics.length > IMPORT_LIMITS.dataRows || !value.diagnostics.every(isStrictImportDiagnostic)
    || !Array.isArray(value.importWarnings) || value.importWarnings.length > IMPORT_LIMITS.cells
    || !value.importWarnings.every((warning) => isStrictImportWarning(warning, columnCount))
    || (rowCount + 1) * columnCount > IMPORT_LIMITS.cells
  ) return false;
  return true;
}

function isStrictTableDocument(value: unknown): value is TableDocument {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'revision', 'columns', 'rows', 'bindings', 'sourceLabel', 'importSummary'])) {
    return false;
  }
  if (
    typeof value.id !== 'string'
    || !value.id
    || !Number.isInteger(value.revision)
    || (value.revision as number) < 0
    || typeof value.sourceLabel !== 'string'
    || !Array.isArray(value.columns)
    || value.columns.length > IMPORT_LIMITS.columns
  ) return false;

  const columnIds = new Set<string>();
  const ignoredColumnIds = new Set<string>();
  for (const column of value.columns) {
    if (
      !isRecord(column)
      || !hasOnlyKeys(column, ['id', 'name', 'type', 'explicitType'])
      || typeof column.id !== 'string'
      || !column.id
      || columnIds.has(column.id)
      || typeof column.name !== 'string'
      || typeof column.type !== 'string'
      || !TABLE_COLUMN_TYPES.has(column.type)
      || typeof column.explicitType !== 'boolean'
    ) return false;
    columnIds.add(column.id);
    if (column.type === 'ignorar') ignoredColumnIds.add(column.id);
  }

  if (
    !isStringMatrix(value.rows, value.columns.length)
    || !isRecord(value.bindings)
    || (value.importSummary !== undefined && !isStrictTabularImportSummary(value.importSummary))
  ) return false;
  for (const roles of Object.values(value.bindings)) {
    if (!isRecord(roles)) return false;
    for (const boundColumnId of Object.values(roles)) {
      if (boundColumnId !== null && (
        typeof boundColumnId !== 'string'
        || !columnIds.has(boundColumnId)
        || ignoredColumnIds.has(boundColumnId)
      )) return false;
    }
  }
  return true;
}

function sameStringMatrix(left: readonly string[][], right: readonly string[][]): boolean {
  return left.length === right.length && left.every((row, rowIndex) => (
    row.length === right[rowIndex]?.length
    && row.every((cell, columnIndex) => cell === right[rowIndex]?.[columnIndex])
  ));
}

function isStrictSessionDataset(value: unknown): value is SessionDataset {
  if (!isRecord(value) || !hasOnlyKeys(value, ['headers', 'rows', 'sourceLabel', 'confirmedAt', 'table'])) {
    return false;
  }
  if (
    !Array.isArray(value.headers)
    || !value.headers.every((header) => typeof header === 'string')
    || typeof value.sourceLabel !== 'string'
    || !isFiniteTimestamp(value.confirmedAt)
    || !isStrictTableDocument(value.table)
    || !isStringMatrix(value.rows, value.headers.length)
  ) return false;

  const table = value.table;
  return value.headers.length === table.columns.length
    && value.headers.every((header, index) => header === table.columns[index]?.name)
    && value.sourceLabel === table.sourceLabel
    && sameStringMatrix(value.rows, table.rows);
}

function isStrictTestSlot(value: unknown): value is SessionTestSlot {
  if (!isRecord(value) || !hasOnlyKeys(value, ['dataset', 'confirmedRevision', 'settings'])) return false;
  if (!isStrictSessionDataset(value.dataset)) return false;
  if (
    value.confirmedRevision !== undefined
    && (!Number.isInteger(value.confirmedRevision) || (value.confirmedRevision as number) < 0)
  ) return false;
  // Blob opaco do módulo, validado igual a visualPreferences.
  return value.settings === undefined || isSerializableVisualPreferences(value.settings);
}

function isStrictTestSlots(value: unknown): value is Record<string, SessionTestSlot> {
  return isRecord(value) && Object.values(value).every(isStrictTestSlot);
}

export function parseSessionSnapshot(value: unknown): SessionSnapshot {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['version', 'savedAt', 'dataset', 'visualPreferences', 'testSlots'])
    || value.version !== SNAPSHOT_VERSION
    || !isFiniteTimestamp(value.savedAt)
    || (value.dataset !== null && !isStrictSessionDataset(value.dataset))
    || !isSerializableVisualPreferences(value.visualPreferences)
    || (value.testSlots !== undefined && !isStrictTestSlots(value.testSlots))
  ) {
    throw new SessionSnapshotValidationError();
  }
  return value as unknown as SessionSnapshot;
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação IndexedDB.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Transação IndexedDB cancelada.'));
  });
}

function openDatabase(factory: IDBFactory, dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(dbName, SESSION_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SESSION_STORE_NAME)) {
        request.result.createObjectStore(SESSION_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o IndexedDB.'));
    request.onblocked = () => reject(new Error('O IndexedDB está bloqueado por outra aba.'));
  });
}

function resolveFactory(configured?: IDBFactory): IDBFactory {
  const factory = configured ?? globalThis.indexedDB;
  if (!factory) throw new Error('IndexedDB não está disponível neste navegador.');
  return factory;
}

export function createIndexedDbSessionStorage(
  options: IndexedDbSessionStorageOptions = {},
): SessionStorageAdapter {
  const dbName = options.dbName ?? SESSION_DATABASE_NAME;

  return {
    async read() {
      const db = await openDatabase(resolveFactory(options.indexedDBFactory), dbName);
      try {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readonly');
        const request = transaction.objectStore(SESSION_STORE_NAME).get(SESSION_RECORD_KEY);
        const value = await new Promise<unknown>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error('Não foi possível ler a sessão.'));
        });
        await transactionCompletion(transaction);
        return value === undefined ? null : parseSessionSnapshot(value);
      } finally {
        db.close();
      }
    },

    async write(snapshot) {
      const validated = parseSessionSnapshot(snapshot);
      const db = await openDatabase(resolveFactory(options.indexedDBFactory), dbName);
      try {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
        transaction.objectStore(SESSION_STORE_NAME).put(validated, SESSION_RECORD_KEY);
        await transactionCompletion(transaction);
      } finally {
        db.close();
      }
    },

    async clear() {
      const db = await openDatabase(resolveFactory(options.indexedDBFactory), dbName);
      try {
        const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
        transaction.objectStore(SESSION_STORE_NAME).delete(SESSION_RECORD_KEY);
        await transactionCompletion(transaction);
      } finally {
        db.close();
      }
    },
  };
}
