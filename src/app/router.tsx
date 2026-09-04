import {
  createBrowserRouter,
  createHashRouter,
  type RouteObject,
} from 'react-router-dom';
import { RELEASE_MANIFEST, type ReleaseRoute } from '@/release/releaseManifest';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { EstatisticaPage } from '../routes/estatistica/EstatisticaPage';
import { ComingSoonPage } from '../routes/ComingSoonPage';

export type DistributionMode = 'pages' | 'offline';

export interface AppRouterOptions {
  distribution: DistributionMode;
  baseUrl: string;
}

export function resolveRouterBasename(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === '/' || trimmed === './') return '/';
  const rooted = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return rooted.replace(/\/+$/, '') || '/';
}

function createRouteElement(route: ReleaseRoute) {
  return route.availability === 'active' ? <EstatisticaPage /> : <ComingSoonPage />;
}

export const appRouteChildren: RouteObject[] = RELEASE_MANIFEST.routes.map((route) => ({
  path: route.path,
  element: createRouteElement(route),
}));

export function createAppRouter({
  distribution,
  baseUrl,
}: AppRouterOptions): ReturnType<typeof createBrowserRouter> {
  const routes: RouteObject[] = [
    {
      element: <AppShell />,
      errorElement: <RouteError />,
      children: appRouteChildren,
    },
  ];

  return distribution === 'offline'
    ? createHashRouter(routes)
    : createBrowserRouter(routes, { basename: resolveRouterBasename(baseUrl) });
}
