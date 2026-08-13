import type { ResearchDesign, TerritoryGroup } from '@/features/research/types';
import { diseaseLabel, formatResearchPeriod, formatResearchPeriodLabel } from './researchCutSummary';

export function ResearchCutContext({ design }: { design: ResearchDesign }) {
  return (
    <section aria-label="Recorte que será analisado" className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <dl className="grid gap-3 md:grid-cols-3">
        <CutFact label="Doença" value={design.diseaseIds.map(diseaseLabel).join(', ')} />
        <CutFact label="Período" value={formatResearchPeriod(design)} />
        <CutFact label="Base" value={design.locationBasis === 'ocorrencia' ? 'Ocorrência' : 'Residência'} />
      </dl>

      <ul aria-label="Grupos territoriais do mapa" className="mt-4 grid gap-2 sm:grid-cols-2">
        {design.groups.map((group) => <GroupFact key={group.id} group={group} design={design} />)}
      </ul>

      <p className="mt-4 font-sans text-sm leading-relaxed text-text-muted">
        Cada variável marcada será analisada como um desfecho separado e comparada entre estes grupos territoriais.
      </p>
    </section>
  );
}

function CutFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/70 p-3">
      <dt className="font-sans text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 font-sans text-sm font-semibold text-text">{value}</dd>
    </div>
  );
}

function GroupFact({ group, design }: { group: TerritoryGroup; design: ResearchDesign }) {
  const period = design.period.scope === 'shared'
    ? formatResearchPeriodLabel(design.period.time)
    : design.period.timesByGroupId[group.id]
      ? formatResearchPeriodLabel(design.period.timesByGroupId[group.id])
      : formatResearchPeriod(design);

  return (
    <li className="rounded-xl border border-border/80 bg-surface/65 p-3">
      <strong className="block font-sans text-sm text-text">{group.name}</strong>
      <span className="mt-1 block font-sans text-xs leading-relaxed text-text-muted">
        {group.territories.map((territory) => territory.label).join(', ')}
      </span>
      {design.period.scope === 'per_group' ? (
        <span className="mt-1.5 block font-sans text-xs font-semibold text-accent">Período: {period}</span>
      ) : null}
    </li>
  );
}
