import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
import { deriveRecognizedColumnsFromDocument } from './analysisTable';
import {
  createTableDocument,
  enabledRows,
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

/** Teto do histórico de desfazer, para a pilha não crescer sem fim. */
const UNDO_LIMIT = 50;

const EMPTY_SETTINGS: Record<string, unknown> = {};

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
  const { dataset, setDataset, testSlots, setTestSlotMeta } = useStatisticsSession();
  const tabular = useTabularInput(options.tabularOptions);
  const [confirmed, setConfirmed] = useState<AnalysisTableConfirmed | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingTableAction | null>(null);
  const importedRequestRef = useRef<number | null>(null);
  const historyRef = useRef<TableDocument[]>([]);
  const [canUndo, setCanUndo] = useState(false);
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

  const commitDocument = useCallback((nextDocument: TableDocument, options?: { history?: boolean }) => {
    if (nextDocument === tableRef.current) return;
    if (options?.history !== false && tableRef.current) {
      // Cada mutador devolve documento novo, então o histórico é só guardar a
      // referência anterior. O teto evita crescer sem fim numa sessão longa.
      historyRef.current = [...historyRef.current, tableRef.current].slice(-UNDO_LIMIT);
      setCanUndo(true);
    }
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

  const undo = useCallback(() => {
    const previous = historyRef.current[historyRef.current.length - 1];
    if (!previous) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setCanUndo(historyRef.current.length > 0);
    commitDocument(previous, { history: false });
  }, [commitDocument]);

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

  /** Deriva o payload dos engines a partir do documento. Igual em confirm() e na reidratação. */
  const deriveConfirmed = useCallback((source: TableDocument): AnalysisTableConfirmed => ({
    document: source,
    headers: source.columns.map((column) => column.name),
    // Filtrado uma vez aqui: todos os 10 engines consomem este `rows`.
    rows: enabledRows(source),
    sourceLabel: source.sourceLabel,
    recognizedColumns: deriveRecognizedColumnsFromDocument(source, testId, options.tabularOptions),
  }), [options.tabularOptions, testId]);

  // Ao voltar para o teste, o resultado só ressurge se a revisão do documento
  // for a mesma de quando foi confirmado. Reconstruir (em vez de guardar o
  // payload) é o que impede um resultado de sobreviver a uma edição da tabela.
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (rehydratedRef.current || confirmed || !table) return;
    rehydratedRef.current = true;
    if (testSlots[testId]?.confirmedRevision !== table.revision) return;
    setConfirmed(deriveConfirmed(table));
  }, [confirmed, deriveConfirmed, table, testId, testSlots]);

  const settings = testSlots[testId]?.settings ?? EMPTY_SETTINGS;
  const setSettings = useCallback((partial: Record<string, unknown>) => {
    setTestSlotMeta(testId, { settings: { ...(testSlots[testId]?.settings ?? {}), ...partial } });
  }, [setTestSlotMeta, testId, testSlots]);

  const confirm = useCallback(() => {
    const currentTable = tableRef.current;
    if (!currentTable) return null;
    const next = deriveConfirmed(currentTable);
    setConfirmed(next);
    setTestSlotMeta(testId, { confirmedRevision: currentTable.revision });
    setDataset({
      headers: next.headers,
      // O snapshot exige rows idêntico a table.rows (sameStringMatrix), então o
      // que é persistido segue sem filtro — o recorte é só para a análise.
      rows: currentTable.rows,
      sourceLabel: next.sourceLabel,
      confirmedAt: Date.now(),
      table: currentTable,
    });
    return next;
  }, [deriveConfirmed, setDataset, setTestSlotMeta, testId]);

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
    undo,
    canUndo,
    settings,
    setSettings,
    setBinding,
    setBindingForTest,
    setColumnType,
    setColumnName,
    setCell,
    resolveBindings: () => table ? resolveBindings(table, testId) : {},
  };
}
