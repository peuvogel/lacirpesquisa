import type { Topology } from 'topojson-specification';
import type { MuniEntry } from './types';

export type GeoAssetKind = 'muni' | 'meso' | 'health-macro';

/** Dynamic import loaders — no runtime fetch (MAP-05). */
const MUNI_LOADERS: Record<string, () => Promise<{ default: Topology }>> = {
  '29': () =>
    import('@/geo/topo/muni-29.json') as unknown as Promise<{ default: Topology }>,
};

const MESO_LOADER = (): Promise<{ default: Topology }> =>
  import('@/geo/topo/br-meso.sample.json') as unknown as Promise<{ default: Topology }>;

/** Load municipality TopoJSON for a UF by IBGE code (e.g. "29" for BA). */
export async function loadMuniTopo(ufIbge: string): Promise<Topology> {
  const loader = MUNI_LOADERS[ufIbge];
  if (!loader) {
    throw new Error(`Sem malha municipal para UF IBGE ${ufIbge}. Execute scripts/fetch-geo-assets.mjs.`);
  }
  const mod = await loader();
  return mod.default;
}

/** Load Brazil mesorregiões TopoJSON (sample in CI; full br-meso.json from fetch script). */
export async function loadMesoTopo(): Promise<Topology> {
  const mod = await MESO_LOADER();
  return mod.default;
}

/** Load health macro-region TopoJSON (Wave 4 — placeholder throws until asset exists). */
export async function loadHealthMacroTopo(): Promise<Topology> {
  throw new Error('health-macro.json ainda não disponível — execute scripts/fetch-geo-assets.mjs');
}

/** Load municipality name table for a UF sigla. */
export async function loadMuniNameTable(ufSigla: string): Promise<MuniEntry[]> {
  const normalized = ufSigla.toUpperCase();
  if (normalized === 'BA') {
    const mod = await import('@/geo/nameTables/muni-BA.json');
    return mod.default as MuniEntry[];
  }
  throw new Error(`Sem tabela de nomes para UF ${ufSigla}. Execute scripts/fetch-geo-assets.mjs.`);
}

/** Unified loader by kind + key. */
export async function loadGeoAsset(kind: GeoAssetKind, key?: string): Promise<Topology | MuniEntry[]> {
  switch (kind) {
    case 'muni':
      if (!key) throw new Error('loadGeoAsset(muni) requires UF IBGE code');
      return loadMuniTopo(key);
    case 'meso':
      return loadMesoTopo();
    case 'health-macro':
      return loadHealthMacroTopo();
    default:
      throw new Error(`Unknown geo asset kind: ${kind satisfies never}`);
  }
}
