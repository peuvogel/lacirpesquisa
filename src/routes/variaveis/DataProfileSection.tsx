import { BarChart3, CheckCircle2, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataProfileViewModel } from './guidedViewModels';
import { ProfileDistributionVisual } from './ProfileDistributionVisual';

export interface DataProfileSectionProps {
  profiles: DataProfileViewModel[];
  reviewsResolved: boolean;
  chartContext: string;
}

export function DataProfileSection({ profiles, reviewsResolved, chartContext }: DataProfileSectionProps) {
  return (
    <section aria-labelledby="profile-heading" className="space-y-4">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Perfil observado
        </p>
        <h2 id="profile-heading" className="mt-1 font-sans text-heading font-bold text-text">
          3. Conheça seus dados
        </h2>
        <p className="mt-1 font-sans text-sm text-text-muted">
          Confira cobertura, sumários e diagnósticos antes de escolher um teste.
        </p>
      </div>

      <div className="space-y-4">
        {profiles.map((profile) => (
          <article key={profile.variableId} className="overflow-hidden rounded-2xl border border-border bg-surface/70">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="font-sans text-base font-bold text-text">{profile.label}</h3>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 font-sans text-xs font-semibold text-accent">
                {profile.diagnosticLabel}
              </span>
            </header>
            <div className="grid gap-4 p-4 lg:grid-cols-[1.05fr_1fr_1.2fr]">
              <CoverageCards profile={profile} />
              <dl className="grid content-start grid-cols-2 gap-2">
                {profile.facts.map((fact) => (
                  <div key={fact.label} className="rounded-xl bg-elevated/70 p-3">
                    <dt className="font-sans text-[11px] uppercase tracking-wide text-text-muted">{fact.label}</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-text">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="min-h-36 rounded-xl border border-dashed border-accent/30 bg-accent/[0.035] p-4">
                <div className="flex items-center gap-2 text-accent">
                  <BarChart3 className="size-4" aria-hidden />
                  <h4 className="font-sans text-sm font-bold">{profile.distribution.title}</h4>
                </div>
                <p className="mt-2 font-sans text-xs leading-relaxed text-text-muted">
                  {profile.distribution.description}
                </p>
                <div className="mt-3">
                  {profile.distribution.slot ?? <ProfileDistributionVisual
                    distribution={profile.distribution}
                    label={profile.label}
                    variableId={profile.variableId}
                    context={chartContext}
                  />}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 font-sans text-sm',
        reviewsResolved
          ? 'border-accent/20 bg-accent/5 text-text'
          : 'border-amber-400/25 bg-amber-400/5 text-text',
      )}>
        {reviewsResolved ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />}
        {reviewsResolved
          ? 'Perfil pronto para avaliar os testes permitidos.'
          : 'Revise as pendências antes de escolher testes.'}
      </div>
    </section>
  );
}

function CoverageCards({ profile }: { profile: DataProfileViewModel }) {
  const items = [
    ['Esperado', profile.coverage.expected],
    ['Disponível', profile.coverage.available],
    ['Usado', profile.coverage.used],
    ['Ausente', profile.coverage.missing],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border/70 bg-elevated/55 p-3">
          <dt className="font-sans text-[11px] uppercase tracking-wide text-text-muted">{label}</dt>
          <dd className="mt-1 font-mono text-xl font-bold text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
