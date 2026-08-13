import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ResearchDesign } from '@/features/research/types';
import { DataProfileSection } from './DataProfileSection';
import { GuidedResearchFlow } from './GuidedResearchFlow';
import { GuidedVariableSelector } from './GuidedVariableSelector';
import type {
  DataProfileViewModel,
  EligibleTestViewModel,
  GuidedVariableViewModel,
  ResearchCutSummaryViewModel,
} from './guidedViewModels';

const { ChartMock } = vi.hoisted(() => {
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock(
    _canvas: unknown,
    config: unknown,
  ) {
    return {
      config,
      data: (config as { data: unknown }).data,
      destroy: vi.fn(),
      update: vi.fn(),
    };
  });
  const ChartMock = ChartConstructorSpy as unknown as typeof ChartConstructorSpy & {
    new (...args: unknown[]): unknown;
    register: ReturnType<typeof vi.fn>;
  };
  ChartMock.register = vi.fn();
  return { ChartMock };
});

vi.mock('chart.js', () => ({
  Chart: ChartMock,
  BarController: {},
  LineController: {},
  ScatterController: {},
  LinearScale: {},
  CategoryScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  Legend: {},
  Title: {},
  Tooltip: {},
  Filler: {},
}));

const design: ResearchDesign = {
  groups: [
    {
      id: 'nordeste',
      name: 'Nordeste',
      territories: [
        { id: '29', label: 'Bahia' },
        { id: '28', label: 'Sergipe' },
      ],
    },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia_e_trombose_arteriais'],
  period: { scope: 'shared', time: { mode: 'range', start: '2023', end: '2025' } },
};

const summary: ResearchCutSummaryViewModel = {
  eyebrow: 'Recorte recebido de Mapas',
  title: 'Nordeste · Embolia e trombose arteriais',
  facts: ['2 territórios', '2023–2025', 'Local de ocorrência'],
};

const comparisonDesign: ResearchDesign = {
  ...design,
  groups: [
    ...design.groups,
    {
      id: 'sudeste',
      name: 'Sudeste',
      territories: [
        { id: '35', label: 'São Paulo' },
        { id: '33', label: 'Rio de Janeiro' },
      ],
    },
  ],
};

const variables: GuidedVariableViewModel[] = [
  {
    id: 'internacoes',
    label: 'Internações',
    type: 'count',
    typeLabel: 'Contagem',
    availability: 'complete',
    sourceMethod: { source: 'SIH/SUS', method: 'Soma das internações observadas.' },
  },
  {
    id: 'taxa_mortalidade',
    label: 'Taxa de mortalidade',
    type: 'rate',
    typeLabel: 'Taxa',
    availability: 'partial',
    availabilityReason: 'Sem dados em BA e SE em 2025',
    sourceMethod: { source: 'SIH/SUS', method: 'Razão entre óbitos e internações.' },
  },
  {
    id: 'permanencia',
    label: 'Média de permanência',
    type: 'numeric',
    typeLabel: 'Numérica',
    availability: 'none',
    availabilityReason: 'Nenhuma observação utilizável no recorte',
    sourceMethod: { source: 'SIH/SUS', method: 'Média ponderada por internações.' },
  },
  {
    id: 'desfecho',
    label: 'Desfecho hospitalar',
    type: 'categorical',
    typeLabel: 'Categórica',
    availability: 'complete',
    sourceMethod: { source: 'SIH/SUS', method: 'Óbito e não óbito.' },
  },
];

const countProfile: DataProfileViewModel = {
  variableId: 'internacoes',
  label: 'Internações',
  kind: 'count',
  coverage: { expected: 6, available: 5, used: 5, missing: 1 },
  facts: [
    { label: 'Mediana', value: '1.248' },
    { label: 'Zeros', value: '20%' },
    { label: 'Dispersão', value: 'Maior que a média' },
  ],
  diagnosticLabel: 'Normalidade não se aplica',
  distribution: {
    title: 'Distribuição das contagens',
    description: 'Visualização preparada pelo perfil fornecido.',
  },
};

const eligibleTests: EligibleTestViewModel[] = [
  {
    id: 'mann-whitney',
    label: 'Mann–Whitney',
    status: 'eligible',
    statusLabel: 'Permitido',
    reason: 'Compara dois grupos independentes sem exigir normalidade.',
  },
  {
    id: 'permutation',
    label: 'Teste de permutação',
    status: 'eligible_with_caveat',
    statusLabel: 'Permitido com ressalva',
    reason: 'Amostra pequena; interprete a incerteza.',
  },
  {
    id: 'student-t',
    label: 'Teste t',
    status: 'ineligible',
    statusLabel: 'Não permitido',
    reason: 'Normalidade não estabelecida.',
  },
];

describe('GuidedResearchFlow', () => {
  it('shows disease, period, basis and every map group before variable checkboxes', async () => {
    const user = userEvent.setup();
    render(
      <GuidedResearchFlow design={comparisonDesign} summary={summary} variables={variables} />,
    );

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));

    const context = screen.getByRole('region', { name: 'Recorte que será analisado' });
    expect(within(context).getByText('Embolia e trombose arteriais')).toBeInTheDocument();
    expect(within(context).getByText('2023–2025')).toBeInTheDocument();
    expect(within(context).getByText('Ocorrência')).toBeInTheDocument();
    expect(within(context).getByText('Nordeste')).toBeInTheDocument();
    expect(within(context).getByText('Bahia, Sergipe')).toBeInTheDocument();
    expect(within(context).getByText('Sudeste')).toBeInTheDocument();
    expect(within(context).getByText('São Paulo, Rio de Janeiro')).toBeInTheDocument();
    expect(within(context).getByText(/cada variável marcada será analisada como um desfecho separado e comparada entre estes grupos territoriais/i)).toBeInTheDocument();

    const firstVariable = screen.getByRole('checkbox', { name: /Internações, Contagem/i });
    expect(context.compareDocumentPosition(firstVariable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('labels group tests as comparisons of the map groups', async () => {
    const user = userEvent.setup();
    render(
      <GuidedResearchFlow
        design={comparisonDesign}
        summary={summary}
        variables={variables}
        profilesByVariableId={{
          taxa_mortalidade: {
            ...countProfile,
            variableId: 'taxa_mortalidade',
            label: 'Taxa de mortalidade',
            kind: 'rate',
          },
        }}
        eligibility={eligibleTests}
        reviewsResolved
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Taxa de mortalidade, Taxa/i }));

    expect(screen.getByText('Nordeste × Sudeste')).toBeInTheDocument();
  });

  it('reveals the guided sections progressively and never renders results', async () => {
    const user = userEvent.setup();
    render(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile }}
        eligibility={eligibleTests}
        reviewsResolved
      />,
    );

    expect(screen.getByRole('heading', { name: '1. Qual é o objetivo?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '2. Escolha as variáveis' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    expect(screen.getByRole('heading', { name: '2. Escolha as variáveis' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '3. Conheça seus dados' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    expect(screen.getByRole('heading', { name: '3. Conheça seus dados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4. Testes permitidos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Permitidos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Com ressalvas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Não permitidos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Resultados/i })).not.toBeInTheDocument();
  });

  it('shows both learning paths for describe and compare', async () => {
    const user = userEvent.setup();
    render(
      <GuidedResearchFlow design={design} summary={summary} variables={variables} />,
    );

    await user.click(screen.getByRole('radio', { name: 'Descrever e comparar' }));

    const paths = screen.getByLabelText('Caminhos do objetivo');
    expect(within(paths).getByText('Descrição')).toBeInTheDocument();
    expect(within(paths).getByText('Comparação')).toBeInTheDocument();
  });

  it('offers Prais–Winsten only on descriptive paths after profiles and reviews are ready', async () => {
    const user = userEvent.setup();
    const props = {
      design: comparisonDesign,
      summary,
      variables,
      profilesByVariableId: { internacoes: countProfile },
      eligibility: eligibleTests,
      reviewsResolved: true,
      praisAvailable: true,
      praisReason: 'Há pelo menos uma série anual regular com 8 pontos.',
    };
    const { rerender } = render(<GuidedResearchFlow {...props} />);

    await user.click(screen.getByRole('radio', { name: 'Descrever' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    expect(screen.getByRole('checkbox', { name: 'Calcular Prais–Winsten por grupo' })).toBeEnabled();

    rerender(<GuidedResearchFlow {...props} key="compare-only" />);
    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    expect(screen.queryByRole('checkbox', { name: 'Calcular Prais–Winsten por grupo' })).not.toBeInTheDocument();
  });

  it('keeps descriptive trend choices independent from the confirmatory family', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <GuidedResearchFlow
        design={comparisonDesign}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile }}
        eligibility={eligibleTests}
        reviewsResolved
        praisAvailable
        praisReason="Séries anuais por grupo disponíveis."
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Descrever e comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    await user.click(screen.getByRole('checkbox', { name: /Selecionar Mann–Whitney/i }));
    await user.click(screen.getByRole('radio', { name: /Definir Mann–Whitney como principal/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Calcular Prais–Winsten por grupo' }));

    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({
      trendTestIds: ['prais-winsten'],
      testIds: ['mann-whitney'],
      primaryTestId: 'mann-whitney',
    }));
  });

  it('disables the loading pulse when the user prefers reduced motion', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <GuidedResearchFlow design={design} summary={summary} />,
    );

    await user.click(screen.getByRole('radio', { name: 'Descrever' }));

    const loading = screen.getByRole('heading', { name: '2. Preparando variáveis disponíveis…' }).closest('section');
    expect(loading).toBeInTheDocument();
    expect(container.querySelector('.motion-reduce\\:animate-none')).toBeInTheDocument();
  });

  it('allows multiple tests, one primary, and resets downstream choices', async () => {
    const user = userEvent.setup();
    render(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile, desfecho: {
          ...countProfile,
          variableId: 'desfecho',
          label: 'Desfecho hospitalar',
        } }}
        eligibility={eligibleTests}
        reviewsResolved
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    await user.click(screen.getByRole('checkbox', { name: /Selecionar Mann–Whitney/i }));
    await user.click(screen.getByRole('checkbox', { name: /Selecionar Teste de permutação/i }));
    await user.click(screen.getByRole('radio', { name: /Definir Mann–Whitney como principal/i }));

    expect(screen.getByRole('checkbox', { name: /Selecionar Mann–Whitney/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Definir Mann–Whitney como principal/i })).toBeChecked();
    expect(screen.getByText('Análise de sensibilidade')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Desfecho hospitalar, Categórica/i }));
    expect(screen.getByRole('checkbox', { name: /Selecionar Mann–Whitney/i })).not.toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Descrever' }));
    expect(screen.queryByRole('heading', { name: '3. Conheça seus dados' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Internações, Contagem/i })).not.toBeChecked();
  });

  it('keeps test decisions hidden while required reviews are pending', async () => {
    const user = userEvent.setup();
    render(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile }}
        eligibility={eligibleTests}
        reviewsResolved={false}
        resultsSlot={<section><h2>Revise os dados da análise</h2></section>}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));

    expect(screen.getByText('Revise as pendências antes de escolher testes.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Revise os dados da análise' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '4. Testes permitidos' })).not.toBeInTheDocument();
  });

  it('reveals an injected inline result only after a principal test is chosen', async () => {
    const user = userEvent.setup();
    render(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile }}
        eligibility={eligibleTests}
        reviewsResolved
        resultsSlot={<section><h2>5. Resultados no recorte</h2></section>}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    expect(screen.queryByRole('heading', { name: '5. Resultados no recorte' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Selecionar Mann–Whitney/i }));
    await user.click(screen.getByRole('radio', { name: /Definir Mann–Whitney como principal/i }));
    expect(screen.getByRole('heading', { name: '5. Resultados no recorte' })).toBeInTheDocument();
  });

  it('lets the user remove a selected test that becomes ineligible after data review', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile }}
        eligibility={eligibleTests}
        reviewsResolved
        resultsSlot={<section><h2>5. Resultados no recorte</h2></section>}
      />,
    );
    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    await user.click(screen.getByRole('checkbox', { name: /Selecionar Mann–Whitney/i }));
    await user.click(screen.getByRole('radio', { name: /Definir Mann–Whitney como principal/i }));

    rerender(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile }}
        eligibility={eligibleTests.map((test) => test.id === 'mann-whitney'
          ? { ...test, status: 'ineligible', statusLabel: 'Não permitido', reason: 'A revisão reduziu a amostra.' }
          : test)}
        reviewsResolved
        resultsSlot={<section><h2>5. Resultados no recorte</h2></section>}
      />,
    );

    const selected = screen.getByRole('checkbox', { name: /Selecionar Mann–Whitney/i });
    expect(selected).toBeEnabled();
    await user.click(selected);
    expect(screen.queryByRole('heading', { name: '5. Resultados no recorte' })).not.toBeInTheDocument();
  });

  it('shows honest loading states while profile and eligibility view-models are pending', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <GuidedResearchFlow design={design} summary={summary} variables={variables} />,
    );

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    expect(screen.getByRole('heading', { name: '3. Preparando o perfil dos dados…' })).toBeInTheDocument();

    rerender(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{ internacoes: countProfile }}
        reviewsResolved
      />,
    );
    expect(screen.getByRole('heading', { name: '4. Preparando testes permitidos…' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '4. Testes permitidos' })).not.toBeInTheDocument();
  });

  it('asks for explicit outcome and predictor roles when multiple variables are selected', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <GuidedResearchFlow
        design={design}
        summary={summary}
        variables={variables}
        profilesByVariableId={{
          internacoes: countProfile,
          taxa_mortalidade: { ...countProfile, variableId: 'taxa_mortalidade', label: 'Taxa de mortalidade', kind: 'rate' },
        }}
        eligibility={eligibleTests}
        reviewsResolved
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Comparar' }));
    await user.click(screen.getByRole('checkbox', { name: /Internações, Contagem/i }));
    await user.click(screen.getByRole('checkbox', { name: /Taxa de mortalidade, Taxa/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Variável de desfecho' }), 'taxa_mortalidade');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Variável preditora' }), 'internacoes');

    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({
      roleAssignments: { outcome: 'taxa_mortalidade', predictor: 'internacoes' },
      testIds: [],
      primaryTestId: null,
    }));
  });
});

