/**
 * @deprecated Phase 4 primary handoff is {@link ReviewAnalysisDialog}. Kept for legacy
 * flat UF/variable selection and collection-link reference during migration.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import { useSession } from '@/shared/session/SessionProvider';
import { getCollectionLinks } from './mockCollectionLinks';
import {
  MAPAS_TABULAR_OPTIONS,
  resolveHandoffTestId,
} from './mapHandoffShared';
import {
  suggestResearchFromFlatSelection,
  type ResearchSuggestion,
} from './suggestResearchForSelection';

export { resolveHandoffTestId, MAPAS_TABULAR_OPTIONS } from './mapHandoffShared';
export type { ResearchSuggestion } from './suggestResearchForSelection';
export { ReviewAnalysisDialog } from './ReviewAnalysisDialog';

export interface IniciarPesquisaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUFs: string[];
  selectedVariables: string[];
}

/**
 * @deprecated Use ReviewAnalysisDialog for MAP-09 group-aware handoff (D-20–D-22).
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
    () => suggestResearchFromFlatSelection(selectedUFs, selectedVariables),
    [selectedUFs, selectedVariables],
  );

  const sourceLabel = useMemo(() => {
    const ufPart = selectedUFs.length ? selectedUFs.join(', ') : 'sem UF';
    return `Mapas: ${ufPart}`;
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
    const evaluatedTestId = resolveHandoffTestId(suggestions);
    onOpenChange(false);
    if (evaluatedTestId) navigate('/', { state: { activeTestId: evaluatedTestId } });
    else navigate('/');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,820px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-sans text-heading font-bold text-text">
            Iniciar pesquisa
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fluxo legado da Fase 1 — use Revisar e analisar no mapa para o handoff atual.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="text-sm text-text">
            Este fluxo legado será removido. Use <strong>Revisar e analisar</strong> no mapa para
            montar a tabela e ir para Estatística.
          </p>
        </div>

        <section className="space-y-3" aria-labelledby="analises-possiveis-heading">
          <h2 id="analises-possiveis-heading" className="font-sans text-label font-bold text-text">
            Análises possíveis
          </h2>
          <div className="flex flex-col gap-2">
            {suggestions.length > 0 ? suggestions.map((suggestion) => (
              <p key={suggestion.testId} className="text-sm text-text-muted">
                {suggestion.rationale}
              </p>
            )) : (
              <p className="text-sm text-text-muted">
                Os testes serão avaliados depois de conhecer os valores, a distribuição e a independência dos dados.
              </p>
            )}
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
