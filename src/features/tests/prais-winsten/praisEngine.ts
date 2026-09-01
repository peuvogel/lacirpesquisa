import { derivePraisSeries } from '@/shared/data-input/datasusNormalizer';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { detectTemporalColumn, type TemporalColumnResolution, type TemporalMode } from '@/shared/data-input/temporalPeriods';
import type { AnalysisIssue } from '@/shared/data-input/analysisIssues';
import type { DatasusSource } from '@/shared/data-input/types';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import type { ResultMetric } from '@/routes/estatistica/ResultsPanel';
import {
  statsEngine,
  type PraisWinstenResult,
} from '@/shared/stats/statsEngine';

export const MIN_TEMPORAL_POINTS = 3;
export const SERIES_LENGTH_CAP = 10_000;

export interface TemporalValueInfo {
  raw: string;
  label: string;
  numeric: number | null;
  sortKey: string;
  timeType: string;
}

export interface PraisSeriesRow {
  index: number;
  idLabel: string;
  timeRaw: string;
  timeLabel: string;
  timeValue: number;
  timePeriodIndex: number;
  timeSortKey: string;
  yRaw: string;
  yValue: number;
}

export interface PraisBuiltDataset {
  time: number[];
  values: number[];
  orderedRows: PraisSeriesRow[];
  validCount: number;
  periodLabel: string;
  timeHeaderLabel: string;
  yHeaderLabel: string;
  idHeaderLabel: string;
  uniqueIds: string[];
  reordered: boolean;
  errors: string[];
  temporal: TemporalColumnResolution;
  issues: AnalysisIssue[];
  frequencyLabel: string;
  effectBasisLabel: string;
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  temporalMode?: TemporalMode;
}

export interface RunPraisOutput {
  model: PraisWinstenResult;
  fitted: number[];
  residuals: number[];
  dataset: PraisBuiltDataset;
}

function normalizeSpaces(raw: string): string {
  return String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

/** Port of parseTemporalValue from tests/prais-winsten/module.js:164-231. */
export function parseTemporalValue(raw: string): TemporalValueInfo {
  const cleaned = normalizeSpaces(raw);
  if (!cleaned) {
    return {
      raw: '',
      label: '',
      numeric: null,
      sortKey: '',
      timeType: 'missing',
    };
  }

  const direct = statsEngine.parseNumber(cleaned);
  if (direct !== null) {
    return {
      raw: cleaned,
      label: cleaned,
      numeric: direct,
      sortKey: `num:${direct}`,
      timeType: Number.isInteger(direct) ? 'integer' : 'numeric',
    };
  }

  const compact = cleaned.replace(/\s+/g, '');
  if (/^(18|19|20)\d{2}$/.test(compact)) {
    return {
      raw: cleaned,
      label: compact,
      numeric: Number(compact),
      sortKey: `year:${compact}`,
      timeType: 'year',
    };
  }

  let match = compact.match(/^((18|19|20)\d{2})[-/](0?[1-9]|1[0-2])$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[3]);
    return {
      raw: cleaned,
      label: `${year}-${String(month).padStart(2, '0')}`,
      numeric: year + (month - 1) / 12,
      sortKey: `${year}-${String(month).padStart(2, '0')}`,
      timeType: 'year-month',
    };
  }

  match = compact.match(/^(0?[1-9]|1[0-2])[-/]((18|19|20)\d{2})$/);
  if (match) {
    const month = Number(match[1]);
    const year = Number(match[2]);
    return {
      raw: cleaned,
      label: `${year}-${String(month).padStart(2, '0')}`,
      numeric: year + (month - 1) / 12,
      sortKey: `${year}-${String(month).padStart(2, '0')}`,
      timeType: 'month-year',
    };
  }

  return {
    raw: cleaned,
    label: cleaned,
    numeric: null,
    sortKey: '',
    timeType: 'invalid',
  };
}

function resolveHeaderLabel(
  headers: string[],
  recognizedColumns: Record<string, number>,
  key: string,
  fallback: string,
): string {
  const index = recognizedColumns[key];
  if (index === undefined) return fallback;
  return headers[index] || fallback;
}