describe('GuidedVariableSelector', () => {
  it('renders four type columns and respects complete, partial and unavailable states', async () => {
    const user = userEvent.setup();
    render(
      <GuidedVariableSelector
        design={design}
        variables={variables}
        selectedVariableIds={[]}
        onSelectionChange={() => undefined}
      />,
    );

    for (const name of ['Contagens', 'Taxas e percentuais', 'Numéricas', 'Categóricas e ordinais']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }

    expect(screen.getByRole('checkbox', { name: /Internações, Contagem/i })).toBeEnabled();
    const partial = screen.getByTestId('guided-variable-taxa_mortalidade');
    expect(partial).toHaveAttribute('data-availability', 'partial');
    expect(within(partial).getByText('Sem dados em BA e SE em 2025')).toBeInTheDocument();
    expect(within(partial).getByRole('checkbox')).toBeEnabled();

    const unavailable = screen.getByTestId('guided-variable-permanencia');
    expect(unavailable).toHaveAttribute('data-availability', 'none');
    expect(within(unavailable).getByText('Nenhuma observação utilizável no recorte')).toBeInTheDocument();
    expect(within(unavailable).getByRole('checkbox')).toBeDisabled();

    expect(screen.queryByText('Razão entre óbitos e internações.')).not.toBeInTheDocument();
    await user.click(within(partial).getByRole('button', { name: 'Fonte e método' }));
    expect(screen.getByText('Razão entre óbitos e internações.')).toBeInTheDocument();
  });
});

