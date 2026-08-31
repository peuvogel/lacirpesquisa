export interface ResultMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface ResultMetricCardProps {
  metric: ResultMetric;
}

export function ResultMetricCard({ metric }: ResultMetricCardProps) {
  return (
    <article
      aria-label={metric.label}
      tabIndex={0}
      className="lacir-result-metric rounded-lg border border-border bg-[var(--color-surface)] px-4 py-3"
    >
      <p className="text-sm font-bold text-muted-foreground">{metric.label}</p>
      <p className="mt-1 text-[20px] font-bold leading-tight text-foreground">{metric.value}</p>
      {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
    </article>
  );
}
