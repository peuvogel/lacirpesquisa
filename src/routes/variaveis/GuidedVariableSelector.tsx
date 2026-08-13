import { ChevronDown, Database, LockKeyhole } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ResearchDesign, VariableType } from '@/features/research/types';
import { cn } from '@/lib/utils';
import type { GuidedVariableViewModel } from './guidedViewModels';
import { ResearchCutContext } from './ResearchCutContext';

const COLUMNS: Array<{ title: string; types: VariableType[] }> = [
  { title: 'Contagens', types: ['count'] },
  { title: 'Taxas e percentuais', types: ['rate'] },
  { title: 'Numéricas', types: ['numeric'] },
  { title: 'Categóricas e ordinais', types: ['categorical', 'ordinal'] },
];

export interface GuidedVariableSelectorProps {
  design: ResearchDesign;
  variables: GuidedVariableViewModel[];
  selectedVariableIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function GuidedVariableSelector({
  design,
  variables,
  selectedVariableIds,
  onSelectionChange,
}: GuidedVariableSelectorProps) {
  function toggle(id: string) {
    onSelectionChange(
      selectedVariableIds.includes(id)
        ? selectedVariableIds.filter((selectedId) => selectedId !== id)
        : [...selectedVariableIds, id],
    );
  }

  return (
    <section aria-labelledby="variable-selector-heading" className="space-y-4">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Variáveis do recorte
        </p>
        <h2 id="variable-selector-heading" className="mt-1 font-sans text-heading font-bold text-text">
          2. Escolha as variáveis
        </h2>
        <p className="mt-1 font-sans text-sm text-text-muted">
          Selecione uma ou mais. Cobertura parcial continua disponível e será explicada.
        </p>
      </div>

      <ResearchCutContext design={design} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => (
          <fieldset key={column.title} className="min-w-0 rounded-2xl border border-border bg-surface/65 p-3">
            <legend className="px-1 font-sans text-sm font-bold text-text">{column.title}</legend>
            <div className="mt-2 space-y-2">
              {variables.filter((variable) => column.types.includes(variable.type)).map((variable) => (
                <VariableOption
                  key={variable.id}
                  variable={variable}
                  checked={selectedVariableIds.includes(variable.id)}
                  onToggle={() => toggle(variable.id)}
                />
              ))}
              {variables.every((variable) => !column.types.includes(variable.type)) ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center font-sans text-xs text-text-muted">
                  Nenhuma variável disponível
                </p>
              ) : null}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function VariableOption({
  variable,
  checked,
  onToggle,
}: {
  variable: GuidedVariableViewModel;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = variable.availability === 'none';
  const muted = variable.availability !== 'complete';
  const inputId = `guided-variable-${variable.id}`;

  return (
    <div
      data-testid={inputId}
      data-availability={variable.availability}
      className={cn(
        'rounded-xl border p-3 transition-colors',
        checked ? 'border-accent/50 bg-accent/8' : 'border-border/80 bg-elevated/45',
        muted && 'bg-white/[0.025]',
        disabled && 'opacity-55',
      )}
    >
      <label htmlFor={inputId} className={cn('flex items-start gap-2.5', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <Checkbox
          id={inputId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onToggle}
          aria-label={`${variable.label}, ${variable.typeLabel}`}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="font-sans text-sm font-semibold leading-snug text-text">{variable.label}</span>
            {disabled ? <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden /> : null}
          </span>
          <span className="mt-0.5 block font-sans text-[11px] uppercase tracking-wide text-text-muted">
            {variable.typeLabel}
          </span>
          {variable.availabilityReason ? (
            <span className="mt-1.5 block font-sans text-xs leading-relaxed text-text-muted">
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
    </div>
  );
}
