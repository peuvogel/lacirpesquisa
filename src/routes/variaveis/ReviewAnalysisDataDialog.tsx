import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  excludeObservedValue,
  reviseScenario,
  scenarioCellKey,
  treatAsMissing,
  useOriginalValue,
  type ScenarioDecision,
} from '@/features/research/scenarios';
import type {
  AnalysisCell,
  AnalysisScenario,
  ResearchDesign,
  ResearchPeriod,
} from '@/features/research/types';

type ReviewChoice = 'recommended' | 'include' | 'exclude' | 'unavailable';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function formattedValue(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'sem valor' : number.format(value);
}

const SOURCE_LABELS: Record<AnalysisCell['sourceStatus'], string> = {
  observed: 'Valor observado',
  collection_zero: 'Zero confirmado na fonte',
  missing: 'Sem dados na fonte',
  suppressed: 'Dado suprimido',
  not_applicable: 'Não aplicável',
  not_queried: 'Não consultado',
};

const ANALYTIC_LABELS: Record<AnalysisCell['analyticStatus'], string> = {
  include: 'Incluído na análise',
  exclude_missing: 'Fora por ausência',
  exclude_suspected_noncollection: 'Fora por possível não coleta',
  exclude_manual: 'Excluído pelo pesquisador',
  requires_review: 'Revisão necessária',
};

const REASON_LABELS: Record<string, string> = {
  source_unavailable: 'A fonte não forneceu valor para esta combinação.',
  incomplete_disease_coverage: 'A cobertura das doenças do recorte está incompleta.',
  inconsistent_population: 'Os denominadores populacionais não coincidem.',
  invalid_categorical_components: 'Internações e óbitos não formam uma frequência válida.',
  zero_suspected_noncollection: 'O zero destoa de valores altos comparáveis e pode indicar não coleta.',
  zero_review_municipal: 'Zero municipal: confirme manualmente se houve evento.',
  zero_review_rare_variable: 'Evento raro: confirme manualmente se o zero é real.',
  zero_review_insufficient_history: 'Não há histórico suficiente para classificar o zero.',
  zero_review_insufficient_comparables: 'Não há territórios comparáveis suficientes.',
  zero_review_missing_rate_events: 'Faltam eventos auxiliares para avaliar este zero.',
  manual_use_original: 'Incluído apó revisão do pesquisador.',
  manual_treat_as_missing: 'Tratado como ausência pelo pesquisador.',
  manual_positive_exclusion: 'Valor positivo excluído com justificativa.',
  rare_event_review: 'Evento raro: confirme manualmente se o zero é real.',
};

function periodSummary(period: ResearchPeriod): string {
  if (period.mode === 'point') return period.point;
  if (period.mode === 'range') return `${period.start.slice(0, 4)}–${period.end.slice(0, 4)}`;
  return `${period.periodA.slice(0, 4)} × ${period.periodB.slice(0, 4)}`;
}

export interface ReviewAnalysisDataDialogProps {
  design: ResearchDesign;
  recommendedScenario: AnalysisScenario;
  activeScenario: AnalysisScenario;
  variableLabels: Record<string, string>;
  createdAfterResults: boolean;
  onApply: (scenario: AnalysisScenario) => void;
}

function choiceFor(
  recommended: AnalysisScenario['cells'][number],
  active: AnalysisScenario['cells'][number] | undefined,
): ReviewChoice {
  if (recommended.rawValue === null || !Number.isFinite(recommended.rawValue)) return 'unavailable';
  if (!active || active.analyticStatus === recommended.analyticStatus) return 'recommended';
  return active.analyticStatus === 'include' ? 'include' : 'exclude';
}

