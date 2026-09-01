/** Tabular import with bounded parsing. Numeric/DATASUS compatibility stays centralized here. */

import { validateImportLimit, validateTableSize } from './importLimits';
import { normalizeImportedMatrix } from './importDiagnostics';
import type { ImportDiagnostic, TabularImportSummary } from './importDiagnostics';
import { readXlsxTables } from './xlsxReader';
import { detectTemporalColumn, isSupportedTemporalToken } from './temporalPeriods';

import type {
  LegacyStatsAdapter,
  LegacyUtilsAdapter,
  DuplicateHeaderMatch,
  MatchTabularColumnsResult,
  ParsedDelimitedRows,
  PositionFallbackOptions,
  RecognizedColumn,
  TabularCandidate,
  TabularInputOptions,
  TabularLoadState,
  TabularLoadedState,
  WorkbookTable,
  WorkbookTablesResult,
} from './types';

export function normalizeTabularText(value: unknown): string {
  return String(value || '')
    .replace(/\uFEFF/g, '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC');
}

export function normalizeTabularSpaces(value: unknown): string {
  return normalizeTabularText(value)
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeHeaderToken(value: unknown): string {
  return normalizeTabularSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

export function splitDelimitedLine(line: string, delimiter: string, sourceType: 'paste' | 'file' = 'paste'): string[] {
  validateImportLimit(sourceType === 'file' ? 'fileBytes' : 'textCharacters', line.length);
  if (!line) return [''];

  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    const prev = line[index - 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      if (delimiter === ',' && /\d/.test(prev || '') && /\d/.test(next || '')) {
        current += char;
      } else {
        validateImportLimit('columns', cells.length + 1);
        cells.push(normalizeTabularSpaces(current));
        current = '';
      }
      continue;
    }

    current += char;
  }

  validateImportLimit('columns', cells.length + 1);
  cells.push(normalizeTabularSpaces(current));
  return cells;
}

export function detectDelimiter(lines: string[]): string {
  const sample = (lines || []).slice(0, Math.min((lines || []).length, 10));
  let semicolonScore = 0;
  let tabScore = 0;
  let commaScore = 0;
  let rawCommaScore = 0;

  sample.forEach((line) => {
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') index++;
        else quoted = !quoted;
      } else if (!quoted) {
        if (char === ';') semicolonScore++;
        else if (char === '\t') tabScore++;
        else if (char === ',') {
          rawCommaScore++;
          // Decimal commas must not outvote the actual TSV/semicolon separator.
          if (!(/\d/.test(line[index - 1] || '') && /\d/.test(line[index + 1] || ''))) commaScore++;
        }
      }
    }
  });

  if (semicolonScore > 0 && semicolonScore >= tabScore && semicolonScore >= commaScore) return ';';
  if (tabScore > 0 && tabScore >= commaScore) return '\t';
  if (rawCommaScore > 0) return ',';
  return ';';
}

export function delimiterFormatLabel(delimiter: string): string {
  if (delimiter === ';') return 'CSV com ponto e virgula';
  if (delimiter === '\t') return 'Tabela tabulada';
  if (delimiter === ',') return 'CSV/TXT';
  return 'texto';
}

export function normalizeNumericSource(raw: unknown): string {
  if (raw === null || raw === undefined) return '';

  let source = String(raw)
    .replace(/\u00A0/g, ' ')
    .trim();

  if (!source) return '';

  source = source.replace(/\s+/g, '');
  if (source.includes(',') && source.includes('.')) {
    if (source.lastIndexOf(',') > source.lastIndexOf('.')) {
      source = source.replace(/\./g, '').replace(',', '.');
    } else {
      source = source.replace(/,/g, '');
    }
  } else if (source.includes(',') && !source.includes('.')) {
    source = source.replace(',', '.');
  }

  return source;
}

export function parseTabularNumber(raw: unknown, stats: LegacyStatsAdapter | undefined): number | null {
  const normalized = normalizeNumericSource(raw);
  if (!normalized) return null;

  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;

  if (typeof stats?.parseNumber === 'function') {
    return stats.parseNumber(normalized);
  }

  return null;
}

export function rawUsesDecimalComma(raw: unknown): boolean {
  return /,\d/.test(String(raw || ''));
}

