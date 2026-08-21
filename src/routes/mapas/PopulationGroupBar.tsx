import { useState, type CSSProperties, type Dispatch } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GroupChip } from './GroupChip';
import { groupColor } from './groupPalette';
import {
  GROUP_SELECTION_PRESETS,
  type GroupSelectionPresetId,
} from './groupSelectionPresets';
import {
  MAX_GROUPS,
  type MapAnalysisAction,
  type MapAnalysisState,
} from './mapAnalysisState';

export interface PopulationGroupBarProps {
  state: MapAnalysisState;
  dispatch: Dispatch<MapAnalysisAction>;
  onApplySelectionPreset?: (presetId: GroupSelectionPresetId) => void;
  className?: string;
}

function PresetMenu({
  onApply,
}: {
  onApply: (presetId: GroupSelectionPresetId) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full border border-white/10 bg-elevated/50 px-2.5 py-1 font-sans text-[10px] font-bold tracking-wide text-text-muted transition-colors hover:border-white/20 hover:bg-elevated hover:text-text"
      >
        Presets {open ? '▴' : '▾'}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Presets de populações"
          className="absolute left-0 top-full z-30 mt-1.5 w-[15.5rem] rounded-xl border border-white/12 bg-elevated/98 p-1.5 shadow-xl backdrop-blur-md"
        >
          <p className="px-2 pb-1 pt-0.5 font-sans text-[10px] text-text-muted">
            Substitui as populações atuais
          </p>
          {GROUP_SELECTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onApply(preset.id);
                setOpen(false);
              }}
              className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent-soft/70"
            >
              <span className="font-sans text-xs font-bold text-text">{preset.label}</span>
              <span className="font-sans text-[10px] leading-snug text-text-muted">
                {preset.hint}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function comparatorName(state: MapAnalysisState): string {
  const count = state.groups.filter((group) => /^Comparador(?:\s|$)/i.test(group.name)).length;
  return count === 0 ? 'Comparador' : `Comparador ${count + 1}`;
}

export function PopulationGroupBar({
  state,
  dispatch,
  onApplySelectionPreset,
  className,
}: PopulationGroupBarProps) {
  const activeIndex = state.groups.findIndex((group) => group.id === state.activeGroupId);
  const activeGroup = activeIndex >= 0 ? state.groups[activeIndex]! : null;
  const accent = groupColor(Math.max(0, activeIndex));
  const instruction = activeGroup
    ? `Clique no mapa para adicionar à ${activeGroup.name}`
    : 'Clique no mapa para criar a População selecionada';

  return (
    <div
      aria-label="Populações da pergunta"
      className={cn(
        'border-b border-white/8 bg-surface/40 px-3 py-2.5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
          Populações
        </span>

        {onApplySelectionPreset ? <PresetMenu onApply={onApplySelectionPreset} /> : null}

        {state.groups.length > 0 ? (
          <div
            role="tablist"
            aria-label="Populações selecionadas"
            aria-orientation="horizontal"
            className="contents"
          >
            {state.groups.map((group, index) => (
              <GroupChip
                key={group.id}
                group={group}
                index={index}
                isActive={state.activeGroupId === group.id}
                onSelect={(groupId) => dispatch({ type: 'SET_ACTIVE_GROUP', groupId })}
                onRename={(groupId, name) => dispatch({ type: 'RENAME_GROUP', groupId, name })}
                onDelete={(groupId) => dispatch({ type: 'DELETE_GROUP', groupId })}
              />
            ))}
          </div>
        ) : null}

        {state.groups.length > 0 && state.groups.length < MAX_GROUPS ? (
          <button
            type="button"
            onClick={() => dispatch({ type: 'CREATE_GROUP', name: comparatorName(state) })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/20 bg-elevated/40 px-3 font-sans text-xs font-bold text-text-muted transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Plus className="size-3.5" aria-hidden />
            Adicionar comparador
          </button>
        ) : null}
      </div>

      <p
        className="mt-2 flex items-center gap-2 font-sans text-xs font-medium"
        style={{ color: accent.stroke } as CSSProperties}
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent.stroke }}
          aria-hidden
        />
        {instruction}
      </p>
    </div>
  );
}
