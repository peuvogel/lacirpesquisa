import { useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ResearchGoal } from '@/features/research/types';
import { cn } from '@/lib/utils';
import type { EligibleTestsSectionProps } from '@/routes/variaveis/EligibleTestsSection';
import type { DataProfileViewModel, EligibleTestViewModel } from '@/routes/variaveis/guidedViewModels';
import type { ComparisonAxis } from './mapQuestionDraft';

export interface MapTestRecommendationProps extends EligibleTestsSectionProps {
  comparisonAxis: ComparisonAxis;
  goal: ResearchGoal;
  profiles: DataProfileViewModel[];
  onRecommendedSelectionChange: (selection: {
    testIds: string[];
    primaryTestId: string | null;
  }) => void;
}

const STATUS_SCORE: Record<Exclude<EligibleTestViewModel['status'], 'ineligible'>, number> = {
  eligible: 0,
  eligible_with_caveat: 1,
};

function isExecutable(test: EligibleTestViewModel): boolean {
  return test.status !== 'ineligible';
}

function candidateIds(
  groupCount: number,
  roleAssignments: Record<string, string>,
  tests: EligibleTestViewModel[],
): string[] {
  const hasCorrelationRoles = Boolean(
    roleAssignments.predictor
    && roleAssignments.outcome
    && roleAssignments.predictor !== roleAssignments.outcome,
  );
  if (hasCorrelationRoles && tests.some((test) => test.id === 'correlacao' && isExecutable(test))) {
    return ['correlacao'];
  }
  const groupCandidates = groupCount === 2
    ? ['t-student', 'mann-whitney']
    : groupCount >= 3
      ? ['anova-tukey', 'kruskal-dunn']
      : [];
  const availableGroupCandidates = groupCandidates.filter((id) =>
    tests.some((test) => test.id === id && isExecutable(test)));
  if (availableGroupCandidates.length > 0) return availableGroupCandidates;
  return ['qui-quadrado'].filter((id) =>
    tests.some((test) => test.id === id && isExecutable(test)));
}

export function chooseMapTestRecommendation({
  comparisonAxis,
  design,
  roleAssignments = {},
  tests,
}: Pick<
  MapTestRecommendationProps,
  'comparisonAxis' | 'design' | 'roleAssignments' | 'tests'
>): { primary: EligibleTestViewModel | null; alternatives: EligibleTestViewModel[] } {
  if (comparisonAxis === 'disease' || comparisonAxis === 'exposure') {
    return { primary: null, alternatives: [] };
  }
  const ids = candidateIds(design.groups.length, roleAssignments, tests);
  const ordered = ids
    .map((id, index) => ({ test: tests.find((item) => item.id === id), index }))
    .filter((entry): entry is { test: EligibleTestViewModel; index: number } =>
      Boolean(entry.test && isExecutable(entry.test)))
    .sort((a, b) => {
      const status = STATUS_SCORE[a.test.status as keyof typeof STATUS_SCORE]
        - STATUS_SCORE[b.test.status as keyof typeof STATUS_SCORE];
      return status || a.index - b.index;
    })
    .map((entry) => entry.test);
  return { primary: ordered[0] ?? null, alternatives: ordered.slice(1) };
}

function variableKind(profiles: DataProfileViewModel[]): string {
  if (profiles.length > 1) return `${profiles.length} variáveis selecionadas`;
  const kind = profiles[0]?.kind;
  if (kind === 'numeric') return 'uma variável numérica';
  if (kind === 'rate') return 'uma taxa';
  if (kind === 'ordinal') return 'uma variável ordinal';
  if (kind === 'categorical') return 'uma variável categórica';
  if (kind === 'count') return 'uma contagem';
  return 'as variáveis selecionadas';
}