export function describeIgnoredRowReason(index: number, notes: string[] = []): string {
  const first = String(notes[0] || 'linha sem valor numérico utilizável.')
    .trim()
    .replace(/\.$/, '');
  const normalized = first
    ? `${first.charAt(0).toLowerCase()}${first.slice(1)}`
    : 'a linha não trouxe valores numéricos válidos';
  return `A linha ${index} foi ignorada porque ${normalized}.`;
}

export function parseDelimitedRows(text: string, sourceType: 'paste' | 'file' = 'paste'): ParsedDelimitedRows {
  validateImportLimit(sourceType === 'file' ? 'fileBytes' : 'textCharacters', text.length);
  const source = normalizeTabularText(text);
  // Sample at most ten logical records; never split the entire untrusted text.
  const sample: string[] = [];
  let quoted = false, start = 0;
  for (let index = 0; index <= source.length && sample.length < 10; index++) {
    if (source[index] === '"') {
      if (quoted && source[index + 1] === '"') index++;
      else quoted = !quoted;
    }
    if ((source[index] === '\n' && !quoted) || index === source.length) {
      const line = source.slice(start, index);
      if (line.trim()) sample.push(line);
      start = index + 1;
    }
  }
  if (!sample.length) return { rows: [], delimiter: ';', formatLabel: 'texto' };
  const delimiter = detectDelimiter(sample), rows: string[][] = [];
  let cells: string[] = [], cellQuoted = false, closedQuote = false, cellStart = 0, quoteEnd = 0;
  let rowQuoted = false, rowStart = 0, columns = 0, headerWidth = 0, cellHasContent = false, recordHasContent = false;
  quoted = false;
  const pushCell = (index: number) => {
    validateImportLimit('columns', cells.length + 1);
    const raw = source.slice(cellStart, cellQuoted ? quoteEnd : index);
    cells.push(cellQuoted ? raw.replace(/""/g, '"') : normalizeTabularSpaces(raw));
    cellStart = index + 1; cellQuoted = false; closedQuote = false; cellHasContent = false;
  };
  for (let index = 0; index <= source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { recordHasContent = true; index++; }
      else if (quoted) { quoted = false; closedQuote = true; quoteEnd = index; }
      else if (!cellHasContent && !closedQuote) { quoted = true; cellQuoted = true; rowQuoted = true; cellStart = index + 1; }
      else throw new Error('Aspas inválidas na tabela; revise a célula entre aspas.');
      continue;
    }
    if (index === source.length && quoted) throw new Error('Aspas não fechadas na tabela.');
    if (!quoted && (char === delimiter || char === '\n' || index === source.length)) {
      if ((char === '\n' || index === source.length) && recordHasContent) validateImportLimit('dataRows', rows.length);
      pushCell(index);
      if (char === delimiter) continue;
      // TABNET sometimes uses unquoted decimal commas in a comma-separated file.
      // Repair only excess fields that resolve exactly to the established width.
      if (delimiter === ',' && headerWidth && cells.length > headerWidth && !rowQuoted) {
        const compatible = splitDelimitedLine(source.slice(rowStart, index), delimiter, sourceType);
        if (compatible.length === headerWidth) cells = compatible;
      }
      if (cells.some((cell) => cell.trim() !== '')) {
        columns = Math.max(columns, cells.length);
        validateTableSize(rows.length, columns);
        rows.push(cells);
        if (!headerWidth) headerWidth = cells.length;
      }
      cells = []; rowQuoted = false; rowStart = index + 1; recordHasContent = false;
      continue;
    }
    if (char?.trim()) { cellHasContent = true; recordHasContent = true; }
    if (closedQuote && char?.trim()) throw new Error('Texto inesperado após o fechamento de aspas.');
  }
  return { rows, delimiter, formatLabel: delimiterFormatLabel(delimiter) };
}

