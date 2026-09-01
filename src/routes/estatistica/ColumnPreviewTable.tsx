import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  deriveRecognizedColumnsFromDocument,
  tableValiditySummary,
} from '@/shared/data-input/analysisTable';
import {
  setTableCell,
  setTableColumnName,
  setTableColumnType,
  setTableRoleBinding,
  type TableDocument,
} from '@/shared/data-input/tableDocument';
import {
  deriveRecognizedColumnsFromRoles,
  type TabularColumnRole,
} from '@/shared/data-input/recognizedColumnsFromTabular';
import { parseNumber } from '@/shared/data-input/legacyAdapters';
import { isSupportedTemporalToken } from '@/shared/data-input/temporalPeriods';
import type { ImportWarning, TabularInputOptions } from '@/shared/data-input/types';
import { ImportSummary } from './ImportSummary';

export type ColumnRole = TabularColumnRole;

const ROLE_OPTIONS: Array<{ value: ColumnRole; label: string }> = [
  { value: 'numerica', label: 'Numérica' },
  { value: 'categorica', label: 'Categórica' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'ignorar', label: 'Ignorar' },
];

const ROLE_LABELS: Record<string, string> = {
  desfecho: 'desfecho',
  grupo: 'grupo',
  grupo_a: 'grupo A',
  grupo_b: 'grupo B',
  variavel_x: 'X',
  variavel_y: 'Y',
  tempo: 'tempo',
  id: 'identificador',
  unidade: 'unidade',
  exposicao: 'exposição',
  contagem: 'contagem',
  resposta: 'resposta',
  observacao_opcional: 'observação',
};

const MAX_LISTED_PROBLEM_ROWS = 20;

export type ColumnPreviewConfirmMode = 'numeric-required' | 'categorical-pair';

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
  /** Stable draft API used by all real analysis modules. */
  document?: TableDocument;
  testId?: string;
  onDocumentChange?: (document: TableDocument) => void;
  importWarnings?: ImportWarning[];
}

function looksNumeric(raw: string): boolean {
  return Boolean(raw.trim()) && parseNumber(raw) !== null;
}

function looksTemporal(raw: string): boolean {
  const token = raw.trim();
  return isSupportedTemporalToken(token)
    && (parseNumber(token) === null || /^\d{4}(?:\.[1-4])?$/.test(token));
}

function detectColumnRole(columnIndex: number, rows: string[][]): ColumnRole {
  const values = rows
    .map((row) => row[columnIndex] ?? '')
    .filter((value) => value.trim() !== '');

  if (!values.length) return 'categorica';
  if (values.filter(looksTemporal).length / values.length >= 0.6) return 'tempo';
  return values.filter(looksNumeric).length / values.length >= 0.6 ? 'numerica' : 'categorica';
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replaceAll('_', ' ');
}

