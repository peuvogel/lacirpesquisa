import { useMemo, useState, type Dispatch } from 'react';
import { cn } from '@/lib/utils';
import type { ResearchGoal } from '@/features/research/types';
import { SharedDiseasePanel } from './SharedDiseasePanel';
import { SharedPeriodPanel } from './SharedPeriodPanel';
import type { MapAnalysisAction, MapAnalysisState } from './mapAnalysisState';
import {
  buildQuestionSentence,
  validateMapQuestion,
  type ComparisonAxis,
  type MapQuestionDraft,
} from './mapQuestionDraft';

const AXES: Array<{ value: ComparisonAxis; label: string; hint: string }> = [
  { value: 'none', label: 'Sem comparação', hint: 'Descrever uma população ou tendência.' },
  { value: 'place', label: 'Lugar', hint: 'Comparar populações do mapa.' },
  { value: 'period', label: 'Período', hint: 'Comparar janelas de tempo.' },
  { value: 'disease', label: 'Doença', hint: 'Estruturar uma comparação por condição.' },
  { value: 'exposure', label: 'Exposição', hint: 'Relacionar um contexto territorial.' },
];

const OBJECTIVES: Array<{ value: ResearchGoal; label: string }> = [
  { value: 'describe', label: 'Descrever' },
  { value: 'compare', label: 'Comparar/relacionar' },
  { value: 'describe_and_compare', label: 'Ambos' },
];

export interface MapQuestionBuilderProps {
  state: MapAnalysisState;
  draft: MapQuestionDraft;
  dispatch: Dispatch<MapAnalysisAction>;
  onDraftChange: (draft: MapQuestionDraft) => void;
}

function objectiveDisabled(axis: ComparisonAxis, goal: ResearchGoal): boolean {
  // O snapshot atual colapsa doenças antes da análise e ainda não contém
  // exposições territoriais juntadas. Nem mesmo uma descrição nesses eixos
  // seria lado a lado; habilitá-la apresentaria uma soma como comparação.
  if (axis === 'disease' || axis === 'exposure') return true;
  if (axis === 'none') return goal !== 'describe';
  return false;
}

function objectiveDisabledReason(axis: ComparisonAxis): string | undefined {
  if (axis === 'disease') {
    return 'Ainda não é possível separar as doenças lado a lado com a unidade analítica atual.';
  }
  if (axis === 'exposure') {
    return 'Ainda não há uma exposição carregável e ligada ao território e período.';
  }
  if (axis === 'none') return 'Escolha um eixo de comparação para liberar este objetivo.';
  return undefined;
}