function unmappedCandidate(tables: WorkbookTable[] | null | undefined, aliases: Record<string, string[]>): TabularCandidate | null {
  const table = tables?.find((item) => item.rows.length > 1 && item.rows[0].length > 0);
  if (!table) return null;
  const headers = table.rows[0].slice();
  const { recognizedColumns, duplicates } = matchTabularColumns(headers, aliases);
  return { table, headers, headerRowIndex: 0, bodyRows: table.rows.slice(1), score: 0, numericRows: 0,
    recognizedColumns, duplicates, recognitionMode: 'unmapped',
    recognitionDetails: ['Tabela lida. Selecione as colunas necessárias na configuração do teste.'] };
}

export function matchTabularColumns(
  headers: string[],
  aliases: Record<string, string[]> | null | undefined,
  requiredKeys: string[] = [],
): MatchTabularColumnsResult {
  const recognizedColumns: Record<string, RecognizedColumn> = {};
  const duplicates: DuplicateHeaderMatch[] = [];

  headers.forEach((header, index) => {
    const normalized = normalizeHeaderToken(header);
    if (!normalized) return;

    const matchedKey = Object.entries(aliases || {}).find(([, knownAliases]) => (
      (knownAliases || []).some((alias) => normalizeHeaderToken(alias) === normalized)
    ))?.[0];

    if (!matchedKey) return;
    if (recognizedColumns[matchedKey]) {
      duplicates.push({
        key: matchedKey,
        firstLabel: recognizedColumns[matchedKey].header,
        secondLabel: normalizeTabularSpaces(header) || `Coluna ${index + 1}`,
        firstIndex: recognizedColumns[matchedKey].index,
        secondIndex: index,
      });
      return;
    }

    recognizedColumns[matchedKey] = {
      index,
      header: normalizeTabularSpaces(header) || `Coluna ${index + 1}`,
    };
  });

  return {
    recognizedColumns,
    duplicates,
    requiredFound: requiredKeys.every((key) => Boolean(recognizedColumns[key])),
  };
}

export function buildRecognizedColumnsChips(
  recognizedColumns: Record<string, RecognizedColumn>,
  order: Array<{ key: string; label: string }> = [],
): string {
  return order
    .filter((item) => recognizedColumns[item.key])
    .map((item) => `<span class="small-chip info">${item.label} &larr; ${recognizedColumns[item.key].header}</span>`)
    .join('');
}

function cellLooksLikeHeader(value: unknown, stats: LegacyStatsAdapter | undefined): boolean {
  const normalized = normalizeTabularSpaces(value);
  if (!normalized) return false;
  if (/[a-z\u00c0-\u024f]/i.test(normalized)) return true;
  if (/[_-]/.test(normalized)) return true;
  return parseTabularNumber(normalized, stats) === null;
}

function cellMatchesExpectedType(
  raw: unknown,
  key: string,
  positionFallback: PositionFallbackOptions | null | undefined,
  numericKeys: readonly string[] | undefined,
  temporalKeys: readonly string[] | undefined,
  stats: LegacyStatsAdapter | undefined,
): boolean {
  const normalized = normalizeTabularSpaces(raw);
  if (!normalized) return false;

  if (temporalKeys?.includes(key)) return isSupportedTemporalToken(normalized);

  const validator = positionFallback?.compatibilityValidators?.[key];
  if (typeof validator === 'function') {
    return Boolean(validator(normalized, stats as LegacyStatsAdapter));
  }

  return !numericKeys?.includes(key) || parseTabularNumber(normalized, stats) !== null;
}

function buildPositionalRecognizedColumns(
  headers: string[],
  positionFallback: PositionFallbackOptions | null | undefined,
): Record<string, RecognizedColumn> {
  const recognizedColumns: Record<string, RecognizedColumn> = {};
  const keysByIndex = positionFallback?.keysByIndex || [];

  for (let index = 0; index < Math.min(headers.length, keysByIndex.length); index += 1) {
    const key = keysByIndex[index];
    if (!key) continue;
    recognizedColumns[key] = {
      index,
      header: normalizeTabularSpaces(headers[index]) || `Coluna ${index + 1}`,
      detection: 'position',
    };
  }

  return recognizedColumns;
}

