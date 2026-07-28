import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  isRangeTimeInvalid,
  isTimeValid,
  type GroupTimeConfig,
} from './mapAnalysisState';

export interface TemporalidadeControlProps {
  time: GroupTimeConfig;
  onChange: (time: GroupTimeConfig) => void;
  /** Years that have pack data for the selected research variables. */
  yearOptions?: readonly string[];
  className?: string;
}

function yearFromPeriod(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const y = parseInt(value.trim().slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function toRangeConfig(startYear: number, endYear: number): GroupTimeConfig {
  const start = Math.min(startYear, endYear);
  const end = Math.max(startYear, endYear);
  return {
    mode: 'range',
    start: `${start}-01`,
    end: `${end}-12`,
    point: String(end),
  };
}

function formatAvailableYears(years: readonly number[]): string {
  if (years.length === 0) return 'nenhum';
  if (years.length === 1) return String(years[0]);
  const contiguous =
    years[years.length - 1]! - years[0]! + 1 === years.length &&
    years.every((y, i) => i === 0 || y === years[i - 1]! + 1);
  if (contiguous) return `${years[0]}–${years[years.length - 1]}`;
  return years.join(', ');
}

/**
 * Period picker constrained to catalog years with data.
 * Shows available coverage first; never accepts years outside that set.
 */
export function TemporalidadeControl({
  time: timeProp,
  onChange,
  yearOptions = [],
  className,
}: TemporalidadeControlProps) {
  const time = timeProp ?? { mode: 'point' as const };
  const years = useMemo(
    () =>
      [...new Set(yearOptions.map((y) => parseInt(y, 10)).filter((n) => Number.isFinite(n)))].sort(
        (a, b) => a - b,
      ),
    [yearOptions],
  );
  const yearSet = useMemo(() => new Set(years), [years]);
  const rangeInvalid = isRangeTimeInvalid(time);
  const startY = yearFromPeriod(time.start ?? time.point);
  const endY = yearFromPeriod(time.end ?? time.point);
  const startOk = startY !== null && yearSet.has(startY);
  const endOk = endY !== null && yearSet.has(endY);
  const outsideAvailable =
    years.length > 0 &&
    ((startY !== null && !yearSet.has(startY)) || (endY !== null && !yearSet.has(endY)));
  const ready = isTimeValid(time) && startOk && endOk && !outsideAvailable;
  const yearsKey = years.join(',');
  const lastYearsKey = useRef('');

  useEffect(() => {
    if (years.length === 0) {
      lastYearsKey.current = '';
      return;
    }
    const yearsChanged = lastYearsKey.current !== yearsKey;
    const outOfBounds =
      !isTimeValid(time) ||
      outsideAvailable ||
      (startY !== null && !yearSet.has(startY)) ||
      (endY !== null && !yearSet.has(endY));
    if (!yearsChanged && !outOfBounds) return;
    lastYearsKey.current = yearsKey;
    onChange(toRangeConfig(years[0]!, years[years.length - 1]!));
  }, [endY, onChange, outsideAvailable, startY, time, yearSet, years, yearsKey]);

  const setStart = (raw: string) => {
    const y = parseInt(raw, 10);
    if (!yearSet.has(y)) return;
    const end = endOk && endY !== null ? endY : years[years.length - 1]!;
    onChange(toRangeConfig(y, end));
  };

  const setEnd = (raw: string) => {
    const y = parseInt(raw, 10);
    if (!yearSet.has(y)) return;
    const start = startOk && startY !== null ? startY : years[0]!;
    onChange(toRangeConfig(start, y));
  };

  const selectYear = (y: number) => {
    if (!yearSet.has(y)) return;
    if (!startOk || !endOk || startY === null || endY === null) {
      onChange(toRangeConfig(y, y));
      return;
    }
    // Expand / shrink toward the clicked year as a single-year or bound adjust.
    if (y < startY) onChange(toRangeConfig(y, endY));
    else if (y > endY) onChange(toRangeConfig(startY, y));
    else if (y === startY && y === endY) return;
    else if (y === startY) onChange(toRangeConfig(startY + 1 <= endY ? startY + 1 : startY, endY));
    else if (y === endY) onChange(toRangeConfig(startY, endY - 1 >= startY ? endY - 1 : endY));
    else onChange(toRangeConfig(y, y));
  };

  if (years.length === 0) {
    return (
      <div className={cn('space-y-2 rounded-xl border border-border/70 bg-elevated/50 p-3', className)}>
        <p className="font-sans text-sm font-bold text-text">Intervalo nos dados</p>
        <p className="font-sans text-sm text-text-muted" role="status">
          Nenhum ano associado a esta pesquisa no catálogo. Escolha uma doença com dados no site
          (aparecem primeiro na lista — ex.: embolia, AVC, varizes) ou importe a série depois.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--lacir-group-accent,var(--color-accent))_35%,transparent)] bg-[color-mix(in_srgb,var(--lacir-group-accent,var(--color-accent))_10%,transparent)] px-3 py-2.5">
        <p className="font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
          Anos com dados nesta pesquisa
        </p>
        <p className="mt-0.5 font-sans text-sm font-bold text-text">
          {formatAvailableYears(years)}
          <span className="ml-1.5 font-normal text-text-muted">
            · {years.length} ano{years.length === 1 ? '' : 's'}
          </span>
        </p>
        <p className="mt-1 font-sans text-[11px] text-text-muted">
          Só é possível selecionar anos listados abaixo — intervalos sem dados não são aceitos.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Anos disponíveis">
        {years.map((y) => {
          const inRange =
            startOk && endOk && startY !== null && endY !== null && y >= startY && y <= endY;
          return (
            <button
              key={y}
              type="button"
              role="listitem"
              onClick={() => selectYear(y)}
              className={cn(
                'min-w-[3.25rem] rounded-lg border px-2 py-1.5 font-sans text-xs font-bold tabular-nums transition-colors',
                inRange
                  ? 'border-[var(--lacir-group-accent,var(--color-accent))] bg-[color-mix(in_srgb,var(--lacir-group-accent,var(--color-accent))_22%,transparent)] text-[var(--lacir-group-accent,var(--color-accent))]'
                  : 'border-border bg-elevated text-text-muted hover:border-accent-border hover:text-text',
              )}
              aria-pressed={inRange}
            >
              {y}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
            De
          </span>
          <select
            value={startOk && startY !== null ? String(startY) : String(years[0])}
            onChange={(e) => setStart(e.target.value)}
            className="h-10 rounded-xl border border-border bg-elevated px-3 font-sans text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Ano inicial"
          >
            {years.map((y) => (
              <option key={`start-${y}`} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Até
          </span>
          <select
            value={endOk && endY !== null ? String(endY) : String(years[years.length - 1])}
            onChange={(e) => setEnd(e.target.value)}
            className="h-10 rounded-xl border border-border bg-elevated px-3 font-sans text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Ano final"
          >
            {years.map((y) => (
              <option key={`end-${y}`} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rangeInvalid ? (
        <p className="font-sans text-sm text-warning" role="alert">
          O fim do período deve ser igual ou posterior ao início.
        </p>
      ) : null}
      {outsideAvailable ? (
        <p className="font-sans text-sm text-warning" role="alert">
          O intervalo escolhido inclui anos sem dados. Ajuste para os anos disponíveis.
        </p>
      ) : null}
      {!ready && !rangeInvalid && !outsideAvailable ? (
        <p className="font-sans text-xs text-text-muted">Definindo período inicial…</p>
      ) : null}
    </div>
  );
}
