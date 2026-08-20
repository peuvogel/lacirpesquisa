import { useState, type ReactNode } from 'react';
import { MapPinned } from 'lucide-react';
import type { ResearchDesign, ResearchGoal } from '@/features/research/types';
import { DataProfileSection } from './DataProfileSection';
import { EligibleTestsSection } from './EligibleTestsSection';
import {
  GuidedVariableSelector,
  type GuidedVariableSelectorProps,
} from './GuidedVariableSelector';
import { GroupTrendTestSection } from './GroupTrendTestSection';
import type {
  DataProfileViewModel,
  EligibleTestViewModel,
  GuidedResearchSelection,
  GuidedVariableViewModel,
  ResearchCutSummaryViewModel,
} from './guidedViewModels';
import { ResearchGoalSection } from './ResearchGoalSection';

export interface GuidedResearchFlowProps {
  design: ResearchDesign;
  summary: ResearchCutSummaryViewModel;
  variables?: GuidedVariableViewModel[];
  profilesByVariableId?: Record<string, DataProfileViewModel>;
  eligibility?: EligibleTestViewModel[];
  praisAvailable?: boolean;
  praisReason?: string;
  reviewsResolved?: boolean;
  onSelectionChange?: (selection: GuidedResearchSelection) => void;
  loadError?: string | null;
  recoverableMessages?: string[];
  resultsSlot?: ReactNode;
  summaryHeadingLevel?: 1 | 2;
  initialGoal?: ResearchGoal | null;
  renderVariableSelector?: VariableSelectorRenderer;
}

export type VariableSelectorRenderer = (props: GuidedVariableSelectorProps) => ReactNode;

