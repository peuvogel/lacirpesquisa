import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getCatalogVariableById, getDivergenciaRazao } from '@/features/catalog/catalogAnalysisData';
import { VariableDetailPanel } from './VariableDetailPanel';

const SIH_VARIABLE_ID = 'sih.embolia_e_trombose_arteriais.internacoes';

describe('VariableDetailPanel', () => {
  it('mostra perto do resumo a razão lida do pack antes da proveniência expansível', () => {
    const entry = getCatalogVariableById(SIH_VARIABLE_ID)!;
    const razao = getDivergenciaRazao(SIH_VARIABLE_ID);
    render(
      <VariableDetailPanel
        entry={entry}
        selectedLoadableCount={1}
        canLoadEstatistica
        onLoadEstatistica={() => undefined}
      />,
    );

    const note = screen.getByText(razao!, { exact: false });
    const provenance = screen.getByRole('button', { name: 'Fonte e método' });
    expect(note.compareDocumentPosition(provenance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
