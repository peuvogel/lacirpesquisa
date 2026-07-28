import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getTestById, TEST_REGISTRY } from '@/features/tests/registry';
import { groupTestsByGroup } from './Sidebar';
import { SidebarTestLink } from './SidebarTestLink';

type OutcomeType = 'numerico' | 'categorico' | 'contagem' | 'serie-temporal';

type StudyDesign =
  | 'dois-grupos-independentes'
  | 'dois-momentos-mesmo-grupo'
  | 'tres-ou-mais-grupos'
  | 'relacao-numericas'
  | 'associacao-categoricas'
  | 'sim-ou-nao-preditores'
  | 'contagem-simples'
  | 'contagem-variancia-alta'
  | 'tendencia-tempo';

interface Recommendation {
  primaryId: string;
  note?: string;
  alternativeId?: string;
}

const OUTCOME_OPTIONS: Array<{ id: OutcomeType; label: string }> = [
  { id: 'numerico', label: 'Numérico contínuo' },
  { id: 'categorico', label: 'Categórico / proporção' },
  { id: 'contagem', label: 'Contagem de eventos' },
  { id: 'serie-temporal', label: 'Série temporal' },
];

const DESIGN_OPTIONS: Record<OutcomeType, Array<{ id: StudyDesign; label: string }>> = {
  numerico: [
    { id: 'dois-grupos-independentes', label: 'Dois grupos independentes' },
    { id: 'dois-momentos-mesmo-grupo', label: 'Dois momentos do mesmo grupo' },
    { id: 'tres-ou-mais-grupos', label: 'Três ou mais grupos' },
    { id: 'relacao-numericas', label: 'Relação entre duas variáveis numéricas' },
  ],
  categorico: [
    { id: 'associacao-categoricas', label: 'Associação entre duas variáveis categóricas' },
    { id: 'sim-ou-nao-preditores', label: 'Desfecho sim-ou-não com preditores' },
  ],
  contagem: [
    { id: 'contagem-simples', label: 'Contagem simples' },
    { id: 'contagem-variancia-alta', label: 'Contagem com variância alta' },
  ],
  'serie-temporal': [{ id: 'tendencia-tempo', label: 'Tendência ao longo do tempo' }],
};

function resolveRecommendation(outcome: OutcomeType, design: StudyDesign): Recommendation {
  if (outcome === 'numerico') {
    if (design === 'dois-grupos-independentes') return { primaryId: 't-student' };
    if (design === 'dois-momentos-mesmo-grupo') {
      return {
        primaryId: 't-student',
        note: 'Use a variante pareada (mesmo grupo medido em dois momentos).',
      };
    }
    if (design === 'tres-ou-mais-grupos') {
      return {
        primaryId: 'anova-tukey',
        alternativeId: 'kruskal-dunn',
        note: 'Se os dados não forem normais, prefira a alternativa não paramétrica.',
      };
    }
    return { primaryId: 'correlacao' };
  }

  if (outcome === 'categorico') {
    if (design === 'associacao-categoricas') return { primaryId: 'qui-quadrado' };
    return { primaryId: 'logistica' };
  }

  if (outcome === 'contagem') {
    if (design === 'contagem-simples') return { primaryId: 'poisson' };
    return { primaryId: 'binomial-negativa' };
  }

  return { primaryId: 'prais-winsten' };
}

export interface QualTesteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only ever called with an 'available' id. */
  onSelectTest: (id: string) => void;
}

/**
 * UX-01 decision-tree modal (D-13/D-14): tipo de desfecho → desenho do estudo
 * → teste recomendado, plus the full TEST_REGISTRY roadmap grouped like the
 * sidebar so the two surfaces cannot drift (01-RESEARCH.md Pitfall 4).
 */
