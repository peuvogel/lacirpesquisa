import { BarChart3, GitCompareArrows, PanelsTopLeft } from 'lucide-react';
import type { ResearchGoal } from '@/features/research/types';
import { cn } from '@/lib/utils';

const GOALS: Array<{
  value: ResearchGoal;
  label: string;
  description: string;
  icon: typeof BarChart3;
}> = [
  {
    value: 'describe',
    label: 'Descrever',
    description: 'Resumir cobertura, distribuição e medidas do recorte.',
    icon: BarChart3,
  },
  {
    value: 'compare',
    label: 'Comparar',
    description: 'Investigar diferenças entre grupos territoriais do mapa ou períodos.',
    icon: GitCompareArrows,
  },
  {
    value: 'describe_and_compare',
    label: 'Descrever e comparar',
    description: 'Conhecer os dados antes de seguir para a comparação.',
    icon: PanelsTopLeft,
  },
];

export interface ResearchGoalSectionProps {
  value: ResearchGoal | null;
  onChange: (goal: ResearchGoal) => void;
}

export function ResearchGoalSection({ value, onChange }: ResearchGoalSectionProps) {
  return (
    <section aria-labelledby="research-goal-heading" className="space-y-4">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Primeiro passo
        </p>
        <h2 id="research-goal-heading" className="mt-1 font-sans text-heading font-bold text-text">
          1. Qual é o objetivo?
        </h2>
        <p className="mt-1 font-sans text-sm text-text-muted">
          Escolha a intenção da análise. As próximas etapas se adaptam a ela.
        </p>
      </div>

      <fieldset className="grid gap-3 md:grid-cols-3">
        <legend className="sr-only">Objetivo da análise</legend>
        {GOALS.map((goal) => {
          const selected = value === goal.value;
          const Icon = goal.icon;
          return (
            <label
              key={goal.value}
              className={cn(
                'group cursor-pointer rounded-2xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-accent/50',
                selected
                  ? 'border-accent/60 bg-accent/10 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]'
                  : 'border-border bg-surface/75 hover:border-white/20 hover:bg-elevated/80',
              )}
            >
              <input
                type="radio"
                name="research-goal"
                value={goal.value}
                checked={selected}
                onChange={() => onChange(goal.value)}
                aria-label={goal.label}
                className="sr-only"
              />
              <span className="flex items-start gap-3">
                <span className={cn('rounded-xl p-2', selected ? 'bg-accent text-[#04120c]' : 'bg-elevated text-text-muted')}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-sans text-sm font-bold text-text">{goal.label}</span>
                  <span className="mt-1 block font-sans text-xs leading-relaxed text-text-muted">
                    {goal.description}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {value === 'describe_and_compare' ? (
        <div
          aria-label="Caminhos do objetivo"
          className="grid gap-2 rounded-2xl border border-accent/20 bg-accent/5 p-3 sm:grid-cols-2"
        >
          <PathPill number="A" title="Descrição" body="Cobertura, distribuição e sumário." />
          <PathPill number="B" title="Comparação" body="Diferenças e testes permitidos." />
        </div>
      ) : null}
    </section>
  );
}

function PathPill({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface/70 px-3 py-2">
      <span className="grid size-7 place-items-center rounded-full bg-accent/15 font-sans text-xs font-bold text-accent">
        {number}
      </span>
      <span>
        <span className="block font-sans text-sm font-semibold text-text">{title}</span>
        <span className="block font-sans text-xs text-text-muted">{body}</span>
      </span>
    </div>
  );
}