function columnLabel(header: string, index: number): string {
  return `${header || `Coluna ${index + 1}`} · coluna ${index + 1}`;
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
  document,
  testId,
  onDocumentChange,
  importWarnings = [],
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
    () => headers.map((_, index) => detectColumnRole(index, bodyRows)),
    [headers, bodyRows],
  );
  const [legacyRoles, setLegacyRoles] = useState<ColumnRole[]>(detectedRoles);

  useEffect(() => {
    if (!document) setLegacyRoles(detectedRoles);
  }, [detectedRoles, document]);

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
  const explicitBindings = document && testId ? document.bindings[testId] ?? {} : {};
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
      )
      : null,
    [document, recognizedColumns, requiredMappingsComplete, tabularOptions, testId],
  );

  const isValid = useMemo(() => {
    if (headers.length < 2) return false;
    if (tabularOptions && (document || confirmMode === 'categorical-pair')) {
      return requiredMappingsComplete && (!validity || validity.valid > 0);
    }
    return roles.some((role) => role === 'numerica');
  }, [confirmMode, document, headers.length, requiredMappingsComplete, roles, tabularOptions, validity]);

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
          : deriveRecognizedColumnsFromRoles(roles, headers, tabularOptions)
        : legacyRecognizedColumns,
    });
  }

  return (
    <div className="space-y-3">
      {document ? (
        <p className="text-sm text-muted-foreground">
          Origem: <strong className="text-foreground">{document.sourceLabel}</strong>
        </p>
      ) : null}

      {importSummary ? <ImportSummary summary={importSummary} /> : null}

      {bindingKeys.length ? (
        <section
          aria-label="Vinculações para esta análise"
          className="rounded-lg border border-border bg-muted/20 p-3"
        >
          <p className="text-sm font-bold text-foreground">Papéis desta análise</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha qual coluna representa cada papel. Isso é independente do tipo dos dados.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {bindingKeys.map((role) => {
              const selectedIndex = recognizedColumns[role];
              const selectedId = selectedIndex === undefined
                ? ''
                : document?.columns[selectedIndex]?.id ?? String(selectedIndex);
              const usedIndexes = new Set(
                Object.entries(explicitBindings)
                  .filter(([boundRole]) => boundRole !== role)
                  .map(([, columnId]) => columnId === null
                    ? -1
                    : document?.columns.findIndex((column) => column.id === columnId))
                  .filter((index): index is number => index !== undefined && index >= 0),
              );
              const isExplicit = Object.hasOwn(explicitBindings, role);
              const bindingStatus = isExplicit
                ? explicitBindings[role] === null ? 'não selecionado por você' : 'definido por você'
                : selectedIndex === undefined
                  ? 'não definido'
                  : 'sugerido automaticamente';

              return (
                <label key={role} className="flex flex-col gap-1 text-xs font-bold text-foreground">
                  <span>
                    {roleLabel(role)}
                    {requiredBindingKeys.has(role) ? ' (obrigatório)' : ' (opcional)'}
                  </span>
                  <select
                    aria-label={`Vincular ${roleLabel(role)}`}
                    value={selectedId}
                    onChange={(event) => handleBindingChange(role, event.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-normal"
                  >
                    <option value="">Não selecionada</option>
                    {headers.map((header, index) => {
                      const id = document?.columns[index]?.id ?? String(index);
                      return (
                        <option key={id} value={id} disabled={usedIndexes.has(index)}>
                          {columnLabel(header, index)}
                        </option>
                      );
                    })}
                  </select>
                  <span className="font-normal text-muted-foreground">{bindingStatus}</span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr>
              {headers.map((header, index) => {
                const label = header || `Coluna ${index + 1}`;
                const isUsed = Object.values(recognizedColumns).includes(index);
                return (
                  <th
                    key={document?.columns[index]?.id ?? `h-${index}`}
                    className="border-b border-border px-3 py-2 text-left align-bottom"
                  >
                    <div className="flex min-w-40 flex-col gap-1.5">
                      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
                        Coluna {index + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {editable ? (
                          <input
                            aria-label={`Nome da coluna ${index + 1}`}
                            value={header}
                            onChange={(event) => handleHeaderChange(index, event.target.value)}
                            className="w-full min-w-24 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-foreground hover:border-border focus:border-primary focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm font-bold text-foreground">{label}</span>
                        )}
                        {isUsed ? (
                          <span className="shrink-0 text-xs font-bold text-primary">em uso</span>
                        ) : null}
                      </div>
                      <label className="flex flex-col gap-1 text-xs font-normal text-muted-foreground">
                        Tipo dos dados
                        <select
                          aria-label={`Tipo da coluna ${label}`}
                          value={roles[index]}
                          onChange={(event) => handleColumnTypeChange(
                            index,
                            event.target.value as ColumnRole,
                          )}
                          className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      {roles[index] !== detectedRoles[index] ? (
                        <span className="text-xs font-bold text-warning">tipo ajustado por você</span>
                      ) : null}
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
                <tr key={document ? `${document.id}-r-${rowIndex}` : rowIndex}>
                  {headers.map((_, columnIndex) => (
                    <td
                      key={document?.columns[columnIndex]?.id ?? columnIndex}
                      className="border-b border-border/60 px-2 py-1 text-foreground"
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
                          className="w-full min-w-16 rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-border focus:border-primary focus:outline-none"
                        />
                      ) : row[columnIndex] ?? ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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

      {!importSummary && effectiveImportWarnings.length ? (
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

      <Button
        type="button"
        disabled={!isValid || confirmDisabled}
        onClick={handleConfirm}
      >
        Analisar dados
      </Button>
    </div>
  );
}
