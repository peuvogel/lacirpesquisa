import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { catalogIdFor } from '@/features/catalog/taxonomy';
import { GroupConfigPanel } from './GroupConfigPanel';
import type { MapAnalysisGroup } from './mapAnalysisState';

const sampleTerritory = {
  level: 'uf' as const,
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

function group(overrides: Partial<MapAnalysisGroup> = {}): MapAnalysisGroup {
  return {
    id: 'group-1',
    name: 'Grupo Bahia',
    territoryIds: [sampleTerritory],
    time: { mode: 'point' },
    variableIds: [],
    ...overrides,
  };
}

describe('GroupConfigPanel', () => {
  it('exibe território, doença, medida, período e resumo como campos do grupo', () => {
    render(
      <GroupConfigPanel
        group={group()}
        dispatch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Territórios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Doença ou condição' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Medida' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Período' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumo do grupo' })).toBeInTheDocument();
    expect(screen.queryByText(/compartilhado/i)).not.toBeInTheDocument();
  });

  it('oferece edição explícita dos territórios do grupo', () => {
    const onEditTerritories = vi.fn();
    render(
      <GroupConfigPanel
        group={group()}
        dispatch={vi.fn()}
        open
        onOpenChange={vi.fn()}
        onEditTerritories={onEditTerritories}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar territórios de Grupo Bahia' }));
    expect(onEditTerritories).toHaveBeenCalledOnce();
  });

  it('seleciona a doença somente no grupo endereçado', () => {
    const dispatch = vi.fn();
    render(
      <GroupConfigPanel group={group()} dispatch={dispatch} open onOpenChange={vi.fn()} />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar doença' }), {
      target: { value: 'Embolia e trombose arteriais' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId: 'group-1',
      variableId: catalogIdFor('internacoes', 'embolia_e_trombose_arteriais'),
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TOGGLE_DISEASE_ALL_GROUPS' }),
    );
  });

  it('permite escolher uma medida antes do período e substitui o desfecho anterior', () => {
    const original = catalogIdFor('internacoes', 'embolia_e_trombose_arteriais');
    const dispatch = vi.fn();
    render(
      <GroupConfigPanel
        group={group({ variableIds: [original] })}
        dispatch={dispatch}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const mortality = screen.getByRole('button', { name: /^Mortalidade$/i });
    expect(mortality).not.toBeDisabled();
    dispatch.mockClear();
    fireEvent.click(mortality);

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId: 'group-1',
      variableId: original,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'TOGGLE_GROUP_VARIABLE',
      groupId: 'group-1',
      variableId: catalogIdFor('taxa_mortalidade', 'embolia_e_trombose_arteriais'),
    });
  });

  it('grava o período no próprio grupo', () => {
    const dispatch = vi.fn();
    const outcome = catalogIdFor('taxa_internacao', 'embolia_e_trombose_arteriais');
    render(
      <GroupConfigPanel
        group={group({ variableIds: [outcome] })}
        dispatch={dispatch}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_GROUP_TIME',
        groupId: 'group-1',
      }),
    );
  });

  it('mostra um resumo legível da configuração independente', () => {
    render(
      <GroupConfigPanel
        group={group({
          time: { mode: 'range', start: '2015-01', end: '2020-12' },
          variableIds: [catalogIdFor('taxa_internacao', 'embolia_e_trombose_arteriais')],
        })}
        dispatch={vi.fn()}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Bahia · Embolia e trombose arteriais/i)).toBeInTheDocument();
    expect(screen.getByText(/Taxa de internação.*2015-01–2020-12/i)).toBeInTheDocument();
  });
});
