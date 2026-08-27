import { useRef } from 'react';
import type { DistributionViewModel } from './guidedViewModels';
import { ChartCanvas } from '@/shared/charts/ChartCanvas';
import { DownloadPngButton } from '@/shared/charts/DownloadPngButton';
import { exportCanvasPng } from '@/shared/charts/useChartExport';
import { buildCategoryChart, buildHistogramChart, buildQqChart } from './profileCharts';

export function ProfileDistributionVisual({
  distribution,
  label,
  variableId,
  context,
}: {
  distribution: DistributionViewModel;
  label: string;
  variableId: string;
  context: string;
}) {
  const primaryCanvas = useRef<HTMLCanvasElement | null>(null);
  const qqCanvas = useRef<HTMLCanvasElement | null>(null);

  if (distribution.categories?.length) {
    const chart = buildCategoryChart(distribution, label, context);
    return (
      <figure className="relative">
        <ChartCanvas {...chart} height={300} onCanvasReady={(canvas) => { primaryCanvas.current = canvas; }} />
        <DownloadPngButton
          className="absolute right-2 top-2"
          label={`Baixar frequências de ${label}`}
          onClick={() => primaryCanvas.current && exportCanvasPng(primaryCanvas.current, `perfil-${variableId}-categorias.png`)}
        />
        <figcaption className="mt-2 text-center font-sans text-xs text-text-muted">
          Barras mostram quantas unidades pertencem a cada categoria. Recorte: {context}.
        </figcaption>
      </figure>
    );
  }

  const bins = distribution.histogram ?? [];
  if (!bins.length) return <p className="font-sans text-xs text-text-muted">Sem valores suficientes para desenhar a distribuição.</p>;
  const qq = distribution.qqPoints ?? [];
  const histogram = buildHistogramChart(distribution, label, context);
  return (
    <div className={qq.length ? 'grid gap-3 sm:grid-cols-2' : ''}>
      <figure className="relative">
        <ChartCanvas {...histogram} height={300} onCanvasReady={(canvas) => { primaryCanvas.current = canvas; }} />
        <DownloadPngButton
          className="absolute right-2 top-2"
          label={`Baixar histograma de ${label}`}
          onClick={() => primaryCanvas.current && exportCanvasPng(primaryCanvas.current, `perfil-${variableId}-histograma.png`)}
        />
        <figcaption className="mt-2 text-center font-sans text-xs text-text-muted">
          Barras mostram quantas unidades caem em cada faixa. Recorte: {context}.
        </figcaption>
      </figure>
      {qq.length ? (
        <figure className="relative">
          <ChartCanvas {...buildQqChart(distribution, label, context)} height={300} onCanvasReady={(canvas) => { qqCanvas.current = canvas; }} />
          <DownloadPngButton
            className="absolute right-2 top-2"
            label={`Baixar gráfico Q–Q de ${label}`}
            onClick={() => qqCanvas.current && exportCanvasPng(qqCanvas.current, `perfil-${variableId}-qq.png`)}
          />
          <figcaption className="mt-2 text-center font-sans text-xs text-text-muted">
            Pontos próximos da linha sugerem compatibilidade com normalidade. Recorte: {context}.
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
