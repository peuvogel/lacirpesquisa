import { validateImportLimit, validateTableSize } from './importLimits';
import type { ImportWarning } from './types';

export interface ImportDiagnostic {
  code: 'duplicate_headers' | 'short_rows' | 'extra_cells'
    | 'positional_mapping' | 'decimal_comma' | 'excel_dates_converted'
    | 'possible_excel_serial' | 'mixed_numeric_format' | 'missing_tokens';
  severity: 'info' | 'warning';
  message: string;
  rowNumbers?: number[];
}

export interface TabularImportSummary {
  sourceType: 'paste' | 'file';
  fileName: string;
  tableName: string;
  sheetNames: string[];
  formatLabel: string;
  delimiter: string;
  rowCount: number;
  columnCount: number;
  headerRowNumber: number;
  recognitionMode: 'aliases' | 'position' | 'unmapped';
  recognitionDetails: string[];
  diagnostics: ImportDiagnostic[];
  importWarnings: ImportWarning[];
}

/** Returns a new rectangular matrix so every imported source cell remains editable. */
export function normalizeImportedMatrix(
  headers: readonly string[],
  bodyRows: readonly (readonly string[])[],
): { headers: string[]; bodyRows: string[][]; diagnostics: ImportDiagnostic[] } {
  const width = Math.max(headers.length, ...bodyRows.map((row) => row.length));
  validateImportLimit('columns', width);
  validateTableSize(bodyRows.length, width);

  const widerRows = bodyRows
    .map((row, index) => ({ width: row.length, rowNumber: index + 1 }))
    .filter((item) => item.width > headers.length);
  const shorterRows = bodyRows
    .map((row, index) => ({ width: row.length, rowNumber: index + 1 }))
    .filter((item) => item.width < width);
  const diagnostics: ImportDiagnostic[] = [
    ...(widerRows.length ? [{
      code: 'extra_cells' as const,
      severity: 'warning' as const,
      message: `${widerRows.length} linha(s) tinham células além do cabeçalho; elas foram tornadas visíveis.`,
      rowNumbers: widerRows.slice(0, 100).map((item) => item.rowNumber),
    }] : []),
    ...(shorterRows.length ? [{
      code: 'short_rows' as const,
      severity: 'warning' as const,
      message: `${shorterRows.length} linha(s) tinham menos células e foram completadas como ausentes.`,
      rowNumbers: shorterRows.slice(0, 100).map((item) => item.rowNumber),
    }] : []),
  ];

  return {
    headers: Array.from({ length: width }, (_, index) => String(headers[index] ?? '').trim() || `Coluna ${index + 1}`),
    bodyRows: bodyRows.map((row) => Array.from({ length: width }, (_, index) => String(row[index] ?? ''))),
    diagnostics,
  };
}
