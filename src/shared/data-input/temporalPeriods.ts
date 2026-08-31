export type TemporalMode =
  | 'auto' | 'annual' | 'semiannual' | 'quarterly'
  | 'monthly' | 'dates' | 'numeric' | 'order';

export type TemporalFrequency =
  | 'annual' | 'semiannual' | 'quarterly'
  | 'monthly' | 'daily' | 'numeric' | 'order';

export interface ResolvedTemporalValue {
  raw: string;
  label: string;
  canonicalLabel: string;
  periodIndex: number;
  coordinate: number;
  rowNumber: number;
}

export interface TemporalIssue {
  code: 'ambiguous_frequency' | 'invalid_token' | 'mixed_frequency'
    | 'duplicate_period' | 'missing_period' | 'reordered';
  severity: 'error' | 'warning';
  message: string;
  rowNumbers?: number[];
}

export interface TemporalColumnResolution {
  status: 'resolved' | 'ambiguous' | 'invalid';
  mode: TemporalMode;
  frequency: TemporalFrequency | null;
  frequencyLabel: string;
  effectBasis: 'annualized' | 'numeric-unit' | 'observed-interval';
  values: Array<ResolvedTemporalValue | null>;
  issues: TemporalIssue[];
}

const FREQUENCY_STEPS_PER_YEAR = {
  annual: 1,
  semiannual: 2,
  quarterly: 4,
  monthly: 12,
} as const;

type CalendarFrequency = keyof typeof FREQUENCY_STEPS_PER_YEAR;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface ParsedCalendarToken {
  frequency: CalendarFrequency;
  year: number;
  slot: number;
  canonicalLabel: string;
}

function calendarValue(
  raw: string,
  rowNumber: number,
  frequency: CalendarFrequency,
  year: number,
  slot: number,
  label: string,
): ResolvedTemporalValue {
  const steps = FREQUENCY_STEPS_PER_YEAR[frequency];
  return {
    raw,
    label: raw.trim(),
    canonicalLabel: label,
    periodIndex: year * steps + slot - 1,
    coordinate: year + (slot - 1) / steps,
    rowNumber,
  };
}

function utcDayIndex(year: number, month: number, day: number): number {
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return Number.NaN;
  return Math.floor(timestamp / 86_400_000);
}

function normalizeHeader(header: string): string {
  return header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function hasSemesterHint(header: string): boolean {
  return /semestre|semestral|\bsem\b/.test(normalizeHeader(header));
}

function hasQuarterHint(header: string): boolean {
  return /trimestre|trimestral|quarter|quarterly|\btri\b/.test(normalizeHeader(header));
}

function padded(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDateParts(raw: string): DateParts | null {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    return Number.isNaN(utcDayIndex(parts.year, parts.month, parts.day)) ? null : parts;
  }

  match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (match) {
    const parts = { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
    return Number.isNaN(utcDayIndex(parts.year, parts.month, parts.day)) ? null : parts;
  }

  return null;
}

function parseMonth(raw: string): ParsedCalendarToken | null {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})$/.exec(value);
  let year: number;
  let month: number;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
  } else {
    match = /^(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    month = Number(match[1]);
    year = Number(match[2]);
  }

  if (month < 1 || month > 12) return null;
  return { frequency: 'monthly', year, slot: month, canonicalLabel: `${year}-${padded(month)}` };
}

function parseExplicitSemester(raw: string): ParsedCalendarToken | null {
  const match = /^(\d{4})\s*-?\s*[sS]([12])$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const slot = Number(match[2]);
  return { frequency: 'semiannual', year, slot, canonicalLabel: `${year}.${slot}` };
}

function parseExplicitQuarter(raw: string): ParsedCalendarToken | null {
  const value = raw.trim();
  const first = /^[tTqQ]([1-4])\s+(\d{4})$/.exec(value);
  const second = /^(\d{4})\s*-?\s*[tTqQ]([1-4])$/.exec(value);
  if (!first && !second) return null;
  const year = Number(first?.[2] ?? second?.[1]);
  const slot = Number(first?.[1] ?? second?.[2]);
  return { frequency: 'quarterly', year, slot, canonicalLabel: `${year}.Q${slot}` };
}

