import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { EstatisticaPage } from '../routes/estatistica/EstatisticaPage';
import { MetaAnalisePage } from '../routes/meta-analise/MetaAnalisePage';
import { VariaveisPage } from '../routes/variaveis/VariaveisPage';
import { MapasPage } from '../routes/mapas/MapasPage';

export function resolveRouterBasename(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === '/' || trimmed === './') return '/';
  const rooted = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return rooted.replace(/\/+$/, '') || '/';
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <EstatisticaPage /> }, // D-04: landing = Estatística
      { path: '/meta-analise', element: <MetaAnalisePage /> },
      { path: '/variaveis', element: <VariaveisPage /> },
      { path: '/mapas', element: <MapasPage /> },
    ],
  },
], {
  basename: resolveRouterBasename(import.meta.env.BASE_URL),
});
