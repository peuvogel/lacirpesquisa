import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  CATALOG_ANALYSIS_VARIABLES,
  getAnalysisVariableById,
  getCatalogVariableIdsByUf,
  type CatalogAnalysisVariable,
} from '@/features/catalog/catalogAnalysisData';
import { computeVariableIntersection } from './computeVariableIntersection';

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

function ProvenanceBadge({ variable }: { variable: CatalogAnalysisVariable }) {
  const label =
    variable.provenance === 'paste'
      ? 'Dados colados por você'
      : variable.sourceSystem
        ? `Catálogo LACIR · ${variable.sourceSystem}`
        : 'Catálogo LACIR';
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
  intersection: CatalogAnalysisVariable[];
  partial: Array<{ variable: CatalogAnalysisVariable; missingFrom: string[] }>;
} {
  // No UF lock yet (e.g. Variáveis → Mapas handoff): show full catalog list.
  if (territorySiglas.length === 0) {
    const intersection = CATALOG_ANALYSIS_VARIABLES.map((v) => ({ ...v }));
    for (const id of pastedVariableIds) {
      const variable = getAnalysisVariableById(id);
      if (variable && !intersection.some((entry) => entry.id === id)) {
        intersection.push({ ...variable, provenance: 'paste' });
      } else if (!variable && !intersection.some((entry) => entry.id === id)) {
        intersection.push({ id, label: id, provenance: 'paste' });
      }
    }
    return { intersection, partial: [] };
  }

  const variablesByUf = getCatalogVariableIdsByUf();
  const availability = computeVariableIntersection(territorySiglas, variablesByUf);

  const intersection = availability.intersection
    .map((id) => getAnalysisVariableById(id))
    .filter((entry): entry is CatalogAnalysisVariable => Boolean(entry));

  const partial = availability.partial
    .map(({ variable: id, missingFrom }) => {
      const variable = getAnalysisVariableById(id);
      return variable ? { variable, missingFrom } : null;
    })
    .filter(
      (entry): entry is { variable: CatalogAnalysisVariable; missingFrom: string[] } =>
        Boolean(entry),
    );

  for (const id of pastedVariableIds) {
    const variable = getAnalysisVariableById(id);
    if (variable && !intersection.some((entry) => entry.id === id)) {
      intersection.push({ ...variable, provenance: 'paste' });
    } else if (!variable && !intersection.some((entry) => entry.id === id)) {
      intersection.push({
        id,
        label: id,
        provenance: 'paste',
      });
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
        Variáveis do <strong>Catálogo LACIR</strong> vêm de packs SIH/CNES/SIDRA versionados.
        Dados colados por você refletem tabelas que você colou nesta sessão.
      </p>
    </div>
  );
}
