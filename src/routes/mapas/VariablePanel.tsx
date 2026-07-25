import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { computeVariableIntersection } from './computeVariableIntersection';
import { MOCK_VARIABLES_BY_UF } from './mockVariablesByUF';

export interface VariablePanelProps {
  hoveredUF: string | null;
  selectedUFs: string[];
  selectedVariables: string[];
  onToggleVariable: (variable: string) => void;
  onClearSelection: () => void;
  onIniciarPesquisa: () => void;
}

function formatMissingUfs(siglas: string[]): string {
  return siglas.join(', ');
}

export function VariablePanel({
  hoveredUF,
  selectedUFs,
  selectedVariables,
  onToggleVariable,
  onClearSelection,
  onIniciarPesquisa,
}: VariablePanelProps) {
  const drivingUFs =
    selectedUFs.length > 0 ? selectedUFs : hoveredUF ? [hoveredUF] : [];

  if (drivingUFs.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-border bg-surface p-6">
        <EmptyState
          heading="Explore o mapa do Brasil"
          body="Passe o mouse sobre um estado para ver as variáveis disponíveis ali, ou clique para fixar a seleção e comparar mais de um estado."
        />
      </div>
    );
  }

  const availability =
    drivingUFs.length === 1
      ? {
          intersection: MOCK_VARIABLES_BY_UF[drivingUFs[0]] ?? [],
          partial: [] as { variable: string; missingFrom: string[] }[],
        }
      : computeVariableIntersection(drivingUFs, MOCK_VARIABLES_BY_UF);

  const hasLockedSelection = selectedUFs.length > 0;

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-sans text-sm text-text-muted">
          {hasLockedSelection ? 'Estados selecionados:' : 'Visualizando:'}
        </span>
        {drivingUFs.map((sigla) => (
          <span
            key={sigla}
            className="rounded-md border border-accent-border bg-accent-soft px-2 py-0.5 font-sans text-xs font-medium text-accent"
          >
            {sigla}
          </span>
        ))}
        {hasLockedSelection ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
            limpar seleção
          </Button>
        ) : null}
      </div>

      <p className="mt-4 font-sans text-sm text-text-muted">
        Selecione uma ou mais variáveis para incluir na pesquisa.
      </p>

      <ul className="mt-4 flex-1 space-y-2 overflow-y-auto" aria-label="Variáveis disponíveis">
        {availability.intersection.map((variable) => (
          <li
            key={`intersection-${variable}`}
            className={cn(
              'flex items-start gap-3 rounded-lg border border-transparent bg-accent-soft px-3 py-2',
            )}
          >
            <Checkbox
              id={`var-${variable}`}
              checked={selectedVariables.includes(variable)}
              onCheckedChange={() => onToggleVariable(variable)}
              aria-label={variable}
            />
            <label htmlFor={`var-${variable}`} className="cursor-pointer font-sans text-sm text-text">
              {variable}
            </label>
          </li>
        ))}

        {availability.partial.map(({ variable, missingFrom }) => (
          <li
            key={`partial-${variable}`}
            className="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
          >
            <Checkbox
              id={`var-${variable}`}
              checked={selectedVariables.includes(variable)}
              onCheckedChange={() => onToggleVariable(variable)}
              aria-label={variable}
            />
            <label htmlFor={`var-${variable}`} className="cursor-pointer font-sans text-sm text-text">
              {variable}{' '}
              <span className="text-destructive">
                Não existe em {formatMissingUfs(missingFrom)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        className="mt-6 w-full"
        disabled={selectedVariables.length === 0}
        onClick={onIniciarPesquisa}
      >
        Iniciar pesquisa
      </Button>
    </div>
  );
}
