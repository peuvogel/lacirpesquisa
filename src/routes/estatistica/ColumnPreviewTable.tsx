import { useEffect, useMemo, useState } from 'react';
import { History, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpecularButton } from '@/components/ui/specularButton/SpecularButton';
import { cn } from '@/lib/utils';
import { FilterCheck } from '@/components/ui/filterCheck/FilterCheck';
import {
  deriveRecognizedColumnsFromDocument,
  tableValiditySummary,
} from '@/shared/data-input/analysisTable';
import {
  addTableColumn,
  addTableRow,
  isRowEnabled,
  removeTableColumn,
  removeTableRow,
  resetTableColumnTypes,
  setTableCell,
  setTableColumnEnabled,
  setTableColumnName,
  setTableColumnType,
  setTableRowEnabled,
  suggestColumnType,
  setTableRoleBinding,
  type TableDocument,
} from '@/shared/data-input/tableDocument';
import {
  deriveRecognizedColumnsFromRoles,
  type TabularColumnRole,
} from '@/shared/data-input/recognizedColumnsFromTabular';
import { COLUMN_ROLE_OPTIONS } from '@/shared/data-input/columnRoles';
import { validateTableSize } from '@/shared/data-input/importLimits';
import WheelPicker from '@/components/ui/wheelPicker/WheelPicker';
import type { ImportWarning, TabularInputOptions } from '@/shared/data-input/types';

export type ColumnRole = TabularColumnRole;

/** Saída: o documento só muda quando a transição termina. Espelha o theme.css. */
const LEAVE_MS = 190;
/** Entrada: a classe é removida quando a transição acaba. Espelha o theme.css. */
const ENTER_MS = 240;

const MAX_LISTED_PROBLEM_ROWS = 20;

/** Duração do balanço do cadeado; casa com a animação `shake-lock` do CSS. */
const SHAKE_MS = 400;

export type ColumnPreviewConfirmMode = 'numeric-required' | 'categorical-pair' | 'independent-columns';

export interface ColumnPreviewTableProps {
  /** Existing compatibility API. Prefer the stable document API below. */
  headers?: string[];
  bodyRows?: string[][];
  recognizedColumns?: Record<string, number>;
  tabularOptions?: TabularInputOptions;
  confirmMode?: ColumnPreviewConfirmMode;
  onRoleAdjust?: () => void;
  onConfirm: (confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) => void;
  maxPreviewRows?: number;
  editable?: boolean;
  confirmDisabled?: boolean;
  /** Desfaz a última edição da tabela; sem ele o atalho não é registrado. */
  onUndo?: () => void;
  /** Stable draft API used by all real analysis modules. */
  document?: TableDocument;
  testId?: string;
  onDocumentChange?: (document: TableDocument) => void;
  importWarnings?: ImportWarning[];
  onClear?: () => void;
}



function problemRowsText(rows: number[]): string {
  const visible = rows.slice(0, MAX_LISTED_PROBLEM_ROWS).join(', ');
  const remaining = rows.length - MAX_LISTED_PROBLEM_ROWS;
  return remaining > 0 ? `${visible} e mais ${remaining}` : visible;
}

