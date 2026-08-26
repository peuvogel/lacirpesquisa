import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCatalogPack, loadCatalog, resetCatalogCache } from './loadCatalog';

const CATALOG_ROOT = resolve(process.cwd(), 'public/data/catalog');

function readCatalogJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(CATALOG_ROOT, relativePath), 'utf8'));
}

const FORBIDDEN_HOSTS = [
  'tabnet.datasus.gov.br',
  'sidra.ibge.gov.br',
  'servicodados.ibge.gov.br',
];

function responseJson(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cloneCatalogJson<T>(relativePath: string): T {
  return structuredClone(readCatalogJson(relativePath)) as T;
}

function catalogRelativePath(url: string): string {
  return url.split('/data/catalog/')[1]!;
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe('loadCatalog', () => {
  beforeEach(() => {
    resetCatalogCache();
    vi.stubEnv('BASE_URL', '/lacirpesquisa/');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.startsWith('/lacirpesquisa/data/catalog/')) {
          throw new Error(`Unexpected fetch URL: ${url}`);
        }
        return responseJson(readCatalogJson(catalogRelativePath(url)));
      }),
    );
  });

  afterEach(() => {
    resetCatalogCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads static catalog assets beneath the configured project base', async () => {
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        paths.push(url);
        return responseJson(readCatalogJson(catalogRelativePath(url)));
      }),
    );

    const catalog = await loadCatalog();
    expect(paths[0]).toBe('/lacirpesquisa/data/catalog/manifest.json');
    expect(catalog.manifest.version).toBeTruthy();
    expect(catalog.variables.length).toBe(catalog.manifest.catalogEntryCount);
    expect(catalog.variables.length).toBeGreaterThan(0);
    expect(Object.keys(catalog.packs).sort()).toEqual(
      catalog.manifest.packs.map((p) => p.packId).sort(),
    );
    for (const pack of Object.values(catalog.packs)) {
      expect(pack.rows.length).toBeGreaterThan(0);
      expect(pack.keys).toEqual(expect.arrayContaining(['uf_codigo', 'uf', 'ano']));
    }
  });

  it('shares one in-flight catalog request between concurrent consumers', async () => {
    const manifest = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (catalogRelativePath(url) === 'manifest.json') return manifest.promise;
        return responseJson(readCatalogJson(catalogRelativePath(url)));
      }),
    );

    const first = loadCatalog();
    const second = loadCatalog();
    expect(fetch).toHaveBeenCalledTimes(1);

    manifest.resolve(responseJson(readCatalogJson('manifest.json')));
    const [firstCatalog, secondCatalog] = await Promise.all([first, second]);
    expect(secondCatalog).toBe(firstCatalog);
  });

  it('reuses a completed catalog cache on subsequent calls', async () => {
    const first = await loadCatalog();
    const second = await loadCatalog();
    expect(second).toBe(first);
    expect(fetch).toHaveBeenCalled();
    const callCount = vi.mocked(fetch).mock.calls.length;
    await loadCatalog();
    expect(vi.mocked(fetch).mock.calls.length).toBe(callCount);
  });

  it('never fetches DATASUS/IBGE hosts (CAT-05 / D-09)', async () => {
    await loadCatalog();
    const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith('/lacirpesquisa/data/catalog/')).toBe(true);
      for (const host of FORBIDDEN_HOSTS) {
        expect(url).not.toContain(host);
      }
    }
  });

  it('getCatalogPack returns a known pack by id', async () => {
    const pack = await getCatalogPack('sih.embolia_e_trombose_arteriais_uf');
    expect(pack.packId).toBe('sih.embolia_e_trombose_arteriais_uf');
    expect(pack.rows.length).toBe(351);
  });

  it('clears a failed request so the next load retries', async () => {
    let manifestAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (catalogRelativePath(url) === 'manifest.json' && manifestAttempts++ === 0) {
          return new Response('unavailable', { status: 503 });
        }
        return responseJson(readCatalogJson(catalogRelativePath(url)));
      }),
    );

    await expect(loadCatalog()).rejects.toThrow('503');
    await expect(loadCatalog()).resolves.toMatchObject({
      manifest: { version: '1.0.0' },
    });
    expect(manifestAttempts).toBe(2);
  });

  it('describes invalid JSON instead of treating it as a catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{', { status: 200 })),
    );

    await expect(loadCatalog()).rejects.toThrow('JSON inválido');
  });

  it('rejects an invalid variables payload before exposing it to consumers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const relative = catalogRelativePath(String(input));
        return responseJson(relative === 'variables.json' ? { invalid: true } : readCatalogJson(relative));
      }),
    );

    await expect(loadCatalog()).rejects.toThrow('variables');
  });

  it('rejects hostile manifest pack ids before constructing a pack URL', async () => {
    const manifest = cloneCatalogJson<{ packs: Array<{ packId: string }> }>('manifest.json');
    manifest.packs[0]!.packId = '../outside-catalog';
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        paths.push(url);
        return responseJson(catalogRelativePath(url) === 'manifest.json' ? manifest : readCatalogJson(catalogRelativePath(url)));
      }),
    );

    await expect(loadCatalog()).rejects.toThrow('packId inválido');
    expect(paths).toEqual(['/lacirpesquisa/data/catalog/manifest.json']);
  });

  it('rejects packs whose declared metric keys are malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const relative = catalogRelativePath(String(input));
        if (relative.endsWith('.json') && relative.startsWith('packs/')) {
          const pack = cloneCatalogJson<{ metricKeys: unknown }>(relative);
          pack.metricKeys = 'internacoes';
          return responseJson(pack);
        }
        return responseJson(readCatalogJson(relative));
      }),
    );

    await expect(loadCatalog()).rejects.toThrow('metricKeys');
  });

  it('rejects an undeclared object value in a pack row', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const relative = catalogRelativePath(String(input));
        if (relative.endsWith('.json') && relative.startsWith('packs/')) {
          const pack = cloneCatalogJson<{ rows: Array<Record<string, unknown>> }>(relative);
          pack.rows[0]!.unexpectedMetadata = { nested: true };
          return responseJson(pack);
        }
        return responseJson(readCatalogJson(relative));
      }),
    );

    await expect(loadCatalog()).rejects.toThrow('unexpectedMetadata');
  });

  it('does not let a reset-invalidated request repopulate the cache', async () => {
    const manifest = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const relative = catalogRelativePath(String(input));
        if (relative === 'manifest.json' && vi.mocked(fetch).mock.calls.length === 1) {
          return manifest.promise;
        }
        return responseJson(readCatalogJson(relative));
      }),
    );

    const staleLoad = loadCatalog();
    resetCatalogCache();
    manifest.resolve(responseJson(readCatalogJson('manifest.json')));
    await expect(staleLoad).resolves.toMatchObject({ manifest: { version: '1.0.0' } });

    await loadCatalog();
    const manifestFetches = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => String(url))
      .filter((url) => catalogRelativePath(url) === 'manifest.json');
    expect(manifestFetches).toHaveLength(2);
  });
});
