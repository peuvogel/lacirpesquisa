import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import { evaluateTestsForSelection } from '@/features/research/eligibility';
import type { AnalysisScenario, ResearchDesign, ResearchGoal } from '@/features/research/types';
import { VARIABLE_PROFILES } from '@/features/research/variableProfiles';
import { useSession } from '@/shared/session/SessionProvider';
import {
  GuidedResearchFlow,
  type TestSelectorRenderer,
  type VariableSelectorRenderer,
} from './GuidedResearchFlow';
import { GuidedResultsSection } from './GuidedResultsSection';
import type { GuidedResearchSelection } from './guidedViewModels';
import { buildHospitalOutcomeContingency } from './hospitalOutcomeContingency';
import { runPraisForProfiles } from './praisGroupTrends';
import { buildResearchSummary } from './researchCutSummary';
import {
  attachCommonCoverageSensitivity,
  isGroupComparisonTest,
  isGroupOutcomeTypeForTest,
  runGuidedTests,
  type GuidedTestRun,
} from './runGuidedTests';
import {
  buildCommonCoverageScenario,
  buildProfileViewModel,
  toEligibilityViewModels,
  useGuidedResearch,
} from './useGuidedResearch';

export interface GuidedAnalysisWorkspaceProps {
  design: ResearchDesign;
  embedded?: boolean;
  initialGoal?: ResearchGoal | null;
  renderVariableSelector?: VariableSelectorRenderer;
  renderTestSelector?: TestSelectorRenderer;
}

