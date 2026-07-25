import { useCallback, useEffect, useRef, useState } from 'react';
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
          'group/chip flex min-h-8 items-center gap-1 rounded-md border px-2 py-1 font-sans text-xs font-medium transition-colors',
          isActive
            ? 'border-accent bg-accent-soft text-accent ring-2 ring-accent/30'
            : 'border-accent-border bg-elevated text-text hover:bg-accent-soft/40',
        )}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={draftName}
            maxLength={MAX_NAME_LENGTH}
            aria-label={`Renomear ${group.name}`}
            className="min-w-[4rem] rounded-sm border border-accent-border bg-bg px-1 py-0 font-sans text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            <span>{group.name || `Grupo ${index + 1}`}</span>
            <span className="text-text-muted">({group.territoryIds.length})</span>
          </>
        )}
        {!isEditing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Renomear ${group.name}`}
              className="size-6 opacity-0 group-hover/chip:opacity-100 group-focus-within/chip:opacity-100"
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
              className="size-6 opacity-0 group-hover/chip:opacity-100 group-focus-within/chip:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmDelete(true);
              }}
            >
              <X className="size-3" />
            </Button>
          </>
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
