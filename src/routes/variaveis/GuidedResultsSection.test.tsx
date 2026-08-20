import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createRecommendedScenario, reviseScenario, treatAsMissing } from '@/features/research/scenarios';
import type { AnalysisCell, ResearchDesign } from '@/features/research/types';
import { GuidedResultsSection } from './GuidedResultsSection';
import { buildGuidedMapModel } from './GuidedResultMap';
import { getDivergenciaRazao } from '@/features/catalog/catalogAnalysisData';
import type { PraisGroupTrendRun } from './praisGroupTrends';
import type { GuidedTestRun } from './runGuidedTests';

vi.mock('@/routes/estatistica/ResultsPanel', () => ({
  ResultsPanel: ({ title, metrics, interpretation }: {
    title: string;
    metrics: Array<{ label: string; value: string }>;
    interpretation: string[];
  }) => <article><h3>{title}</h3>{metrics.map((metric) => <p key={metric.label}>{metric.label}: {metric.value}</p>)}<p>{interpretation[0]}</p></article>,
}));

vi.mock('@/routes/mapas/BrazilMapCanvas', () => ({
  BrazilMapCanvas: () => <div role="img" aria-label="Mapa coroplético do resultado" />,
}));

const design: ResearchDesign = {
  groups: [
    { id: 'a', name: 'Grupo A', territories: [{ id: '29', label: 'Bahia' }, { id: '28', label: 'Sergipe' }] },
    { id: 'b', name: 'Grupo B', territories: [{ id: '35', label: 'São Paulo' }] },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['teste'],
  period: { scope: 'shared', time: { mode: 'point', point: '2025' } },
};

const cells: AnalysisCell[] = [
  { groupId: 'a', territoryId: '29', periodKey: '2025', variableId: 'taxa', rawValue: 0, sourceStatus: 'collection_zero', analyticStatus: 'include' },
  { groupId: 'a', territoryId: '28', periodKey: '2025', variableId: 'taxa', rawValue: null, sourceStatus: 'missing', analyticStatus: 'exclude_missing' },
  { groupId: 'b', territoryId: '35', periodKey: '2025', variableId: 'taxa', rawValue: 18, sourceStatus: 'observed', analyticStatus: 'requires_review' },
];

const chart = { type: 'bar' as const, data: { labels: [], datasets: [] }, ariaLabel: 'Gráfico' };
const SIH_VARIABLE_ID = 'sih.embolia_e_trombose_arteriais.internacoes';
const run: GuidedTestRun = {
  fingerprint: 'guided-results:test',
  scenarioFingerprint: 'scenario:test',
  results: [
    {
      testId: 'mann-whitney', title: 'Mann–Whitney', role: 'principal', metrics: [{ label: 'Efeito', value: '0,40' }],
      chart, interpretation: ['Interpretação principal.'], coverage: { expected: 3, used: 2, missing: 1 },
      pValue: 0.04, effectDirection: 'positive', outcomeVariableId: 'taxa',
    },
    {
      testId: 't-student', title: 't de Student', role: 'sensibilidade', metrics: [{ label: 'Diferença', value: '2,0' }],
      chart, interpretation: ['Interpretação de sensibilidade.'], coverage: { expected: 3, used: 2, missing: 1 },
      pValue: 0.08, effectDirection: 'positive', outcomeVariableId: 'taxa',
    },
  ],
};

const praisGroupRun: PraisGroupTrendRun = {
  results: [
    {
      groupId: 'a', groupLabel: 'Grupo A', outcomeVariableId: 'taxa',
      metrics: [{ label: 'Coeficiente da tendência (β)', value: '0,12' }], chart,
      interpretation: ['Tendência estimada somente para Grupo A; este resultado não testa diferença em relação aos demais grupos.'],
      pValue: 0.04, effectDirection: 'positive',
    },
    {
      groupId: 'b', groupLabel: 'Grupo B', outcomeVariableId: 'taxa',
      metrics: [{ label: 'Coeficiente da tendência (β)', value: '-0,08' }], chart,
      interpretation: ['Tendência estimada somente para Grupo B; este resultado não testa diferença em relação aos demais grupos.'],
      pValue: 0.3, effectDirection: 'negative',
    },
  ],
  skippedGroups: [{
    groupId: 'b', groupLabel: 'Grupo B', outcomeVariableId: 'custo',
    reason: 'A série precisa ter pelo menos 8 pontos anuais regulares.',
  }],
};

describe('GuidedResultsSection', () => {
  it('keeps pending review visible before test execution', async () => {
    const user = userEvent.setup();
    const recommended = createRecommendedScenario(cells);
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={recommended}
      variableLabels={{ taxa: 'Taxa de internação' }}
      run={null}
      runError={null}
      pendingReview
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByRole('heading', { name: 'Revise os dados da análise' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar dados da análise' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows principal then sensitivity, a territorial map, and the clickable revision after the conclusion', () => {
    const recommended = createRecommendedScenario(cells.map((cell) => ({ ...cell, analyticStatus: cell.rawValue === null ? 'exclude_missing' as const : 'include' as const })));
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={recommended}
      variableLabels={{ taxa: 'Taxa de internação' }}
      run={{ ...run, scenarioFingerprint: recommended.fingerprint }}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByRole('heading', { name: '5. Resultados no recorte' })).toBeInTheDocument();
    const principal = screen.getByRole('heading', { name: 'Mann–Whitney · Taxa de internação · principal' });
    const sensitivity = screen.getByRole('heading', { name: 't de Student · Taxa de internação · sensibilidade' });
    expect(principal.compareDocumentPosition(sensitivity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mapa coroplético do resultado' })).toBeInTheDocument();
    expect(screen.getByText(/não demonstra causalidade/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar dados da análise' })).toBeInTheDocument();
    const conclusion = within(screen.getByRole('region', { name: 'Conclusão' })).getAllByRole('paragraph')[0]!;
    expect(conclusion).toHaveTextContent(/^Efeito principal/i);
    expect(conclusion.textContent?.indexOf('Efeito')).toBeLessThan(conclusion.textContent?.indexOf('evidência') ?? Infinity);
  });

  it('explica sem repetir a razão do pack no fluxo descritivo e confirmatório', () => {
    const sihCells = cells.map((cell) => ({ ...cell, variableId: SIH_VARIABLE_ID }));
    const recommended = createRecommendedScenario(sihCells);
    const razao = getDivergenciaRazao(SIH_VARIABLE_ID);
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={recommended}
      variableLabels={{ [SIH_VARIABLE_ID]: 'Internações por embolia e trombose arteriais' }}
      run={{
        ...run,
        scenarioFingerprint: recommended.fingerprint,
        results: run.results.map((result) => ({ ...result, outcomeVariableId: SIH_VARIABLE_ID })),
      }}
      praisGroupRun={{
        ...praisGroupRun,
        results: praisGroupRun.results.map((result) => ({ ...result, outcomeVariableId: SIH_VARIABLE_ID })),
      }}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByRole('heading', { name: 'Tendências Prais–Winsten por grupo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', {
      name: 'Mann–Whitney · Internações por embolia e trombose arteriais · principal',
    })).toBeInTheDocument();
    expect(screen.getAllByText(razao!, { exact: false })).toHaveLength(1);
  });

  it('discloses n change when a post-result scenario is revised', () => {
    const exposureCells: AnalysisCell[] = design.groups.flatMap((group) => group.territories.map((territory) => ({
      groupId: group.id,
      territoryId: territory.id,
      periodKey: '2025',
      variableId: 'populacao',
      rawValue: 1_000_000,
      sourceStatus: 'observed' as const,
      analyticStatus: 'include' as const,
    })));
    const recommended = createRecommendedScenario([
      ...cells.map((cell) => ({ ...cell, analyticStatus: cell.rawValue === null ? 'exclude_missing' as const : 'include' as const })),
      ...exposureCells,
    ]);
    const revised = reviseScenario(recommended, [treatAsMissing(JSON.stringify(['a', '29', '2025', 'taxa']))], { createdAfterResults: true });
    const recommendedRun = { ...run, scenarioFingerprint: recommended.fingerprint };
    const revisedRun = {
      ...run,
      scenarioFingerprint: revised.fingerprint,
      results: run.results.map((result) => ({
        ...result,
        metrics: result.metrics.map((metric, index) => index === 0 ? { ...metric, value: '0,20' } : metric),
        coverage: { ...result.coverage, used: 1 },
      })),
    };
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={revised}
      variableLabels={{ taxa: 'Taxa de internação' }}
      run={revisedRun}
      recommendedRun={recommendedRun}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);
    expect(screen.getByText(/análise exploratória/i)).toBeInTheDocument();
    expect(screen.getByText(/n 2 → 1/i)).toBeInTheDocument();
    expect(screen.getByText(/0,40.*0,20/i)).toBeInTheDocument();
  });

  it('compares every primary outcome after a post-result revision', () => {
    const recommended = createRecommendedScenario(cells.map((cell) => ({
      ...cell,
      analyticStatus: cell.rawValue === null ? 'exclude_missing' as const : 'include' as const,
    })));
    const revised = reviseScenario(
      recommended,
      [treatAsMissing(JSON.stringify(['a', '29', '2025', 'taxa']))],
      { createdAfterResults: true },
    );
    const second = {
      ...run.results[0]!, outcomeVariableId: 'custo',
      metrics: [{ label: 'r de Pearson', value: '0,80' }], pValue: 0.01, coverage: { expected: 3, used: 3, missing: 0 },
    };
    const revisedSecond = {
      ...second,
      metrics: [{ label: 'r de Pearson', value: '-0,20' }], pValue: 0.4,
      effectDirection: 'negative' as const, coverage: { expected: 3, used: 2, missing: 1 },
    };
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={revised}
      variableLabels={{ taxa: 'Taxa de internação', custo: 'Custo hospitalar' }}
      recommendedRun={{ ...run, scenarioFingerprint: recommended.fingerprint, results: [run.results[0]!, second] }}
      run={{ ...run, scenarioFingerprint: revised.fingerprint, results: [run.results[0]!, revisedSecond] }}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByText(/Taxa de internação: n 2 → 2.*0,40 → 0,40/i)).toBeInTheDocument();
    expect(screen.getByText(/Custo hospitalar: n 3 → 2.*0,80 → -0,20.*direção mudou.*limiar de 5% mudou/i)).toBeInTheDocument();
  });

  it('keeps every confirmatory outcome visible instead of highlighting only one', () => {
    const recommended = createRecommendedScenario(cells.map((cell) => ({
      ...cell,
      analyticStatus: cell.rawValue === null ? 'exclude_missing' as const : 'include' as const,
    })));
    const secondOutcome = {
      ...run.results[0]!,
      outcomeVariableId: 'custo',
      metrics: [{ label: 'Efeito', value: '12,0' }],
      pValue: 0.2,
      adjustedPValue: 0.2,
      rawPValue: 0.1,
    };
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={recommended}
      variableLabels={{ taxa: 'Taxa de internação', custo: 'Custo hospitalar' }}
      run={{ ...run, scenarioFingerprint: recommended.fingerprint, results: [run.results[0]!, secondOutcome] }}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByRole('heading', { name: /Mann–Whitney · Taxa de internação · principal/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mann–Whitney · Custo hospitalar · principal/ })).toBeInTheDocument();
    expect(screen.getByText(/preservando todos os 2 desfechos sem seleção por favorabilidade/i)).toBeInTheDocument();
  });

  it('keeps an incompatible outcome visible as not calculable without hiding valid results', () => {
    const recommended = createRecommendedScenario(cells.map((cell) => ({
      ...cell,
      analyticStatus: cell.rawValue === null ? 'exclude_missing' as const : 'include' as const,
    })));
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={recommended}
      variableLabels={{ taxa: 'Taxa de internação', custo: 'Custo hospitalar' }}
      run={{
        ...run,
        scenarioFingerprint: recommended.fingerprint,
        results: [run.results[0]!],
        skippedOutcomes: [{
          testId: 'mann-whitney', outcomeVariableId: 'custo', role: 'principal',
          reason: 'Cada grupo precisa de pelo menos 3 unidades.', support: 'largest_valid',
        }],
      }}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByRole('heading', { name: 'Desfechos não calculáveis' })).toBeInTheDocument();
    expect(screen.getByText(/Custo hospitalar.*pelo menos 3 unidades/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mann–Whitney · Taxa de internação/ })).toBeInTheDocument();
  });

  it('renders every descriptive group trend and skip separately from confirmatory comparisons', () => {
    const recommended = createRecommendedScenario(cells.map((cell) => ({
      ...cell,
      analyticStatus: cell.rawValue === null ? 'exclude_missing' as const : 'include' as const,
    })));
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={recommended}
      variableLabels={{ taxa: 'Taxa de internação', custo: 'Custo hospitalar' }}
      run={{ ...run, scenarioFingerprint: recommended.fingerprint, results: [run.results[0]!] }}
      praisGroupRun={praisGroupRun}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByRole('heading', { name: 'Tendências Prais–Winsten por grupo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prais–Winsten · Grupo A · Taxa de internação' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prais–Winsten · Grupo B · Taxa de internação' })).toBeInTheDocument();
    expect(screen.getByText(/Grupo B · Custo hospitalar.*pelo menos 8 pontos/i)).toBeInTheDocument();
    expect(screen.getByText(/cada modelo descreve somente o seu grupo.*não compara p-valores/i)).toBeInTheDocument();
    expect(screen.getByText(/tendências descritivas aparecem primeiro.*bloco confirmatório.*teste principal/i))
      .toBeInTheDocument();
    const descriptiveHeading = screen.getByRole('heading', { name: 'Tendências Prais–Winsten por grupo' });
    const primaryHeading = screen.getByRole('heading', { name: /Mann–Whitney · Taxa de internação · principal/ });
    expect(descriptiveHeading.compareDocumentPosition(primaryHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('explains whether common temporal support changes n, magnitude, direction or evidence', () => {
    const recommended = createRecommendedScenario(cells.map((cell) => ({
      ...cell,
      analyticStatus: cell.rawValue === null ? 'exclude_missing' as const : 'include' as const,
    })));
    const main = { ...run.results[0]!, support: 'largest_valid' as const };
    const common = {
      ...main,
      role: 'sensibilidade' as const,
      support: 'common_coverage' as const,
      metrics: [{ label: 'Efeito', value: '0,20' }],
      coverage: { expected: 3, used: 1, missing: 2 },
      pValue: 0.2,
    };
    render(<GuidedResultsSection
      design={design}
      recommendedScenario={recommended}
      activeScenario={recommended}
      variableLabels={{ taxa: 'Taxa de internação' }}
      run={{
        ...run,
        scenarioFingerprint: recommended.fingerprint,
        results: [main, common],
        coverageSensitivity: { state: 'calculated', explanation: 'Somente 2024 teve cobertura completa.' },
      }}
      runError={null}
      pendingReview={false}
      onScenarioChange={() => undefined}
    />);

    expect(screen.getByRole('heading', { name: 'Sensibilidade da cobertura' })).toBeInTheDocument();
    expect(screen.getByText(/somente 2024/i)).toBeInTheDocument();
    expect(screen.getByText(/n 2 → 1.*efeito 0,40 → 0,20.*direção preservada.*limiar de 5% alterada/i)).toBeInTheDocument();
    expect(screen.getByText('Suporte temporal comum')).toBeInTheDocument();
  });
});

describe('buildGuidedMapModel', () => {
  it('keeps zero, missing and review as separate map states', () => {
    const model = buildGuidedMapModel(design, createRecommendedScenario(cells), 'taxa');
    expect(model?.values).toMatchObject({
      BA: { value: 0, displayStatus: 'zero' },
      SE: { value: null, displayStatus: 'missing' },
      SP: { value: 18, displayStatus: 'review' },
    });
  });
});
