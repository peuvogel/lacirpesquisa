import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  filterCatalog,
  type CatalogFilters,
} from '@/features/catalog/filterCatalog';
import {
  assertCompatibleSelection,
  buildSessionDataset,
} from '@/features/catalog/buildSessionDataset';
import { ALIASES, withDiseaseAliases } from '@/features/catalog/diseaseAliases';
import { loadCatalog, type LoadedCatalog } from '@/features/catalog/loadCatalog';
import { DISEASES } from '@/features/catalog/taxonomy';
import type { CatalogEntry } from '@/features/catalog/types';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import { evaluateTestsForSelection } from '@/features/research/eligibility';
import type { AnalysisScenario, ResearchDesign, ResearchPeriod } from '@/features/research/types';
import { VARIABLE_PROFILES } from '@/features/research/variableProfiles';
import { useSession } from '@/shared/session/SessionProvider';
import { GuidedResearchFlow } from './GuidedResearchFlow';
import { GuidedResultsSection } from './GuidedResultsSection';
import type { GuidedResearchSelection, ResearchCutSummaryViewModel } from './guidedViewModels';
import { buildHospitalOutcomeContingency } from './hospitalOutcomeContingency';
import {
  attachCommonCoverageSensitivity,
  isGroupComparisonTest,
  isGroupOutcomeTypeForTest,
  runGuidedTests,
  type GuidedTestRun,
} from './runGuidedTests';
import { VariableDetailPanel } from './VariableDetailPanel';
import { VariableFilters } from './VariableFilters';
import { VariableList } from './VariableList';
import {
  buildCommonCoverageScenario,
  buildProfileViewModel,
  toEligibilityViewModels,
  useGuidedResearch,
} from './useGuidedResearch';

const INITIAL_FILTERS: CatalogFilters = {
  query: '',
  sourceSystem: undefined,
  variableType: '',
  domain: undefined,
  loadable: null,
};

export function VariaveisPage() {
  const { researchDesign } = useSession();

  if (researchDesign) {
    return <GuidedVariablesPage design={researchDesign} />;
  }

  return <DirectCatalogPage />;
}

