import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { catalogIdFor } from '@/features/catalog/taxonomy';
import type { MapAnalysisGroup } from './mapAnalysisState';
import { assessGroupComparison } from './comparisonAssessment';
import { GroupComparisonReview } from './GroupComparisonReview';

function group(id: string, uf: 'BA' | 'RJ', year = '2019'): MapAnalysisGroup {
  const territory =
    uf === 'BA'
      ? { level: 'uf' as const, ibgeCode: '29', sigla: 'BA', name: 'Bahia' }
      : { level: 'uf' as const, ibgeCode: '33', sigla: 'RJ', name: 'Rio de Janeiro' };
  return {
    id,
    name: `Grupo ${uf}`,
    territoryIds: [territory],
    time: { mode: 'point', point: year },
    variableIds: [catalogIdFor('taxa_internacao', 'embolia_e_trombose_arteriais')],
  };
}

describe('GroupComparisonReview', () => {
  it('mostra a matriz das configurações e o teste compatível', () => {
    const groups = [group('1', 'BA'), group('2', 'RJ')];
    render(
      <GroupComparisonReview groups={groups} assessment={assessGroupComparison(groups)} />,
    );

    expect(screen.getByRole('heading', { name: 'Revisar comparação' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Matriz de comparação dos grupos' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Grupo BA' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Território' })).toBeInTheDocument();
    expect(screen.getByText('Grupos independentes por lugar')).toBeInTheDocument();
    expect(screen.getByText(/t de Student/i)).toBeInTheDocument();
  });

  it('expõe seleção espúria como bloqueio com correção concreta', () => {
    const groups = [group('1', 'BA'), group('2', 'RJ', '2024')];
    render(
      <GroupComparisonReview groups={groups} assessment={assessGroupComparison(groups)} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Comparação confundida');
    expect(screen.getByRole('alert')).toHaveTextContent(/varie apenas uma dimensão/i);
    expect(screen.getByText(/Descrição continua disponível/i)).toBeInTheDocument();
  });

  it('explica as pendências de grupos ainda incompletos', () => {
    const groups = [
      {
        ...group('1', 'BA'),
        time: { mode: 'point' as const },
        variableIds: [],
      },
    ];
    render(
      <GroupComparisonReview groups={groups} assessment={assessGroupComparison(groups)} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Complete todos os grupos');
    expect(screen.getByText(/Doença e medida não definidas/i)).toBeInTheDocument();
    expect(screen.getByText(/Período não definido/i)).toBeInTheDocument();
  });
});