function rowLooksLikeFallbackHeader(
  headers: string[],
  bodyRows: string[][],
  positionFallback: PositionFallbackOptions | null | undefined,
  numericKeys: readonly string[] | undefined,
  temporalKeys: readonly string[] | undefined,
  stats: LegacyStatsAdapter | undefined,
): boolean {
  const minColumns = positionFallback?.minColumns || 3;
  const headerCells = headers
    .slice(0, minColumns)
    .map((value) => normalizeTabularSpaces(value))
    .filter(Boolean);

  if (headerCells.length < minColumns) return false;

  const requiredKeys = positionFallback?.requiredKeys || [];
  const requiredPositions = requiredKeys
    .map((key) => (positionFallback?.keysByIndex || []).indexOf(key))
    .filter((index) => index >= 0);

  if (!requiredPositions.length) return false;

  const firstDataRow = bodyRows[0] || [];
  const textualRequiredHeaders = requiredPositions.filter((index) => cellLooksLikeHeader(headers[index], stats)).length;
  const textualHeaderCount = headerCells.filter((value) => cellLooksLikeHeader(value, stats)).length;
  const firstRowHasCompatibleData = requiredPositions.some((index) => {
    const key = (positionFallback as PositionFallbackOptions).keysByIndex?.[index] as string;
    return cellMatchesExpectedType(firstDataRow[index], key, positionFallback, numericKeys, temporalKeys, stats);
  });

  return textualRequiredHeaders === requiredPositions.length
    || (textualHeaderCount >= Math.min(2, headerCells.length) && firstRowHasCompatibleData);
}

function buildFallbackRecognitionDetails(positionFallback: PositionFallbackOptions | null | undefined): string[] {
  const details: string[] = [];

  if (positionFallback?.introText) details.push(positionFallback.introText);
  if (positionFallback?.assumptionText) details.push(positionFallback.assumptionText);
  if (positionFallback?.headerText) details.push(positionFallback.headerText);

  return details;
}

function buildPositionalFallbackCandidate(
  table: WorkbookTable,
  rowIndex: number,
  headers: string[],
  bodyRows: string[][],
  options: {
    aliases?: Record<string, string[]>;
    requiredKeys?: string[];
    numericKeys?: string[];
    temporalKeys?: string[];
    positionFallback?: PositionFallbackOptions | null;
  },
  stats: LegacyStatsAdapter | undefined,
): TabularCandidate | null {
  const positionFallback = options?.positionFallback;
  if (!positionFallback) return null;
  if (!rowLooksLikeFallbackHeader(headers, bodyRows, positionFallback, options.numericKeys, options.temporalKeys, stats)) return null;

  const recognizedColumns = buildPositionalRecognizedColumns(headers, positionFallback);
  const requiredKeys = positionFallback.requiredKeys || options?.requiredKeys || [];
  if (!requiredKeys.every((key) => Boolean(recognizedColumns[key]))) return null;

  const compatibilityCounts: Record<string, number> = Object.fromEntries(requiredKeys.map((key) => [key, 0]));
  bodyRows.forEach((row) => {
    requiredKeys.forEach((key) => {
      const index = recognizedColumns[key]?.index;
      if (!Number.isInteger(index)) return;
      if (cellMatchesExpectedType(row[index as number], key, positionFallback, options.numericKeys, options.temporalKeys, stats)) {
        compatibilityCounts[key] += 1;
      }
    });
  });

  const minimumCompatibleRows = Math.min(2, Math.max(bodyRows.length, 1));
  if (!requiredKeys.every((key) => compatibilityCounts[key] >= minimumCompatibleRows)) {
    return null;
  }

  const compatibilityScore = Object.values(compatibilityCounts).reduce((sum, value) => sum + value, 0);

  return {
    table,
    headers,
    headerRowIndex: rowIndex,
    bodyRows,
    score: (Object.keys(recognizedColumns).length * 100) + (compatibilityScore * 10) - rowIndex,
    numericRows: compatibilityScore,
    recognizedColumns,
    duplicates: [],
    recognitionMode: 'position',
    recognitionDetails: buildFallbackRecognitionDetails(positionFallback),
  };
}

/**
 * Validates positional suggestions against an already structured table.
 * Unlike the legacy handoff, this never serializes cells to delimited text.
 */
