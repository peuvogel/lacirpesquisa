import { useCallback, useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { findUfBySiglaOrCode } from '@/geo/territoryCatalog';
import type { TerritoryRef } from '@/geo/types';
import { GroupChip } from './GroupChip';
import { PresetRegionPills } from './PresetRegionPills';
import {
  MAX_GROUPS,
  type MapAnalysisAction,
  type MapAnalysisGroup,
  type MapAnalysisState,
} from './mapAnalysisState';

const CREATE_DROP_ID = 'create-group';
const DRAG_PREFIX = 'territory:';

export interface GroupBarProps {
  state: MapAnalysisState;
  dispatch: Dispatch<MapAnalysisAction>;
  ungroupedTerritories: TerritoryRef[];
  onGroupCreated?: (territoryKeys: string[]) => void;
  onHighlightTerritories?: (territories: TerritoryRef[]) => void;
  className?: string;
}

function territoryKey(t: TerritoryRef): string {
  return `${t.level}:${t.ibgeCode}`;
}

function DraggableTerritoryChip({ territory }: { territory: TerritoryRef }) {
  const id = `${DRAG_PREFIX}${territoryKey(territory)}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { territory } });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab rounded-md border border-accent-border bg-accent-soft px-2 py-0.5 font-sans text-xs font-medium text-accent active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      {territory.sigla ?? territory.name}
    </button>
  );
}

function GroupDropZone({
  dropId,
  label,
  ariaLabel,
  isEmpty,
  children,
}: {
  dropId: string;
  label: string;
  ariaLabel: string;
  isEmpty: boolean;
  children?: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dropId });
  const activeClass = isOver ? 'lacir-drop-target--active' : '';

  return (
    <div
      ref={setNodeRef}
      aria-label={ariaLabel}
      aria-dropeffect="move"
      className={cn(
        'flex min-h-12 min-w-[7rem] flex-1 items-center gap-2 rounded-lg border border-dashed border-accent-border bg-surface/60 px-3 py-2 transition-colors',
        activeClass,
        !isEmpty && 'border-solid bg-elevated/80',
      )}
    >
      {children ?? (
        <span className="font-sans text-xs text-text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

export function GroupBar({
  state,
  dispatch,
  ungroupedTerritories,
  onGroupCreated,
  onHighlightTerritories,
  className,
}: GroupBarProps) {
  const [activeTerritory, setActiveTerritory] = useState<TerritoryRef | null>(null);
  const canCreateGroup = ungroupedTerritories.length > 0 && state.groups.length < MAX_GROUPS;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const emptySlotNumber = state.groups.length + 1;

  const mergeOrCreate = useCallback(
    (territories: TerritoryRef[], targetGroupId?: string) => {
      if (territories.length === 0) return;

      if (targetGroupId) {
        dispatch({ type: 'MERGE_TERRITORIES_TO_GROUP', groupId: targetGroupId, territories });
      } else if (state.groups.length < MAX_GROUPS) {
        dispatch({ type: 'CREATE_GROUP', territories });
      }
      onGroupCreated?.(territories.map(territoryKey));
    },
    [dispatch, onGroupCreated, state.groups.length],
  );

  const handleCreateFromSelection = useCallback(() => {
    if (!canCreateGroup) return;
    mergeOrCreate(ungroupedTerritories);
  }, [canCreateGroup, mergeOrCreate, ungroupedTerritories]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const territory = event.active.data.current?.territory as TerritoryRef | undefined;
    setActiveTerritory(territory ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTerritory(null);
      const territory = event.active.data.current?.territory as TerritoryRef | undefined;
      if (!territory || !event.over) return;

      const overId = String(event.over.id);
      if (overId === CREATE_DROP_ID) {
        mergeOrCreate([territory]);
        return;
      }

      if (overId.startsWith('group:')) {
        const groupId = overId.slice('group:'.length);
        mergeOrCreate([territory], groupId);
      }
    },
    [mergeOrCreate],
  );

  const handleApplyPreset = useCallback(
    (territories: TerritoryRef[], label: string) => {
      if (state.groups.length >= MAX_GROUPS) return;
      dispatch({ type: 'CREATE_GROUP', name: label, territories });
      onGroupCreated?.(territories.filter((t) => t.level === 'uf' && t.sigla).map((t) => t.sigla!));
    },
    [dispatch, onGroupCreated, state.groups.length],
  );

  const groupDropZones = useMemo(
    () =>
      state.groups.map((group, index) => (
        <GroupDropZone
          key={group.id}
          dropId={`group:${group.id}`}
          ariaLabel={`${group.name}, solte estados selecionados aqui`}
          label={`Grupo ${index + 1}`}
          isEmpty={group.territoryIds.length === 0}
        >
          <GroupChip
            group={group}
            index={index}
            isActive={state.activeGroupId === group.id}
            onSelect={(groupId) => dispatch({ type: 'SET_ACTIVE_GROUP', groupId })}
            onRename={(groupId, name) => dispatch({ type: 'RENAME_GROUP', groupId, name })}
            onDelete={(groupId) => dispatch({ type: 'DELETE_GROUP', groupId })}
          />
        </GroupDropZone>
      )),
    [dispatch, state.activeGroupId, state.groups],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section
        aria-label="Barra de grupos"
        className={cn(
          'sticky top-0 z-10 space-y-3 rounded-xl border border-border bg-surface p-4',
          className,
        )}
      >
        <PresetRegionPills
          disabled={state.groups.length >= MAX_GROUPS}
          onApplyPreset={handleApplyPreset}
          onHighlightPreset={onHighlightTerritories}
        />

        <div className="flex flex-wrap items-center gap-2">
          {groupDropZones}

          {state.groups.length < MAX_GROUPS ? (
            <GroupDropZone
              dropId={CREATE_DROP_ID}
              ariaLabel={`Grupo ${emptySlotNumber}, solte estados selecionados aqui`}
              label={`Grupo ${emptySlotNumber}`}
              isEmpty
            />
          ) : null}

          <Button
            type="button"
            size="sm"
            disabled={!canCreateGroup}
            onClick={handleCreateFromSelection}
          >
            Criar grupo com seleção
          </Button>
        </div>

        {ungroupedTerritories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Estados selecionados para arrastar">
            <span className="font-sans text-xs text-text-muted">Arraste:</span>
            {ungroupedTerritories.map((territory) => (
              <DraggableTerritoryChip key={territoryKey(territory)} territory={territory} />
            ))}
          </div>
        ) : null}
      </section>

      <DragOverlay>
        {activeTerritory ? (
          <span className="rounded-md border border-accent bg-accent-soft px-2 py-0.5 font-sans text-xs font-bold text-accent shadow-lg">
            {activeTerritory.sigla ?? activeTerritory.name}
          </span>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function buildUngroupedTerritories(
  selectedSiglas: string[],
  groups: MapAnalysisGroup[],
): TerritoryRef[] {
  const groupedSiglas = new Set<string>();
  for (const group of groups) {
    for (const t of group.territoryIds) {
      if (t.level === 'uf' && t.sigla) groupedSiglas.add(t.sigla);
    }
  }

  return selectedSiglas
    .filter((sigla) => !groupedSiglas.has(sigla))
    .map((sigla) => {
      const uf = findUfBySiglaOrCode(sigla);
      return {
        level: 'uf' as const,
        ibgeCode: uf?.ibgeCode ?? sigla,
        sigla,
        name: uf?.name ?? sigla,
      };
    });
}