function explanation(
  primary: EligibleTestViewModel,
  design: MapTestRecommendationProps['design'],
  profiles: DataProfileViewModel[],
  roleAssignments: Record<string, string>,
): string {
  if (primary.id === 'correlacao') {
    return `A pergunta relaciona duas variáveis com papéis distintos. ${primary.reason}`;
  }
  const diagnostic = profiles.length === 1 && profiles[0]?.diagnosticLabel
    ? ` Diagnóstico real: ${profiles[0].diagnosticLabel}.`
    : '';
  const role = roleAssignments.outcome ? ' com o desfecho indicado' : '';
  return `A pergunta compara ${design.groups.length} grupos com ${variableKind(profiles)}${role}.${diagnostic} ${primary.reason}`;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function MapTestRecommendation({
  comparisonAxis,
  design,
  goal,
  tests,
  profiles,
  selectedTestIds,
  primaryTestId,
  onSelectedTestIdsChange,
  onRecommendedSelectionChange,
  roleOptions = [],
  roleAssignments = {},
  onRoleAssignmentsChange,
}: MapTestRecommendationProps) {
  const recommendation = useMemo(
    () => chooseMapTestRecommendation({ comparisonAxis, design, roleAssignments, tests }),
    [comparisonAxis, design, roleAssignments, tests],
  );
  const unsupported = comparisonAxis === 'disease' || comparisonAxis === 'exposure';
  const executableIds = useMemo(
    () => new Set([recommendation.primary, ...recommendation.alternatives]
      .filter((test): test is EligibleTestViewModel => Boolean(test))
      .map((test) => test.id)),
    [recommendation],
  );
  const ineligibleTests = tests.filter((test) =>
    test.status === 'ineligible' && test.id !== 'prais-winsten');

  useEffect(() => {
    if (unsupported || goal === 'describe') return;
    if (!recommendation.primary) {
      if (selectedTestIds.length > 0 || primaryTestId) {
        onRecommendedSelectionChange({ testIds: [], primaryTestId: null });
      }
      return;
    }
    const retainedSensitivity = selectedTestIds.filter((id) =>
      id !== recommendation.primary!.id && executableIds.has(id));
    const nextIds = [recommendation.primary.id, ...retainedSensitivity];
    if (primaryTestId !== recommendation.primary.id || !sameIds(selectedTestIds, nextIds)) {
      onRecommendedSelectionChange({ testIds: nextIds, primaryTestId: recommendation.primary.id });
    }
  }, [
    executableIds,
    goal,
    onRecommendedSelectionChange,
    primaryTestId,
    recommendation.primary,
    selectedTestIds,
    unsupported,
  ]);

  if (unsupported) {
    return (
      <section aria-labelledby="map-test-recommendation-heading" className="space-y-3">
        <h2 id="map-test-recommendation-heading" className="font-sans text-heading font-bold text-text">
          Teste escolhido pelo sistema
        </h2>
        <p role="status" className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 font-sans text-sm text-text-muted">
          Este eixo ainda não possui dados separados e compatíveis; por isso, o teste não será executado para evitar uma comparação espúria.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="map-test-recommendation-heading" className="space-y-4">
      <header>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Decisão analítica
        </p>
        <h2 id="map-test-recommendation-heading" className="mt-1 font-sans text-heading font-bold text-text">
          Teste escolhido pelo sistema
        </h2>
        <p className="mt-1 font-sans text-sm text-text-muted">
          A escolha usa a pergunta, os grupos e os diagnósticos calculados com os dados deste recorte.
        </p>
      </header>

      {roleOptions.length > 1 && onRoleAssignmentsChange ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-elevated/40 p-4 sm:grid-cols-2">
          <label className="font-sans text-xs font-semibold text-text">
            Variável de desfecho
            <select
              aria-label="Variável de desfecho"
              value={roleAssignments.outcome ?? ''}
              onChange={(event) => onRoleAssignmentsChange({ ...roleAssignments, outcome: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-normal"
            >
              <option value="">Escolha…</option>
              {roleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="font-sans text-xs font-semibold text-text">
            Variável preditora
            <select
              aria-label="Variável preditora"
              value={roleAssignments.predictor ?? ''}
              onChange={(event) => onRoleAssignmentsChange({ ...roleAssignments, predictor: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-normal"
            >
              <option value="">Escolha…</option>
              {roleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <p className="font-sans text-xs text-text-muted sm:col-span-2">
            Esses papéis só liberam relações quando o motor encontra pares completos e independentes.
          </p>
        </div>
      ) : null}

      {recommendation.primary ? (
        <>
          <article
            aria-label={`${recommendation.primary.label} — principal`}
            className="rounded-2xl border border-accent/50 bg-accent/8 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-sans text-base font-bold text-text">{recommendation.primary.label}</h3>
              <span className="rounded-full bg-accent/12 px-2.5 py-1 font-sans text-[11px] font-bold text-accent">
                Principal
              </span>
            </div>
            <p className="mt-2 font-sans text-sm leading-relaxed text-text-muted">
              {explanation(recommendation.primary, design, profiles, roleAssignments)}
            </p>
          </article>

          {recommendation.alternatives.map((test) => {
            const selected = selectedTestIds.includes(test.id);
            return (
              <article
                key={test.id}
                aria-label={`${test.label} — sensibilidade`}
                className={cn(
                  'rounded-2xl border p-4',
                  selected ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface/65',
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onSelectedTestIdsChange(
                      selected
                        ? selectedTestIds.filter((id) => id !== test.id)
                        : [...selectedTestIds, test.id],
                    )}
                    aria-label={`${selected ? 'Remover' : 'Adicionar'} ${test.label} como sensibilidade`}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-sans text-sm font-bold text-text">{test.label}</h3>
                      <span className="rounded-full bg-amber-400/10 px-2 py-0.5 font-sans text-[11px] font-semibold text-amber-300">
                        Sensibilidade
                      </span>
                    </div>
                    <p className="mt-1 font-sans text-xs leading-relaxed text-text-muted">{test.reason}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </>
      ) : (
        <p role="status" className="rounded-2xl border border-border bg-elevated/35 px-4 py-3 font-sans text-sm text-text-muted">
          Nenhum teste comparativo foi liberado pelos dados atuais. Confira os papéis das variáveis e as justificativas do perfil.
        </p>
      )}

      {ineligibleTests.length > 0 ? (
        <details className="rounded-2xl border border-border bg-elevated/25 px-4 py-3">
          <summary className="cursor-pointer font-sans text-xs font-semibold text-text-muted">
            Por que outros testes não entram?
          </summary>
          <ul className="mt-3 space-y-2">
            {ineligibleTests.map((test) => (
              <li key={test.id} className="font-sans text-xs leading-relaxed text-text-muted">
                <strong className="text-text">{test.label}:</strong> {test.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
