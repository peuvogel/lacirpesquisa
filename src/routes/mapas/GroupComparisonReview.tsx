import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { DISEASES, MEASURES, parseCatalogId } from '@/features/catalog/taxonomy';
import { cn } from '@/lib/utils';
import type { ComparisonAssessment, ComparisonIssue } from './comparisonAssessment';
import { formatTimeSummary, type MapAnalysisGroup } from './mapAnalysisState';

export interface GroupComparisonReviewProps {
  groups: MapAnalysisGroup[];
  assessment: ComparisonAssessment;
  className?: string;
}

const DESIGN_LABELS: Record<ComparisonAssessment['designKind'], string> = {
  descriptive: 'Descrição de um grupo',
  independent_place: 'Grupos independentes por lugar',
  paired_period: 'Comparação pareada por período',
  paired_disease: 'Comparação pareada por doença',
  time_series: 'Série temporal',
  confounded: 'Comparação com dimensões confundidas',
  unsupported: 'Desenho ainda não comparável',
};

const TEST_LABELS: Record<string, string> = {
  't-student': 't de Student',
  'mann-whitney': 'Mann–Whitney',
  'anova-tukey': 'ANOVA com Tukey',
  'kruskal-dunn': 'Kruskal–Wallis com Dunn',
  'prais-winsten': 'Prais–Winsten',
};

function outcome(group: MapAnalysisGroup) {
  for (const id of group.variableIds) {
    const parsed = parseCatalogId(id);
    if (parsed) return parsed;
  }
  return null;
}

function territorySummary(group: MapAnalysisGroup): string {
  if (group.territoryIds.length === 0) return '—';
  const labels = group.territoryIds.map(
    (territory) => territory.name || territory.sigla || territory.ibgeCode,
  );
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

function diseaseSummary(group: MapAnalysisGroup): string {
  const value = outcome(group);
  if (!value) return '—';
  return DISEASES.find((disease) => disease.id === value.diseaseId)?.label ?? value.diseaseId;
}

function measureSummary(group: MapAnalysisGroup): string {
  const value = outcome(group);
  if (!value) return '—';
  return MEASURES.find((measure) => measure.id === value.measureId)?.label ?? value.measureId;
}

function IssueList({ issues, severity }: { issues: ComparisonIssue[]; severity: ComparisonIssue['severity'] }) {
  const filtered = issues.filter((issue) => issue.severity === severity);
  if (filtered.length === 0) return null;
  const isBlock = severity === 'block';
  const Icon = isBlock ? ShieldAlert : severity === 'warning' ? AlertTriangle : Info;
  return (
    <div
      role={isBlock ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border p-3',
        isBlock
          ? 'border-danger/35 bg-danger/8'
          : severity === 'warning'
            ? 'border-warning/35 bg-warning/8'
            : 'border-accent/25 bg-accent/5',
      )}
    >
      <ul className="space-y-3">
        {filtered.map((entry) => (
          <li key={`${entry.code}:${entry.groupIds.join(',')}`} className="flex items-start gap-2.5">
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                isBlock ? 'text-danger' : severity === 'warning' ? 'text-warning' : 'text-accent',
              )}
              aria-hidden
            />
            <div>
              <p className="font-sans text-sm font-bold text-text">{entry.title}</p>
              <p className="mt-0.5 font-sans text-xs leading-relaxed text-text-muted">
                {entry.message}
              </p>
              {entry.remediation ? (
                <p className="mt-1 font-sans text-xs font-semibold leading-relaxed text-text">
                  Como corrigir: {entry.remediation}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GroupComparisonReview({
  groups,
  assessment,
  className,
}: GroupComparisonReviewProps) {
  if (groups.length === 0) return null;

  const rows = [
    { label: 'Território', values: groups.map(territorySummary) },
    { label: 'Doença', values: groups.map(diseaseSummary) },
    { label: 'Medida', values: groups.map(measureSummary) },
    { label: 'Período', values: groups.map((group) => formatTimeSummary(group.time) || '—') },
  ];
  const hasBlock = assessment.issues.some((entry) => entry.severity === 'block');

  return (
    <section
      aria-labelledby="group-comparison-review-heading"
      className={cn('space-y-4 rounded-2xl border border-white/10 bg-surface/65 p-4', className)}
    >
      <header>
        <p className="font-sans text-[10px] font-black uppercase tracking-[0.16em] text-accent">
          Verificação automática
        </p>
        <h2 id="group-comparison-review-heading" className="mt-1 font-sans text-lg font-bold text-text">
          Revisar comparação
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/12 bg-elevated px-2.5 py-1 font-sans text-xs font-bold text-text">
            {DESIGN_LABELS[assessment.designKind]}
          </span>
          {assessment.canInfer ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/8 px-2.5 py-1 font-sans text-xs font-bold text-success">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Comparação inferencial possível
            </span>
          ) : null}
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[34rem] border-collapse text-left" aria-label="Matriz de comparação dos grupos">
          <thead className="bg-elevated/80">
            <tr>
              <th className="px-3 py-2 font-sans text-[10px] font-black uppercase tracking-wide text-text-muted">Dimensão</th>
              {groups.map((group) => (
                <th key={group.id} className="px-3 py-2 font-sans text-xs font-bold text-text">
                  {group.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border/60">
                <th scope="row" className="px-3 py-2 font-sans text-xs font-bold text-text-muted">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td key={`${groups[index]!.id}:${row.label}`} className="px-3 py-2 font-sans text-xs leading-relaxed text-text">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IssueList issues={assessment.issues} severity="block" />
      <IssueList issues={assessment.issues} severity="warning" />
      <IssueList issues={assessment.issues} severity="info" />

      {hasBlock && assessment.canDescribe ? (
        <p className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 font-sans text-xs font-semibold text-text">
          Descrição continua disponível; apenas a comparação inferencial fica bloqueada.
        </p>
      ) : null}

      {assessment.candidateTestIds.length > 0 ? (
        <div>
          <p className="font-sans text-xs font-bold text-text">Testes compatíveis com este desenho</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assessment.candidateTestIds.map((testId) => (
              <span key={testId} className="rounded-full border border-accent/25 bg-accent/8 px-2.5 py-1 font-sans text-xs font-bold text-accent">
                {TEST_LABELS[testId] ?? testId}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
