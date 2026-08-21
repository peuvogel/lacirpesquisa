import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ResearchDesign } from '@/features/research/types';
import type { DataProfileViewModel, EligibleTestViewModel } from '@/routes/variaveis/guidedViewModels';
import { MapTestRecommendation } from './MapTestRecommendation';

const twoGroups: ResearchDesign = {
  groups: [
    { id: 'ba', name: 'Bahia', territories: [{ id: '29', label: 'Bahia' }] },
    { id: 'rj', name: 'Rio de Janeiro', territories: [{ id: '33', label: 'Rio de Janeiro' }] },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['diabetes'],
  period: { scope: 'shared', time: { mode: 'point', point: '2025' } },
};

const numericProfile: DataProfileViewModel = {
  variableId: 'media_permanencia_calculada',
  label: 'Média de permanência',
  kind: 'numeric',
  coverage: { expected: 10, available: 10, used: 10, missing: 0 },
  facts: [{ label: 'Média', value: '5,2' }],
  diagnosticLabel: 'Compatível com distribuição aproximadamente normal',
  distribution: { title: 'Histograma e Q–Q', description: 'Valores reais usados.' },
};

function test(
  id: string,
  label: string,
  status: EligibleTestViewModel['status'],
  reason: string,
): EligibleTestViewModel {
  return {
    id,
    label,
    status,
    statusLabel: status === 'eligible'
      ? 'Permitido'
      : status === 'eligible_with_caveat'
        ? 'Permitido com ressalva'
        : 'Não permitido',
    reason,
  };
}

const twoGroupTests = [
  test('t-student', 't de Student', 'eligible', 'Os dois grupos são independentes e o perfil é compatível.'),
  test('mann-whitney', 'Mann–Whitney', 'eligible_with_caveat', 'Pode ser usado como análise por postos.'),
  test('anova-tukey', 'ANOVA com Tukey', 'ineligible', 'Este teste exige três ou mais grupos.'),
];

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    design: twoGroups,
    tests: twoGroupTests,
    selectedTestIds: [],
    primaryTestId: null,
    onSelectedTestIdsChange: vi.fn(),
    onPrimaryTestIdChange: vi.fn(),
    onRecommendedSelectionChange: vi.fn(),
    profiles: [numericProfile],
    goal: 'compare' as const,
    comparisonAxis: 'place' as const,
    ...overrides,
  };
}

