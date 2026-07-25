import { Label } from '@/components/ui/label';
import {
  getCategoryOptions,
  getTimeOptions,
} from '@/shared/data-input/datasusNormalizer';
import type { DatasusSession } from '@/shared/data-input/useDatasusWizard';
import type { DatasusKnobState } from './tStudentEngine';
import { datasusSourceFromPublic } from './tStudentDatasusUtils';

export interface TStudentDatasusKnobsProps {
  session: DatasusSession;
  knobs: DatasusKnobState;
  onChange: (knobs: DatasusKnobState) => void;
}

export function TStudentDatasusKnobs({ session, knobs, onChange }: TStudentDatasusKnobsProps) {
  const confirmed = session.confirmedSources[0];
  if (!confirmed?.normalized?.ok) {
    return (
      <p className="text-sm text-muted-foreground">
        Confirme uma base DATASUS no assistente antes de configurar grupos e período.
      </p>
    );
  }

  const source = datasusSourceFromPublic(confirmed);
  const categories = getCategoryOptions(source, false).filter((option) => !option.isTotal);
  const timeOptions = getTimeOptions(source);

  function toggleCategoryGroup(categoryKey: string, group: 'A' | 'B' | 'none') {
    const nextA = knobs.groupAKeys.filter((key) => key !== categoryKey);
    const nextB = knobs.groupBKeys.filter((key) => key !== categoryKey);
    if (group === 'A') nextA.push(categoryKey);
    if (group === 'B') nextB.push(categoryKey);
    onChange({ ...knobs, groupAKeys: nextA, groupBKeys: nextB });
  }

  function toggleTimeKey(timeKey: string, checked: boolean) {
    const next = checked
      ? [...knobs.timeKeys, timeKey]
      : knobs.timeKeys.filter((key) => key !== timeKey);
    onChange({ ...knobs, timeKeys: next });
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-[var(--color-surface)] p-4">
      <h3 className="text-base font-bold text-foreground">Opções DATASUS</h3>

      <div className="space-y-2">
        <Label className="text-sm font-bold">Período</Label>
        <div className="flex flex-wrap gap-2">
          {timeOptions.map((option) => {
            const checked = knobs.timeKeys.includes(option.key);
            return (
              <label
                key={option.key}
                className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleTimeKey(option.key, event.target.checked)}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold">Atribuição de categorias</Label>
        <ul className="space-y-2">
          {categories.map((category) => {
            const inA = knobs.groupAKeys.includes(category.key);
            const inB = knobs.groupBKeys.includes(category.key);
            const current = inA ? 'A' : inB ? 'B' : 'none';
            return (
              <li
                key={category.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm text-foreground">{category.label}</span>
                <select
                  aria-label={`Grupo para ${category.label}`}
                  value={current}
                  onChange={(event) =>
                    toggleCategoryGroup(category.key, event.target.value as 'A' | 'B' | 'none')
                  }
                  className="min-h-[44px] rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="none">Ignorar</option>
                  <option value="A">Grupo A</option>
                  <option value="B">Grupo B</option>
                </select>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function buildDefaultDatasusKnobs(session: DatasusSession): DatasusKnobState {
  const confirmed = session.confirmedSources[0];
  if (!confirmed?.normalized?.ok) {
    return { groupAKeys: [], groupBKeys: [], timeKeys: [] };
  }
  const source = datasusSourceFromPublic(confirmed);
  const categories = getCategoryOptions(source, false).filter((option) => !option.isTotal);
  const timeKeys = getTimeOptions(source).map((option) => option.key);
  const midpoint = Math.ceil(categories.length / 2);
  return {
    groupAKeys: categories.slice(0, midpoint).map((option) => option.key),
    groupBKeys: categories.slice(midpoint).map((option) => option.key),
    timeKeys,
  };
}
