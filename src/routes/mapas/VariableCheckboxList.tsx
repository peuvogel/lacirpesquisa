import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { computeVariableIntersection } from './computeVariableIntersection';
import {
  getMockVariableById,
  getMockVariableIdsByUf,
  type MockVariable,
} from './mockAnalysisData';

export interface VariableCheckboxListProps {
  territorySiglas: string[];
  selectedVariableIds: string[];
  pastedVariableIds?: string[];
  onToggleVariable: (variableId: string) => void;
  className?: string;
}

function formatMissingUfs(siglas: string[]): string {
  return siglas.join(', ');
}

function ProvenanceBadge({ variable }: { variable: MockVariable }) {
  const label = variable.provenance === 'paste' ? 'Dados colados por você' : 'Exemplo didático';
  return (
    <Badge variant="outline" className="shrink-0 font-sans text-[11px]">
      {label}
    </Badge>
  );
}

function resolveVariableRows(
  territorySiglas: string[],
  pastedVariableIds: string[],
): {
  intersection: MockVariable[];
  partial: Array<{ variable: MockVariable; missingFrom: string[] }>;
} {
  const variablesByUf = getMockVariableIdsByUf();
  const availability = computeVariableIntersection(territorySiglas, variablesByUf);

  const intersection = availability.intersection
    .map((id) => getMockVariableById(id))
    .filter((entry): entry is MockVariable => Boolean(entry));

  const partial = availability.partial
    .map(({ variable: id, missingFrom }) => {
      const variable = getMockVariableById(id);
      return variable ? { variable, missingFrom } : null;
    })
    .filter((entry): entry is { variable: MockVariable; missingFrom: string[] } => Boolean(entry));

  for (const id of pastedVariableIds) {
    const variable = getMockVariableById(id);
    if (variable && !intersection.some((entry) => entry.id === id)) {
      intersection.push({ ...variable, provenance: 'paste' });
    }
  }

  return { intersection, partial };
}

export function VariableCheckboxList({
  territorySiglas,
  selectedVariableIds,
  pastedVariableIds = [],
  onToggleVariable,
  className,
}: VariableCheckboxListProps) {
  const { intersection, partial } = resolveVariableRows(territorySiglas, pastedVariableIds);

  return (
    <div className={cn('space-y-3', className)}>
      <p className="font-sans text-sm text-text-muted">
        Selecione uma ou mais variáveis para este grupo.
      </p>

      <ul className="max-h-[280px] space-y-2 overflow-y-auto" aria-label="Variáveis disponíveis">
        {intersection.map((variable) => (
          <li
            key={`intersection-${variable.id}`}
            className="flex items-start gap-3 rounded-lg border border-transparent bg-accent-soft px-3 py-2"
          >
            <Checkbox
              id={`var-${variable.id}`}
              checked={selectedVariableIds.includes(variable.id)}
              onCheckedChange={() => onToggleVariable(variable.id)}
              aria-label={variable.label}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <label
                htmlFor={`var-${variable.id}`}
                className="cursor-pointer font-sans text-sm text-text"
              >
                {variable.label}
              </label>
              <ProvenanceBadge variable={variable} />
            </div>
          </li>
        ))}

        {partial.map(({ variable, missingFrom }) => (
          <li
            key={`partial-${variable.id}`}
            className="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
          >
            <Checkbox
              id={`var-${variable.id}`}
              checked={selectedVariableIds.includes(variable.id)}
              onCheckedChange={() => onToggleVariable(variable.id)}
              aria-label={variable.label}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor={`var-${variable.id}`}
                  className="cursor-pointer font-sans text-sm text-text"
                >
                  {variable.label}
                </label>
                <ProvenanceBadge variable={variable} />
              </div>
              <span className="font-sans text-sm text-destructive">
                Não existe em {formatMissingUfs(missingFrom)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="font-sans text-xs text-text-muted" data-testid="variable-provenance-footnote">
        Variáveis marcadas como <strong>Exemplo didático</strong> vêm de dados fictícios para
        capacitação. Dados colados por você refletem tabelas que você colou nesta sessão.
      </p>
    </div>
  );
}
