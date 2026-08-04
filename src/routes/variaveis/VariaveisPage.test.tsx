import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { resetCatalogCache } from '@/features/catalog/loadCatalog';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { VariaveisPage } from './VariaveisPage';

const CATALOG_ROOT = resolve(process.cwd(), 'public/data/catalog');

function readCatalogJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(CATALOG_ROOT, relativePath), 'utf8'));
}

function LocationProbe() {
  const location = useLocation();
  const state = location.state as {
    activeTestId?: string;
    catalogVariableIds?: string[];
  } | null;
  const catalogIds = state?.catalogVariableIds?.join(',') ?? '';
  return (
    <div data-testid="location-probe">
      {location.pathname}|{String(state?.activeTestId ?? '')}|{catalogIds}
    </div>
  );
}

function DatasetProbe() {
  const { dataset } = useSession();
  return (
    <div data-testid="dataset-probe">
      {dataset
        ? `${dataset.sourceLabel}|${dataset.headers.join(',')}|${dataset.rows.length}`
        : 'empty'}
    </div>
  );
}

function renderPage(initialPath = '/variaveis') {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/variaveis"
            element={
              <>
                <VariaveisPage />
                <DatasetProbe />
              </>
            }
          />
          <Route
            path="/"
            element={
              <>
                <h1>Estatística</h1>
                <LocationProbe />
                <DatasetProbe />
              </>
            }
          />
          <Route
            path="/mapas"
            element={
              <>
                <h1>Mapas</h1>
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('VariaveisPage', () => {
  beforeEach(() => {
    resetCatalogCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.startsWith('/data/catalog/')) {
          throw new Error(`Unexpected fetch URL: ${url}`);
        }
        const relative = url.replace(/^\/data\/catalog\//, '');
        return new Response(JSON.stringify(readCatalogJson(relative)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    resetCatalogCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not show Em breve placeholder', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Variáveis' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Em breve' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('listbox', { name: 'Variáveis do catálogo' })).toBeInTheDocument();
    });
  });

  it('filters the list by search query (CAT-01)', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(within(list).getByText(/Médicos vasculares no SUS/i)).toBeInTheDocument();
    });

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'cnes.medicos');

    await waitFor(() => {
      expect(within(list).getByText('Médicos vasculares no SUS (CNES)')).toBeInTheDocument();
      expect(within(list).queryByText('População residente (SIDRA)')).not.toBeInTheDocument();
    });
  });

  it('shows full provenance and suggested test hint when a row is selected (CAT-02/03)', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(within(list).getByText(/Médicos vasculares no SUS/i)).toBeInTheDocument();
    });

    await user.click(
      within(list).getByRole('button', { name: /Médicos vasculares no SUS/i }),
    );

    const provenance = await screen.findByTestId('provenance-block');
    expect(within(provenance).getByText('CNES')).toBeInTheDocument();
    expect(within(provenance).getByText('cnes/cnv/prid02br.def')).toBeInTheDocument();
    expect(within(provenance).getByText('2013–2025')).toBeInTheDocument();
    expect(
      within(provenance).getByRole('link', {
        name: 'http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/prid02br.def',
      }),
    ).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const hint = screen.getByTestId('suggested-test-hint');
    expect(hint).toHaveAttribute('data-hint-test-id', 'poisson');
    expect(within(hint).getByText('Regressão de Poisson')).toBeInTheDocument();
  });

  it('loads a loadable selection into Estatística via setDataset (D-14)', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(within(list).getByText(/Médicos vasculares no SUS/i)).toBeInTheDocument();
    });

    await user.click(
      within(list).getByRole('button', { name: /Médicos vasculares no SUS/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Carregar na Estatística' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Estatística' })).toBeInTheDocument();
    });

    const location = screen.getByTestId('location-probe').textContent ?? '';
    expect(location.startsWith('/|')).toBe(true);
    expect(location).toContain('poisson');

    const dataset = screen.getByTestId('dataset-probe').textContent ?? '';
    expect(dataset).toMatch(/Catálogo LACIR/);
    expect(dataset).toMatch(/uf_codigo/);
    expect(dataset).toMatch(/ano/);
    expect(dataset).not.toBe('empty');
  });

  it('loads multi-select embolia metrics with tidy UF×ano headers (D-16)', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(
        within(list).getByLabelText(/Incluir Internações por embolia e trombose arteriais/i),
      ).toBeInTheDocument();
    });

    await user.click(
      within(list).getByLabelText(/Incluir Internações por embolia e trombose arteriais/i),
    );
    await user.click(
      within(list).getByLabelText(
        /Incluir Óbitos hospitalares por embolia e trombose arteriais/i,
      ),
    );

    await user.click(screen.getByRole('button', { name: /Carregar na Estatística \(2\)/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Estatística' })).toBeInTheDocument();
    });

    const dataset = screen.getByTestId('dataset-probe').textContent ?? '';
    expect(dataset).toMatch(/Catálogo/);
    expect(dataset).toMatch(/uf_codigo,uf,ano,/);
    expect(dataset).toMatch(/Internações por embolia/);
    expect(dataset).toMatch(/Óbitos hospitalares por embolia/);
  });

  it('disables Estatística load for reference-only selection', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(within(list).getByText(/morbidade hospitalar por local de internação/i)).toBeInTheDocument();
    });

    await user.click(
      within(list).getByRole('button', {
        name: /morbidade hospitalar por local de internação/i,
      }),
    );

    const loadBtn = screen.getByRole('button', { name: 'Carregar na Estatística' });
    expect(loadBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Usar no mapa' })).toBeDisabled();
  });

  it('navigates to Mapas with catalogVariableIds (D-15)', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(
        within(list).getByLabelText(/Incluir Internações por embolia e trombose arteriais/i),
      ).toBeInTheDocument();
    });

    await user.click(
      within(list).getByLabelText(/Incluir Internações por embolia e trombose arteriais/i),
    );
    await user.click(
      within(list).getByLabelText(
        /Incluir Óbitos hospitalares por embolia e trombose arteriais/i,
      ),
    );
    await user.click(screen.getByRole('button', { name: /Usar no mapa \(2\)/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mapas' })).toBeInTheDocument();
    });

    const location = screen.getByTestId('location-probe').textContent ?? '';
    expect(location.startsWith('/mapas|')).toBe(true);
    expect(location).toContain('sih.embolia_e_trombose_arteriais.internacoes');
    expect(location).toContain('sih.embolia_e_trombose_arteriais.obitos');
  });
});
