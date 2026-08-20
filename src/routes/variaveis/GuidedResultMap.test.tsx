import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRecommendedScenario } from '@/features/research/scenarios';
import type { AnalysisCell, ResearchDesign } from '@/features/research/types';
import { GuidedResultMap } from './GuidedResultMap';

const design: ResearchDesign = {
  groups: [{ id: 'a', name: 'Grupo A', territories: [{ id: '29', label: 'Bahia' }] }],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia_e_trombose_arteriais'],
  period: { scope: 'shared', time: { mode: 'point', point: '2025' } },
};

const cell: AnalysisCell = {
  groupId: 'a', territoryId: '29', periodKey: '2025', variableId: 'internacoes',
  rawValue: 12, sourceStatus: 'observed', analyticStatus: 'include',
};

describe('GuidedResultMap', () => {
  it('renders the real territorial map and legend for one unambiguous UF outcome', () => {
    const scenario = createRecommendedScenario([cell]);
    render(
      <GuidedResultMap
        design={design}
        scenario={scenario}
        variableId="internacoes"
        variableLabel="Internações"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Distribuição no mapa · Internações' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Mapa do Brasil por unidade federativa' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Legenda do mapa coroplético' })).toBeInTheDocument();
  });

  it('explains accessibly why a non-univocal territorial representation is not drawn', () => {
    const repeated = createRecommendedScenario([
      cell,
      { ...cell, periodKey: '2024', rawValue: 10 },
    ]);
    render(
      <GuidedResultMap
        design={design}
        scenario={repeated}
        variableId="internacoes"
        variableLabel="Internações"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/mais de um valor por território.*não foi agregado silenciosamente/i);
    expect(screen.queryByRole('group', { name: 'Mapa do Brasil por unidade federativa' })).not.toBeInTheDocument();
  });

  it('keeps municipal outcomes visible with an explicit representation limitation', () => {
    const municipioDesign: ResearchDesign = {
      ...design,
      geography: 'municipio',
      groups: [{ id: 'a', name: 'Salvador', territories: [{ id: '2927408', label: 'Salvador' }] }],
    };
    const scenario = createRecommendedScenario([{ ...cell, territoryId: '2927408' }]);
    render(
      <GuidedResultMap
        design={municipioDesign}
        scenario={scenario}
        variableId="internacoes"
        variableLabel="Internações"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/mapa municipal.*ainda não possui uma representação territorial unívoca/i);
  });
});