function parseAnnual(raw: string): ParsedCalendarToken | null {
  const match = /^(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  return { frequency: 'annual', year, slot: 1, canonicalLabel: String(year) };
}

function parseDecimalPeriod(raw: string): { year: number; slot: number } | null {
  const match = /^(\d{4})\.([1-4])$/.exec(raw.trim());
  if (!match) return null;
  return { year: Number(match[1]), slot: Number(match[2]) };
}

function parseCalendarCandidate(raw: string, frequency: CalendarFrequency): ParsedCalendarToken | null {
  if (frequency === 'annual') return parseAnnual(raw);
  if (frequency === 'monthly') return parseMonth(raw);

  const decimal = parseDecimalPeriod(raw);
  if (frequency === 'semiannual') {
    const explicit = parseExplicitSemester(raw);
    if (explicit) return explicit;
    if (!decimal || decimal.slot > 2) return null;
    return { ...decimal, frequency, canonicalLabel: `${decimal.year}.${decimal.slot}` };
  }

  const explicit = parseExplicitQuarter(raw);
  if (explicit) return explicit;
  if (!decimal) return null;
  return { ...decimal, frequency, canonicalLabel: `${decimal.year}.Q${decimal.slot}` };
}

function parseCalendarColumn(rawValues: readonly string[], frequency: CalendarFrequency): ParsedCalendarToken[] | null {
  return allParsed(rawValues, (raw) => parseCalendarCandidate(raw, frequency));
}

function parseNumeric(raw: string): number | null {
  const value = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function decimalSemesterHasRollover(tokens: readonly { year: number; slot: number }[]): boolean {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const current = tokens[index];
    const next = tokens[index + 1];
    if (current.slot === 2 && next.slot === 1 && next.year === current.year + 1) return true;
  }
  return false;
}

function isMonthEnd(parts: DateParts): boolean {
  return parts.day === new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
}

function dateCadence(dates: readonly DateParts[]): CalendarFrequency | null {
  if (dates.length < 2) return null;
  const day = dates[0].day;
  const equalDayOfMonth = dates.every((date) => date.day === day);
  if (!equalDayOfMonth && !dates.every(isMonthEnd)) return null;

  const monthIndexes = dates.map((date) => date.year * 12 + date.month - 1);
  const step = monthIndexes[1] - monthIndexes[0];
  const frequency = ({ 1: 'monthly', 3: 'quarterly', 6: 'semiannual', 12: 'annual' } as const)[step];
  if (!frequency) return null;
  return monthIndexes.slice(1).every((value, index) => value - monthIndexes[index] === step)
    ? frequency
    : null;
}

function issue(code: TemporalIssue['code'], severity: TemporalIssue['severity'], message: string, rowNumbers?: number[]): TemporalIssue {
  return rowNumbers ? { code, severity, message, rowNumbers } : { code, severity, message };
}

function issueLabel(value: ResolvedTemporalValue, frequency: TemporalFrequency): string {
  if (frequency === 'daily') return value.canonicalLabel;
  if (frequency === 'numeric') return String(value.coordinate);
  return value.canonicalLabel;
}

function buildSequenceIssues(values: readonly ResolvedTemporalValue[], frequency: TemporalFrequency): TemporalIssue[] {
  const issues: TemporalIssue[] = [];
  const byIndex = new Map<number, ResolvedTemporalValue[]>();
  for (const value of values) {
    const matches = byIndex.get(value.periodIndex) ?? [];
    matches.push(value);
    byIndex.set(value.periodIndex, matches);
  }

  for (const matches of byIndex.values()) {
    if (matches.length > 1) {
      issues.push(issue(
        'duplicate_period',
        'error',
        `Período duplicado: ${issueLabel(matches[0], frequency)}.`,
        matches.map((value) => value.rowNumber),
      ));
    }
  }

  for (let index = 1; index < values.length; index += 1) {
    if (values[index].periodIndex < values[index - 1].periodIndex) {
      issues.push(issue('reordered', 'warning', 'Os períodos não estão na ordem temporal original.', [values[index - 1].rowNumber, values[index].rowNumber]));
      break;
    }
  }

  const ordered = [...byIndex.values()].map((matches) => matches[0]).sort((left, right) => left.periodIndex - right.periodIndex);
  if (ordered.length < 2) return issues;
  const deltas = ordered.slice(1).map((value, index) => value.periodIndex - ordered[index].periodIndex);
  const expectedStep = frequency === 'annual' || frequency === 'semiannual' || frequency === 'quarterly' || frequency === 'monthly'
    ? 1
    : Math.min(...deltas.filter((delta) => delta > 0));

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const delta = current.periodIndex - previous.periodIndex;
    if (delta <= 0 || delta === expectedStep) continue;
    const missing = frequency === 'annual' || frequency === 'semiannual' || frequency === 'quarterly' || frequency === 'monthly'
      ? `Período ausente: ${calendarLabelForIndex(previous.periodIndex + 1, frequency)}.`
      : `Intervalo irregular entre ${issueLabel(previous, frequency)} e ${issueLabel(current, frequency)}.`;
    issues.push(issue('missing_period', 'error', missing, [previous.rowNumber, current.rowNumber]));
  }

  return issues;
}