export function matchStructuredPositionFallback(
  headers: string[],
  bodyRows: string[][],
  options: TabularInputOptions,
  stats: LegacyStatsAdapter,
): Record<string, RecognizedColumn> {
  const candidate = buildPositionalFallbackCandidate(
    { name: 'tabela estruturada', rows: [headers, ...bodyRows] },
    0,
    headers,
    bodyRows,
    options,
    stats,
  );
  return candidate?.recognizedColumns ?? {};
}

function buildTabularRecognitionError(
  expectedFormatLabel: string,
  positionFallback: PositionFallbackOptions | null | undefined,
  availableNames: string[] = [],
  sourceLabel = 'arquivo',
): { message: string; details: string[] } {
  const minColumns = positionFallback?.minColumns || 3;
  const isFallbackUsed = !!positionFallback;
  const message = isFallbackUsed
    ? (positionFallback?.failureMessage || `O ${sourceLabel} foi lido, mas não conseguimos identificar as colunas automaticamente nem pela posição.`)
    : `O ${sourceLabel} foi lido, mas não encontramos colunas compatíveis com o modelo: ${expectedFormatLabel}.`;

  return {
    message,
    details: [
      `Use o modelo: ${expectedFormatLabel}.`,
      positionFallback ? (positionFallback.minimumColumnsText || `Esperavamos pelo menos ${minColumns} colunas uteis com cabecalho na primeira linha.`) : '',
      positionFallback?.consistencyText || '',
      availableNames.length ? `Abas/blocos lidos: ${availableNames.join(', ')}.` : '',
    ].filter(Boolean),
  };
}

export async function readWorkbookTablesFromFile(
  file: File,
  utils: LegacyUtilsAdapter,
): Promise<WorkbookTablesResult> {
  const fileName = normalizeTabularSpaces(file?.name || 'arquivo');
  const dot = fileName.lastIndexOf('.');
  const extension = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  if (!['csv', 'txt', 'tsv', 'xlsx'].includes(extension)) {
    const suffix = extension ? `.${extension}` : 'sem extensão';
    throw new Error(`Formato ${suffix} não suportado. Salve o arquivo como .xlsx ou CSV e tente novamente.`);
  }
  validateImportLimit('fileBytes', file.size);
  if (extension === 'xlsx') {
    return {
      kind: 'xlsx',
      tables: await readXlsxTables(file),
    };
  }

  const text = await utils.readFileText(file);
  const parsed = parseDelimitedRows(text, 'file');

  return {
    kind: 'text',
    tables: [{
      name: fileName,
      rows: parsed.rows,
      delimiter: parsed.delimiter,
      formatLabel: parsed.formatLabel,
    }],
  };
}

export function findBestTabularCandidate(
  tables: WorkbookTable[] | null | undefined,
  options: TabularInputOptions | null | undefined,
  stats: LegacyStatsAdapter | undefined,
): TabularCandidate | null {
  const {
    aliases = {},
    requiredKeys = [],
    numericKeys = [],
    temporalKeys = [],
    positionFallback = null,
  } = options || {};

  const aliasCandidates = (tables || []).map((table): TabularCandidate | null => {
    const rows = table.rows || [];

    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
      const headers = rows[rowIndex].slice();
      if (!headers.some((cell) => cell.trim())) continue;
      const headerMatch = matchTabularColumns(headers, aliases, requiredKeys);
      if (!headerMatch.requiredFound) continue;

      const bodyRows = rows.slice(rowIndex + 1);

      const numericRows = bodyRows.filter((row) => (
        numericKeys.some((key) => {
          const columnIndex = headerMatch.recognizedColumns[key]?.index;
          return Number.isInteger(columnIndex) && parseTabularNumber(row[columnIndex as number], stats) !== null;
        })
      )).length;

      const score = (Object.keys(headerMatch.recognizedColumns).length * 100) + (numericRows * 10) - rowIndex;

      return {
        table,
        headers,
        headerRowIndex: rowIndex,
        bodyRows,
        score,
        numericRows,
        recognizedColumns: headerMatch.recognizedColumns,
        duplicates: headerMatch.duplicates,
        recognitionMode: 'aliases' as const,
        recognitionDetails: [] as string[],
      };
    }

    return null;
  }).filter((candidate): candidate is TabularCandidate => Boolean(candidate));

  if (aliasCandidates.length) {
    aliasCandidates.sort((left, right) => right.score - left.score);
    return aliasCandidates[0];
  }

  if (!positionFallback) return unmappedCandidate(tables, aliases);

  const positionalCandidates = (tables || []).map((table) => {
    const rows = table.rows || [];

    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
      const headers = rows[rowIndex].slice();
      const bodyRows = rows.slice(rowIndex + 1);

      const candidate = buildPositionalFallbackCandidate(table, rowIndex, headers, bodyRows, {
        aliases,
        requiredKeys,
        numericKeys,
        temporalKeys,
        positionFallback,
      }, stats);
      if (candidate) return candidate;
    }

    return null;
  }).filter((candidate): candidate is TabularCandidate => Boolean(candidate));

  if (!positionalCandidates.length) return unmappedCandidate(tables, aliases);
  positionalCandidates.sort((left, right) => right.score - left.score);
  return positionalCandidates[0];
}

