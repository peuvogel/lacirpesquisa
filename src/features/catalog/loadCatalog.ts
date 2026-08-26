/**
 * CAT-05 / D-09: load curated catalog assets from same-origin static JSON.
 * Runtime fetch to DATASUS/IBGE hosts is forbidden — only `/data/catalog/*`.
 */
import { resolvePublicAssetUrl } from '@/lib/publicAssets';
import {
  assertValidPackId,
  validateCatalogEntries,
  validateLoadedCatalog,
  validateManifest,
  validatePackFile,
} from './catalogPayload';
import type { CatalogEntry, Manifest, PackFile } from './types';

export interface LoadedCatalog {
  manifest: Manifest;
  variables: CatalogEntry[];
  packs: Record<string, PackFile>;
}

let cache: LoadedCatalog | null = null;
let pending: Promise<LoadedCatalog> | null = null;
let generation = 0;

export function resetCatalogCache(): void {
  generation += 1;
  cache = null;
  pending = null;
}

function catalogAssetUrl(assetPath: string): string {
  return resolvePublicAssetUrl(import.meta.env.BASE_URL, `data/catalog/${assetPath}`);
}

async function fetchCatalogJson(path: string): Promise<unknown> {
  const catalogBase = catalogAssetUrl('');
  if (!path.startsWith(catalogBase) || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Catálogo offline: caminho inválido (${path}).`);
  }
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Falha ao carregar catálogo (${path}): ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error(`Catálogo offline: JSON inválido (${path}).`);
  }
}

async function fetchFreshCatalog(): Promise<LoadedCatalog> {
  const manifest = validateManifest(await fetchCatalogJson(catalogAssetUrl('manifest.json')));
  const variables = validateCatalogEntries(await fetchCatalogJson(catalogAssetUrl('variables.json')));
  const packs: Record<string, PackFile> = {};

  await Promise.all(
    manifest.packs.map(async (ref) => {
      const packId = assertValidPackId(ref.packId, 'manifest.packId');
      packs[packId] = validatePackFile(
        await fetchCatalogJson(catalogAssetUrl(`packs/${packId}.json`)),
      );
    }),
  );
  validateLoadedCatalog(manifest, variables, packs);
  return { manifest, variables, packs };
}

/** Load manifest + variables + all packs; subsequent calls reuse the in-memory cache. */
export function loadCatalog(): Promise<LoadedCatalog> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;

  const requestGeneration = generation;
  const request = fetchFreshCatalog();
  pending = request;
  void request.then(
    (loaded) => {
      if (generation !== requestGeneration || pending !== request) return;
      cache = loaded;
      pending = null;
    },
    () => {
      if (generation === requestGeneration && pending === request) pending = null;
    },
  );

  return request;
}

/** Resolve a pack by id from the cached (or freshly loaded) catalog. */
export async function getCatalogPack(packId: string): Promise<PackFile> {
  assertValidPackId(packId);
  const { packs } = await loadCatalog();
  const pack = packs[packId];
  if (!pack) {
    throw new Error(`Pack não encontrado: ${packId}`);
  }
  return pack;
}

/** Alias used by plan action text — same as getCatalogPack. */
export const getPack = getCatalogPack;
