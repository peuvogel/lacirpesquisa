import { useState } from 'react';
import { MapPinned } from 'lucide-react';
import type { ResearchDesign, ResearchGoal } from '@/features/research/types';
import { DataProfileSection } from './DataProfileSection';
import { EligibleTestsSection } from './EligibleTestsSection';
import { GuidedVariableSelector } from './GuidedVariableSelector';
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
  reviewsResolved?: boolean;
  onSelectionChange?: (selection: GuidedResearchSelection) => void;
}

export function GuidedResearchFlow({
  design: _design,
  summary,
  variables,
  profilesByVariableId = {},
  eligibility = [],
  reviewsResolved = false,
  onSelectionChange,
}: GuidedResearchFlowProps) {
  const [goal, setGoal] = useState<ResearchGoal | null>(null);
  const [variableIds, setVariableIds] = useState<string[]>([]);
  const [testIds, setTestIds] = useState<string[]>([]);
  const [primaryTestId, setPrimaryTestId] = useState<string | null>(null);

  function notify(next: GuidedResearchSelection) {
    onSelectionChange?.(next);
  }

  function changeGoal(nextGoal: ResearchGoal) {
    setGoal(nextGoal);
    setVariableIds([]);
    setTestIds([]);
    setPrimaryTestId(null);
    notify({ goal: nextGoal, variableIds: [], testIds: [], primaryTestId: null });
  }

  function changeVariables(nextVariableIds: string[]) {
    setVariableIds(nextVariableIds);
    setTestIds([]);
    setPrimaryTestId(null);
    notify({ goal, variableIds: nextVariableIds, testIds: [], primaryTestId: null });
  }

  function changeTests(nextTestIds: string[]) {
    const nextPrimary = primaryTestId && nextTestIds.includes(primaryTestId) ? primaryTestId : null;
    setTestIds(nextTestIds);
    setPrimaryTestId(nextPrimary);
    notify({ goal, variableIds, testIds: nextTestIds, primaryTestId: nextPrimary });
  }

  function changePrimary(nextPrimaryTestId: string) {
    setPrimaryTestId(nextPrimaryTestId);
    notify({ goal, variableIds, testIds, primaryTestId: nextPrimaryTestId });
  }

  const profiles = variableIds.flatMap((id) => profilesByVariableId[id] ? [profilesByVariableId[id]!] : []);
  const hasAllProfiles = variableIds.length > 0 && profiles.length === variableIds.length;

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-3xl border border-accent/20 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-accent)_13%,transparent),transparent_46%),linear-gradient(135deg,color-mix(in_srgb,var(--color-surface)_96%,black),var(--color-elevated))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
            <MapPinned className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">{summary.eyebrow}</p>
            <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-text sm:text-3xl">{summary.title}</h1>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Resumo do recorte">
              {summary.facts.map((fact) => (
                <li key={fact} className="rounded-full border border-white/10 bg-black/10 px-3 py-1 font-sans text-xs text-text-muted">{fact}</li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <FlowStep><ResearchGoalSection value={goal} onChange={changeGoal} /></FlowStep>

      {goal ? (
        variables ? (
          <FlowStep><GuidedVariableSelector variables={variables} selectedVariableIds={variableIds} onSelectionChange={changeVariables} /></FlowStep>
        ) : (
          <LoadingStep />
        )
      ) : null}

      {hasAllProfiles ? (
        <FlowStep><DataProfileSection profiles={profiles} reviewsResolved={reviewsResolved} /></FlowStep>
      ) : null}

      {hasAllProfiles && reviewsResolved ? (
        <FlowStep>
          <EligibleTestsSection
            tests={eligibility}
            selectedTestIds={testIds}
            primaryTestId={primaryTestId}
            onSelectedTestIdsChange={changeTests}
            onPrimaryTestIdChange={changePrimary}
          />
        </FlowStep>
      ) : null}
    </div>
  );
}

function FlowStep({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-border bg-surface/45 p-5 shadow-sm sm:p-6">{children}</div>;
}

function LoadingStep() {
  return (
    <section aria-live="polite" aria-busy="true" className="rounded-3xl border border-border bg-surface/45 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="size-2.5 animate-pulse rounded-full bg-accent" aria-hidden />
        <div>
          <h2 className="font-sans text-heading font-bold text-text">2. Preparando variáveis disponíveis…</h2>
          <p className="mt-1 font-sans text-sm text-text-muted">
            Estamos aguardando a disponibilidade real para este recorte. Nenhum valor será presumido.
          </p>
        </div>
      </div>
    </section>
  );
}