function DirectCatalogPage() {
  const navigate = useNavigate();
  const { setDataset } = useSession();

  const [catalog, setCatalog] = useState<LoadedCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogFilters>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLoadableIds, setSelectedLoadableIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [loadingEstatistica, setLoadingEstatistica] = useState(false);
  const [loadingMapas, setLoadingMapas] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCatalog()
      .then((loaded) => {
        if (cancelled) return;
        setCatalog(loaded);
        setLoadError(null);
        if (loaded.variables[0]) {
          setSelectedId((prev) => prev ?? loaded.variables[0]!.id);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : 'Falha ao carregar o catálogo.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variables = useMemo(
    () =>
      (catalog?.variables ?? []).filter(
        (v) => v.sourceSystem !== 'LACIR' && v.domain !== 'meta',
      ),
    [catalog],
  );
  const packs = catalog?.packs ?? {};

  const sourceOptions = useMemo(
    () => [...new Set(variables.map((v) => v.sourceSystem))].sort(),
    [variables],
  );

  const domainOptions = useMemo(
    () => [...new Set(variables.map((v) => v.domain))].sort(),
    [variables],
  );

  // Enriquece com apelidos clinicos curados (TAX-05) so no indice de busca, em memoria —
  // nunca gravado em public/data/catalog/variables.json (artefato gerado, TAX-06).
  const variablesWithAliases = useMemo(
    () => withDiseaseAliases(variables, DISEASES, ALIASES),
    [variables],
  );

  const filtered = useMemo(
    () => filterCatalog(variablesWithAliases, filters),
    [variablesWithAliases, filters],
  );

  const selected: CatalogEntry | null =
    variables.find((v) => v.id === selectedId) ?? null;

  const loadSelection = useMemo(() => {
    const fromChecks = variables.filter(
      (v) => v.loadable && selectedLoadableIds.has(v.id),
    );
    if (fromChecks.length > 0) return fromChecks;
    if (selected?.loadable) return [selected];
    return [];
  }, [variables, selectedLoadableIds, selected]);

  const canLoadEstatistica = loadSelection.length > 0;

  function handleToggleLoadable(id: string) {
    setSelectedLoadableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setHandoffError(null);
  }

  async function handleLoadEstatistica() {
    if (!catalog || loadSelection.length === 0) return;
    setLoadingEstatistica(true);
    setHandoffError(null);
    try {
      assertCompatibleSelection(loadSelection, packs);
      const dataset = buildSessionDataset(loadSelection, packs);
      setDataset(dataset);
      navigate('/');
    } catch (err: unknown) {
      setHandoffError(
        err instanceof Error ? err.message : 'Não foi possível carregar a seleção.',
      );
    } finally {
      setLoadingEstatistica(false);
    }
  }

  async function handleLoadMapas() {
    if (!catalog || loadSelection.length === 0) return;
    setLoadingMapas(true);
    setHandoffError(null);
    try {
      assertCompatibleSelection(loadSelection, packs);
      navigate('/mapas', {
        state: {
          catalogVariableIds: loadSelection.map((entry) => entry.id),
        },
      });
    } catch (err: unknown) {
      setHandoffError(
        err instanceof Error ? err.message : 'Não foi possível abrir a seleção no mapa.',
      );
    } finally {
      setLoadingMapas(false);
    }
  }

  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="lacir-page-enter mx-auto max-w-[1520px] px-6 py-8"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <h1 className="font-sans text-display font-bold tracking-tight text-text">Variáveis</h1>
      <p className="mt-2 max-w-2xl font-sans text-body text-text-muted">
        Catálogo curado com proveniência obrigatória. Busque, filtre e carregue na Estatística ou
        no Mapa — tudo no site, sem TABNET na aula.
      </p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-surface/50 p-4 backdrop-blur-md">
        <VariableFilters
          filters={filters}
          sourceOptions={sourceOptions}
          domainOptions={domainOptions}
          onChange={setFilters}
        />
        <p className="mt-2 font-sans text-xs text-text-muted">
          {loading ? 'Carregando…' : `${filtered.length} de ${variables.length} variáveis`}
          {selectedLoadableIds.size > 0
            ? ` · ${selectedLoadableIds.size} selecionada(s) para carregar`
            : null}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-[42%]">
          <VariableList
            entries={filtered}
            selectedId={selectedId}
            selectedLoadableIds={selectedLoadableIds}
            loading={loading}
            error={loadError}
            onSelect={setSelectedId}
            onToggleLoadable={handleToggleLoadable}
          />
        </div>

        <aside
          className="flex min-h-[320px] w-full flex-col rounded-2xl border border-white/10 bg-surface/70 p-6 shadow-lg backdrop-blur-xl lg:w-[58%]"
          aria-label="Detalhe da variável"
        >
          <VariableDetailPanel
            entry={selected}
            selectedLoadableCount={
              selectedLoadableIds.size > 0 ? selectedLoadableIds.size : loadSelection.length
            }
            canLoadEstatistica={canLoadEstatistica}
            canLoadMapas={canLoadEstatistica}
            loadError={handoffError}
            loadingEstatistica={loadingEstatistica}
            loadingMapas={loadingMapas}
            onLoadEstatistica={handleLoadEstatistica}
            onLoadMapas={handleLoadMapas}
          />
        </aside>
      </div>
    </motion.div>
  );
}

function GuidedVariablesPage({ design }: { design: ResearchDesign }) {
  const reduceMotion = useReducedMotion();
  const { setGuidedAnalysis } = useSession();
  const [selection, setSelection] = useState<GuidedResearchSelection>({
    goal: null,
    variableIds: [],
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
  const recommendedRun = useMemo(() => {
    if (
      !recommendedScenario
      || recommendedScenario === activeScenario
      || recommendedScenario.cells.some((cell) => cell.analyticStatus === 'requires_review')
      || selection.goal === 'describe'
      || !selection.primaryTestId
      || selection.testIds.length === 0
    ) return null;
    try {
      return runGuidedTests({
        design,
        scenario: recommendedScenario,
        profiles: selectedProfiles,
        eligibility: guided.decisions,
        selectedTestIds: selection.testIds,
        primaryTestId: selection.primaryTestId,
        roleAssignments: guided.effectiveRoles,
        ...(guided.contingency ? { contingency: guided.contingency } : {}),
      });
    } catch {
      return null;
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
      recommendedRun={recommendedRun}
      runError={resultState.error}
      pendingReview={!activeReviewsResolved}
      onScenarioChange={(scenario) => setRevision({
        recommendedFingerprint: recommendedScenario.fingerprint,
        scenario,
      })}
    />
  ) : null;

  return (
    <motion.div
      className="lacir-page-enter mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <GuidedResearchFlow
        key={fingerprintResearchDesign(design)}
        design={design}
        summary={buildResearchSummary(design)}
        variables={guided.variables}
        profilesByVariableId={activeProfilesByVariableId}
        eligibility={activeEligibility.length > 0 ? activeEligibility : guided.eligibility}
        reviewsResolved={activeReviewsResolved}
        loadError={guided.error}
        recoverableMessages={guided.recoverableMessages}
        onSelectionChange={setSelection}
        resultsSlot={resultsSlot}
      />
    </motion.div>
  );
}

function buildResearchSummary(design: ResearchDesign): ResearchCutSummaryViewModel {
  const territoryCount = new Set(
    design.groups.flatMap((group) => group.territories.map((territory) => territory.id)),
  ).size;
  const groupNames = design.groups.map((group) => group.name).join(', ');
  const diseaseNames = design.diseaseIds.map(diseaseLabel).join(', ');

  return {
    eyebrow: 'Recorte recebido de Mapas',
    title: `${groupNames} · ${diseaseNames}`,
    facts: [
      `${territoryCount} ${territoryCount === 1 ? 'território' : 'territórios'}`,
      formatResearchPeriod(design),
      design.locationBasis === 'ocorrencia' ? 'Local de ocorrência' : 'Local de residência',
    ],
  };
}

function diseaseLabel(diseaseId: string): string {
  return DISEASES.find((disease) => disease.id === diseaseId)?.label
    ?? diseaseId.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function formatResearchPeriodLabel(period: ResearchPeriod): string {
  if (period.mode === 'point') return period.point;
  if (period.mode === 'range') {
    const annualStart = annualBoundaryYear(period.start, '01');
    const annualEnd = annualBoundaryYear(period.end, '12');
    return annualStart && annualEnd
      ? `${annualStart}–${annualEnd}`
      : `${period.start}–${period.end}`;
  }
  const annualStart = annualBoundaryYear(period.periodA, '01');
  const annualEnd = annualBoundaryYear(period.periodB, '12');
  return annualStart && annualEnd
    ? `${annualStart} × ${annualEnd}`
    : `${period.periodA} × ${period.periodB}`;
}

function annualBoundaryYear(value: string, month: '01' | '12'): string | null {
  return new RegExp(`^(\\d{4})-${month}$`).exec(value)?.[1] ?? null;
}

function formatResearchPeriod(design: ResearchDesign): string {
  if (design.period.scope === 'shared') return formatResearchPeriodLabel(design.period.time);
  return 'Períodos definidos por grupo';
}
