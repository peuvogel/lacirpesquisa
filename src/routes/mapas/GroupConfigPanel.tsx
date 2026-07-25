import type { Dispatch } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import type { TerritoryRef } from '@/geo/types';
import { TemporalidadeControl } from './TemporalidadeControl';
import { VariableCheckboxList } from './VariableCheckboxList';
import {
  isTimeValid,
  type MapAnalysisAction,
  type MapAnalysisGroup,
} from './mapAnalysisState';

export interface GroupConfigPanelProps {
  group: MapAnalysisGroup;
  dispatch: Dispatch<MapAnalysisAction>;
  pastedVariableIds?: string[];
  className?: string;
}

function territoriesToSiglas(territories: TerritoryRef[]): string[] {
  return territories
    .filter((t) => t.level === 'uf' && t.sigla)
    .map((t) => t.sigla!);
}

export function GroupConfigPanel({
  group,
  dispatch,
  pastedVariableIds = [],
  className,
}: GroupConfigPanelProps) {
  const territorySiglas = territoriesToSiglas(group.territoryIds);
  const timeReady = isTimeValid(group.time);

  const handleTimeChange = (time: typeof group.time) => {
    dispatch({ type: 'SET_GROUP_TIME', groupId: group.id, time });
  };

  const handleToggleVariable = (variableId: string) => {
    dispatch({ type: 'TOGGLE_GROUP_VARIABLE', groupId: group.id, variableId });
  };

  return (
    <div
      className={cn(
        'flex min-h-[320px] flex-col rounded-xl border border-border bg-surface p-6',
        className,
      )}
      aria-label={`Configuração de ${group.name}`}
    >
      <header className="mb-4">
        <h2 className="font-sans text-heading font-bold text-text">{group.name}</h2>
        {territorySiglas.length > 0 ? (
          <p className="mt-1 font-sans text-sm text-text-muted">
            Territórios: {territorySiglas.join(', ')}
          </p>
        ) : null}
      </header>

      <TemporalidadeControl time={group.time} onChange={handleTimeChange} />

      {timeReady ? (
        group.variableIds.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              heading="O que comparar?"
              body="Marque uma ou mais doenças ou indicadores para incluir na análise deste grupo."
            />
            <div className="mt-4">
              <VariableCheckboxList
                territorySiglas={territorySiglas}
                selectedVariableIds={group.variableIds}
                pastedVariableIds={pastedVariableIds}
                onToggleVariable={handleToggleVariable}
              />
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <VariableCheckboxList
              territorySiglas={territorySiglas}
              selectedVariableIds={group.variableIds}
              pastedVariableIds={pastedVariableIds}
              onToggleVariable={handleToggleVariable}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
