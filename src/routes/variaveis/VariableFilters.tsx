import type { CatalogFilters } from '@/features/catalog/filterCatalog';
import type { VariableType } from '@/features/catalog/types';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  categorica: 'Categórica',
  numerica: 'Numérica',
  ordinal: 'Ordinal',
  taxa: 'Taxa',
  contagem: 'Contagem',
  texto: 'Texto',
};

const ALL = '__all__';

export interface VariableFiltersProps {
  filters: CatalogFilters;
  sourceOptions: string[];
  domainOptions: string[];
  onChange: (next: CatalogFilters) => void;
}

export function VariableFilters({
  filters,
  sourceOptions,
  domainOptions,
  onChange,
}: VariableFiltersProps) {
  const loadableValue =
    filters.loadable === true ? 'true' : filters.loadable === false ? 'false' : ALL;

  return (
    <div
      className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end"
      role="search"
      aria-label="Filtros do catálogo"
    >
      <div className="min-w-[220px] flex-1">
        <Label htmlFor="catalog-search" className="font-sans text-label text-text-muted">
          Buscar
        </Label>
        <input
          id="catalog-search"
          type="search"
          value={filters.query ?? ''}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Nome, id ou fonte…"
          className="mt-1.5 flex h-9 w-full rounded-md border border-border bg-elevated px-3 font-sans text-sm text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <FilterSelect
        id="catalog-source"
        label="Fonte / sistema"
        value={filters.sourceSystem || ALL}
        onValueChange={(v) =>
          onChange({ ...filters, sourceSystem: v === ALL ? undefined : v })
        }
        options={sourceOptions.map((s) => ({ value: s, label: s }))}
      />

      <FilterSelect
        id="catalog-type"
        label="Tipo"
        value={filters.variableType || ALL}
        onValueChange={(v) =>
          onChange({
            ...filters,
            variableType: v === ALL ? '' : (v as VariableType),
          })
        }
        options={(Object.keys(VARIABLE_TYPE_LABELS) as VariableType[]).map((t) => ({
          value: t,
          label: VARIABLE_TYPE_LABELS[t],
        }))}
      />

      <FilterSelect
        id="catalog-domain"
        label="Domínio"
        value={filters.domain || ALL}
        onValueChange={(v) => onChange({ ...filters, domain: v === ALL ? undefined : v })}
        options={domainOptions.map((d) => ({ value: d, label: d }))}
      />

      <FilterSelect
        id="catalog-loadable"
        label="Carregável"
        value={loadableValue}
        onValueChange={(v) =>
          onChange({
            ...filters,
            loadable: v === ALL ? null : v === 'true',
          })
        }
        options={[
          { value: 'true', label: 'Sim' },
          { value: 'false', label: 'Não (referência)' },
        ]}
      />
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onValueChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="min-w-[160px]">
      <Label htmlFor={id} className="font-sans text-label text-text-muted">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="mt-1.5 h-9 w-full min-w-[160px] bg-elevated">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
