import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { appRouteChildren, createAppRouter, resolveRouterBasename } from './router';

const originalScrollTo = window.scrollTo;

beforeAll(() => {
  window.scrollTo = vi.fn();
});

afterAll(() => {
  window.scrollTo = originalScrollTo;
});

// Mesma tabela que a aplicação monta — importada, não recopiada.
function buildRouter(initialPath: string, baseUrl = '/') {
  return createMemoryRouter(
    [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: appRouteChildren,
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
  const view = render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );

  return { router, ...view };
}

describe('router', () => {
  it('derives a React Router basename from Vite BASE_URL for local and project Pages builds', () => {
    expect(resolveRouterBasename('/')).toBe('/');
    expect(resolveRouterBasename('/lacirpesquisa/')).toBe('/lacirpesquisa');
  });

  it('uses the Pages basename for the browser distribution', () => {
    const router = createAppRouter({
      distribution: 'pages',
      baseUrl: '/lacirpesquisa/',
    });

    expect(router.basename).toBe('/lacirpesquisa');
    router.dispose();
  });

  it('uses hash routing for the offline distribution', () => {
    window.history.replaceState({}, '', '/bioestatistica-lacir-offline.html#/mapas');
    const router = createAppRouter({ distribution: 'offline', baseUrl: './' });

    expect(router.basename).toBe('/');
    expect(router.state.location.pathname).toBe('/mapas');

    router.dispose();
    window.history.replaceState({}, '', '/');
  });

  it('renders Mapas from a direct project Pages URL', () => {
    const router = buildRouter('/lacirpesquisa/mapas', '/lacirpesquisa/');
    render(
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    expect(screen.getByRole('main')).toHaveTextContent(/^Em breve$/);
  });

  it('renders the Estatística page at / (landing route, D-04)', () => {
    const { container } = renderAt('/');
    expect(container.querySelector('#lacir-test-module-mount')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Qual teste usar?' })).not.toBeInTheDocument();
  });

  it('defaults the active test to t-student at / (D-10/D-12)', () => {
    const { container } = renderAt('/');
    expect(container.querySelector('#lacir-test-module-mount')).toHaveAttribute(
      'data-active-test-id', 't-student',
    );
    expect(screen.getByRole('heading', { name: 't de Student' })).toBeInTheDocument();
  });

  it.each(['/meta-analise', '/variaveis', '/mapas'])(
    '%s has only literal copy in main',
    (path) => {
      renderAt(path);
      const main = screen.getByRole('main');

      expect(main).toHaveTextContent(/^Em breve$/);
      expect(within(main).queryAllByRole('button')).toHaveLength(0);
      expect(main.querySelector('canvas, img, [data-motion], .lacir-sticker')).toBeNull();
      expect(main.querySelector('.lacir-route-enter')).toBeNull();
    },
  );

  it('keeps the route entry treatment on the active Estatística route', () => {
    renderAt('/');

    expect(screen.getByRole('main').querySelector('.lacir-route-enter')).not.toBeNull();
  });

  it.each([
    ['/', 'Estatística — Bioestatística LACIR'],
    ['/meta-analise', 'Meta-análise — Bioestatística LACIR'],
    ['/variaveis', 'Variáveis — Bioestatística LACIR'],
    ['/mapas', 'Mapas — Bioestatística LACIR'],
  ])('sets the document title for %s', async (path, title) => {
    renderAt(path);

    await waitFor(() => expect(document.title).toBe(title));
  });

  it('focuses main only after the pathname changes', async () => {
    const { router } = renderAt('/meta-analise');
    const main = screen.getByRole('main');
    const currentLink = screen.getByRole('link', { name: 'Meta-análise' });

    expect(main).not.toHaveFocus();
    currentLink.focus();
    fireEvent.click(currentLink);
    expect(currentLink).toHaveFocus();

    await act(async () => {
      await router.navigate('/mapas');
    });
    await waitFor(() => expect(main).toHaveFocus());
  });

  it('keeps the closed modules out of reach: no catalog UI at /variaveis', () => {
    renderAt('/variaveis');
    expect(screen.queryByRole('searchbox', { name: 'Buscar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Variáveis do catálogo' })).not.toBeInTheDocument();
  });

  it('renders a safe fallback for an unknown path without exposing a stack trace', () => {
    renderAt('/rota-que-nao-existe');
    const main = screen.getByRole('main');

    expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar para estatística/i })).toBeInTheDocument();
    expect(main).toHaveTextContent(/não foi possível carregar esta página/i);
    expect(main).not.toHaveTextContent(/unexpected application error|error:|\bat\s+\w+/i);
  });

  it.each([
    ['pages', '/lacirpesquisa/rota-que-nao-existe', '/lacirpesquisa/'],
    ['offline', '/bioestatistica-lacir-offline.html#/rota-que-nao-existe', './'],
  ] as const)('keeps the %s fallback usable with an internal home link', (distribution, url, baseUrl) => {
    window.history.replaceState({}, '', url);
    const router = createAppRouter({ distribution, baseUrl });
    const view = render(
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    try {
      const main = screen.getByRole('main');
      const homeLink = screen.getByRole<HTMLAnchorElement>('link', {
        name: /voltar para estatística/i,
      });

      expect(main).toHaveTextContent(/não foi possível carregar esta página/i);
      expect(homeLink).not.toHaveAttribute('target');
      expect(new URL(homeLink.href).origin).toBe(window.location.origin);
      expect(main).not.toHaveTextContent(/unexpected application error|error:|\bat\s+\w+/i);
    } finally {
      view.unmount();
      router.dispose();
      window.history.replaceState({}, '', '/');
    }
  });
});
