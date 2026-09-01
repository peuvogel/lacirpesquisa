import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/shared/session/SessionProvider';
import { deriveRecognizedColumnsFromDocument } from './analysisTable';
import {
  createTableDocument,
  resolveBindings,
  setTableCell,
  setTableColumnName,
  setTableColumnType,
  setTableRoleBinding,
  type TableDocument,
  type TableDocumentIdFactory,
} from './tableDocument';
import { useTabularInput } from './useTabularInput';
import type { TabularColumnRole } from './recognizedColumnsFromTabular';
import type { TabularInputOptions } from './types';
import type { TabularImportSummary } from './importDiagnostics';

export interface AnalysisTableConfirmed {
  document: TableDocument;
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

export interface UseAnalysisTableOptions {
  tabularOptions: TabularInputOptions;
  handoffRecognizedColumns?: Record<string, number>;
  idFactory?: TableDocumentIdFactory;
}

interface PendingTableAction {
  label: 'Substituir dados' | 'Limpar tabela';
  run: () => void;
}

/**
 * The one lifecycle owner for source imports, editable drafts and confirmed
 * engine inputs. Session owns the draft so changing test modules never drops
 * a header/type/binding edit.
 */
export function useAnalysisTable(testId: string, options: UseAnalysisTableOptions) {
  const { dataset, setDataset } = useSession();
  const tabular = useTabularInput(options.tabularOptions);
  const [confirmed, setConfirmed] = useState<AnalysisTableConfirmed | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingTableAction | null>(null);
  const importedRequestRef = useRef<number | null>(null);
  const sourceOverrideRef = useRef<string | null>(null);
  const table = dataset?.table ?? null;
  const previousTableRef = useRef<TableDocument | null>(table);
  const tableRef = useRef<TableDocument | null>(table);
  tableRef.current = table;

  const recognizedColumns = useMemo(() => {
    if (!table) return {};
    const derived = deriveRecognizedColumnsFromDocument(table, testId, options.tabularOptions);
    if (Object.keys(table.bindings[testId] ?? {}).length || !options.handoffRecognizedColumns) return derived;
    return {
      ...derived,
      ...Object.fromEntries(
        Object.entries(options.handoffRecognizedColumns).filter(([, index]) => index >= 0 && index < table.columns.length),
      ),
    };
  }, [table, testId, options.tabularOptions, options.handoffRecognizedColumns]);

  const loadedInput = useMemo(
    () => table && ({
      headers: table.columns.map((column) => column.name),
      rows: table.rows,
      recognizedColumns,
      sourceLabel: table.sourceLabel,
    }),
    [table, recognizedColumns],
  );

  useEffect(() => {
    if (!confirmed) return;
    if (
      !table
      || confirmed.document.id !== table.id
      || confirmed.document.revision !== table.revision
    ) {
      setConfirmed(null);
    }
  }, [confirmed, table]);

  useEffect(() => {
    const previousTable = previousTableRef.current;
    previousTableRef.current = table;
    if (!previousTable || table) return;

    // Mark the currently rendered parser generation as consumed before the
    // reset state is committed, so the import effect below cannot resurrect
    // the table during this same effect flush.
    importedRequestRef.current = tabular.requestId;
    sourceOverrideRef.current = null;
    setPendingAction(null);
    setConfirmed(null);
    tabular.reset();
  }, [table, tabular.requestId, tabular.reset]);

  const commitDocument = useCallback((nextDocument: TableDocument) => {
    if (nextDocument === tableRef.current) return;
    tableRef.current = nextDocument;
    setConfirmed(null);
    setDataset({
      headers: nextDocument.columns.map((column) => column.name),
      rows: nextDocument.rows,
      sourceLabel: nextDocument.sourceLabel,
      confirmedAt: dataset?.confirmedAt ?? Date.now(),
      table: nextDocument,
    });
  }, [dataset?.confirmedAt, setDataset]);

  const replaceTable = useCallback((
    headers: string[],
    rows: string[][],
    sourceLabel: string,
    importSummary?: TabularImportSummary,
  ) => {
    commitDocument(createTableDocument(headers, rows, sourceLabel, options.idFactory, importSummary));
  }, [commitDocument, options.idFactory]);

  useEffect(() => {
    if (tabular.status !== 'loaded') return;
    if (importedRequestRef.current === tabular.requestId) return;
    importedRequestRef.current = tabular.requestId;
    const sourceLabel = sourceOverrideRef.current ?? tabular.sourceLabel ?? 'colado';
    sourceOverrideRef.current = null;
    replaceTable(tabular.headers, tabular.bodyRows, sourceLabel, tabular.importSummary ?? undefined);
  }, [replaceTable, tabular.bodyRows, tabular.headers, tabular.importSummary, tabular.requestId, tabular.sourceLabel, tabular.status]);

  useEffect(() => {
    if (!table || !options.handoffRecognizedColumns || Object.keys(table.bindings[testId] ?? {}).length) return;
    let next = table;
    Object.entries(options.handoffRecognizedColumns).forEach(([role, index]) => {
      const column = table.columns[index];
      if (column) next = setTableRoleBinding(next, testId, role, column.id);
    });
    if (next !== table) commitDocument(next);
  }, [commitDocument, options.handoffRecognizedColumns, table, testId]);

  const setBinding = useCallback((role: string, columnId: string | null) => {
    if (tableRef.current) commitDocument(setTableRoleBinding(tableRef.current, testId, role, columnId));
  }, [commitDocument, testId]);
  const setBindingForTest = useCallback((otherTestId: string, role: string, columnId: string | null) => {
    if (tableRef.current) commitDocument(setTableRoleBinding(tableRef.current, otherTestId, role, columnId));
  }, [commitDocument]);
  const setColumnType = useCallback((columnId: string, type: TabularColumnRole) => {
    if (tableRef.current) commitDocument(setTableColumnType(tableRef.current, columnId, type));
  }, [commitDocument]);
  const setColumnName = useCallback((columnId: string, name: string) => {
    if (tableRef.current) commitDocument(setTableColumnName(tableRef.current, columnId, name));
  }, [commitDocument]);
  const setCell = useCallback((rowIndex: number, columnIndex: number, value: string) => {
    if (tableRef.current) commitDocument(setTableCell(tableRef.current, rowIndex, columnIndex, value));
  }, [commitDocument]);

  const confirm = useCallback(() => {
    const currentTable = tableRef.current;
    if (!currentTable) return null;
    const currentRecognizedColumns = deriveRecognizedColumnsFromDocument(currentTable, testId, options.tabularOptions);
    const next: AnalysisTableConfirmed = {
      document: currentTable,
      headers: currentTable.columns.map((column) => column.name),
      rows: currentTable.rows,
      sourceLabel: currentTable.sourceLabel,
      recognizedColumns: currentRecognizedColumns,
    };
    setConfirmed(next);
    setDataset({
      headers: next.headers,
      rows: next.rows,
      sourceLabel: next.sourceLabel,
      confirmedAt: Date.now(),
      table: currentTable,
    });
    return next;
  }, [options.tabularOptions, setDataset, testId]);

  const clear = useCallback(() => {
    importedRequestRef.current = null;
    sourceOverrideRef.current = null;
    tabular.reset();
    setConfirmed(null);
    setDataset(null);
  }, [setDataset, tabular]);

  const requestAction = useCallback((label: PendingTableAction['label'], run: () => void) => {
    if (tableRef.current && tableRef.current.revision > 0) {
      setPendingAction({ label, run });
      return;
    }
    run();
  }, []);

  const requestPaste = useCallback((text: string, sourceLabel = 'colado') => {
    requestAction('Substituir dados', () => {
      sourceOverrideRef.current = sourceLabel;
      tabular.setRawText(text);
    });
  }, [requestAction, tabular]);

  const requestFile = useCallback((file: File) => {
    requestAction('Substituir dados', () => {
      sourceOverrideRef.current = null;
      void tabular.setFile(file);
    });
  }, [requestAction, tabular]);

  const requestClear = useCallback((afterClear?: () => void) => requestAction('Limpar tabela', () => {
    clear();
    afterClear?.();
  }), [clear, requestAction]);
  const cancelPendingAction = useCallback(() => setPendingAction(null), []);
  const confirmPendingAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    action?.run();
  }, [pendingAction]);

  const useExample = useCallback((text: string) => requestPaste(text, 'exemplo'), [requestPaste]);

  return {
    table,
    loadedInput,
    recognizedColumns,
    confirmed,
    pendingAction: pendingAction?.label ?? null,
    importWarnings: tabular.importWarnings ?? [],
    tabular,
    replaceTable,
    setDocument: commitDocument,
    useExample,
    requestPaste,
    requestFile,
    requestClear,
    cancelPendingAction,
    confirmPendingAction,
    confirm,
    clear,
    setBinding,
    setBindingForTest,
    setColumnType,
    setColumnName,
    setCell,
    resolveBindings: () => table ? resolveBindings(table, testId) : {},
  };
}
