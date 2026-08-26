/**
 * Shapes for the ported v1.0 data-input pipeline (`parseTabular.ts`,
 * `datasusImporter.ts`, `datasusNormalizer.ts`).
 *
 * Every member here is derived from the actual return statements in
 * `assets/js/tabular-data-input.js`, `assets/js/datasus-importer.js`, and
 * `assets/js/datasus-normalizer.js` — nothing is invented. Where the legacy
 * code allows a field to be genuinely absent (not just optional-in-practice),
 * it is marked optional (`?`) here too, matching the exact branch that omits it.
 */

import type {
  OlsTransformedResult,
  PearsonResult,
  PraisWinstenResult,
  WelchTResult,
} from '../stats/statsEngine';

// ---------------------------------------------------------------------------
// Legacy adapter surface (the only legacy `utils`/`Stats` methods ported)
// ---------------------------------------------------------------------------

export interface LegacyStatsAdapter {
  parseNumber: (raw: unknown) => number | null;
  mean: (values: number[]) => number;
  variance: (values: number[]) => number;
  sd: (values: number[]) => number;
  sum: (values: number[]) => number;
  min: (values: number[]) => number;
  max: (values: number[]) => number;
  gammaln: (x: number) => number;
  betacf: (a: number, b: number, x: number) => number;
  ibeta: (x: number, a: number, b: number) => number;
  tcdf: (t: number, df: number) => number;
  tInv: (p: number, df: number) => number;
  fisherCI: (r: number, n: number) => [number, number];
  welchT: (a: number[], b: number[]) => WelchTResult;
  pearson: (x: number[], y: number[]) => PearsonResult;
  rank: (arr: number[]) => number[];
  spearman: (x: number[], y: number[]) => PearsonResult;
  olsTransformed: (c: number[], x: number[], y: number[]) => OlsTransformedResult;
  estimateRho: (resid: number[]) => number;
  praisWinsten: (years: number[], values: number[]) => PraisWinstenResult;
}

export interface LegacyUtilsAdapter {
  readFileText: (file: File) => Promise<string>;
  normalizeImportedText: (text: string) => string;
  normalizeImportedLabel: (value: string) => string;
}

// ---------------------------------------------------------------------------
// parseTabular.ts — tabular-data-input.js port
// ---------------------------------------------------------------------------

export interface RecognizedColumn {
  index: number;
  header: string;
  detection?: 'position';
}

export interface TabularRecognitionError {
  message: string;
  details: string[];
}

export interface PositionFallbackOptions {
  minColumns?: number;
  requiredKeys?: string[];
  keysByIndex?: string[];
  compatibilityValidators?: Record<string, (value: string, stats: LegacyStatsAdapter) => boolean>;
  introText?: string;
  assumptionText?: string;
  headerText?: string;
  failureMessage?: string;
  minimumColumnsText?: string;
  consistencyText?: string;
}

export interface TabularInputOptions {
  aliases?: Record<string, string[]>;
  requiredKeys?: string[];
  numericKeys?: string[];
  expectedFormatLabel?: string;
  positionFallback?: PositionFallbackOptions | null;
}

export interface ParsedDelimitedRows {
  rows: string[][];
  delimiter: string;
  formatLabel: string;
}

export interface MatchTabularColumnsResult {
  recognizedColumns: Record<string, RecognizedColumn>;
  duplicates: string[];
  requiredFound: boolean;
}

export interface WorkbookTable {
  name: string;
  rows: string[][];
  delimiter?: string;
  formatLabel?: string;
  importWarnings?: ImportWarning[];
}

/** Coordinates refer to the original worksheet: one-based row, zero-based column. */
export interface ImportWarning {
  code: 'formula-without-cache' | 'unusable-cell';
  message: string;
  cellReference: string;
  rowNumber: number;
  columnIndex: number;
}

export interface WorkbookTablesResult {
  kind: 'text' | 'xlsx';
  tables: WorkbookTable[];
}

export interface TabularCandidate {
  table: WorkbookTable;
  headers: string[];
  headerRowIndex: number;
  bodyRows: string[][];
  score: number;
  numericRows: number;
  recognizedColumns: Record<string, RecognizedColumn>;
  duplicates: string[];
  recognitionMode: 'aliases' | 'position' | 'unmapped';
  recognitionDetails: string[];
}

