import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CatalogEntry } from '@/features/catalog/types';
import { ChevronDown, Database } from 'lucide-react';
import { VARIABLE_TYPE_LABELS } from './VariableFilters';

export interface VariableDetailPanelProps {
  entry: CatalogEntry | null;
  selectedLoadableCount: number;
  canLoadEstatistica: boolean;
  canLoadMapas?: boolean;
  loadError?: string | null;
  loadingEstatistica?: boolean;
  loadingMapas?: boolean;
  onLoadEstatistica: () => void;
  onLoadMapas?: () => void;
}

/** D-05 required provenance fields — refuse incomplete orphans in UI (T-05-09). */
export function hasCompleteProvenance(entry: CatalogEntry): boolean {
  return (
    Boolean(entry.id?.trim()) &&
    Boolean(entry.label?.trim()) &&
    Boolean(entry.variableType) &&
    Boolean(entry.domain?.trim()) &&
    Boolean(entry.sourceSystem?.trim()) &&
    Boolean(entry.sourceName?.trim()) &&
    Boolean(entry.tableOrIndicator?.trim()) &&
    Boolean(entry.period?.trim()) &&
    Boolean(entry.officialUrl?.trim()) &&
    Boolean(entry.methodologyNotes?.trim()) &&
    typeof entry.loadable === 'boolean'
  );
}

export function VariableDetailPanel({
  entry,
  selectedLoadableCount,
  canLoadEstatistica,
  canLoadMapas = canLoadEstatistica,
  loadError = null,
  loadingEstatistica = false,
  loadingMapas = false,
  onLoadEstatistica,
  onLoadMapas,
}: VariableDetailPanelProps) {
  if (!entry) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          heading="Selecione uma variável"
          body="Escolha um item na lista para ver seu resumo, consultar fonte e método e acessar as ações disponíveis."
        />
      </div>
    );
  }

  if (!hasCompleteProvenance(entry)) {
    console.assert(false, `Catalog entry missing D-05 provenance: ${entry.id}`);
    return (
      <EmptyState
        heading="Proveniência incompleta"
        body="Esta variável não pode ser exibida sem todos os campos de referência obrigatórios."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-sans text-heading font-bold text-text">{entry.label}</h2>
          <Badge variant="outline" className="font-sans text-[11px]">
            {VARIABLE_TYPE_LABELS[entry.variableType]}
          </Badge>
        </div>
        <p className="font-sans text-sm text-text-muted">Domínio: {entry.domain}</p>
      </header>

      <Collapsible className="rounded-xl border border-border bg-elevated/35">
        <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2.5 text-left font-sans text-sm font-semibold text-text">
          <Database className="size-4 text-accent" aria-hidden />
          Fonte e método
          <ChevronDown className="ml-auto size-4 text-text-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border px-3 py-3">
        <dl className="grid gap-3 sm:grid-cols-2" data-testid="provenance-block">
          <ProvenanceField label="Fonte/sistema" value={entry.sourceSystem} />
          <ProvenanceField label="Nome da fonte" value={entry.sourceName} />
          <ProvenanceField label="Tabela/indicador" value={entry.tableOrIndicator} />
          <ProvenanceField label="Período" value={entry.period} />
          <ProvenanceField label="Tipo" value={VARIABLE_TYPE_LABELS[entry.variableType]} />
          <ProvenanceField label="Domínio" value={entry.domain} />
          <div className="sm:col-span-2">
            <dt className="font-sans text-[11px] uppercase tracking-wide text-text-muted">
              URL oficial
            </dt>
            <dd className="mt-0.5">
              <a
                href={entry.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-sans text-sm text-accent underline-offset-2 hover:underline"
              >
                {entry.officialUrl}
              </a>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-sans text-[11px] uppercase tracking-wide text-text-muted">
              Notas metodológicas
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap font-sans text-sm text-text">
              {entry.methodologyNotes}
            </dd>
          </div>
        </dl>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          disabled={!canLoadEstatistica || loadingEstatistica || loadingMapas}
          onClick={onLoadEstatistica}
          className="bg-accent text-[#04120c] hover:bg-accent/90"
        >
          {loadingEstatistica
            ? 'Carregando…'
            : selectedLoadableCount > 1
              ? `Carregar na Estatística (${selectedLoadableCount})`
              : 'Carregar na Estatística'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!canLoadMapas || !onLoadMapas || loadingMapas || loadingEstatistica}
          onClick={onLoadMapas}
        >
          {loadingMapas
            ? 'Abrindo mapa…'
            : selectedLoadableCount > 1
              ? `Usar no mapa (${selectedLoadableCount})`
              : 'Usar no mapa'}
        </Button>
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive"
        >
          {loadError}
        </p>
      ) : null}
    </div>
  );
}

function ProvenanceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-sans text-[11px] uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-sans text-sm text-text">{value}</dd>
    </div>
  );
}
