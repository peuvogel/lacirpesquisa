import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCatalogVariableById } from '@/features/catalog/catalogAnalysisData';
import { ALIASES, labelMatchesQuery, matchDiseases } from '@/features/catalog/diseaseAliases';
import {
  DISEASES,
  MEASURES,
  PLACE_CONTEXT_VARIABLES,
  catalogIdFor,
  parseCatalogId,
  type DiseaseDef,
  type PlaceContextVariableDef,
} from '@/features/catalog/taxonomy';

export interface MeasureDiseasePickerProps {
  selectedVariableIds: string[];
  onToggleVariable?: (variableId: string) => void;
  /**
   * When set (typically with diseasesOnly), disease checkboxes call this once
   * instead of toggling individual measure catalog ids — use for shared/global disease.
   */
  onToggleDisease?: (diseaseId: string) => void;
  /** Show only the disease list (step 2 of research flow). */
  diseasesOnly?: boolean;
  /** Show disease measures + place/period context vars (step 4). */
  measuresOnly?: boolean;
  /** Map question flow: keep selected rows visible and show only a short suggestion set until search. */
  searchFirst?: boolean;
  className?: string;
}

/** Precomputed once — avoids O(diseases × measures) work on every render. */
const FIRST_LOADABLE_MEASURE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const disease of DISEASES) {
    for (const measure of MEASURES) {
      const id = catalogIdFor(measure.id, disease.id);
      if (getCatalogVariableById(id)?.loadable) {
        map.set(disease.id, measure.id);
        break;
      }
    }
  }
  return map;
})();

function preferredMeasureId(diseaseId: string): string {
  return FIRST_LOADABLE_MEASURE.get(diseaseId) ?? 'internacoes';
}

function normalizeCidQuery(q: string): string {
  return q.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
}

function diseaseMatches(disease: DiseaseDef, q: string): boolean {
  const lower = q.toLowerCase();
  if (labelMatchesQuery(disease.label, q) || disease.id.includes(lower)) return true;
  if (!disease.cid) return false;
  const cidNorm = normalizeCidQuery(disease.cid);
  const qNorm = normalizeCidQuery(q);
  return cidNorm.includes(qNorm) || (qNorm.length >= 2 && cidNorm.startsWith(qNorm));
}

/** Result of one query's search — the pool to render plus alias provenance for the D-18 strip. */
interface DiseaseSearchResult {
  pool: readonly DiseaseDef[];
  /** Normalized alias term that fired, or null when no curated entry matched (D-18/D-19). */
  aliasTerm: string | null;
  /** How many categories the fired alias resolved to (0 when aliasTerm is null). */
  aliasCategoryCount: number;
  /** The exact categories the curated alias resolved to (for the singular-case strip copy). */
  aliasDiseases: readonly DiseaseDef[];
}

/**
 * Research flow pieces: disease first, then variables (disease measures + place context).
 * Full Lista Morb is listed; packs on site are optional — selection still opens the flow.
 */
