import { describe, expect, it, vi } from 'vitest';
import { COMING_SOON_COPY, RELEASE_MANIFEST, findReleaseRoute } from './releaseManifest';

describe('release manifest', () => {
  it('locks the public routes and availability', () => {
    expect(RELEASE_MANIFEST.routes.map(({ path, availability }) => ({ path, availability }))).toEqual([
      { path: '/', availability: 'active' },
      { path: '/meta-analise', availability: 'coming-soon' },
      { path: '/variaveis', availability: 'coming-soon' },
      { path: '/mapas', availability: 'coming-soon' },
    ]);
    expect(COMING_SOON_COPY).toBe('Em breve');
  });

  it('locks distribution names and byte budgets', () => {
    expect(RELEASE_MANIFEST).toMatchObject({
      pagesBase: '/lacirpesquisa/',
      offlineFilename: 'bioestatistica-lacir-offline.html',
      pagesBudgetBytes: 1_572_864,
      offlineBudgetBytes: 2_621_440,
    });
  });

  it('normalizes a known route without accepting unknown paths', () => {
    expect(findReleaseRoute('/lacirpesquisa/mapas/')?.id).toBe('mapas');
    expect(findReleaseRoute('/rota-inexistente')).toBeNull();
  });

  it('rejects routes outside the complete literal contract', async () => {
    const invalidManifests = [
      { index: 0, route: { ...RELEASE_MANIFEST.routes[0], id: 'desconhecida' } },
      { index: 1, route: { ...RELEASE_MANIFEST.routes[1], availability: 'indisponivel' } },
      { index: 2, route: { ...RELEASE_MANIFEST.routes[2], label: 'Dados' } },
      { index: 3, route: { ...RELEASE_MANIFEST.routes[3], documentTitle: 'Mapas' } },
    ];

    for (const invalidManifest of invalidManifests) {
      vi.resetModules();
      vi.doMock('../../release/release-manifest.json', () => ({
        default: {
          ...RELEASE_MANIFEST,
          routes: RELEASE_MANIFEST.routes.map((route, index) => (
            index === invalidManifest.index ? invalidManifest.route : route
          )),
        },
      }));

      await expect(import('./releaseManifest')).rejects.toThrow('Manifesto de release inválido.');
      vi.doUnmock('../../release/release-manifest.json');
    }
  });
});