describe('DataProfileSection', () => {
  it('renders supplied numeric, count and categorical diagnostics without deriving them', () => {
    const profiles: DataProfileViewModel[] = [
      countProfile,
      {
        variableId: 'permanencia',
        label: 'Média de permanência',
        kind: 'numeric',
        coverage: { expected: 6, available: 6, used: 6, missing: 0 },
        facts: [
          { label: 'Média', value: '5,2 dias' },
          { label: 'Desvio-padrão', value: '1,1 dia' },
        ],
        diagnosticLabel: 'Distribuição não normal',
        distribution: { title: 'Histograma', description: 'Preset fornecido pelo perfil.' },
      },
      {
        variableId: 'desfecho',
        label: 'Desfecho hospitalar',
        kind: 'categorical',
        coverage: { expected: 100, available: 96, used: 96, missing: 4 },
        facts: [
          { label: 'Alta', value: '88 (91,7%)' },
          { label: 'Óbito', value: '8 (8,3%)' },
        ],
        diagnosticLabel: 'Frequências observadas',
        distribution: { title: 'Barras de frequência', description: 'Preset categórico fornecido.' },
      },
    ];

    render(<DataProfileSection profiles={profiles} reviewsResolved />);

    expect(screen.getByText('Normalidade não se aplica')).toBeInTheDocument();
    expect(screen.getByText('Distribuição não normal')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('88 (91,7%)')).toBeInTheDocument();
    expect(screen.getAllByText('Esperado')[0]).toBeInTheDocument();
    expect(screen.getByText('Barras de frequência')).toBeInTheDocument();
  });

  it('renders supplied histogram and Q–Q values as accessible charts', () => {
    render(<DataProfileSection profiles={[{
      ...countProfile,
      kind: 'numeric',
      diagnosticLabel: 'Aproximadamente normal',
      distribution: {
        title: 'Histograma e Q–Q',
        description: 'Valores observados.',
        histogram: [
          { lower: 0, upper: 1, count: 2 },
          { lower: 1, upper: 2, count: 4 },
        ],
        qqPoints: [
          { theoretical: -1, observed: 0.5 },
          { theoretical: 1, observed: 1.5 },
        ],
      },
    }]} reviewsResolved />);

    expect(screen.getByRole('img', { name: 'Histograma de Internações' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gráfico quantil-quantil de Internações' })).toBeInTheDocument();
  });
});
