/**
 * CAT-05 / D-09: load curated catalog assets from same-origin static JSON.
 * Runtime fetch to DATASUS/IBGE hosts is forbidden — only `/data/catalog/*`.
 */
import type { CatalogEntry, Manifest, PackFile } from './types';

const CATALOG_BASE = '/data/catalog';

const FORBIDDEN_HOST =
  /(?:^|\/\/)(?:tabnet\.datasus\.gov\.br|sidra\.ibge\.gov\.br|servicodados\.ibge\.gov\.br)/i;

export interface LoadedCatalog {
  manifest: Manifest;
  variables: CatalogEntry[];
  packs: Record<string, PackFile>;
}

let cache: LoadedCatalog | null = null;

export function resetCatalogCache(): void {
  cache = null;
}

async function fetchCatalogJson<T>(path: string): Promise<T> {
  if (!path.startsWith(`${CATALOG_BASE}/`)) {
    throw new Error(`Catálogo offline: caminho inválido (${path}).`);
  }
  if (FORBIDDEN_HOST.test(path)) {
    throw new Error('Catálogo offline: não é permitido carregar de DATASUS/IBGE.');
  }
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Falha ao carregar catálogo (${path}): ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Load manifest + variables + all packs; subsequent calls reuse the in-memory cache. */
export async function loadCatalog(): Promise<LoadedCatalog> {
  if (cache) return cache;

  const manifest = await fetchCatalogJson<Manifest>(`${CATALOG_BASE}/manifest.json`);
  const variables = await fetchCatalogJson<CatalogEntry[]>(`${CATALOG_BASE}/variables.json`);
  const packs: Record<string, PackFile> = {};

  await Promise.all(
    manifest.packs.map(async (ref) => {
      packs[ref.packId] = await fetchCatalogJson<PackFile>(
        `${CATALOG_BASE}/packs/${ref.packId}.json`,
      );
    }),
  );

  cache = { manifest, variables, packs };
  return cache;
}

/** Resolve a pack by id from the cached (or freshly loaded) catalog. */
export async function getCatalogPack(packId: string): Promise<PackFile> {
  const { packs } = await loadCatalog();
  const pack = packs[packId];
  if (!pack) {
    throw new Error(`Pack não encontrado: ${packId}`);
  }
  return pack;
}

/** Alias used by plan action text — same as getCatalogPack. */
export const getPack = getCatalogPack;
