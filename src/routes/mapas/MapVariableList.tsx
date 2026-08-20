import { useMemo, useState } from 'react';
import { ChevronDown, Database, LockKeyhole, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { VariableType } from '@/features/research/types';
import { VARIABLE_PROFILES } from '@/features/research/variableProfiles';
import { cn } from '@/lib/utils';
import type { GuidedVariableSelectorProps } from '@/routes/variaveis/GuidedVariableSelector';
import type {
  GuidedAvailability,
  GuidedVariableViewModel,
} from '@/routes/variaveis/guidedViewModels';
import { ResearchCutContext } from '@/routes/variaveis/ResearchCutContext';

type RoleFilter = 'all' | 'outcome' | 'exposure' | 'denominator';
type TypeFilter = 'all' | VariableType | 'categorical_group';
type AvailabilityFilter = 'all' | GuidedAvailability;

const AVAILABILITY_LABELS: Record<GuidedAvailability, string> = {
  complete: 'Disponível',
  partial: 'Parcial',
  none: 'Indisponível',
};

const EXPOSURE_VARIABLE_IDS = new Set(
  VARIABLE_PROFILES.flatMap((profile) =>
    profile.exposureVariableId ? [profile.exposureVariableId] : []),
);
const DENOMINATOR_VARIABLE_IDS = new Set(
  VARIABLE_PROFILES.flatMap((profile) =>
    profile.denominatorVariableId ? [profile.denominatorVariableId] : []),
);

function matchesRole(variableId: string, role: RoleFilter): boolean {
  if (role === 'all' || role === 'outcome') return true;
  if (role === 'exposure') return EXPOSURE_VARIABLE_IDS.has(variableId);
  return DENOMINATOR_VARIABLE_IDS.has(variableId);
}

function matchesType(type: VariableType, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'categorical_group') return type === 'categorical' || type === 'ordinal';
  return type === filter;
}