export interface TabularLoadedState {
  importWarnings?: ImportWarning[];
  status: 'loaded';
  fileName: string;
  workbookKind: string;
  tableName: string;
  formatLabel: string;
  delimiter: string;
  headerRowIndex: number;
  headers: string[];
  bodyRows: string[][];
  recognizedColumns: Record<string, RecognizedColumn>;
  duplicates: string[];
  sheetNames: string[];
  decimalCommaDetected: boolean;
  numericCellCount: number;
  sourceType: string;
  recognitionMode: string;
  usedPositionalFallback: boolean;
  recognitionDetails: string[];
}

export interface TabularErrorState {
  status: 'error';
  fileName: string;
  message: string;
  details: string[];
  sourceType?: 'paste';
}

export type TabularLoadState = TabularLoadedState | TabularErrorState;

// ---------------------------------------------------------------------------
// datasusImporter.ts — datasus-importer.js port
// ---------------------------------------------------------------------------

export interface DatasusLine {
  index: number;
  raw: string;
  clean: string;
}

export interface DatasusRow {
  lineIndex: number;
  rawLine: string;
  rawCells: string[];
  cleanCells: string[];
}

export interface DatasusHeaderCandidate {
  rowIndex: number;
  preview: string;
  score: number;
  reasons: string[];
}

export type DatasusColumnRole = 'primary-category' | 'category' | 'time' | 'measure' | 'total' | 'ignore';

export type DatasusVariableType = 'categorical' | 'temporal' | 'quantitative' | 'total' | 'metadata';

export type DatasusFormatType = 'wide' | 'long' | 'hybrid';

export interface DatasusColumnProfile {
  index: number;
  header: string;
  normalizedHeader: string;
  sampleValues: string[];
  nonEmptyCount: number;
  numericCount: number;
  timeCount: number;
  totalCount: number;
  textCount: number;
  numericRatio: number;
  timeRatio: number;
  suggestedRole: Exclude<DatasusColumnRole, 'primary-category'>;
  suggestedType: DatasusVariableType;
}

export interface DatasusDiagnosis {
  delimiter: string;
  delimiterLabel: string;
  headerRowIndex: number;
  metadataLines: string[];
  formatType: DatasusFormatType;
  primaryCategoryIndex: number | null;
  primaryCategoryLabel: string;
  timeColumnIndices: number[];
  timeLabels: string[];
  measureColumnIndices: number[];
  measureLabels: string[];
  totalColumnIndices: number[];
  hasTotalColumn: boolean;
  totalRowCount: number;
  summaryText: string;
}

export interface DatasusMappingColumn {
  index: number;
  header: string;
  role: DatasusColumnRole;
  variableType: DatasusVariableType;
}

export interface DatasusMapping {
  headerRowIndex: number;
  formatType: DatasusFormatType;
  columns: DatasusMappingColumn[];
  excludeTotalByDefault: boolean;
}

export interface DatasusParsedOk {
  ok: true;
  fileName: string;
  rawText: string;
  lines: DatasusLine[];
  delimiter: string;
  headerCandidates: DatasusHeaderCandidate[];
  headerRowIndex: number;
  headers: string[];
  rowMatrix: DatasusRow[];
  bodyRows: DatasusRow[];
  columnProfiles: DatasusColumnProfile[];
  diagnosis: DatasusDiagnosis;
  initialMapping: DatasusMapping;
}

export interface DatasusParsedError {
  ok: false;
  fileName: string;
  error: string;
}

export type DatasusParsedResult = DatasusParsedOk | DatasusParsedError;

/**
 * Provisional shape of the object `datasus-wizard.js` (ported in plan 01-08)
 * builds per imported file and hands to the normalizer. Only the fields the
 * normalizer actually reads (`id`, `fileName`, `parsed`, `mapping`,
 * `normalized`) are typed here; 01-08 owns the rest of the wizard's state.
 */
export interface DatasusSource {
  id: string;
  fileName: string;
  rawText: string;
  parsed: DatasusParsedOk | null;
  mapping: DatasusMapping | null;
  confirmed: boolean;
  normalized?: NormalizedDatasusResult;
}

// ---------------------------------------------------------------------------
// datasusNormalizer.ts — datasus-normalizer.js port
// ---------------------------------------------------------------------------

export interface DatasusMetricOption {
  key: string;
  label: string;
  primary: boolean;
}

