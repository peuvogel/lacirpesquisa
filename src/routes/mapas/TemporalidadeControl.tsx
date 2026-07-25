import { EmptyState } from '@/components/EmptyState';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  CAPACITATION_MAX_YEAR,
  CAPACITATION_MIN_YEAR,
  clampYear,
  isRangeTimeInvalid,
  isTimeValid,
  type GroupTimeConfig,
  type TimeMode,
} from './mapAnalysisState';

const DEFAULT_YEAR_OPTIONS = Array.from(
  { length: CAPACITATION_MAX_YEAR - CAPACITATION_MIN_YEAR + 1 },
  (_, index) => String(CAPACITATION_MIN_YEAR + index),
);

export interface TemporalidadeControlProps {
  time: GroupTimeConfig;
  onChange: (time: GroupTimeConfig) => void;
  /** When set (catalog pack years), replaces the full capacitação 2000–2025 list (D-19). */
  yearOptions?: readonly string[];
  className?: string;
}

function YearSelect({
  id,
  label,
  value,
  onChange,
  yearOptions,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (year: string) => void;
  yearOptions: readonly string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-sans text-sm font-bold">
        {label}
      </Label>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Escolha o ano" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ComparePeriodInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (period: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-sans text-sm font-bold">
        {label}
      </Label>
      <input
        id={id}
        type="text"
        value={value ?? ''}
        placeholder="Ex.: 2018–2022"
        onChange={(event) => onChange(event.target.value)}
        className="flex h-9 w-full rounded-md border border-border bg-elevated px-3 font-sans text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );
}

export function TemporalidadeControl({
  time,
  onChange,
  yearOptions,
  className,
}: TemporalidadeControlProps) {
  const years = yearOptions?.length ? yearOptions : DEFAULT_YEAR_OPTIONS;
  const hasTime = isTimeValid(time);
  const rangeInvalid = isRangeTimeInvalid(time);

  const handleModeChange = (mode: TimeMode) => {
    onChange({ ...time, mode });
  };

  const handlePointChange = (point: string) => {
    onChange({ mode: 'point', point: clampYear(point) });
  };

  const handleRangeChange = (field: 'start' | 'end', raw: string) => {
    const clamped = clampYear(raw);
    onChange({
      mode: 'range',
      start: field === 'start' ? clamped : time.start,
      end: field === 'end' ? clamped : time.end,
    });
  };

  const handleCompareChange = (field: 'periodA' | 'periodB', value: string) => {
    onChange({
      mode: 'compare',
      periodA: field === 'periodA' ? value : time.periodA,
      periodB: field === 'periodB' ? value : time.periodB,
    });
  };

  if (!hasTime && time.mode === 'point' && !time.point?.trim()) {
    return (
      <div className={cn('space-y-4', className)}>
        <EmptyState
          heading="Quando analisar?"
          body="Escolha um ano específico ou um intervalo de anos para este grupo."
        />
        <Tabs value={time.mode} onValueChange={(value) => handleModeChange(value as TimeMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="point">Ano único</TabsTrigger>
            <TabsTrigger value="range">Intervalo de anos</TabsTrigger>
            <TabsTrigger value="compare">Comparar dois períodos</TabsTrigger>
          </TabsList>
          <TabsContent value="point" className="mt-4">
            <YearSelect
              id="time-point"
              label="Ano único"
              value={time.point}
              onChange={handlePointChange}
              yearOptions={years}
            />
          </TabsContent>
          <TabsContent value="range" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <YearSelect
                id="time-start"
                label="Ano inicial"
                value={time.start}
                onChange={(year) => handleRangeChange('start', year)}
                yearOptions={years}
              />
              <YearSelect
                id="time-end"
                label="Ano final"
                value={time.end}
                onChange={(year) => handleRangeChange('end', year)}
                yearOptions={years}
              />
            </div>
            {rangeInvalid ? (
              <p className="font-sans text-sm text-warning" role="alert">
                O ano final deve ser igual ou posterior ao ano inicial.
              </p>
            ) : null}
          </TabsContent>
          <TabsContent value="compare" className="mt-4 space-y-3">
            <ComparePeriodInput
              id="period-a"
              label="Período A"
              value={time.periodA}
              onChange={(value) => handleCompareChange('periodA', value)}
            />
            <ComparePeriodInput
              id="period-b"
              label="Período B"
              value={time.periodB}
              onChange={(value) => handleCompareChange('periodB', value)}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Tabs value={time.mode} onValueChange={(value) => handleModeChange(value as TimeMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="point">Ano único</TabsTrigger>
          <TabsTrigger value="range">Intervalo de anos</TabsTrigger>
          <TabsTrigger value="compare">Comparar dois períodos</TabsTrigger>
        </TabsList>
        <TabsContent value="point" className="mt-4">
          <YearSelect
            id="time-point"
            label="Ano único"
            value={time.point}
            onChange={handlePointChange}
            yearOptions={years}
          />
        </TabsContent>
        <TabsContent value="range" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <YearSelect
              id="time-start"
              label="Ano inicial"
              value={time.start}
              onChange={(year) => handleRangeChange('start', year)}
              yearOptions={years}
            />
            <YearSelect
              id="time-end"
              label="Ano final"
              value={time.end}
              onChange={(year) => handleRangeChange('end', year)}
              yearOptions={years}
            />
          </div>
          {rangeInvalid ? (
            <p className="font-sans text-sm text-warning" role="alert">
              O ano final deve ser igual ou posterior ao ano inicial.
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="compare" className="mt-4 space-y-3">
          <ComparePeriodInput
            id="period-a"
            label="Período A"
            value={time.periodA}
            onChange={(value) => handleCompareChange('periodA', value)}
          />
          <ComparePeriodInput
            id="period-b"
            label="Período B"
            value={time.periodB}
            onChange={(value) => handleCompareChange('periodB', value)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
