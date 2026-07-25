import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartCanvas } from './ChartCanvas';

// vi.mock factories are hoisted above imports/top-level consts, so the spies
// they reference must be created via vi.hoisted to avoid a TDZ error.
const { ChartMock, destroySpy, events } = vi.hoisted(() => {
  const events: string[] = [];
  const destroySpy = vi.fn(() => {
    events.push('destroy');
  });
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock(canvas: unknown, config: unknown) {
    events.push('construct');
    return { canvas, config, destroy: destroySpy };
  });
  const ChartMock = ChartConstructorSpy as unknown as typeof ChartConstructorSpy & {
    new (...args: unknown[]): unknown;
    register: ReturnType<typeof vi.fn>;
  };
  ChartMock.register = vi.fn();
  return { ChartMock, destroySpy, events };
});

vi.mock('chart.js', () => ({
  Chart: ChartMock,
  BarController: {},
  LineController: {},
  ScatterController: {},
  LinearScale: {},
  CategoryScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  Legend: {},
  Tooltip: {},
  Filler: {},
}));

function getLastConfig() {
  const calls = (ChartMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[calls.length - 1]?.[1] as { type: string; data: unknown; options: { animation?: { duration?: number } } };
}

const sampleData = { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] };

describe('ChartCanvas', () => {
  beforeEach(() => {
    events.length = 0;
    ChartMock.mockClear();
    destroySpy.mockClear();
  });

  it('mounts exactly one Chart with the merged options', () => {
    render(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />);

    expect(ChartMock).toHaveBeenCalledTimes(1);
    const config = getLastConfig();
    expect(config.type).toBe('bar');
    expect(config.data).toBe(sampleData);
    // BASE_OPTS's animation settings must survive the merge.
    expect(config.options.animation).toEqual({ duration: 600, easing: 'easeOutQuart' });
    expect(events).toEqual(['construct']);
  });

  it('destroys the previous instance before constructing a new one on data change', () => {
    const { rerender } = render(<ChartCanvas type="bar" data={sampleData} ariaLabel="Gráfico teste" />);
    expect(events).toEqual(['construct']);

    const nextData = { labels: ['A', 'B', 'C'], datasets: [{ data: [1, 2, 3] }] };
    rerender(<ChartCanvas type="bar" data={nextData} ariaLabel="Gráfico teste" />);

    expect(events).toEqual(['construct', 'destroy', 'construct']);
  });

  it('destroys the instance on unmount', () => {
    const { unmount } = render(<ChartCanvas type="line" data={sampleData} ariaLabel="Gráfico teste" />);
    expect(destroySpy).not.toHaveBeenCalled();

    unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('renders the canvas with role img and the provided aria-label', () => {
    render(<ChartCanvas type="scatter" data={sampleData} ariaLabel="Distribuição dos dados" />);

    expect(screen.getByRole('img', { name: 'Distribuição dos dados' })).toBeInTheDocument();
  });
});
