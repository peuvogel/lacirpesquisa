import { Check, Plus, Trash2, X } from 'lucide-react';
import type { TerritoryRef } from '@/geo/types';
import { cn } from '@/lib/utils';

export interface TerritoryDraftBarProps {
  territories: TerritoryRef[];
  nextGroupNumber: number;
  onCreateGroup: () => void;
  onClear: () => void;
  onRemove: (territory: TerritoryRef) => void;
  editingGroupName?: string;
  onCancelEdit?: () => void;
  className?: string;
}

function territoryLabel(territory: TerritoryRef): string {
  return territory.name || territory.sigla || territory.ibgeCode;
}

export function TerritoryDraftBar({
  territories,
  nextGroupNumber,
  onCreateGroup,
  onClear,
  onRemove,
  editingGroupName,
  onCancelEdit,
  className,
}: TerritoryDraftBarProps) {
  const count = territories.length;
  const countLabel = count === 1 ? '1 território selecionado' : `${count} territórios selecionados`;

  return (
    <section
      aria-label="Seleção territorial atual"
      className={cn(
        'rounded-2xl border border-dashed border-accent/45 bg-accent-soft/25 p-3 shadow-[inset_0_0_0_1px_rgba(32,153,120,0.05)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] font-black uppercase tracking-[0.16em] text-accent">
            {editingGroupName
              ? `Editando territórios · ${editingGroupName}`
              : `Seleção atual · futuro Grupo ${nextGroupNumber}`}
          </p>
          <p className="mt-1 font-sans text-sm font-bold text-text">{countLabel}</p>
          <p className="mt-0.5 max-w-2xl font-sans text-xs leading-relaxed text-text-muted">
            {count === 0
              ? 'Clique nos estados ou municípios no mapa. Nada muda até você confirmar.'
              : editingGroupName
                ? 'Ajuste a composição no mapa e salve para atualizar somente este grupo.'
                : 'Revise os territórios e confirme para delimitar este grupo.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editingGroupName && onCancelEdit ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex h-9 items-center rounded-lg border border-white/12 bg-elevated/60 px-3 font-sans text-xs font-bold text-text-muted transition-colors hover:border-white/25 hover:text-text"
            >
              Cancelar
            </button>
          ) : null}
          {count > 0 ? (
            <button
              type="button"
              aria-label="Limpar seleção"
              onClick={onClear}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/12 bg-elevated/60 px-3 font-sans text-xs font-bold text-text-muted transition-colors hover:border-danger/40 hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Limpar
            </button>
          ) : null}
          <button
            type="button"
            disabled={count === 0}
            onClick={onCreateGroup}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 font-sans text-xs font-black text-white shadow-[0_8px_24px_rgba(32,153,120,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editingGroupName ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Plus className="size-3.5" aria-hidden />
            )}
            {editingGroupName
              ? `Salvar territórios do ${editingGroupName}`
              : `Criar Grupo ${nextGroupNumber}`}
          </button>
        </div>
      </div>

      {count > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Territórios ainda não confirmados">
          {territories.map((territory) => {
            const label = territoryLabel(territory);
            return (
              <li
                key={`${territory.level}:${territory.ibgeCode}`}
                className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 py-1 pl-2.5 pr-1 font-sans text-xs font-bold text-text"
              >
                <span>{label}</span>
                <button
                  type="button"
                  aria-label={`Remover ${label}`}
                  onClick={() => onRemove(territory)}
                  className="grid size-6 place-items-center rounded-full text-text-muted transition hover:bg-danger/15 hover:text-danger"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
