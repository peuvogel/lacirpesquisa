import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartCanvas } from './ChartCanvas';
import { CHART_FONT_FAMILY } from './chartTheme';

const { ChartMock, destroySpy, updateSpy, events, logarithmicScale } = vi.hoisted(() => {
  const events: string[] = [];
  const destroySpy = vi.fn(() => {
    events.push('destroy');
  });
  const updateSpy = vi.fn((mode?: string) => {
    events.push(`update:${mode ?? 'default'}`);
  });
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock(
    canvas: unknown,
    config: unknown,
  ) {
    events.push('construct');
    return {
      canvas,
      config,
      data: (config as { data: unknown }).data,
      destroy: destroySpy,
      update: updateSpy,
    };
  });
  const ChartMock = ChartConstructorSpy as unknown as typeof ChartConstructorSpy & {
    new (...args: unknown[]): unknown;
    register: ReturnType<typeof vi.fn>;
  };
  ChartMock.register = vi.fn();
  return { ChartMock, destroySpy, updateSpy, events, logarithmicScale: { id: 'logarithmic' } };
});

vi.mock('chart.js', () => ({
  Chart: ChartMock,
  BarController: {},
  LineController: {},
  ScatterController: {},
  LinearScale: {},
  LogarithmicScale: logarithmicScale,
  CategoryScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  Legend: {},
  Title: {},
  Tooltip: {},
  Filler: {},
  // Title is registered by ChartCanvas; keep mock export present.
}));

function getLastConfig() {
  const calls = (ChartMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[calls.length - 1]?.[1] as {
    type: string;
    data: unknown;
    options: {
      animation?: false | { duration?: number };
      onClick?: unknown;
      plugins?: { legend?: { labels?: { font?: { family?: string } }; onClick?: unknown } };
      scales?: { x?: { ticks?: { font?: { family?: string } } } };
    };
  };
}

const sampleData = { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] };

describe('ChartCanvas', () => {
  beforeEach(() => {
    events.length = 0;
    ChartMock.mockClear();
    destroySpy.mockClear();
    updateSpy.mockClear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it('mounts exactly one Chart with the merged options', () => {
    render(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />);

    expect(ChartMock).toHaveBeenCalledTimes(1);
    const config = getLastConfig();
    expect(config.type).toBe('bar');
    expect(config.data).toBe(sampleData);
    expect(config.options.animation).toEqual({ duration: 450, easing: 'easeOutQuart' });
    expect(events).toContain('construct');
  });

  it('disables Chart.js animation when reduced motion is requested', () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    render(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />);

    expect(getLastConfig().options.animation).toBe(false);
  });

  it('keeps Chart.js default click and legend behavior without an interaction callback', () => {
    render(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />);
    const options = getLastConfig().options;

    expect(options.onClick).toBeUndefined();
    expect(options.plugins?.legend?.onClick).toBeUndefined();
  });

  it('registers the logarithmic scale required by odds-ratio forests', () => {
    expect(ChartMock.register.mock.calls.flat(Number.POSITIVE_INFINITY)).toContain(logarithmicScale);
  });

  it('renders chart text with the shared system-first font family', () => {
    render(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />);
    const options = getLastConfig().options;

    expect(options.plugins?.legend?.labels?.font?.family).toBe(CHART_FONT_FAMILY);
    expect(options.scales?.x?.ticks?.font?.family).toBe(CHART_FONT_FAMILY);
    expect(CHART_FONT_FAMILY).not.toContain('Sora');
    expect(CHART_FONT_FAMILY).toBe(
      "-apple-system, BlinkMacSystemFont, 'Geist Variable', 'Segoe UI', sans-serif",
    );
  });

  it('updates in place without destroying when data changes', () => {
    const { rerender } = render(
      <ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />,
    );
    expect(ChartMock).toHaveBeenCalledTimes(1);

    const nextData = { labels: ['A', 'B', 'C'], datasets: [{ data: [1, 2, 3] }] };
    rerender(<ChartCanvas type="bar" data={nextData} ariaLabel="Gráfico teste" />);

    expect(ChartMock).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith('none');
    expect(events.filter((e) => e === 'construct')).toHaveLength(1);
  });

  it('destroys the instance on unmount', () => {
    const { unmount } = render(
      <ChartCanvas type="line" data={sampleData} ariaLabel="Gráfico teste" />,
    );
    expect(destroySpy).not.toHaveBeenCalled();

    unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('renders the canvas with role img and the provided aria-label', () => {
    render(<ChartCanvas type="scatter" data={sampleData} ariaLabel="Distribuição dos dados" />);

    expect(screen.getByRole('img', { name: 'Distribuição dos dados' })).toBeInTheDocument();
  });

  it('uses a readable 420px default height and honors an explicit height', () => {
    const { rerender } = render(
      <ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />,
    );
    const container = screen.getByRole('img', { name: 'Gráfico teste' }).parentElement;

    expect(container).toHaveStyle({ height: '420px' });

    rerender(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" height={620} />);
    expect(container).toHaveStyle({ height: '620px' });
  });

  it('keeps the rendering surface visible instead of clipping annotations', () => {
    render(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />);
    const canvas = screen.getByRole('img', { name: 'Gráfico teste' });

    expect(canvas.parentElement).toHaveClass('overflow-visible');
    expect(canvas.parentElement).not.toHaveClass('overflow-hidden');
    expect(canvas).toHaveClass('rounded-xl');
  });

  it('clamps requested heights to the supported 280–900px range', () => {
    const { rerender } = render(
      <ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" height={120} />,
    );
    const container = screen.getByRole('img', { name: 'Gráfico teste' }).parentElement;
    expect(container).toHaveStyle({ height: '280px' });

    rerender(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" height={1200} />);
    expect(container).toHaveStyle({ height: '900px' });
  });
});
