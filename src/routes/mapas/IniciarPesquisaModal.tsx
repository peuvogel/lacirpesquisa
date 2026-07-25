import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getTestBadgeLabel, getTestById, isTestAvailable } from '@/features/tests/registry';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import type { TabularInputOptions } from '@/shared/data-input/types';
import { useSession } from '@/shared/session/SessionProvider';
import { cn } from '@/lib/utils';
import { getCollectionLinks } from './mockCollectionLinks';
import { suggestResearchForSelection, type ResearchSuggestion } from './suggestResearchForSelection';

/** Mapas → Estatística: suggested test if available, else t-student, else demo (T-02-07 whitelist). */
export function resolveHandoffTestId(suggestions: ResearchSuggestion[]): string {
  const primarySuggested = suggestions.find((suggestion) => suggestion.testId !== 'demo');
  if (primarySuggested && isTestAvailable(primarySuggested.testId)) {
    return primarySuggested.testId;
  }
  if (isTestAvailable('t-student')) {
    return 't-student';
  }
  return 'demo';
}

/** Broad DATASUS-shaped aliases so junk paste errors while typical TABNET tables still load. */
const MAPAS_TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    territorio: ['Município', 'UF', 'Unidade da Federação', 'Estado'],
    medida: [
      'Taxa por 100k',
      'Taxa',
      'Internações',
      'Óbitos',
      'Quantidade',
      'Valor',
      'Nascidos vivos',
    ],
  },
  requiredKeys: ['territorio', 'medida'],
  numericKeys: ['medida'],
  expectedFormatLabel: 'Território; Medida numérica',
};

export interface IniciarPesquisaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUFs: string[];
  selectedVariables: string[];
}

function SuggestionRow({
  testId,
  rationale,
}: {
  testId: string;
  rationale: string;
}) {
  const entry = getTestById(testId);
  if (!entry) return null;

  const isAvailable = entry.status === 'available';
  const badgeLabel = getTestBadgeLabel(entry);
  const isDemo = entry.id === 'demo';

  const content = (
    <>
      <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
        <span className="font-sans text-label font-bold text-text">{entry.title}</span>
        <span className="font-sans text-sm font-normal text-text-muted">{rationale}</span>
      </span>
      <Badge
        variant={isAvailable && !isDemo ? 'default' : 'outline'}
        className={cn(
          'shrink-0',
          isAvailable && !isDemo ? 'bg-accent text-[#04120c]' : 'border-border text-text-muted',
        )}
      >
        {badgeLabel}
      </Badge>
    </>
  );

  const rowClassName =
    'flex w-full items-start justify-between gap-2 rounded-lg border px-3.5 py-3 transition-all duration-200';

  if (isAvailable) {
    return (
      <div
        className={cn(
          rowClassName,
          'border-accent-border bg-accent-soft shadow-[inset_4px_0_0_var(--color-accent)]',
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      aria-disabled="true"
      className={cn(rowClassName, 'cursor-not-allowed border-transparent bg-transparent opacity-60')}
    >
      {content}
    </div>
  );
}

/**
 * D-24 stub handoff: selection → suggested analyses → official collection links
 * → paste table → continue to Estatística with session.dataset populated.
 */
export function IniciarPesquisaModal({
  open,
  onOpenChange,
  selectedUFs,
  selectedVariables,
}: IniciarPesquisaModalProps) {
  const navigate = useNavigate();
  const { setDataset } = useSession();
  const tabularInput = useTabularInput(MAPAS_TABULAR_OPTIONS);

  const suggestions = useMemo(
    () => suggestResearchForSelection(selectedUFs, selectedVariables),
    [selectedUFs, selectedVariables],
  );

  const sourceLabel = useMemo(() => {
    const ufPart = selectedUFs.length ? selectedUFs.join(', ') : 'sem UF';
    return `Mapas — ${ufPart}`;
  }, [selectedUFs]);

  function handleContinue() {
    if (tabularInput.status !== 'loaded') return;
    if (tabularInput.headers.length < 2 || tabularInput.bodyRows.length === 0) return;

    setDataset({
      headers: tabularInput.headers,
      rows: tabularInput.bodyRows,
      sourceLabel,
      confirmedAt: Date.now(),
    });
    onOpenChange(false);
    navigate('/', { state: { activeTestId: resolveHandoffTestId(suggestions) } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,820px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-sans text-heading font-bold text-text">
            Iniciar pesquisa
          </DialogTitle>
          <DialogDescription className="sr-only">
            Análises sugeridas, links oficiais de coleta e colagem de dados para continuar na
            Estatística.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="text-sm text-text">
            Os dados de disponibilidade e links abaixo são um exemplo da Fase 1 — o catálogo
            completo chega em uma fase posterior. Use esta tela para aprender o fluxo, não como
            fonte definitiva de cobertura.
          </p>
        </div>

        <section className="space-y-3" aria-labelledby="analises-possiveis-heading">
          <h2 id="analises-possiveis-heading" className="font-sans text-label font-bold text-text">
            Análises possíveis
          </h2>
          <div className="flex flex-col gap-2">
            {suggestions.map((suggestion) => (
              <SuggestionRow
                key={suggestion.testId}
                testId={suggestion.testId}
                rationale={suggestion.rationale}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="onde-coletar-heading">
          <h2 id="onde-coletar-heading" className="font-sans text-label font-bold text-text">
            Onde coletar
          </h2>
          {selectedVariables.length === 0 ? (
            <p className="text-sm text-text-muted">Selecione variáveis no painel para ver links oficiais.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {selectedVariables.map((variable) => {
                const links = getCollectionLinks(variable);
                return (
                  <div key={variable} className="rounded-lg border border-border px-3 py-3">
                    <h3 className="font-sans text-sm font-bold text-text">{variable}</h3>
                    {links.length === 0 ? (
                      <p className="mt-1 text-sm text-text-muted">sem link cadastrado ainda</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {links.map((link) => (
                          <li key={`${variable}-${link.label}`}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-sans text-sm font-bold text-primary underline-offset-2 hover:underline"
                            >
                              {link.label}
                            </a>
                            {link.note ? (
                              <p className="mt-0.5 text-sm text-text-muted">{link.note}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="colar-dados-heading">
          <h2 id="colar-dados-heading" className="font-sans text-label font-bold text-text">
            Colar os dados coletados
          </h2>
          <TabularInputPanel {...tabularInput} showPreview={false} />
          <Button
            type="button"
            disabled={
              tabularInput.status !== 'loaded' ||
              tabularInput.headers.length < 2 ||
              tabularInput.bodyRows.length === 0
            }
            onClick={handleContinue}
          >
            Continuar para Estatística
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
}
