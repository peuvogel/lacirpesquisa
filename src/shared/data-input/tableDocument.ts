import type { TabularColumnRole } from './recognizedColumnsFromTabular';
import { parseNumber } from './legacyAdapters';
import { isSupportedTemporalToken } from './temporalPeriods';
import type { TabularImportSummary } from './importDiagnostics';

export interface TableColumn {
  id: string;
  name: string;
  type: TabularColumnRole;
  explicitType: boolean;
  /** Absent means enabled. A disabled column keeps its data and type but leaves the analysis. */
  enabled?: boolean;
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
  /** Optional to retain compatibility with snapshots saved before import provenance. */
  importSummary?: TabularImportSummary;
  /**
   * Absent means every row is enabled. Kept parallel to `rows` — not as a list of
   * indexes — so it survives splices when rows are added or removed.
   */
  rowsEnabled?: boolean[];
  /** Monotonic counter for column ids, so adding after a delete cannot collide. */
  nextColumnSeq?: number;
}

/** A column takes part in the analysis unless it was ignored or switched off. */
export function isColumnActive(column: TableColumn): boolean {
  return column.type !== 'ignorar' && column.enabled !== false;
}

export function isRowEnabled(document: TableDocument, rowIndex: number): boolean {
  return document.rowsEnabled?.[rowIndex] !== false;
}

/** Rows that feed the engines, with their original indexes preserved. */
export function enabledRowEntries(document: TableDocument): Array<{ row: string[]; index: number }> {
  return document.rows
    .map((row, index) => ({ row, index }))
    .filter(({ index }) => isRowEnabled(document, index));
}

export function enabledRows(document: TableDocument): string[][] {
  return enabledRowEntries(document).map(({ row }) => row);
}

/** Drops every binding pointing at a column that can no longer be analysed. */
function purgeBindings(
  bindings: Record<string, TableRoleBindings>,
  columnId: string,
): Record<string, TableRoleBindings> {
  return Object.fromEntries(
    Object.entries(bindings)
      .map(([testId, roles]) => [
        testId,
        Object.fromEntries(Object.entries(roles).filter(([, boundColumnId]) => boundColumnId !== columnId)),
      ] as const)
      .filter(([, roles]) => Object.keys(roles).length > 0),
  );
}

/** Materialises the parallel flag array, which is absent until the first toggle. */
function rowFlags(document: TableDocument): boolean[] {
  return document.rowsEnabled
    ? [...document.rowsEnabled]
    : document.rows.map(() => true);
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

/**
 * Tipo detectado a partir dos dados. Fonte única: alimenta tanto o tipo inicial
 * de `createTableDocument` quanto o aviso "tipo ajustado por você" e o botão de
 * redefinir na prévia — se divergissem, o aviso ficaria aceso após um reset.
 */
export function suggestColumnType(columnIndex: number, rows: readonly string[][]): TabularColumnRole {
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
  importSummary?: TabularImportSummary,
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
    nextColumnSeq: headers.length + 1,
    ...(importSummary ? { importSummary } : {}),
  };
}

export function addTableRow(document: TableDocument): TableDocument {
  const rows = copyRows(document.rows);
  rows.push(document.columns.map(() => ''));
  return revise(document, { rows, rowsEnabled: [...rowFlags(document), true] });
}

export function removeTableRow(document: TableDocument, rowIndex: number): TableDocument {
  if (rowIndex < 0 || rowIndex >= document.rows.length) return document;
  const rows = copyRows(document.rows);
  rows.splice(rowIndex, 1);
  const rowsEnabled = rowFlags(document);
  rowsEnabled.splice(rowIndex, 1);
  return revise(document, { rows, rowsEnabled });
}

export function setTableRowEnabled(
  document: TableDocument,
  rowIndex: number,
  enabled: boolean,
): TableDocument {
  if (rowIndex < 0 || rowIndex >= document.rows.length) return document;
  if (isRowEnabled(document, rowIndex) === enabled) return document;
  const rowsEnabled = rowFlags(document);
  rowsEnabled[rowIndex] = enabled;
  return revise(document, { rowsEnabled });
}