export function ReviewAnalysisDataDialog({
  design,
  recommendedScenario,
  activeScenario,
  variableLabels,
  createdAfterResults,
  onApply,
}: ReviewAnalysisDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Record<string, ReviewChoice>>({});
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const activeByKey = useMemo(
    () => new Map(activeScenario.cells.map((cell) => [scenarioCellKey(cell), cell])),
    [activeScenario],
  );
  const activeDecisionByKey = useMemo(
    () => new Map(activeScenario.decisions.map((decision) => [decision.cellKey, decision])),
    [activeScenario],
  );
  const cells = useMemo(
    () => recommendedScenario.cells.filter((cell) => variableLabels[cell.variableId]),
    [recommendedScenario, variableLabels],
  );
  const territoryLabels = useMemo(
    () => new Map(design.groups.flatMap((group) => group.territories.map((territory) => [territory.id, territory.label] as const))),
    [design],
  );
  const groupLabels = useMemo(() => new Map(design.groups.map((group) => [group.id, group.name])), [design]);
  const cellCountsByUnitVariable = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of cells) {
      const key = JSON.stringify([cell.groupId, cell.territoryId, cell.variableId]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [cells]);

  function displayPeriod(cell: AnalysisCell): string {
    const unitKey = JSON.stringify([cell.groupId, cell.territoryId, cell.variableId]);
    if ((cellCountsByUnitVariable.get(unitKey) ?? 0) > 1) return cell.periodKey;
    const period = design.period.scope === 'shared'
      ? design.period.time
      : design.period.timesByGroupId[cell.groupId];
    return period ? periodSummary(period) : cell.periodKey;
  }

  useEffect(() => {
    if (!open) return;
    setChoices(Object.fromEntries(cells.map((cell) => {
      const key = scenarioCellKey(cell);
      return [key, choiceFor(cell, activeByKey.get(key))];
    })));
    setJustifications(Object.fromEntries(cells.flatMap((cell) => {
      const key = scenarioCellKey(cell);
      const note = activeDecisionByKey.get(key)?.note;
      return note ? [[key, note]] : [];
    })));
    setError(null);
  }, [activeByKey, activeDecisionByKey, cells, open]);

  function apply() {
    const decisions: ScenarioDecision[] = [];
    for (const cell of cells) {
      const key = scenarioCellKey(cell);
      const choice = choices[key] ?? 'recommended';
      if (choice === 'recommended' || choice === 'unavailable') continue;
      if (choice === 'include') {
        if (cell.analyticStatus !== 'include') decisions.push(useOriginalValue(key, 'Incluído pelo pesquisador na revisão.'));
        continue;
      }
      if (cell.rawValue === 0) {
        if (cell.analyticStatus !== 'exclude_manual') decisions.push(treatAsMissing(key, 'Tratado como ausência pelo pesquisador.'));
        continue;
      }
      if (typeof cell.rawValue === 'number' && cell.rawValue > 0) {
        const justification = justifications[key]?.trim();
        if (!justification) {
          setError(`Informe por que o valor positivo de ${territoryLabels.get(cell.territoryId) ?? cell.territoryId} deve ser excluído.`);
          return;
        }
        decisions.push(excludeObservedValue(key, justification));
      }
    }
    try {
      const revised = decisions.length === 0
        ? recommendedScenario
        : reviseScenario(recommendedScenario, decisions, { createdAfterResults });
      onApply(revised);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível aplicar a revisão.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto px-0 text-sm font-semibold text-accent">
          Revisar dados da análise
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>Revisar dados da análise</DialogTitle>
          <DialogDescription>
            Zero e falta de coleta são estados diferentes. Ausências não podem ser inventadas; excluir um valor positivo exige justificativa e recalcula toda a análise.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-2">
          {cells.map((cell) => {
            const key = scenarioCellKey(cell);
            const territory = territoryLabels.get(cell.territoryId) ?? cell.territoryId;
            const variable = variableLabels[cell.variableId] ?? cell.variableId;
            const label = `${territory}, ${variable}, ${cell.periodKey}`;
            const unavailable = cell.rawValue === null || !Number.isFinite(cell.rawValue);
            const isPositive = typeof cell.rawValue === 'number' && cell.rawValue > 0;
            const reason = cell.reasonCode ? REASON_LABELS[cell.reasonCode] : undefined;
            return (
              <div key={key} className="grid gap-3 rounded-2xl border border-border bg-surface/70 p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)] md:items-center">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-bold text-text">{territory} · {variable}</p>
                  <p className="mt-1 font-sans text-xs text-text-muted">
                    {groupLabels.get(cell.groupId) ?? cell.groupId} · {displayPeriod(cell)} · valor: {formattedValue(cell.rawValue)}
                  </p>
                  <p className="mt-1 font-sans text-xs text-text-muted">
                    {SOURCE_LABELS[cell.sourceStatus]} · {ANALYTIC_LABELS[cell.analyticStatus]}
                  </p>
                  {reason ? <p className="mt-1 font-sans text-xs text-text-muted">{reason}</p> : null}
                  {unavailable ? (
                    <p className="mt-1 font-sans text-xs text-amber-300">{territory}: sem valor bruto; não é possível incluir esta observação.</p>
                  ) : null}
                </div>
                <div>
                  <label className="sr-only" htmlFor={`review-${key}`}>{label}</label>
                  <select
                    id={`review-${key}`}
                    aria-label={label}
                    disabled={unavailable}
                    value={choices[key] ?? (unavailable ? 'unavailable' : 'recommended')}
                    onChange={(event) => setChoices((current) => ({ ...current, [key]: event.target.value as ReviewChoice }))}
                    className="w-full rounded-xl border border-border bg-elevated px-3 py-2 font-sans text-sm text-text disabled:opacity-60"
                  >
                    {unavailable ? <option value="unavailable">Manter como sem dados</option> : null}
                    {!unavailable ? <option value="recommended">Usar recomendação do sistema</option> : null}
                    {cell.rawValue === 0 ? <option value="include">Incluir como zero observado</option> : null}
                    {!unavailable ? <option value="exclude">Excluir da análise</option> : null}
                    {isPositive ? <option value="include">Incluir valor observado</option> : null}
                  </select>
                  {isPositive && choices[key] === 'exclude' ? (
                    <textarea
                      aria-label={`Justificativa para ${label}`}
                      value={justifications[key] ?? ''}
                      onChange={(event) => setJustifications((current) => ({ ...current, [key]: event.target.value }))}
                      placeholder="Justificativa da exclusão"
                      className="mt-2 min-h-16 w-full rounded-xl border border-border bg-elevated px-3 py-2 font-sans text-xs text-text"
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {createdAfterResults ? (
          <p className="mx-5 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 font-sans text-xs text-amber-200">
            Como os resultados já foram vistos, esta revisão será marcada como exploratória.
          </p>
        ) : null}
        {error ? <p role="alert" className="px-5 font-sans text-sm text-red-300">{error}</p> : null}
        <DialogFooter className="mx-0 mb-0 px-5">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" onClick={apply}>Aplicar e recalcular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
