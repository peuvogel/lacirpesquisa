import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TerritoryRef } from '@/geo/types';
import { TerritoryDraftBar } from './TerritoryDraftBar';

const territories: TerritoryRef[] = [
  { level: 'uf', ibgeCode: '29', sigla: 'BA', name: 'Bahia' },
  { level: 'uf', ibgeCode: '33', sigla: 'RJ', name: 'Rio de Janeiro' },
];

describe('TerritoryDraftBar', () => {
  it('torna explícito que os cliques no mapa ainda são uma seleção provisória', () => {
    render(
      <TerritoryDraftBar
        territories={[]}
        nextGroupNumber={1}
        onCreateGroup={vi.fn()}
        onClear={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Seleção territorial atual' })).toBeInTheDocument();
    expect(screen.getByText(/Clique nos estados ou municípios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar Grupo 1' })).toBeDisabled();
  });

  it('lista, remove, limpa e confirma os territórios do novo grupo', () => {
    const onCreateGroup = vi.fn();
    const onClear = vi.fn();
    const onRemove = vi.fn();
    render(
      <TerritoryDraftBar
        territories={territories}
        nextGroupNumber={2}
        onCreateGroup={onCreateGroup}
        onClear={onClear}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText('2 territórios selecionados')).toBeInTheDocument();
    expect(screen.getByText('Bahia')).toBeInTheDocument();
    expect(screen.getByText('Rio de Janeiro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover Bahia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 2' }));

    expect(onRemove).toHaveBeenCalledWith(territories[0]);
    expect(onClear).toHaveBeenCalledOnce();
    expect(onCreateGroup).toHaveBeenCalledOnce();
  });
});
