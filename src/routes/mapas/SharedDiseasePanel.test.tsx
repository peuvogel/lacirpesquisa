import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SharedDiseasePanel } from './SharedDiseasePanel';

describe('SharedDiseasePanel', () => {
  it('dispatches TOGGLE_DISEASE_ALL_GROUPS when a disease is checked', () => {
    const dispatch = vi.fn();

    render(
      <SharedDiseasePanel
        selectedVariableIds={[]}
        dispatch={dispatch}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'TOGGLE_DISEASE_ALL_GROUPS',
      diseaseId: 'embolia_e_trombose_arteriais',
    });
  });

  it('shows summary when collapsed', () => {
    render(
      <SharedDiseasePanel
        selectedVariableIds={['sih.embolia_e_trombose_arteriais.internacoes']}
        dispatch={vi.fn()}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Embolia e trombose/i)).toBeInTheDocument();
  });

  it('is search-first without dumping the full catalog and keeps a selected disease visible', () => {
    render(
      <SharedDiseasePanel
        selectedVariableIds={['sih.amputacao_mmii.internacoes']}
        dispatch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('checkbox').length).toBeLessThanOrEqual(10);
    expect(
      within(list).getByRole('checkbox', {
        name: /Amputação.*membros inferiores/i,
      }),
    ).toBeChecked();
    expect(screen.getByText(/digite para buscar/i)).toBeInTheDocument();
  });
});
