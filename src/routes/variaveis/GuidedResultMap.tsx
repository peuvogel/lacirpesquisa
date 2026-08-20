import { useMemo, useState } from 'react';
import type { MapMetricCell } from '@/geo/mapMetricCell';
import type { AnalysisScenario, ResearchDesign } from '@/features/research/types';
import { BrazilMapCanvas } from '@/routes/mapas/BrazilMapCanvas';
import { ChoroplethLegend } from '@/routes/mapas/ChoroplethLegend';
import { UF_LIST } from '@/routes/mapas/ufCodes';

export interface GuidedMapModel {
  values: Record<string, MapMetricCell>;
  cells: MapMetricCell[];
}

function displayCell(cell: AnalysisScenario['cells'][number]): MapMetricCell {
  if (cell.analyticStatus === 'requires_review') {
    return { value: cell.rawValue, displayStatus: 'review' };
  }
  if (
    cell.analyticStatus === 'include'
    && (cell.sourceStatus === 'observed' || cell.sourceStatus === 'collection_zero')
    && typeof cell.rawValue === 'number'
    && Number.isFinite(cell.rawValue)
  ) {
    return cell.rawValue === 0
      ? { value: 0, displayStatus: 'zero' }
      : { value: cell.rawValue, displayStatus: 'value' };
  }
  return { value: cell.rawValue, displayStatus: 'missing' };
}

export function buildGuidedMapModel(
  design: ResearchDesign,
  scenario: AnalysisScenario,
  variableId: string,
): GuidedMapModel | null {
  if (design.geography !== 'uf') return null;
  const relevant = scenario.cells.filter((cell) => cell.variableId === variableId);
  const counts = new Map<string, number>();
  for (const cell of relevant) counts.set(cell.territoryId, (counts.get(cell.territoryId) ?? 0) + 1);
  if ([...counts.values()].some((count) => count !== 1)) return null;
  const siglaByIbge = new Map(UF_LIST.map((uf) => [uf.ibgeCode, uf.sigla]));
  const values: Record<string, MapMetricCell> = {};
  for (const cell of relevant) {
    const sigla = siglaByIbge.get(cell.territoryId);
    if (sigla) values[sigla] = displayCell(cell);
  }
  const cells = Object.values(values);
  return cells.length > 0 ? { values, cells } : null;
}

function unavailableMapReason(
  design: ResearchDesign,
  scenario: AnalysisScenario,
  variableId: string,
): string {
  if (design.geography === 'municipio') {
    return 'O mapa municipal ainda não possui uma representação territorial unívoca nesta tela; os valores continuam disponíveis nos gráficos, sumários e revisão.';
  }
  if (design.geography !== 'uf') {
    return `O grão ${design.geography} ainda não possui uma representação territorial unívoca nesta tela; os valores continuam disponíveis nos demais resultados.`;
  }
  const relevant = scenario.cells.filter((cell) => cell.variableId === variableId);
  if (relevant.length === 0) {
    return 'Este desfecho não possui células territoriais no cenário atual; nenhum mapa foi inventado.';
  }
  const counts = new Map<string, number>();
  for (const cell of relevant) counts.set(cell.territoryId, (counts.get(cell.territoryId) ?? 0) + 1);
  if ([...counts.values()].some((count) => count !== 1)) {
    return 'Há mais de um valor por território; o desfecho não foi agregado silenciosamente. Consulte os gráficos e a revisão por período.';
  }
  return 'Os códigos territoriais deste desfecho não puderam ser associados ao mapa do Brasil; nenhum valor foi descartado dos demais resultados.';
}

export function GuidedResultMap({
  design,
  scenario,
  variableId,
  variableLabel,
}: {
  design: ResearchDesign;
  scenario: AnalysisScenario;
  variableId: string;
  variableLabel: string;
}) {
  const [hoveredUF, setHoveredUF] = useState<string | null>(null);
  const model = useMemo(
    () => buildGuidedMapModel(design, scenario, variableId),
    [design, scenario, variableId],
  );
  const headingId = `guided-result-map-heading-${variableId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-border bg-surface/60 p-4 sm:p-5">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-accent">Leitura territorial</p>
        <h3 id={headingId} className="mt-1 font-sans text-base font-bold text-text">Distribuição no mapa · {variableLabel}</h3>
        <p className="mt-1 font-sans text-xs text-text-muted">
          O mapa preserva zero confirmado, ausência e revisão como estados visuais diferentes.
        </p>
      </div>
      {model ? (
        <>
          <div className="mx-auto mt-4 max-w-3xl overflow-hidden rounded-2xl border border-border bg-elevated/40">
            <BrazilMapCanvas
              hoveredUF={hoveredUF}
              selectedUFs={[]}
              onHoverUF={setHoveredUF}
              onToggleUF={() => undefined}
              choroplethValues={model.values}
              activeVariableId={variableId}
            />
          </div>
          <ChoroplethLegend cells={model.cells} activeVariableId={variableId} variableLabel={variableLabel} />
        </>
      ) : (
        <p role="status" className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 font-sans text-xs leading-relaxed text-text-muted">
          {unavailableMapReason(design, scenario, variableId)}
        </p>
      )}
    </section>
  );
}
