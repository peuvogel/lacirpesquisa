import { derivePraisSeries } from '@/shared/data-input/datasusNormalizer';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
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
}

export interface BuildDatasetInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
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

  const dataset: PraisBuiltDataset = {
    time: [],
    values: [],
    orderedRows: [],
    validCount: 0,
    periodLabel: '',
    timeHeaderLabel: resolveHeaderLabel(headers, recognizedColumns, 'tempo', 'Variavel 1'),
    yHeaderLabel: resolveHeaderLabel(headers, recognizedColumns, 'variavel_y', 'Variavel 2'),
    idHeaderLabel: resolveHeaderLabel(headers, recognizedColumns, 'id', 'ID'),
    uniqueIds: [],
    reordered: false,
    errors: [],
  };

  if (timeIndex === undefined) {
    dataset.errors.push('Não encontramos uma coluna compatível com tempo/ano.');
  }
  if (yIndex === undefined) {
    dataset.errors.push('Não encontramos uma coluna compatível com variável y/desfecho.');
  }
  if (dataset.errors.length) return dataset;

  const validRows: PraisSeriesRow[] = [];
  const duplicateMap = new Map<string, string[]>();
  let negativeValueCount = 0;

  rows.forEach((row, rowIndex) => {
    const idRaw = idIndex !== undefined ? normalizeSpaces(row[idIndex] ?? '') : '';
    const timeRaw = normalizeSpaces(row[timeIndex!] ?? '');
    const yRaw = normalizeSpaces(row[yIndex!] ?? '');
    const timeInfo = parseTemporalValue(timeRaw);
    const yValue = statsEngine.parseNumber(yRaw);
    const rowLabel = idRaw || `Linha ${rowIndex + 1}`;

    if (timeInfo.numeric !== null && yValue !== null && yValue < 0) {
      negativeValueCount += 1;
    }

    if (timeInfo.numeric !== null && yValue !== null && yValue >= 0) {
      validRows.push({
        index: rowIndex + 1,
        idLabel: rowLabel,
        timeRaw,
        timeLabel: timeInfo.label || timeRaw,
        timeValue: timeInfo.numeric,
        timeSortKey: timeInfo.sortKey,
        yRaw,
        yValue,
      });
      const list = duplicateMap.get(timeInfo.sortKey) || [];
      list.push(timeInfo.label || timeRaw);
      duplicateMap.set(timeInfo.sortKey, list);
    }
  });

  if (negativeValueCount > 0) {
    dataset.errors.push(
      `A série contém ${negativeValueCount} valor(es) negativo(s). O Prais-Winsten deste fluxo aceita apenas indicadores não negativos.`,
    );
  }

  const duplicateTimes = [...duplicateMap.values()]
    .filter((list) => list.length > 1)
    .map((list) => list[0]);

  if (duplicateTimes.length) {
    dataset.errors.push(
      `Há tempos repetidos na série (${duplicateTimes.slice(0, 4).join(', ')}${duplicateTimes.length > 4 ? ', ...' : ''}). Mantenha um único valor por tempo.`,
    );
  }

  if (idIndex !== undefined) {
    dataset.uniqueIds = [...new Set(validRows.map((row) => normalizeSpaces(row.idLabel)).filter(Boolean))];
    if (dataset.uniqueIds.length > 1) {
      dataset.errors.push(
        `Foram encontrados ${dataset.uniqueIds.length} IDs distintos. O Prais-Winsten deve analisar uma única série por vez.`,
      );
    }
  }

  const orderedRows = [...validRows].sort((left, right) => {
    if (left.timeValue !== right.timeValue) return left.timeValue - right.timeValue;
    return left.index - right.index;
  });

  dataset.reordered = validRows.some((row, index) => row.index !== orderedRows[index]?.index);
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

  return dataset;
}

export function validateSeries(dataset: PraisBuiltDataset): string[] {
  const errors = [...dataset.errors];

  if (dataset.validCount < MIN_TEMPORAL_POINTS) {
    errors.push('A série temporal precisa de pelo menos 3 pontos válidos.');
  }

  if (dataset.time.length > SERIES_LENGTH_CAP) {
    errors.push(`A série excede o limite de ${SERIES_LENGTH_CAP} pontos. Reduza o período antes de analisar.`);
  }

  if (dataset.time.length >= 3) {
    const intervals = dataset.time.slice(1).map((time, index) => time - dataset.time[index]);
    const expectedInterval = Math.min(...intervals);
    const tolerance = Math.max(1e-8, Math.abs(expectedInterval) * 0.05);
    if (
      expectedInterval <= 0 ||
      intervals.some((interval) => Math.abs(interval - expectedInterval) > tolerance)
    ) {
      errors.push(
        'A série possui lacuna temporal ou intervalos irregulares. Complete os períodos antes de analisar.',
      );
    }
  }

  return errors;
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
  const model = runPraisWinsten(dataset.time, dataset.values);
  const fitted = computeFitted(dataset.time, model);
  const residuals = computeResiduals(dataset.time, dataset.values, model);

  return { model, fitted, residuals, dataset };
}

export function buildMetrics(model: PraisWinstenResult, dataset: PraisBuiltDataset): ResultMetric[] {
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
        label: 'Variação percentual (APC)',
        value: `${fmtSigned(model.apc, 2)}%`,
        hint: `IC95% ${fmtNumber(model.ciApc[0], 2)} a ${fmtNumber(model.ciApc[1], 2)}`,
      }
    : {
        label: 'Mudança absoluta por período',
        value: fmtSigned(model.absoluteChange, 2),
        hint: `IC95% ${fmtNumber(model.ciAbsoluteChange[0], 2)} a ${fmtNumber(model.ciAbsoluteChange[1], 2)} · escala original por conter zero`,
      };

  return [
    {
      label: 'Pontos temporais',
      value: String(model.n),
      hint: `Período analisado: ${dataset.periodLabel || 'não informado'}`,
    },
    {
      label: 'Coeficiente da tendência (β)',
      value: fmtSigned(model.beta, 4),
      hint: model.scale === 'log'
        ? 'Estimado na escala log10 do indicador.'
        : 'Estimado na escala original; nenhum valor artificial foi somado aos zeros.',
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
