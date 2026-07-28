import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { groupColor } from './groupPalette';
import type { MapAnalysisGroup } from './mapAnalysisState';

const MAX_NAME_LENGTH = 40;

export interface GroupChipProps {
  group: MapAnalysisGroup;
  index: number;
  isActive: boolean;
  onSelect: (groupId: string) => void;
  onRename: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
}

export function GroupChip({
  group,
  index,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: GroupChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = groupColor(index);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitRename = useCallback(() => {
    const trimmed = draftName.trim().slice(0, MAX_NAME_LENGTH);
    if (trimmed && trimmed !== group.name) {
      onRename(group.id, trimmed);
    } else {
      setDraftName(group.name);
    }
    setIsEditing(false);
  }, [draftName, group.id, group.name, onRename]);

  const cancelRename = useCallback(() => {
    setDraftName(group.name);
    setIsEditing(false);
  }, [group.name]);

  return (
    <>
      <div
        role="tab"
        aria-selected={isActive}
        tabIndex={0}
        onClick={() => onSelect(group.id)}
        onDoubleClick={() => setIsEditing(true)}
        onKeyDown={(event) => {
          if (event.key === 'F2') {
            event.preventDefault();
            setIsEditing(true);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(group.id);
          }
        }}
        className={cn(
          'group/chip inline-flex h-9 max-w-[14rem] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-sans text-xs font-semibold tracking-tight transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out',
          'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35',
          isActive && 'ring-2 ring-white/25',
        )}
        style={
          {
            ['--lacir-chip-glow']: accent.glow,
            borderColor: isActive ? accent.stroke : `${accent.stroke}99`,
            color: accent.stroke,
            backgroundColor: isActive ? `${accent.stroke}33` : `${accent.stroke}18`,
            boxShadow: isActive
              ? `0 0 16px ${accent.glow}`
              : '0 0 0 0 transparent',
          } as CSSProperties
        }
        onMouseEnter={(event) => {
          const el = event.currentTarget;
          el.style.backgroundColor = `${accent.stroke}40`;
          el.style.boxShadow = `0 0 18px ${accent.glow}`;
          el.style.borderColor = accent.stroke;
        }}
        onMouseLeave={(event) => {
          const el = event.currentTarget;
          el.style.backgroundColor = isActive ? `${accent.stroke}33` : `${accent.stroke}18`;
          el.style.boxShadow = isActive ? `0 0 16px ${accent.glow}` : '0 0 0 0 transparent';
          el.style.borderColor = isActive ? accent.stroke : `${accent.stroke}99`;
        }}
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent.stroke }}
          aria-hidden
        />

        {isEditing ? (
          <input
            ref={inputRef}
            value={draftName}
            maxLength={MAX_NAME_LENGTH}
            aria-label={`Renomear ${group.name}`}
            className="min-w-[4rem] max-w-[9rem] rounded-full border border-white/15 bg-bg/80 px-2 py-0.5 font-sans text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <>
            <span className="truncate">{group.name || `Grupo ${index + 1}`}</span>
            {group.territoryIds.length > 0 ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums"
                style={{
                  backgroundColor: `${accent.stroke}28`,
                  color: accent.stroke,
                }}
              >
                {group.territoryIds.length}
              </span>
            ) : null}
          </>
        )}

        {!isEditing ? (
          <span className="ml-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/chip:opacity-100 group-focus-within/chip:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Renomear ${group.name}`}
              className="size-6 rounded-full text-inherit hover:bg-black/15"
              onClick={(event) => {
                event.stopPropagation();
                setIsEditing(true);
              }}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Excluir ${group.name}`}
              className="size-6 rounded-full text-inherit hover:bg-black/15"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmDelete(true);
              }}
            >
              <X className="size-3" />
            </Button>
          </span>
        ) : null}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir grupo</DialogTitle>
            <DialogDescription>
              Excluir {group.name}? Os estados voltam para seleção livre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDelete(group.id);
                setConfirmDelete(false);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
