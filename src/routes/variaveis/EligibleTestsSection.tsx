import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { EligibleTestViewModel } from './guidedViewModels';

export interface EligibleTestsSectionProps {
  tests: EligibleTestViewModel[];
  selectedTestIds: string[];
  primaryTestId: string | null;
  onSelectedTestIdsChange: (ids: string[]) => void;
  onPrimaryTestIdChange: (id: string) => void;
  roleOptions?: Array<{ id: string; label: string }>;
  roleAssignments?: Record<string, string>;
  onRoleAssignmentsChange?: (roles: Record<string, string>) => void;
}

const STATUS_GROUPS: Array<{
  status: EligibleTestViewModel['status'];
  label: string;
}> = [
  { status: 'eligible', label: 'Permitidos' },
  { status: 'eligible_with_caveat', label: 'Com ressalvas' },
  { status: 'ineligible', label: 'Não permitidos' },
];

export function EligibleTestsSection({
  tests,
  selectedTestIds,
  primaryTestId,
  onSelectedTestIdsChange,
  onPrimaryTestIdChange,
  roleOptions = [],
  roleAssignments = {},
  onRoleAssignmentsChange,
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

      {roleOptions.length > 1 && onRoleAssignmentsChange ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-elevated/40 p-4 sm:grid-cols-2">
          <label className="font-sans text-xs font-semibold text-text">
            Variável de desfecho
            <select
              aria-label="Variável de desfecho"
              value={roleAssignments.outcome ?? ''}
              onChange={(event) => onRoleAssignmentsChange({ ...roleAssignments, outcome: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-normal"
            >
              <option value="">Escolha…</option>
              {roleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="font-sans text-xs font-semibold text-text">
            Variável preditora
            <select
              aria-label="Variável preditora"
              value={roleAssignments.predictor ?? ''}
              onChange={(event) => onRoleAssignmentsChange({ ...roleAssignments, predictor: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-normal"
            >
              <option value="">Escolha…</option>
              {roleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <p className="sm:col-span-2 font-sans text-xs text-text-muted">
            Os papéis só afetam testes direcionais, como correlação e regressão. O sistema continua bloqueando combinações sem base estatística.
          </p>
        </div>
      ) : null}

      <div className="space-y-5">
        {STATUS_GROUPS.map((group) => {
          const groupedTests = tests.filter((test) => test.status === group.status);
          if (groupedTests.length === 0) return null;
          return (
            <section key={group.status} aria-labelledby={`test-status-${group.status}`} className="space-y-2">
              <h3 id={`test-status-${group.status}`} className="font-sans text-sm font-bold text-text">
                {group.label}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {groupedTests.map((test) => <TestDecisionCard
                  key={test.id}
                  test={test}
                  selected={selectedTestIds.includes(test.id)}
                  primaryTestId={primaryTestId}
                  onToggle={() => toggleTest(test.id)}
                  onPrimary={() => onPrimaryTestIdChange(test.id)}
                />)}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function TestDecisionCard({
  test,
  selected,
  primaryTestId,
  onToggle,
  onPrimary,
}: {
  test: EligibleTestViewModel;
  selected: boolean;
  primaryTestId: string | null;
  onToggle: () => void;
  onPrimary: () => void;
}) {
  const disabled = test.status === 'ineligible';
  return (
    <article
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
                  onCheckedChange={onToggle}
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
                        onChange={onPrimary}
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
}
