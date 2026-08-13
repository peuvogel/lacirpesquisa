import { AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react';
import { compareScenarios } from '@/features/research/scenarios';
import type { AnalysisScenario, ResearchDesign } from '@/features/research/types';
import { ResultsPanel } from '@/routes/estatistica/ResultsPanel';
import { GuidedResultMap } from './GuidedResultMap';
import { ReviewAnalysisDataDialog } from './ReviewAnalysisDataDialog';
import type { GuidedTestRun } from './runGuidedTests';

export interface GuidedResultsSectionProps {
  design: ResearchDesign;
  recommendedScenario: AnalysisScenario;
  activeScenario: AnalysisScenario;
  variableLabels: Record<string, string>;
  run: GuidedTestRun | null;
  recommendedRun?: GuidedTestRun | null;
  runError: string | null;
  pendingReview: boolean;
  onScenarioChange: (scenario: AnalysisScenario) => void;
}

function ResultRoleBadge({ role }: { role: 'principal' | 'sensibilidade' }) {
  return (
    <span className={role === 'principal'
      ? 'rounded-full bg-accent/10 px-2.5 py-1 font-sans text-xs font-semibold text-accent'
      : 'rounded-full bg-blue-400/10 px-2.5 py-1 font-sans text-xs font-semibold text-blue-300'}>
      {role === 'principal' ? 'Teste principal' : 'Análise de sensibilidade'}
    </span>
  );
}

function conclusion(run: GuidedTestRun): string {
  const primary = run.results.find((result) => result.role === 'principal') ?? run.results[0];
  if (!primary) return 'Nenhum resultado foi calculado.';
  const effect = primary.metrics.find((metric) => /efeito|diferença|coeficiente|variação|mudança/i.test(metric.label))
    ?? primary.metrics.find((metric) => !/evidência|p-valor/i.test(metric.label));
  const interval = primary.metrics.find((metric) => /intervalo/i.test(metric.label));
  const effectText = effect
    ? `${effect.label}: ${effect.value}${effect.hint && /IC\s*95%|intervalo/i.test(effect.hint) ? ` (${effect.hint})` : ''}`
    : 'consulte a estimativa e o intervalo apresentados acima';
  const intervalText = interval && interval !== effect ? ` ${interval.label}: ${interval.value}.` : '';
  const evidence = primary.pValue !== null && Number.isFinite(primary.pValue)
    ? primary.pValue < 0.05
      ? 'forneceu evidência estatística no limiar de 5%'
      : 'não forneceu evidência estatística suficiente no limiar de 5%'
    : 'deve ser interpretado pelos efeitos, intervalos e diagnósticos apresentados';
  return `Efeito principal — ${effectText}.${intervalText} Depois, quanto à evidência, ${primary.title} ${evidence}. Como a análise usa agregados territoriais, a diferença ou associação não demonstra causalidade nem efeito individual.`;
}

function reviewedCellsSummary(
  design: ResearchDesign,
  scenario: AnalysisScenario,
  variableLabels: Record<string, string>,
): string | null {
  const territories = new Map(design.groups.flatMap((group) =>
    group.territories.map((territory) => [territory.id, territory.label] as const)));
  const items = scenario.decisions.slice(0, 2).flatMap((decision) => {
    try {
      const parsed = JSON.parse(decision.cellKey) as [string, string, string, string];
      const [, territoryId, periodKey, variableId] = parsed;
      const place = territories.get(territoryId) ?? territoryId;
      const variable = variableLabels[variableId] ?? variableId;
      return [`${place} · ${periodKey} · ${variable}: ${decision.note ?? 'decisão analítica revisada'}`];
    } catch {
      return [];
    }
  });
  if (items.length === 0) return null;
  const remaining = scenario.decisions.length - items.length;
  return `${items.join(' ')}${remaining > 0 ? ` E mais ${remaining} alteração(ões).` : ''}`;
}

export function GuidedResultsSection({
  design,
  recommendedScenario,
  activeScenario,
  variableLabels,
  run,
  recommendedRun = null,
  runError,
  pendingReview,
  onScenarioChange,
}: GuidedResultsSectionProps) {
  if (pendingReview) {
    return (
      <section aria-labelledby="guided-review-heading" className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-300">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Decisão necessária</p>
            <h2 id="guided-review-heading" className="mt-1 font-sans text-heading font-bold text-text">Revise os dados da análise</h2>
            <p className="mt-1 max-w-3xl font-sans text-sm text-text-muted">
              Há zero(s) plausível(is), mas incerto(s) neste recorte pequeno ou raro. Confirme se entram como zero observado ou ficam fora; nenhum teste será liberado antes disso.
            </p>
          </div>
        </div>
        <ReviewAnalysisDataDialog
          design={design}
          recommendedScenario={recommendedScenario}
          activeScenario={activeScenario}
          variableLabels={variableLabels}
          createdAfterResults={false}
          onApply={onScenarioChange}
        />
      </section>
    );
  }

  if (runError) {
    return (
      <section role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/5 p-4">
        <h2 className="font-sans text-heading font-bold text-text">O cálculo foi bloqueado</h2>
        <p className="mt-1 font-sans text-sm text-text-muted">{runError}</p>
        <p className="mt-2 font-sans text-xs text-text-muted">Revise as escolhas; nenhum resultado parcial foi apresentado.</p>
        <div className="mt-3">
          <ReviewAnalysisDataDialog
            design={design}
            recommendedScenario={recommendedScenario}
            activeScenario={activeScenario}
            variableLabels={variableLabels}
            createdAfterResults={activeScenario.createdAfterResults}
            onApply={onScenarioChange}
          />
        </div>
      </section>
    );
  }

  if (!run) {
    const firstVariable = Object.keys(variableLabels)[0];
    return (
      <section aria-labelledby="guided-description-heading" className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <CheckCircle2 className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">Síntese</p>
            <h2 id="guided-description-heading" className="mt-1 font-sans text-heading font-bold text-text">4. Conclusão descritiva</h2>
            <p className="mt-1 max-w-3xl font-sans text-sm text-text-muted">
              Os gráficos e sumários acima descrevem somente os valores disponíveis no recorte. Ausência de dado não foi convertida em zero e nenhuma inferência causal foi feita.
            </p>
          </div>
        </div>
        {firstVariable ? <GuidedResultMap
          design={design}
          scenario={activeScenario}
          variableId={firstVariable}
          variableLabel={variableLabels[firstVariable] ?? firstVariable}
        /> : null}
        <ReviewAnalysisDataDialog
          design={design}
          recommendedScenario={recommendedScenario}
          activeScenario={activeScenario}
          variableLabels={variableLabels}
          createdAfterResults
          onApply={onScenarioChange}
        />
      </section>
    );
  }

  const primary = run.results.find((result) => result.role === 'principal') ?? run.results[0];
  const recommendedPrimary = recommendedRun?.results.find((result) => result.role === 'principal') ?? recommendedRun?.results[0];
  const comparison = compareScenarios(recommendedScenario, activeScenario, {
    ...(recommendedPrimary ? {
      recommended: {
        n: recommendedPrimary.coverage.used,
        effectDirection: recommendedPrimary.effectDirection,
        interpretationKey: recommendedPrimary.pValue === null
          ? 'sem-limiar'
          : recommendedPrimary.pValue < 0.05 ? 'evidencia' : 'sem-evidencia',
      },
    } : {}),
    ...(primary ? {
      revised: {
        n: primary.coverage.used,
        effectDirection: primary.effectDirection,
        interpretationKey: primary.pValue === null
          ? 'sem-limiar'
          : primary.pValue < 0.05 ? 'evidencia' : 'sem-evidencia',
      },
    } : {}),
  });
  const directionChanged = comparison.effectDirection.changed;
  const evidenceChanged = comparison.interpretationChanged;
  const recommendedEffect = recommendedPrimary?.metrics.find((metric) => /efeito|diferença|coeficiente|variação|mudança/i.test(metric.label));
  const revisedEffect = primary?.metrics.find((metric) => /efeito|diferença|coeficiente|variação|mudança/i.test(metric.label));
  const reviewSummary = reviewedCellsSummary(design, activeScenario, variableLabels);
  const excludedZeros = activeScenario.cells.filter((cell) => cell.rawValue === 0 && cell.analyticStatus !== 'include').length;

  return (
    <section aria-labelledby="guided-results-heading" className="space-y-8">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <FlaskConical className="size-4" aria-hidden />
        </span>
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">Cálculo no próprio fluxo</p>
          <h2 id="guided-results-heading" className="mt-1 font-sans text-heading font-bold text-text">5. Resultados no recorte</h2>
          <p className="mt-1 font-sans text-sm text-text-muted">
            O teste principal vem primeiro; os demais verificam a sensibilidade da conclusão.
          </p>
        </div>
      </div>

      {run.results.map((result) => (
        <article key={result.testId} className="rounded-2xl border border-border bg-surface/55 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-sans text-base font-bold text-text">{result.title} · {result.role}</h3>
            <ResultRoleBadge role={result.role} />
          </div>
          <ResultsPanel
            title={`Resultado de ${result.title}`}
            metrics={result.metrics}
            chart={result.chart}
            additionalCharts={result.additionalCharts}
            interpretation={result.interpretation}
            exportFilename={`${result.testId}-recorte-lacirstat.png`}
            headingLevel={4}
          />
        </article>
      ))}

      {primary ? <GuidedResultMap
        design={design}
        scenario={activeScenario}
        variableId={primary.outcomeVariableId}
        variableLabel={variableLabels[primary.outcomeVariableId] ?? primary.outcomeVariableId}
      /> : null}

      <section aria-labelledby="guided-conclusion-heading" className="rounded-2xl border border-accent/25 bg-accent/5 p-4 sm:p-5">
        <h3 id="guided-conclusion-heading" className="font-sans text-base font-bold text-text">Conclusão</h3>
        <p className="mt-2 font-sans text-sm leading-relaxed text-text-muted">{conclusion(run)}</p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-text-muted">
          {excludedZeros > 0
            ? `${excludedZeros} zero(s) bruto(s) ficaram fora por revisão ou forte suspeita de não coleta; isso foi mantido separado de “sem dados” no mapa.`
            : 'Zeros confirmados permaneceram como zero; células sem valor permaneceram como sem dados.'}
        </p>
        {activeScenario.createdAfterResults ? (
          <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 font-sans text-xs text-amber-200">
            Análise exploratória após revisão: o número de células incluídas mudou de {comparison.n.recommended} para {comparison.n.revised}.
            {recommendedEffect && revisedEffect ? ` Efeito principal: ${recommendedEffect.value} → ${revisedEffect.value}.` : ''}
            {directionChanged === null ? '' : directionChanged ? ' A direção do efeito mudou.' : ' A direção do efeito foi preservada.'}
            {evidenceChanged === null ? '' : evidenceChanged ? ' A conclusão no limiar de 5% mudou.' : ' A conclusão no limiar de 5% não mudou.'}
            {reviewSummary ? ` ${reviewSummary}` : ''}
          </div>
        ) : null}
        <div className="mt-3">
          <ReviewAnalysisDataDialog
            design={design}
            recommendedScenario={recommendedScenario}
            activeScenario={activeScenario}
            variableLabels={variableLabels}
            createdAfterResults
            onApply={onScenarioChange}
          />
        </div>
      </section>
    </section>
  );
}