export function QualTesteModal({ open, onOpenChange, onSelectTest }: QualTesteModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [outcome, setOutcome] = useState<OutcomeType | null>(null);
  const [design, setDesign] = useState<StudyDesign | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setOutcome(null);
      setDesign(null);
    }
  }, [open]);

  const recommendation =
    outcome && design ? resolveRecommendation(outcome, design) : null;
  const primaryEntry = recommendation ? getTestById(recommendation.primaryId) : null;
  const alternativeEntry =
    recommendation?.alternativeId ? getTestById(recommendation.alternativeId) : null;
  const groups = groupTestsByGroup(TEST_REGISTRY);

  function handleSelectAvailable(id: string) {
    onSelectTest(id);
    onOpenChange(false);
  }

  function handleRestart() {
    setStep(1);
    setOutcome(null);
    setDesign(null);
  }

  function handleBack() {
    if (step === 3) {
      setDesign(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      setOutcome(null);
      setStep(1);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-sans text-heading font-bold text-text">
            Qual teste usar?
          </DialogTitle>
          <DialogDescription className="sr-only">
            Assistente em três passos para escolher o teste estatístico adequado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {step === 1 ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 font-sans text-label font-bold text-text">
                Que tipo de desfecho você quer analisar?
              </legend>
              {OUTCOME_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal py-3 text-left"
                  onClick={() => {
                    setOutcome(option.id);
                    setStep(2);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </fieldset>
          ) : null}

          {step === 2 && outcome ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 font-sans text-label font-bold text-text">
                Como os dados foram coletados?
              </legend>
              {DESIGN_OPTIONS[outcome].map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start whitespace-normal py-3 text-left"
                  onClick={() => {
                    setDesign(option.id);
                    setStep(3);
                  }}
                >
                  {option.label}
                </Button>
              ))}
              <Button type="button" variant="ghost" onClick={handleBack}>
                Voltar
              </Button>
            </fieldset>
          ) : null}

          {step === 3 && recommendation && primaryEntry ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 font-sans text-label font-bold text-text">Recomendação</h3>
                {recommendation.note ? (
                  <p className="mb-3 font-sans text-sm text-text-muted">{recommendation.note}</p>
                ) : null}
                <SidebarTestLink
                  entry={primaryEntry}
                  active={false}
                  onSelect={handleSelectAvailable}
                  showSubtitle
                />
                {alternativeEntry ? (
                  <div className="mt-3">
                    <p className="mb-2 font-sans text-sm font-bold text-text-muted">
                      Alternativa não paramétrica
                    </p>
                    <SidebarTestLink
                      entry={alternativeEntry}
                      active={false}
                      onSelect={handleSelectAvailable}
                      showSubtitle
                    />
                  </div>
                ) : null}
                {primaryEntry.status === 'em-breve' ? (
                  <p className="mt-2 font-sans text-sm text-text-muted">
                    Este teste chega na fase {primaryEntry.phase} da LACIR. Enquanto isso, comece pelo
                    t de Student.
                  </p>
                ) : null}
              </div>

              {primaryEntry.status === 'available' ? (
                <Button type="button" onClick={() => handleSelectAvailable(primaryEntry.id)}>
                  Usar {primaryEntry.title}
                </Button>
              ) : (
                <Button type="button" onClick={() => handleSelectAvailable('t-student')}>
                  Começar pelo t de Student
                </Button>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={handleBack}>
                  Voltar
                </Button>
                <Button type="button" variant="ghost" onClick={handleRestart}>
                  Recomeçar
                </Button>
              </div>
            </div>
          ) : null}

          <div className="border-t border-border pt-4">
            <h3 className="mb-3 font-sans text-label font-bold text-text">Roadmap de testes</h3>
            <div className="flex max-h-64 flex-col gap-4 overflow-y-auto">
              {groups.map(([groupName, entries]) => (
                <div key={groupName} className="flex flex-col gap-1.5">
                  <h4 className="px-1 font-sans text-xs font-bold tracking-wide text-text-muted uppercase">
                    {groupName}
                  </h4>
                  {entries.map((entry) => (
                    <SidebarTestLink
                      key={entry.id}
                      entry={entry}
                      active={false}
                      onSelect={handleSelectAvailable}
                      showSubtitle
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