describe('MapTestRecommendation', () => {
  it('chooses the eligible two-group test and keeps only a valid sensitivity alternative executable', async () => {
    const props = baseProps();
    render(<MapTestRecommendation {...props} />);

    expect(screen.getByRole('heading', { name: 'Teste escolhido pelo sistema' })).toBeInTheDocument();
    expect(screen.getByText('t de Student')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText(/2 grupos.*variável numérica/i)).toBeInTheDocument();
    expect(screen.getByText(/aproximadamente normal/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(props.onRecommendedSelectionChange).toHaveBeenCalledWith({
        testIds: ['t-student'],
        primaryTestId: 't-student',
      });
    });

    const sensitivity = screen.getByRole('article', { name: /Mann–Whitney/i });
    expect(within(sensitivity).getByText('Sensibilidade')).toBeInTheDocument();
    expect(within(sensitivity).getByRole('checkbox', { name: /Adicionar Mann–Whitney/i })).toBeEnabled();
    expect(screen.queryByRole('checkbox', { name: /ANOVA/i })).not.toBeInTheDocument();
    expect(screen.getByText('Este teste exige três ou mais grupos.')).toBeInTheDocument();
  });

  it('prefers the rank test when it is fully eligible and the parametric option has a caveat', async () => {
    const props = baseProps({
      tests: [
        test('t-student', 't de Student', 'eligible_with_caveat', 'A normalidade não foi sustentada em todos os grupos.'),
        test('mann-whitney', 'Mann–Whitney', 'eligible', 'Compara os postos entre dois grupos independentes.'),
      ],
      profiles: [{ ...numericProfile, diagnosticLabel: 'Distribuição não normal' }],
    });
    render(<MapTestRecommendation {...props} />);

    await waitFor(() => {
      expect(props.onRecommendedSelectionChange).toHaveBeenCalledWith({
        testIds: ['mann-whitney'],
        primaryTestId: 'mann-whitney',
      });
    });
    expect(screen.getByRole('article', { name: /Mann–Whitney.*principal/i })).toBeInTheDocument();
  });

  it('uses the three-or-more-groups pair and recommends Kruskal when ANOVA has a caveat', async () => {
    const fourGroups: ResearchDesign = {
      ...twoGroups,
      groups: [
        ...twoGroups.groups,
        { id: 'sp', name: 'São Paulo', territories: [{ id: '35', label: 'São Paulo' }] },
        { id: 'mg', name: 'Minas Gerais', territories: [{ id: '31', label: 'Minas Gerais' }] },
      ],
    };
    const props = baseProps({
      design: fourGroups,
      tests: [
        test('anova-tukey', 'ANOVA com Tukey', 'eligible_with_caveat', 'Normalidade não sustentada em todos os grupos.'),
        test('kruskal-dunn', 'Kruskal–Wallis com Dunn', 'eligible', 'Compara postos entre grupos independentes.'),
      ],
    });
    render(<MapTestRecommendation {...props} />);

    await waitFor(() => expect(props.onRecommendedSelectionChange).toHaveBeenCalledWith({
      testIds: ['kruskal-dunn'],
      primaryTestId: 'kruskal-dunn',
    }));
    expect(screen.getByText(/4 grupos.*variável numérica/i)).toBeInTheDocument();
  });

  it('recommends correlation only after distinct predictor and outcome roles are real and eligible', async () => {
    const props = baseProps({
      tests: [test('correlacao', 'Correlação de Pearson / Spearman', 'eligible', '10 pares completos serão usados.')],
      profiles: [numericProfile, { ...numericProfile, variableId: 'taxa_internacao_100k', label: 'Taxa de internação', kind: 'rate' }],
      roleOptions: [
        { id: 'media_permanencia_calculada', label: 'Média de permanência' },
        { id: 'taxa_internacao_100k', label: 'Taxa de internação' },
      ],
      roleAssignments: { predictor: 'media_permanencia_calculada', outcome: 'taxa_internacao_100k' },
      onRoleAssignmentsChange: vi.fn(),
    });
    render(<MapTestRecommendation {...props} />);

    await waitFor(() => expect(props.onRecommendedSelectionChange).toHaveBeenCalledWith({
      testIds: ['correlacao'],
      primaryTestId: 'correlacao',
    }));
    expect(screen.getByText(/duas variáveis.*pares completos/i)).toBeInTheDocument();
  });

  it.each(['disease', 'exposure'] as const)('fails closed for the unsupported %s axis', (comparisonAxis) => {
    const props = baseProps({ comparisonAxis });
    render(<MapTestRecommendation {...props} />);

    expect(screen.getByRole('status')).toHaveTextContent(/não será executado/i);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(props.onRecommendedSelectionChange).not.toHaveBeenCalled();
  });

  it('lets the user add and remove a valid sensitivity test without replacing the principal', async () => {
    const user = userEvent.setup();
    const onSelectedTestIdsChange = vi.fn();
    const props = baseProps({
      selectedTestIds: ['t-student'],
      primaryTestId: 't-student',
      onSelectedTestIdsChange,
    });
    const { rerender } = render(<MapTestRecommendation {...props} />);

    await user.click(screen.getByRole('checkbox', { name: /Adicionar Mann–Whitney/i }));
    expect(onSelectedTestIdsChange).toHaveBeenCalledWith(['t-student', 'mann-whitney']);

    rerender(<MapTestRecommendation {...props} selectedTestIds={['t-student', 'mann-whitney']} />);
    await user.click(screen.getByRole('checkbox', { name: /Remover Mann–Whitney/i }));
    expect(onSelectedTestIdsChange).toHaveBeenLastCalledWith(['t-student']);
  });

  it('clears a previous execution choice when data review leaves no eligible test', async () => {
    const props = baseProps({
      tests: twoGroupTests.map((item) => ({
        ...item,
        status: 'ineligible' as const,
        statusLabel: 'Não permitido',
        reason: 'A revisão deixou menos de três unidades independentes por grupo.',
      })),
      selectedTestIds: ['t-student'],
      primaryTestId: 't-student',
    });
    render(<MapTestRecommendation {...props} />);

    await waitFor(() => expect(props.onRecommendedSelectionChange).toHaveBeenCalledWith({
      testIds: [],
      primaryTestId: null,
    }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('does not mix Prais–Winsten into the comparison recommendation', () => {
    const props = baseProps({
      tests: [
        ...twoGroupTests,
        test('prais-winsten', 'Prais–Winsten', 'ineligible', 'A tendência é calculada separadamente por grupo.'),
      ],
    });
    render(<MapTestRecommendation {...props} />);

    expect(screen.queryByText(/Prais–Winsten/)).not.toBeInTheDocument();
  });
});
