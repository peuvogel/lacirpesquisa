import { useReducer } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

function Harness({
  initialState,
  onNewGroup = vi.fn(),
}: {
  initialState: MapAnalysisState;
  onNewGroup?: () => void;
}) {
  const [state, dispatch] = useReducer(mapAnalysisReducer, initialState);
  return (
    <PopulationGroupBar
      state={state}
      dispatch={dispatch}
      onNewGroup={onNewGroup}
      onApplySelectionPreset={(presetId) =>
        dispatch({ type: 'REPLACE_STATE', state: buildPresetMapState(presetId) })
      }
    />
  );
}

describe('PopulationGroupBar', () => {
  it('identifies the strip as explicit groups, even before the first one exists', () => {
    render(<Harness initialState={createInitialMapAnalysisState()} />);

    expect(screen.getByLabelText('Grupos definidos')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum grupo confirmado/i)).toBeInTheDocument();
  });

  it('requests a new draft instead of creating a group silently', () => {
    const onNewGroup = vi.fn();
    render(<Harness initialState={stateWithPopulation()} onNewGroup={onNewGroup} />);

    const populationTab = screen.getByRole('tab', { name: /População selecionada/i });
    expect(populationTab.closest('[role="tablist"]')).toHaveAccessibleName(
      'Grupos confirmados',
    );

    const activeInstruction = screen.getByText(/População selecionada está ativo/i);
    expect(activeInstruction).toHaveStyle({ color: '#209978' });

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));

    expect(onNewGroup).toHaveBeenCalledOnce();
    expect(screen.queryByRole('tab', { name: /Comparador/i })).not.toBeInTheDocument();
  });

  it('lets the keyboard activate a population chip', () => {
    const initial = stateWithPopulation();
    initial.groups.push({
      id: 'comparator',
      name: 'Comparador',
      territoryIds: [],
      time: { mode: 'point' },
      variableIds: [],
    });
    initial.activeGroupId = 'comparator';
    render(<Harness initialState={initial} />);

    const population = screen.getByRole('tab', { name: /População selecionada/i });
    population.focus();
    fireEvent.keyDown(population, { key: 'Enter' });

    expect(population).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText(/População selecionada está ativo/i),
    ).toBeInTheDocument();
  });

  it('shows the completion state in text instead of relying on color', () => {
    render(<Harness initialState={stateWithPopulation()} />);

    expect(screen.getByText('Incompleto')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /População selecionada.*incompleto/i })).toBeInTheDocument();
  });

  it('keeps didactic territorial presets available', () => {
    render(<Harness initialState={stateWithPopulation()} />);
    fireEvent.click(screen.getByRole('button', { name: /Presets/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /5 regiões/i }));

    expect(screen.getByRole('tab', { name: /Norte/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sudeste/i })).toBeInTheDocument();
  });

  it('moves focus into presets and restores it when Escape closes the menu', () => {
    render(<Harness initialState={stateWithPopulation()} />);
    const trigger = screen.getByRole('button', { name: /Presets/i });

    trigger.focus();
    fireEvent.click(trigger);

    const firstPreset = screen.getAllByRole('menuitem')[0]!;
    expect(firstPreset).toHaveFocus();

    fireEvent.keyDown(firstPreset, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('navigates presets with menu keys and restores focus after selection', () => {
    render(<Harness initialState={stateWithPopulation()} />);
    const trigger = screen.getByRole('button', { name: /Presets/i });

    fireEvent.click(trigger);
    const presets = screen.getAllByRole('menuitem');

    fireEvent.keyDown(presets[0]!, { key: 'ArrowDown' });
    expect(presets[1]).toHaveFocus();

    fireEvent.keyDown(presets[1]!, { key: 'End' });
    expect(presets.at(-1)).toHaveFocus();

    fireEvent.keyDown(presets.at(-1)!, { key: 'Home' });
    expect(presets[0]).toHaveFocus();

    fireEvent.keyDown(presets[0]!, { key: 'ArrowUp' });
    expect(presets.at(-1)).toHaveFocus();

    fireEvent.click(presets.at(-1)!);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