export function MeasureDiseasePicker({
  selectedVariableIds,
  onToggleVariable,
  onToggleDisease,
  diseasesOnly = false,
  measuresOnly = false,
  searchFirst = false,
  className,
}: MeasureDiseasePickerProps) {
  const [query, setQuery] = useState('');

  const selectedPairs = useMemo(() => {
    return selectedVariableIds
      .map((id) => parseCatalogId(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [selectedVariableIds]);

  const selectedDiseaseIds = useMemo(
    () => [...new Set(selectedPairs.map((p) => p.diseaseId))],
    [selectedPairs],
  );

  const selectedDiseaseSet = useMemo(
    () => new Set(selectedDiseaseIds),
    [selectedDiseaseIds],
  );

  // Apelido calculado uma vez por query (nao por agravo, T-08-09-05): `matchDiseases` roda
  // aqui dentro, nunca dentro de um `.filter` sobre DISEASES.
  const searchResult = useMemo<DiseaseSearchResult>(() => {
    const q = query.trim();
    if (!q) {
      return { pool: DISEASES, aliasTerm: null, aliasCategoryCount: 0, aliasDiseases: [] };
    }
    const byLabelOrId = DISEASES.filter((d) => diseaseMatches(d, q));
    const aliasMatch = matchDiseases(DISEASES, q, ALIASES);
    const merged = new Map<string, DiseaseDef>();
    for (const d of byLabelOrId) merged.set(d.id, d);
    for (const d of aliasMatch.diseases) merged.set(d.id, d);
    return {
      pool: [...merged.values()],
      aliasTerm: aliasMatch.aliasTerm,
      aliasCategoryCount: aliasMatch.aliasCategoryCount,
      aliasDiseases: aliasMatch.diseases,
    };
  }, [query]);

  const visibleDiseases = useMemo(() => {
    const { pool } = searchResult;
    // A seleção é contexto da pergunta, não resultado da busca: mantenha-a
    // visível mesmo quando o termo atual só encontra outras doenças.
    const selected = DISEASES.filter((d) => selectedDiseaseSet.has(d.id));
    const rest = pool.filter((d) => !selectedDiseaseSet.has(d.id));
    // Pack-backed diseases first so period years resolve without hunting.
    const withPack = rest.filter((d) => FIRST_LOADABLE_MEASURE.has(d.id));
    const withoutPack = rest.filter((d) => !FIRST_LOADABLE_MEASURE.has(d.id));
    const ordered = [...selected, ...withPack, ...withoutPack];
    if (!searchFirst || query.trim()) return ordered;
    const selectedIds = new Set(selected.map((disease) => disease.id));
    const suggestions = ordered.filter((disease) => !selectedIds.has(disease.id)).slice(0, 8);
    return [...selected, ...suggestions];
  }, [query, searchFirst, searchResult, selectedDiseaseSet]);

  const toggleDisease = (diseaseId: string) => {
    if (onToggleDisease) {
      onToggleDisease(diseaseId);
      return;
    }
    if (!onToggleVariable) return;
    const existing = selectedVariableIds.filter(
      (id) => parseCatalogId(id)?.diseaseId === diseaseId,
    );
    if (existing.length > 0) {
      for (const id of existing) onToggleVariable(id);
      return;
    }
    onToggleVariable(catalogIdFor(preferredMeasureId(diseaseId), diseaseId));
  };

  if (measuresOnly) {
    const periodVars = PLACE_CONTEXT_VARIABLES.filter((v) => v.kind === 'periodo');
    const placeVars = PLACE_CONTEXT_VARIABLES.filter((v) => v.kind === 'lugar');

    function renderPlaceContextList(
      vars: readonly PlaceContextVariableDef[],
      availableHint: string,
    ) {
      return (
        <ul className="space-y-1.5" role="list">
          {vars.map((variable) => {
            const entry = getCatalogVariableById(variable.id);
            const loadable = Boolean(entry?.loadable);
            const checked = selectedVariableIds.includes(variable.id);
            const hint = loadable
              ? availableHint
              : `Por quê: ${variable.unavailableReason} Você pode selecionar mesmo assim — a análise abre e os dados podem vir de scrape/cola depois.`;
            return (
              <li key={variable.id} className="list-none">
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                    checked
                      ? 'border-[color-mix(in_srgb,var(--lacir-group-accent,var(--color-accent))_55%,transparent)] bg-[color-mix(in_srgb,var(--lacir-group-accent,var(--color-accent))_16%,transparent)]'
                      : 'border-border/70 bg-elevated/40 hover:border-accent-border hover:bg-elevated/70',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleVariable?.(variable.id)}
                    className="mt-0.5 size-3.5 shrink-0 accent-[var(--lacir-group-accent,var(--color-accent))]"
                    aria-label={variable.label}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-sans text-sm font-medium text-text">
                      {variable.label}
                    </span>
                    <span className="mt-1 block font-sans text-[11px] leading-snug text-text-muted">
                      {hint}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <div className={cn('space-y-4', className)} aria-label="Variáveis">
        <div>
          <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Da doença
          </p>
          <div className="flex flex-wrap gap-2">
            {MEASURES.map((measure) => {
              const ids = selectedDiseaseIds.map((diseaseId) =>
                catalogIdFor(measure.id, diseaseId),
              );
              const anyChecked = ids.some((id) => selectedVariableIds.includes(id));
              return (
                <button
                  key={measure.id}
                  type="button"
                  disabled={selectedDiseaseIds.length === 0}
                  onClick={() => {
                    for (const id of ids) {
                      const checked = selectedVariableIds.includes(id);
                      if (anyChecked === checked) onToggleVariable?.(id);
                    }
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 font-sans text-xs font-bold tracking-wide transition-colors',
                    anyChecked
                      ? 'border-[var(--lacir-group-accent,var(--color-accent))] bg-[color-mix(in_srgb,var(--lacir-group-accent,var(--color-accent))_18%,transparent)] text-[var(--lacir-group-accent,var(--color-accent))]'
                      : 'border-border bg-elevated text-text-muted hover:border-accent-border hover:text-text',
                    selectedDiseaseIds.length === 0 && 'opacity-50',
                  )}
                >
                  {measure.shortLabel}
                </button>
              );
            })}
          </div>
          {selectedDiseaseIds.length === 0 ? (
            <p className="mt-2 font-sans text-xs text-text-muted">
              Escolha uma doença acima primeiro.
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Do período (denominadores)
          </p>
          <p className="mb-2 font-sans text-[11px] text-text-muted">
            População e séries temporais do território no intervalo escolhido.
          </p>
          {renderPlaceContextList(
            periodVars,
            'Disponível no pack — entra na análise ao revisar.',
          )}
        </div>

        <div>
          <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Do lugar (oferta e contexto)
          </p>
          <p className="mb-2 font-sans text-[11px] text-text-muted">
            Capacidade, RH e indicadores do território. Indisponíveis no site ainda podem ser
            marcadas.
          </p>
          {renderPlaceContextList(
            placeVars,
            'Disponível no pack — entra na análise ao revisar.',
          )}
        </div>
      </div>
    );
  }

  const q = query.trim();
  return (
    <div className={cn('space-y-4', className)} aria-label="Doença e agravo">
      <div>
        <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
          Doença / agravo (CID-10 · {DISEASES.length})
        </p>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome ou CID (ex.: I74, C00)…"
          aria-label="Buscar doença"
          className="mb-2 w-full rounded-lg border border-border bg-elevated px-3 py-2 font-sans text-sm text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="mb-2 font-sans text-[11px] text-text-muted">
          {q
            ? `${visibleDiseases.length} resultado(s)`
            : searchFirst
              ? `${visibleDiseases.length} sugestão(ões) · digite para buscar entre ${DISEASES.length} categorias`
              : `${DISEASES.length} categorias · busque pelo nome ou pelo CID-10`}
        </p>
        {searchResult.aliasTerm ? (
          <p
            role="status"
            className="mb-2 rounded-lg border border-accent-border/60 bg-elevated/60 px-2.5 py-2 font-sans text-[11px] text-text-muted"
          >
            {searchResult.aliasCategoryCount === 1
              ? `${searchResult.aliasTerm.toUpperCase()} corresponde a 1 categoria da Lista Morb CID-10 — ${searchResult.aliasDiseases[0]?.label ?? ''}.`
              : `${searchResult.aliasTerm.toUpperCase()} corresponde a ${searchResult.aliasCategoryCount} categorias da Lista Morb CID-10 — selecione as que quiser comparar ou somar.`}
          </p>
        ) : null}
        <ul
          className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 bg-surface/40 p-1"
          role="list"
        >
          {visibleDiseases.map((disease) => {
            const checked = selectedDiseaseSet.has(disease.id);
            const cidLabel =
              disease.cid ??
              (disease.filterKind === 'procedimento' ? 'Procedimento' : null);
            return (
              <li key={disease.id} className="list-none">
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated/80',
                    checked &&
                      'bg-[color-mix(in_srgb,var(--lacir-group-accent,var(--color-accent))_16%,transparent)]',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDisease(disease.id)}
                    className="mt-1 size-3.5 shrink-0 accent-[var(--lacir-group-accent,var(--color-accent))]"
                    aria-label={
                      cidLabel ? `${disease.label} (${cidLabel})` : disease.label
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {cidLabel ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 font-mono text-[10px] font-bold tracking-wide"
                        >
                          {cidLabel}
                        </Badge>
                      ) : null}
                      <span className="font-sans text-sm font-medium text-text">
                        {disease.label}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {!diseasesOnly ? (
        <MeasureDiseasePicker
          selectedVariableIds={selectedVariableIds}
          onToggleVariable={onToggleVariable}
          measuresOnly
        />
      ) : null}

      <p className="font-sans text-xs text-text-muted" data-testid="variable-provenance-footnote">
        Fluxo: lugar → doença → período → variáveis. Packs SIH versionados — sem TABNET na aula.
      </p>
    </div>
  );
}