export function GuidedResearchFlow({
  design,
  summary,
  variables,
  profilesByVariableId,
  eligibility,
  praisAvailable = false,
  praisReason = 'Prais–Winsten exige ao menos uma série anual regular com 8 pontos por grupo.',
  reviewsResolved = false,
  onSelectionChange,
  loadError,
  recoverableMessages = [],
  resultsSlot,
  summaryHeadingLevel = 1,
  initialGoal = null,
  renderVariableSelector,
}: GuidedResearchFlowProps) {
  const [goal, setGoal] = useState<ResearchGoal | null>(initialGoal);
  const [variableIds, setVariableIds] = useState<string[]>([]);
  const [trendTestIds, setTrendTestIds] = useState<string[]>([]);
  const [testIds, setTestIds] = useState<string[]>([]);
  const [primaryTestId, setPrimaryTestId] = useState<string | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});

  function notify(next: GuidedResearchSelection) {
    onSelectionChange?.(next);
  }

  function changeGoal(nextGoal: ResearchGoal) {
    setGoal(nextGoal);
    setVariableIds([]);
    setTrendTestIds([]);
    setTestIds([]);
    setPrimaryTestId(null);
    setRoleAssignments({});
    notify({ goal: nextGoal, variableIds: [], trendTestIds: [], testIds: [], primaryTestId: null, roleAssignments: {} });
  }

  function changeVariables(nextVariableIds: string[]) {
    setVariableIds(nextVariableIds);
    setTrendTestIds([]);
    setTestIds([]);
    setPrimaryTestId(null);
    setRoleAssignments({});
    notify({ goal, variableIds: nextVariableIds, trendTestIds: [], testIds: [], primaryTestId: null, roleAssignments: {} });
  }

  function changeTrendTests(nextTrendTestIds: string[]) {
    setTrendTestIds(nextTrendTestIds);
    notify({ goal, variableIds, trendTestIds: nextTrendTestIds, testIds, primaryTestId, roleAssignments });
  }

  function changeTests(nextTestIds: string[]) {
    const nextPrimary = primaryTestId && nextTestIds.includes(primaryTestId) ? primaryTestId : null;
    setTestIds(nextTestIds);
    setPrimaryTestId(nextPrimary);
    notify({ goal, variableIds, trendTestIds, testIds: nextTestIds, primaryTestId: nextPrimary, roleAssignments });
  }

  function changePrimary(nextPrimaryTestId: string) {
    setPrimaryTestId(nextPrimaryTestId);
    notify({ goal, variableIds, trendTestIds, testIds, primaryTestId: nextPrimaryTestId, roleAssignments });
  }

  function changeRoles(nextRoles: Record<string, string>) {
    setRoleAssignments(nextRoles);
    setTestIds([]);
    setPrimaryTestId(null);
    notify({ goal, variableIds, trendTestIds, testIds: [], primaryTestId: null, roleAssignments: nextRoles });
  }

  const profiles = variableIds.flatMap((id) => {
    const profile = profilesByVariableId?.[id];
    return profile ? [profile] : [];
  });
  const hasAllProfiles =
    profilesByVariableId !== undefined
    && variableIds.length > 0
    && profiles.length === variableIds.length;
  const chartContext = [
    design.groups.map((group) => group.name).join(' × '),
    summary.facts.find((fact) => /\d{4}/.test(fact)),
  ].filter((item): item is string => Boolean(item)).join(' · ');
  const SummaryHeading = summaryHeadingLevel === 2 ? 'h2' : 'h1';

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-3xl border border-accent/20 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-accent)_13%,transparent),transparent_46%),linear-gradient(135deg,color-mix(in_srgb,var(--color-surface)_96%,black),var(--color-elevated))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
            <MapPinned className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">{summary.eyebrow}</p>
            <SummaryHeading className="mt-1 font-sans text-2xl font-bold tracking-tight text-text sm:text-3xl">{summary.title}</SummaryHeading>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Resumo do recorte">
              {summary.facts.map((fact) => (
                <li key={fact} className="rounded-full border border-white/10 bg-black/10 px-3 py-1 font-sans text-xs text-text-muted">{fact}</li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      {initialGoal ? null : (
        <FlowStep><ResearchGoalSection value={goal} onChange={changeGoal} /></FlowStep>
      )}

      {goal ? (
        loadError ? (
          <ErrorStep message={loadError} />
        ) : variables ? (
          <FlowStep>
            {renderVariableSelector
              ? renderVariableSelector({
                  design,
                  variables,
                  selectedVariableIds: variableIds,
                  onSelectionChange: changeVariables,
                })
              : <GuidedVariableSelector design={design} variables={variables} selectedVariableIds={variableIds} onSelectionChange={changeVariables} />}
          </FlowStep>
        ) : (
          <LoadingStep />
        )
      ) : null}

      {hasAllProfiles ? (
        <FlowStep><DataProfileSection profiles={profiles} reviewsResolved={reviewsResolved} chartContext={chartContext} /></FlowStep>
      ) : variableIds.length > 0 ? (
        <LoadingStep
          title="3. Preparando o perfil dos dados…"
          body="Os sumários e diagnósticos aparecerão quando o perfil real estiver pronto."
        />
      ) : null}

      {recoverableMessages.length > 0 ? (
        <aside className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 font-sans text-sm text-text" role="status">
          {recoverableMessages.join(' ')} As células afetadas permanecem como sem dados.
        </aside>
      ) : null}

      {goal !== 'compare' && hasAllProfiles && reviewsResolved ? (
        <FlowStep>
          <GroupTrendTestSection
            available={praisAvailable}
            reason={praisReason}
            selected={trendTestIds.includes('prais-winsten')}
            onSelectedChange={(selected) => changeTrendTests(selected ? ['prais-winsten'] : [])}
          />
        </FlowStep>
      ) : null}

      {goal !== 'describe' && hasAllProfiles && reviewsResolved ? (
        eligibility ? (
          <FlowStep>
            <EligibleTestsSection
              design={design}
              tests={eligibility}
              selectedTestIds={testIds}
              primaryTestId={primaryTestId}
              onSelectedTestIdsChange={changeTests}
              onPrimaryTestIdChange={changePrimary}
              roleOptions={variables?.filter((variable) => variableIds.includes(variable.id)).map((variable) => ({ id: variable.id, label: variable.label }))}
              roleAssignments={roleAssignments}
              onRoleAssignmentsChange={changeRoles}
            />
          </FlowStep>
        ) : (
          <LoadingStep
            title="4. Preparando testes permitidos…"
            body="As decisões de elegibilidade aparecerão depois da avaliação real dos dados."
          />
        )
      ) : null}

      {resultsSlot && hasAllProfiles && (goal === 'describe' || !reviewsResolved || primaryTestId || trendTestIds.length > 0) ? (
        <FlowStep>{resultsSlot}</FlowStep>
      ) : null}
    </div>
  );
}

function ErrorStep({ message }: { message: string }) {
  return (
    <section role="alert" className="rounded-3xl border border-red-400/25 bg-red-400/5 p-5 sm:p-6">
      <h2 className="font-sans text-heading font-bold text-text">2. Dados indisponíveis</h2>
      <p className="mt-1 font-sans text-sm text-text-muted">{message}</p>
      <p className="mt-2 font-sans text-xs text-text-muted">Nenhuma variável foi presumida e nenhum teste foi liberado.</p>
    </section>
  );
}

function FlowStep({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-border bg-surface/45 p-5 shadow-sm sm:p-6">{children}</div>;
}

function LoadingStep({
  title = '2. Preparando variáveis disponíveis…',
  body = 'Estamos aguardando a disponibilidade real para este recorte. Nenhum valor será presumido.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section aria-live="polite" aria-busy="true" className="rounded-3xl border border-border bg-surface/45 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="size-2.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" aria-hidden />
        <div>
          <h2 className="font-sans text-heading font-bold text-text">{title}</h2>
          <p className="mt-1 font-sans text-sm text-text-muted">{body}</p>
        </div>
      </div>
    </section>
  );
}
