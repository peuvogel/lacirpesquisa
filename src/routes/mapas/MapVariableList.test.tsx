import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ResearchDesign } from '@/features/research/types';
import type { GuidedVariableViewModel } from '@/routes/variaveis/guidedViewModels';
import { MapVariableList } from './MapVariableList';

const design: ResearchDesign = {
  groups: [{
    id: 'populacao',
    name: 'População selecionada',
    territories: [{ id: '29', label: 'Bahia' }],
  }],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia_e_trombose_arteriais'],
  period: { scope: 'shared', time: { mode: 'range', start: '2023', end: '2025' } },
};

const variables: GuidedVariableViewModel[] = [
  {
    id: 'internacoes',
    label: 'Internações',
    type: 'count',
    typeLabel: 'Contagem',
    availability: 'complete',
    sourceMethod: { source: 'SIH/SUS', method: 'Soma das internações registradas.' },
  },
  {
    id: 'taxa_mortalidade',
    label: 'Taxa de mortalidade',
    type: 'rate',
    typeLabel: 'Taxa',
    availability: 'partial',
    availabilityReason: 'Sem dados na Bahia em 2025.',
    sourceMethod: {
      source: 'SIH/SUS',
      method: 'Óbitos divididos por internações.',
      url: 'https://datasus.saude.gov.br/',
    },
  },
  {
    id: 'valor_total',
    label: 'Valor total',
    type: 'numeric',
    typeLabel: 'Numérica',
    availability: 'none',
    availabilityReason: 'Nenhuma observação utilizável no recorte.',
    sourceMethod: { source: 'SIH/SUS', method: 'Soma do valor aprovado.' },
  },
  {
    id: 'desfecho_hospitalar',
    label: 'Desfecho hospitalar',
    type: 'categorical',
    typeLabel: 'Categórica',
    availability: 'complete',
    sourceMethod: { source: 'SIH/SUS', method: 'Óbito e não óbito.' },
  },
];

function renderList(
  selectedVariableIds: string[] = [],
  onSelectionChange = vi.fn(),
) {
  return {
    onSelectionChange,
    ...render(
      <MapVariableList
        design={design}
        variables={variables}
        selectedVariableIds={selectedVariableIds}
        onSelectionChange={onSelectionChange}
      />,
    ),
  };
}

describe('MapVariableList', () => {
  it('shows one compact searchable list instead of type columns', async () => {
    const user = userEvent.setup();
    renderList();

    const list = screen.getByRole('list', { name: 'Variáveis para análise' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByRole('group', { name: 'Contagens' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar variável' }), 'mortalidade');
    expect(within(list).getByText('Taxa de mortalidade')).toBeInTheDocument();
    expect(within(list).queryByText('Internações')).not.toBeInTheDocument();
  });

  it('filters by role, type and real availability', async () => {
    const user = userEvent.setup();
    renderList();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'rate');
    expect(screen.getByText('Taxa de mortalidade')).toBeInTheDocument();
    expect(screen.queryByText('Valor total')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por disponibilidade' }), 'partial');
    expect(screen.getByText('Taxa de mortalidade')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'all');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por disponibilidade' }), 'all');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por papel' }), 'denominator');
    expect(screen.getByText('Internações')).toBeInTheDocument();
    expect(screen.queryByText('Taxa de mortalidade')).not.toBeInTheDocument();
  });

  it('allows partial coverage, blocks no-data rows and keeps provenance collapsed', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderList([], onSelectionChange);

    const partial = screen.getByTestId('map-variable-taxa_mortalidade');
    expect(within(partial).getByText('Parcial')).toBeInTheDocument();
    expect(within(partial).getByText('Sem dados na Bahia em 2025.')).toBeInTheDocument();
    expect(within(partial).getByRole('checkbox')).toBeEnabled();
    await user.click(within(partial).getByRole('checkbox'));
    expect(onSelectionChange).toHaveBeenCalledWith(['taxa_mortalidade']);

    const unavailable = screen.getByTestId('map-variable-valor_total');
    expect(within(unavailable).getByText('Indisponível')).toBeInTheDocument();
    expect(within(unavailable).getByRole('checkbox')).toBeDisabled();

    expect(screen.queryByText('Óbitos divididos por internações.')).not.toBeInTheDocument();
    await user.click(within(partial).getByRole('button', { name: 'Fonte e método' }));
    expect(screen.getByText('Óbitos divididos por internações.')).toBeInTheDocument();
  });

  it('pins selected variables when a later filter would otherwise hide them', async () => {
    const user = userEvent.setup();
    renderList(['taxa_mortalidade']);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'categorical_group');

    const selected = screen.getByRole('list', { name: 'Variáveis selecionadas fora dos filtros' });
    expect(within(selected).getByText('Taxa de mortalidade')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Variáveis para análise' })).toHaveTextContent(
      'Desfecho hospitalar',
    );
  });
});
