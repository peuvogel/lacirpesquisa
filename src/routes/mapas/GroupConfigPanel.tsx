import { useMemo, type Dispatch } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import type { TerritoryRef } from '@/geo/types';
import {
  getCatalogTimeSeriesYears,
  getDefaultCatalogVariableId,
} from '@/features/catalog/catalogAnalysisData';
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

/** Intersection of pack years for selected vars; falls back to default catalog var years. */
function resolveYearOptions(variableIds: string[]): string[] {
  const ids = variableIds.length > 0 ? variableIds : [getDefaultCatalogVariableId()];
  let intersection: number[] | null = null;
  for (const id of ids) {
    const years = getCatalogTimeSeriesYears(id);
    if (years.length === 0) continue;
    intersection =
      intersection === null
        ? [...years]
        : intersection.filter((y) => years.includes(y));
  }
  if (!intersection?.length) {
    intersection = getCatalogTimeSeriesYears(getDefaultCatalogVariableId());
  }
  return intersection.map(String);
}

export function GroupConfigPanel({
  group,
  dispatch,
  pastedVariableIds = [],
  className,
}: GroupConfigPanelProps) {
  const territorySiglas = territoriesToSiglas(group.territoryIds);
  const timeReady = isTimeValid(group.time);
  const yearOptions = useMemo(
    () => resolveYearOptions(group.variableIds),
    [group.variableIds],
  );

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

      <TemporalidadeControl
        time={group.time}
        onChange={handleTimeChange}
        yearOptions={yearOptions}
      />

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
