import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { EstatisticaPage } from '../routes/estatistica/EstatisticaPage';
import { MetaAnalisePage } from '../routes/meta-analise/MetaAnalisePage';
import { VariaveisPage } from '../routes/variaveis/VariaveisPage';
import { MapasPage } from '../routes/mapas/MapasPage';
import { resolveRouterBasename } from './router';

function buildRouter(initialPath: string, baseUrl = '/') {
  return createMemoryRouter(
    [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { path: '/', element: <EstatisticaPage /> },
          { path: '/meta-analise', element: <MetaAnalisePage /> },
          { path: '/variaveis', element: <VariaveisPage /> },
          { path: '/mapas', element: <MapasPage /> },
        ],
      },
    ],
    {
      basename: resolveRouterBasename(baseUrl),
      initialEntries: [initialPath],
    },
  );
}

function renderAt(initialPath: string) {
  const router = buildRouter(initialPath);
  return render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
}

describe('router', () => {
  it('derives a React Router basename from Vite BASE_URL for local and project Pages builds', () => {
    expect(resolveRouterBasename('/')).toBe('/');
    expect(resolveRouterBasename('/lacirpesquisa/')).toBe('/lacirpesquisa');
  });

  it('renders Mapas from a direct project Pages URL', () => {
    const router = buildRouter('/lacirpesquisa/mapas', '/lacirpesquisa/');
    render(
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Mapas' })).toBeInTheDocument();
  });

  it('renders the Estatística page at / (landing route, D-04)', () => {
    const { container } = renderAt('/');
    expect(container.querySelector('#lacir-test-module-mount')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Qual teste usar?' })).toBeInTheDocument();
  });

  it('defaults the active test to t-student at / (D-10/D-12)', () => {
    const { container } = renderAt('/');
    expect(container.querySelector('#lacir-test-module-mount')).toHaveAttribute(
      'data-active-test-id', 't-student',
    );
    expect(screen.getByRole('heading', { name: 't de Student' })).toBeInTheDocument();
  });

  it('renders the shared Em breve placeholder at /meta-analise', () => {
    renderAt('/meta-analise');
    expect(screen.getByRole('heading', { name: 'Meta-análise' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Em breve' })).toBeInTheDocument();
  });

  it('renders the Variáveis catalog UI at /variaveis (not Em breve)', () => {
    renderAt('/variaveis');
    expect(screen.getByRole('heading', { name: 'Variáveis' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Em breve' })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Variáveis do catálogo' })).toBeInTheDocument();
  });

  it('renders the Mapas heading at /mapas', () => {
    renderAt('/mapas');
    expect(screen.getByRole('heading', { name: 'Mapas' })).toBeInTheDocument();
  });

  it('renders the friendly error/fallback element for an unknown path, not a blank page', () => {
    renderAt('/rota-que-nao-existe');
    expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar para estatística/i })).toBeInTheDocument();
  });
});
