import { forwardRef, useState, type CSSProperties, type Dispatch } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion, useReducedMotion } from 'motion/react';
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

export const CREATE_DROP_ID = 'create-group';
export const GROUP_DROP_PREFIX = 'group:';

export interface MapGroupStripProps {
  state: MapAnalysisState;
  dispatch: Dispatch<MapAnalysisAction>;
  className?: string;
  /** When set, the CTA creates a group from the current map selection. */
  onCreateFromSelection?: () => void;
  /** Called when the empty “Grupo N” badge is clicked with no selection. */
  onRequestMapSelect?: () => void;
  /** Apply a didactic multi-group preset (replaces current groups). */
  onApplySelectionPreset?: (presetId: GroupSelectionPresetId) => void;
  selectionCount?: number;
}

function DropSlot({
  dropId,
  ariaLabel,
  children,
  className,
}: {
  dropId: string;
  ariaLabel: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dropId });
  const filled = Boolean(children);
  return (
    <div
      ref={setNodeRef}
      aria-label={ariaLabel}
      className={cn(
        'flex items-center transition-[transform,box-shadow] duration-150',
        // Empty slot: dashed pill. Filled: no second chrome — chip is the badge.
        filled
          ? 'rounded-full'
          : 'min-h-10 min-w-[6.5rem] rounded-full border border-dashed border-accent-border/80 bg-surface/40 px-2 py-1',
        isOver && 'lacir-drop-target--active scale-[1.03]',
        className,
      )}
    >
      {children}
    </div>
  );
}

function AddGroupButton({
  canCreate,
  selectionCount,
  nextIndex,
  isFirst,
  onCreate,
  onRequestMapSelect,
  pendingGroupIndex,
}: {
  canCreate: boolean;
  selectionCount: number;
  nextIndex: number;
  isFirst: boolean;
  onCreate?: () => void;
  onRequestMapSelect?: () => void;
  pendingGroupIndex: number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: CREATE_DROP_ID });
  const reduceMotion = useReducedMotion();
  const ready = canCreate && Boolean(onCreate);
  const accent = groupColor(pendingGroupIndex).stroke;
  const title = isFirst ? 'Novo grupo' : `Grupo ${nextIndex}`;

  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      onClick={() => {
        if (ready) {
          onCreate?.();
          return;
        }
        onRequestMapSelect?.();
      }}
      aria-label={
        ready
          ? `Adicionar grupo ${nextIndex} com ${selectionCount} território(s)`
          : `${title}: selecione estados ou municípios no mapa`
      }
      title={
        ready
          ? 'Clique para criar o grupo — depois configure doença e período no painel'
          : 'Clique para destacar o mapa e selecionar territórios'
      }
      whileHover={reduceMotion ? undefined : { scale: 1.05, y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      style={
        {
          borderColor: ready ? `${accent}cc` : `${accent}66`,
          color: accent,
          backgroundColor: ready ? `${accent}28` : `${accent}14`,
          boxShadow: ready ? `0 0 20px ${accent}55` : `0 0 0 0 transparent`,
          ['--lacir-group-accent']: accent,
        } as CSSProperties
      }
      className={cn(
        'group relative flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-left transition-[border-color,background,box-shadow,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lacir-group-accent)]',
        ready ? 'lacir-add-group-cta--ready' : 'lacir-add-group-cta--idle border-dashed',
        isOver && ready && 'lacir-drop-target--active scale-[1.03]',
      )}
      onMouseEnter={(event) => {
        const el = event.currentTarget;
        el.style.backgroundColor = accent;
        el.style.color = '#04120c';
        el.style.borderColor = accent;
        el.style.boxShadow = `0 0 28px ${accent}80`;
      }}
      onMouseLeave={(event) => {
        const el = event.currentTarget;
        el.style.backgroundColor = ready ? `${accent}28` : `${accent}14`;
        el.style.color = accent;
        el.style.borderColor = ready ? `${accent}cc` : `${accent}66`;
        el.style.boxShadow = ready ? `0 0 20px ${accent}55` : '0 0 0 0 transparent';
      }}
    >
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black/15 text-sm font-bold transition-transform duration-200 group-hover:scale-110"
        aria-hidden
      >
        +
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[12px] font-bold tracking-tight transition-colors">
          {ready ? 'Adicionar grupo' : title}
        </span>
        <span className="text-[10px] font-medium opacity-80 transition-colors group-hover:opacity-90">
          {ready
            ? `${selectionCount} selecionado${selectionCount === 1 ? '' : 's'} · clique ou solte`
            : 'Selecione no mapa'}
        </span>
      </span>
    </motion.button>
  );
}

function GroupPresetMenu({
  onApply,
}: {
  onApply: (presetId: GroupSelectionPresetId) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full border border-white/10 bg-elevated/50 px-2.5 py-1 font-sans text-[10px] font-bold tracking-wide text-text-muted transition-colors hover:border-white/20 hover:bg-elevated hover:text-text"
      >
        Presets {open ? '▴' : '▾'}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Presets de grupos"
          className="absolute left-0 top-full z-30 mt-1.5 w-[15.5rem] rounded-xl border border-white/12 bg-elevated/98 p-1.5 shadow-xl backdrop-blur-md"
        >
          <p className="px-2 pb-1 pt-0.5 font-sans text-[10px] text-text-muted">
            Substitui os grupos atuais
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

/**
 * Group chips inside the map chrome. Drop targets for UF shapes dragged from the map.
 */
export const MapGroupStrip = forwardRef<HTMLDivElement, MapGroupStripProps>(
  function MapGroupStrip(
    {
      state,
      dispatch,
      className,
      onCreateFromSelection,
      onRequestMapSelect,
      onApplySelectionPreset,
      selectionCount = 0,
    },
    ref,
  ) {
    const reduceMotion = useReducedMotion();
    const nextIndex = state.groups.length + 1;
    const canCreate =
      selectionCount > 0 &&
      Boolean(onCreateFromSelection) &&
      state.groups.length < MAX_GROUPS;

    return (
      <motion.div
        ref={ref}
        aria-label="Grupos de análise"
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        className={cn(
          'flex flex-wrap items-center gap-2 border-b border-white/8 bg-surface/40 px-3 py-2.5',
          className,
        )}
      >
        <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
          Grupos
        </span>

        {onApplySelectionPreset ? (
          <GroupPresetMenu onApply={onApplySelectionPreset} />
        ) : null}

        {state.groups.map((group, index) => (
          <DropSlot
            key={group.id}
            dropId={`${GROUP_DROP_PREFIX}${group.id}`}
            ariaLabel={`${group.name}, solte estados aqui`}
          >
            <GroupChip
              group={group}
              index={index}
              isActive={state.activeGroupId === group.id}
              onSelect={(groupId) => dispatch({ type: 'SET_ACTIVE_GROUP', groupId })}
              onRename={(groupId, name) => dispatch({ type: 'RENAME_GROUP', groupId, name })}
              onDelete={(groupId) => dispatch({ type: 'DELETE_GROUP', groupId })}
            />
          </DropSlot>
        ))}

        {state.groups.length < MAX_GROUPS ? (
          <AddGroupButton
            canCreate={canCreate}
            selectionCount={selectionCount}
            nextIndex={nextIndex}
            isFirst={state.groups.length === 0}
            onCreate={onCreateFromSelection}
            onRequestMapSelect={onRequestMapSelect}
            pendingGroupIndex={state.groups.length}
          />
        ) : (
          <span className="font-sans text-[11px] text-text-muted">
            Limite de {MAX_GROUPS} grupos
          </span>
        )}
      </motion.div>
    );
  },
);
