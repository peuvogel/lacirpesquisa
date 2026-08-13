import type { DistributionViewModel } from './guidedViewModels';
import { ChartCanvas } from '@/shared/charts/ChartCanvas';
import { buildCategoryChart, buildHistogramChart, buildQqChart } from './profileCharts';

export function ProfileDistributionVisual({ distribution, label }: { distribution: DistributionViewModel; label: string }) {
  if (distribution.categories?.length) {
    const chart = buildCategoryChart(distribution, label);
    return (
      <figure>
        <ChartCanvas {...chart} className="h-[220px] sm:h-[250px]" />
        <figcaption className="mt-2 text-center font-sans text-xs text-text-muted">
          Barras mostram quantas unidades caem em cada faixa.
        </figcaption>
      </figure>
    );
  }

  const bins = distribution.histogram ?? [];
  if (!bins.length) return <p className="font-sans text-xs text-text-muted">Sem valores suficientes para desenhar a distribuição.</p>;
  const qq = distribution.qqPoints ?? [];
  const histogram = buildHistogramChart(distribution, label);
  return (
    <div className={qq.length ? 'grid gap-3 sm:grid-cols-2' : ''}>
      <figure>
        <ChartCanvas {...histogram} className="h-[220px] sm:h-[250px]" />
        <figcaption className="mt-2 text-center font-sans text-xs text-text-muted">
          Barras mostram quantas unidades caem em cada faixa.
        </figcaption>
      </figure>
      {qq.length ? (
        <figure>
          <ChartCanvas {...buildQqChart(distribution, label)} className="h-[220px] sm:h-[250px]" />
          <figcaption className="mt-2 text-center font-sans text-xs text-text-muted">
            Pontos próximos da linha sugerem compatibilidade com normalidade.
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
