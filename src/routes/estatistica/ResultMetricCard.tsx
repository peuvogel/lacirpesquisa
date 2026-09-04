import { Info } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CountUpValue } from './CountUpValue';
import { metricHelp, type MetricHelpKey } from './metricHelp';

export interface ResultMetric {
  label: string;
  value: string;
  hint?: string;
  /** Verbete do glossário. Sem ele, o card não mostra o "i". */
  helpKey?: MetricHelpKey;
}

export interface ResultMetricCardProps {
  metric: ResultMetric;
}

export function ResultMetricCard({ metric }: ResultMetricCardProps) {
  const help = metric.helpKey ? metricHelp(metric.helpKey) : null;

  return (
    <article
      aria-label={metric.label}
      tabIndex={0}
      className="lacir-result-metric rounded-lg border border-border bg-[var(--color-surface)] px-4 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-muted-foreground">{metric.label}</p>
        {help ? (
          // Mesmo gesto do "i" de "Papéis desta análise", em tom mais apagado:
          // aqui há um por card, e eles não podem competir com os números.
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`O que é ${metric.label}`}
                className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-transparent text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <p className="text-sm font-bold text-foreground">{help.title}</p>
              <p className="mt-2 text-xs text-muted-foreground">{help.what}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Exemplo: </span>
                {help.example}
              </p>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      <p className="mt-1 text-[20px] font-bold leading-tight text-foreground">
        <CountUpValue value={metric.value} />
      </p>
      {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
    </article>
  );
}