/** Controlled document editor; legacy props remain only for direct callers/tests. */
export function ColumnPreviewTable({
  headers: initialHeaders = [],
  bodyRows: initialRows = [],
  recognizedColumns: legacyRecognizedColumns = {},
  tabularOptions,
  confirmMode = 'numeric-required',
  onRoleAdjust,
  onConfirm,
  maxPreviewRows = 8,
  editable = true,
  confirmDisabled = false,
  onUndo,
  document,
  testId,
  onDocumentChange,
  importWarnings = [],
  onClear,
}: ColumnPreviewTableProps) {
  const [legacyHeaders, setLegacyHeaders] = useState(initialHeaders);
  const [legacyRows, setLegacyRows] = useState(initialRows);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!document) {
      setLegacyHeaders(initialHeaders);
      setLegacyRows(initialRows);
    }
  }, [document, initialHeaders, initialRows]);

  useEffect(() => setPage(0), [document?.id]);

  const headers = document
    ? document.columns.map((column) => column.name)
    : legacyHeaders;
  const bodyRows = document ? document.rows : legacyRows;
  const importSummary = document?.importSummary;
  const effectiveImportWarnings = importSummary ? importSummary.importWarnings : importWarnings;
  const detectedRoles = useMemo(
    () => headers.map((_, index) => suggestColumnType(index, bodyRows)),
    [headers, bodyRows],
  );
  const [legacyRoles, setLegacyRoles] = useState<ColumnRole[]>(detectedRoles);
  const [unlockedTypes, setUnlockedTypes] = useState<ReadonlySet<number>>(() => new Set());
  // Um cadeado para a tabela inteira, fechado por padrão, guardando só o que
  // apaga: os checks de incluir/excluir são reversíveis e seguem livres.
  const [deleteUnlocked, setDeleteUnlocked] = useState(false);
  const [lockShaking, setLockShaking] = useState(false);
  // Qual linha a lixeira está prestes a apagar, e qual coluna está saindo de cena.
  const [rowPendingRemoval, setRowPendingRemoval] = useState<number | null>(null);
  // Destaque neutro: o check inclui/exclui da análise, não apaga. Reusar o
  // vermelho da lixeira anunciaria uma ação que o controle não faz.
  const [rowHighlighted, setRowHighlighted] = useState<number | null>(null);

  useEffect(() => {
    if (!onUndo) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'z' || !(event.metaKey || event.ctrlKey) || event.shiftKey) return;
      // Digitando numa célula, o Ctrl+Z pertence ao campo, não à tabela.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      event.preventDefault();
      onUndo!();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo]);
  const [columnRemoving, setColumnRemoving] = useState<number | null>(null);
  const [columnEntering, setColumnEntering] = useState<number | null>(null);
  const [rowRemoving, setRowRemoving] = useState<number | null>(null);
  const [rowEntering, setRowEntering] = useState<number | null>(null);

  /** Movimento reduzido: a mutação acontece na hora, sem esperar transição. */
  function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
      && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  /** Marca o índice que entra, e limpa a marca quando a transição termina. */
  function flagEntering(setter: (index: number | null) => void, index: number) {
    if (prefersReducedMotion()) return;
    setter(index);
    window.setTimeout(() => setter(null), ENTER_MS);
  }

  /**
   * Excluir linha ou coluna é destrutivo e mora num ícone que aparece no hover:
   * fácil demais de acionar sem querer. O cadeado nasce fechado — as lixeiras
   * continuam à vista, mas só cortam depois de destravado.
   */
  function guardDeletion(run: () => void) {
    if (deleteUnlocked) {
      run();
      return;
    }
    setLockShaking(true);
    window.setTimeout(() => setLockShaking(false), SHAKE_MS);
  }

  function toggleTypeLock(index: number) {
    setUnlockedTypes((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }
  // O modo legado não tem documento, mas continua precisando excluir coluna da
  // análise — 'ignorar' saiu da roda e o interruptor virou o único caminho.
  const [legacyColumnEnabled, setLegacyColumnEnabled] = useState<boolean[]>(() => headers.map(() => true));

  useEffect(() => {
    if (!document) setLegacyRoles(detectedRoles);
  }, [detectedRoles, document]);

  const columnEnabled = (index: number): boolean => (document
    ? document.columns[index]?.enabled !== false
    : legacyColumnEnabled[index] !== false);

  const roles = document
    ? document.columns.map((column) => column.type)
    : legacyRoles;

  const recognizedColumns = useMemo(() => {
    if (!document || !testId || !tabularOptions) return legacyRecognizedColumns;
    return deriveRecognizedColumnsFromDocument(document, testId, tabularOptions);
  }, [document, legacyRecognizedColumns, tabularOptions, testId]);

  const bindingKeys = useMemo(() => {
    if (!document || !testId || !tabularOptions) return [];
    return [...new Set([
      ...(tabularOptions.requiredKeys ?? []),
      ...Object.keys(tabularOptions.aliases ?? {}),
      ...(tabularOptions.numericKeys ?? []),
      ...(tabularOptions.temporalKeys ?? []),
    ])];
  }, [document, tabularOptions, testId]);

  const requiredBindingKeys = useMemo(
    () => new Set(tabularOptions?.requiredKeys ?? []),
    [tabularOptions?.requiredKeys],
  );
  const requiredMappingsComplete = useMemo(
    () => (tabularOptions?.requiredKeys ?? [])
      .every((key) => recognizedColumns[key] !== undefined),
    [recognizedColumns, tabularOptions?.requiredKeys],
  );
  const pageSize = document ? 50 : maxPreviewRows;
  const totalPages = Math.max(1, Math.ceil(bodyRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const startRow = currentPage * pageSize;
  const previewRows = bodyRows.slice(startRow, startRow + pageSize);

  const validity = useMemo(
    () => document && testId && tabularOptions && requiredMappingsComplete
      ? tableValiditySummary(
        document,
        testId,
        tabularOptions.requiredKeys ?? [],
        tabularOptions.numericKeys ?? [],
        recognizedColumns,
        tabularOptions.temporalKeys ?? [],
        { allowPartialRequiredRows: confirmMode === 'independent-columns' },
      )
      : null,
    [confirmMode, document, recognizedColumns, requiredMappingsComplete, tabularOptions, testId],
  );

  // validateTableSize lança quando estoura; o botão precisa nascer desabilitado
  // no teto, porque a persistência recusaria o snapshot depois do fato.
  function exceedsLimits(dataRows: number, columns: number): boolean {
    try {
      validateTableSize(dataRows, columns);
      return false;
    } catch {
      return true;
    }
  }

  const rowLimitReached = !document
    || exceedsLimits(document.rows.length + 1, document.columns.length);
  const columnLimitReached = !document
    || exceedsLimits(document.rows.length, document.columns.length + 1);

  const isValid = useMemo(() => {
    if (headers.length < 2) return false;
    if (tabularOptions && (document || confirmMode === 'categorical-pair')) {
      return requiredMappingsComplete && (!validity || validity.valid > 0);
    }
    return roles.some((role) => role === 'numerica');
  }, [confirmMode, document, headers.length, requiredMappingsComplete, roles, tabularOptions, validity]);

  const effectiveLegacyRoles: ColumnRole[] = roles.map(
    (role, index) => (columnEnabled(index) ? role : 'ignorar'),
  );

  const typesChanged = roles.some((role, index) => role !== detectedRoles[index]);

  function handleResetColumnTypes() {
    if (document) applyDocument(resetTableColumnTypes(document));
    else setLegacyRoles(detectedRoles);
    onRoleAdjust?.();
  }

  function applyDocument(next: TableDocument) {
    if (next !== document) onDocumentChange?.(next);
  }

  function handleHeaderChange(index: number, value: string) {
    if (document) {
      applyDocument(setTableColumnName(document, document.columns[index]!.id, value));
      return;
    }
    setLegacyHeaders((previous) => previous.map(
      (header, position) => (position === index ? value : header),
    ));
  }

  function handleCellChange(rowIndex: number, columnIndex: number, value: string) {
    if (document) {
      applyDocument(setTableCell(document, rowIndex, columnIndex, value));
      return;
    }
    setLegacyRows((previous) => previous.map((row, position) => (
      position === rowIndex
        ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell))
        : row
    )));
  }

  function handleColumnTypeChange(index: number, role: ColumnRole) {
    if (document) {
      applyDocument(setTableColumnType(document, document.columns[index]!.id, role));
    } else {
      setLegacyRoles((previous) => previous.map(
        (value, position) => (position === index ? role : value),
      ));
    }
    onRoleAdjust?.();
  }

  // Edição estrutural só existe no modo documento — o modo legado (TesteDemo e
  // parte dos testes) não tem mutadores.
  function handleRowEnabledChange(rowIndex: number, enabled: boolean) {
    if (!document) return;
    applyDocument(setTableRowEnabled(document, rowIndex, enabled));
    onRoleAdjust?.();
  }

  function handleRemoveRow(rowIndex: number) {
    if (!document) return;
    const commit = () => {
      setRowRemoving(null);
      setRowPendingRemoval(null);
      setRowHighlighted(null);
      applyDocument(removeTableRow(document, rowIndex));
      onRoleAdjust?.();
    };
    if (prefersReducedMotion()) {
      commit();
      return;
    }
    setRowRemoving(rowIndex);
    window.setTimeout(commit, LEAVE_MS);
  }

  function handleAddRow() {
    if (!document || rowLimitReached) return;
    // A linha nova é sempre a última: marcá-la antes de aplicar garante que ela
    // já nasça com a classe de entrada no primeiro quadro.
    flagEntering(setRowEntering, document.rows.length);
    applyDocument(addTableRow(document));
    onRoleAdjust?.();
  }

  function handleColumnEnabledChange(index: number, enabled: boolean) {
    if (document) {
      applyDocument(setTableColumnEnabled(document, document.columns[index]!.id, enabled));
    } else {
      setLegacyColumnEnabled((previous) => {
        const next = headers.map((_, position) => previous[position] !== false);
        next[index] = enabled;
        return next;
      });
    }
    onRoleAdjust?.();
  }

  function handleRemoveColumn(index: number) {
    if (!document) return;
    const columnId = document.columns[index]!.id;
    const commit = () => {
      setColumnRemoving(null);
      setRowPendingRemoval(null);
      applyDocument(removeTableColumn(document, columnId));
      onRoleAdjust?.();
    };
    // A coluna não é um nó só: são N células em N linhas. A saída é por classe,
    // e o documento só muda quando a transição termina.
    if (prefersReducedMotion()) {
      commit();
      return;
    }
    setColumnRemoving(index);
    window.setTimeout(commit, LEAVE_MS);
  }

  function handleAddColumn() {
    if (!document || columnLimitReached) return;
    flagEntering(setColumnEntering, document.columns.length);
    applyDocument(addTableColumn(document, `Coluna ${document.columns.length + 1}`));
    onRoleAdjust?.();
  }

  function handleBindingChange(role: string, columnId: string) {
    if (!document || !testId) return;
    applyDocument(setTableRoleBinding(document, testId, role, columnId || null));
  }

  function handleConfirm() {
    onConfirm({
      headers,
      rows: bodyRows,
      recognizedColumns: tabularOptions
        ? document && testId
          ? deriveRecognizedColumnsFromDocument(document, testId, tabularOptions)
          : deriveRecognizedColumnsFromRoles(effectiveLegacyRoles, headers, tabularOptions)
        : legacyRecognizedColumns,
    });
  }

  return (
    <div className="space-y-3">
      {/* Sempre montado, só desabilitado enquanto nada foi ajustado: aparecer e
          sumir empurraria o bloco inteiro. Sem pill, só ícone e texto. */}
      <div className="flex items-center justify-between gap-3">
        {document ? (
          <p className="text-sm text-muted-foreground">
            Origem: <strong className="text-foreground">{document.sourceLabel}</strong>
          </p>
        ) : <span />}
        <div className="flex shrink-0 items-center gap-3">
        {document ? (
          <button
            type="button"
            onClick={() => setDeleteUnlocked((previous) => !previous)}
            aria-pressed={!deleteUnlocked}
            aria-label={
              deleteUnlocked
                ? 'Travar exclusão de linhas e colunas'
                : 'Destravar exclusão de linhas e colunas'
            }
            title={
              deleteUnlocked
                ? 'Exclusão liberada. Clique para travar de novo.'
                : 'Exclusão travada: destrave para poder apagar linhas e colunas.'
            }
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 bg-transparent text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              lockShaking ? 'animate-shake-lock text-destructive' : 'text-muted-foreground hover:text-white',
            )}
          >
            {deleteUnlocked
              ? <Unlock className="size-3.5" aria-hidden />
              : <Lock className="size-3.5" aria-hidden />}
            {deleteUnlocked ? 'Exclusão liberada' : 'Exclusão travada'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleResetColumnTypes}
          disabled={!typesChanged}
          aria-label="Redefinir tipos das colunas"
          title="Redefinir tipos das colunas para a detecção automática"
          className="inline-flex shrink-0 items-center gap-1.5 bg-transparent text-xs font-bold text-muted-foreground transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <History className="size-3.5" aria-hidden />
          Redefinir tipos
        </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr>
              {headers.map((header, index) => {
                const label = header || `Coluna ${index + 1}`;
                return (
                  <th
                    key={document?.columns[index]?.id ?? `h-${index}`}
                    data-disabled={columnEnabled(index) ? undefined : 'true'}
                    className={cn(
                      'lacir-preview-head border-b border-border px-3 py-2 text-center align-bottom',
                      columnRemoving === index && 'lacir-col-leaving',
                      columnEntering === index && 'lacir-col-entering',
                    )}
                  >
                    <div
                      className={cn(
                        'group/col relative mx-auto flex w-44 flex-col gap-1.5 text-center',
                        !columnEnabled(index) && 'opacity-50',
                      )}
                    >
                      {/* "COLUNA N" volta a ser centralizado, no mesmo eixo da
                          roda; os controles flutuam e só aparecem no hover. */}
                      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
                        Coluna {index + 1}
                      </span>
                      <span className="pointer-events-none absolute right-0 top-0 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/col:pointer-events-auto group-hover/col:opacity-100 group-focus-within/col:pointer-events-auto group-focus-within/col:opacity-100">
                        <label className="inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            aria-label={`Incluir coluna ${label} na análise`}
                            checked={columnEnabled(index)}
                            onChange={(event) => handleColumnEnabledChange(index, event.target.checked)}
                            className="peer sr-only"
                          />
                          <FilterCheck
                            checked={columnEnabled(index)}
                            size={14}
                            className="peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--color-accent)]"
                          />
                        </label>
                        {document ? (
                          <button
                            type="button"
                            aria-label={`Excluir coluna ${label}`}
                            aria-disabled={deleteUnlocked ? undefined : 'true'}
                            title={deleteUnlocked ? undefined : 'Destrave a exclusão para apagar esta coluna'}
                            onClick={() => guardDeletion(() => handleRemoveColumn(index))}
                            className={cn(
                              'rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              deleteUnlocked
                                ? 'text-muted-foreground hover:text-destructive'
                                : 'text-muted-foreground/50',
                            )}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </span>
                      <div className="flex items-center justify-center gap-1.5">
                        {editable ? (
                          <input
                            aria-label={`Nome da coluna ${index + 1}`}
                            value={header}
                            onChange={(event) => handleHeaderChange(index, event.target.value)}
                            className="w-full min-w-24 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-center text-sm font-bold text-foreground hover:border-border focus:border-primary focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm font-bold text-foreground">{label}</span>
                        )}
                      </div>
                      <div className="relative flex flex-col items-center gap-1 text-xs font-normal text-muted-foreground">
                        Tipo dos dados
                        {/* A roda nasce travada: trocar o tipo é decisão
                            deliberada, não um giro acidental de scroll. */}
                        <button
                          type="button"
                          aria-label={
                            unlockedTypes.has(index)
                              ? `Travar o tipo da coluna ${label}`
                              : `Destravar o tipo da coluna ${label}`
                          }
                          aria-pressed={!unlockedTypes.has(index)}
                          onClick={() => toggleTypeLock(index)}
                          className="absolute right-0 top-0 z-10 rounded-md p-0.5 text-white opacity-0 transition-opacity hover:text-white/70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/col:opacity-100"
                        >
                          {unlockedTypes.has(index)
                            ? <Unlock className="size-3.5" aria-hidden />
                            : <Lock className="size-3.5" aria-hidden />}
                        </button>
                        <WheelPicker
                          ariaLabel={`Tipo da coluna ${label}`}
                          options={COLUMN_ROLE_OPTIONS}
                          value={roles[index]}
                          onChange={(value) => handleColumnTypeChange(index, value as ColumnRole)}
                          disabled={!unlockedTypes.has(index)}
                          width={116}
                          className="lacir-wheel-compact"
                        />
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, offset) => {
              const rowIndex = startRow + offset;
              return (
                <tr
                  key={document ? `${document.id}-r-${rowIndex}` : rowIndex}
                  data-removing={rowPendingRemoval === rowIndex ? 'true' : undefined}
                  data-row-hover={rowHighlighted === rowIndex ? 'true' : undefined}
                  data-disabled={document && !isRowEnabled(document, rowIndex) ? 'true' : undefined}
                  className="lacir-preview-row group/row"
                >
                  {headers.map((_, columnIndex) => (
                    <td
                      key={document?.columns[columnIndex]?.id ?? columnIndex}
                      // A coluna desmarcada precisa apagar o corpo da tabela, e
                      // não só o cabeçalho; o CSS lê este atributo.
                      data-disabled={
                        (document && !isRowEnabled(document, rowIndex)) || !columnEnabled(columnIndex)
                          ? 'true'
                          : undefined
                      }
                      className={cn(
                        'border-b border-border/60 px-2 py-1 text-center text-foreground',
                        columnIndex === 0 && 'relative',
                        columnRemoving === columnIndex && 'lacir-col-leaving',
                        columnEntering === columnIndex && 'lacir-col-entering',
                        rowRemoving === rowIndex && 'lacir-row-leaving',
                        rowEntering === rowIndex && 'lacir-row-entering',
                      )}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-data)',
                        lineHeight: 'var(--text-data--line-height)',
                      }}
                    >
                      {editable ? (
                        <input
                          aria-label={`Linha ${rowIndex + 1}, coluna ${columnIndex + 1}`}
                          value={row[columnIndex] ?? ''}
                          onChange={(event) => handleCellChange(
                            rowIndex,
                            columnIndex,
                            event.target.value,
                          )}
                          className="w-full min-w-16 rounded-none border border-transparent bg-transparent px-1 py-0.5 text-center focus:border-primary focus:outline-none"
                        />
                      ) : row[columnIndex] ?? ''}
                      {/* Ancorados à direita da primeira célula e revelados no
                          hover da linha: sem coluna própria, sem deslocamento. */}
                      {document && columnIndex === 0 ? (
                        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center gap-1 pl-1 opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100">
                          <label
                            className="inline-flex cursor-pointer items-center"
                            onMouseEnter={() => setRowHighlighted(rowIndex)}
                            onMouseLeave={() => setRowHighlighted(null)}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Incluir linha ${rowIndex + 1} na análise`}
                              onFocus={() => setRowHighlighted(rowIndex)}
                              onBlur={() => setRowHighlighted(null)}
                              checked={isRowEnabled(document, rowIndex)}
                              onChange={(event) => handleRowEnabledChange(rowIndex, event.target.checked)}
                              className="peer sr-only"
                            />
                            <FilterCheck
                              checked={isRowEnabled(document, rowIndex)}
                              size={14}
                              className="peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--color-accent)]"
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={
                              String(row[0] ?? '').trim()
                                ? `Excluir linha ${rowIndex + 1} (${String(row[0]).trim()})`
                                : `Excluir linha ${rowIndex + 1}`
                            }
                            aria-disabled={deleteUnlocked ? undefined : 'true'}
                            title={deleteUnlocked ? undefined : 'Destrave a exclusão para apagar esta linha'}
                            onClick={() => guardDeletion(() => handleRemoveRow(rowIndex))}
                            onMouseEnter={() => setRowPendingRemoval(rowIndex)}
                            onMouseLeave={() => setRowPendingRemoval(null)}
                            onFocus={() => setRowPendingRemoval(rowIndex)}
                            onBlur={() => setRowPendingRemoval(null)}
                            className={cn(
                              'rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              deleteUnlocked
                                ? 'text-muted-foreground hover:text-destructive'
                                : 'text-muted-foreground/50',
                            )}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fora da <table> de propósito: dentro de um <tfoot><tr> estes botões
          contariam como uma linha a mais na árvore acessível. */}
      {document ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={rowLimitReached}
          >
            <Plus className="size-3.5" aria-hidden />
            Adicionar linha
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddColumn}
            disabled={columnLimitReached}
          >
            <Plus className="size-3.5" aria-hidden />
            Adicionar coluna
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Mostrando {previewRows.length} de {bodyRows.length} linhas</span>
        {document ? (
          <>
            <span aria-live="polite">Página {currentPage + 1} de {totalPages}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={currentPage === 0}
            >
              Página anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              Próxima página
            </Button>
          </>
        ) : null}
      </div>

      {validity ? (
        <section aria-label="Validade das linhas" className="rounded-lg border border-border p-3">
          <p className="text-sm text-foreground" aria-live="polite">
            <strong>{validity.valid}</strong> válidas ·{' '}
            <strong>{validity.incomplete.length}</strong> incompletas ·{' '}
            <strong>{validity.invalid.length}</strong> inválidas
          </p>
          {validity.incomplete.length || validity.invalid.length ? (
            <details className="mt-2 text-sm text-muted-foreground">
              <summary className="cursor-pointer font-bold text-foreground">
                Ver linhas que precisam de revisão
              </summary>
              {validity.incomplete.length ? (
                <p className="mt-2">Incompletas: {problemRowsText(validity.incomplete)}</p>
              ) : null}
              {validity.invalid.length ? (
                <p className="mt-1">Inválidas: {problemRowsText(validity.invalid)}</p>
              ) : null}
            </details>
          ) : null}
        </section>
      ) : null}

      {document && tabularOptions && !requiredMappingsComplete ? (
        <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-foreground" role="status">
          Vincule todos os papéis obrigatórios a colunas diferentes para analisar.
        </p>
      ) : null}

      {effectiveImportWarnings.length ? (
        <section
          aria-label="Avisos da importação"
          className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm"
        >
          <p className="font-bold text-foreground">Avisos da importação</p>
          <ul className="mt-1 list-disc pl-5">
            {effectiveImportWarnings.map((warning) => (
              <li key={`${warning.cellReference}-${warning.rowNumber}-${warning.columnIndex}-${warning.code}`}>
                {warning.cellReference} (linha original {warning.rowNumber}): {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* A ação principal fica sozinha no eixo da tabela, maior e em verde; o
          descarte vira texto solto embaixo, sem disputar peso com ela. */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <SpecularButton
          type="button"
          size="lg"
          tone="accent"
          disabled={!isValid || confirmDisabled}
          onClick={handleConfirm}
        >
          Analisar dados
        </SpecularButton>
        <button
          type="button"
          className="lacir-danger-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            if (onClear) {
              onClear();
            } else if (onRoleAdjust) {
              onRoleAdjust();
            } else if (onDocumentChange && document) {
              onDocumentChange({ ...document, rows: [] });
            }
          }}
        >
          Limpar tabela
        </button>
      </div>
    </div>
  );
}
