import { useMemo, type CSSProperties, type Dispatch } from 'react';
import { MapPinned } from 'lucide-react';
import type { TerritoryRef } from '@/geo/types';
import { DISEASES, MEASURES, parseCatalogId } from '@/features/catalog/taxonomy';
import { cn } from '@/lib/utils';
import { resolveCatalogYearOptions } from './catalogYearOptions';
import { groupColor } from './groupPalette';
import { MeasureDiseasePicker } from './MeasureDiseasePicker';
import { ResearchAccordionPanel } from './ResearchAccordionPanel';
import { TemporalidadeControl } from './TemporalidadeControl';
import {
  formatTimeSummary,
  preferredCatalogIdForDisease,
  type MapAnalysisAction,
  type MapAnalysisGroup,
  type PeriodScope,
} from './mapAnalysisState';

export interface GroupConfigPanelProps {
  group: MapAnalysisGroup;
  dispatch: Dispatch<MapAnalysisAction>;
  /** Palette index — tints the panel to match the map group color. */
  groupIndex?: number;
  /** Kept only for persisted legacy callers; this panel always edits its own group. */
  periodScope?: PeriodScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTerritories?: () => void;
  pastedVariableIds?: string[];
  className?: string;
}

function shortTerritorySummary(territories: TerritoryRef[]): string {
  if (territories.length === 0) return '';
  const labels = territories.map(
    (territory) => territory.sigla || territory.name || territory.ibgeCode,
  );
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.slice(0, 3).join(', ')} +${labels.length - 3}`;
}

function longTerritorySummary(territories: TerritoryRef[]): string {
  if (territories.length === 0) return 'sem território';
  const labels = territories.map(
    (territory) => territory.name || territory.sigla || territory.ibgeCode,
  );
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} e mais ${labels.length - 2}`;
}

function FieldHeading({ children }: { children: string }) {
  return (
    <h3 className="font-sans text-xs font-black uppercase tracking-[0.12em] text-text">
      {children}
    </h3>
  );
}

