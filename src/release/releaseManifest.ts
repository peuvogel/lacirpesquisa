import manifest from '../../release/release-manifest.json';

export type ReleaseRouteId = 'estatistica' | 'meta-analise' | 'variaveis' | 'mapas';
export type ReleaseAvailability = 'active' | 'coming-soon';

export interface ReleaseRoute {
  id: ReleaseRouteId;
  path: '/' | '/meta-analise' | '/variaveis' | '/mapas';
  label: 'Estatística' | 'Meta-análise' | 'Variáveis' | 'Mapas';
  documentTitle: string;
  availability: ReleaseAvailability;
}

export interface ReleaseManifest {
  pagesBase: '/lacirpesquisa/';
  offlineFilename: 'bioestatistica-lacir-offline.html';
  pagesBudgetBytes: 1572864;
  offlineBudgetBytes: 2621440;
  routes: readonly ReleaseRoute[];
}

export const COMING_SOON_COPY = 'Em breve' as const;

const KNOWN_PATHS = new Set<ReleaseRoute['path']>(['/', '/meta-analise', '/variaveis', '/mapas']);

function assertManifest(value: unknown): asserts value is ReleaseManifest {
  const candidate = value as Partial<ReleaseManifest>;

  if (
    candidate.pagesBase !== '/lacirpesquisa/'
    || candidate.offlineFilename !== 'bioestatistica-lacir-offline.html'
    || candidate.pagesBudgetBytes !== 1_572_864
    || candidate.offlineBudgetBytes !== 2_621_440
    || !Array.isArray(candidate.routes)
    || candidate.routes.length !== 4
    || candidate.routes.filter((route) => route.availability === 'active').length !== 1
    || candidate.routes.some((route) => !KNOWN_PATHS.has(route.path))
    || new Set(candidate.routes.map((route) => route.id)).size !== candidate.routes.length
    || new Set(candidate.routes.map((route) => route.path)).size !== candidate.routes.length
  ) {
    throw new Error('Manifesto de release inválido.');
  }
}

assertManifest(manifest);

export const RELEASE_MANIFEST: ReleaseManifest = manifest;

export function findReleaseRoute(pathname: string): ReleaseRoute | null {
  const pathWithoutQueryOrHash = pathname.split(/[?#]/, 1)[0] ?? '';
  const pathWithoutBase = pathWithoutQueryOrHash === '/lacirpesquisa'
    ? '/'
    : pathWithoutQueryOrHash.startsWith('/lacirpesquisa/')
      ? pathWithoutQueryOrHash.slice('/lacirpesquisa'.length)
      : pathWithoutQueryOrHash;
  const normalizedPath = pathWithoutBase.replace(/\/+$/, '') || '/';

  return RELEASE_MANIFEST.routes.find((route) => route.path === normalizedPath) ?? null;
}