function calendarLabelForIndex(periodIndex: number, frequency: TemporalFrequency): string {
  const steps = frequency === 'annual' ? 1
    : frequency === 'semiannual' ? 2
      : frequency === 'quarterly' ? 4
        : 12;
  const year = Math.floor(periodIndex / steps);
  const slot = periodIndex - year * steps + 1;
  if (frequency === 'annual') return String(year);
  if (frequency === 'semiannual') return `${year}.${slot}`;
  if (frequency === 'quarterly') return `${year}.Q${slot}`;
  return `${year}-${padded(slot)}`;
}

function resolution(
  status: TemporalColumnResolution['status'],
  mode: TemporalMode,
  frequency: TemporalFrequency | null,
  effectBasis: TemporalColumnResolution['effectBasis'],
  values: Array<ResolvedTemporalValue | null>,
  issues: TemporalIssue[],
): TemporalColumnResolution {
  return {
    status: status === 'resolved' && issues.some((item) => item.severity === 'error') ? 'invalid' : status,
    mode,
    frequency,
    frequencyLabel: frequency ? frequencyLabel(frequency) : 'Não reconhecida',
    effectBasis,
    values,
    issues,
  };
}

function frequencyLabel(frequency: TemporalFrequency): string {
  return ({
    annual: 'Anual',
    semiannual: 'Semestral',
    quarterly: 'Trimestral',
    monthly: 'Mensal',
    daily: 'Diária',
    numeric: 'Numérica',
    order: 'Ordem observada',
  } as const)[frequency];
}

function resolveCalendar(
  rawValues: readonly string[],
  mode: TemporalMode,
  parsed: readonly ParsedCalendarToken[],
): TemporalColumnResolution {
  const frequency = parsed[0].frequency;
  const values = parsed.map((token, index) => calendarValue(
    rawValues[index], index + 1, frequency, token.year, token.slot, token.canonicalLabel,
  ));
  return resolution('resolved', mode, frequency, 'annualized', values, buildSequenceIssues(values, frequency));
}