export interface DatasusCategoryOption {
  key: string;
  label: string;
  isTotal: boolean;
}

export interface DatasusTimeOption {
  key: string;
  label: string;
}

export interface NormalizedDatasusRecord {
  id: string;
  sourceId: string;
  sourceFile: string;
  category: string;
  categoryKey: string;
  rawCategory: string;
  time: string;
  timeKey: string;
  rawTime: string;
  metricValues: Record<string, number | null>;
  primaryMetricKey: string;
  value: number | null;
  extraDimensions: Record<string, string>;
  aggregateValues: Record<string, number | null>;
  isTotal: boolean;
  isMissing: boolean;
  rawLineIndex: number;
  rawCells: string[];
}

export interface FilteredDatasusRecord extends NormalizedDatasusRecord {
  metricValue: number | null;
}

export interface NormalizedDatasusSchema {
  formatType: DatasusFormatType;
  categoryLabel: string;
  timeLabel: string;
  hasTime: boolean;
  metricOptions: DatasusMetricOption[];
  primaryMetricKey: string;
  categories: string[];
  times: string[];
  hasTotalRecords: boolean;
}

export interface NormalizedDatasusSummary {
  recordCount: number;
  validRecordCount: number;
  missingRecordCount: number;
  categoryCount: number;
  timeCount: number;
}

export interface NormalizedDatasusPreviewRow {
  category: string;
  time: string;
  value: number | null;
  isTotal: boolean;
  extraDimensions: Record<string, string>;
}

export interface NormalizedDatasusResult {
  ok: boolean;
  errors: string[];
  records: NormalizedDatasusRecord[];
  schema: NormalizedDatasusSchema;
  summary: NormalizedDatasusSummary;
  previewRows?: NormalizedDatasusPreviewRow[];
}

export interface DatasusBestPairResult {
  leftId: string;
  rightId: string;
  sharedCategoryCount: number;
  sharedTimeCount: number;
  sharedCategories: string[];
  sharedTimes: string[];
  score: number;
}

export interface TimeKeyInfo {
  label: string;
  numeric: number | null;
}

// --- Phase 2+ statistical derivation shapes (ported now, verified in Phase 2) ---

export interface DatasusDerivedRow {
  rowKey: string;
  rowLabel: string;
  value: number;
  rawCount: number;
  validTimes: string[];
}

export interface DatasusIndependentTTestResult {
  ok: boolean;
  mode: 'independent';
  errors: string[];
  primaryError: string;
  metricKey: string;
  metricLabel: string;
  periodLabel: string;
  selectedTimes: string[];
  groupLabels: string[];
  groupAItems: string[];
  groupBItems: string[];
  derivedRows: Array<DatasusDerivedRow & { groupKey: 'A' | 'B'; groupLabel: string }>;
  vectors: { A: number[]; B: number[] };
  selectionCounts: { A: number; B: number };
  validCounts: { A: number; B: number };
  explanation: string;
}

export interface DatasusPairedRow {
  rowKey: string;
  rowLabel: string;
  valueA: number;
  valueB: number;
  diff: number;
  validTimes: string[];
}

export interface DatasusOmittedRow {
  rowLabel: string;
  reason: string;
}

export interface DatasusPairedTTestResult {
  ok: boolean;
  mode: 'paired';
  errors: string[];
  primaryError: string;
  metricLabels: string[];
  groupLabels: string[];
  periodLabel: string;
  selectedTimes: string[];
  derivedRows: DatasusPairedRow[];
  omittedRows: DatasusOmittedRow[];
  vectors: { A: number[]; B: number[] };
  validCounts: { pairs: number };
  selectionCounts: { A: number; B: number };
  explanation: string;
}

export interface DatasusCorrelationPair {
  label: string;
  x: number;
  y: number;
  category: string;
  time: string;
}

export interface DatasusCorrelationResult {
  ok: boolean;
  errors: string[];
  primaryError: string;
  pairs: DatasusCorrelationPair[];
  xLabel: string;
  yLabel: string;
}

export interface DatasusPraisSeriesRow {
  timeLabel: string;
  timeNumeric: number | null;
  value: number;
  order: number;
  time: number;
}

export interface DatasusPraisSeriesResult {
  ok: boolean;
  errors: string[];
  primaryError: string;
  rows: DatasusPraisSeriesRow[];
  metricLabel: string;
  categoryLabel: string;
}
