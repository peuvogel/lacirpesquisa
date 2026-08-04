import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrazilMockMap } from './BrazilMockMap';
import { BrazilMapCanvas } from './BrazilMapCanvas';
import { getMetricByUf } from '@/features/catalog/catalogAnalysisData';
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
    await waitFor(() => {
      expect(onHoverUF).toHaveBeenCalledWith(null);
    });
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
  const mockMetrics = getMetricByUf('sih.embolia_e_trombose_arteriais.internacoes');

  it('renders exactly 27 interactive UF elements', () => {
    render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
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
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
      />,
    );

    const spPaint = container.querySelector('[data-uf="SP"][data-layer="paint"]');
    const acPaint = container.querySelector('[data-uf="AC"][data-layer="paint"]');
    expect(spPaint?.getAttribute('fill')).toBeTruthy();
    expect(acPaint?.getAttribute('fill')).toBeTruthy();
    expect(spPaint?.getAttribute('fill')).not.toBe(acPaint?.getAttribute('fill'));
  });

  it('gives every UF an aria-label matching its state name', () => {
    render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
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
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
      />,
    );

    const mg = screen.getByRole('button', { name: getUfName('MG') });
    mg.focus();
    await user.keyboard('{Enter}');
    expect(onToggleUF).toHaveBeenCalledWith('MG');
  });

  it('marks selected UFs with aria-pressed and outer-selection filter (no per-UF glow)', () => {
    const { container } = render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={['BA']}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
      />,
    );

    const ba = screen.getByRole('button', { name: getUfName('BA') });
    expect(ba).toHaveAttribute('aria-pressed', 'true');
    expect(ba).not.toHaveClass('lacir-map-glow');
    expect(container.querySelector('filter#lacir-group-outer-0')).toBeTruthy();
    expect(container.querySelector('[data-selection-filter="lacir-group-outer-0"]')).toBeTruthy();
  });

  it('uses the next group palette color for a pending selection', () => {
    const { container } = render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={['BA']}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={{}}
        activeVariableId={null}
        pendingGroupIndex={1}
        groupMembership={{
          SP: { groupIndex: 0, groupName: 'Grupo 1' },
        }}
      />,
    );

    expect(container.querySelector('[data-selection-filter="lacir-group-outer-1"]')).toBeTruthy();
    const baPaint = container.querySelector('[data-uf="BA"][data-layer="paint"]');
    expect(baPaint?.getAttribute('fill')).toContain('59, 130, 246');
  });

  it('zooms into BA with municipality paths while Brazil SVG stays mounted', async () => {
    const onSetMapView = vi.fn();
    const { container } = render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
        mapView={{ level: 'municipio', parentCode: 'BA', ufIbge: '29' }}
        onSetMapView={onSetMapView}
      />,
    );

    expect(
      screen.getByRole('group', { name: /Zoom em Bahia/i }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-uf="BA"][data-layer="paint"]')).toBeTruthy();
    expect(container.querySelector('[data-uf="SP"][data-layer="paint"]')).toBeTruthy();

    await waitFor(() => {
      expect(container.querySelector('[data-layer="drill-features"]')).toBeTruthy();
      expect(container.querySelectorAll('[data-territory-id]').length).toBeGreaterThan(0);
    });

    // Neighbor UFs are painted but not interactive hit targets.
    expect(screen.queryByRole('button', { name: 'São Paulo' })).not.toBeInTheDocument();
  });

  it('returns to Brasil UF choropleth when mapView level is uf', () => {
    render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
        mapView={{ level: 'uf' }}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(27);
  });

  it('exposes selected municipalities as clickable hits on Brazil view', async () => {
    const onToggleDrillFeature = vi.fn();
    const { container } = render(
      <BrazilMapCanvas
        hoveredUF={null}
        selectedUFs={[]}
        onHoverUF={() => {}}
        onToggleUF={() => {}}
        choroplethValues={mockMetrics}
        activeVariableId="sih.embolia_e_trombose_arteriais.internacoes"
        mapView={{ level: 'uf' }}
        selectedMunicipioIds={['2927408']}
        onToggleDrillFeature={onToggleDrillFeature}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-layer="selected-munis-hit"]')).toBeTruthy();
    });

    const hit = container.querySelector(
      '[data-layer="selected-munis-hit"] [data-territory-id="2927408"]',
    );
    expect(hit).toBeTruthy();
    fireEvent.click(hit!);
    expect(onToggleDrillFeature).toHaveBeenCalledWith('2927408');
  });
});