export function MapQuestionBuilder({
  state,
  draft,
  dispatch,
  onDraftChange,
}: MapQuestionBuilderProps) {
  const [openPanel, setOpenPanel] = useState<'disease' | 'period' | null>('disease');
  const selectedVariableIds = useMemo(
    () => [...new Set(state.groups.flatMap((group) => group.variableIds))],
    [state.groups],
  );
  const activeGroup = state.groups.find((group) => group.id === state.activeGroupId) ?? null;
  const validation = validateMapQuestion(state, draft);
  const question = buildQuestionSentence(state, draft);

  if (!state.groups.some((group) => group.territoryIds.length > 0)) return null;

  const changeAxis = (comparisonAxis: ComparisonAxis) => {
    onDraftChange({ comparisonAxis, objective: null });
  };

  return (
    <section className="space-y-4" aria-labelledby="map-question-heading">
      <header className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
          Sua pergunta vem primeiro
        </p>
        <h2 id="map-question-heading" className="mt-1 font-sans text-xl font-bold text-text">
          O que você quer descobrir?
        </h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-text">{question}</p>
      </header>

      <div>
        <p className="mb-2 font-sans text-xs font-bold text-text">Qual é a comparação principal?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Eixo principal da pergunta">
          {AXES.map((axis) => (
            <button
              key={axis.value}
              type="button"
              aria-label={axis.label}
              aria-pressed={draft.comparisonAxis === axis.value}
              onClick={() => changeAxis(axis.value)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                draft.comparisonAxis === axis.value
                  ? 'border-accent/60 bg-accent/10 text-text'
                  : 'border-border bg-elevated/50 text-text-muted hover:border-accent-border',
              )}
            >
              <span className="block font-sans text-xs font-bold">{axis.label}</span>
              <span className="mt-0.5 block font-sans text-[10px] leading-snug">{axis.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {draft.comparisonAxis === 'place' && state.groups.filter((g) => g.territoryIds.length > 0).length < 2 ? (
        <button
          type="button"
          onClick={() => dispatch({ type: 'CREATE_GROUP', name: 'Comparador' })}
          className="w-full rounded-xl border border-dashed border-accent/45 bg-accent/5 px-3 py-3 font-sans text-sm font-bold text-accent"
        >
          Adicionar comparador no mapa
        </button>
      ) : null}

      {draft.comparisonAxis === 'period' && state.periodScope !== 'per-group' ? (
        <button
          type="button"
          onClick={() => dispatch({ type: 'PREPARE_PERIOD_COMPARE' })}
          className="w-full rounded-xl border border-dashed border-accent/45 bg-accent/5 px-3 py-3 font-sans text-sm font-bold text-accent"
        >
          Preparar dois períodos
        </button>
      ) : null}

      {(draft.comparisonAxis === 'disease' || draft.comparisonAxis === 'exposure') ? (
        <p role="status" className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 font-sans text-xs leading-relaxed text-text-muted">
          {draft.comparisonAxis === 'disease'
            ? 'Hoje as doenças são combinadas antes da análise. Esta opção estrutura a pergunta, mas nenhum objetivo é liberado até que os dados possam ser mostrados lado a lado sem somá-los.'
            : 'Uma exposição precisa estar realmente carregável e ligada ao território e ao período. Enquanto isso não for comprovado, nenhum objetivo é liberado.'}
        </p>
      ) : null}

      <SharedDiseasePanel
        selectedVariableIds={selectedVariableIds}
        dispatch={dispatch}
        open={openPanel === 'disease'}
        onOpenChange={(open) => setOpenPanel(open ? 'disease' : null)}
      />
      <SharedPeriodPanel
        state={state}
        dispatch={dispatch}
        diseaseVariableIds={selectedVariableIds}
        activeGroup={activeGroup}
        open={openPanel === 'period'}
        onOpenChange={(open) => setOpenPanel(open ? 'period' : null)}
      />

      <div>
        <p className="mb-2 font-sans text-xs font-bold text-text">O que deseja fazer?</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Objetivo da pergunta">
          {OBJECTIVES.map((objective) => {
            const disabled = objectiveDisabled(draft.comparisonAxis, objective.value);
            return (
              <button
                key={objective.value}
                type="button"
                disabled={disabled}
                aria-pressed={draft.objective === objective.value}
                title={disabled ? objectiveDisabledReason(draft.comparisonAxis) : undefined}
                onClick={() => onDraftChange({ ...draft, objective: objective.value })}
                className={cn(
                  'rounded-xl border px-2 py-2.5 font-sans text-xs font-bold transition-colors',
                  draft.objective === objective.value
                    ? 'border-accent/60 bg-accent/10 text-accent'
                    : 'border-border bg-elevated/50 text-text-muted',
                  disabled && 'cursor-not-allowed opacity-45',
                )}
              >
                {objective.label}
              </button>
            );
          })}
        </div>
      </div>

      {!validation.safeToStart && draft.objective ? (
        <ul className="space-y-1 rounded-xl border border-border bg-elevated/35 px-3 py-2" aria-label="O que falta na pergunta">
          {validation.reasons.map((reason) => (
            <li key={reason} className="font-sans text-xs leading-relaxed text-text-muted">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