function resolveDaily(rawValues: readonly string[], mode: TemporalMode, dates: readonly DateParts[]): TemporalColumnResolution {
  const cadence = dateCadence(dates);
  if (cadence) {
    const values = dates.map((date, index) => calendarValue(
      rawValues[index],
      index + 1,
      cadence,
      date.year,
      cadence === 'annual' ? 1 : cadence === 'semiannual' ? Math.floor((date.month - 1) / 6) + 1 : cadence === 'quarterly' ? Math.floor((date.month - 1) / 3) + 1 : date.month,
      cadence === 'annual' ? String(date.year) : cadence === 'semiannual' ? `${date.year}.${Math.floor((date.month - 1) / 6) + 1}` : cadence === 'quarterly' ? `${date.year}.Q${Math.floor((date.month - 1) / 3) + 1}` : `${date.year}-${padded(date.month)}`,
    ));
    return resolution('resolved', mode, cadence, 'annualized', values, buildSequenceIssues(values, cadence));
  }

  const values = dates.map((date, index) => {
    const periodIndex = utcDayIndex(date.year, date.month, date.day);
    return {
      raw: rawValues[index],
      label: rawValues[index].trim(),
      canonicalLabel: `${date.year}-${padded(date.month)}-${padded(date.day)}`,
      periodIndex,
      coordinate: periodIndex / 365.2425,
      rowNumber: index + 1,
    };
  });
  return resolution('resolved', mode, 'daily', 'annualized', values, buildSequenceIssues(values, 'daily'));
}

function resolveNumeric(rawValues: readonly string[], mode: TemporalMode, numbers: readonly number[]): TemporalColumnResolution {
  const values = numbers.map((number, index) => ({
    raw: rawValues[index],
    label: rawValues[index].trim(),
    canonicalLabel: String(number),
    periodIndex: number,
    coordinate: number,
    rowNumber: index + 1,
  }));
  return resolution('resolved', mode, 'numeric', 'numeric-unit', values, buildSequenceIssues(values, 'numeric'));
}

function allParsed<T>(values: readonly string[], parser: (value: string) => T | null): T[] | null {
  const parsed = values.map(parser);
  return parsed.every((value): value is T => value !== null) ? parsed : null;
}

export function isSupportedTemporalToken(raw: string): boolean {
  return parseDateParts(raw) !== null
    || parseMonth(raw) !== null
    || parseExplicitSemester(raw) !== null
    || parseExplicitQuarter(raw) !== null
    || parseAnnual(raw) !== null
    || parseDecimalPeriod(raw) !== null
    || parseNumeric(raw) !== null;
}

