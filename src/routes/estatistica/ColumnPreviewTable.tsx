import { useMemo, useState } from 'react';
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

/**
 * Auto-detects a column's role from its actual pasted/uploaded values — not
 * from domain aliases, since this component is generic across every future
 * test module (D-10). A column with mostly numeric cells is "numérica", a
 * column with year/date-shaped cells is "tempo", otherwise "categórica".
 */
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
 * Confirmable column preview (D-10): auto-detected roles are pre-selected,
 * adjustable per column, and flagged "ajustado" once the user overrides the
 * detected value. Confirm emits the full row set, not just the preview slice.
 */
export function ColumnPreviewTable({
  headers,
  bodyRows,
  recognizedColumns,
  tabularOptions,
  confirmMode = 'numeric-required',
  onRoleAdjust,
  onConfirm,
  maxPreviewRows = 8,
}: ColumnPreviewTableProps) {
  const detectedRoles = useMemo(
    () => headers.map((_, index) => detectColumnRole(index, bodyRows)),
    [headers, bodyRows],
  );
  const [roles, setRoles] = useState<ColumnRole[]>(detectedRoles);

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
  }, [confirmMode, headers.length, roles, tabularOptions]);

  function handleRoleChange(index: number, role: ColumnRole) {
    setRoles((previous) => previous.map((value, position) => (position === index ? role : value)));
    onRoleAdjust?.();
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
                  <th key={`${label}-${index}`} className="border-b border-border px-3 py-2 text-left align-bottom">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-foreground">{label}</span>
                        {recognizedIndexes.has(index) ? (
                          <span className="text-xs font-bold text-primary">detectado</span>
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
                    className="border-b border-border/60 px-3 py-1.5 text-foreground"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-data)', lineHeight: 'var(--text-data--line-height)' }}
                  >
                    {row[columnIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Mostrando {previewRows.length} de {bodyRows.length} linhas
      </p>
      <Button type="button" disabled={!isValid} onClick={handleConfirm}>
        Analisar dados
      </Button>
    </div>
  );
}
