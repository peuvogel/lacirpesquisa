import { useMemo } from 'react';
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateRangePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
  RangeCalendar,
} from 'react-aria-components';
import {
  CalendarDate,
  getLocalTimeZone,
  today,
  type DateValue,
} from '@internationalized/date';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GroupTimeConfig } from './mapAnalysisState';

export interface LacirDateRangePickerProps {
  time: GroupTimeConfig;
  onChange: (time: GroupTimeConfig) => void;
  /** Allowed years from catalog packs (e.g. 2013–2025). */
  yearOptions?: readonly string[];
  label?: string;
  className?: string;
}

type RangeValue = { start: DateValue; end: DateValue };

function yearBounds(yearOptions?: readonly string[]): { min: CalendarDate; max: CalendarDate } {
  const years =
    yearOptions && yearOptions.length > 0
      ? yearOptions.map((y) => parseInt(y, 10)).filter((n) => Number.isFinite(n))
      : [2013, 2025];
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  return {
    min: new CalendarDate(minY, 1, 1),
    max: new CalendarDate(maxY, 12, 31),
  };
}

function parseToDate(value: string | undefined, fallback: CalendarDate): CalendarDate {
  if (!value?.trim()) return fallback;
  const m = value.trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return fallback;
  const y = parseInt(m[1]!, 10);
  const month = parseInt(m[2] ?? '1', 10);
  const day = parseInt(m[3] ?? '1', 10);
  try {
    return new CalendarDate(y, month, day);
  } catch {
    return fallback;
  }
}

function toConfig(range: RangeValue | null): GroupTimeConfig {
  if (!range) return { mode: 'range' };
  const start = range.start.toString(); // YYYY-MM-DD
  const end = range.end.toString();
  return {
    mode: 'range',
    start: start.slice(0, 7),
    end: end.slice(0, 7),
    point: String(range.end.year),
  };
}

/**
 * Date range picker in the HeroUI/React Aria composition style —
 * DateField segments + RangeCalendar popover (no HeroUI dependency).
 */
export function LacirDateRangePicker({
  time,
  onChange,
  yearOptions,
  label = 'Intervalo',
  className,
}: LacirDateRangePickerProps) {
  const { min, max } = useMemo(() => yearBounds(yearOptions), [yearOptions]);
  const fallbackStart = min;
  const fallbackEnd = max;

  const value = useMemo<RangeValue | null>(() => {
    if (!time.start?.trim() && !time.end?.trim() && !time.point?.trim()) return null;
    const start = parseToDate(time.start ?? time.point, fallbackStart);
    const end = parseToDate(time.end ?? time.point, fallbackEnd);
    return start.compare(end) <= 0 ? { start, end } : { start: end, end: start };
  }, [fallbackEnd, fallbackStart, time.end, time.point, time.start]);

  return (
    <DateRangePicker
      aria-label={label}
      className={cn('flex w-full flex-col gap-1.5', className)}
      value={value}
      minValue={min}
      maxValue={max}
      granularity="day"
      onChange={(next) => onChange(toConfig(next))}
    >
      <Label className="font-sans text-sm font-bold text-text">{label}</Label>
      <Group className="flex h-10 w-full items-center gap-1 rounded-xl border border-border bg-elevated px-2 focus-within:ring-2 focus-within:ring-accent/40">
        <DateInput slot="start" className="flex flex-1 items-center gap-0.5 font-sans text-sm tabular-nums">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded px-0.5 outline-none data-[placeholder]:text-text-muted data-[focused]:bg-accent-soft data-[focused]:text-accent"
            />
          )}
        </DateInput>
        <span className="px-1 font-sans text-sm text-text-muted" aria-hidden>
          →
        </span>
        <DateInput slot="end" className="flex flex-1 items-center gap-0.5 font-sans text-sm tabular-nums">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded px-0.5 outline-none data-[placeholder]:text-text-muted data-[focused]:bg-accent-soft data-[focused]:text-accent"
            />
          )}
        </DateInput>
        <Button className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-accent-soft hover:text-accent">
          <CalendarDays className="size-4" aria-hidden />
        </Button>
      </Group>
      <Popover className="z-50 rounded-xl border border-border bg-elevated p-3 shadow-xl entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out">
        <Dialog className="outline-none">
          <RangeCalendar className="w-full font-sans text-sm text-text">
            <header className="mb-2 flex items-center justify-between gap-2">
              <Button slot="previous" className="size-8 rounded-lg hover:bg-accent-soft">
                ‹
              </Button>
              <Heading className="font-sans text-sm font-bold" />
              <Button slot="next" className="size-8 rounded-lg hover:bg-accent-soft">
                ›
              </Button>
            </header>
            <CalendarGrid className="w-full border-collapse">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="pb-1 text-center text-[10px] font-bold uppercase text-text-muted">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={cn(
                      'size-9 rounded-lg text-center outline-none data-[disabled]:text-text-muted/40',
                      'data-[hovered]:bg-accent-soft data-[selected]:bg-accent data-[selected]:text-white',
                      'data-[selection-start]:rounded-l-lg data-[selection-end]:rounded-r-lg',
                      'data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent',
                    )}
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
          <p className="mt-2 font-sans text-[11px] text-text-muted">
            Dados disponíveis: {min.year}–{max.year}
            {today(getLocalTimeZone()).year > max.year
              ? ''
              : ' (anos do catálogo SIH/CNES/SIDRA)'}
          </p>
        </Dialog>
      </Popover>
    </DateRangePicker>
  );
}
