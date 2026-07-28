import { useMemo, type CSSProperties, type Dispatch } from 'react';
import type { TerritoryRef } from '@/geo/types';
import { parseCatalogId } from '@/features/catalog/taxonomy';
import { getCatalogLabel } from '@/features/catalog/catalogAnalysisData';
import { resolveCatalogYearOptions, isPeriodReady } from './catalogYearOptions';
import { groupColor } from './groupPalette';
import { MeasureDiseasePicker } from './MeasureDiseasePicker';
import { ResearchAccordionPanel } from './ResearchAccordionPanel';
import {
  formatTimeSummary,
  type MapAnalysisAction,
  type MapAnalysisGroup,
  type PeriodScope,
} from './mapAnalysisState';
import { cn } from '@/lib/utils';

export interface GroupConfigPanelProps {
  group: MapAnalysisGroup;
  dispatch: Dispatch<MapAnalysisAction>;
  /** Palette index — tints the panel to match the map group color. */
  groupIndex?: number;
  periodScope?: PeriodScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastedVariableIds?: string[];
  className?: string;
}

function territorySummary(territories: TerritoryRef[]): string {
  const ufs = territories.filter((t) => t.level === 'uf' && t.sigla).map((t) => t.sigla!);
  const munis = territories.filter((t) => t.level === 'municipio');
  const parts: string[] = [];
  if (ufs.length) parts.push(ufs.join(', '));
  if (munis.length === 1) {
    parts.push(munis[0]!.name || munis[0]!.ibgeCode);
  } else if (munis.length === 2) {
    parts.push(munis.map((t) => t.name || t.ibgeCode).join(', '));
  } else if (munis.length > 2) {
    const sample = munis
      .slice(0, 2)
      .map((t) => t.name || t.ibgeCode)
      .join(', ');
    parts.push(`${sample} +${munis.length - 2}`);
  }
  return parts.join(' · ');
}

export function GroupConfigPanel({
  group,
  dispatch,
  groupIndex = 0,
  periodScope = 'shared',
  open,
  onOpenChange,
  className,
}: GroupConfigPanelProps) {
  const placeLabel = territorySummary(group.territoryIds);
  const hasDisease = group.variableIds.some((id) => Boolean(parseCatalogId(id)));
  const yearOptions = useMemo(
    () => resolveCatalogYearOptions(group.variableIds),
    [group.variableIds],
  );
  const timeReady = isPeriodReady(group.time, yearOptions);
  const accent = groupColor(groupIndex);
  const periodLabel = formatTimeSummary(group.time);

  const summary = useMemo(() => {
    const place = placeLabel || 'sem território';
    const vars = group.variableIds.filter((id) => !parseCatalogId(id));
    const measureCount = group.variableIds.filter((id) => Boolean(parseCatalogId(id))).length;
    const varHint =
      measureCount + vars.length > 0
        ? `${measureCount + vars.length} variável(is)`
        : 'sem variáveis';
    return `${place} · ${varHint}`;
  }, [group.variableIds, placeLabel]);

  const handleToggleVariable = (variableId: string) => {
    dispatch({ type: 'TOGGLE_GROUP_VARIABLE', groupId: group.id, variableId });
  };

  return (
    <ResearchAccordionPanel
      open={open}
      onOpenChange={onOpenChange}
      step="3 · Grupo"
      title={group.name}
      subtitle={[
        placeLabel ? `Lugar: ${placeLabel}` : 'Selecione territórios no mapa.',
        hasDisease && periodLabel
          ? `Período: ${periodLabel}${periodScope === 'shared' ? ' · compartilhado' : ' · deste grupo'}`
          : null,
      ]
        .filter(Boolean)
        .join(' ')}
      summary={summary}
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
      <div className="mb-3 flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent.stroke, boxShadow: `0 0 10px ${accent.glow}` }}
          aria-hidden
        />
        <p className="font-sans text-xs text-text-muted">
          Variáveis deste grupo
          {group.variableIds.length > 0
            ? ` · ${group.variableIds.map((id) => getCatalogLabel(id)).slice(0, 2).join(', ')}${
                group.variableIds.length > 2 ? '…' : ''
              }`
            : ''}
        </p>
      </div>

      <section
        className={cn(
          'space-y-2 pb-1',
          !(hasDisease && timeReady) && 'pointer-events-none opacity-45',
        )}
        aria-disabled={!(hasDisease && timeReady)}
      >
        <p className="font-sans text-sm text-text-muted">
          {hasDisease && timeReady
            ? 'Medidas da doença e contexto do território.'
            : !hasDisease
              ? 'Disponível após escolher a doença.'
              : 'Disponível após definir o período.'}
        </p>
        <MeasureDiseasePicker
          selectedVariableIds={group.variableIds}
          onToggleVariable={handleToggleVariable}
          measuresOnly
        />
      </section>
    </ResearchAccordionPanel>
  );
}