export function detectTemporalColumn(
  rawValues: readonly string[],
  header: string,
  mode: TemporalMode = 'auto',
): TemporalColumnResolution {
  if (mode === 'order') {
    if (rawValues.length === 0) {
      return resolution('invalid', mode, 'order', 'observed-interval', [], [
        issue('invalid_token', 'error', 'A coluna temporal não contém valores.'),
      ]);
    }
    const blankRows = rawValues.flatMap((raw, index) => raw.trim() ? [] : [index + 1]);
    if (blankRows.length > 0) {
      return resolution('invalid', mode, 'order', 'observed-interval', rawValues.map((raw, index) => (
        raw.trim() ? {
          raw,
          label: raw.trim(),
          canonicalLabel: raw.trim(),
          periodIndex: index,
          coordinate: index,
          rowNumber: index + 1,
        } : null
      )), [issue('invalid_token', 'error', 'A coluna de ordem contém valores vazios.', blankRows)]);
    }
    const values = rawValues.map((raw, index) => ({
      raw,
      label: raw.trim(),
      canonicalLabel: raw.trim(),
      periodIndex: index,
      coordinate: index,
      rowNumber: index + 1,
    }));
    return resolution('resolved', mode, 'order', 'observed-interval', values, []);
  }

  if (rawValues.length === 0) {
    return resolution('invalid', mode, null, 'observed-interval', [], [
      issue('invalid_token', 'error', 'A coluna temporal não contém valores.'),
    ]);
  }

  const invalid = (frequency: TemporalFrequency | null, effectBasis: TemporalColumnResolution['effectBasis'], message = 'Há valores que não correspondem ao período selecionado.') => resolution(
    'invalid', mode, frequency, effectBasis, rawValues.map(() => null), [issue('invalid_token', 'error', message)],
  );

  if (mode === 'annual') {
    const parsed = allParsed(rawValues, parseAnnual);
    return parsed ? resolveCalendar(rawValues, mode, parsed) : invalid('annual', 'annualized');
  }
  if (mode === 'semiannual') {
    const parsed = parseCalendarColumn(rawValues, 'semiannual');
    return parsed ? resolveCalendar(rawValues, mode, parsed) : invalid('semiannual', 'annualized');
  }
  if (mode === 'quarterly') {
    const parsed = parseCalendarColumn(rawValues, 'quarterly');
    return parsed ? resolveCalendar(rawValues, mode, parsed) : invalid('quarterly', 'annualized');
  }
  if (mode === 'monthly') {
    const parsed = allParsed(rawValues, parseMonth);
    return parsed ? resolveCalendar(rawValues, mode, parsed) : invalid('monthly', 'annualized');
  }
  if (mode === 'dates') {
    const dates = allParsed(rawValues, parseDateParts);
    return dates ? resolveDaily(rawValues, mode, dates) : invalid('daily', 'annualized');
  }
  if (mode === 'numeric') {
    const numbers = allParsed(rawValues, parseNumeric);
    return numbers ? resolveNumeric(rawValues, mode, numbers) : invalid('numeric', 'numeric-unit');
  }

  const dates = allParsed(rawValues, parseDateParts);
  if (dates) return resolveDaily(rawValues, mode, dates);

  const months = allParsed(rawValues, parseMonth);
  if (months) return resolveCalendar(rawValues, mode, months);

  const years = allParsed(rawValues, parseAnnual);
  if (years) return resolveCalendar(rawValues, mode, years);

  const semesters = parseCalendarColumn(rawValues, 'semiannual');
  const quarters = parseCalendarColumn(rawValues, 'quarterly');
  const decimals = allParsed(rawValues, parseDecimalPeriod);
  const semesterAllowed = semesters !== null && (
    rawValues.some((raw) => parseExplicitSemester(raw) !== null)
    || hasSemesterHint(header)
    || (decimals !== null && decimalSemesterHasRollover(decimals))
  );
  const quarterAllowed = quarters !== null && (
    rawValues.some((raw) => parseExplicitQuarter(raw) !== null)
    || hasQuarterHint(header)
  );

  if (hasQuarterHint(header) && quarterAllowed) return resolveCalendar(rawValues, mode, quarters!);
  if (hasSemesterHint(header) && semesterAllowed) return resolveCalendar(rawValues, mode, semesters!);
  if (semesterAllowed && !quarterAllowed) return resolveCalendar(rawValues, mode, semesters!);
  if (quarterAllowed && !semesterAllowed) return resolveCalendar(rawValues, mode, quarters!);
  if (semesterAllowed && quarterAllowed) {
    return resolution('ambiguous', mode, null, 'observed-interval', rawValues.map(() => null), [
      issue('ambiguous_frequency', 'warning', 'A coluna sustenta mais de uma frequência temporal.'),
    ]);
  }
  if (semesters !== null && decimals !== null && decimals.every((value) => value.slot <= 2)) {
    return resolution('ambiguous', mode, null, 'observed-interval', rawValues.map(() => null), [
      issue('ambiguous_frequency', 'warning', 'Rótulos decimais podem indicar semestres ou valores numéricos.'),
    ]);
  }

  const numbers = allParsed(rawValues, parseNumeric);
  if (numbers) return resolveNumeric(rawValues, mode, numbers);

  const explicitKinds = rawValues.map((value) => {
    if (parseExplicitSemester(value)) return 'semiannual';
    if (parseExplicitQuarter(value)) return 'quarterly';
    if (parseMonth(value)) return 'monthly';
    if (parseDateParts(value)) return 'daily';
    if (parseAnnual(value)) return 'annual';
    return null;
  }).filter((value): value is Exclude<TemporalFrequency, 'numeric' | 'order'> => value !== null);
  const issues = explicitKinds.length > 1 && new Set(explicitKinds).size > 1
    ? [issue('mixed_frequency', 'error', 'A coluna mistura frequências temporais diferentes.')]
    : [issue('invalid_token', 'error', 'Há valores temporais inválidos ou não reconhecidos.')];
  return resolution('invalid', mode, null, 'observed-interval', rawValues.map(() => null), issues);
}