export function buildDatasetFromConfirmed(input: BuildDatasetInput): PraisBuiltDataset {
  const { headers, rows, recognizedColumns } = input;
  const timeIndex = recognizedColumns.tempo;
  const yIndex = recognizedColumns.variavel_y;
  const idIndex = recognizedColumns.id;
  const timeHeaderLabel = resolveHeaderLabel(headers, recognizedColumns, 'tempo', 'Variavel 1');
  const temporal = detectTemporalColumn(
    timeIndex === undefined ? [] : rows.map((row) => normalizeSpaces(row[timeIndex] ?? '')),
    timeHeaderLabel,
    input.temporalMode ?? 'auto',
  );
  const issues: AnalysisIssue[] = temporal.issues.map((issue) => ({
    code: `temporal_${issue.code}`,
    severity: issue.severity,
    message: issue.message,
    rowNumbers: issue.rowNumbers,
    hint: issue.severity === 'error'
      ? 'Corrija os períodos ou escolha explicitamente a periodicidade antes de analisar.'
      : undefined,
  }));

  const dataset: PraisBuiltDataset = {
    time: [],
    values: [],
    orderedRows: [],
    validCount: 0,
    periodLabel: '',
    timeHeaderLabel,
    yHeaderLabel: resolveHeaderLabel(headers, recognizedColumns, 'variavel_y', 'Variavel 2'),
    idHeaderLabel: resolveHeaderLabel(headers, recognizedColumns, 'id', 'ID'),
    uniqueIds: [],
    reordered: false,
    errors: [],
    temporal,
    issues,
    frequencyLabel: temporal.frequencyLabel,
    effectBasisLabel: temporal.effectBasis === 'annualized'
      ? 'Efeito anualizado por ano'
      : temporal.effectBasis === 'numeric-unit'
        ? 'Efeito por unidade temporal informada'
        : 'Efeito por intervalo observado',
  };

  if (timeIndex === undefined) {
    issues.push({
      code: 'missing_time_column',
      severity: 'error',
      message: 'Não encontramos uma coluna compatível com tempo/ano.',
    });
  }
  if (yIndex === undefined) {
    issues.push({
      code: 'missing_outcome_column',
      severity: 'error',
      message: 'Não encontramos uma coluna compatível com variável y/desfecho.',
    });
  }
  if (timeIndex === undefined || yIndex === undefined) {
    dataset.errors = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
    return dataset;
  }

  const validRows: PraisSeriesRow[] = [];
  const normalizedPeriodIndexes = normalizedSequencePeriodIndexes(temporal);

  rows.forEach((row, rowIndex) => {
    const idRaw = idIndex !== undefined ? normalizeSpaces(row[idIndex] ?? '') : '';
    const timeRaw = normalizeSpaces(row[timeIndex!] ?? '');
    const yRaw = normalizeSpaces(row[yIndex!] ?? '');
    const timeValue = temporal.values[rowIndex];
    const yValue = statsEngine.parseNumber(yRaw);
    const rowLabel = idRaw || `Linha ${rowIndex + 1}`;

    if (!yRaw) {
      issues.push({
        code: 'missing_outcome',
        severity: 'warning',
        message: `A linha ${rowIndex + 1} não contém valor para o desfecho e foi excluída da análise.`,
        rowNumbers: [rowIndex + 1],
      });
      return;
    }
    if (yValue === null) {
      issues.push({
        code: 'invalid_outcome',
        severity: 'warning',
        message: `O desfecho da linha ${rowIndex + 1} não é numérico e foi excluído da análise.`,
        rowNumbers: [rowIndex + 1],
      });
      return;
    }
    if (yValue < 0) {
      issues.push({
        code: 'negative_outcome',
        severity: 'error',
        message: `O desfecho da linha ${rowIndex + 1} é negativo. O Prais-Winsten deste fluxo aceita apenas indicadores não negativos.`,
        rowNumbers: [rowIndex + 1],
      });
      return;
    }

    if (timeValue !== null) {
      validRows.push({
        index: rowIndex + 1,
        idLabel: rowLabel,
        timeRaw,
        timeLabel: timeValue.label || timeRaw,
        timeValue: timeValue.coordinate,
        timePeriodIndex: normalizedPeriodIndexes.get(timeValue.rowNumber) ?? timeValue.periodIndex,
        timeSortKey: String(timeValue.periodIndex),
        yRaw,
        yValue,
      });
    }
  });

  if (idIndex !== undefined) {
    dataset.uniqueIds = [...new Set(validRows.map((row) => normalizeSpaces(row.idLabel)).filter(Boolean))];
    if (dataset.uniqueIds.length > 1) {
      issues.push({
        code: 'multiple_series_ids',
        severity: 'error',
        message: `Foram encontrados ${dataset.uniqueIds.length} IDs distintos. O Prais-Winsten deve analisar uma única série por vez.`,
      });
    }
  }

  const orderedRows = [...validRows].sort((left, right) => {
    if (left.timePeriodIndex !== right.timePeriodIndex) return left.timePeriodIndex - right.timePeriodIndex;
    return left.index - right.index;
  });

  dataset.reordered = temporal.issues.some((issue) => issue.code === 'reordered');
  dataset.orderedRows = orderedRows;
  dataset.validCount = orderedRows.length;
  dataset.time = orderedRows.map((row) => row.timeValue);
  dataset.values = orderedRows.map((row) => row.yValue);

  if (orderedRows.length) {
    const first = orderedRows[0];
    const last = orderedRows[orderedRows.length - 1];
    dataset.periodLabel =
      first.timeLabel === last.timeLabel ? first.timeLabel : `${first.timeLabel} a ${last.timeLabel}`;
  }

  dataset.errors = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);

  return dataset;
}