function analyzeNumericFormatting(
  bodyRows: string[][],
  recognizedColumns: Record<string, RecognizedColumn>,
  numericKeys: string[],
  temporalKeys: string[],
  stats: LegacyStatsAdapter | undefined,
): {
  decimalCommaDetected: boolean;
  numericCellCount: number;
  diagnostics: ImportDiagnostic[];
} {
  const recognizedKeys = [...new Set([...(numericKeys || []), ...(temporalKeys || [])])];
  const columns = recognizedKeys
    .map((key) => ({ key, index: recognizedColumns?.[key]?.index }))
    .filter((column): column is { key: string; index: number } => Number.isInteger(column.index));
  let decimalCommaDetected = false;
  let numericCellCount = 0;
  const missingByColumn = new Map<string, number[]>();
  const numericFormatsByColumn = new Map<string, { comma: boolean; point: boolean }>();
  const possibleSerialsByColumn = new Map<string, number[]>();
  const calendarTemporalKeys = new Set(columns.flatMap(({ key, index }) => {
    if (!temporalKeys.includes(key)) return [];
    const rawValues = bodyRows
      .map((row) => normalizeTabularSpaces(row[index] || ''))
      .filter((value) => value && !/^(?:NA|N\/A|NULL|-|—)$/i.test(value));
    const resolution = detectTemporalColumn(rawValues, recognizedColumns[key].header);
    return resolution.status === 'resolved' && resolution.frequency !== 'numeric' && resolution.frequency !== 'order'
      ? [key]
      : [];
  }));

  (bodyRows || []).forEach((row, rowIndex) => {
    columns.forEach(({ key, index }) => {
      const raw = row?.[index] || '';
      const normalized = normalizeTabularSpaces(raw);
      if (!normalized) return;
      if (/^(?:NA|N\/A|NULL|-|—)$/i.test(normalized)) {
        const rowNumbers = missingByColumn.get(key) || [];
        if (rowNumbers.length < 100) rowNumbers.push(rowIndex + 1);
        missingByColumn.set(key, rowNumbers);
        return;
      }
      if (parseTabularNumber(raw, stats) === null) return;
      const numericValue = Number(normalized);
      if (
        temporalKeys.includes(key)
        && Number.isInteger(numericValue)
        && numericValue >= 20_000
        && numericValue <= 80_000
      ) {
        const rowNumbers = possibleSerialsByColumn.get(key) || [];
        if (rowNumbers.length < 100) rowNumbers.push(rowIndex + 1);
        possibleSerialsByColumn.set(key, rowNumbers);
      }
      if (numericKeys.includes(key)) numericCellCount += 1;
      const rawText = String(raw);
      const commaIndex = rawText.lastIndexOf(',');
      const pointIndex = rawText.lastIndexOf('.');
      const usesComma = rawUsesDecimalComma(raw) && commaIndex > pointIndex;
      const usesPoint = /\.\d/.test(rawText) && pointIndex > commaIndex;
      if (numericKeys.includes(key) && usesComma) decimalCommaDetected = true;
      if (calendarTemporalKeys.has(key)) return;
      const formats = numericFormatsByColumn.get(key) || { comma: false, point: false };
      formats.comma ||= usesComma;
      formats.point ||= usesPoint;
      numericFormatsByColumn.set(key, formats);
    });
  });

  const diagnostics: ImportDiagnostic[] = [
    ...(decimalCommaDetected ? [{
      code: 'decimal_comma' as const,
      severity: 'info' as const,
      message: 'Foram identificados valores numéricos com vírgula decimal.',
    }] : []),
    ...Array.from(possibleSerialsByColumn.entries()).map(([key, rowNumbers]) => ({
      code: 'possible_excel_serial' as const,
      severity: 'warning' as const,
      message: `A coluna temporal "${recognizedColumns[key].header}" contém números que podem ser seriais de data do Excel. Confirme a opção Datas ou corrija a formatação de data no Excel.`,
      rowNumbers,
    })),
    ...Array.from(numericFormatsByColumn.entries()).flatMap(([key, formats]) => (
      formats.comma && formats.point ? [{
        code: 'mixed_numeric_format' as const,
        severity: 'warning' as const,
        message: `Foram identificados valores numéricos com vírgula e ponto decimal na coluna reconhecida "${key}".`,
      }] : []
    )),
    ...Array.from(missingByColumn.entries()).map(([key, rowNumbers]) => ({
      code: 'missing_tokens' as const,
      severity: 'warning' as const,
      message: `Foram identificados marcadores de ausência na coluna reconhecida "${key}"; os valores originais foram preservados.`,
      rowNumbers,
    })),
  ];

  return {
    decimalCommaDetected,
    numericCellCount,
    diagnostics,
  };
}

