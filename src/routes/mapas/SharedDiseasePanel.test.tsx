import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