function normalizedSequencePeriodIndexes(temporal: TemporalColumnResolution): Map<number, number> {
  if (temporal.frequency === 'daily') return normalizedDailyPeriodIndexes(temporal);
  return normalizedNumericPeriodIndexes(temporal);
}

function normalizedNumericPeriodIndexes(temporal: TemporalColumnResolution): Map<number, number> {
  if (temporal.frequency !== 'numeric' || temporal.issues.some((issue) => issue.severity === 'error')) {
    return new Map();
  }
  const values = temporal.values.filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.coordinate - right.coordinate);
  return new Map(values.map((value, index) => [value.rowNumber, index]));
}

function normalizedDailyPeriodIndexes(temporal: TemporalColumnResolution): Map<number, number> {
  const values = temporal.values.filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.periodIndex - right.periodIndex);
  const positiveSteps = values.slice(1)
    .map((value, index) => value.periodIndex - values[index]!.periodIndex)
    .filter((step) => step > 0);
  const cadence = Math.min(...positiveSteps);
  if (!Number.isFinite(cadence)) return new Map();
  const origin = values[0]!.periodIndex;
  return new Map(values.map((value) => [value.rowNumber, (value.periodIndex - origin) / cadence]));
}

export function validateSeriesIssues(dataset: PraisBuiltDataset): AnalysisIssue[] {
  const issues = dataset.issues.filter((issue) => (
    issue.code !== 'temporal_missing_period' && issue.code !== 'temporal_duplicate_period'
  ));

  if (dataset.validCount < MIN_TEMPORAL_POINTS) {
    issues.push({
      code: 'minimum_temporal_points',
      severity: 'error',
      message: 'A série temporal precisa de pelo menos 3 pontos válidos.',
    });
  }

  if (dataset.time.length > SERIES_LENGTH_CAP) {
    issues.push({
      code: 'series_length_cap',
      severity: 'error',
      message: `A série excede o limite de ${SERIES_LENGTH_CAP} pontos. Reduza o período antes de analisar.`,
    });
  }

  issues.push(...effectiveSequenceIssues(dataset.orderedRows).map((issue) => {
    const temporalIssue = dataset.issues.find((candidate) => (
      candidate.code === `temporal_${issue.code}`
      && sameRowNumberSet(candidate.rowNumbers, issue.rowNumbers)
    ));
    return temporalIssue
      ? {
          ...issue,
          message: temporalIssue.message,
          ...(temporalIssue.hint === undefined ? {} : { hint: temporalIssue.hint }),
        }
      : issue;
  }));

  return issues;
}

