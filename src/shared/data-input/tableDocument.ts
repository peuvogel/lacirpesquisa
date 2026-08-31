import type { TabularColumnRole } from './recognizedColumnsFromTabular';
import { parseNumber } from './legacyAdapters';
import { isSupportedTemporalToken } from './temporalPeriods';

export interface TableColumn {
  id: string;
  name: string;
  type: TabularColumnRole;
  explicitType: boolean;
}

export type TableRoleBindings = Record<string, string | null>;

export interface TableDocument {
  id: string;
  revision: number;
  columns: TableColumn[];
  rows: string[][];
  /** A null value records that the user deliberately rejected an automatic suggestion. */
  bindings: Record<string, TableRoleBindings>;
  sourceLabel: string;
}

export type TableDocumentIdFactory = () => string;

let fallbackDocumentSequence = 0;

function defaultDocumentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackDocumentSequence += 1;
  return `table-${fallbackDocumentSequence}`;
}

function copyRows(rows: readonly string[][]): string[][] {
  return rows.map((row) => row.map((cell) => String(cell ?? '')));
}

function copyBindings(bindings: Record<string, TableRoleBindings>): Record<string, TableRoleBindings> {
  return Object.fromEntries(Object.entries(bindings).map(([testId, roles]) => [testId, { ...roles }]));
}

function looksTemporal(value: string): boolean {
  const token = value.trim();
  return isSupportedTemporalToken(token)
    && (parseNumber(token) === null || /^\d{4}(?:\.[1-4])?$/.test(token));
}

function looksNumeric(value: string): boolean {
  return value.trim() !== '' && parseNumber(value) !== null;
}

function suggestColumnType(columnIndex: number, rows: readonly string[][]): TabularColumnRole {
  const values = rows.map((row) => String(row[columnIndex] ?? '')).filter((value) => value.trim());
  if (!values.length) return 'categorica';
  if (values.filter(looksTemporal).length / values.length >= 0.6) return 'tempo';
  if (values.filter(looksNumeric).length / values.length >= 0.6) return 'numerica';
  return 'categorica';
}

function revise(document: TableDocument, change: Omit<Partial<TableDocument>, 'revision'>): TableDocument {
  return {
    ...document,
    ...change,
    revision: document.revision + 1,
  };
}

export function createTableDocument(
  headers: readonly string[],
  rows: readonly string[][],
  sourceLabel: string,
  idFactory: TableDocumentIdFactory = defaultDocumentId,
): TableDocument {
  const id = idFactory();
  return {
    id,
    revision: 0,
    columns: headers.map((name, index) => ({
      id: `${id}-col-${index + 1}`,
      name: String(name ?? ''),
      type: suggestColumnType(index, rows),
      explicitType: false,
    })),
    rows: copyRows(rows),
    bindings: {},
    sourceLabel,
  };
}

export function isTableDocument(value: unknown): value is TableDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TableDocument>;
  return typeof candidate.id === 'string'
    && typeof candidate.revision === 'number'
    && Array.isArray(candidate.columns)
    && Array.isArray(candidate.rows)
    && candidate.bindings !== null
    && typeof candidate.bindings === 'object'
    && typeof candidate.sourceLabel === 'string';
}

export function setTableColumnName(document: TableDocument, columnId: string, name: string): TableDocument {
  const index = document.columns.findIndex((column) => column.id === columnId);
  if (index < 0 || document.columns[index]!.name === name) return document;
  const columns = document.columns.map((column) => (column.id === columnId ? { ...column, name } : column));
  return revise(document, { columns });
}

export function setTableCell(document: TableDocument, rowIndex: number, columnIndex: number, value: string): TableDocument {
  if (rowIndex < 0 || rowIndex >= document.rows.length || columnIndex < 0 || columnIndex >= document.columns.length) {
    return document;
  }
  if (document.rows[rowIndex]?.[columnIndex] === value) return document;
  const rows = copyRows(document.rows);
  const row = rows[rowIndex]!;
  while (row.length < document.columns.length) row.push('');
  row[columnIndex] = value;
  return revise(document, { rows });
}

export function setTableColumnType(document: TableDocument, columnId: string, type: TabularColumnRole): TableDocument {
  const column = document.columns.find((item) => item.id === columnId);
  if (!column || (column.type === type && column.explicitType)) return document;
  const columns = document.columns.map((item) => (
    item.id === columnId ? { ...item, type, explicitType: true } : item
  ));
  if (type !== 'ignorar') return revise(document, { columns });

  const bindings = Object.fromEntries(
    Object.entries(document.bindings)
      .map(([testId, roles]) => [
        testId,
        Object.fromEntries(Object.entries(roles).filter(([, boundColumnId]) => boundColumnId !== columnId)),
      ] as const)
      .filter(([, roles]) => Object.keys(roles).length > 0),
  );
  return revise(document, { columns, bindings });
}

export function setTableRoleBinding(
  document: TableDocument,
  testId: string,
  role: string,
  columnId: string | null,
): TableDocument {
  if (
    columnId !== null
    && !document.columns.some((column) => column.id === columnId && column.type !== 'ignorar')
  ) return document;
  const bindings = copyBindings(document.bindings);
  const testBindings = { ...(bindings[testId] ?? {}) };
  if (columnId === null) {
    if (testBindings[role] === null) return document;
    testBindings[role] = null;
  } else if (testBindings[role] === columnId) {
    return document;
  } else if (Object.entries(testBindings).some(([boundRole, boundColumnId]) => (
    boundRole !== role && boundColumnId === columnId
  ))) {
    return document;
  } else {
    testBindings[role] = columnId;
  }
  if (Object.keys(testBindings).length) bindings[testId] = testBindings;
  else delete bindings[testId];
  return revise(document, { bindings });
}

/** Converts stable role bindings to the numeric index interface expected by existing engines. */
export function resolveBindings(document: TableDocument, testId: string): Record<string, number> {
  const indexById = new Map(
    document.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.type !== 'ignorar')
      .map(({ column, index }) => [column.id, index]),
  );
  return Object.fromEntries(
    Object.entries(document.bindings[testId] ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && indexById.has(entry[1]))
      .map(([role, columnId]) => [role, indexById.get(columnId)!]),
  );
}
