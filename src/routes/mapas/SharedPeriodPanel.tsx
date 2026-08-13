import { useMemo, type Dispatch } from 'react';
import { cn } from '@/lib/utils';
import { resolveCatalogYearOptions, isPeriodReady } from './catalogYearOptions';
import { ResearchAccordionPanel } from './ResearchAccordionPanel';
import { TemporalidadeControl } from './TemporalidadeControl';
import {
  formatTimeSummary,
  type MapAnalysisAction,
  type MapAnalysisGroup,
  type MapAnalysisState,
  type PeriodScope,
} from './mapAnalysisState';

export interface SharedPeriodPanelProps {
  state: MapAnalysisState;
  dispatch: Dispatch<MapAnalysisAction>;
  /** Disease catalog ids (shared) — drive available years. */
  diseaseVariableIds: string[];
  activeGroup: MapAnalysisGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function SharedPeriodPanel({
  state,
  dispatch,
  diseaseVariableIds,
  activeGroup,
  open,
  onOpenChange,
  className,
}: SharedPeriodPanelProps) {
  const hasDisease = diseaseVariableIds.some(Boolean);
  const yearOptions = useMemo(
    () => resolveCatalogYearOptions(diseaseVariableIds),
    [diseaseVariableIds],
  );
  const scope = state.periodScope ?? 'shared';
  const sharedTime = state.sharedTime ?? { mode: 'point' as const };
  const sharedReady = isPeriodReady(sharedTime, yearOptions);
  const activeReady =
    activeGroup != null && isPeriodReady(activeGroup.time, yearOptions);

  const setScope = (next: PeriodScope) => {
    dispatch({ type: 'SET_PERIOD_SCOPE', scope: next });
  };

  const summary = useMemo(() => {
    if (!hasDisease) return 'Escolha a doença primeiro';
    if (scope === 'shared') {
      const label = formatTimeSummary(sharedTime);
      return label
        ? `${label} · todos os grupos`
        : 'Defina o intervalo compartilhado';
    }
    const parts = state.groups
      .map((g) => formatTimeSummary(g.time))
      .filter(Boolean);
    if (parts.length === 0) return 'Um intervalo por grupo';
    if (parts.length === 1) return `${parts[0]} · por grupo`;
    return `${parts[0]} × ${parts[1]}${parts.length > 2 ? '…' : ''}`;
  }, [hasDisease, scope, sharedTime, state.groups]);

  return (
    <ResearchAccordionPanel
      open={open}
      onOpenChange={onOpenChange}
      step="2 · Período"
      title={
        scope === 'shared' ? 'Mesmo intervalo em todos os grupos' : 'Um intervalo por grupo'
      }
      subtitle={
        scope === 'shared'
          ? 'Padrão da aula: todos os grupos usam os mesmos anos.'
          : 'Para comparar o mesmo lugar em épocas diferentes (ex.: Bahia pré × pós pandemia).'
      }
      summary={summary}
      className={className}
      aria-label="Período da pesquisa"
    >
      <div
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-elevated/60 p-1"
        role="group"
        aria-label="Base da localização"
      >
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_LOCATION_BASIS', locationBasis: 'ocorrencia' })}
          className={cn(
            'rounded-lg px-2 py-2 font-sans text-xs font-bold transition-colors',
            state.locationBasis === 'ocorrencia'
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:bg-white/5 hover:text-text',
          )}
          aria-pressed={state.locationBasis === 'ocorrencia'}
        >
          Ocorrência
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_LOCATION_BASIS', locationBasis: 'residencia' })}
          className={cn(
            'rounded-lg px-2 py-2 font-sans text-xs font-bold transition-colors',
            state.locationBasis === 'residencia'
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:bg-white/5 hover:text-text',
          )}
          aria-pressed={state.locationBasis === 'residencia'}
        >
          Residência
        </button>
      </div>

      <div
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-elevated/60 p-1"
        role="group"
        aria-label="Escopo do período"
      >
        <button
          type="button"
          onClick={() => setScope('shared')}
          className={cn(
            'rounded-lg px-2 py-2.5 font-sans text-xs font-bold leading-snug transition-colors',
            scope === 'shared'
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:bg-white/5 hover:text-text',
          )}
          aria-pressed={scope === 'shared'}
        >
          Mesmo em todos
        </button>
        <button
          type="button"
          onClick={() => setScope('per-group')}
          className={cn(
            'rounded-lg px-2 py-2.5 font-sans text-xs font-bold leading-snug transition-colors',
            scope === 'per-group'
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:bg-white/5 hover:text-text',
          )}
          aria-pressed={scope === 'per-group'}
        >
          Diferentes por grupo
        </button>
      </div>

      <div className="space-y-3">
        {!hasDisease ? (
          <p className="font-sans text-sm text-text-muted">
            Escolha a doença acima para liberar os anos com dados.
          </p>
        ) : scope === 'shared' ? (
          <TemporalidadeControl
            time={sharedTime}
            onChange={(time) => dispatch({ type: 'SET_SHARED_TIME', time })}
            yearOptions={yearOptions}
          />
        ) : (
          <>
            <div className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-3">
              <p className="font-sans text-sm font-bold text-text">
                Comparar pré × pós pandemia?
              </p>
              <p className="mt-1 font-sans text-xs leading-snug text-text-muted">
                Cria (ou ajusta) dois grupos com o mesmo território: um até 2019 e outro de 2020 em
                diante — ideal para Bahia, SP, etc.
              </p>
              <button
                type="button"
                onClick={() => dispatch({ type: 'PREPARE_PERIOD_COMPARE' })}
                className="mt-2 rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 font-sans text-xs font-bold text-accent transition-colors hover:bg-accent/25"
              >
                Preparar comparação
              </button>
            </div>

            {state.groups.length > 0 ? (
              <ul className="space-y-1.5" aria-label="Período de cada grupo">
                {state.groups.map((group) => {
                  const label = formatTimeSummary(group.time) || 'sem período';
                  const isActive = group.id === state.activeGroupId;
                  return (
                    <li key={group.id}>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'SET_ACTIVE_GROUP', groupId: group.id })
                        }
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          isActive
                            ? 'border-accent/40 bg-accent/10'
                            : 'border-border/60 bg-elevated/40 hover:border-accent-border',
                        )}
                      >
                        <span className="min-w-0 truncate font-sans text-sm font-bold text-text">
                          {group.name}
                        </span>
                        <span className="shrink-0 font-sans text-xs tabular-nums text-text-muted">
                          {label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {activeGroup ? (
              <div className="space-y-2 border-t border-white/8 pt-3">
                <p className="font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
                  Período de {activeGroup.name}
                </p>
                <TemporalidadeControl
                  time={activeGroup.time}
                  onChange={(time) =>
                    dispatch({
                      type: 'SET_GROUP_TIME',
                      groupId: activeGroup.id,
                      time,
                    })
                  }
                  yearOptions={yearOptions}
                />
              </div>
            ) : null}
          </>
        )}

        {hasDisease && scope === 'shared' && sharedReady ? (
          <p className="font-sans text-xs text-text-muted" role="status">
            Aplicado a {state.groups.length} grupo
            {state.groups.length === 1 ? '' : 's'}.
          </p>
        ) : null}
        {hasDisease && scope === 'per-group' && activeGroup && !activeReady ? (
          <p className="font-sans text-xs text-text-muted">Ajuste o intervalo do grupo ativo.</p>
        ) : null}
      </div>
    </ResearchAccordionPanel>
  );
}
