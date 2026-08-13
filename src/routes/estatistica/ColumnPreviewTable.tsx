import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  deriveRecognizedColumnsFromRoles,
  type TabularColumnRole,
} from '@/shared/data-input/recognizedColumnsFromTabular';
import type { TabularInputOptions } from '@/shared/data-input/types';

export type ColumnRole = TabularColumnRole;

const ROLE_OPTIONS: Array<{ value: ColumnRole; label: string }> = [
  { value: 'numerica', label: 'Numérica' },
  { value: 'categorica', label: 'Categórica' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'ignorar', label: 'Ignorar' },
];

export type ColumnPreviewConfirmMode = 'numeric-required' | 'categorical-pair';

export interface ColumnPreviewTableProps {
  headers: string[];
  bodyRows: string[][];
  /** Domain key → column index, as produced by useTabularInput. */
  recognizedColumns: Record<string, number>;
  tabularOptions?: TabularInputOptions;
  /** When categorical-pair, confirm requires all requiredKeys mapped (Phase 3 χ²). */
  confirmMode?: ColumnPreviewConfirmMode;
  onRoleAdjust?: () => void;
  onConfirm: (confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) => void;
  maxPreviewRows?: number;
  /** Allow editing cells / headers by clicking (single-scroll Estatística). */
  editable?: boolean;
  /** Additional study-design gate owned by the calling test module. */
  confirmDisabled?: boolean;
}

function normalizeNumericToken(raw: string): string {
  return raw.trim().replace(/\./g, '').replace(',', '.');
}

function looksNumeric(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return Number.isFinite(Number(normalizeNumericToken(value)));
}

function looksTemporal(raw: string): boolean {
  const value = raw.trim();
  return /^\d{4}([/-]\d{1,2}){0,2}$/.test(value) || /^\d{1,2}\/\d{4}$/.test(value);
}

function detectColumnRole(columnIndex: number, bodyRows: string[][]): ColumnRole {
  const values = bodyRows.map((row) => row[columnIndex] ?? '').filter((value) => value.trim() !== '');
  if (!values.length) return 'categorica';

  const temporalRatio = values.filter(looksTemporal).length / values.length;
  if (temporalRatio >= 0.6) return 'tempo';

  const numericRatio = values.filter(looksNumeric).length / values.length;
  if (numericRatio >= 0.6) return 'numerica';

  return 'categorica';
}

/**
 * Confirmable column preview: auto-detected roles, optional inline cell edits,
 * confirm emits the full (possibly edited) row set.
 */
export function ColumnPreviewTable({
  headers: initialHeaders,
  bodyRows: initialRows,
  recognizedColumns,
  tabularOptions,
  confirmMode = 'numeric-required',
  onRoleAdjust,
  onConfirm,
  maxPreviewRows = 8,
  editable = true,
  confirmDisabled = false,
}: ColumnPreviewTableProps) {
  const [headers, setHeaders] = useState(initialHeaders);
  const [bodyRows, setBodyRows] = useState(initialRows);

  useEffect(() => {
    setHeaders(initialHeaders);
    setBodyRows(initialRows);
  }, [initialHeaders, initialRows]);

  const detectedRoles = useMemo(
    () => headers.map((_, index) => detectColumnRole(index, bodyRows)),
    [headers, bodyRows],
  );
  const [roles, setRoles] = useState<ColumnRole[]>(detectedRoles);

  useEffect(() => {
    setRoles(detectedRoles);
  }, [detectedRoles]);

  const recognizedIndexes = useMemo(() => new Set(Object.values(recognizedColumns)), [recognizedColumns]);

  const previewRows = bodyRows.slice(0, maxPreviewRows);
  const isValid = useMemo(() => {
    if (headers.length < 2) return false;
    if (confirmMode === 'categorical-pair' && tabularOptions) {
      const mapped = deriveRecognizedColumnsFromRoles(roles, headers, tabularOptions);
      const required = tabularOptions.requiredKeys ?? [];
      return required.every((key) => mapped[key] !== undefined);
    }
    return roles.some((role) => role === 'numerica');
  }, [confirmMode, headers, roles, tabularOptions]);

  function handleRoleChange(index: number, role: ColumnRole) {
    setRoles((previous) => previous.map((value, position) => (position === index ? role : value)));
    onRoleAdjust?.();
  }

  function handleHeaderChange(index: number, value: string) {
    setHeaders((prev) => prev.map((h, i) => (i === index ? value : h)));
  }

  function handleCellChange(rowIndex: number, columnIndex: number, value: string) {
    setBodyRows((prev) =>
      prev.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === columnIndex ? value : cell)) : row,
      ),
    );
  }

  function handleConfirm() {
    const confirmedRecognizedColumns = tabularOptions
      ? deriveRecognizedColumnsFromRoles(roles, headers, tabularOptions)
      : recognizedColumns;
    onConfirm({ headers, rows: bodyRows, recognizedColumns: confirmedRecognizedColumns });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr>
              {headers.map((header, index) => {
                const label = header || `Coluna ${index + 1}`;
                return (
                  <th key={`h-${index}`} className="border-b border-border px-3 py-2 text-left align-bottom">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        {editable ? (
                          <input
                            aria-label={`Nome da coluna ${index + 1}`}
                            value={header}
                            onChange={(e) => handleHeaderChange(index, e.target.value)}
                            className="w-full min-w-[6rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-foreground hover:border-border focus:border-primary focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm font-bold text-foreground">{label}</span>
                        )}
                        {recognizedIndexes.has(index) ? (
                          <span className="shrink-0 text-xs font-bold text-primary">detectado</span>
                        ) : null}
                      </div>
                      <select
                        aria-label={`Papel da coluna ${label}`}
                        value={roles[index]}
                        onChange={(event) => handleRoleChange(index, event.target.value as ColumnRole)}
                        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground"
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {roles[index] !== detectedRoles[index] ? (
                        <span className="text-xs font-bold text-warning">ajustado</span>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((_, columnIndex) => (
                  <td
                    key={columnIndex}
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
                        onChange={(e) => handleCellChange(rowIndex, columnIndex, e.target.value)}
                        className="w-full min-w-[4rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-border focus:border-primary focus:outline-none"
                      />
                    ) : (
                      (row[columnIndex] ?? '')
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Mostrando {previewRows.length} de {bodyRows.length} linhas
        {editable ? ' · clique para editar células ou nomes de coluna' : ''}
      </p>
      <Button type="button" disabled={!isValid || confirmDisabled} onClick={handleConfirm}>
        Analisar dados
      </Button>
    </div>
  );
}
