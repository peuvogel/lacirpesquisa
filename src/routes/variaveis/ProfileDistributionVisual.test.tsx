import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DistributionViewModel } from './guidedViewModels';
import { ProfileDistributionVisual } from './ProfileDistributionVisual';

const { ChartMock } = vi.hoisted(() => {
  const Constructor = vi.fn().mockImplementation(function ChartConstructorMock(
    _canvas: unknown,
    config: { data: unknown; options: unknown },
  ) {
    return { config, data: config.data, options: config.options, destroy: vi.fn(), update: vi.fn() };
  });
  const ChartMock = Constructor as unknown as typeof Constructor & { register: ReturnType<typeof vi.fn> };
  ChartMock.register = vi.fn();
  return { ChartMock };
});

vi.mock('chart.js', () => ({
  Chart: ChartMock,
  BarController: {}, LineController: {}, ScatterController: {}, LinearScale: {}, LogarithmicScale: {}, CategoryScale: {},
  PointElement: {}, LineElement: {}, BarElement: {}, Legend: {}, Title: {}, Tooltip: {}, Filler: {},
}));

const distribution: DistributionViewModel = {
  title: 'Histograma e Q–Q',
  description: 'Valores usados.',
  histogram: [
    { lower: 0, upper: 10, count: 2 },
    { lower: 10, upper: 20, count: 3 },
  ],
  qqPoints: [
    { theoretical: -1, observed: 2 },
    { theoretical: 0, observed: 8 },
    { theoretical: 1, observed: 15 },
  ],
};

describe('ProfileDistributionVisual', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
  });

  afterEach(() => vi.restoreAllMocks());

  it('exports each profile chart with a deterministic filename and names the recorte', async () => {
    const user = userEvent.setup();
    render(
      <ProfileDistributionVisual
        distribution={distribution}
        label="Taxa de mortalidade"
        variableId="taxa_mortalidade"
        context="Nordeste × Sudeste · 2023–2025"
      />,
    );

    expect(screen.getAllByText(/Nordeste × Sudeste · 2023–2025/)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Baixar histograma de Taxa de mortalidade' }));

    const anchor = (appendChildSpy.mock.calls as unknown[][])
      .map((call) => call[0])
      .find((node) => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    expect(anchor?.download).toBe('perfil-taxa_mortalidade-histograma.png');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Baixar gráfico Q–Q de Taxa de mortalidade' })).toBeInTheDocument();
  });

  it('describes categorical bars as categories, never numeric ranges', () => {
    render(
      <ProfileDistributionVisual
        distribution={{
          title: 'Frequências',
          description: 'Categorias.',
          categories: [{ label: 'Óbito', count: 3 }, { label: 'Alta', count: 12 }],
        }}
        label="Desfecho hospitalar"
        variableId="desfecho_hospitalar"
        context="Nordeste · 2025"
      />,
    );

    expect(screen.getByText(/cada categoria/i)).toBeInTheDocument();
    expect(screen.queryByText(/cada faixa/i)).not.toBeInTheDocument();
  });
});