export function GuidedAnalysisWorkspace({
  design,
  embedded = false,
  initialGoal = null,
  renderVariableSelector,
  renderTestSelector,
}: GuidedAnalysisWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const { setGuidedAnalysis } = useSession();
  const [selection, setSelection] = useState<GuidedResearchSelection>({
    goal: initialGoal,
    variableIds: [],
    trendTestIds: [],
    testIds: [],
    primaryTestId: null,
    roleAssignments: {},
  });
  const [revision, setRevision] = useState<{
    recommendedFingerprint: string;
    scenario: AnalysisScenario;
  } | null>(null);
  const guided = useGuidedResearch(design, selection);

  const recommendedScenario = guided.scenario;
  const activeScenario = revision && recommendedScenario
    && revision.recommendedFingerprint === recommendedScenario.fingerprint
    ? revision.scenario
    : recommendedScenario;
  const selectedProfiles = useMemo(
    () => selection.variableIds.flatMap((id) => {
      const profile = VARIABLE_PROFILES.find((item) => item.variableId === id);
      return profile ? [profile] : [];
    }),
    [selection.variableIds],
  );
  const activeContingency = useMemo(
    () => activeScenario && guided.data
      ? buildHospitalOutcomeContingency(design, guided.data.analyticCells, activeScenario)
      : null,
    [activeScenario, design, guided.data],
  );
  const activeDecisions = useMemo(
    () => activeScenario && selectedProfiles.length > 0 && selection.goal !== 'describe'
      ? evaluateTestsForSelection({
          design,
          scenario: activeScenario,
          profiles: selectedProfiles,
          roleAssignments: guided.effectiveRoles,
          ...(activeContingency ? { contingencyTable: activeContingency.table } : {}),
        })
      : [],
    [activeContingency, activeScenario, design, guided.effectiveRoles, selectedProfiles, selection.goal],
  );
  const activeEligibility = useMemo(() => toEligibilityViewModels(activeDecisions), [activeDecisions]);
  const activeProfilesByVariableId = useMemo(
    () => activeScenario && guided.data
      ? Object.fromEntries(selectedProfiles.map((profile) => [
          profile.variableId,
          buildProfileViewModel(guided.data!, activeScenario, profile),
        ]))
      : guided.profilesByVariableId,
    [activeScenario, guided.data, guided.profilesByVariableId, selectedProfiles],
  );
  const activeReviewsResolved = activeScenario !== null
    && !activeScenario.cells.some((cell) => cell.analyticStatus === 'requires_review');
  const praisAvailability = useMemo(() => {
    const compatibleProfiles = selectedProfiles.filter((profile) =>
      ['count', 'rate', 'numeric'].includes(profile.variableType)
      && profile.temporalAggregation !== 'point_only');
    const groupsWithEnoughDeclaredYears = design.groups.filter((group) => {
      const period = design.period.scope === 'shared'
        ? design.period.time
        : design.period.timesByGroupId[group.id];
      if (!period || period.mode !== 'range') return false;
      const start = Number(period.start.slice(0, 4));
      const end = Number(period.end.slice(0, 4));
      return Number.isInteger(start) && Number.isInteger(end) && end - start + 1 >= 8;
    });
    if (compatibleProfiles.length === 0) {
      return {
        available: false,
        reason: 'Selecione ao menos uma contagem, taxa ou variável numérica agregável ao ano.',
      };
    }
    if (groupsWithEnoughDeclaredYears.length === 0) {
      return {
        available: false,
        reason: 'Nenhum grupo possui um intervalo declarado com pelo menos 8 anos.',
      };
    }
    return {
      available: true,
      reason: `${compatibleProfiles.length} variável(is) serão avaliadas separadamente em ${design.groups.length} grupo(s); combinações sem 8 pontos anuais regulares permanecerão visíveis como não calculáveis.`,
    };
  }, [design, selectedProfiles]);
  const praisGroupRun = useMemo(() => {
    if (
      !guided.data
      || !activeReviewsResolved
      || !selection.trendTestIds.includes('prais-winsten')
    ) return null;
    return runPraisForProfiles({
      design,
      sourceCells: guided.data.sourceCells,
      annualCells: guided.data.annualCells,
      scenario: activeScenario,
      profiles: selectedProfiles,
    });
  }, [activeReviewsResolved, activeScenario, design, guided.data, selectedProfiles, selection.trendTestIds]);
  const commonCoverage = useMemo(() => {
    if (!guided.data || !selection.primaryTestId || !isGroupComparisonTest(selection.primaryTestId)) return null;
    const outcomes = selectedProfiles.filter((profile) =>
      isGroupOutcomeTypeForTest(selection.primaryTestId!, profile.variableType));
    return outcomes.length > 0 ? buildCommonCoverageScenario(guided.data, outcomes, activeScenario) : null;
  }, [activeScenario, guided.data, selectedProfiles, selection.primaryTestId]);
  const resultState = useMemo<{ run: GuidedTestRun | null; error: string | null }>(() => {
    if (
      !activeScenario
      || selection.goal === 'describe'
      || !selection.primaryTestId
      || selection.testIds.length === 0
      || !activeReviewsResolved
    ) return { run: null, error: null };
    try {
      const mainRun = runGuidedTests({
        design,
        scenario: activeScenario,
        profiles: selectedProfiles,
        eligibility: activeDecisions,
        selectedTestIds: selection.testIds,
        primaryTestId: selection.primaryTestId,
        roleAssignments: guided.effectiveRoles,
        ...(activeContingency ? { contingency: activeContingency } : {}),
      });
      if (!commonCoverage || commonCoverage.state === 'no_restriction') {
        return { run: mainRun, error: null };
      }
      if (!commonCoverage.scenario) {
        return {
          run: attachCommonCoverageSensitivity(mainRun, null, commonCoverage.explanation),
          error: null,
        };
      }
      const commonDecisions = evaluateTestsForSelection({
        design,
        scenario: commonCoverage.scenario,
        profiles: selectedProfiles,
        roleAssignments: guided.effectiveRoles,
      });
      const primaryDecision = commonDecisions.find((item) => item.testId === selection.primaryTestId);
      if (!primaryDecision || primaryDecision.status === 'ineligible') {
        const reason = primaryDecision?.reasons.map((item) => item.message).join(' ')
          ?? 'O teste principal não foi liberado no suporte comum.';
        return {
          run: attachCommonCoverageSensitivity(
            mainRun,
            null,
            `${commonCoverage.explanation} Não foi possível recalcular com segurança: ${reason}`,
          ),
          error: null,
        };
      }
      const commonRun = runGuidedTests({
        design,
        scenario: commonCoverage.scenario,
        profiles: selectedProfiles,
        eligibility: commonDecisions,
        selectedTestIds: [selection.primaryTestId],
        primaryTestId: selection.primaryTestId,
        roleAssignments: guided.effectiveRoles,
      });
      return {
        run: attachCommonCoverageSensitivity(mainRun, commonRun, commonCoverage.explanation),
        error: null,
      };
    } catch (error) {
      return { run: null, error: error instanceof Error ? error.message : 'Não foi possível calcular os testes.' };
    }
  }, [
    activeDecisions,
    activeContingency,
    activeReviewsResolved,
    activeScenario,
    commonCoverage,
    design,
    guided.effectiveRoles,
    selectedProfiles,
    selection.goal,
    selection.primaryTestId,
    selection.testIds,
  ]);
  const variableLabels = useMemo(
    () => Object.fromEntries((guided.variables ?? [])
      .filter((variable) => selection.variableIds.includes(variable.id))
      .map((variable) => [variable.id, variable.label])),
    [guided.variables, selection.variableIds],
  );
  const recommendedRunState = useMemo(() => {
    if (
      !recommendedScenario
      || recommendedScenario === activeScenario
      || recommendedScenario.cells.some((cell) => cell.analyticStatus === 'requires_review')
      || selection.goal === 'describe'
      || !selection.primaryTestId
      || selection.testIds.length === 0
    ) return { run: null, error: null };
    try {
      return {
        run: runGuidedTests({
          design,
          scenario: recommendedScenario,
          profiles: selectedProfiles,
          eligibility: guided.decisions,
          selectedTestIds: selection.testIds,
          primaryTestId: selection.primaryTestId,
          roleAssignments: guided.effectiveRoles,
          ...(guided.contingency ? { contingency: guided.contingency } : {}),
        }),
        error: null,
      };
    } catch (error) {
      return {
        run: null,
        error: error instanceof Error ? error.message : 'Não foi possível recalcular o cenário recomendado.',
      };
    }
  }, [
    activeScenario,
    design,
    guided.decisions,
    guided.contingency,
    guided.effectiveRoles,
    recommendedScenario,
    selectedProfiles,
    selection.goal,
    selection.primaryTestId,
    selection.testIds,
  ]);

  useEffect(() => {
    if (guided.status !== 'ready' || !activeScenario) return;
    setGuidedAnalysis({
      design,
      selectedVariableIds: selection.variableIds,
      scenario: activeScenario,
      eligibility: activeDecisions,
      resultsFingerprint: resultState.run?.fingerprint ?? null,
    });
  }, [activeDecisions, activeScenario, design, guided.status, resultState.run?.fingerprint, selection.variableIds, setGuidedAnalysis]);

  const resultsSlot = recommendedScenario && activeScenario && selection.variableIds.length > 0 ? (
    <GuidedResultsSection
      design={design}
      recommendedScenario={recommendedScenario}
      activeScenario={activeScenario}
      variableLabels={variableLabels}
      run={resultState.run}
      praisGroupRun={praisGroupRun}
      recommendedRun={recommendedRunState.run}
      recommendedRunError={recommendedRunState.error}
      runError={resultState.error}
      pendingReview={!activeReviewsResolved}
      onScenarioChange={(scenario) => setRevision({
        recommendedFingerprint: recommendedScenario.fingerprint,
        scenario,
      })}
    />
  ) : null;

  const content = (
    <GuidedResearchFlow
      key={fingerprintResearchDesign(design)}
      design={design}
      summary={buildResearchSummary(design)}
      variables={guided.variables}
      profilesByVariableId={activeProfilesByVariableId}
      eligibility={activeEligibility.length > 0 ? activeEligibility : guided.eligibility}
      praisAvailable={praisAvailability.available}
      praisReason={praisAvailability.reason}
      reviewsResolved={activeReviewsResolved}
      loadError={guided.error}
      recoverableMessages={guided.recoverableMessages}
      onSelectionChange={setSelection}
      resultsSlot={resultsSlot}
      summaryHeadingLevel={embedded ? 2 : 1}
      initialGoal={initialGoal}
      {...(renderVariableSelector ? { renderVariableSelector } : {})}
      {...(renderTestSelector ? { renderTestSelector } : {})}
    />
  );

  if (embedded) return <div data-testid="guided-analysis-workspace">{content}</div>;

  return (
    <motion.div
      data-testid="guided-page-shell"
      className="lacir-page-enter mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      {content}
    </motion.div>
  );
}
