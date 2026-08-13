import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createRecommendedScenario, reviseScenario, treatAsMissing } from '@/features/research/scenarios';
import type { AnalysisCell, ResearchDesign } from '@/features/research/types';
import { GuidedResultsSection } from './GuidedResultsSection';
import { buildGuidedMapModel } from './GuidedResultMap';
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
    const principal = screen.getByRole('heading', { name: 'Mann–Whitney · principal' });
    const sensitivity = screen.getByRole('heading', { name: 't de Student · sensibilidade' });
    expect(principal.compareDocumentPosition(sensitivity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mapa coroplético do resultado' })).toBeInTheDocument();
    expect(screen.getByText(/não demonstra causalidade/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar dados da análise' })).toBeInTheDocument();
    const conclusion = within(screen.getByRole('region', { name: 'Conclusão' })).getAllByRole('paragraph')[0]!;
    expect(conclusion).toHaveTextContent(/^Efeito principal/i);
    expect(conclusion.textContent?.indexOf('Efeito')).toBeLessThan(conclusion.textContent?.indexOf('evidência') ?? Infinity);
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
    expect(screen.getByText(/mudou de 2 para 1/i)).toBeInTheDocument();
    expect(screen.getByText(/0,40.*0,20/i)).toBeInTheDocument();
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