function duplicateHeaderDiagnostics(duplicates: readonly DuplicateHeaderMatch[]): ImportDiagnostic[] {
  return duplicates.map(({ firstLabel, secondLabel, firstIndex, secondIndex }) => {
    const firstColumn = firstIndex + 1;
    const secondColumn = secondIndex + 1;
    return {
      code: 'duplicate_headers',
      severity: 'warning',
      message: `Os cabeçalhos "${firstLabel}" (coluna ${firstColumn}) e "${secondLabel}" (coluna ${secondColumn}) correspondem ao mesmo campo; a coluna ${firstColumn} foi escolhida automaticamente, mantendo ambas editáveis.`,
    };
  });
}

function buildLoadedTabularState(
  candidate: TabularCandidate,
  extra: {
    fileName?: string;
    workbookKind?: string;
    tableName?: string;
    formatLabel?: string;
    delimiter?: string;
    sheetNames?: string[];
    sourceType?: 'paste' | 'file';
  },
  numericKeys: string[],
  temporalKeys: string[],
  stats: LegacyStatsAdapter | undefined,
): TabularLoadedState {
  const normalized = normalizeImportedMatrix(candidate.headers, candidate.bodyRows);
  const sourceDiagnostics = candidate.table.importDiagnostics || [];
  const formatting = analyzeNumericFormatting(
    normalized.bodyRows,
    candidate.recognizedColumns,
    numericKeys,
    temporalKeys,
    stats,
  );
  const sourceType = extra.sourceType || 'file';
  const recognitionMode = candidate.recognitionMode || 'aliases';
  const importWarnings = candidate.table.importWarnings || [];
  const diagnostics: ImportDiagnostic[] = [
    ...normalized.diagnostics,
    ...sourceDiagnostics,
    ...duplicateHeaderDiagnostics(candidate.duplicates),
    ...(recognitionMode === 'position' ? [{
      code: 'positional_mapping' as const,
      severity: 'info' as const,
      message: 'As colunas foram reconhecidas pela posição e devem ser conferidas antes da análise.',
    }] : []),
    ...formatting.diagnostics,
  ];
  const summary: TabularImportSummary = {
    sourceType,
    fileName: extra.fileName || 'dados',
    tableName: extra.tableName || candidate.table.name || 'Tabela principal',
    sheetNames: [...(extra.sheetNames || [])],
    formatLabel: extra.formatLabel || candidate.table.formatLabel || 'texto',
    delimiter: extra.delimiter ?? candidate.table.delimiter ?? '',
    rowCount: normalized.bodyRows.length,
    columnCount: normalized.headers.length,
    headerRowNumber: candidate.headerRowIndex + 1,
    recognitionMode,
    recognitionDetails: [...(candidate.recognitionDetails || [])],
    diagnostics,
    importWarnings: [...importWarnings],
  };

  return {
    status: 'loaded',
    ...(importWarnings.length ? { importWarnings } : {}),
    summary,
    fileName: summary.fileName,
    workbookKind: extra.workbookKind || 'text',
    tableName: summary.tableName,
    formatLabel: summary.formatLabel,
    delimiter: summary.delimiter,
    headerRowIndex: candidate.headerRowIndex,
    headers: normalized.headers,
    bodyRows: normalized.bodyRows,
    recognizedColumns: candidate.recognizedColumns,
    duplicates: candidate.duplicates,
    sheetNames: summary.sheetNames,
    decimalCommaDetected: formatting.decimalCommaDetected,
    numericCellCount: formatting.numericCellCount,
    sourceType,
    recognitionMode,
    usedPositionalFallback: recognitionMode === 'position',
    recognitionDetails: summary.recognitionDetails,
  };
}