export function GroupConfigPanel({
  group,
  dispatch,
  groupIndex = 0,
  open,
  onOpenChange,
  onEditTerritories,
  className,
}: GroupConfigPanelProps) {
  const placeLabel = shortTerritorySummary(group.territoryIds);
  const longPlaceLabel = longTerritorySummary(group.territoryIds);
  const outcomes = useMemo(
    () =>
      group.variableIds
        .map((id) => ({ id, parsed: parseCatalogId(id) }))
        .filter(
          (value): value is { id: string; parsed: NonNullable<ReturnType<typeof parseCatalogId>> } =>
            value.parsed !== null,
        ),
    [group.variableIds],
  );
  const outcome = outcomes[0] ?? null;
  const yearOptions = useMemo(
    () => resolveCatalogYearOptions(outcome ? [outcome.id] : []),
    [outcome],
  );
  const accent = groupColor(groupIndex);
  const periodLabel = formatTimeSummary(group.time) || 'sem período';
  const diseaseLabel = outcome
    ? DISEASES.find((disease) => disease.id === outcome.parsed.diseaseId)?.label ??
      outcome.parsed.diseaseId
    : 'sem doença';
  const measureLabel = outcome
    ? MEASURES.find((measure) => measure.id === outcome.parsed.measureId)?.label ??
      outcome.parsed.measureId
    : 'sem medida';
  const readableSummary = `${longPlaceLabel} · ${diseaseLabel} · ${measureLabel} · ${periodLabel}`;

  const toggleRaw = (variableId: string) => {
    dispatch({ type: 'TOGGLE_GROUP_VARIABLE', groupId: group.id, variableId });
  };

  const handleToggleDisease = (diseaseId: string) => {
    const isOnlySelected =
      outcomes.length > 0 && outcomes.every((value) => value.parsed.diseaseId === diseaseId);
    for (const selected of outcomes) toggleRaw(selected.id);
    if (!isOnlySelected) toggleRaw(preferredCatalogIdForDisease(diseaseId));
  };

  const handleToggleMeasure = (variableId: string) => {
    const parsed = parseCatalogId(variableId);
    if (!parsed) {
      toggleRaw(variableId);
      return;
    }
    const alreadySelected = outcomes.some((selected) => selected.id === variableId);
    for (const selected of outcomes) {
      if (selected.id !== variableId || alreadySelected) toggleRaw(selected.id);
    }
    if (!alreadySelected) toggleRaw(variableId);
  };

  return (
    <ResearchAccordionPanel
      open={open}
      onOpenChange={onOpenChange}
      step={`Configuração independente · Grupo ${groupIndex + 1}`}
      title={group.name}
      subtitle={
        placeLabel
          ? `${group.territoryIds.length} território(s): ${placeLabel}`
          : 'Este grupo ainda não possui territórios.'
      }
      summary={readableSummary}
      className={className}
      style={
        {
          ['--lacir-group-accent']: accent.stroke,
          ['--lacir-group-soft']: accent.fill,
          ['--lacir-group-glow']: accent.glow,
          borderColor: `${accent.stroke}55`,
          boxShadow: `inset 3px 0 0 0 ${accent.stroke}b3, 0 0 28px ${accent.stroke}14`,
          backgroundImage: `linear-gradient(165deg, ${accent.stroke}14 0%, transparent 42%)`,
        } as CSSProperties
      }
      aria-label={`Configuração de ${group.name}`}
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-white/10 bg-elevated/35 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldHeading>Territórios</FieldHeading>
            {onEditTerritories ? (
              <button
                type="button"
                aria-label={`Editar territórios de ${group.name}`}
                onClick={onEditTerritories}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/12 bg-elevated/60 px-2.5 font-sans text-[11px] font-bold text-text-muted transition-colors hover:border-[var(--lacir-group-accent)] hover:text-text"
              >
                <MapPinned className="size-3.5" aria-hidden />
                Editar no mapa
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 font-sans text-sm font-semibold text-text">
            {longPlaceLabel}
          </p>
          <p className="mt-1 font-sans text-xs text-text-muted">
            {group.territoryIds.length === 0
              ? 'Volte ao mapa e crie novamente o grupo com ao menos um território.'
              : `${group.territoryIds.length} unidade(s) delimitada(s) neste grupo.`}
          </p>
        </section>

        <section>
          <FieldHeading>1. Doença ou condição</FieldHeading>
          <p className="mb-2 mt-1 font-sans text-xs text-text-muted">
            A busca e a escolha abaixo afetam somente {group.name}.
          </p>
          <MeasureDiseasePicker
            selectedVariableIds={group.variableIds}
            onToggleDisease={handleToggleDisease}
            diseasesOnly
            searchFirst
          />
        </section>

        <section
          className={cn(!outcome && 'pointer-events-none opacity-45')}
          aria-disabled={!outcome}
        >
          <FieldHeading>2. Medida</FieldHeading>
          <p className="mb-2 mt-1 font-sans text-xs text-text-muted">
            {outcome
              ? `Escolha um único desfecho para ${diseaseLabel}.`
              : 'Disponível depois da escolha da doença.'}
          </p>
          <MeasureDiseasePicker
            selectedVariableIds={group.variableIds}
            onToggleVariable={handleToggleMeasure}
            measuresOnly
            hideContextVariables
          />
        </section>

        <section
          className={cn(!outcome && 'pointer-events-none opacity-45')}
          aria-disabled={!outcome}
        >
          <FieldHeading>3. Período</FieldHeading>
          <p className="mb-2 mt-1 font-sans text-xs text-text-muted">
            O intervalo pertence somente a {group.name} e respeita os anos existentes no catálogo.
          </p>
          {outcome ? (
            <TemporalidadeControl
              time={group.time}
              yearOptions={yearOptions}
              onChange={(time) =>
                dispatch({ type: 'SET_GROUP_TIME', groupId: group.id, time })
              }
            />
          ) : (
            <div className="rounded-xl border border-border/70 bg-elevated/50 p-3 font-sans text-sm text-text-muted">
              Escolha uma doença e uma medida primeiro.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[color-mix(in_srgb,var(--lacir-group-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--lacir-group-accent)_10%,transparent)] p-3">
          <FieldHeading>Resumo do grupo</FieldHeading>
          <p className="mt-2 font-sans text-sm font-bold leading-relaxed text-text">
            {readableSummary}
          </p>
        </section>
      </div>
    </ResearchAccordionPanel>
  );
}
