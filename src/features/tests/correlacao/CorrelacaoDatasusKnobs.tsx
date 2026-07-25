import { Label } from '@/components/ui/label';
import { getMetricOptions, getPrimaryMetricKey, getTimeOptions } from '@/shared/data-input/datasusNormalizer';
import type { DatasusSession } from '@/shared/data-input/useDatasusWizard';
import type { DatasusKnobState } from './correlacaoEngine';
import { datasusSourcesFromSession } from './correlacaoDatasusUtils';

export interface CorrelacaoDatasusKnobsProps {
  session: DatasusSession;
  knobs: DatasusKnobState;
  onChange: (knobs: DatasusKnobState) => void;
}

export function CorrelacaoDatasusKnobs({ session, knobs, onChange }: CorrelacaoDatasusKnobsProps) {
  const sources = datasusSourcesFromSession(session);
  if (!sources.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Confirme uma base DATASUS no assistente antes de configurar variáveis X e Y.
      </p>
    );
  }

  const xSource = sources.find((source) => source.id === knobs.xSourceId) ?? sources[0];
  const ySource = sources.find((source) => source.id === knobs.ySourceId) ?? sources[0];
  const xMetrics = getMetricOptions(xSource);
  const yMetrics = getMetricOptions(ySource);
  const timeOptions = getTimeOptions(xSource);

  function updateKnobs(partial: Partial<DatasusKnobState>) {
    onChange({ ...knobs, ...partial });
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-[var(--color-surface)] p-4">
      <h3 className="text-base font-bold text-foreground">Opções DATASUS</h3>

      {sources.length > 1 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-bold">Fonte X</Label>
            <select
              aria-label="Fonte X"
              value={knobs.xSourceId}
              onChange={(event) => updateKnobs({ xSourceId: event.target.value })}
              className="min-h-[44px] w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.fileName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold">Fonte Y</Label>
            <select
              aria-label="Fonte Y"
              value={knobs.ySourceId}
              onChange={(event) => updateKnobs({ ySourceId: event.target.value })}
              className="min-h-[44px] w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.fileName}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-bold">Variável X</Label>
          <select
            aria-label="Variável X"
            value={knobs.xMetricKey}
            onChange={(event) => updateKnobs({ xMetricKey: event.target.value })}
            className="min-h-[44px] w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {xMetrics.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold">Variável Y</Label>
          <select
            aria-label="Variável Y"
            value={knobs.yMetricKey}
            onChange={(event) => updateKnobs({ yMetricKey: event.target.value })}
            className="min-h-[44px] w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {yMetrics.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {timeOptions.length ? (
        <div className="space-y-2">
          <Label className="text-sm font-bold">Período</Label>
          <select
            aria-label="Período"
            value={knobs.timeKey}
            onChange={(event) => updateKnobs({ timeKey: event.target.value })}
            className="min-h-[44px] w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Todos os períodos disponíveis</option>
            {timeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </section>
  );
}

export function buildDefaultCorrelacaoDatasusKnobs(session: DatasusSession): DatasusKnobState {
  const sources = datasusSourcesFromSession(session);
  if (!sources.length) {
    return { xSourceId: '', ySourceId: '', xMetricKey: '', yMetricKey: '', timeKey: '' };
  }

  const xSource = sources[0];
  const ySource = sources[1] ?? sources[0];
  const yMetrics = getMetricOptions(ySource);

  return {
    xSourceId: xSource.id,
    ySourceId: ySource.id,
    xMetricKey: getPrimaryMetricKey(xSource),
    yMetricKey: yMetrics.length > 1 ? (yMetrics[1]?.key ?? getPrimaryMetricKey(ySource)) : getPrimaryMetricKey(ySource),
    timeKey: '',
  };
}
