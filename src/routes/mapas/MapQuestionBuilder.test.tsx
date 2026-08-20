import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapAnalysisState } from './mapAnalysisState';
import { MapQuestionBuilder } from './MapQuestionBuilder';
import type { MapQuestionDraft } from './mapQuestionDraft';

const embolia = 'sih.embolia_e_trombose_arteriais.internacoes';

function populatedState(groupCount = 1): MapAnalysisState {
  const groups: MapAnalysisState['groups'] = [
    {
      id: 'g1',
      name: 'População selecionada',
      territoryIds: [{ level: 'uf', ibgeCode: '29', sigla: 'BA', name: 'Bahia' }],
      time: { mode: 'range', start: '2013-01', end: '2025-12' },
      variableIds: [embolia],
    },
  ];
  if (groupCount > 1) {
    groups.push({
      id: 'g2',
      name: 'Comparador',
      territoryIds: [{ level: 'uf', ibgeCode: '33', sigla: 'RJ', name: 'Rio de Janeiro' }],
      time: { mode: 'range', start: '2013-01', end: '2025-12' },
      variableIds: [embolia],
    });
  }
  return {
    groups,
    activeGroupId: 'g1',
    mapView: { level: 'uf' },
    provenance: 'catalog',
    sharedTime: { mode: 'range', start: '2013-01', end: '2025-12' },
    periodScope: 'shared',
    locationBasis: 'ocorrencia',
  };
}

function renderBuilder(
  draft: MapQuestionDraft = { comparisonAxis: 'none', objective: null },
  state = populatedState(),
) {
  const dispatch = vi.fn();
  const onDraftChange = vi.fn();
  render(
    <MapQuestionBuilder
      state={state}
      draft={draft}
      dispatch={dispatch}
      onDraftChange={onDraftChange}
    />,
  );
  return { dispatch, onDraftChange };
}

describe('MapQuestionBuilder', () => {
  it('stays hidden until the map contains a population', () => {
    const empty: MapAnalysisState = {
      ...populatedState(),
      groups: [],
      activeGroupId: null,
    };
    renderBuilder(undefined, empty);
    expect(screen.queryByRole('heading', { name: 'O que você quer descobrir?' })).not.toBeInTheDocument();
  });

  it('offers one active comparison axis and resets the objective when it changes', () => {
    const { onDraftChange } = renderBuilder({ comparisonAxis: 'none', objective: 'describe' });

    expect(screen.getByRole('button', { name: 'Sem comparação' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Lugar' }));

    expect(onDraftChange).toHaveBeenCalledWith({ comparisonAxis: 'place', objective: null });
  });

  it('offers the existing comparator action when place has only one population', () => {
    const { dispatch } = renderBuilder({ comparisonAxis: 'place', objective: null });

    fireEvent.click(screen.getByRole('button', { name: /Adicionar comparador no mapa/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'CREATE_GROUP', name: 'Comparador' });
  });

  it('keeps unsupported axes clickable but explains why execution stays closed', () => {
    const { onDraftChange, rerender } = (() => {
      const dispatch = vi.fn();
      const onDraftChange = vi.fn();
      const result = render(
        <MapQuestionBuilder
          state={populatedState()}
          draft={{ comparisonAxis: 'disease', objective: 'compare' }}
          dispatch={dispatch}
          onDraftChange={onDraftChange}
        />,
      );
      return { ...result, onDraftChange };
    })();

    expect(screen.getByRole('status')).toHaveTextContent(/doenças são combinadas/i);
    expect(screen.getByRole('button', { name: 'Descrever' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Comparar/relacionar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ambos' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Exposição' }));
    expect(onDraftChange).toHaveBeenCalledWith({ comparisonAxis: 'exposure', objective: null });

    rerender(
      <MapQuestionBuilder
        state={populatedState()}
        draft={{ comparisonAxis: 'exposure', objective: 'compare' }}
        dispatch={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/exposição.*carregável/i);
    expect(screen.getByRole('button', { name: 'Descrever' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Comparar/relacionar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ambos' })).toBeDisabled();
  });

  it('reveals objectives after the axis and disables comparison without a comparison axis', () => {
    renderBuilder();

    expect(screen.getByRole('group', { name: 'Objetivo da pergunta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar/relacionar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ambos' })).toBeDisabled();
    expect(screen.getByText(/Na Bahia, como se comportaram os dados/i)).toBeInTheDocument();
  });

  it('invokes the existing period preparation action on the period axis', () => {
    const { dispatch } = renderBuilder({ comparisonAxis: 'period', objective: null });
    fireEvent.click(screen.getByRole('button', { name: /Preparar dois períodos/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'PREPARE_PERIOD_COMPARE' });
  });
});
