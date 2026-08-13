import { Checkbox } from '@/components/ui/checkbox';

export interface GroupTrendTestSectionProps {
  available: boolean;
  reason: string;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}

export function GroupTrendTestSection({
  available,
  reason,
  selected,
  onSelectedChange,
}: GroupTrendTestSectionProps) {
  const inputId = 'guided-group-prais-winsten';
  return (
    <section aria-labelledby="group-trend-test-heading" className="space-y-4">
      <div>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Descrição temporal
        </p>
        <h2 id="group-trend-test-heading" className="mt-1 font-sans text-heading font-bold text-text">
          Tendência anual dentro de cada grupo
        </h2>
        <p className="mt-1 font-sans text-sm text-text-muted">
          O cálculo é separado para cada grupo e variável. Ele não substitui nem altera o teste que compara os grupos.
        </p>
      </div>

      <label
        htmlFor={inputId}
        className="flex items-start gap-3 rounded-2xl border border-border bg-surface/65 p-4"
      >
        <Checkbox
          id={inputId}
          checked={selected}
          disabled={!available}
          onCheckedChange={(checked) => onSelectedChange(checked === true)}
          aria-label="Calcular Prais–Winsten por grupo"
          className="mt-0.5"
        />
        <span className="min-w-0">
          <strong className="block font-sans text-sm text-text">Calcular Prais–Winsten por grupo</strong>
          <span className="mt-1 block font-sans text-xs leading-relaxed text-text-muted">{reason}</span>
          <span className="mt-1 block font-sans text-xs leading-relaxed text-text-muted">
            Cada p-valor pertence somente à tendência daquele grupo; não há comparação entre p-valores nem correção de Holm nesta descrição.
          </span>
        </span>
      </label>
    </section>
  );
}