function sameRowNumberSet(left: readonly number[] | undefined, right: readonly number[] | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  const normalizedLeft = [...left].sort((a, b) => a - b);
  const normalizedRight = [...right].sort((a, b) => a - b);
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function effectiveSequenceIssues(rows: readonly PraisSeriesRow[]): AnalysisIssue[] {
  const byPeriod = new Map<number, PraisSeriesRow[]>();
  rows.forEach((row) => {
    const matches = byPeriod.get(row.timePeriodIndex) ?? [];
    matches.push(row);
    byPeriod.set(row.timePeriodIndex, matches);
  });

  const issues: AnalysisIssue[] = [];
  byPeriod.forEach((matches) => {
    if (matches.length > 1) {
      issues.push({
        code: 'duplicate_period',
        severity: 'error',
        message: `Há tempos repetidos na série (${matches[0]!.timeLabel}). Mantenha um único valor por tempo.`,
        rowNumbers: matches.map((row) => row.index),
      });
    }
  });

  const uniqueRows = [...byPeriod.values()]
    .map((matches) => matches[0]!)
    .sort((left, right) => left.timePeriodIndex - right.timePeriodIndex);
  for (let index = 1; index < uniqueRows.length; index += 1) {
    const previous = uniqueRows[index - 1]!;
    const current = uniqueRows[index]!;
    if (current.timePeriodIndex - previous.timePeriodIndex === 1) continue;
    issues.push({
      code: 'missing_period',
      severity: 'error',
      message: 'A série possui lacuna temporal ou intervalos irregulares. Complete os períodos antes de analisar.',
      rowNumbers: [previous.index, current.index],
    });
  }

  return issues;
}

/** Compatibility adapter for existing callers that only render blocking messages. */
export function validateSeries(dataset: PraisBuiltDataset): string[] {
  return [...new Set(validateSeriesIssues(dataset)
    .filter((issue) => issue.severity === 'error')
    .map((issue) => (
      issue.code === 'temporal_missing_period' || issue.code === 'missing_period'
        ? 'A série possui lacuna temporal ou intervalos irregulares. Complete os períodos antes de analisar.'
        : issue.message
    )))];
}

export function computeFitted(time: number[], model: PraisWinstenResult): number[] {
  return time.map((t) => {
    const fitted = model.alpha + model.beta * t;
    return model.scale === 'log' ? 10 ** fitted : fitted;
  });
}

export function computeResiduals(
  time: number[],
  values: number[],
  model: PraisWinstenResult,
): number[] {
  return values.map((value, index) => {
    const observed = model.scale === 'log' ? Math.log10(value) : value;
    return observed - (model.alpha + model.beta * time[index]);
  });
}

export function runPraisWinsten(time: number[], values: number[]): RunPraisOutput['model'] {
  const scale: PraisWinstenResult['scale'] = values.some((value) => value === 0)
    ? 'original'
    : 'log';
  return statsEngine.praisWinsten(time, values, scale);
}

export function runAnalysis(dataset: PraisBuiltDataset): RunPraisOutput {
  const blockingIssue = validateSeriesIssues(dataset).find((issue) => issue.severity === 'error');
  if (blockingIssue) throw new Error(blockingIssue.message);

  const model = runPraisWinsten(dataset.time, dataset.values);
  const fitted = computeFitted(dataset.time, model);
  const residuals = computeResiduals(dataset.time, dataset.values, model);

  return { model, fitted, residuals, dataset };
}

export function effectUnit(dataset: PraisBuiltDataset): string {
  if (dataset.temporal.effectBasis === 'annualized') return 'por ano (anualizada)';
  if (dataset.temporal.effectBasis === 'numeric-unit') return 'por unidade temporal informada';
  return 'por intervalo observado';
}

export function buildMetrics(model: PraisWinstenResult, dataset: PraisBuiltDataset): ResultMetric[] {
  const unit = effectUnit(dataset);
  const acText =
    Math.abs(model.rho) < 0.3
      ? 'autocorrelação fraca'
      : Math.abs(model.rho) < 0.6
        ? 'autocorrelação moderada'
        : 'autocorrelação forte';

  const trendStrength = (() => {
    const abs = Math.abs(model.apc);
    if (abs < 1) return 'muito discreta';
    if (abs < 3) return 'leve';
    if (abs < 6) return 'moderada';
    return 'marcante';
  })();

  const changeMetric: ResultMetric = model.scale === 'log'
    ? {
        label: `Variação percentual (APC) ${unit}`,
        value: `${fmtSigned(model.apc, 2)}%`,
        hint: `IC95% ${fmtNumber(model.ciApc[0], 2)} a ${fmtNumber(model.ciApc[1], 2)} · efeito ${unit}`,
      }
    : {
        label: `Mudança absoluta ${unit}`,
        value: fmtSigned(model.absoluteChange, 2),
        hint: `IC95% ${fmtNumber(model.ciAbsoluteChange[0], 2)} a ${fmtNumber(model.ciAbsoluteChange[1], 2)} · escala original por conter zero · efeito ${unit}`,
      };

  return [
    {
      label: 'Pontos temporais',
      value: String(model.n),
      hint: `Período analisado: ${dataset.periodLabel || 'não informado'}`,
    },
    {
      label: 'Base temporal',
      value: dataset.frequencyLabel || 'Não definida',
      hint: `Efeito ${unit}.`,
    },
    {
      label: 'Coeficiente da tendência (β)',
      value: fmtSigned(model.beta, 4),
      hint: model.scale === 'log'
        ? `Estimado na escala log10 do indicador, ${unit}.`
        : `Estimado na escala original, ${unit}; nenhum valor artificial foi somado aos zeros.`,
    },
    {
      label: 'Erro-padrão (β)',
      value: Number.isFinite(model.seBeta) ? fmtNumber(model.seBeta, 4) : 'n/d',
      hint: 'Usado no teste t e no intervalo de confiança.',
    },
    {
      label: 'p-valor',
      value: fmtP(model.p),
      hint: `t = ${fmtNumber(model.t, 3)} · gl = ${model.df}`,
    },
    {
      label: 'Classificação',
      value: model.classification,
      hint: model.scale === 'log' ? `Mudança ${trendStrength}.` : 'Tendência na unidade original do indicador.',
    },
    changeMetric,
    {
      label: 'Autocorrelação (ρ)',
      value: fmtSigned(model.rho, 3),
      hint: acText,
    },
  ];
}

export interface DatasusPraisKnobState {
  metricKey?: string;
  categoryKey?: string;
  includeTotal?: boolean;
}

export function deriveDatasusDataset(
  source: DatasusSource,
  knobs: DatasusPraisKnobState,
): { ok: boolean; errors: string[]; dataset?: PraisBuiltDataset } {
  const derived = derivePraisSeries({
    source,
    metricKey: knobs.metricKey,
    categoryKey: knobs.categoryKey ?? '',
    includeTotal: knobs.includeTotal ?? false,
    stats: legacyStats,
  });

  if (!derived.ok) {
    return {
      ok: false,
      errors: derived.errors.length ? derived.errors : [derived.primaryError],
    };
  }

  const headers = ['tempo', derived.metricLabel || 'valor'];
  const rows = derived.rows.map((row) => [row.timeLabel, String(row.value)]);
  const recognizedColumns = { tempo: 0, variavel_y: 1 };

  const dataset = buildDatasetFromConfirmed({ headers, rows, recognizedColumns });
  dataset.timeHeaderLabel = 'Tempo';
  dataset.yHeaderLabel = derived.metricLabel || 'Valor';

  return { ok: true, errors: [], dataset };
}

export type PraisEngineOutput = RunPraisOutput;