export async function readTabularFileState(
  file: File,
  utils: LegacyUtilsAdapter,
  stats: LegacyStatsAdapter,
  options: TabularInputOptions = {},
): Promise<TabularLoadState> {
  const {
    aliases = {},
    requiredKeys = [],
    numericKeys = [],
    temporalKeys = [],
    expectedFormatLabel = '',
    positionFallback = null,
  } = options;
  const fileName = normalizeTabularSpaces(file?.name || 'arquivo');

  try {
    const workbook = await readWorkbookTablesFromFile(file, utils);
    const candidate = findBestTabularCandidate(workbook.tables, {
      aliases,
      requiredKeys,
      numericKeys,
      temporalKeys,
      positionFallback,
    }, stats);
    const availableNames = workbook.tables.map((table) => table.name).filter(Boolean);

    if (!candidate) {
      const errorInfo = buildTabularRecognitionError(expectedFormatLabel, positionFallback, availableNames, 'arquivo');
      return {
        status: 'error',
        fileName,
        message: errorInfo.message,
        details: errorInfo.details,
      };
    }

    return buildLoadedTabularState(candidate, {
      fileName,
      workbookKind: workbook.kind,
      tableName: candidate.table.name,
      formatLabel: candidate.table.formatLabel || (workbook.kind === 'xlsx' ? 'XLSX' : 'texto'),
      delimiter: candidate.table.delimiter || '',
      sheetNames: availableNames,
      sourceType: 'file',
    }, numericKeys, temporalKeys, stats);
  } catch (error) {
    return {
      status: 'error',
      fileName,
      message: (error as Error)?.message || 'Nao foi possivel ler o arquivo enviado.',
      details: [`Use o modelo: ${expectedFormatLabel}.`],
    };
  }
}

export function readTabularPasteState(
  text: string,
  stats: LegacyStatsAdapter,
  options: TabularInputOptions = {},
): TabularLoadState {
  const {
    aliases = {},
    requiredKeys = [],
    numericKeys = [],
    temporalKeys = [],
    expectedFormatLabel = '',
    positionFallback = null,
  } = options;
  const parsed = parseDelimitedRows(text);
  const candidate = findBestTabularCandidate([{
    name: 'Conteudo colado',
    rows: parsed.rows,
    delimiter: parsed.delimiter,
    formatLabel: parsed.formatLabel,
  }], {
    aliases,
    requiredKeys,
    numericKeys,
    temporalKeys,
    positionFallback,
  }, stats);

  if (!candidate) {
    const errorInfo = buildTabularRecognitionError(expectedFormatLabel, positionFallback, [], 'conteudo colado');
    return {
      status: 'error',
      fileName: 'dados-colados',
      message: errorInfo.message,
      details: [
        ...errorInfo.details,
        'Cole a tabela com cabecalho no formato esperado ou use um arquivo CSV/XLSX/TXT compativel.',
      ],
      sourceType: 'paste',
    };
  }

  return buildLoadedTabularState(candidate, {
    fileName: 'dados-colados',
    workbookKind: 'text',
    tableName: 'Conteudo colado',
    formatLabel: parsed.formatLabel,
    delimiter: parsed.delimiter,
    sourceType: 'paste',
  }, numericKeys, temporalKeys, stats);
}
