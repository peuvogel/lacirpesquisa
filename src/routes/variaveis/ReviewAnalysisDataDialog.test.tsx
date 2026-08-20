import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createRecommendedScenario } from '@/features/research/scenarios';
import type { AnalysisCell, ResearchDesign } from '@/features/research/types';
import { getDivergenciaRazao } from '@/features/catalog/catalogAnalysisData';
import { ReviewAnalysisDataDialog } from './ReviewAnalysisDataDialog';

const SIH_VARIABLE_ID = 'sih.embolia_e_trombose_arteriais.internacoes';

const design: ResearchDesign = {
  groups: [{
    id: 'g1',
    name: 'Grupo 1',
    territories: [
      { id: '29', label: 'Bahia' },
      { id: '28', label: 'Sergipe' },
      { id: '27', label: 'Alagoas' },
    ],
  }],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['teste'],
  period: { scope: 'shared', time: { mode: 'point', point: '2025' } },
};

const cells: AnalysisCell[] = [
  {
    groupId: 'g1', territoryId: '29', periodKey: '2025', variableId: 'internacoes', rawValue: 0,
    sourceStatus: 'collection_zero', analyticStatus: 'requires_review', reasonCode: 'rare_event_review',
  },
  {
    groupId: 'g1', territoryId: '28', periodKey: '2025', variableId: 'internacoes', rawValue: null,
    sourceStatus: 'missing', analyticStatus: 'exclude_missing', reasonCode: 'source_unavailable',
  },
  {
    groupId: 'g1', territoryId: '27', periodKey: '2025', variableId: 'internacoes', rawValue: 140,
    sourceStatus: 'observed', analyticStatus: 'include',
  },
];

describe('ReviewAnalysisDataDialog', () => {
  it('lets the researcher resolve a reviewable zero and explains that a truly missing value cannot be included', async () => {
    const user = userEvent.setup();
    const recommendedScenario = createRecommendedScenario(cells);
    const onApply = vi.fn();
    render(
      <ReviewAnalysisDataDialog
        design={design}
        recommendedScenario={recommendedScenario}
        activeScenario={recommendedScenario}
        variableLabels={{ internacoes: 'Internações' }}
        createdAfterResults={false}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Revisar dados da análise' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Sergipe.*sem valor bruto/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Incluir como zero observado' })).toBeInTheDocument();
    expect(screen.getByText(/valor: 140/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero confirmado na fonte.*Revisão necessária/i)).toBeInTheDocument();
    expect(screen.getByText(/Evento raro.*confirme/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /Bahia.*Internações/i }), 'include');
    await user.click(screen.getByRole('button', { name: 'Aplicar e recalcular' }));

    const revised = onApply.mock.calls[0]?.[0];
    expect(revised).toMatchObject({ kind: 'researcher_reviewed', createdAfterResults: false });
    expect(revised.cells[0]).toMatchObject({ analyticStatus: 'include', rawValue: 0 });
    expect(revised.cells[1]).toMatchObject({ analyticStatus: 'exclude_missing', rawValue: null });
  });

  it('marks changes made after viewing results as exploratory', async () => {
    const user = userEvent.setup();
    const recommendedScenario = createRecommendedScenario(cells.map((cell) => (
      cell.rawValue === 0 ? { ...cell, analyticStatus: 'include' as const } : cell
    )));
    const onApply = vi.fn();
    render(
      <ReviewAnalysisDataDialog
        design={design}
        recommendedScenario={recommendedScenario}
        activeScenario={recommendedScenario}
        variableLabels={{ internacoes: 'Internações' }}
        createdAfterResults
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Revisar dados da análise' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /Bahia.*Internações/i }), 'exclude');
    await user.click(screen.getByRole('button', { name: 'Aplicar e recalcular' }));

    expect(onApply.mock.calls[0]?.[0]).toMatchObject({ createdAfterResults: true });
  });

  it('requires the researcher to justify excluding a positive observed value', async () => {
    const user = userEvent.setup();
    const recommendedScenario = createRecommendedScenario(cells.map((cell) => (
      cell.rawValue === 0 ? { ...cell, analyticStatus: 'include' as const } : cell
    )));
    const onApply = vi.fn();
    render(
      <ReviewAnalysisDataDialog
        design={design}
        recommendedScenario={recommendedScenario}
        activeScenario={recommendedScenario}
        variableLabels={{ internacoes: 'Internações' }}
        createdAfterResults
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Revisar dados da análise' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /Alagoas.*Internações/i }), 'exclude');
    await user.click(screen.getByRole('button', { name: 'Aplicar e recalcular' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/informe por que o valor positivo/i);
    expect(onApply).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: /Justificativa para Alagoas/i }), 'Inconsistência confirmada na fonte');
    await user.click(screen.getByRole('button', { name: 'Aplicar e recalcular' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('shows the full period for one cell aggregated from a range', async () => {
    const user = userEvent.setup();
    const rangeDesign: ResearchDesign = {
      ...design,
      period: { scope: 'shared', time: { mode: 'range', start: '2013', end: '2025' } },
    };
    const recommendedScenario = createRecommendedScenario(cells.map((cell) => ({ ...cell, periodKey: '2013' })));
    render(
      <ReviewAnalysisDataDialog
        design={rangeDesign}
        recommendedScenario={recommendedScenario}
        activeScenario={recommendedScenario}
        variableLabels={{ internacoes: 'Internações' }}
        createdAfterResults={false}
        onApply={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Revisar dados da análise' }));
    expect(screen.getAllByText(/2013–2025/)).not.toHaveLength(0);
  });

  it('explica uma única vez a divergência do pack antes das células que a compartilham', async () => {
    const user = userEvent.setup();
    const recommendedScenario = createRecommendedScenario(cells);
    const razao = getDivergenciaRazao(SIH_VARIABLE_ID);
    render(
      <ReviewAnalysisDataDialog
        design={{ ...design, diseaseIds: ['embolia_e_trombose_arteriais'] }}
        recommendedScenario={recommendedScenario}
        activeScenario={recommendedScenario}
        variableLabels={{ internacoes: 'Internações por embolia e trombose arteriais' }}
        createdAfterResults={false}
        onApply={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Revisar dados da análise' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText(razao!, { exact: false })).toHaveLength(1);
    expect(dialog.textContent?.indexOf(razao!)).toBeLessThan(dialog.textContent?.indexOf('Bahia') ?? Infinity);
  });
});
