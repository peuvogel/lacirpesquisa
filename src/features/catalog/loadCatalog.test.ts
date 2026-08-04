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

describe('loadCatalog', () => {
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
        const body = JSON.stringify(readCatalogJson(relative));
        return new Response(body, {
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

  it('loads manifest, variables and packs from static /data/catalog assets', async () => {
    const catalog = await loadCatalog();
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

  it('reuses cache on subsequent calls', async () => {
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
      expect(url.startsWith('/data/catalog/')).toBe(true);
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
});
