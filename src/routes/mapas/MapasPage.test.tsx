import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import {
  getCatalogLabel,
  getMetricByUf,
} from '@/features/catalog/catalogAnalysisData';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { getUfName } from './ufCodes';
import { MapasPage } from './MapasPage';

const DEBOUNCE_MS = 300;

function renderMapasPage(
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/mapas'],
  onSession: (session: ReturnType<typeof useSession>) => void = () => {},
  onPathname: (pathname: string) => void = () => {},
  onNavigate: (navigate: NavigateFunction) => void = () => {},
) {
  function SessionObserver() {
    onSession(useSession());
    return null;
  }

  function LocationObserver() {
    onPathname(useLocation().pathname);
    onNavigate(useNavigate());
    return null;
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionProvider>
        <SessionObserver />
        <LocationObserver />
        <MapasPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('MapasPage group workspace', () => {
  it('guides the user to complete groups, disease and period before continuing to variables', () => {
    renderMapasPage();

    expect(screen.getByTestId('review-blocked-hint')).toHaveTextContent(
      'Complete grupos, doença e período',
    );
    expect(screen.getByRole('button', { name: 'Começar análise' })).toBeDisabled();
  });

  it('keeps the completed cut on Mapas and reveals the guided analysis below', async () => {
    const sessionRef: { current: ReturnType<typeof useSession> | null } = { current: null };
    let pathname = '/mapas';
    renderMapasPage(
      ['/mapas'],
      (session) => {
        sessionRef.current = session;
      },
      (nextPathname) => {
        pathname = nextPathname;
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar grupo 1 com 1 território/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mesmo intervalo em todos os grupos/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Começar análise' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Começar análise' }));

    expect(pathname).toBe('/mapas');
    expect(await screen.findByRole('region', { name: 'Análise do recorte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Qual é o objetivo?' })).toBeInTheDocument();
    expect(screen.queryByTestId('review-analysis-dialog')).not.toBeInTheDocument();
    expect(sessionRef.current?.researchDesign?.groups[0]?.territories).toEqual([
      { id: '29', label: 'Bahia' },
    ]);
    expect(sessionRef.current?.researchDesign?.diseaseIds).toEqual(['embolia_e_trombose_arteriais']);
    expect(sessionRef.current?.dataset).toBeNull();
  });

  it('moves focus predictably to the unlocked embedded analysis without adding a second h1', async () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollSpy,
    });
    renderMapasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar grupo 1 com 1 território/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mesmo intervalo em todos os grupos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar análise' }));

    const region = await screen.findByRole('region', { name: 'Análise do recorte' });
    await waitFor(() => expect(document.activeElement).toBe(region));
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: /BA · Embolia/i })).toBeInTheDocument();
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: expect.stringMatching(/smooth|auto/) }));
  });

  it('invalidates an unlocked analysis when the semantic cut changes', async () => {
    const sessionRef: { current: ReturnType<typeof useSession> | null } = { current: null };
    let pathname = '/mapas';
    let navigate: NavigateFunction | null = null;
    renderMapasPage(
      ['/mapas'],
      (session) => { sessionRef.current = session; },
      (nextPathname) => { pathname = nextPathname; },
      (nextNavigate) => { navigate = nextNavigate; },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar grupo 1 com 1 território/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mesmo intervalo em todos os grupos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar análise' }));

    await screen.findByRole('region', { name: 'Análise do recorte' });
    fireEvent.click(screen.getByRole('button', { name: /Valem para todos os grupos/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Infarto cerebral/i }));

    expect(screen.queryByRole('region', { name: 'Análise do recorte' })).not.toBeInTheDocument();
    expect(sessionRef.current?.researchDesign).toBeNull();
    act(() => navigate?.('/variaveis'));
    expect(pathname).toBe('/variaveis');
    expect(sessionRef.current?.researchDesign).toBeNull();
  });

  it('clears the persisted research design together with the visible map cut', async () => {
    const sessionRef: { current: ReturnType<typeof useSession> | null } = { current: null };
    renderMapasPage(['/mapas'], (session) => {
      sessionRef.current = session;
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar grupo 1 com 1 território/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mesmo intervalo em todos os grupos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar análise' }));
    await screen.findByRole('region', { name: 'Análise do recorte' });
    expect(sessionRef.current?.researchDesign).not.toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar mapa' })
      .find((button) => button.textContent === 'Limpar mapa')!);
    fireEvent.click(screen.getByRole('button', { name: 'Sim, apagar' }));

    expect(screen.queryByRole('region', { name: 'Análise do recorte' })).not.toBeInTheDocument();
    expect(sessionRef.current?.researchDesign).toBeNull();
  });

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
