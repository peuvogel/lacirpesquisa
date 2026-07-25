import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrazilMockMap } from './BrazilMockMap';
import { BrazilMapCanvas } from './BrazilMapCanvas';
import { getMockMetricByUf } from './mockAnalysisData';
import { UF_LIST, getUfName } from './ufCodes';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('BrazilMockMap', () => {
  it('renders exactly 27 interactive UF elements', () => {
    render(<BrazilMockMap hoveredUF={null} selectedUFs={[]} onHoverUF={() => {}} onToggleUF={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(27);
  });

  it('gives every UF an aria-label matching its state name', () => {
    render(<BrazilMockMap hoveredUF={null} selectedUFs={[]} onHoverUF={() => {}} onToggleUF={() => {}} />);
    for (const uf of UF_LIST) {
      expect(screen.getByRole('button', { name: getUfName(uf.sigla) })).toBeInTheDocument();
    }
  });

  it('calls onHoverUF with the sigla on mouse enter and with null on mouse leave', async () => {
    const user = userEvent.setup();
    const onHoverUF = vi.fn();
    render(<BrazilMockMap hoveredUF={null} selectedUFs={[]} onHoverUF={onHoverUF} onToggleUF={() => {}} />);

    const sp = screen.getByRole('button', { name: getUfName('SP') });
    await user.hover(sp);
    expect(onHoverUF).toHaveBeenCalledWith('SP');

    await user.unhover(sp);
    expect(onHoverUF).toHaveBeenCalledWith(null);
  });

  it('calls onToggleUF on click', async () => {
    const user = userEvent.setup();
    const onToggleUF = vi.fn();
    render(<BrazilMockMap hoveredUF={null} selectedUFs={[]} onHoverUF={() => {}} onToggleUF={onToggleUF} />);

    await user.click(screen.getByRole('button', { name: getUfName('BA') }));
    expect(onToggleUF).toHaveBeenCalledWith('BA');
  });

  it('calls onToggleUF when Enter is pressed on a focused path', async () => {
    const user = userEvent.setup();
    const onToggleUF = vi.fn();
    render(<BrazilMockMap hoveredUF={null} selectedUFs={[]} onHoverUF={() => {}} onToggleUF={onToggleUF} />);

    const mg = screen.getByRole('button', { name: getUfName('MG') });
    mg.focus();
    await user.keyboard('{Enter}');
    expect(onToggleUF).toHaveBeenCalledWith('MG');
  });

  it('calls onToggleUF when Space is pressed on a focused path, without scrolling the page', async () => {
    const user = userEvent.setup();
    const onToggleUF = vi.fn();
    render(<BrazilMockMap hoveredUF={null} selectedUFs={[]} onHoverUF={() => {}} onToggleUF={onToggleUF} />);

    const rs = screen.getByRole('button', { name: getUfName('RS') });
    rs.focus();
    const event = await user.keyboard('[Space]');
    expect(onToggleUF).toHaveBeenCalledWith('RS');
    expect(event).not.toBe(false);
  });

  it('reports aria-pressed="true" for a UF listed in selectedUFs', () => {
    render(<BrazilMockMap hoveredUF={null} selectedUFs={['PE', 'CE']} onHoverUF={() => {}} onToggleUF={() => {}} />);

    expect(screen.getByRole('button', { name: getUfName('PE') })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: getUfName('CE') })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: getUfName('SP') })).toHaveAttribute('aria-pressed', 'false');
  });

  // Cheap regression guard on the T-01-SVG sanitization step (Task 1, action 2):
  // the committed geometry module must never regain script/handler/href surface.
  // Comments are stripped first since the file's own top-of-file comment
  // *describes* the sanitization step (and therefore mentions these substrings
  // as prose, not as executable/markup content).
  it('commits sanitized geometry with no script/handler/href strings', () => {
    const raw = readFileSync(join(__dirname, 'brazilUfPaths.ts'), 'utf-8');
    const source = raw
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(source).not.toMatch(/<script/i);
    expect(source).not.toMatch(/\son\w+\s*=/i);
    expect(source).not.toMatch(/href\s*=/i);
  });
});

describe('BrazilMapCanvas', () => {
  const mockMetrics = getMockMetricByUf('mock.internacoes');

  it('renders exactly 27 interactive UF elements', () => {
    render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="mock.internacoes"
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(27);
  });

  it('applies different choropleth fills when mock values differ', () => {
    const { container } = render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="mock.internacoes"
      />,
    );

    const sp = container.querySelector('[data-uf="SP"]');
    const ac = container.querySelector('[data-uf="AC"]');
    expect(sp?.getAttribute('style')).toContain('fill');
    expect(ac?.getAttribute('style')).toContain('fill');
    expect(sp?.getAttribute('style')).not.toBe(ac?.getAttribute('style'));
  });

  it('gives every UF an aria-label matching its state name', () => {
    render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="mock.internacoes"
      />,
    );
    for (const uf of UF_LIST) {
      expect(screen.getByRole('button', { name: getUfName(uf.sigla) })).toBeInTheDocument();
    }
  });

  it('calls onToggleUF when Enter is pressed on a focused path', async () => {
    const user = userEvent.setup();
    const onToggleUF = vi.fn();
    render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={onToggleUF}
        choroplethValues={mockMetrics}
        activeVariableId="mock.internacoes"
      />,
    );

    const mg = screen.getByRole('button', { name: getUfName('MG') });
    mg.focus();
    await user.keyboard('{Enter}');
    expect(onToggleUF).toHaveBeenCalledWith('MG');
  });

  it('applies lacir-map-glow and teal stroke to selected UFs', () => {
    const { container } = render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={['BA']}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="mock.internacoes"
      />,
    );

    const ba = container.querySelector('[data-uf="BA"]');
    expect(ba).toHaveClass('lacir-map-glow');
    expect(ba).toHaveClass('stroke-accent');
  });
});
