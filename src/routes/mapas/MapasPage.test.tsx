import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  getCatalogLabel,
  getMetricByUf,
} from '@/features/catalog/catalogAnalysisData';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { getUfName } from './ufCodes';
import { MapasPage } from './MapasPage';

const DEBOUNCE_MS = 300;

function renderMapasPage(
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/mapas'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionProvider>
        <MapasPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('MapasPage group workspace', () => {
  it('renders group strip, region checkboxes and breadcrumb (no empty CTA strip)', () => {
    renderMapasPage();

    expect(screen.getByLabelText('Grupos de análise')).toBeInTheDocument();
    expect(screen.getByLabelText('Presets territoriais')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mesorregiões' })).toBeInTheDocument();
    expect(screen.getByLabelText('Navegação do mapa')).toBeInTheDocument();
    expect(screen.queryByText('Nada selecionado ainda')).not.toBeInTheDocument();
    expect(screen.queryByText(/estado\(s\) selecionado\(s\)/)).not.toBeInTheDocument();
  });

  it('applies the 5 regiões group preset from the strip menu', () => {
    renderMapasPage();
    fireEvent.click(screen.getByRole('button', { name: /Presets/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /5 regiões/i }));
    expect(screen.getByRole('tab', { name: /Norte/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sudeste/i })).toBeInTheDocument();
  });

  it('checking Norte selects regional UFs without instructional strip CTA', () => {
    renderMapasPage();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Norte' }));
    expect(screen.queryByText(/7 estado\(s\) selecionado\(s\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Crie um grupo/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amazonas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('unchecking Norte clears the regional UF selection', () => {
    renderMapasPage();
    const norte = screen.getByRole('checkbox', { name: 'Norte' });
    fireEvent.click(norte);
    expect(norte).toBeChecked();
    fireEvent.click(norte);
    expect(norte).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Amazonas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('unchecking a mesorregião clears municipality selection', () => {
    renderMapasPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mesorregiões' }));
    const meso = screen.getByRole('checkbox', { name: /Metropolitana de Salvador/i });
    fireEvent.click(meso);
    expect(meso).toBeChecked();
    fireEvent.click(meso);
    expect(meso).not.toBeChecked();
  });

  it('clears a partially selected region on the next checkbox click', () => {
    renderMapasPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Norte' }));
    // Remove one UF → region becomes partial/indeterminate.
    fireEvent.click(screen.getByRole('button', { name: 'Amazonas' }));
    const norte = screen.getByRole('checkbox', { name: 'Norte' });
    expect(norte).not.toBeChecked();
    fireEvent.click(norte);
    expect(norte).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Acre' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches preset carousel to mesorregiões layer', () => {
    renderMapasPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Mesorregiões' }));
    expect(screen.getByRole('checkbox', { name: /Metropolitana de Salvador/i })).toBeInTheDocument();
  });

  it('shows scoped mesorregião panel when zoomed into BA', async () => {
    renderMapasPage();
    fireEvent.dblClick(screen.getByRole('button', { name: 'Bahia' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Mesorregiões de BA')).toBeInTheDocument();
    });
    expect(screen.getByRole('checkbox', { name: /Metropolitana de Salvador/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Norte' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Metropolitana de São Paulo/i })).not.toBeInTheDocument();
  });
});

describe('MapasPage catalogVariableIds handoff (D-15)', () => {
  it('applies navigate state ids to the active group and checkbox list', async () => {
    const internacoesId = 'sih.embolia_e_trombose_arteriais.internacoes';

    renderMapasPage([
      {
        pathname: '/mapas',
        state: {
          catalogVariableIds: [internacoesId, 'unknown.not.in.catalog', 'ref.sih.nibr'],
        },
      },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText('Configuração de Catálogo')).toBeInTheDocument();
    });

    // Measure × disease: checkbox is the disease name, not the old flat label.
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }),
      ).toBeChecked();
    });

    expect(getCatalogLabel(internacoesId)).toMatch(/Internações/i);

    const metrics = getMetricByUf(internacoesId);
    expect(Object.keys(metrics).length).toBeGreaterThan(0);
  });
});

describe('MapasPage paste integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggles TerritoryPastePanel when Colar territórios is clicked', () => {
    renderMapasPage();

    expect(screen.getByRole('heading', { name: 'Explore o mapa do Brasil' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Colar territórios' }));
    expect(screen.getByRole('heading', { name: 'Colar territórios' })).toBeInTheDocument();
  });

  it('selects BA on the map when pasting Bahia', async () => {
    renderMapasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Colar territórios' }));
    const textarea = screen.getByLabelText('Cole territórios — um por linha');

    fireEvent.change(textarea, { target: { value: 'Bahia' } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(screen.getByRole('button', { name: getUfName('BA') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Reconhecidos (1)')).toBeInTheDocument();
    expect(screen.getAllByText('BA').length).toBeGreaterThan(0);
  });

  it('shows unmatched lines without blocking map interaction', async () => {
    renderMapasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Colar territórios' }));
    const textarea = screen.getByLabelText('Cole territórios — um por linha');

    fireEvent.change(textarea, { target: { value: 'BA\nXYZ' } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(screen.getByText('Não reconhecidos (1)')).toBeInTheDocument();
    expect(screen.getByText('XYZ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: getUfName('BA') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByRole('button', { name: /Bahia|Acre|Amazonas/ }).length).toBeGreaterThan(0);
  });
});
