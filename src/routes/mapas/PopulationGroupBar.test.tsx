import { useReducer } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildPresetMapState } from './groupSelectionPresets';
import {
  createInitialMapAnalysisState,
  mapAnalysisReducer,
  type MapAnalysisState,
} from './mapAnalysisState';
import { PopulationGroupBar } from './PopulationGroupBar';

function stateWithPopulation(): MapAnalysisState {
  return {
    ...createInitialMapAnalysisState(),
    groups: [
      {
        id: 'population',
        name: 'População selecionada',
        territoryIds: [{ level: 'uf', ibgeCode: '29', sigla: 'BA', name: 'Bahia' }],
        time: { mode: 'range', start: '2013-01', end: '2025-12' },
        variableIds: [],
      },
    ],
    activeGroupId: 'population',
  };
}

function Harness({ initialState }: { initialState: MapAnalysisState }) {
  const [state, dispatch] = useReducer(mapAnalysisReducer, initialState);
  return (
    <PopulationGroupBar
      state={state}
      dispatch={dispatch}
      onApplySelectionPreset={(presetId) =>
        dispatch({ type: 'REPLACE_STATE', state: buildPresetMapState(presetId) })
      }
    />
  );
}

describe('PopulationGroupBar', () => {
  it('instructs the first direct map selection without a staging button', () => {
    render(<Harness initialState={createInitialMapAnalysisState()} />);

    expect(screen.getByLabelText('Populações da pergunta')).toBeInTheDocument();
    expect(
      screen.getByText('Clique no mapa para criar a População selecionada'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar comparador/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Adicionar grupo$/i)).not.toBeInTheDocument();
  });

  it('creates and activates an empty comparator while keeping the active color named in text', () => {
    render(<Harness initialState={stateWithPopulation()} />);

    const activeInstruction = screen.getByText(
      'Clique no mapa para adicionar à População selecionada',
    );
    expect(activeInstruction).toHaveStyle({ color: '#209978' });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar comparador' }));

    expect(screen.getByRole('tab', { name: /Comparador/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Clique no mapa para adicionar à Comparador')).toHaveStyle({
      color: '#3b82f6',
    });
  });

  it('lets the keyboard activate a population chip', () => {
    render(<Harness initialState={stateWithPopulation()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar comparador' }));

    const population = screen.getByRole('tab', { name: /População selecionada/i });
    population.focus();
    fireEvent.keyDown(population, { key: 'Enter' });

    expect(population).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText('Clique no mapa para adicionar à População selecionada'),
    ).toBeInTheDocument();
  });

  it('keeps didactic territorial presets available', () => {
    render(<Harness initialState={stateWithPopulation()} />);
    fireEvent.click(screen.getByRole('button', { name: /Presets/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /5 regiões/i }));

    expect(screen.getByRole('tab', { name: /Norte/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sudeste/i })).toBeInTheDocument();
  });
});
