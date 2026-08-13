import { AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react';
import type { AnalysisScenario, ResearchDesign } from '@/features/research/types';
import { ResultsPanel } from '@/routes/estatistica/ResultsPanel';
import { GuidedResultMap } from './GuidedResultMap';
import type { PraisGroupTrendRun } from './praisGroupTrends';
import { ReviewAnalysisDataDialog } from './ReviewAnalysisDataDialog';
import type { GuidedTestRun } from './runGuidedTests';

export interface GuidedResultsSectionProps {
  design: ResearchDesign;
  recommendedScenario: AnalysisScenario;
  activeScenario: AnalysisScenario;
  variableLabels: Record<string, string>;
  run: GuidedTestRun | null;
  praisGroupRun?: PraisGroupTrendRun | null;
  recommendedRun?: GuidedTestRun | null;
  runError: string | null;
  pendingReview: boolean;
  onScenarioChange: (scenario: AnalysisScenario) => void;
}

function GroupTrendResults({
  run,
  variableLabels,
}: {
  run: PraisGroupTrendRun | null | undefined;
  variableLabels: Record<string, string>;
}) {
  if (!run || (run.results.length === 0 && run.skippedGroups.length === 0)) return null;
  return (
    <section aria-labelledby="prais-group-results-heading" className="space-y-5 rounded-2xl border border-accent/20 bg-accent/[0.035] p-4 sm:p-5">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">Descrição temporal separada</p>
        <h3 id="prais-group-results-heading" className="mt-1 font-sans text-base font-bold text-text">
          Tendências Prais–Winsten por grupo
        </h3>
      </div>

      {run.results.map((result) => {
        const variableLabel = variableLabels[result.outcomeVariableId] ?? result.outcomeVariableId;
        return (
          <article key={`${result.groupId}:${result.outcomeVariableId}`} className="rounded-2xl border border-border bg-surface/55 p-4 sm:p-5">
            <ResultsPanel
              title={`Prais–Winsten · ${result.groupLabel} · ${variableLabel}`}
              metrics={result.metrics}
              chart={result.chart}
              interpretation={result.interpretation}
              exportFilename={`prais-${result.groupId}-${result.outcomeVariableId}.png`}
              headingLevel={4}
            />
          </article>
        );
      })}

      {run.skippedGroups.length > 0 ? (
        <aside className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4" aria-labelledby="prais-skipped-groups-heading">
          <h4 id="prais-skipped-groups-heading" className="font-sans text-sm font-bold text-text">
            Séries por grupo não calculáveis
          </h4>
          <ul className="mt-2 space-y-1 font-sans text-xs leading-relaxed text-text-muted">
            {run.skippedGroups.map((item) => (
              <li key={`${item.groupId}:${item.outcomeVariableId}`}>
                {item.groupLabel} · {variableLabels[item.outcomeVariableId] ?? item.outcomeVariableId}: {item.reason}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <p className="font-sans text-xs leading-relaxed text-text-muted">
        Cada modelo descreve somente o seu grupo. Esta seção não compara p-valores nem significância entre grupos e não aplica Holm aos resultados Prais–Winsten.
      </p>
    </section>
  );
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

function conclusion(run: GuidedTestRun, variableLabels: Record<string, string>): string {
  const primaryResults = run.results.filter((result) => result.role === 'principal');
  const results = primaryResults.length > 0 ? primaryResults : run.results.slice(0, 1);
  if (results.length === 0) return 'Nenhum resultado foi calculado.';
  const summaries = results.map((result) => {
    const effect = result.metrics.find((metric) => /efeito|diferença|coeficiente|variação|mudança/i.test(metric.label))
      ?? result.metrics.find((metric) => !/evidência|p-valor|^p\s/i.test(metric.label));
    const interval = result.metrics.find((metric) => /intervalo/i.test(metric.label));
    const effectText = effect
      ? `${effect.label}: ${effect.value}${effect.hint && /IC\s*95%|intervalo/i.test(effect.hint) ? ` (${effect.hint})` : ''}`
      : 'consulte a estimativa e o intervalo apresentados acima';
    const intervalText = interval && interval !== effect ? `; ${interval.label}: ${interval.value}` : '';
    const evidence = result.pValue !== null && Number.isFinite(result.pValue)
      ? result.pValue < 0.05
        ? 'forneceu evidência estatística no limiar de 5%'
        : 'não forneceu evidência estatística suficiente no limiar de 5%'
      : 'deve ser interpretado pelos efeitos, intervalos e diagnósticos apresentados';
    return `${variableLabels[result.outcomeVariableId] ?? result.outcomeVariableId} — primeiro, ${effectText}${intervalText}; depois, ${result.title} ${evidence}`;
  });
  const lead = results.length === 1
    ? `Efeito principal — ${summaries[0]}.`
    : `Resultados principais, preservando todos os ${results.length} desfechos sem seleção por favorabilidade: ${summaries.join('. ')}.`;
  const skipped = (run.skippedOutcomes ?? []).filter((item) => item.role === 'principal' && item.support !== 'common_coverage').length;
  const skippedText = skipped > 0
    ? skipped === 1
      ? ' Um desfecho principal não foi calculado e permanece listado com o motivo; ele não entrou em Holm.'
      : ` ${skipped} desfechos principais não foram calculados e permanecem listados com os motivos; eles não entraram em Holm.`
    : '';
  return `${lead}${skippedText} Como a análise usa agregados territoriais, a diferença ou associação não demonstra causalidade nem efeito individual.`;
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

function resultEffect(result: GuidedTestRun['results'][number]) {
  return result.metrics.find((metric) =>
    /efeito|diferença|coeficiente|variação|mudança|r de pearson|ρ de spearman/i.test(metric.label));
}

function coverageSensitivityLines(
  run: GuidedTestRun,
  variableLabels: Record<string, string>,
): string[] {
  if (!run.coverageSensitivity) return [];
  if (run.coverageSensitivity.state === 'not_calculable') {
    return [run.coverageSensitivity.explanation];
  }
  const common = run.results.filter((result) => result.support === 'common_coverage');
  return [
    run.coverageSensitivity.explanation,
    ...common.map((result) => {
      const main = run.results.find((candidate) =>
        candidate.support !== 'common_coverage'
        && candidate.role === 'principal'
        && candidate.testId === result.testId
        && candidate.outcomeVariableId === result.outcomeVariableId);
      if (!main) return `${variableLabels[result.outcomeVariableId] ?? result.outcomeVariableId}: resultado calculado no suporte comum.`;
      const before = resultEffect(main)?.value ?? 'n/d';
      const after = resultEffect(result)?.value ?? 'n/d';
      const direction = main.effectDirection === 'null' && result.effectDirection === 'null'
        ? 'direção global não se aplica'
        : main.effectDirection === result.effectDirection
          ? 'direção preservada'
          : 'direção alterada';
      const evidence = main.pValue === null || result.pValue === null
        ? 'evidência comparada pelos diagnósticos'
        : (main.pValue < 0.05) === (result.pValue < 0.05)
          ? 'interpretação no limiar de 5% preservada'
          : 'interpretação no limiar de 5% alterada';
      return `${variableLabels[result.outcomeVariableId] ?? result.outcomeVariableId}: n ${main.coverage.used} → ${result.coverage.used}; efeito ${before} → ${after}; ${direction}; ${evidence}.`;
    }),
  ];
}

function revisionComparisonLines(
  run: GuidedTestRun,
  recommendedRun: GuidedTestRun | null | undefined,
  variableLabels: Record<string, string>,
): string[] {
  if (!recommendedRun) return ['O cenário original não sustentou a mesma análise; compare os diagnósticos acima.'];
  const revised = new Map(run.results
    .filter((result) => result.role === 'principal' && result.support !== 'common_coverage')
    .map((result) => [`${result.testId}:${result.outcomeVariableId}`, result]));
  const original = new Map(recommendedRun.results
    .filter((result) => result.role === 'principal' && result.support !== 'common_coverage')
    .map((result) => [`${result.testId}:${result.outcomeVariableId}`, result]));
  const keys = [...new Set([...original.keys(), ...revised.keys()])];
  return keys.map((key) => {
    const before = original.get(key);
    const result = revised.get(key);
    const outcomeVariableId = result?.outcomeVariableId ?? before?.outcomeVariableId ?? key;
    const label = variableLabels[outcomeVariableId] ?? outcomeVariableId;
    if (!before) return `${label}: o resultado só ficou calculável no cenário revisado.`;
    if (!result) return `${label}: deixou de ser calculável após a revisão; o resultado original não foi mantido.`;
    const beforeEffect = resultEffect(before)?.value ?? 'n/d';
    const afterEffect = resultEffect(result)?.value ?? 'n/d';
    const direction = before.effectDirection === result.effectDirection
      ? 'a direção foi preservada'
      : 'a direção mudou';
    const evidence = before.pValue === null || result.pValue === null
      ? 'a evidência deve ser comparada pelos diagnósticos'
      : (before.pValue < 0.05) === (result.pValue < 0.05)
        ? 'a conclusão no limiar de 5% não mudou'
        : 'a conclusão no limiar de 5% mudou';
    return `${label}: n ${before.coverage.used} → ${result.coverage.used}; efeito ${beforeEffect} → ${afterEffect}; ${direction}; ${evidence}.`;
  });
}

export function GuidedResultsSection({
  design,
  recommendedScenario,
  activeScenario,
  variableLabels,
  run,
  praisGroupRun = null,
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
      <div className="space-y-5">
        <section role="alert" className="rounded-2xl border border-red-400/25 bg-red-400/5 p-4">
          <h2 className="font-sans text-heading font-bold text-text">O cálculo confirmatório foi bloqueado</h2>
          <p className="mt-1 font-sans text-sm text-text-muted">{runError}</p>
          <p className="mt-2 font-sans text-xs text-text-muted">Revise as escolhas do teste entre grupos; descrições Prais–Winsten elegíveis permanecem separadas abaixo.</p>
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
        <GroupTrendResults run={praisGroupRun} variableLabels={variableLabels} />
      </div>
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
        <GroupTrendResults run={praisGroupRun} variableLabels={variableLabels} />
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

      <GroupTrendResults run={praisGroupRun} variableLabels={variableLabels} />

      {run.results.map((result) => (
        <article key={`${result.testId}:${result.outcomeVariableId}:${result.support ?? 'default'}`} className="rounded-2xl border border-border bg-surface/55 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-sans text-base font-bold text-text">
              {result.title} · {variableLabels[result.outcomeVariableId] ?? result.outcomeVariableId} · {result.role}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {result.support === 'common_coverage' ? (
                <span className="rounded-full bg-violet-400/10 px-2.5 py-1 font-sans text-xs font-semibold text-violet-300">
                  Suporte temporal comum
                </span>
              ) : null}
              <ResultRoleBadge role={result.role} />
            </div>
          </div>
          <ResultsPanel
            title={`Resultado de ${result.title} para ${variableLabels[result.outcomeVariableId] ?? result.outcomeVariableId}`}
            metrics={result.metrics}
            chart={result.chart}
            additionalCharts={result.additionalCharts}
            interpretation={result.interpretation}
            exportFilename={`${result.testId}-${result.outcomeVariableId}-recorte-lacirstat.png`}
            headingLevel={4}
          />
        </article>
      ))}

      {(run.skippedOutcomes?.length ?? 0) > 0 ? (
        <aside className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4" aria-labelledby="skipped-outcomes-heading">
          <h3 id="skipped-outcomes-heading" className="font-sans text-sm font-bold text-text">Desfechos não calculáveis</h3>
          <ul className="mt-2 space-y-1 font-sans text-xs leading-relaxed text-text-muted">
            {run.skippedOutcomes?.map((item) => (
              <li key={`${item.testId}:${item.outcomeVariableId}:${item.support ?? 'default'}`}>
                {variableLabels[item.outcomeVariableId] ?? item.outcomeVariableId}: {item.reason}
                {item.support === 'common_coverage' ? ' (suporte temporal comum)' : ''}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {run.coverageSensitivity ? (
        <aside className="rounded-2xl border border-violet-400/25 bg-violet-400/5 p-4" aria-labelledby="coverage-sensitivity-heading">
          <h3 id="coverage-sensitivity-heading" className="font-sans text-sm font-bold text-text">Sensibilidade da cobertura</h3>
          <div className="mt-2 space-y-1 font-sans text-xs leading-relaxed text-text-muted">
            {coverageSensitivityLines(run, variableLabels).map((line) => <p key={line}>{line}</p>)}
          </div>
        </aside>
      ) : null}

      {primary ? <GuidedResultMap
        design={design}
        scenario={activeScenario}
        variableId={primary.outcomeVariableId}
        variableLabel={variableLabels[primary.outcomeVariableId] ?? primary.outcomeVariableId}
      /> : null}

      <section aria-labelledby="guided-conclusion-heading" className="rounded-2xl border border-accent/25 bg-accent/5 p-4 sm:p-5">
        <h3 id="guided-conclusion-heading" className="font-sans text-base font-bold text-text">Conclusão</h3>
        <p className="mt-2 font-sans text-sm leading-relaxed text-text-muted">{conclusion(run, variableLabels)}</p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-text-muted">
          {excludedZeros > 0
            ? `${excludedZeros} zero(s) bruto(s) ficaram fora por revisão ou forte suspeita de não coleta; isso foi mantido separado de “sem dados” no mapa.`
            : 'Zeros confirmados permaneceram como zero; células sem valor permaneceram como sem dados.'}
        </p>
        {activeScenario.createdAfterResults ? (
          <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 font-sans text-xs text-amber-200">
            <p>Análise exploratória após revisão:</p>
            {revisionComparisonLines(run, recommendedRun, variableLabels).map((line) => <p key={line}>{line}</p>)}
            {reviewSummary ? <p>{reviewSummary}</p> : null}
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
