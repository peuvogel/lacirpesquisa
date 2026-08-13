import type { DistributionViewModel } from './guidedViewModels';

export function ProfileDistributionVisual({ distribution }: { distribution: DistributionViewModel }) {
  if (distribution.categories?.length) {
    const maximum = Math.max(...distribution.categories.map((item) => item.count), 1);
    return (
      <div role="img" aria-label="Gráfico de frequências observadas" className="space-y-2">
        {distribution.categories.map((item) => (
          <div key={item.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-[11px]">
            <span className="truncate text-text-muted">{item.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-elevated">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(item.count / maximum) * 100}%` }} />
            </span>
            <span className="font-mono text-text">{item.count.toLocaleString('pt-BR')}</span>
          </div>
        ))}
      </div>
    );
  }

  const bins = distribution.histogram ?? [];
  if (!bins.length) return <p className="font-sans text-xs text-text-muted">Sem valores suficientes para desenhar a distribuição.</p>;
  const maximum = Math.max(...bins.map((bin) => bin.count), 1);
  const width = 240;
  const height = 88;
  const gap = 2;
  const barWidth = Math.max(1, (width - gap * (bins.length - 1)) / bins.length);
  const qq = distribution.qqPoints ?? [];
  const qqX = qq.map((point) => point.theoretical);
  const qqY = qq.map((point) => point.observed);
  const minX = Math.min(...qqX, 0);
  const maxX = Math.max(...qqX, 1);
  const minY = Math.min(...qqY, 0);
  const maxY = Math.max(...qqY, 1);
  return (
    <div className={qq.length ? 'grid gap-3 sm:grid-cols-2' : ''}>
      <figure>
        <svg role="img" aria-label="Histograma da distribuição" viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible">
          {bins.map((bin, index) => {
            const barHeight = (bin.count / maximum) * (height - 12);
            return <rect key={`${bin.lower}-${bin.upper}`} x={index * (barWidth + gap)} y={height - barHeight} width={barWidth} height={barHeight} rx="2" className="fill-accent/75" />;
          })}
          <line x1="0" x2={width} y1={height} y2={height} className="stroke-border" />
        </svg>
        <figcaption className="text-center font-sans text-[10px] uppercase tracking-wide text-text-muted">Histograma</figcaption>
      </figure>
      {qq.length ? (
        <figure>
          <svg role="img" aria-label="Gráfico quantil-quantil" viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible">
            <line x1="8" y1={height - 8} x2={width - 8} y2="8" className="stroke-border" strokeDasharray="4 3" />
            {qq.map((point, index) => {
              const x = 8 + ((point.theoretical - minX) / Math.max(maxX - minX, 1e-9)) * (width - 16);
              const y = height - 8 - ((point.observed - minY) / Math.max(maxY - minY, 1e-9)) * (height - 16);
              return <circle key={`${point.theoretical}-${index}`} cx={x} cy={y} r="2.5" className="fill-accent" />;
            })}
          </svg>
          <figcaption className="text-center font-sans text-[10px] uppercase tracking-wide text-text-muted">Q–Q</figcaption>
        </figure>
      ) : null}
    </div>
  );
}
