import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartCanvas } from './ChartCanvas';

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
    options: { animation?: { duration?: number } };
  };
}

const sampleData = { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] };

describe('ChartCanvas', () => {
  beforeEach(() => {
    events.length = 0;
    ChartMock.mockClear();
    destroySpy.mockClear();
    updateSpy.mockClear();
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

  it('registers the logarithmic scale required by odds-ratio forests', () => {
    expect(ChartMock.register.mock.calls.flat(Number.POSITIVE_INFINITY)).toContain(logarithmicScale);
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
});