export function addTableColumn(document: TableDocument, name = ''): TableDocument {
  const seq = document.nextColumnSeq ?? document.columns.length + 1;
  const columns = [
    ...document.columns,
    {
      id: `${document.id}-col-${seq}`,
      name,
      type: 'categorica' as TabularColumnRole,
      explicitType: false,
    },
  ];
  const rows = copyRows(document.rows).map((row) => [...row, '']);
  return revise(document, { columns, rows, nextColumnSeq: seq + 1 });
}

export function removeTableColumn(document: TableDocument, columnId: string): TableDocument {
  const index = document.columns.findIndex((column) => column.id === columnId);
  if (index < 0) return document;
  const columns = document.columns.filter((column) => column.id !== columnId);
  const rows = copyRows(document.rows).map((row) => row.filter((_, position) => position !== index));
  return revise(document, { columns, rows, bindings: purgeBindings(document.bindings, columnId) });
}

export function setTableColumnEnabled(
  document: TableDocument,
  columnId: string,
  enabled: boolean,
): TableDocument {
  const column = document.columns.find((item) => item.id === columnId);
  if (!column || (column.enabled !== false) === enabled) return document;
  const columns = document.columns.map((item) => (
    item.id === columnId ? { ...item, enabled } : item
  ));
  if (enabled) return revise(document, { columns });
  return revise(document, { columns, bindings: purgeBindings(document.bindings, columnId) });
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
  return revise(document, { columns, bindings: purgeBindings(document.bindings, columnId) });
}

/**
 * Devolve cada coluna ao tipo detectado na importação, limpando o ajuste manual.
 * Preserva interruptores, nomes e vínculos — `suggestColumnType` nunca devolve
 * 'ignorar', então o reset não pode criar coluna excluída da análise.
 */
export function resetTableColumnTypes(document: TableDocument): TableDocument {
  let changed = false;
  const columns = document.columns.map((column, index) => {
    const type = suggestColumnType(index, document.rows);
    if (column.type === type && !column.explicitType) return column;
    changed = true;
    return { ...column, type, explicitType: false };
  });
  // Identidade preservada quando nada muda: é disso que o applyDocument da
  // prévia depende para não disparar um commit à toa.
  if (!changed) return document;
  return revise(document, { columns });
}

export function setTableRoleBinding(
  document: TableDocument,
  testId: string,
  role: string,
  columnId: string | null,
): TableDocument {
  if (
    columnId !== null
    && !document.columns.some((column) => column.id === columnId && isColumnActive(column))
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

/**
 * Devolve os papéis deste teste à detecção automática, apagando a entrada
 * inteira de `bindings[testId]`.
 *
 * Não dá para fazer isso com `setTableRoleBinding(..., null)`: null é a
 * rejeição deliberada de uma sugestão, e fica gravada. Só remover a chave faz a
 * sugestão voltar. Vínculos de outros testes e o resto do documento não são
 * tocados; sem nada explícito, devolve o mesmo documento.
 */
export function clearTableRoleBindings(document: TableDocument, testId: string): TableDocument {
  if (!document.bindings[testId]) return document;
  const bindings = copyBindings(document.bindings);
  delete bindings[testId];
  return revise(document, { bindings });
}

/** Converts stable role bindings to the numeric index interface expected by existing engines. */
export function resolveBindings(document: TableDocument, testId: string): Record<string, number> {
  const indexById = new Map(
    document.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => isColumnActive(column))
      .map(({ column, index }) => [column.id, index]),
  );
  return Object.fromEntries(
    Object.entries(document.bindings[testId] ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && indexById.has(entry[1]))
      .map(([role, columnId]) => [role, indexById.get(columnId)!]),
  );
}
