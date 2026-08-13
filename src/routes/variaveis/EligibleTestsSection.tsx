import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { EligibleTestViewModel } from './guidedViewModels';

export interface EligibleTestsSectionProps {
  tests: EligibleTestViewModel[];
  selectedTestIds: string[];
  primaryTestId: string | null;
  onSelectedTestIdsChange: (ids: string[]) => void;
  onPrimaryTestIdChange: (id: string) => void;
}

export function EligibleTestsSection({
  tests,
  selectedTestIds,
  primaryTestId,
  onSelectedTestIdsChange,
  onPrimaryTestIdChange,
}: EligibleTestsSectionProps) {
  function toggleTest(id: string) {
    onSelectedTestIdsChange(
      selectedTestIds.includes(id)
        ? selectedTestIds.filter((selectedId) => selectedId !== id)
        : [...selectedTestIds, id],
    );
  }

  return (
    <section aria-labelledby="eligible-tests-heading" className="space-y-4">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Decisão analítica
        </p>
        <h2 id="eligible-tests-heading" className="mt-1 font-sans text-heading font-bold text-text">
          4. Testes permitidos
        </h2>
        <p className="mt-1 font-sans text-sm text-text-muted">
          Você pode marcar mais de um. Defina um principal; os demais serão análises de sensibilidade.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {tests.map((test) => {
          const selected = selectedTestIds.includes(test.id);
          const disabled = test.status === 'ineligible';
          return (
            <article
              key={test.id}
              className={cn(
                'rounded-2xl border p-4',
                selected ? 'border-accent/50 bg-accent/8' : 'border-border bg-surface/65',
                disabled && 'opacity-60',
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected}
                  disabled={disabled}
                  onCheckedChange={() => toggleTest(test.id)}
                  aria-label={`Selecionar ${test.label}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-sans text-sm font-bold text-text">{test.label}</h3>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold',
                      test.status === 'eligible'
                        ? 'bg-accent/10 text-accent'
                        : test.status === 'eligible_with_caveat'
                          ? 'bg-amber-400/10 text-amber-300'
                          : 'bg-white/5 text-text-muted',
                    )}>
                      {test.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 font-sans text-xs leading-relaxed text-text-muted">{test.reason}</p>
                  {selected ? (
                    <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-border/70 pt-3 font-sans text-xs text-text">
                      <input
                        type="radio"
                        name="primary-test"
                        checked={primaryTestId === test.id}
                        onChange={() => onPrimaryTestIdChange(test.id)}
                        aria-label={`Definir ${test.label} como principal`}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      {primaryTestId === test.id
                        ? 'Teste principal'
                        : primaryTestId
                          ? 'Análise de sensibilidade'
                          : 'Definir como principal'}
                    </label>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
