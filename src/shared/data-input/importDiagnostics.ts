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
  validateImportLimit('dataRows', bodyRows.length);
  validateImportLimit('columns', headers.length);

  let width = headers.length;
  for (const row of bodyRows) {
    validateImportLimit('columns', row.length);
    if (row.length > width) width = row.length;
  }

  validateImportLimit('columns', width);
  validateTableSize(bodyRows.length, width);

  let widerRowCount = 0;
  let shorterRowCount = 0;
  const widerRowNumbers: number[] = [];
  const shorterRowNumbers: number[] = [];
  bodyRows.forEach((row, index) => {
    if (row.length > headers.length) {
      widerRowCount += 1;
      if (widerRowNumbers.length < 100) widerRowNumbers.push(index + 1);
    }
    if (row.length < width) {
      shorterRowCount += 1;
      if (shorterRowNumbers.length < 100) shorterRowNumbers.push(index + 1);
    }
  });
  const diagnostics: ImportDiagnostic[] = [
    ...(widerRowCount ? [{
      code: 'extra_cells' as const,
      severity: 'warning' as const,
      message: `${widerRowCount} linha(s) tinham células além do cabeçalho; elas foram tornadas visíveis.`,
      rowNumbers: widerRowNumbers,
    }] : []),
    ...(shorterRowCount ? [{
      code: 'short_rows' as const,
      severity: 'warning' as const,
      message: `${shorterRowCount} linha(s) tinham menos células e foram completadas como ausentes.`,
      rowNumbers: shorterRowNumbers,
    }] : []),
  ];

  return {
    headers: Array.from({ length: width }, (_, index) => String(headers[index] ?? '').trim() || `Coluna ${index + 1}`),
    bodyRows: bodyRows.map((row) => Array.from({ length: width }, (_, index) => String(row[index] ?? ''))),
    diagnostics,
  };
}
