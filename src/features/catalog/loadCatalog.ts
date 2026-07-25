import type { CatalogEntry, Manifest, PackFile } from './types';

export interface LoadedCatalog {
  manifest: Manifest;
  variables: CatalogEntry[];
  packs: Record<string, PackFile>;
}

export function resetCatalogCache(): void {
  // stub — implemented in GREEN
}

export async function loadCatalog(): Promise<LoadedCatalog> {
  throw new Error('not implemented');
}

export async function getCatalogPack(_packId: string): Promise<PackFile> {
  throw new Error('not implemented');
}

export const getPack = getCatalogPack;