export function MapVariableList({
  design,
  variables,
  selectedVariableIds,
  onSelectionChange,
}: GuidedVariableSelectorProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return variables.filter((variable) =>
      (!normalizedSearch || variable.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
      && matchesRole(variable.id, roleFilter)
      && matchesType(variable.type, typeFilter)
      && (availabilityFilter === 'all' || variable.availability === availabilityFilter));
  }, [availabilityFilter, roleFilter, search, typeFilter, variables]);

  const filteredIds = new Set(filtered.map((variable) => variable.id));
  const selectedOutsideFilters = variables.filter((variable) =>
    selectedVariableIds.includes(variable.id) && !filteredIds.has(variable.id));

  function toggle(id: string) {
    onSelectionChange(
      selectedVariableIds.includes(id)
        ? selectedVariableIds.filter((selectedId) => selectedId !== id)
        : [...selectedVariableIds, id],
    );
  }

  return (
    <section aria-labelledby="map-variable-selector-heading" className="space-y-4">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Variáveis do recorte
        </p>
        <h2 id="map-variable-selector-heading" className="mt-1 font-sans text-heading font-bold text-text">
          2. Escolha as variáveis
        </h2>
        <p className="mt-1 font-sans text-sm text-text-muted">
          Marque as medidas que entram na análise. Itens parciais continuam disponíveis com a justificativa.
        </p>
      </div>

      <ResearchCutContext design={design} />

      <div className="grid gap-3 rounded-2xl border border-border bg-surface/55 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="sm:col-span-2 xl:col-span-1">
          <span className="sr-only">Buscar variável</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar variável"
              placeholder="Buscar variável"
              className="h-10 w-full rounded-xl border border-border bg-elevated pl-9 pr-3 font-sans text-sm text-text outline-none placeholder:text-text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            />
          </span>
        </label>

        <FilterSelect
          label="Filtrar por papel"
          value={roleFilter}
          onChange={(value) => setRoleFilter(value as RoleFilter)}
          options={[
            ['all', 'Todos os papéis'],
            ['outcome', 'Desfecho'],
            ['exposure', 'Exposição/contexto'],
            ['denominator', 'Denominador'],
          ]}
        />
        <FilterSelect
          label="Filtrar por tipo"
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as TypeFilter)}
          options={[
            ['all', 'Todos os tipos'],
            ['count', 'Contagem'],
            ['rate', 'Taxa'],
            ['numeric', 'Numérica'],
            ['categorical_group', 'Categórica/ordinal'],
          ]}
        />
        <FilterSelect
          label="Filtrar por disponibilidade"
          value={availabilityFilter}
          onChange={(value) => setAvailabilityFilter(value as AvailabilityFilter)}
          options={[
            ['all', 'Toda disponibilidade'],
            ['complete', 'Disponível'],
            ['partial', 'Parcial'],
            ['none', 'Indisponível'],
          ]}
        />
      </div>

      {selectedOutsideFilters.length > 0 ? (
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-3">
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-accent">
            Selecionadas — sempre visíveis
          </p>
          <VariableRows
            ariaLabel="Variáveis selecionadas fora dos filtros"
            variables={selectedOutsideFilters}
            selectedVariableIds={selectedVariableIds}
            onToggle={toggle}
          />
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <VariableRows
          ariaLabel="Variáveis para análise"
          variables={filtered}
          selectedVariableIds={selectedVariableIds}
          onToggle={toggle}
        />
      ) : (
        <div>
          <ul aria-label="Variáveis para análise" className="sr-only" />
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center font-sans text-sm text-text-muted">
            Nenhuma variável corresponde aos filtros. As selecionadas continuam visíveis acima.
          </p>
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[value: string, label: string]>;
}) {
  return (
    <label className="font-sans text-xs font-semibold text-text-muted">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 w-full rounded-xl border border-border bg-elevated px-3 font-sans text-sm font-normal text-text outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function VariableRows({
  ariaLabel,
  variables,
  selectedVariableIds,
  onToggle,
}: {
  ariaLabel: string;
  variables: GuidedVariableViewModel[];
  selectedVariableIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul aria-label={ariaLabel} className="space-y-2">
      {variables.map((variable) => (
        <li key={variable.id}>
          <MapVariableRow
            variable={variable}
            checked={selectedVariableIds.includes(variable.id)}
            onToggle={() => onToggle(variable.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function MapVariableRow({
  variable,
  checked,
  onToggle,
}: {
  variable: GuidedVariableViewModel;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = variable.availability === 'none';
  const inputId = `map-variable-checkbox-${variable.id}`;
  const statusLabel = AVAILABILITY_LABELS[variable.availability];

  return (
    <article
      data-testid={`map-variable-${variable.id}`}
      data-availability={variable.availability}
      className={cn(
        'rounded-xl border px-3 py-2.5 transition-colors',
        checked ? 'border-accent/50 bg-accent/8' : 'border-border/80 bg-elevated/45',
        variable.availability === 'partial' && 'bg-amber-400/[0.035]',
        disabled && 'opacity-55',
      )}
    >
      <label htmlFor={inputId} className={cn('flex items-start gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <Checkbox
          id={inputId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onToggle}
          aria-label={`${variable.label}, ${variable.typeLabel}, ${statusLabel}`}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-sans text-sm font-semibold leading-snug text-text">{variable.label}</span>
            <span className="rounded-full border border-border px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {variable.typeLabel}
            </span>
            <span className={cn(
              'ml-auto font-sans text-xs font-semibold',
              variable.availability === 'complete' && 'text-emerald-300',
              variable.availability === 'partial' && 'text-amber-300',
              variable.availability === 'none' && 'text-text-muted',
            )}>
              {statusLabel}
            </span>
            {disabled ? <LockKeyhole className="size-3.5 text-text-muted" aria-hidden /> : null}
          </span>
          {variable.availabilityReason ? (
            <span className="mt-1 block font-sans text-xs leading-relaxed text-text-muted">
              {variable.availabilityReason}
            </span>
          ) : null}
        </span>
      </label>

      <Collapsible>
        <CollapsibleTrigger className="group mt-2 flex w-full items-center gap-1 border-t border-border/70 pt-2 font-sans text-[11px] font-semibold text-text-muted hover:text-text">
          <Database className="size-3" aria-hidden />
          Fonte e método
          <ChevronDown className="ml-auto size-3 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 font-sans text-xs leading-relaxed text-text-muted">
          <p><span className="font-semibold text-text">Fonte:</span> {variable.sourceMethod.source}</p>
          <p className="mt-1">{variable.sourceMethod.method}</p>
          {variable.sourceMethod.url ? (
            <a className="mt-1 block break-all text-accent hover:underline" href={variable.sourceMethod.url} target="_blank" rel="noopener noreferrer">
              Acessar fonte oficial
            </a>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}
