import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { resetCatalogCache } from '@/features/catalog/loadCatalog';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import type { ResearchDesign } from '@/features/research/types';
import { formatResearchPeriodLabel } from './researchCutSummary';
import { VariaveisPage } from './VariaveisPage';

const CATALOG_ROOT = resolve(process.cwd(), 'public/data/catalog');

function readCatalogJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(CATALOG_ROOT, relativePath), 'utf8'));
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
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

const guidedDesign: ResearchDesign = {
  groups: [
    {
      id: 'nordeste',
      name: 'Nordeste',
      territories: [
        { id: '29', label: 'Bahia' },
        { id: '28', label: 'Sergipe' },
      ],
    },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia_e_trombose_arteriais'],
  period: { scope: 'shared', time: { mode: 'range', start: '2023', end: '2025' } },
};

function ResearchDesignSeeder({ design }: { design: ResearchDesign }) {
  const { setResearchDesign } = useSession();
  useEffect(() => setResearchDesign(design), [design, setResearchDesign]);
  return null;
}

function renderPage(initialPath = '/variaveis', researchDesign?: ResearchDesign) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/variaveis"
            element={
              <>
                {researchDesign ? <ResearchDesignSeeder design={researchDesign} /> : null}
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

  it('retries a failed catalog load without leaving the page', async () => {
    const user = userEvent.setup();
    const retryManifest = deferred<Response>();
    let manifestAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const relative = url.replace(/^\/data\/catalog\//, '');
        if (relative === 'manifest.json') {
          manifestAttempts += 1;
          if (manifestAttempts === 1) return new Response('unavailable', { status: 503 });
          if (manifestAttempts === 2) return retryManifest.promise;
        }
        return new Response(JSON.stringify(readCatalogJson(relative)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    renderPage();
    expect(await screen.findByText(/503/)).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: 'Tentar novamente' });
    await user.click(retry);
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeDisabled();
    expect(screen.queryByText(/503/)).not.toBeInTheDocument();

    retryManifest.resolve(
      new Response(JSON.stringify(readCatalogJson('manifest.json')), { status: 200 }),
    );
    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    expect(list).toBeInTheDocument();
    expect(within(list).getByText(/Médicos vasculares no SUS/i)).toBeInTheDocument();
    expect(manifestAttempts).toBe(2);
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

  it('finds AVC-labeled entries after canonization via the curated alias layer (TAX-05)', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(within(list).getByText(/Infarto cerebral/i)).toBeInTheDocument();
    });

    // Pos-canonizacao nenhum id/rotulo contem "avc" — sem a camada de apelido (withDiseaseAliases)
    // esta busca devolveria zero, exatamente o defeito que TAX-05 existe para impedir.
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'avc');

    await waitFor(() => {
      expect(within(list).getByText(/Infarto cerebral/i)).toBeInTheDocument();
    });
    // Rotulo exibido e sempre o oficial da Lista Morb — nenhuma mencao literal a "AVC" (D-19).
    expect(within(list).queryByText(/\bAVC\b/)).not.toBeInTheDocument();
  });

  it('keeps source and method closed and removes unsafe suggested tests in direct catalog mode', async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole('listbox', { name: 'Variáveis do catálogo' });
    await waitFor(() => {
      expect(within(list).getByText(/Médicos vasculares no SUS/i)).toBeInTheDocument();
    });

    await user.click(
      within(list).getByRole('button', { name: /Médicos vasculares no SUS/i }),
    );

    expect(screen.queryByTestId('provenance-block')).not.toBeInTheDocument();
    expect(screen.queryByText('cnes/cnv/prid02br.def')).not.toBeInTheDocument();
    expect(screen.queryByTestId('suggested-test-hint')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fonte e método' }));
    const provenance = await screen.findByTestId('provenance-block');
    expect(within(provenance).getByText('CNES')).toBeInTheDocument();
    expect(within(provenance).getByText('cnes/cnv/prid02br.def')).toBeInTheDocument();
    expect(within(provenance).getByText('2013–2025')).toBeInTheDocument();
    expect(
      within(provenance).getByRole('link', {
        name: 'http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/prid02br.def',
      }),
    ).toHaveAttribute('rel', expect.stringContaining('noopener'));

  });

  it('keeps the legacy guided route compatible', async () => {
    const user = userEvent.setup();
    renderPage('/variaveis', guidedDesign);

    expect(await screen.findByRole('heading', { name: /Nordeste · Embolia e trombose arteriais/i })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('2 territórios')).toBeInTheDocument();
    expect(screen.getByText('2023–2025')).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Variáveis do catálogo' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Descrever' }));
    expect(await screen.findByRole('heading', { name: '2. Dados indisponíveis' })).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma variável foi presumida/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps a description-only map design locked against promotion to comparison', async () => {
    renderPage('/variaveis', { ...guidedDesign, goal: 'describe' });

    expect(await screen.findByRole('heading', { name: /Nordeste · Embolia e trombose arteriais/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Comparar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Descrever e comparar/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '2. Dados indisponíveis' })).toBeInTheDocument();
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
    expect(location).toBe('/||');

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

describe('formatResearchPeriodLabel', () => {
  it('simplifies complete annual boundaries without changing monthly labels', () => {
    expect(formatResearchPeriodLabel({ mode: 'range', start: '2013-01', end: '2025-12' })).toBe('2013–2025');
    expect(formatResearchPeriodLabel({ mode: 'point', point: '2020' })).toBe('2020');
    expect(formatResearchPeriodLabel({ mode: 'compare', periodA: '2019-01', periodB: '2020-12' })).toBe('2019 × 2020');
    expect(formatResearchPeriodLabel({ mode: 'range', start: '2020-03', end: '2020-11' })).toBe('2020-03–2020-11');
  });
});
